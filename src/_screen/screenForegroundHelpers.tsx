import { renderToStaticMarkup } from 'react-dom/server';
import CountdownController from './managers/CountdownController';
import { getHTMLChild } from '../helper/helpers';
import type ScreenManagerBase from './managers/ScreenManagerBase';
import type {
    ForegroundCountdownDataType,
    ForegroundMarqueeDataType,
    ForegroundQuickTextDataType,
    ForegroundStopwatchDataType,
    ForegroundTimeDataType,
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
                margin: 0.05em !important;
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
    const div = document.createElement('div');
    Object.assign(div.style, extraStyle);
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLIFrameElement>(div, 'iframe');
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            await animData.animOut(element);
        },
    };
}
