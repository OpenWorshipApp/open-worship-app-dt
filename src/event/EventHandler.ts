export type ListenerType<T> = (data: T) => (void | Promise<void>);

export type RegisteredEventType<T, F> = {
    eventName: T,
    listener: ListenerType<F>,
};

export class BasicEventHandler<T extends string> {
    private eventListenersMapper = new Map<string, ListenerType<any>[]>();
    private readonly propEvent: {
        eventName: T,
        data?: any,
    }[];
    constructor() {
        this.propEvent = [];
    }
    isLockProp: boolean = false;
    public destroy() {
        this.eventListenersMapper = new Map();
        this.propEvent.length = 0;
    }

    private checkPropEvent() {
        if (this.isLockProp) {
            return;
        }
        while (this.propEvent.length) {
            const event = this.propEvent.shift();
            if (event !== undefined) {
                this.checkOnEvent(event.eventName, event.data);
            }
        }
    }

    addPropEvent(eventName: T, data?: any) {
        this.propEvent.push({
            eventName,
            data,
        });
        this.checkPropEvent();
    }

    addOnEventListener(eventName: T, listener: ListenerType<any>) {
        this.guardEventName(eventName);
        const listeners = this.eventListenersMapper.get(eventName) || [];
        listeners.push(listener);
        this.eventListenersMapper.set(eventName, listeners);
    }

    removeOnEventListener(eventName: T, listener: ListenerType<any>) {
        this.guardEventName(eventName);
        const listeners = this.eventListenersMapper.get(eventName) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    private guardEventName(eventName?: string) {
        if (!eventName) {
            throw new Error('invalid event name');
        }
    }

    private checkOnEvent(eventName: T, data?: any) {
        this.guardEventName(eventName);
        const listeners = [
            ...(this.eventListenersMapper.get(eventName) || []),
        ].reverse();
        for (const listener of listeners) {
            listener(data);
            if (data?.defaultPrevented) {
                break;
            }
        }
    }

    registerEventListener<F>(eventNames: T[], listener: ListenerType<F>):
        RegisteredEventType<T, F>[] {

        return eventNames.map((eventName) => {
            this.addOnEventListener(eventName, listener);
            return { eventName, listener };
        });
    }

    unregisterEventListener<F>(regEvents: RegisteredEventType<T, F>[]) {
        regEvents.forEach(({ eventName, listener }) => {
            this.removeOnEventListener(eventName, listener);
        });
    }
}

const eventHandler = new BasicEventHandler<any>();

export default class EventHandler<T extends string> extends
    BasicEventHandler<T> {

    static readonly eventNamePrefix: string = 'event';

    static registerEventListener<T extends string, F>(
        eventNames: T[], listener: ListenerType<F>,
    ):
        RegisteredEventType<T, F>[] {
        return eventNames.map((eventName) => {
            eventHandler.addOnEventListener(
                this.prefixEventName(eventName), listener);
            return { eventName, listener };
        });
    }


    static addPropEvent<T extends string>(eventName: T, data?: any) {
        eventHandler.addPropEvent(this.prefixEventName(eventName), data);
    }

    static unregisterEventListener<T extends string, F>(
        regEvents: RegisteredEventType<T, F>[]) {
        regEvents.forEach(({ eventName, listener }) => {
            eventHandler.removeOnEventListener(
                this.prefixEventName(eventName), listener,
            );
        });
    }

    static prefixEventName(eventName: string) {
        return `${this.eventNamePrefix}-${eventName}`;
    }
}
