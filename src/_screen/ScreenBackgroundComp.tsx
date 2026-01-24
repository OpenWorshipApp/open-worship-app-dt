import { useRef } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import ScreenBackgroundColorComp from './ScreenBackgroundColorComp';
import ScreenBackgroundImageComp from './ScreenBackgroundImageComp';
import ScreenBackgroundVideoComp from './ScreenBackgroundVideoComp';
import type { AppColorType } from '../others/color/colorHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { getScreenManagerBase } from './managers/screenManagerBaseHelpers';
import {
    useScreenManagerContext,
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';
import type { BackgroundSrcType } from './screenTypeHelpers';
import { getCameraStream } from '../helper/cameraHelpers';
import { handleError } from '../helper/errorHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { tran } from '../lang/langHelpers';

export default function ScreenBackgroundComp() {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenBackgroundManager.render();
    });
    const div = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (div.current) {
            screenBackgroundManager.rootContainer = div.current;
        }
    }, [div.current]);
    return (
        <div
            id="background"
            ref={div}
            style={screenBackgroundManager.containerStyle}
        />
    );
}

export function genHtmlBackground(
    screenId: number,
    backgroundSrc: BackgroundSrcType,
) {
    let promise: Promise<() => void> = Promise.resolve(() => {});
    let child: HTMLDivElement = document.createElement('div');
    if (backgroundSrc.type === 'camera') {
        const video = document.createElement('video');
        Object.assign(video.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
        });
        child.appendChild(video);
        promise = new Promise<() => void>((resolve) => {
            getCameraStream(backgroundSrc.src)
                .then((mediaStream) => {
                    video.srcObject = mediaStream;
                    const clearTracks = () => {
                        const tracks = mediaStream.getTracks();
                        for (const track of tracks) {
                            track.stop();
                        }
                    };
                    video.onloadedmetadata = () => {
                        video.play();
                        resolve(clearTracks);
                    };
                })
                .catch((error) => {
                    handleError(error);
                    showAppAlert(
                        tran('Camera Error'),
                        tran(
                            'Unable to access the camera for background. ' +
                                'Please check your camera settings.',
                        ),
                    );
                });
        });
    } else if (backgroundSrc.type === 'web') {
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: 'transparent',
        });
        iframe.src = backgroundSrc.src;
        child = iframe;
    } else {
        const div = document.createElement('div');
        const screenManagerBase = getScreenManagerBase(screenId);
        const htmlStr = renderToStaticMarkup(
            <ScreenManagerBaseContext value={screenManagerBase}>
                <RenderBackground backgroundSrc={backgroundSrc} />
            </ScreenManagerBaseContext>,
        );
        div.innerHTML = htmlStr;
        const childDive = div.querySelector('div');
        if (childDive === null) {
            throw new Error('child is null');
        }
        child = childDive;
    }
    Object.assign(child.style, backgroundSrc.extraStyle ?? {});
    return { newDiv: child, promise };
}

export function RenderBackground({
    backgroundSrc,
}: Readonly<{
    backgroundSrc: BackgroundSrcType;
}>) {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    return (
        <div
            style={{
                ...screenBackgroundManager.containerStyle,
            }}
        >
            <RenderScreenBackground backgroundSrc={backgroundSrc} />
        </div>
    );
}

function RenderScreenBackground({
    backgroundSrc,
}: Readonly<{
    backgroundSrc: BackgroundSrcType;
}>) {
    if (backgroundSrc === null) {
        return null;
    }
    switch (backgroundSrc.type) {
        case 'image':
            return <ScreenBackgroundImageComp backgroundSrc={backgroundSrc} />;
        case 'video':
            return <ScreenBackgroundVideoComp backgroundSrc={backgroundSrc} />;
        case 'color':
            return (
                <ScreenBackgroundColorComp
                    color={backgroundSrc.src as AppColorType}
                />
            );
        case 'camera':
            return null;
        default:
            return null;
    }
}
