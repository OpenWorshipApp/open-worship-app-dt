import { useState } from 'react';

import { useAppEffectAsync } from './appHooks';
import { handleError } from './errorHelpers';
import { playMediaElement } from './mediaHelpers';
import type {
    ForegroundCameraDataType,
    StyleAnimType,
} from '../_screen/screenTypeHelpers';
import { electronSendAsync } from '../server/appHelpers';

export type CameraInfoType = {
    deviceId: string;
    groupId: string;
    label: string;
};

const { mediaDevices } = navigator;

export async function requestCameraAccess() {
    const canAccess = await electronSendAsync<boolean>(
        'main:app:ask-camera-access',
    );
    return canAccess;
}

export async function getAllCameraDevices() {
    const canAccess = await requestCameraAccess();
    if (!canAccess) {
        return [];
    }
    const devices = await mediaDevices.enumerateDevices();
    const cameraList: CameraInfoType[] = [];
    for (const device of devices) {
        if (device.kind === 'videoinput') {
            cameraList.push(device);
        }
    }
    return cameraList;
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
    return cameraInfoList;
}

export async function getCameraStream(cameraId: string) {
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
        slot.promise
            .then((mediaStream) => {
                for (const track of mediaStream.getTracks()) {
                    track.stop();
                }
            })
            .catch(() => {
                // Never opened; nothing to stop.
            });
    }, CAMERA_RELEASE_GRACE_MS);
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
        const resolvedId = await resolveCameraDeviceId(id, label ?? '');
        if (resolvedId === null) {
            onUnavailable?.(label || id);
            return () => {};
        }
        // Ref-counted, so the several previews one window draws of the same
        // camera share ONE stream instead of re-handshaking the device.
        const mediaStream = await acquireCameraStream(resolvedId);
        acquiredDeviceId = resolvedId;
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.onloadedmetadata = () => {
            playMediaElement(video);
        };
        if (width !== undefined) {
            video.style.width = `${width}px`;
        }
        Object.assign(video.style, extraStyle ?? {});
        parentContainer.innerHTML = '';
        const releaseThisStream = () => {
            if (acquiredDeviceId === null) {
                return;
            }
            releaseCameraStream(acquiredDeviceId);
            acquiredDeviceId = null;
        };
        if (animData === undefined) {
            parentContainer.appendChild(video);
            return releaseThisStream;
        }
        animData.animIn(video, parentContainer);
        return async () => {
            await animData.animOut(video);
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
