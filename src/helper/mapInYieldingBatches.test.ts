import { describe, expect, test, vi } from 'vitest';

// `helpers.ts` pulls in `appProvider` (and through it `document`) at module
// load, which a node-env test cannot satisfy. Only the pure batching function
// is under test here, so the heavy siblings are stubbed away.
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('./loggerHelpers', () => ({ appTrace: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/unlockingHelpers', () => ({ unlocking: vi.fn() }));
vi.mock('../others/CacheManager', () => ({ globalCacheManager1M: {} }));

import { mapInYieldingBatches } from './helpers';

describe('mapInYieldingBatches', () => {
    test('keeps the order of the input, not the completion order', async () => {
        const items = [30, 10, 20, 0, 40];

        const result = await mapInYieldingBatches(
            items,
            (item) => {
                // Later items finish FIRST — a naive implementation that
                // collected results as they landed would scramble them.
                return new Promise<number>((resolve) => {
                    setTimeout(() => resolve(item * 2), item);
                });
            },
            2,
        );

        expect(result).toEqual([60, 20, 40, 0, 80]);
    });

    test('runs at most `batchSize` tasks at a time', async () => {
        let running = 0;
        let peak = 0;

        await mapInYieldingBatches(
            Array.from({ length: 20 }, (_, index) => index),
            async () => {
                running += 1;
                peak = Math.max(peak, running);
                await Promise.resolve();
                running -= 1;
            },
            4,
        );

        // The whole point: an unbounded `Promise.all` would peak at 20 and hold
        // the microtask queue for the entire run.
        expect(peak).toBeLessThanOrEqual(4);
    });

    test('yields to the macrotask queue between batches', async () => {
        const order: string[] = [];
        // A timer queued before the map must get a turn while the map is still
        // going. It only can if the batches are separated by a real macrotask.
        setTimeout(() => {
            order.push('timer');
        }, 0);

        await mapInYieldingBatches(
            [1, 2, 3, 4],
            (item) => {
                order.push(`item-${item}`);
                return item;
            },
            2,
        );

        expect(order.indexOf('timer')).toBeGreaterThan(-1);
        expect(order.indexOf('timer')).toBeLessThan(order.indexOf('item-3'));
    });

    test('an empty list resolves to an empty list without yielding', async () => {
        await expect(mapInYieldingBatches([], () => 1)).resolves.toEqual([]);
    });

    test('a single batch does not yield at all', async () => {
        const order: string[] = [];
        setTimeout(() => {
            order.push('timer');
        }, 0);

        await mapInYieldingBatches([1, 2], (item) => item, 5);
        order.push('done');

        // Nothing to page through, so nothing should have been handed back to
        // the event loop mid-run.
        expect(order).toEqual(['done']);
    });

    test('passes the index through, counting across batches', async () => {
        const seen: number[] = [];

        await mapInYieldingBatches(
            ['a', 'b', 'c', 'd', 'e'],
            (_item, index) => {
                seen.push(index);
            },
            2,
        );

        expect(seen).toEqual([0, 1, 2, 3, 4]);
    });

    test('a rejecting task rejects the whole map', async () => {
        await expect(
            mapInYieldingBatches(
                [1, 2],
                (item) => {
                    if (item === 2) {
                        return Promise.reject(new Error('nope'));
                    }
                    return Promise.resolve(item);
                },
                2,
            ),
        ).rejects.toThrow('nope');
    });
});
