import { renderToStaticMarkup } from 'react-dom/server';
import CountdownController from './managers/CountdownController';
import { getHTMLChild } from '../helper/helpers';
import type ScreenManagerBase from './managers/ScreenManagerBase';
import type {
    ForegroundMessageDataType,
    ForegroundCountdownDataType,
    ForegroundImageDataType,
    ForegroundMarqueeDataType,
    ForegroundQuickTextDataType,
    ForegroundStopwatchDataType,
    ForegroundTimeDataType,
    ForegroundVideoDataType,
    ForegroundWebDataType,
    MarqueePositionType,
    StyleAnimType,
} from './screenTypeHelpers';
import type { TransitionEffectType } from './transitionEffectHelpers';
import {
    DEFAULT_MARQUEE_SPEED_PERCENTAGE,
    MAX_MARQUEE_SPEED_PERCENTAGE,
    MIN_MARQUEE_SPEED_PERCENTAGE,
} from './screenTypeHelpers';
import TimingController from './managers/TimingController';
import StopwatchController from './managers/StopwatchController';
import { checkIsSameTimerExceptTiming } from './managers/timerStateHelpers';
import FileSource from '../helper/FileSource';
import RenderBackgroundWebIframeComp from '../background/RenderBackgroundWebIframeComp';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { playMediaElement, releaseMediaElement } from '../helper/mediaHelpers';
import appProvider from '../server/appProvider';
import { genWebScreenShotElement } from './managers/screenWebsiteHelpers';
import { genMarqueeFontSize } from './marqueeBandHelpers';

const MARQUEE_SLIDE_MILLISECOND = 500;
const MARQUEE_FADE_MILLISECOND = 1000;

/**
 * How a marquee band comes in and goes out. A band is anchored to an edge, so
 * with no transition of its own it slides in from that edge -- deliberately
 * NOT the screen's `Foreground:` effect, which is what every other overlay
 * falls back to. Its session or its component can still choose one: "Slide
 * In" is that same edge slide, the others are the usual fade, zoom and cut.
 * Pure CSS on the band itself, like the slide always was.
 */
export function genMarqueeTransitionCss(
    transitionEffect: TransitionEffectType | undefined,
    hiddenTranslateY: string,
) {
    if (transitionEffect === 'none') {
        return { base: '', inFrames: '', outFrames: '', millisecond: 0 };
    }
    if (transitionEffect === 'fade') {
        return {
            base: 'opacity: 0;',
            inFrames: '0% { opacity: 0; } 100% { opacity: 1; }',
            outFrames: '0% { opacity: 1; } 100% { opacity: 0; }',
            millisecond: MARQUEE_FADE_MILLISECOND,
        };
    }
    if (transitionEffect === 'zoom') {
        return {
            base: 'opacity: 0; transform: scale(0.1);',
            inFrames:
                '0% { opacity: 0; transform: scale(0.1); }' +
                ' 100% { opacity: 1; transform: scale(1); }',
            outFrames:
                '0% { opacity: 1; transform: scale(1); }' +
                ' 100% { opacity: 0; transform: scale(0.1); }',
            millisecond: MARQUEE_SLIDE_MILLISECOND,
        };
    }
    return {
        base: `transform: translateY(${hiddenTranslateY});`,
        inFrames:
            `0% { transform: translateY(${hiddenTranslateY}); }` +
            ' 100% { transform: translateY(0); }',
        outFrames:
            '0% { transform: translateY(0); }' +
            ` 100% { transform: translateY(${hiddenTranslateY}); }`,
        millisecond: MARQUEE_SLIDE_MILLISECOND,
    };
}

