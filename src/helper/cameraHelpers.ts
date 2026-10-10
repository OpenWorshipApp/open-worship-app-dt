import { useState } from 'react';

import { useAppEffectAsync } from './appHooks';
import { handleError } from './errorHelpers';
import { playMediaElement } from './mediaHelpers';
import type {
    ForegroundCameraDataType,
    StyleAnimType,
} from '../_screen/screenTypeHelpers';
import { electronSendAsync } from '../server/appHelpers';
import appProvider from '../server/appProvider';
import {
    getMirrorCameraStream,
    releaseMirrorCameraStream,
} from '../screen-mirror/mirrorCameraTransport';
import {
    checkIsViewerCameraId,
    createViewerCameraView,
    getViewerCameraStream,
    listenViewerCameraLive,
    releaseViewerCameraStream,
} from '../virtual-display/viewerCameraTransport';

export type CameraInfoType = {
    deviceId: string;
    groupId: string;
    label: string;
};

const { mediaDevices } = navigator;
function getRemoteCameras(): CameraInfoType[] {
    const cameras = appProvider.messageUtils?.sendDataSync?.('mirror:cameras');
    return Array.isArray(cameras) ? cameras : [];
}

export async function requestCameraAccess() {
    const canAccess = await electronSendAsync<boolean>(
        'main:app:ask-camera-access',
    );
    return canAccess;
}

export async function getAllCameraDevices(): Promise<CameraInfoType[]> {
    const canAccess = await requestCameraAccess();
    if (!canAccess) {
        return getRemoteCameras();
    }
    const devices = await mediaDevices.enumerateDevices();
    const cameraList: CameraInfoType[] = [];
    for (const device of devices) {
        if (device.kind === 'videoinput') {
            cameraList.push(device);
        }
    }
    appProvider.messageUtils?.sendData?.(
        'mirror:physical-cameras',
        cameraList.map(({ deviceId, label, groupId }) => ({
            deviceId,
            label,
            groupId,
        })),
    );
    return [...cameraList, ...getRemoteCameras()];
}

export function useCameraInfoList() {
    const [cameraInfoList, setCameraInfoList] = useState<CameraInfoType[]>([]);
    useAppEffectAsync(
        async (contextMethods) => {
            const cameraList = await getAllCameraDevices();
            contextMethods.setCameraInfoList(cameraList);
        },
        [],
        { setCameraInfoList },
    );
    useAppEffectAsync(async () => {
        const refresh = () => {
            void getAllCameraDevices().then(setCameraInfoList, handleError);
        };
        appProvider.messageUtils?.listenForData?.(
            'mirror:devices-changed',
            refresh,
        );
        navigator.mediaDevices?.addEventListener('devicechange', refresh);
        return () => {
            appProvider.messageUtils?.removeListener?.(
                'mirror:devices-changed',
                refresh,
            );
            navigator.mediaDevices?.removeEventListener(
                'devicechange',
                refresh,
            );
        };
    }, []);
    return cameraInfoList;
}

export async function getCameraStream(cameraId: string) {
    // A browser viewer's camera, shared with this computer.
    if (checkIsViewerCameraId(cameraId)) {
        return await getViewerCameraStream(cameraId);
    }
    if (cameraId.startsWith('mirror-camera:')) {
        const camera = getRemoteCameras().find(
            (item) => item.deviceId === cameraId,
        );
        const state = appProvider.messageUtils?.sendDataSync?.('mirror:state');
        if (state?.id && cameraId.startsWith(`mirror-camera:${state.id}:`)) {
            const devices = await mediaDevices.enumerateDevices();
            const device = devices.find(
                (item) =>
                    item.kind === 'videoinput' &&
                    (item.deviceId ===
                        cameraId.slice(`mirror-camera:${state.id}:`.length) ||
                        item.label === camera?.label?.replace(/^a\d+: /, '')),
            );
            if (!device) throw new Error('Camera is unavailable');
            cameraId = device.deviceId;
        } else
            return await getMirrorCameraStream(
                cameraId,
                camera?.label.replace(/^a\d+: /, '') ?? '',
            );
    }
    const canAccess = await requestCameraAccess();
    if (!canAccess) {
        throw new Error('Camera access denied');
    }
    const mediaStream = await mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: cameraId } },
    });
    return mediaStream;
}

/**
 * Chromium rotates `deviceId` per origin and per session, so a document that
 * stored one yesterday holds an id that no longer exists. Try the id first
 * (exact and cheap), then fall back to matching the label the item was created
 * with. `null` means the camera is not on this machine right now.
 */
