import { useState } from 'react';

import { useAppEffect } from '../../helper/debuggerHelpers';
import type { CanvasItemEventDataType } from './CanvasController';
import { useCanvasControllerContext } from './CanvasController';
import type { CanvasControllerEventType } from './canvasHelpers';

export function useCanvasControllerEvents(
    eventTypes: CanvasControllerEventType[],
    callback?: (data: CanvasItemEventDataType) => void,
) {
    const canvasController = useCanvasControllerContext();
    useAppEffect(() => {
        const regEvents = canvasController.itemRegisterEventListener(
            eventTypes,
            (data) => {
                callback?.(data);
            },
        );
        return () => {
            canvasController.unregisterEventListener(regEvents);
        };
    }, [canvasController]);
}

export function useSlideCanvasScale() {
    const canvasController = useCanvasControllerContext();
    const [scale, setScale] = useState(canvasController.scale);
    useAppEffect(() => {
        const regEvents = canvasController.itemRegisterEventListener(
            ['scale'],
            () => {
                setScale(canvasController.scale);
            },
        );
        return () => {
            canvasController.unregisterEventListener(regEvents);
        };
    }, [canvasController]);
    return scale;
}

export function useCanvasControllerRefreshEvents(
    eventTypes?: CanvasControllerEventType[],
) {
    if (eventTypes === undefined) {
        eventTypes = ['update', 'scale'];
    }
    const [n, setN] = useState(0);
    useCanvasControllerEvents(eventTypes, () => {
        setN((n) => n + 1);
    });
    return n;
}
