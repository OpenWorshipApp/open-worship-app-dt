import './SlideAutoPlayComp.scss';

import {
    type ChangeEvent,
    useCallback,
    useState,
    type CSSProperties,
} from 'react';

import {
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import type { SlideAutoPlayOptionsType } from './slideAutoPlayHelpers';
import {
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    getSlideAutoPlayDrawnSeconds,
    REPEAT_KIND_NONE,
    getSlideAutoPlayRemainingSeconds,
    MAX_SLIDE_AUTO_PLAY_STEP,
    notifySlideAutoPlayStateChanged,
    REPEAT_KIND_ALL,
    setSlideAutoPlayDrawnSeconds,
    setSlideAutoPlayDueAt,
    subscribeSlideAutoPlayState,
    toIsPlayingSettingName,
    toIsUntilMediaEndSettingName,
    toMaxSecondsSettingName,
    toRepeatKindSettingName,
    toSecondsSettingName,
    toStepSettingName,
    toValidRepeatKind,
} from './slideAutoPlayHelpers';

export type NextDataType = {
    isNext: boolean;
    options: SlideAutoPlayOptionsType;
};

/**
 * Moves the show on. Answering `false` ENDS it -- "no repeat" running off the
 * end of the list is the case that matters, and only the caller knows where
 * the list ends.
 */
export type OnNextType = (
    data: NextDataType,
) => boolean | void | Promise<boolean | void>;

function toNumberValue(event: ChangeEvent<HTMLInputElement>, minimum: number) {
    return Math.max(minimum, Number.parseInt(event.target.value) || 0);
}

/**
 * The rules of one show, as the panel edits them.
 *
 * The values are settings rather than component state on purpose: the
 * foreground widgets' clock runs with nothing rendered and reads exactly the
 * same keys back through `readSlideAutoPlayOptions`.
 */
type SlideAutoPlayOptionsStateType = ReturnType<typeof useSlideAutoPlayOptions>;

function useSlideAutoPlayOptions(prefix: string) {
    const [seconds, setSeconds] = useStateSettingNumber(
        toSecondsSettingName(prefix),
        5,
    );
    const [maxSeconds, setMaxSeconds] = useStateSettingNumber(
        toMaxSecondsSettingName(prefix),
        0,
    );
    const [repeatKindText, setRepeatKindText] = useStateSettingString(
        toRepeatKindSettingName(prefix),
        REPEAT_KIND_ALL,
    );
    const [step, setStep] = useStateSettingNumber(toStepSettingName(prefix), 1);
    const [isUntilMediaEnd, setIsUntilMediaEnd] = useStateSettingBoolean(
        toIsUntilMediaEndSettingName(prefix),
        false,
    );
    const options: SlideAutoPlayOptionsType = {
        seconds: Math.max(0, seconds),
        maxSeconds: Math.max(0, maxSeconds),
        repeatKind: toValidRepeatKind(repeatKindText),
        step: Math.max(1, step),
        isUntilMediaEnd,
    };
    return {
        options,
        setSeconds,
        setMaxSeconds,
        setRepeatKind: setRepeatKindText,
        setStep,
        setIsUntilMediaEnd,
    };
}

/**
 * How long until the next item, so a waiting show can be told from a stuck
 * one.
 *
 * It reads the due time off the shared registry once a second rather than
 * being handed it: the clock driving this show may be the effect two
 * components up or the module-level one that keeps running with the panel
 * closed, and the number on screen must not care which.
 */
function SlideAutoPlayCountdownComp({
    prefix,
    isUntilMediaEnd,
}: Readonly<{ prefix: string; isUntilMediaEnd: boolean }>) {
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
        () => {
            return getSlideAutoPlayRemainingSeconds(prefix);
        },
    );
    useAppEffect(() => {
        const read = () => {
            setRemainingSeconds(getSlideAutoPlayRemainingSeconds(prefix));
        };
        read();
        // One second, and only while this control is rendered: the whole cost
        // of the feature is one `setState` on one small element.
        const intervalId = setInterval(read, 1000);
        return () => {
            clearInterval(intervalId);
        };
    }, [prefix]);
    if (remainingSeconds === null) {
        return null;
    }
    const label = isUntilMediaEnd
        ? `${tran('Next When The Video Ends')} (${remainingSeconds}s)`
        : `${tran('Next In')} ${remainingSeconds}s`;
    return (
        <span
            className="slide-auto-play-countdown"
            title={label}
            aria-label={label}
            role="timer"
        >
            {remainingSeconds}s
        </span>
    );
}

