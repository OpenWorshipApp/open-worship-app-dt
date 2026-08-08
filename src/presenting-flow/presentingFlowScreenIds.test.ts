// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES: modules further down the graph subclass them, and a
// plain object throws "Class extends value is not a constructor" at import
// time — the same trap `presentingFlowArchiveHelpers.test.ts` documents.
vi.mock('../bible-list/Bible', () => ({
    default: class {
        static getDefault = vi.fn(async () => null);
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        static dragDeserialize = vi.fn(() => null);
    },
}));

const { default: PresentingFlowItem } = await import('./PresentingFlowItem');
const { default: PresentingFlow } = await import('./PresentingFlow');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-05',
};

/**
 * A presenting flow with its file layer stubbed on the instance: `updateItemJsonList`
 * reads through `getJsonData` and writes through `setJsonData` + `save`, so
 * replacing those three exercises the real mutation logic without touching
 * disk.
 */
function genPresentingFlow(items: any[]) {
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/pin-${items.length}.owpf`,
    );
    const jsonData = { items, metadata: METADATA };
    (presentingFlow as any).getJsonData = async () => {
        return jsonData;
    };
    (presentingFlow as any).setJsonData = (newJsonData: any) => {
        jsonData.items = newJsonData.items;
    };
    (presentingFlow as any).save = async () => {
        return true;
    };
    return { presentingFlow, jsonData };
}

describe('pinning a presenting flow entry to specific screens', () => {
    test('a pin round-trips, and clearing it removes the key entirely', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            { type: 'bg-color', data: '#00FFFF', title: '#00FFFF' },
        ]);

        await presentingFlow.setItemScreenIds(0, [2, 1]);
        expect(jsonData.items[0].screenIds).toEqual([2, 1]);
        const items = await presentingFlow.getItems();
        expect(items?.[0].screenIds).toEqual([2, 1]);
        // Everything else on the entry survives the write.
        expect(jsonData.items[0].data).toBe('#00FFFF');

        // Not pinned is the ABSENCE of the field, so an unpinned run sheet
        // reads exactly like one written before this existed.
        await presentingFlow.setItemScreenIds(0, []);
        expect('screenIds' in jsonData.items[0]).toBe(false);
    });

    test('an out-of-range index writes nothing', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            { type: 'bg-color', data: '#fff', title: '#fff' },
        ]);
        const before = JSON.stringify(jsonData.items);

        expect(await presentingFlow.setItemScreenIds(3, [1])).toBe(false);
        expect(JSON.stringify(jsonData.items)).toBe(before);
    });

    test('a slide follows its own pin, else the document it belongs to', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            {
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
                screenIds: [1],
            },
        ]);

        const readItem = async () => {
            return (await presentingFlow.getItems())![0];
        };

        // Nothing of its own yet — every slide follows the document.
        expect((await readItem()).getSlideScreenIds(7)).toEqual([1]);
        expect((await readItem()).getOwnSlideScreenIds(7)).toEqual([]);

        await presentingFlow.setItemSlideScreenIds(0, 7, [2]);
        const pinned = await readItem();
        expect(pinned.getSlideScreenIds(7)).toEqual([2]);
        expect(pinned.getOwnSlideScreenIds(7)).toEqual([2]);
        // Its siblings are untouched.
        expect(pinned.getSlideScreenIds(8)).toEqual([1]);
        // The document's own pin survives the slide exception.
        expect(pinned.screenIds).toEqual([1]);

        // Clearing a slide hands it BACK to the document rather than pinning it
        // to nothing, and drops the map once the last exception is gone.
        await presentingFlow.setItemSlideScreenIds(0, 7, []);
        expect((await readItem()).getSlideScreenIds(7)).toEqual([1]);
        expect('slideScreenIds' in jsonData.items[0]).toBe(false);
    });

    test('a nonsense stored value reads as "not pinned" rather than erroring', () => {
        const genItem = (screenIds: any) => {
            return new (PresentingFlowItem as any)('/presenting-flows/a.owpf', {
                type: 'bg-color',
                data: '#fff',
                screenIds,
            }) as InstanceType<typeof PresentingFlowItem>;
        };

        expect(genItem(undefined).screenIds).toEqual([]);
        expect(genItem('2').screenIds).toEqual([]);
        expect(genItem([1, 'two', 3]).screenIds).toEqual([1, 3]);
        // A row with a broken pin must still be a normal, presentable row —
        // never an error row in the middle of a service.
        expect(genItem('2').isError).toBe(false);
    });
});
