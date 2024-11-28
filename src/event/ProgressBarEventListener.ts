import { useAppEffect } from '../helper/debuggerHelpers';
import EventHandler, { ListenerType } from './EventHandler';

export default class ProgressBarEventListener extends
    EventHandler<string> {
    static readonly eventNamePrefix: string = 'progress-bar';

    static showProgressBard(progressKey: string) {
        this.addPropEvent('show', progressKey);
    }
    static hideProgressBard(progressKey: string) {
        this.addPropEvent('hide', progressKey);
    }
}

export function useShowProgressBar(listener: ListenerType<string>) {
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['show'], listener,
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    });
}

export function useHideProgressBar(listener: ListenerType<string>) {
    useAppEffect(() => {
        const event = ProgressBarEventListener.registerEventListener(
            ['hide'], listener,
        );
        return () => {
            ProgressBarEventListener.unregisterEventListener(event);
        };
    });
}
