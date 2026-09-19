import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';
import KeyboardEventListener from './KeyboardEventListener';

export type AppWidgetType =
    | 'root'
    | 'bible-lookup'
    | 'slide-edit'
    | 'setting'
    | 'context-menu'
    // The app-wide annotation overlay (src/presenting-control). It claims a
    // layer for as long as the controller is OPEN, not just while a tool is
    // armed: the tool keys have to be able to reach in and ARM a tool from
    // `interact`, which is exactly when you want them. Once armed the overlay
    // covers the whole window anyway, so the app's own shortcuts (Ctrl+Z in
    // particular, which would undo a slide edit instead of a stroke) must not
    // fire underneath it.
    | 'presenting-control';
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
