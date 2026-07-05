import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/debuggerHelpers';
import type { CanvasItemEventDataType } from './CanvasController';
import type CanvasController from './CanvasController';
import { useCanvasControllerContext } from './CanvasController';
import type { CanvasControllerEventType } from './canvasHelpers';

export function useCanvasControllerEvents(
    eventTypes: CanvasControllerEventType[],
    callback?: (data: CanvasItemEventDataType) => void,
) {
    const canvasController = useCanvasControllerContext();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useAppEffect(() => {
        const regEvents = canvasController.itemRegisterEventListener(
            eventTypes,
            (data) => {
                callbackRef.current?.(data);
            },
        );
        return () => {
            canvasController.unregisterEventListener(regEvents);
        };
    }, [JSON.stringify(eventTypes), canvasController]);
}

export function useSlideCanvasScale(canvasController: CanvasController) {
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
    eventTypes ??= ['update', 'scale'];
    const [n, setN] = useState(0);
    useCanvasControllerEvents(eventTypes, () => {
        setN((n) => {
            return n + 1;
        });
    });
    return n;
}
