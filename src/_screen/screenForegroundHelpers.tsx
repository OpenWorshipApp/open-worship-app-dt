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
import {
    DEFAULT_MARQUEE_SPEED_PERCENTAGE,
    MAX_MARQUEE_SPEED_PERCENTAGE,
    MIN_MARQUEE_SPEED_PERCENTAGE,
} from './screenTypeHelpers';
import TimingController from './managers/TimingController';
import StopwatchController from './managers/StopwatchController';
import FileSource from '../helper/FileSource';
import RenderBackgroundWebIframeComp from '../background/RenderBackgroundWebIframeComp';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { playMediaElement, releaseMediaElement } from '../helper/mediaHelpers';

const MARQUEE_SLIDE_MILLISECOND = 500;

export function genHtmlForegroundMarquee(
    {
        text,
        speedPercentage = DEFAULT_MARQUEE_SPEED_PERCENTAGE,
        extraStyle = {},
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
    const scale = screenManagerBase.height / 768;
    const fontSize = Math.round(75 * scale);
    const uniqueClassname = `cn-${crypto.randomUUID()}`;
    // Keyframes are scoped per instance so a top and a bottom marquee showing
    // at the same time cannot overwrite each other's slide-in direction.
    const movingKeyframe = `anim-${uniqueClassname}-moving`;
    const inKeyframe = `anim-${uniqueClassname}-in`;
    const outKeyframe = `anim-${uniqueClassname}-out`;
    const hiddenTranslateY = position === 'top' ? '-100%' : '100%';
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
                    transform: translateY(${hiddenTranslateY});
                    animation: ${inKeyframe} ${MARQUEE_SLIDE_MILLISECOND}ms ease-in forwards;
                    white-space: nowrap;
                }
                .${uniqueClassname}.out {
                    animation: ${outKeyframe} ${MARQUEE_SLIDE_MILLISECOND}ms ease-out forwards;
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
                    0% { transform: translateY(${hiddenTranslateY}); }
                    100% { transform: translateY(0); }
                }
                @keyframes ${outKeyframe} {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(${hiddenTranslateY}); }
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
                // Only the slide-out has to finish before the node is dropped;
                // tying this to `duration` would keep a hidden marquee around
                // for minutes at the slowest scroll speeds.
                setTimeout(resolve, MARQUEE_SLIDE_MILLISECOND);
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
 * `sanitizeHtml` is still a no-op placeholder and every renderer here has node
 * integration, so the one safe way to put a user's words on a screen is to let
 * the renderer escape them. That is also why this takes plain text rather than
 * Quick Text's markdown.
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
    { dateTime, extraStyle }: ForegroundCountdownDataType,
    animData: StyleAnimType,
) {
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
                    animation: anim-${uniqueClassname}-alerting 2s ease-in infinite;
                }
                @keyframes anim-${uniqueClassname}-alerting {
                    0% { color: red; }
                    75% { color: white; }
                    100% { color: red; }
                }
            `}</style>
            <div className={uniqueClassname}>
                <span style={{ marginRight: '25px' }}>⏳</span>
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const countDownHandler = CountdownController.init(element, dateTime);
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            countDownHandler.start();
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            countDownHandler.pause();
            await animData.animOut(element);
        },
    };
}

export function genHtmlForegroundStopwatch(
    { dateTime, extraStyle }: ForegroundStopwatchDataType,
    animData: StyleAnimType,
) {
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
    const stopwatchHandler = StopwatchController.init(element, dateTime);
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            stopwatchHandler.start();
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            stopwatchHandler.pause();
            await animData.animOut(element);
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

export function genHtmlForegroundWeb(
    webData: ForegroundWebDataType,
    animData: StyleAnimType,
    displayDim: { width: number; height: number },
) {
    const { filePath, extraStyle = {}, widthScale, heightScale } = webData;
    const width = Math.round(displayDim.width * widthScale);
    const height = Math.round(displayDim.height * heightScale);
    const fileSource = FileSource.getInstance(filePath);
    const htmlString = renderToStaticMarkup(
        <RenderBackgroundWebIframeComp
            iframeSource={fileSource}
            width={width}
            height={height}
            targetWidth={displayDim.width}
            targetHeight={displayDim.height}
        />,
    );
    // extraStyle carries the widget positioning (alignment + X/Y offset via
    // left/top/transform), sizing and box styling. It must live on the element
    // that is actually mounted. The iframe already uses its own `transform` to
    // scale the page, so it can't also carry the positioning transform — wrap
    // it in a sized, clipped container that gets extraStyle instead. Mounting
    // the bare iframe (as before) dropped extraStyle entirely, pinning every
    // web overlay to the top-left corner.
    const container = document.createElement('div');
    container.innerHTML = htmlString;
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
) {
    const fileSource = FileSource.getInstance(filePath);
    const element = document.createElement('video');
    element.src = fileSource.src;
    // Muted unless the session asked to be heard. It stays a PROPERTY rather
    // than an attribute for the reason in the note above, and the volume is
    // set whether or not the sound is on so that unmuting mid-clip lands at
    // the level the operator chose rather than at full.
    element.muted = !isSoundOn;
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