export function genHtmlForegroundMarquee(
    {
        text,
        speedPercentage = DEFAULT_MARQUEE_SPEED_PERCENTAGE,
        extraStyle = {},
        transitionEffect,
    }: ForegroundMarqueeDataType,
    screenManagerBase: ScreenManagerBase,
    position: MarqueePositionType,
) {
    const clampedSpeedPercentage = Math.max(
        MIN_MARQUEE_SPEED_PERCENTAGE,
        Math.min(MAX_MARQUEE_SPEED_PERCENTAGE, speedPercentage),
    );
    const duration =
        (text.length / 6) *
        (DEFAULT_MARQUEE_SPEED_PERCENTAGE / clampedSpeedPercentage);
    const fontSize = genMarqueeFontSize(screenManagerBase.height);
    const uniqueClassname = `cn-${crypto.randomUUID()}`;
    // Keyframes are scoped per instance so a top and a bottom marquee showing
    // at the same time cannot overwrite each other's slide-in direction.
    const movingKeyframe = `anim-${uniqueClassname}-moving`;
    const inKeyframe = `anim-${uniqueClassname}-in`;
    const outKeyframe = `anim-${uniqueClassname}-out`;
    const hiddenTranslateY = position === 'top' ? '-100%' : '100%';
    const transitionCss = genMarqueeTransitionCss(
        transitionEffect,
        hiddenTranslateY,
    );
    const inAnimation =
        transitionCss.millisecond > 0
            ? `animation: ${inKeyframe} ${transitionCss.millisecond}ms ease-in forwards;`
            : '';
    const outAnimation =
        transitionCss.millisecond > 0
            ? `animation: ${outKeyframe} ${transitionCss.millisecond}ms ease-out forwards;`
            : '';
    const htmlString = renderToStaticMarkup(
        <div
            style={{
                position: 'absolute',
                width: '100%',
                left: '0px',
                ...(position === 'top' ? { top: '0px' } : { bottom: '0px' }),
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    width: 100%;
                    padding: 3px 0px;
                    margin: 0 auto;
                    overflow: hidden;
                    color: white;
                    font-size: ${fontSize}px;
                    box-shadow: inset 0 0 10px lightblue;
                    will-change: transform;
                    ${transitionCss.base}
                    ${inAnimation}
                    white-space: nowrap;
                }
                .${uniqueClassname}.out {
                    ${outAnimation}
                }
                .${uniqueClassname} span {
                    display: inline-block;
                    will-change: transform;
                    width: max-content;
                }
                .${uniqueClassname}.moving span {
                    padding-left: 100%;
                    animation-duration: ${duration}s;
                    animation-timing-function: linear;
                    animation-delay: 0s;
                    animation-iteration-count: infinite;
                    animation-direction: normal;
                    animation-fill-mode: none;
                    animation-play-state: running;
                    animation-name: ${movingKeyframe};
                }
                .${uniqueClassname}.out span {
                    animation-play-state: paused;
                }
                @keyframes ${movingKeyframe} {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes ${inKeyframe} {
                    ${transitionCss.inFrames}
                }
                @keyframes ${outKeyframe} {
                    ${transitionCss.outFrames}
                }
            `}</style>
            <p className={uniqueClassname} style={extraStyle}>
                <span>{text}</span>
            </p>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const marqueeDiv = getHTMLChild<HTMLDivElement>(div, 'div');
    for (const element of marqueeDiv.querySelectorAll(`.${uniqueClassname}`)) {
        const resizeObserver = new ResizeObserver(() => {
            if ((element as any).offsetWidth < (element as any).scrollWidth) {
                element.classList.add('moving');
            } else {
                element.classList.remove('moving');
            }
            resizeObserver.disconnect();
        });
        resizeObserver.observe(element);
    }
    return {
        element: marqueeDiv,
        handleRemoving: () => {
            return new Promise<void>((resolve) => {
                for (const element of marqueeDiv.querySelectorAll(
                    `.${uniqueClassname}`,
                )) {
                    (element as any).classList.add('out');
                }
                // Only the way out has to finish before the node is dropped;
                // tying this to `duration` would keep a hidden marquee around
                // for minutes at the slowest scroll speeds.
                setTimeout(resolve, transitionCss.millisecond);
            });
        },
    };
}

export function genHtmlForegroundQuickText(
    {
        htmlText,
        timeSecondDelay,
        timeSecondToLive,
        extraStyle = {},
    }: ForegroundQuickTextDataType,
    animData: StyleAnimType,
    remove: () => void,
) {
    const uniqueId = `id-${crypto.randomUUID()}`;
    const htmlString = renderToStaticMarkup(
        <div style={extraStyle}>
            <style>{`
            #${uniqueId} * {
                margin: 0.25em !important;
            }
            `}</style>
            <div
                id={uniqueId}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlText) }}
            />
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');

    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, timeSecondDelay * 1000);
            });
            await animData.animIn(element, parentContainer);
            await new Promise<void>((resolve) => {
                setTimeout(resolve, timeSecondToLive * 1000);
            });
            remove();
        },
        handleRemoving: async () => {
            await animData.animOut(element);
        },
    };
}

// How long one message takes to fade across to the next. A TRANSITION, not an
// animation: it runs only when the opacity is actually changed, so between
// swaps this element costs nothing at all.
const MESSAGE_FADE_MILLISECOND = 400;

/**
 * Words held over whatever else is live: one message that stays put, or
 * several that rotate. Nothing but a person takes them down.
 *
 * The text goes in as a React CHILD, never through `dangerouslySetInnerHTML`:
 * the renderer escapes the user's words without parsing markup. That is also
 * why this takes plain text rather than Quick Text's markdown.
 *
 * NO timer is started unless there is something to rotate TO -- a rotation
 * that fires forever to rewrite the same string is the paint-at-rest mistake
 * (EN-09) wearing a different hat, and this widget is mounted for a whole
 * pre-service slot.
 */
export function genHtmlForegroundMessage(
    { textList, intervalSecond, extraStyle = {} }: ForegroundMessageDataType,
    animData: StyleAnimType,
) {
    const validTextList = textList.filter((text) => {
        return text.trim() !== '';
    });
    const isRotating = intervalSecond !== null && validTextList.length > 1;
    const htmlString = renderToStaticMarkup(
        <div
            style={{
                whiteSpace: 'pre-wrap',
                ...(isRotating
                    ? {
                          transition: `opacity ${MESSAGE_FADE_MILLISECOND}ms ease-in-out`,
                      }
                    : {}),
                ...extraStyle,
            }}
        >
            {/*
             * Rotating, the list is one MESSAGE per entry and only one shows
             * at a time. Not rotating, it is one message's own LINES and all
             * of them show -- joined from the raw list, so a blank line the
             * writer put inside a message survives (the filtered list drops
             * blanks, which is right for entries and wrong for lines).
             */}
            {isRotating ? (validTextList[0] ?? '') : textList.join('\n')}
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const clearTimers = () => {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (fadeTimeoutId !== null) {
            clearTimeout(fadeTimeoutId);
            fadeTimeoutId = null;
        }
    };
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await animData.animIn(element, parentContainer);
            if (!isRotating) {
                return;
            }
            let index = 0;
            intervalId = setInterval(
                () => {
                    element.style.opacity = '0';
                    fadeTimeoutId = setTimeout(() => {
                        index = (index + 1) % validTextList.length;
                        element.textContent = validTextList[index];
                        element.style.opacity = '1';
                    }, MESSAGE_FADE_MILLISECOND);
                },
                Math.max(1, intervalSecond as number) * 1000,
            );
        },
        handleRemoving: async () => {
            clearTimers();
            await animData.animOut(element);
        },
    };
}

export function genHtmlForegroundCountdown(
    data: ForegroundCountdownDataType,
    animData: StyleAnimType,
) {
    const { extraStyle } = data;
    // The "time is up" flash runs five times and then RESTS red (`forwards`),
    // never `infinite`: a finished countdown can stay up for the rest of the
    // service, and a looping colour animation repaints it every frame for as
    // long as it does (memory `infinite-paint-animation-at-rest`). Resting red,
    // it counts the time OVER behind a `+` (`CountdownController`). The sign is
    // a SPAN so the digit rule's `min-width` leaves no gap while it is empty.
    // `nowrap` keeps the digits on one line in any font the widget is given.
    const uniqueClassname = `cn-${crypto.randomUUID()}`;
    const htmlString = renderToStaticMarkup(
        <div
            className="foreground-countdown-container"
            style={{
                color: 'white',
                backgroundColor: 'rgba(0, 12, 100, 0.7)',
                backdropFilter: 'blur(5px)',
                ...extraStyle,
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    display: flex;
                    justify-content: center;
                    white-space: nowrap;
                }
                .${uniqueClassname} div {
                    text-align: center;
                    min-width: 2ch;
                    font-variant-numeric: tabular-nums;
                }
                .${uniqueClassname} #second {
                    text-align: left;
                }
                .${uniqueClassname}[data-time-diff="0"] {
                    animation: anim-${uniqueClassname}-alerting 2s ease-in 5
                        forwards;
                }
                @keyframes anim-${uniqueClassname}-alerting {
                    0% { color: red; }
                    75% { color: white; }
                    100% { color: red; }
                }
            `}</style>
            <div className={uniqueClassname}>
                <span style={{ marginRight: '25px' }}>⏳</span>
                <span id="sign" />
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const countDownHandler = CountdownController.init(element, data);
    let currentData = data;
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            countDownHandler.start();
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            countDownHandler.dispose();
            await animData.animOut(element);
        },
        // A start, pause, resume or reset moves only the timing, and is
        // applied to the clock already up -- no fade out and back in.
        handleUpdating: (newData: ForegroundCountdownDataType) => {
            if (!checkIsSameTimerExceptTiming(currentData, newData)) {
                return false;
            }
            currentData = newData;
            countDownHandler.update(newData);
            return true;
        },
    };
}

