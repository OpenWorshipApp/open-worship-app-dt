import { useRef } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';

export default class ProgressBarEventListener extends EventHandler<string> {
    static readonly eventNamePrefix: string = 'progress-bar';

    static showProgressBar(progressKey: string) {
        this.addPropEvent('show', progressKey);
    }
    static hideProgressBar(progressKey: string) {
        this.addPropEvent('hide', progressKey);
    }
}

export function useShowProgressBar(listener: ListenerType<string>) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['show'],
            (data: string) => {
                listenerRef.current(data);
            },
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    }, []);
}

export function useHideProgressBar(listener: ListenerType<string>) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['hide'],
            (data: string) => {
                listenerRef.current(data);
            },
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    }, []);
}
