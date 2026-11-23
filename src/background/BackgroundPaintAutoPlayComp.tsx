import { useCallback } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { useAppEffect } from '../helper/appHooks';
import {
    readSessions,
    toSessionSuffix,
} from '../media-sessions/mediaSessionData';
import { applyAutoPlayRunners } from '../slide-auto-play/autoPlayRunnerHelpers';
import SlideAutoPlayComp from '../slide-auto-play/SlideAutoPlayComp';
import {
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    notifySlideAutoPlayStateChanged,
    readSlideAutoPlayOptions,
    setIsSlideAutoPlaying,
} from '../slide-auto-play/slideAutoPlayHelpers';
import {
    findNextPaintShowSrc,
    type PaintShowKindType,
} from './paintShowOrderHelpers';
import {
    readPaintPinnedSrcList,
    readPaintSavedSrcList,
} from './paintShowSavedHelpers';

/**
 * The slide show of the Background panel's Fills or Animations tab
 * (2026-11-15, the user: _like background image, `Fills` and `Animations`
 * should support session and auto-play_): every screen holding a fill (or an
 * animation) moves on to the next one in its row (`findPaintShowRow`),
 * staggered so several screens do not redraw in the same frame.
 *
 * Its clock lives OUTSIDE React, as the Images tab's does: the tabs unmount
 * whenever another is looked at, and a show that stopped because the
 * operator glanced at Videos is a show nobody could trust through a service.
 *
 * A screen has ONE background, so one show walks it: a show started in one
 * session ends the one running in another (`stopOtherSessionShows`). Two
 * sessions walking the same gradients would each move every screen.
 */

/** The settings namespace a tab's session list lives under. */
export function toBackgroundPaintSessionTarget(kind: PaintShowKindType) {
    return `background-${kind}`;
}

/** One session's show: its settings prefix and the key its timer runs under. */
export function toBackgroundPaintAutoPlayPrefix(
    kind: PaintShowKindType,
    sessionSuffix: string,
) {
    return `background-${kind}${sessionSuffix}`;
}

function checkIsOwnKey(kind: PaintShowKindType, key: string) {
    const base = toBackgroundPaintAutoPlayPrefix(kind, '');
    return key === base || key.startsWith(`${base}-`);
}

/**
 * One step of a session's show, with nothing rendered. Answers false when
 * nothing moved: the tab's kind is off every screen, or what is up is in no
 * row, or "no repeat" ran off the end of it.
 */
export function tickBackgroundPaint(
    kind: PaintShowKindType,
    sessionSuffix: string,
    isNext = true,
) {
    const showingList =
        ScreenBackgroundManager.getBackgroundSrcListByType(kind);
    if (showingList.length === 0) {
        return false;
    }
    const savedSrcList = readPaintSavedSrcList(kind, sessionSuffix);
    const pinnedSrcList = readPaintPinnedSrcList(kind);
    const options = readSlideAutoPlayOptions(
        toBackgroundPaintAutoPlayPrefix(kind, sessionSuffix),
    );
    const moveList = showingList
        .map(([screenIdText, backgroundSrc]) => {
            const src = findNextPaintShowSrc(
                kind,
                backgroundSrc.src,
                savedSrcList,
                {
                    isNext,
                    step: options.step,
                    repeatKind: options.repeatKind,
                },
                pinnedSrcList,
            );
            if (src === null) {
                return null;
            }
            return {
                screenId: Number.parseInt(screenIdText),
                src,
                scaleType: backgroundSrc.scaleType,
                extraStyle: backgroundSrc.extraStyle,
            };
        })
        .filter((move) => {
            return move !== null;
        });
    for (let i = 0; i < moveList.length; i++) {
        const { screenId, src, scaleType, extraStyle } = moveList[i];
        setTimeout(() => {
            const screenBackgroundManager =
                ScreenBackgroundManager.getInstance(screenId);
            if (screenBackgroundManager === null) {
                return;
            }
            // Put up, never pressed: a row of one under "repeat" answers the
            // fill that is up, and a press would take it down. How the screen
            // had it styled belongs to the screen and goes with the show.
            screenBackgroundManager.applyBackgroundSrcWithSyncGroup({
                type: kind,
                src,
                scaleType,
                extraStyle,
            });
        }, i * 100);
    }
    return moveList.length > 0;
}

