import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
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
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['show'],
            (data: string, time: number) => {
                listenerRef.current(data, time);
            },
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    }, []);
}

export function useHideProgressBar(listener: ListenerType<string>) {
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['hide'],
            (data: string, time: number) => {
                listenerRef.current(data, time);
            },
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    }, []);
}
