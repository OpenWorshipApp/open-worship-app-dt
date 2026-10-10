import { useRef } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import ScreenBackgroundColorComp from './ScreenBackgroundColorComp';
import ScreenBackgroundImageComp from './ScreenBackgroundImageComp';
import ScreenBackgroundVideoComp from './ScreenBackgroundVideoComp';
import type { AppColorType } from '../others/color/colorHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getScreenManagerBase } from './managers/screenManagerBaseHelpers';
import {
    useScreenManagerContext,
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';
import type { BackgroundSrcType } from './screenTypeHelpers';
import {
    createCameraCanvasView,
    getCameraStream,
    stopCameraStream,
} from '../helper/cameraHelpers';
import { handleError } from '../helper/errorHelpers';
import { playMediaElement } from '../helper/mediaHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { genWebBackgroundElement } from './managers/screenWebsiteHelpers';
import {
    checkIsViewerCameraId,
    listenViewerCameraLive,
} from '../virtual-display/viewerCameraTransport';

export function genHtmlBackground(
    screenId: number,
    backgroundSrc: BackgroundSrcType,
) {
    let promise: Promise<() => void> = Promise.resolve(() => {});
    let child: HTMLDivElement = document.createElement('div');
    if (backgroundSrc.type === 'camera') {
        const video = document.createElement('video');
        // No sound in a camera; unmuted, a browser will not start it untapped.
        video.muted = true;
        video.playsInline = true;
        Object.assign(video.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
        });
        child.appendChild(video);
        promise = new Promise<() => void>((resolve) => {
            getCameraStream(backgroundSrc.src)
                .then((mediaStream) => {
                    // In Safari and Firefox a camera shows in a canvas in
                    // the video's place: an iPad never paints the video.
                    const view = createCameraCanvasView(mediaStream);
                    if (view === null) {
                        video.srcObject = mediaStream;
                    } else {
                        view.element.style.cssText = video.style.cssText;
                        video.replaceWith(view.element);
                    }
                    const shown = view?.element ?? video;
                    // A browser viewer's camera is hidden while it sends no
                    // pictures, and shows again when it does.
                    const stopListeningLive = listenViewerCameraLive(
                        mediaStream,
                        (isLive) => {
                            shown.style.visibility = isLive ? '' : 'hidden';
                        },
                    );
                    const clearTracks = () => {
                        stopListeningLive();
                        view?.release();
                        stopCameraStream(mediaStream);
                    };
                    video.onloadedmetadata = () => {
                        playMediaElement(video);
                        resolve(clearTracks);
                    };
                    // One not shared yet has no picture to wait for, and a
                    // canvas no metadata: put up now, it can still be let go
                    // of.
                    if (
                        view !== null ||
                        checkIsViewerCameraId(backgroundSrc.src)
                    ) {
                        resolve(clearTracks);
                    }
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
        // Live on the projected screen, a screenshot on the presenter's mini
        // screen — a background covers the whole output, so it is the most
        // expensive live page in the app to load into a preview nobody
        // presents from.
        child = genWebBackgroundElement(
            backgroundSrc.src,
            appProvider.isPageScreen,
        ) as HTMLDivElement;
    } else {
        const div = document.createElement('div');
        const screenManagerBase = getScreenManagerBase(screenId);
        const htmlStr = renderToStaticMarkup(
            <ScreenManagerBaseContext value={screenManagerBase}>
                <RenderBackgroundComp backgroundSrc={backgroundSrc} />
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

export function RenderBackgroundComp({
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

export default function ScreenBackgroundComp() {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    const screenBackgroundManagerRef = useAppCurrentRef(
        screenBackgroundManager,
    );
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenBackgroundManagerRef.current.render();
    });
    const div = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        const rootContainer = div.current;
        if (rootContainer === null) {
            return;
        }
        screenBackgroundManager.rootContainer = rootContainer;
        return () => {
            screenBackgroundManager.releaseRootContainer(rootContainer);
        };
    }, [screenBackgroundManager, div.current]);
    return (
        <div
            id="background"
            ref={div}
            style={screenBackgroundManager.containerStyle}
        />
    );
}
