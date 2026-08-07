// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES: modules further down the graph subclass them, and a
// plain object throws "Class extends value is not a constructor" at import
// time — the same trap `playlistScreenIds.test.ts` documents.
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

const { default: Playlist } = await import('./Playlist');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-05',
};

let instanceCount = 0;

/**
 * A playlist with its file layer stubbed on the instance: `updateItemJsonList`
 * reads through `getJsonData` and writes through `setJsonData` + `save`, so
 * replacing those three exercises the real mutation logic without touching
 * disk. `save` is a spy because "wrote nothing" is half of what the guards
 * below promise. Each playlist gets its own path — `getInstance` caches.
 */
function genPlaylist(items: any[]) {
    instanceCount += 1;
    const playlist = Playlist.getInstance(
        `/playlists/reorder-${instanceCount}.owp`,
    );
    const jsonData = { items, metadata: METADATA };
    (playlist as any).getJsonData = async () => {
        return jsonData;
    };
    (playlist as any).setJsonData = (newJsonData: any) => {
        jsonData.items = newJsonData.items;
    };
    const save = vi.fn(async () => {
        return true;
    });
    (playlist as any).save = save;
    return { playlist, jsonData, save };
}

function genColorItem(title: string) {
    return { type: 'bg-color', data: title, title };
}

function toTitles(items: any[]) {
    return items.map((item) => {
        return item.title;
    });
}

describe('moving a playlist entry across the whole run sheet', () => {
    test('an entry jumps to the top without disturbing the others', async () => {
        const { playlist, jsonData } = genPlaylist(
            ['a', 'b', 'c', 'd'].map(genColorItem),
        );

        // What the "Move to Top" menu entry does.
        expect(await playlist.moveItemToIndex(2, 0)).toBe(true);

        expect(toTitles(jsonData.items)).toEqual(['c', 'a', 'b', 'd']);
    });

    test('an entry jumps to the bottom without disturbing the others', async () => {
        const { playlist, jsonData } = genPlaylist(
            ['a', 'b', 'c', 'd'].map(genColorItem),
        );

        // What the "Move to Bottom" menu entry does: the menu passes the count
        // it drew the rows with, and the clamp inside `moveItemToIndex` — which
        // runs AFTER the entry is spliced out — turns it into "last".
        expect(await playlist.moveItemToIndex(1, 4 - 1)).toBe(true);

        expect(toTitles(jsonData.items)).toEqual(['a', 'c', 'd', 'b']);
    });

    test('an out-of-range move writes nothing', async () => {
        const { playlist, jsonData, save } = genPlaylist(
            ['a', 'b'].map(genColorItem),
        );

        expect(await playlist.moveItemToIndex(5, 0)).toBe(false);

        expect(toTitles(jsonData.items)).toEqual(['a', 'b']);
        expect(save).not.toHaveBeenCalled();
    });
});

describe('duplicating a playlist entry', () => {
    test('the copy lands right below the original and carries its presets', async () => {
        const { playlist, jsonData } = genPlaylist([
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

        expect(await playlist.duplicateItemAtIndex(1)).toBe(true);

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
        const { playlist, jsonData } = genPlaylist([genColorItem('a')]);

        await playlist.duplicateItemAtIndex(0);
        // Sharing one object between two slots would make every later per-entry
        // setter hit both rows at once.
        expect(jsonData.items[1]).not.toBe(jsonData.items[0]);

        await playlist.setItemColorNote(1, '#00ff00');

        expect(jsonData.items[1].colorNote).toBe('#00ff00');
        expect(jsonData.items[0].colorNote).toBeUndefined();
    });

    test('an out-of-range index writes nothing', async () => {
        const { playlist, jsonData, save } = genPlaylist([genColorItem('a')]);

        expect(await playlist.duplicateItemAtIndex(3)).toBe(false);

        expect(jsonData.items).toHaveLength(1);
        expect(save).not.toHaveBeenCalled();
    });
});