function SlideAutoPlayOptionsToggleComp({
    isShowing,
    onToggle,
}: Readonly<{ isShowing: boolean; onToggle: () => void }>) {
    const label = tran('Slide Show Options');
    return (
        <button
            type="button"
            className={
                'slide-auto-play-options-toggle' +
                (isShowing ? ' slide-auto-play-options-toggle-on' : '')
            }
            title={label}
            aria-label={label}
            aria-expanded={isShowing}
            onClick={onToggle}
        >
            <i className="bi bi-sliders" />
        </button>
    );
}

/**
 * The rules, opened IN PLACE.
 *
 * Deliberately not a floating layer: both bars that carry it sit over
 * something the operator is working in -- a panel of slide cards, a grid of
 * backgrounds -- and a layer over those hides the very thing the setting is
 * about. It expands the bar instead, the way a section does, and closes by its
 * own ✕ as well as by the toggle.
 */
function SlideAutoPlayOptionsComp({
    optionsState,
    canUntilMediaEnd,
    isUntilMediaEnd,
    onStateChange,
    onClose,
}: Readonly<{
    optionsState: SlideAutoPlayOptionsStateType;
    canUntilMediaEnd: boolean;
    isUntilMediaEnd: boolean;
    onStateChange?: () => void;
    onClose: () => void;
}>) {
    const {
        options,
        setMaxSeconds,
        setRepeatKind,
        setStep,
        setIsUntilMediaEnd,
    } = optionsState;
    const onStateChangeRef = useAppCurrentRef(onStateChange);
    const handleRepeatAllChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setRepeatKind(
                event.target.checked ? REPEAT_KIND_ALL : REPEAT_KIND_NONE,
            );
            onStateChangeRef.current?.();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleStepChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setStep(toNumberValue(event, 1));
            onStateChangeRef.current?.();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleMaxSecondsChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setMaxSeconds(toNumberValue(event, 0));
            onStateChangeRef.current?.();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleUntilMediaEndChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setIsUntilMediaEnd(event.target.checked);
            onStateChangeRef.current?.();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Slide Show Options');
    const closeLabel = tran('Close Slide Show Options');
    return (
        <div
            className="slide-auto-play-options-panel"
            role="group"
            aria-label={label}
        >
            {/* No heading. The block is attached to the button that opened
                it and carries that button's words as its own accessible
                name, so a title row here would repeat the control above it
                and cost a whole line in a panel that can be 200px tall. */}
            <div className="slide-auto-play-options-row">
                {/* Two values, so a tick rather than a picker: "keep going
                    round" or stop at the end. It also reads at a glance,
                    which a closed picker showing "Repeat A..." did not. */}
                <label className="slide-auto-play-options-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        aria-label={tran('Repeat All')}
                        checked={options.repeatKind === REPEAT_KIND_ALL}
                        onChange={handleRepeatAllChanging}
                    />
                    <span aria-hidden="true">{tran('Repeat All')}</span>
                </label>
                <button
                    type="button"
                    className="slide-auto-play-options-close"
                    title={closeLabel}
                    aria-label={closeLabel}
                    onClick={onClose}
                >
                    <i className="bi bi-x-lg" />
                </button>
            </div>
            {/* Two numbers on one line. They are read together -- how far a
                tick jumps and how long it may wait -- and each is two
                characters wide. */}
            <div className="slide-auto-play-options-row">
                <label>
                    <span aria-hidden="true">{tran('Step')}</span>
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        min="1"
                        max={`${MAX_SLIDE_AUTO_PLAY_STEP}`}
                        aria-label={tran('Jumping Step')}
                        title={tran('Jumping Step')}
                        value={options.step}
                        onChange={handleStepChanging}
                    />
                </label>
                {isUntilMediaEnd ? null : (
                    <label>
                        <span aria-hidden="true">{tran('Random Up To')}</span>
                        <input
                            className="form-control form-control-sm"
                            type="number"
                            min="0"
                            aria-label={tran('Random Up To Seconds')}
                            // The sentence that was a line of prose under
                            // these rows: it explains one field, so it belongs
                            // on that field rather than on the panel.
                            title={tran('A New Wait Is Drawn For Each Slide')}
                            value={options.maxSeconds}
                            onChange={handleMaxSecondsChanging}
                        />
                        <span
                            className="slide-auto-play-options-unit"
                            aria-hidden="true"
                        >
                            s
                        </span>
                    </label>
                )}
            </div>
            {canUntilMediaEnd ? (
                <label className="slide-auto-play-options-row slide-auto-play-options-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        aria-label={tran('Wait Until The Video Ends')}
                        checked={options.isUntilMediaEnd}
                        onChange={handleUntilMediaEndChanging}
                    />
                    <span aria-hidden="true">
                        {tran('Wait Until The Video Ends')}
                    </span>
                </label>
            ) : null}
        </div>
    );
}

