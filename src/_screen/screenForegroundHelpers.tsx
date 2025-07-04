import ReactDOMServer from 'react-dom/server';
import CountdownController from './managers/CountdownController';
import { getHTMLChild } from '../helper/helpers';
import ScreenManagerBase from './managers/ScreenManagerBase';
import { handleError } from '../helper/errorHelpers';
import { styleAnimList } from './transitionEffectHelpers';
import {
    ForegroundCameraDataType,
    ForegroundCountdownDataType,
    ForegroundMarqueDataType,
    ForegroundTimeDataType,
} from './screenTypeHelpers';
import TimingController from './managers/TimingController';

export function genHtmlForegroundMarquee(
    marqueeData: ForegroundMarqueDataType,
    screenManagerBase: ScreenManagerBase,
) {
    const { text } = marqueeData;
    const duration = text.length / 6;
    const scale = screenManagerBase.height / 768;
    const fontSize = 75 * scale;
    const uniqueClassname = `m-${crypto.randomUUID()}`;
    const htmlString = ReactDOMServer.renderToStaticMarkup(
        <div
            style={{
                position: 'absolute',
                width: '100%',
                left: '0px',
                bottom: '0px',
                ...(marqueeData.extraStyle ?? {}),
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    width: 100%;
                    padding: 3px 0px;
                    margin: 0 auto;
                    overflow: hidden;
                    color: white;
                    background-color: rgba(0, 12, 100, 0.5);
                    backdrop-filter: blur(5px);
                    font-size: ${fontSize}px;
                    box-shadow: inset 0 0 10px lightblue;
                    will-change: transform;
                    transform: translateY(100%);
                    animation: from-bottom 500ms ease-in forwards;
                }
                .${uniqueClassname}.out {
                    animation: to-bottom 500ms ease-out forwards;
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
                    animation-name: moving;
                }
                .${uniqueClassname}.out span {
                    animation-play-state: paused;
                }
                @keyframes moving {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes from-bottom {
                    0% { transform: translateY(100%); }
                    100% { transform: translateY(0); }
                }
                @keyframes to-bottom {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
            <p className={uniqueClassname}>
                <span>{text}</span>
            </p>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const marqueeDiv = getHTMLChild<HTMLDivElement>(div, 'div');
    marqueeDiv
        .querySelectorAll(`.${uniqueClassname}`)
        .forEach((element: any) => {
            const resizeObserver = new ResizeObserver(() => {
                if (element.offsetWidth < element.scrollWidth) {
                    element.classList.add('moving');
                } else {
                    element.classList.remove('moving');
                }
                resizeObserver.disconnect();
            });
            resizeObserver.observe(element);
        });
    return {
        element: marqueeDiv,
        handleRemoving: () => {
            return new Promise<void>((resolve) => {
                marqueeDiv
                    .querySelectorAll(`.${uniqueClassname}`)
                    .forEach((element: any) => {
                        element.classList.add('out');
                    });
                setTimeout(resolve, duration * 1000 + 500);
            });
        },
    };
}

export function genHtmlForegroundCountdown(
    countdownData: ForegroundCountdownDataType,
) {
    const { dateTime } = countdownData;
    const uniqueClassname = `m-${crypto.randomUUID()}`;
    const htmlString = ReactDOMServer.renderToStaticMarkup(
        <div
            style={{
                color: 'white',
                backgroundColor: 'rgba(0, 12, 100, 0.7)',
                backdropFilter: 'blur(5px)',
                ...(countdownData.extraStyle ?? {}),
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    display: flex;
                    justify-content: center;
                }
                .${uniqueClassname} div {
                    text-align: center;
                }
                .${uniqueClassname} #second {
                    text-align: left;
                }
            `}</style>
            <div className={`countdown ${uniqueClassname}`}>
                <span style={{ marginRight: '50px' }}>⏳</span>
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const countDownHandler = CountdownController.init(element, dateTime);
    const animData = styleAnimList.fade('countdown');
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            countDownHandler.start();
            const style = document.createElement('style');
            style.innerHTML = animData.style;
            parentContainer.appendChild(style);
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            countDownHandler.pause();
            await animData.animOut(element);
        },
    };
}

export function genHtmlForegroundTime(timeData: ForegroundTimeDataType) {
    const { timezoneMinuteOffset, title } = timeData;
    const uniqueClassname = `m-${crypto.randomUUID()}`;
    const htmlString = ReactDOMServer.renderToStaticMarkup(
        <div
            style={{
                color: 'white',
                backgroundColor: 'rgba(0, 12, 100, 0.7)',
                backdropFilter: 'blur(5px)',
                ...(timeData.extraStyle ?? {}),
            }}
        >
            <style>{`
                .${uniqueClassname} {
                    display: flex;
                    justify-content: center;
                }
                .${uniqueClassname} div {
                    text-align: center;
                }
                .${uniqueClassname} #second {
                    text-align: left;
                }
            `}</style>
            <div className={`countdown ${uniqueClassname}`}>
                <span style={{ marginRight: '50px' }}>🕗</span>
                <div id="hour">00</div>:<div id="minute">00</div>:
                <div id="second">00</div>
            </div>
            <div
                style={{
                    textAlign: 'center',
                    padding: '2px',
                    overflow: 'hidden',
                }}
            >
                <small>{title}</small>
            </div>
        </div>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    const element = getHTMLChild<HTMLDivElement>(div, 'div');
    const timingHandler = TimingController.init(element, timezoneMinuteOffset);
    const animData = styleAnimList.fade('countdown');
    return {
        handleAdding: async (parentContainer: HTMLElement) => {
            timingHandler.start();
            const style = document.createElement('style');
            style.innerHTML = animData.style;
            parentContainer.appendChild(style);
            await animData.animIn(element, parentContainer);
        },
        handleRemoving: async () => {
            timingHandler.pause();
            await animData.animOut(element);
        },
    };
}

export async function getAndShowMedia({
    id,
    extraStyle,
    width,
    container,
}: ForegroundCameraDataType & {
    container: HTMLElement;
    width?: number;
}) {
    const constraints = {
        audio: false,
        video: { width },
        id,
    };
    try {
        const mediaStream =
            await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.onloadedmetadata = () => {
            video.play();
        };
        if (width !== undefined) {
            video.style.width = `${width}px`;
        }
        Object.assign(video.style, extraStyle ?? {});
        container.innerHTML = '';
        container.appendChild(video);
        return () => {
            const tracks = mediaStream.getVideoTracks();
            tracks.forEach((track) => {
                track.stop();
            });
        };
    } catch (error) {
        handleError(error);
    }
}