export function genHtmlForegroundStopwatch(
    data: ForegroundStopwatchDataType,
    animData: StyleAnimType,
) {
    const { extraStyle } = data;
    const uniqueClassname = `cn-${crypto.randomUUID()}`;
    const htmlString = renderToStaticMarkup(
        <div
            className="foreground-stopwatch-container"
            style={{
                color: 'white',
                backgroundColor: 'rgba(0, 12, 100, 0.7)',
                backdropFilter: 'blur(5px)',
                ...extraStyle,
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    display: flex;
                    justify-content: center;
                    white-space: nowrap;
                }
                .${uniqueClassname} div {
                    text-align: center;
                    min-width: 2ch;
                    font-variant-numeric: tabular-nums;
                }
                .${uniqueClassname} #second {
                    text-align: left;
                }
            `}</style>
            <div className={uniqueClassname}>
                <span style={{ marginRight: '25px' }}>⏱️</span>
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const stopwatchHandler = StopwatchController.init(element, data);
    let currentData = data;
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            stopwatchHandler.start();
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            stopwatchHandler.dispose();
            await animData.animOut(element);
        },
        // See the countdown's: a start, pause, resume or reset is applied to
        // the stopwatch already up.
        handleUpdating: (newData: ForegroundStopwatchDataType) => {
            if (!checkIsSameTimerExceptTiming(currentData, newData)) {
                return false;
            }
            currentData = newData;
            stopwatchHandler.update(newData);
            return true;
        },
    };
}

export function genHtmlForegroundTime(
    timeData: ForegroundTimeDataType,
    animData: StyleAnimType,
) {
    const { timezoneMinuteOffset, title } = timeData;
    const is24HourFormat = timeData.is24HourFormat ?? false;
    const uniqueClassname = `cn-${crypto.randomUUID()}`;
    const htmlString = renderToStaticMarkup(
        <div
            className="foreground-time-container"
            style={{
                color: 'white',
                backgroundColor: 'rgba(0, 12, 100, 0.7)',
                backdropFilter: 'blur(5px)',
                ...timeData.extraStyle,
            }}
        >
            {' '}
            <style>{`
                .${uniqueClassname} {
                    display: flex;
                    justify-content: center;
                    white-space: nowrap;
                }
                .${uniqueClassname} div {
                    text-align: center;
                    min-width: 2ch;
                    font-variant-numeric: tabular-nums;
                }
                .${uniqueClassname} #second {
                    text-align: left;
                }
            `}</style>
            <div
                style={{
                    textAlign: 'center',
                    padding: '2px',
                    overflow: 'hidden',
                }}
            >
                <small>{title}</small>
            </div>
            <div className={uniqueClassname}>
                <span style={{ marginRight: '25px' }}>🕗</span>
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
                {is24HourFormat ? null : (
                    <div id="ampm" style={{ marginLeft: '8px' }}>
                        AM
                    </div>
                )}
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const timingHandler = TimingController.init(
        element,
        timezoneMinuteOffset,
        is24HourFormat,
    );
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            timingHandler.start();
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            timingHandler.pause();
            await animData.animOut(element);
        },
    };
}

/**
 * A page shown OVER the slide, and the same rule a web BACKGROUND follows:
 * LIVE only on the projected screen, a still screenshot everywhere else. The
 * presenter's mini screen is a preview -- it redraws whenever a screen event
 * fires and one is mounted per screen -- so a live iframe there keeps that
 * page's scripts, timers and media running in the operator's window for as
 * long as the overlay is up, for a picture two inches across. The shot is
 * taken at the screen's own bounds, which is the entry the Webs panel and the
 * web background have already populated.
 */
export function genHtmlForegroundWeb(
    webData: ForegroundWebDataType,
    animData: StyleAnimType,
    displayDim: { width: number; height: number },
    isPageScreen = appProvider.isPageScreen,
) {
    const { filePath, extraStyle = {}, widthScale, heightScale } = webData;
    const width = Math.round(displayDim.width * widthScale);
    const height = Math.round(displayDim.height * heightScale);
    const fileSource = FileSource.getInstance(filePath);
    // extraStyle carries the widget positioning (alignment + X/Y offset via
    // left/top/transform), sizing and box styling. It must live on the element
    // that is actually mounted. The iframe already uses its own `transform` to
    // scale the page, so it can't also carry the positioning transform — wrap
    // it in a sized, clipped container that gets extraStyle instead. Mounting
    // the bare iframe (as before) dropped extraStyle entirely, pinning every
    // web overlay to the top-left corner.
    const container = document.createElement('div');
    if (isPageScreen) {
        container.innerHTML = renderToStaticMarkup(
            <RenderBackgroundWebIframeComp
                iframeSource={fileSource}
                width={width}
                height={height}
                targetWidth={displayDim.width}
                targetHeight={displayDim.height}
            />,
        );
    } else {
        // The box below is `displayDim` scaled by `widthScale`, so a shot at
        // the display's own bounds has exactly the box's aspect ratio and
        // `cover` crops nothing -- the same picture the live iframe draws.
        container.appendChild(
            genWebScreenShotElement(fileSource.src, () => {
                return {
                    width: displayDim.width,
                    height: displayDim.height,
                };
            }),
        );
    }
    Object.assign(container.style, extraStyle, {
        width: `${width}px`,
        height: `${Math.round(displayDim.height * widthScale)}px`,
        overflow: 'hidden',
    });
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await animData.animIn(container, parentContainer);
        },
        handleRemoving: async () => {
            await animData.animOut(container);
        },
    };
}

/**
 * A clip shown OVER the slide. Built by hand rather than through
 * `renderToStaticMarkup` like its neighbours, because `muted` is a
 * PROPERTY-only attribute that React does not write into static markup -- an
 * SSR'd `<video muted>` arrives unmuted and Chromium refuses to autoplay it,
 * which looks exactly like a broken file. `getCameraAndShowMedia` builds its
 * own element for the same reason.
 *
 * Looping like a background video, and muted unless this session's Sound
 * control says otherwise: an overlay is usually decoration running under
 * whatever the service is doing, and an unmuted one would fight the song --
 * but a clip that IS the moment needs to be heard.
 * There is deliberately no cross-window current-time sync (the background
 * layer's `sendSyncVideoTime`): that costs a broadcast per seek to keep a
 * decorative loop in step between the mini preview and the output window.
 */
export function genHtmlForegroundVideo(
    {
        filePath,
        extraStyle = {},
        isSoundOn = false,
        soundVolume = 100,
    }: ForegroundVideoDataType,
    animData: StyleAnimType,
    isSilenced = false,
) {
    const fileSource = FileSource.getInstance(filePath);
    const element = document.createElement('video');
    element.src = fileSource.src;
    // Muted unless the session asked to be heard. It stays a PROPERTY rather
    // than an attribute for the reason in the note above, and the volume is
    // set whether or not the sound is on so that unmuting mid-clip lands at
    // the level the operator chose rather than at full.
    element.muted = !isSoundOn || isSilenced;
    element.volume = Math.min(1, Math.max(0, soundVolume / 100));
    element.loop = true;
    element.autoplay = true;
    element.playsInline = true;
    Object.assign(element.style, { display: 'block' }, extraStyle);
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await animData.animIn(element, parentContainer);
            playMediaElement(element);
        },
        handleRemoving: async () => {
            await animData.animOut(element);
            // Taking it out of the document does NOT free the player, and
            // Chromium refuses to make any more once a frame holds a thousand.
            releaseMediaElement(element);
        },
    };
}

/** A picture shown OVER the slide -- the still twin of the clip above. */
export function genHtmlForegroundImage(
    { filePath, extraStyle = {} }: ForegroundImageDataType,
    animData: StyleAnimType,
) {
    const fileSource = FileSource.getInstance(filePath);
    const element = document.createElement('img');
    element.src = fileSource.src;
    element.alt = fileSource.name;
    Object.assign(element.style, { display: 'block' }, extraStyle);
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            await animData.animOut(element);
        },
    };
}