/**
 * Starts or stops the timer of every session of this tab that is playing,
 * read from the SETTINGS, so a session nobody is looking at keeps its show.
 * Only this tab's own keys are touched: the Images tab and the foreground
 * keep theirs.
 */
export function syncBackgroundPaintAutoPlayRunners(kind: PaintShowKindType) {
    const isShowing =
        ScreenBackgroundManager.getBackgroundSrcListByType(kind).length > 0;
    const runners = [];
    for (const session of readSessions(toBackgroundPaintSessionTarget(kind))) {
        const sessionSuffix = toSessionSuffix(session.id);
        const prefix = toBackgroundPaintAutoPlayPrefix(kind, sessionSuffix);
        if (!checkIsSlideAutoPlaying(prefix)) {
            continue;
        }
        // A clear (F7, the live tile pressed off) ENDS the show, as it does
        // the Images tab's: left playing, the next fill put up would start
        // cycling by itself.
        if (!isShowing) {
            setIsSlideAutoPlaying(prefix, false);
            notifySlideAutoPlayStateChanged();
            continue;
        }
        const options = readSlideAutoPlayOptions(prefix);
        if (!(options.seconds > 0 || options.maxSeconds > 0)) {
            continue;
        }
        runners.push({
            key: prefix,
            // What decides HOW it waits; the fill up is deliberately not in
            // it, or every step would reset the countdown.
            signature: [
                options.seconds,
                options.maxSeconds,
                options.repeatKind,
                options.step,
            ].join(':'),
            getDelaySeconds: () => {
                return genNextDelaySeconds(options);
            },
            tick: () => {
                return tickBackgroundPaint(kind, sessionSuffix);
            },
            onEnded: () => {
                setIsSlideAutoPlaying(prefix, false);
                notifySlideAutoPlayStateChanged();
            },
        });
    }
    applyAutoPlayRunners(runners, (key) => {
        return checkIsOwnKey(kind, key);
    });
}

/** The one layer's one show: every other session's is ended. */
function stopOtherSessionShows(kind: PaintShowKindType, sessionId: string) {
    let isChanged = false;
    for (const session of readSessions(toBackgroundPaintSessionTarget(kind))) {
        if (session.id === sessionId) {
            continue;
        }
        const prefix = toBackgroundPaintAutoPlayPrefix(
            kind,
            toSessionSuffix(session.id),
        );
        if (checkIsSlideAutoPlaying(prefix)) {
            setIsSlideAutoPlaying(prefix, false);
            isChanged = true;
        }
    }
    if (isChanged) {
        notifySlideAutoPlayStateChanged();
    }
}

/**
 * Reconciles the tab's timers whenever what is on the screens changes --
 * called by the TAB, not by the strip, so a clear that takes the strip away
 * still ends the show.
 */
export function useBackgroundPaintAutoPlaySync(
    kind: PaintShowKindType,
    showingCount: number,
) {
    useAppEffect(() => {
        syncBackgroundPaintAutoPlayRunners(kind);
    }, [kind, showingCount]);
}

export default function BackgroundPaintAutoPlayComp({
    kind,
    sessionId,
}: Readonly<{ kind: PaintShowKindType; sessionId: string }>) {
    const sessionSuffix = toSessionSuffix(sessionId);
    const prefix = toBackgroundPaintAutoPlayPrefix(kind, sessionSuffix);
    const handleStateChange = useCallback(() => {
        if (checkIsSlideAutoPlaying(prefix)) {
            stopOtherSessionShows(kind, sessionId);
        }
        syncBackgroundPaintAutoPlayRunners(kind);
    }, [kind, sessionId, prefix]);
    // The clock is external, so this is the control's own step: the
    // runner's tick, so the two can never walk different rows.
    const handleNext = useCallback(
        ({ isNext }: { isNext: boolean }) => {
            return tickBackgroundPaint(kind, sessionSuffix, isNext);
        },
        [kind, sessionSuffix],
    );
    return (
        <SlideAutoPlayComp
            // Its play state and rules are read once per mount.
            key={prefix}
            prefix={prefix}
            onNext={handleNext}
            isTimerExternal
            isInline
            onStateChange={handleStateChange}
        />
    );
}