function PlayingIconComp({
    onNext,
    setIsPlaying,
    prefix,
    options,
    isTimerExternal,
    onStateChange,
}: Readonly<{
    onNext: OnNextType;
    setIsPlaying: (isPlaying: boolean) => void;
    prefix: string;
    options: SlideAutoPlayOptionsType;
    isTimerExternal: boolean;
    onStateChange?: () => void;
}>) {
    const setIsPlayingRef = useAppCurrentRef(setIsPlaying);
    const onStateChangeRef = useAppCurrentRef(onStateChange);
    const handleStopPlaying = useCallback(() => {
        setIsPlayingRef.current(false);
        onStateChangeRef.current?.();
        notifySlideAutoPlayStateChanged();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const optionsRef = useAppCurrentRef(options);
    const { seconds, maxSeconds, repeatKind, step } = options;
    useAppEffect(() => {
        // The foreground media widgets keep their own timer OUTSIDE React so a
        // show carries on while its session is not rendered; ticking here too
        // would advance every slide twice.
        if (isTimerExternal || seconds <= 0) {
            return;
        }
        // Each tick is scheduled after the last one has RUN, rather than on a
        // fixed interval: putting a background up decodes an image and redraws
        // the screen, and on the machines this app is built for that can take
        // longer than the interval -- `setInterval` would then fire again the
        // moment the previous tick returned, and a five second slide show
        // would start stuttering through images instead of resting on them.
        let timerId: ReturnType<typeof setTimeout> | null = null;
        let isStopped = false;
        const scheduleNext = () => {
            const delaySeconds = genNextDelaySeconds(optionsRef.current);
            if (!(delaySeconds > 0)) {
                return;
            }
            setSlideAutoPlayDueAt(prefix, Date.now() + delaySeconds * 1000);
            setSlideAutoPlayDrawnSeconds(prefix, delaySeconds);
            timerId = setTimeout(async () => {
                const canContinue = await onNext({
                    isNext: true,
                    options: optionsRef.current,
                });
                if (isStopped) {
                    return;
                }
                // Only an explicit `false` ends it: a handler that answers
                // nothing at all is the old contract and must keep running.
                if (canContinue === false) {
                    setSlideAutoPlayDueAt(prefix, null);
                    setSlideAutoPlayDrawnSeconds(prefix, null);
                    setIsPlayingRef.current(false);
                    onStateChangeRef.current?.();
                    notifySlideAutoPlayStateChanged();
                    return;
                }
                scheduleNext();
            }, delaySeconds * 1000);
        };
        scheduleNext();
        return () => {
            isStopped = true;
            if (timerId !== null) {
                clearTimeout(timerId);
            }
            setSlideAutoPlayDueAt(prefix, null);
            setSlideAutoPlayDrawnSeconds(prefix, null);
        };
        // `optionsRef` carries the live values into the tick; the primitives
        // listed are what a RESTART of the countdown should depend on.
    }, [
        onNext,
        prefix,
        seconds,
        maxSeconds,
        repeatKind,
        step,
        isTimerExternal,
    ]);
    const label = tran('Stop Slide Show');
    return (
        <button
            className="slide-auto-play-toggle slide-auto-play-toggle-on"
            title={label}
            aria-label={label}
            onClick={handleStopPlaying}
        >
            <i className="bi bi-pause-fill" />
        </button>
    );
}

function PlayerComp({
    onNext,
    prefix,
    options,
    isTimerExternal,
    onStateChange,
}: Readonly<{
    onNext: OnNextType;
    prefix: string;
    options: SlideAutoPlayOptionsType;
    isTimerExternal: boolean;
    onStateChange?: () => void;
}>) {
    const [isPlaying, setIsPlaying] = useStateSettingBoolean(
        toIsPlayingSettingName(prefix),
        false,
    );
    const setIsPlayingRef = useAppCurrentRef(setIsPlaying);
    const onStateChangeRef = useAppCurrentRef(onStateChange);
    // A show can end ITSELF -- "no repeat" running out, with the clock in
    // another module -- and nothing else about the app changes at that
    // moment, so without this the panel keeps drawing a pause button over a
    // clock that is no longer running.
    useAppEffect(() => {
        return subscribeSlideAutoPlayState(() => {
            setIsPlayingRef.current(checkIsSlideAutoPlaying(prefix));
        });
    }, [prefix]);
    const handleStartPlaying = useCallback(() => {
        setIsPlayingRef.current(true);
        onStateChangeRef.current?.();
        notifySlideAutoPlayStateChanged();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!isPlaying) {
        const label = tran('Start Slide Show');
        return (
            <button
                className="slide-auto-play-toggle"
                title={label}
                aria-label={label}
                onClick={handleStartPlaying}
            >
                <i className="bi bi-play-fill" />
            </button>
        );
    }
    return (
        <PlayingIconComp
            setIsPlaying={setIsPlaying}
            prefix={prefix}
            options={options}
            onNext={onNext}
            isTimerExternal={isTimerExternal}
            onStateChange={onStateChange}
        />
    );
}

export default function SlideAutoPlayComp({
    onNext,
    prefix,
    style,
    isTimerExternal = false,
    isInline = false,
    canUntilMediaEnd = false,
    onStateChange,
}: Readonly<{
    onNext: OnNextType;
    prefix: string;
    style?: CSSProperties;
    /**
     * The caller runs the clock. The controls and their settings stay here;
     * only the ticking moves out -- see `autoPlayRunnerHelpers`.
     */
    isTimerExternal?: boolean;
    /**
     * Sit in the flow instead of floating over the bottom of the panel. The
     * floating shape is right over a previewer, where there is nowhere else
     * to put it; in a foreground widget's own panel it covered the last row
     * of the file grid, so there it rides the sticky bar with the session
     * strip and Properties.
     */
    isInline?: boolean;
    /**
     * Offer "wait until the video ends". Only a list whose items are CLIPS
     * can honour it -- over a folder of pictures it would be a switch that
     * does nothing.
     */
    canUntilMediaEnd?: boolean;
    /** Fired when the play state or the interval changes, for an external clock. */
    onStateChange?: () => void;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(
        `${prefix}-slide-auto-play-show`,
        false,
    );
    // Remembered per show, like the Properties control beside it: a volunteer
    // who opened these to set a repeat is usually about to set the next one
    // too, and a panel that shuts itself on every re-render is one they have
    // to find again each time.
    const [isOptionsShowing, setIsOptionsShowing] = useStateSettingBoolean(
        `${prefix}-slide-auto-play-show-options`,
        false,
    );
    const setIsOptionsShowingRef = useAppCurrentRef(setIsOptionsShowing);
    const handleOptionsToggling = useCallback(() => {
        setIsOptionsShowingRef.current((oldIsShowing) => {
            return !oldIsShowing;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOptionsClosing = useCallback(() => {
        setIsOptionsShowingRef.current(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ONE copy of the rules for the whole control. Two `useStateSetting*`
    // hooks on the same key hold separate React state, so a second copy in
    // the options panel left the bar showing the old value until it
    // remounted -- which is how the countdown came to say "Next in" over a
    // show that was waiting on a clip.
    const optionsState = useSlideAutoPlayOptions(prefix);
    const { options, setSeconds } = optionsState;
    // Redrawn when a show starts, stops, ends itself or DRAWS its next wait --
    // once per slide, not once per second.
    const [, bumpAutoPlayState] = useState(0);
    useAppEffect(() => {
        return subscribeSlideAutoPlayState(() => {
            bumpAutoPlayState((oldCount) => {
                return oldCount + 1;
            });
        });
    }, []);
    const isUntilMediaEnd = canUntilMediaEnd && options.isUntilMediaEnd;
    // A random ceiling means nothing once the clip decides the wait.
    const isRandom = !isUntilMediaEnd && options.maxSeconds > 0;
    // In BOTH of those modes the wait is worked out rather than typed, so the
    // seconds box stops being something to type in and becomes the READOUT of
    // the wait now running -- a clip's own length, or the number just drawn.
    // It is not hidden: the whole reason to show it is that a show which only
    // ever displayed the number the operator typed told them nothing about
    // what it was actually doing.
    const isSecondsDrawn = isRandom || isUntilMediaEnd;
    const drawnSeconds = getSlideAutoPlayDrawnSeconds(prefix);
    const hasDrawnSeconds = isSecondsDrawn && drawnSeconds !== null;
    const shownSeconds = hasDrawnSeconds ? drawnSeconds : options.seconds;
    const secondsTitle = hasDrawnSeconds
        ? isUntilMediaEnd
            ? tran('How Long This Video Runs')
            : tran('The Wait Drawn For This Slide')
        : tran('Seconds');
    const setIsShowingRef = useAppCurrentRef(setIsShowing);
    const handleShowAutoPlay = useCallback(() => {
        setIsShowingRef.current(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleHideAutoPlay = useCallback(() => {
        setIsShowingRef.current(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setSecondsRef = useAppCurrentRef(setSeconds);
    const onStateChangeRef = useAppCurrentRef(onStateChange);
    const handleTimerChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setSecondsRef.current(toNumberValue(event, 0));
            onStateChangeRef.current?.();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Slide Show');
    const optionsElement = isOptionsShowing ? (
        <SlideAutoPlayOptionsComp
            optionsState={optionsState}
            canUntilMediaEnd={canUntilMediaEnd}
            isUntilMediaEnd={isUntilMediaEnd}
            onStateChange={onStateChange}
            onClose={handleOptionsClosing}
        />
    ) : null;
    if (!isInline && !isShowing) {
        return (
            // A bare `<i>` had no name of any kind, so the one control that
            // starts a slide show could not be found by its words -- not by a
            // volunteer reading the panel, not by the assistant, not by a
            // screen reader.
            <button
                type="button"
                className="slide-auto-play-icon app-caught-hover-pointer"
                title={label}
                aria-label={label}
                onClick={handleShowAutoPlay}
                style={style}
            >
                <i className="bi bi-stopwatch-fill" />
            </button>
        );
    }
    const hideLabel = tran('Hide Slide Show Controls');
    // ONE shape in both homes. The floating form used to spread Bootstrap
    // form controls across a full-width band -- a 120px input group holding a
    // two-character number, behind a prefix box reading "S:" that the unit
    // after the number already says -- and the band blacked out a whole row
    // of the slide cards the show is stepping through. It is the same
    // segmented strip as the toolbar one now, hugging its own contents.
    const bar = (
        <span className="slide-auto-play-inline" title={label}>
            {/* The way back to the stopwatch, and only where there is one: a
                toolbar has no hiding place, and a show you must first reveal
                before you can stop it is the wrong trade minutes before a
                service. */}
            {isInline ? null : (
                <button
                    type="button"
                    className="slide-auto-play-toggle slide-auto-play-hide"
                    title={hideLabel}
                    aria-label={hideLabel}
                    onClick={handleHideAutoPlay}
                >
                    <i className="bi bi-x-lg" />
                </button>
            )}
            <PlayerComp
                prefix={prefix}
                options={options}
                onNext={onNext}
                isTimerExternal={isTimerExternal}
                onStateChange={onStateChange}
            />
            <input
                className={
                    'slide-auto-play-seconds' +
                    (isSecondsDrawn ? ' slide-auto-play-seconds-drawn' : '')
                }
                type="number"
                min="0"
                aria-label={secondsTitle}
                title={secondsTitle}
                readOnly={isSecondsDrawn}
                value={shownSeconds}
                onChange={handleTimerChange}
            />
            <span className="slide-auto-play-unit" aria-hidden="true">
                s
            </span>
            <SlideAutoPlayCountdownComp
                prefix={prefix}
                isUntilMediaEnd={isUntilMediaEnd}
            />
            <SlideAutoPlayOptionsToggleComp
                isShowing={isOptionsShowing}
                onToggle={handleOptionsToggling}
            />
        </span>
    );
    if (isInline) {
        if (optionsElement === null) {
            return bar;
        }
        // The same shape the Properties control takes when it opens: the
        // toggle keeps its line, the body goes UNDER it and the panel makes
        // room. Nothing floats over the file grid, which is the thing the
        // settings are about.
        return (
            <div className="slide-auto-play-expanded">
                <div className="mb-1">{bar}</div>
                {optionsElement}
            </div>
        );
    }
    // Floating, the rules open under the bar the same way -- and because the
    // whole thing is anchored to the BOTTOM of the previewer, that grows it
    // upward, covering the slides nearest the bar rather than pushing itself
    // off the panel.
    return (
        <div className="slide-auto-play show" style={style}>
            {optionsElement === null ? (
                bar
            ) : (
                <>
                    <div className="mb-1">{bar}</div>
                    {optionsElement}
                </>
            )}
        </div>
    );
}
