import { beforeEach, describe, expect, test, vi } from 'vitest';

import EventHandler, { BasicEventHandler } from './EventHandler';

class TestBasicEventHandler extends BasicEventHandler<'alpha' | 'beta'> {
    shouldProceed = true;

    async checkShouldNext() {
        return this.shouldProceed;
    }
}

class TestEventHandler extends EventHandler<'open' | 'close'> {
    static readonly eventNamePrefix = 'test-event';
    static shouldProceed = true;

    static async checkShouldNext() {
        return TestEventHandler.shouldProceed;
    }
}

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('EventHandler', () => {
    beforeEach(() => {
        (TestEventHandler as any).eventHandler = null;
        TestEventHandler.shouldProceed = true;
    });

    test('queues prop events, respects locking, and stops after default prevention', async () => {
        const handler = new TestBasicEventHandler();
        const firstListener = vi.fn();
        const secondListener = vi.fn((event: { defaultPrevented?: boolean }) => {
            event.defaultPrevented = true;
        });

        handler.addOnEventListener('alpha', firstListener);
        handler.addOnEventListener('alpha', secondListener);
        handler.isLockProp = true;

        handler.addPropEvent('alpha', { defaultPrevented: false });
        await flushAsyncEvents();
        expect(firstListener).not.toHaveBeenCalled();
        expect(secondListener).not.toHaveBeenCalled();

        handler.isLockProp = false;
        (handler as any).checkPropEvent();
        await flushAsyncEvents();

        expect(secondListener).toHaveBeenCalledTimes(1);
        expect(firstListener).not.toHaveBeenCalled();
    });

    test('guards invalid names, unregisters listeners, and destroys internal state', async () => {
        const handler = new TestBasicEventHandler();
        const listener = vi.fn();

        expect(() => handler.addOnEventListener('' as any, listener)).toThrow(
            'invalid event name',
        );

        const registered = handler.registerEventListener(['alpha', 'beta'], listener);
        handler.unregisterEventListener(registered);
        handler.addPropEvent('alpha', { defaultPrevented: false });
        await flushAsyncEvents();
        expect(listener).not.toHaveBeenCalled();

        handler.addOnEventListener('alpha', listener);
        handler.destroy();
        handler.addPropEvent('alpha', { defaultPrevented: false });
        await flushAsyncEvents();
        expect(listener).not.toHaveBeenCalled();
    });

    test('skips listeners when checkShouldNext returns false', async () => {
        const handler = new TestBasicEventHandler();
        const listener = vi.fn();
        handler.shouldProceed = false;
        handler.addOnEventListener('beta', listener);

        handler.addPropEvent('beta', {});
        await flushAsyncEvents();

        expect(listener).not.toHaveBeenCalled();
    });

    test('prefixes static event names and reuses the static dispatcher', async () => {
        const listener = vi.fn();
        const registered = TestEventHandler.registerEventListener(['open'], listener);

        expect(TestEventHandler.prefixEventName('open')).toBe('test-event-open');

        TestEventHandler.addPropEvent('open', { id: 1 });
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledWith({ id: 1 });

        TestEventHandler.shouldProceed = false;
        TestEventHandler.addPropEvent('open', { id: 2 });
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledTimes(1);

        TestEventHandler.unregisterEventListener(registered);
        TestEventHandler.shouldProceed = true;
        TestEventHandler.addPropEvent('open', { id: 3 });
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