export async function resolveCameraDeviceId(deviceId: string, label: string) {
    const cameraList = await getAllCameraDevices();
    if (
        deviceId !== '' &&
        cameraList.some((camera) => {
            return camera.deviceId === deviceId;
        })
    ) {
        return deviceId;
    }
    if (label === '') {
        return null;
    }
    return (
        cameraList.find((camera) => {
            return camera.label === label;
        })?.deviceId ?? null
    );
}

// How long a device is held open after its last user lets go. A re-render that
// re-acquires the same camera within the window reuses the open stream instead
// of paying another `getUserMedia` handshake (and flashing black).
const CAMERA_RELEASE_GRACE_MS = 1500;

type CameraStreamSlotType = {
    promise: Promise<MediaStream>;
    count: number;
    stopTimeoutId: ReturnType<typeof setTimeout> | null;
};

/**
 * ONE stream per physical device per window, ref-counted.
 *
 * The presenter renders a mini screen per open screen, each with its own
 * manager and its own hydration pass, and re-renders on every `refresh` event
 * (resize, effect change, ...). Without this a single camera box opens N
 * streams and re-handshakes the device on every resize. A `MediaStream` can
 * back many `<video>` elements, so one is enough.
 *
 * This is not a growing cache: an entry exists only while something on a screen
 * is using that device, and drops itself a grace period after the last release.
 */
const cameraStreamMap = new Map<string, CameraStreamSlotType>();

export function acquireCameraStream(cameraId: string) {
    let slot = cameraStreamMap.get(cameraId);
    if (slot === undefined) {
        slot = {
            promise: getCameraStream(cameraId),
            count: 0,
            stopTimeoutId: null,
        };
        cameraStreamMap.set(cameraId, slot);
        // A denied or unplugged camera must not poison the slot for the rest of
        // the process — drop it so the next attempt actually retries.
        slot.promise.catch(() => {
            if (cameraStreamMap.get(cameraId) === slot) {
                cameraStreamMap.delete(cameraId);
            }
        });
    }
    if (slot.stopTimeoutId !== null) {
        clearTimeout(slot.stopTimeoutId);
        slot.stopTimeoutId = null;
    }
    slot.count += 1;
    return slot.promise;
}

export function releaseCameraStream(cameraId: string) {
    const slot = cameraStreamMap.get(cameraId);
    if (slot === undefined) {
        return;
    }
    slot.count -= 1;
    if (slot.count > 0 || slot.stopTimeoutId !== null) {
        return;
    }
    slot.stopTimeoutId = setTimeout(() => {
        if (cameraStreamMap.get(cameraId) === slot) {
            cameraStreamMap.delete(cameraId);
        }
        slot.promise.then(stopCameraStream).catch(() => {
            // Never opened; nothing to stop.
        });
    }, CAMERA_RELEASE_GRACE_MS);
}

// Ends a stream from `getCameraStream`, and what feeds it: another
// computer's camera, or a browser viewer's (told nothing here shows it).
export function stopCameraStream(mediaStream: MediaStream) {
    releaseMirrorCameraStream(mediaStream);
    releaseViewerCameraStream(mediaStream);
    for (const track of mediaStream.getTracks()) {
        track.stop();
    }
}

function createCameraVideo(mediaStream: MediaStream) {
    const video = document.createElement('video');
    // A camera brings no sound (it is opened \`audio: false\`), and a
    // browser refuses to start an element that is not muted until the
    // page is touched -- a phone watching a virtual display drew an empty
    // box. Set as a PROPERTY: the attribute does not stop that.
    video.muted = true;
    video.playsInline = true;
    video.srcObject = mediaStream;
    video.onloadedmetadata = () => {
        playMediaElement(video);
    };
    return video;
}

