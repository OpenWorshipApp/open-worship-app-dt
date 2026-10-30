import { describe, expect, test, vi } from 'vitest';

import { genRefCountedScreenUpdateSubscriber } from './screenUpdateSubscriberHelpers';

function createHandler(name: string) {
    const registered: { name: string; events: string[] }[] = [];
    return {
        name,
        registered,
        registerEventListener: vi.fn(
            (events: string[], _listener: () => void) => {
                const entry = { name, events };
                registered.push(entry);
                return entry;
            },
        ),
        unregisterEventListener: vi.fn(),
    };
}

describe('genRefCountedScreenUpdateSubscriber', () => {
    test('resolves the managers lazily, on the first acquire only', () => {
        const getHandlerList = vi.fn(() => [createHandler('a')]);
        const subscriber = genRefCountedScreenUpdateSubscriber(
            getHandlerList,
            vi.fn(),
        );
        // Building it must not touch the managers: they sit in the same
        // import cycle and are not initialised yet at that point.
        expect(getHandlerList).not.toHaveBeenCalled();

        const releaseA = subscriber.acquire();
        const releaseB = subscriber.acquire();
        expect(getHandlerList).toHaveBeenCalledTimes(1);

        releaseA();
        releaseB();
    });

    test('subscribes once per window however many consumers acquire', () => {
        const first = createHandler('first');
        const second = createHandler('second');
        const onUpdate = vi.fn();
        const subscriber = genRefCountedScreenUpdateSubscriber(
            () => [first, second],
            onUpdate,
        );

        const releaseList = [
            subscriber.acquire(),
            subscriber.acquire(),
            subscriber.acquire(),
        ];

        expect(first.registerEventListener).toHaveBeenCalledTimes(1);
        expect(first.registerEventListener).toHaveBeenCalledWith(
            ['update'],
            onUpdate,
        );
        expect(second.registerEventListener).toHaveBeenCalledTimes(1);
        expect(second.registerEventListener).toHaveBeenCalledWith(
            ['update'],
            onUpdate,
        );

        // Two of three leave: still subscribed.
        releaseList[0]();
        releaseList[1]();
        expect(first.unregisterEventListener).not.toHaveBeenCalled();
        expect(second.unregisterEventListener).not.toHaveBeenCalled();

        // The last one leaves: every manager is unregistered with exactly
        // what it handed back on register.
        releaseList[2]();
        expect(first.unregisterEventListener).toHaveBeenCalledTimes(1);
        expect(first.unregisterEventListener).toHaveBeenCalledWith(
            first.registered[0],
        );
        expect(second.unregisterEventListener).toHaveBeenCalledWith(
            second.registered[0],
        );
    });

    test('a double release cannot drop the count below what is mounted', () => {
        const handler = createHandler('h');
        const subscriber = genRefCountedScreenUpdateSubscriber(
            () => [handler],
            vi.fn(),
        );
        const releaseA = subscriber.acquire();
        const releaseB = subscriber.acquire();

        // StrictMode runs a cleanup twice; the second call is a no-op.
        releaseA();
        releaseA();
        expect(handler.unregisterEventListener).not.toHaveBeenCalled();

        releaseB();
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(1);
    });

    test('subscribes again after the last consumer left', () => {
        const handler = createHandler('h');
        const subscriber = genRefCountedScreenUpdateSubscriber(
            () => [handler],
            vi.fn(),
        );
        subscriber.acquire()();
        expect(handler.registerEventListener).toHaveBeenCalledTimes(1);
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(1);

        const release = subscriber.acquire();
        expect(handler.registerEventListener).toHaveBeenCalledTimes(2);
        release();
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(2);
    });

    test('reset forgets every consumer and unsubscribes', () => {
        const handler = createHandler('h');
        const subscriber = genRefCountedScreenUpdateSubscriber(
            () => [handler],
            vi.fn(),
        );
        subscriber.acquire();
        subscriber.acquire();

        subscriber.reset();
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(1);

        // A fresh consumer after the reset subscribes from zero again.
        const release = subscriber.acquire();
        expect(handler.registerEventListener).toHaveBeenCalledTimes(2);
        release();
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(2);

        // Reset with nothing registered unregisters nothing more.
        subscriber.reset();
        expect(handler.unregisterEventListener).toHaveBeenCalledTimes(2);
    });
});
