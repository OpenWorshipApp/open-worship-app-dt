import { useState } from 'react';

import { useAppEffectAsync } from './debuggerHelpers';

export type CameraInfoType = {
    deviceId: string;
    groupId: string;
    label: string;
};

export function useCameraInfoList() {
    const [cameraInfoList, setCameraInfoList] = useState<CameraInfoType[]>([]);
    useAppEffectAsync(
        async (contextMethods) => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameraList: CameraInfoType[] = [];
            for (const device of devices) {
                if (device.kind === 'videoinput') {
                    cameraList.push(device);
                }
            }
            contextMethods.setCameraInfoList(cameraList);
        },
        [],
        { setCameraInfoList },
    );
    return cameraInfoList;
}
