import { useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import type { CanvasItemEventDataType } from './CanvasController';
import type CanvasController from './CanvasController';
import { useCanvasControllerContext } from './CanvasController';
import type { CanvasControllerEventType } from './canvasHelpers';
import { type ListenerType } from '../../event/EventHandler';

export function useCanvasControllerEvents(
    eventTypes: CanvasControllerEventType[],
    callback?: ListenerType<CanvasItemEventDataType>,
) {
    const canvasController = useCanvasControllerContext();
    const callbackRef = useAppCurrentRef(callback);
    useAppEffect(() => {
        const regEvents = canvasController.itemRegisterEventListener(
            eventTypes,
            (data, time) => {
                callbackRef.current?.(data, time);
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
    const [_n, setN] = useState(Date.now());
    useCanvasControllerEvents(eventTypes, (_data, time) => {
        setN(time);
    });
}
