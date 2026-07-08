import { useRef } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import type { SimpleToastType } from '../toast/SimpleToastComp';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';

export type ToastEventType = 'simple';

export default class ToastEventListener extends EventHandler<ToastEventType> {
    static readonly eventNamePrefix: string = 'toast';
    static showSimpleToast(toast: SimpleToastType) {
        this.addPropEvent('simple', toast);
    }
}

export function useToastSimpleShowing(listener: ListenerType<SimpleToastType>) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = ToastEventListener.registerEventListener(
            ['simple'],
            (data: SimpleToastType, time: number) => {
                listenerRef.current(data, time);
            },
        );
        return () => {
            ToastEventListener.unregisterEventListener(event);
        };
    }, []);
}
