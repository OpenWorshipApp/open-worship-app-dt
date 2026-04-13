import { beforeEach, describe, expect, test, vi } from 'vitest';

import GarbageCollectableCacher from './GarbageCollectableCacher';

describe('GarbageCollectableCacher', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    test('stores values until they expire', () => {
        const cacher = new GarbageCollectableCacher<number>(1);

        cacher.set('one', 1);
        expect(cacher.get('one')).toBe(1);

        vi.advanceTimersByTime(1001);

        expect(cacher.get('one')).toBeNull();
    });

    test('deletes expired entries during clear and reschedules when items remain', () => {
        const cacher = new GarbageCollectableCacher<number>(1);
        const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');

        cacher.set('old', 1);
        vi.advanceTimersByTime(500);
        cacher.set('new', 2);
        vi.advanceTimersByTime(600);

        cacher.clear();

        expect(cacher.get('old')).toBeNull();
        expect(cacher.get('new')).toBe(2);
        expect(timeoutSpy).toHaveBeenCalled();
    });

    test('supports delete and ignores re-entrant clear calls', () => {
        const cacher = new GarbageCollectableCacher<number>(5);

        cacher.set('key', 9);
        cacher.delete('key');
        expect(cacher.get('key')).toBeNull();

        (cacher as any).isClearing = true;
        cacher.clear();

        expect((cacher as any)._cache.size).toBe(0);
    });
});
