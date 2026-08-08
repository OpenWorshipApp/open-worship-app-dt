// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES: modules further down the graph subclass them, and a
// plain object throws "Class extends value is not a constructor" at import
// time — the same trap `presentingFlowScreenIds.test.ts` documents.
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

const { default: PresentingFlow } = await import('./PresentingFlow');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-05',
};

let instanceCount = 0;

/**
 * A presenting flow with its file layer stubbed on the instance: `updateItemJsonList`
 * reads through `getJsonData` and writes through `setJsonData` + `save`, so
 * replacing those three exercises the real mutation logic without touching
 * disk. `save` is a spy because "wrote nothing" is half of what the guards
 * below promise. Each presenting flow gets its own path — `getInstance` caches.
 */
function genPresentingFlow(items: any[]) {
    instanceCount += 1;
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/reorder-${instanceCount}.owpf`,
    );
    const jsonData = { items, metadata: METADATA };
    (presentingFlow as any).getJsonData = async () => {
        return jsonData;
    };
    (presentingFlow as any).setJsonData = (newJsonData: any) => {
        jsonData.items = newJsonData.items;
    };
    const save = vi.fn(async () => {
        return true;
    });
    (presentingFlow as any).save = save;
    return { presentingFlow, jsonData, save };
}

function genColorItem(title: string) {
    return { type: 'bg-color', data: title, title };
}

function toTitles(items: any[]) {
    return items.map((item) => {
        return item.title;
    });
}

describe('moving a presenting flow entry across the whole run sheet', () => {
    test('an entry jumps to the top without disturbing the others', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow(
            ['a', 'b', 'c', 'd'].map(genColorItem),
        );

        // What the "Move to Top" menu entry does.
        expect(await presentingFlow.moveItemToIndex(2, 0)).toBe(true);

        expect(toTitles(jsonData.items)).toEqual(['c', 'a', 'b', 'd']);
    });

    test('an entry jumps to the bottom without disturbing the others', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow(
            ['a', 'b', 'c', 'd'].map(genColorItem),
        );

        // What the "Move to Bottom" menu entry does: the menu passes the count
        // it drew the rows with, and the clamp inside `moveItemToIndex` — which
        // runs AFTER the entry is spliced out — turns it into "last".
        expect(await presentingFlow.moveItemToIndex(1, 4 - 1)).toBe(true);

        expect(toTitles(jsonData.items)).toEqual(['a', 'c', 'd', 'b']);
    });

    test('an out-of-range move writes nothing', async () => {
        const { presentingFlow, jsonData, save } = genPresentingFlow(
            ['a', 'b'].map(genColorItem),
        );

        expect(await presentingFlow.moveItemToIndex(5, 0)).toBe(false);

        expect(toTitles(jsonData.items)).toEqual(['a', 'b']);
        expect(save).not.toHaveBeenCalled();
    });
});

describe('duplicating a presenting flow entry', () => {
    test('the copy lands right below the original and carries its presets', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            genColorItem('a'),
            {
                type: 'appDocument',
                filePath: '/docs/b.ows',
                data: '/docs/b.ows',
                title: 'b',
                colorNote: '#ff0000',
                screenIds: [2],
                slideScreenIds: { 7: [1] },
                isDisabled: true,
                disabledSlideIds: [7],
            },
            genColorItem('c'),
        ]);

        expect(await presentingFlow.duplicateItemAtIndex(1)).toBe(true);

        expect(toTitles(jsonData.items)).toEqual(['a', 'b', 'b', 'c']);
        // Duplicating rather than adding the same document again is only worth
        // anything if everything pinned to the entry comes along — everything
        // but its IDENTITY, which is what things point at: the copy is another
        // line of the sheet, so what named the original goes on naming it.
        expect(jsonData.items[2].uuid).not.toBe(jsonData.items[1].uuid);
        expect({ ...jsonData.items[2], uuid: undefined }).toEqual({
            ...jsonData.items[1],
            uuid: undefined,
        });
        expect(jsonData.items[2].colorNote).toBe('#ff0000');
        expect(jsonData.items[2].screenIds).toEqual([2]);
        expect(jsonData.items[2].slideScreenIds).toEqual({ 7: [1] });
        expect(jsonData.items[2].isDisabled).toBe(true);
        expect(jsonData.items[2].disabledSlideIds).toEqual([7]);
    });

    test('the two entries are independent afterwards', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            genColorItem('a'),
        ]);

        await presentingFlow.duplicateItemAtIndex(0);
        // Sharing one object between two slots would make every later per-entry
        // setter hit both rows at once.
        expect(jsonData.items[1]).not.toBe(jsonData.items[0]);

        await presentingFlow.setItemColorNote(1, '#00ff00');

        expect(jsonData.items[1].colorNote).toBe('#00ff00');
        expect(jsonData.items[0].colorNote).toBeUndefined();
    });

    test('an out-of-range index writes nothing', async () => {
        const { presentingFlow, jsonData, save } = genPresentingFlow([
            genColorItem('a'),
        ]);

        expect(await presentingFlow.duplicateItemAtIndex(3)).toBe(false);

        expect(jsonData.items).toHaveLength(1);
        expect(save).not.toHaveBeenCalled();
    });
});
