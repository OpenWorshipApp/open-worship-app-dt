import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';
import KeyboardEventListener from './KeyboardEventListener';

export type AppWidgetType =
    'root' | 'bible-lookup' | 'slide-edit' | 'setting' | 'context-menu';
export type OpenCloseType = 'open' | 'close';
export type WindowEventMapperType = {
    widget: AppWidgetType;
    state: OpenCloseType;
};

export default class WindowEventListener extends EventHandler<string> {
    static readonly eventNamePrefix: string = 'window';
    static fireEvent(event: WindowEventMapperType, data?: any) {
        if (event.state === 'open') {
            KeyboardEventListener.addLayer(event.widget);
        } else {
            KeyboardEventListener.removeLayer(event.widget);
        }
        const eventKey = this.toEventMapperKey(event);
        this.addPropEvent(eventKey, data);
    }
    static toEventMapperKey(event: WindowEventMapperType) {
        return `${event.widget}-${event.state}`;
    }
}

export function useWindowEvent<T>(
    eventMapper: WindowEventMapperType,
    listener: ListenerType<T>,
) {
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const eventName = WindowEventListener.toEventMapperKey(eventMapper);
        const event = WindowEventListener.registerEventListener(
            [eventName],
            (data: T, time: number) => {
                listenerRef.current(data, time);
            },
        );
        return () => {
            WindowEventListener.unregisterEventListener(event);
        };
    }, [JSON.stringify(eventMapper)]);
}
