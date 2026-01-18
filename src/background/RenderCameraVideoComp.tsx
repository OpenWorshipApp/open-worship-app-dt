import { useRef } from 'react';

import { useAppEffectAsync } from '../helper/debuggerHelpers';
import LoadingComp from '../others/LoadingComp';
import { getCameraAndShowMedia } from '../helper/cameraHelpers';

export default function RenderCameraVideoComp({
    deviceId,
    width,
}: Readonly<{
    deviceId: string;
    width: number;
}>) {
    const containerRef = useRef<HTMLDivElement>(null);
    useAppEffectAsync(async () => {
        if (containerRef.current === null) {
            return;
        }
        return await getCameraAndShowMedia({
            id: deviceId,
            parentContainer: containerRef.current,
            width,
            extraStyle: {
                borderBottomLeftRadius: 'var(--bs-border-radius)',
                borderBottomRightRadius: 'var(--bs-border-radius)',
            },
        });
    }, [containerRef.current, width]);
    return (
        <div className="w-100 h-100" ref={containerRef}>
            <LoadingComp />
        </div>
    );
}