// Safari on an iPad or iPhone leaves a camera's `<video>` in a screen page
// empty: it plays, its time runs, WebRTC decodes every frame, and only the
// element's own background is painted -- this computer's camera on an iPad,
// measured live 2026-10-09, while every Android and computer showed it. A
// fresh copy of the element painted or not depending on its style, so no
// style can be trusted to fix it; a canvas drawn from the very same video
// always showed the picture, even with that video nowhere on the page. So
// where there is no track generator (Safari, Firefox) the stream plays in a
// video nobody sees and each of its frames is drawn into a canvas that takes
// the video's place -- once per frame the camera sends, never per screen
// refresh. A browser with no per-frame callback keeps the `<video>`.
function createVideoFedCameraView(mediaStream: MediaStream) {
    if (
        typeof (globalThis as any).MediaStreamTrackGenerator === 'function' ||
        typeof HTMLVideoElement === 'undefined' ||
        typeof HTMLVideoElement.prototype.requestVideoFrameCallback !==
            'function'
    ) {
        return null;
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context === null) {
        return null;
    }
    const video = createCameraVideo(mediaStream);
    // Started now, not on its metadata: a video on no page may load none
    // until it plays, and an unplayed video has no frame to draw.
    playMediaElement(video);
    let callbackId: number | null = null;
    const draw = () => {
        const { videoWidth, videoHeight } = video;
        if (videoWidth > 0 && videoHeight > 0) {
            if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
                canvas.width = videoWidth;
                canvas.height = videoHeight;
            }
            context.drawImage(video, 0, 0, videoWidth, videoHeight);
        }
        callbackId = video.requestVideoFrameCallback(draw);
    };
    callbackId = video.requestVideoFrameCallback(draw);
    return {
        element: canvas,
        release: () => {
            if (callbackId !== null) {
                video.cancelVideoFrameCallback(callbackId);
                callbackId = null;
            }
            video.pause();
            video.srcObject = null;
        },
    };
}

// The element to show a camera in where a `<video>` of its stream would
// stay empty: a canvas, until `release`. Null means a `<video>` shows it.
// A browser viewer's camera comes as frames and is drawn as they come; any
// other camera, in Safari and Firefox, from a video nobody sees.
export function createCameraCanvasView(mediaStream: MediaStream) {
    return (
        createViewerCameraView(mediaStream) ??
        createVideoFedCameraView(mediaStream)
    );
}

export async function getCameraAndShowMedia(
    {
        id,
        label,
        extraStyle,
        parentContainer,
        width,
        onUnavailable,
    }: ForegroundCameraDataType & {
        parentContainer: HTMLElement;
        width?: number;
        /**
         * Told when the camera cannot be opened HERE. A failure used to be a
         * `console.error` and nothing else, so the operator saw the camera in
         * the mini preview, an on-screen dot on the widget and a working Hide
         * button -- with nothing on the projector and no message anywhere they
         * would look. This stays a callback rather than a toast so that this
         * module keeps no `tran`/toast/settings imports: it also loads in the
         * screen window, where a toast IS the projector and must never appear.
         */
        onUnavailable?: (cameraName: string) => void;
    },
    animData?: StyleAnimType,
) {
    let acquiredDeviceId: string | null = null;
    try {
        // Resolve BEFORE opening, the way the slide camera item already does
        // (`slideCameraSyncHelpers`). This runs in the screen window too, and
        // that is a different document from the presenter -- Chromium rotates
        // `deviceId` per origin and per session, so the id the presenter saved
        // can be dead here. Without this the projector showed nothing while the
        // mini preview kept working, and the throw went to the console only.
        // A browser viewer's camera not shared right now (its tab reloading,
        // its camera turned off) is still opened: it shows the moment it is
        // shared again, hidden until then.
        const resolvedId =
            (await resolveCameraDeviceId(id, label ?? '')) ??
            (checkIsViewerCameraId(id) ? id : null);
        if (resolvedId === null) {
            onUnavailable?.(label || id);
            return () => {};
        }
        // Ref-counted, so the several previews one window draws of the same
        // camera share ONE stream instead of re-handshaking the device.
        const mediaStream = await acquireCameraStream(resolvedId);
        acquiredDeviceId = resolvedId;
        // In Safari and Firefox a camera shows in a canvas: an iPad never
        // paints the `<video>` it would otherwise be.
        const view = createCameraCanvasView(mediaStream);
        const element = view?.element ?? createCameraVideo(mediaStream);
        if (width !== undefined) {
            element.style.width = `${width}px`;
        }
        Object.assign(element.style, extraStyle ?? {});
        // Hidden while a viewer's camera sends no pictures.
        const stopListeningLive = listenViewerCameraLive(
            mediaStream,
            (isLive) => {
                element.style.visibility = isLive ? '' : 'hidden';
            },
        );
        parentContainer.innerHTML = '';
        const releaseThisStream = () => {
            if (acquiredDeviceId === null) {
                return;
            }
            stopListeningLive();
            view?.release();
            releaseCameraStream(acquiredDeviceId);
            acquiredDeviceId = null;
        };
        if (animData === undefined) {
            parentContainer.appendChild(element);
            return releaseThisStream;
        }
        animData.animIn(element, parentContainer);
        return async () => {
            await animData.animOut(element);
            releaseThisStream();
        };
    } catch (error) {
        if (acquiredDeviceId !== null) {
            releaseCameraStream(acquiredDeviceId);
        }
        handleError(error);
        onUnavailable?.(label || id);
    }
    return () => {};
}
