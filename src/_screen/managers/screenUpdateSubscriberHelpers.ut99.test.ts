import { describe, expect, test } from 'vitest';

import { genRefCountedScreenUpdateSubscriber } from './screenUpdateSubscriberHelpers';

// A stand-in for a screen manager class: it remembers what was registered on
// it so a test can read how many listeners a window really holds.
function genFakeHandler() {
    const registeredList = new Set<{
        events: string[];
        listener: () => void;
    }>();
    return {
        registeredList,
        registerEventListener(events: string[], listener: () => void) {
            const registered = { events, listener };
            registeredList.add(registered);
            return registered;
        },
        unregisterEventListener(registered: any) {
            registeredList.delete(registered);
        },
        fire() {
            for (const { listener } of Array.from(registeredList)) {
                listener();
            }
        },
    };
}

function genSubscriber() {
    const handlerA = genFakeHandler();
    const handlerB = genFakeHandler();
    const thunkCalls: number[] = [];
    const updates: number[] = [];
    const subscriber = genRefCountedScreenUpdateSubscriber(
        () => {
            thunkCalls.push(Date.now());
            return [handlerA, handlerB];
        },
        () => {
            updates.push(updates.length);
        },
    );
    return { handlerA, handlerB, thunkCalls, updates, subscriber };
}

describe('genRefCountedScreenUpdateSubscriber', () => {
    test('resolves the managers only on the first acquire', () => {
        const { handlerA, handlerB, thunkCalls, subscriber } = genSubscriber();
        // Creating it must not touch the managers: they sit in the same
        // import cycle and may not be initialised yet.
        expect(thunkCalls).toHaveLength(0);

        subscriber.acquire();
        expect(thunkCalls).toHaveLength(1);
        expect(handlerA.registeredList.size).toBe(1);
        expect(handlerB.registeredList.size).toBe(1);
        const [registered] = Array.from(handlerA.registeredList);
        expect(registered.events).toEqual(['update']);
    });

    test('many consumers share ONE subscription per manager', () => {
        const { handlerA, handlerB, thunkCalls, updates, subscriber } =
            genSubscriber();
        subscriber.acquire();
        subscriber.acquire();
        subscriber.acquire();

        expect(thunkCalls).toHaveLength(1);
        expect(handlerA.registeredList.size).toBe(1);
        expect(handlerB.registeredList.size).toBe(1);

        // One event from either manager reaches the update callback once.
        handlerA.fire();
        expect(updates).toHaveLength(1);
        handlerB.fire();
        expect(updates).toHaveLength(2);
    });

    test('unsubscribes only when the last consumer releases', () => {
        const { handlerA, handlerB, subscriber } = genSubscriber();
        const releaseFirst = subscriber.acquire();
        const releaseSecond = subscriber.acquire();

        releaseFirst();
        expect(handlerA.registeredList.size).toBe(1);
        expect(handlerB.registeredList.size).toBe(1);

        releaseSecond();
        expect(handlerA.registeredList.size).toBe(0);
        expect(handlerB.registeredList.size).toBe(0);
    });

    test('a release called twice counts once', () => {
        const { handlerA, subscriber } = genSubscriber();
        const releaseFirst = subscriber.acquire();
        const releaseSecond = subscriber.acquire();

        // StrictMode double-invokes cleanups; dropping the count twice would
        // unregister while the second consumer is still mounted.
        releaseFirst();
        releaseFirst();
        expect(handlerA.registeredList.size).toBe(1);

        releaseSecond();
        expect(handlerA.registeredList.size).toBe(0);
        // And the spent release is still a no-op afterwards.
        releaseSecond();
        expect(handlerA.registeredList.size).toBe(0);
    });

    test('subscribes again after everything was released', () => {
        const { handlerA, thunkCalls, updates, subscriber } = genSubscriber();
        subscriber.acquire()();
        expect(handlerA.registeredList.size).toBe(0);

        subscriber.acquire();
        expect(thunkCalls).toHaveLength(2);
        expect(handlerA.registeredList.size).toBe(1);
        handlerA.fire();
        expect(updates).toHaveLength(1);
    });

    test('reset forgets every consumer and unsubscribes', () => {
        const { handlerA, handlerB, thunkCalls, subscriber } = genSubscriber();
        subscriber.acquire();
        subscriber.acquire();

        subscriber.reset();
        expect(handlerA.registeredList.size).toBe(0);
        expect(handlerB.registeredList.size).toBe(0);

        // Counting starts from nothing: the next consumer subscribes anew.
        const release = subscriber.acquire();
        expect(thunkCalls).toHaveLength(2);
        expect(handlerA.registeredList.size).toBe(1);
        release();
        expect(handlerA.registeredList.size).toBe(0);
    });
});
