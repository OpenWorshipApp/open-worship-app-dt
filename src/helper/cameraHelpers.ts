import { useState } from 'react';

import { useAppEffectAsync } from './debuggerHelpers';
import { handleError } from './errorHelpers';
import {
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

async function getAllCameraDevices() {
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

export async function getCameraStream(cameraID: string) {
    const canAccess = await requestCameraAccess();
    if (!canAccess) {
        throw new Error('Camera access denied');
    }
    const mediaStream = await mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: cameraID } },
    });
    return mediaStream;
}

export async function getCameraAndShowMedia(
    {
        id,
        extraStyle,
        parentContainer,
        width,
    }: ForegroundCameraDataType & {
        parentContainer: HTMLElement;
        width?: number;
    },
    animData?: StyleAnimType,
) {
    try {
        const mediaStream = await getCameraStream(id);
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.onloadedmetadata = () => {
            video.play();
        };
        if (width !== undefined) {
            video.style.width = `${width}px`;
        }
        Object.assign(video.style, extraStyle ?? {});
        parentContainer.innerHTML = '';
        const stopAllStreams = () => {
            const tracks = mediaStream.getVideoTracks();
            for (const track of tracks) {
                track.stop();
            }
        };
        if (animData === undefined) {
            parentContainer.appendChild(video);
            return stopAllStreams;
        }
        animData.animIn(video, parentContainer);
        return async () => {
            await animData.animOut(video);
            stopAllStreams();
        };
    } catch (error) {
        handleError(error);
    }
    return () => {};
}
