import { useAppEffect } from '../helper/debuggerHelpers';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';
import KeyboardEventListener from './KeyboardEventListener';

export type AppWidgetType =
    | 'root'
    | 'bible-lookup'
    | 'slide-edit'
    | 'setting'
    | 'context-menu';
export type OpenCloseType = 'open' | 'close';
export type EventMapper = {
    widget: AppWidgetType;
    state: OpenCloseType;
};

export default class WindowEventListener extends EventHandler<string> {
    static readonly eventNamePrefix: string = 'window';
    static fireEvent(event: EventMapper, data?: any) {
        if (event.state === 'open') {
            KeyboardEventListener.addLayer(event.widget);
        } else {
            KeyboardEventListener.removeLayer(event.widget);
        }
        const eventKey = this.toEventMapperKey(event);
        this.addPropEvent(eventKey, data);
    }
    static toEventMapperKey(event: EventMapper) {
        return `${event.widget}-${event.state}`;
    }
}

export function useWindowEvent(
    eventMapper: EventMapper,
    listener: ListenerType<any>,
) {
    useAppEffect(() => {
        const eventName = WindowEventListener.toEventMapperKey(eventMapper);
        const event = WindowEventListener.registerEventListener(
            [eventName],
            listener,
        );
        return () => {
            WindowEventListener.unregisterEventListener(event);
        };
    }, [eventMapper]);
}
