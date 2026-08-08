// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES — see the note in `presentingFlowScreenIds.test.ts`.
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
const { toPresentingFlowRowDropKind } = await import('./presentingFlowHelpers');
const { showSimpleToast } = await import('../toast/toastHelpers');
const { resolveCcScreenIds } = await import('./presentingFlowCcHelpers');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-05',
};

let instanceCount = 0;

/** The file layer stubbed on the instance, as `presentingFlowScreenIds.test.ts` does. */
function genPresentingFlow(items: any[]) {
    instanceCount += 1;
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/cc-${instanceCount}.owpf`,
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

function genItem(json: any) {
    return new (PresentingFlowItem as any)(
        '/presenting-flows/a.owpf',
        json,
    ) as InstanceType<typeof PresentingFlowItem>;
}

const MARQUEE = {
    uuid: 'u-marquee',
    type: 'foreground',
    data: { target: 'marquee-top', data: { text: 'Welcome' } },
    title: 'Marquee Top',
};

/** Point one entry at another — what the attach paths write. */
function ccRef(uuid: string, screenIds?: number[]) {
    return screenIds === undefined ? { uuid } : { uuid, screenIds };
}

describe('a presenting flow entry’s identity', () => {
    test('everything added carries one, and a duplicate is re-keyed', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([]);
        await presentingFlow.addActionItem('clear-all');
        const [first] = jsonData.items as any[];
        expect(typeof first.uuid).toBe('string');
        expect(first.uuid.length).toBeGreaterThan(0);

        await presentingFlow.duplicateItemAtIndex(0);
        const [, copy] = jsonData.items as any[];
        // Another line of the run sheet: what pointed at the original must go
        // on pointing at the original.
        expect(copy.uuid).not.toBe(first.uuid);
        expect(copy.data).toBe(first.data);
    });

    test('an entry written before uuids existed gets one when pointed at', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            { type: 'bg-color', data: '#fff', title: '#fff' },
            { type: 'bg-color', data: '#000', title: '#000' },
        ]);
        expect('uuid' in jsonData.items[0]).toBe(false);

        await presentingFlow.addItemCcFromItemIndex(
            1,
            null,
            presentingFlow.filePath,
            0,
        );
        // Minted only because something now points at it — reading the sheet
        // never rewrites a file.
        const uuid = (jsonData.items[0] as any).uuid;
        expect(typeof uuid).toBe('string');
        expect(jsonData.items[1].ccItems).toEqual([{ uuid }]);
    });
});

describe('what a CC element stores', () => {
    test('a reference and its own pin, never a copy of the payload', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            MARQUEE,
            { uuid: 'u-host', type: 'bg-color', data: '#fff', title: '#fff' },
        ]);

        await presentingFlow.addItemCcFromItemIndex(
            1,
            null,
            presentingFlow.filePath,
            0,
        );
        expect(jsonData.items[1].ccItems).toEqual([{ uuid: 'u-marquee' }]);

        await presentingFlow.setItemCcItemScreenIds(1, null, 0, [2, 1]);
        expect(jsonData.items[1].ccItems).toEqual([
            { uuid: 'u-marquee', screenIds: [2, 1] },
        ]);
        // Cleared means "follow the element, then the host", not "go nowhere".
        await presentingFlow.setItemCcItemScreenIds(1, null, 0, []);
        expect(jsonData.items[1].ccItems).toEqual([{ uuid: 'u-marquee' }]);
    });

    test('it is read back off the element, so editing the element edits it', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                uuid: 'u-timeout',
                type: 'action',
                data: 'next-timeout',
                actionNumber: 3,
            },
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-timeout')],
            },
        ]);

        expect(
            (await presentingFlow.getItems())![1].ccItems[0].actionNumber,
        ).toBe(3);
        // Re-arm the ELEMENT and every follower of it is re-armed with it —
        // the whole reason a CC is a reference rather than a copy.
        await presentingFlow.setItemActionArming(0, { actionNumber: 7 });
        const ccItem = (await presentingFlow.getItems())![1].ccItems[0];
        expect(ccItem.actionNumber).toBe(7);
        expect(ccItem.title).toContain('7');
    });

    test('what belongs to being an ELEMENT is left behind', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                uuid: 'u-slide',
                type: 'slide',
                filePath: '/docs/a.ows',
                id: 3,
                title: 'a #3',
                screenIds: [2],
                // Parking takes a LINE out of the run, and a CC is not a line
                // of the run — so a parked element gives a follower in play.
                isDisabled: true,
                slideScreenIds: { '7': [1] },
                disabledSlideIds: [7],
                ccItems: [ccRef('u-marquee')],
            },
            MARQUEE,
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-slide')],
            },
        ]);

        const ccItem = (await presentingFlow.getItems())![2].ccItems[0];
        expect(ccItem.isDisabled).toBe(false);
        // One level falls out of it: a reference has no payload for a CC of
        // its own to hang off.
        expect(ccItem.hasCcItems).toBe(false);
        expect(ccItem.hasSlideCcItems).toBe(false);
        // The element's own pin travels; the CC's own would be written over it.
        expect(ccItem.screenIds).toEqual([2]);
        // The element it follows stays parked.
        expect((await presentingFlow.getItems())![0].isDisabled).toBe(true);
    });

    test('a CC’s own pin beats the element’s', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                uuid: 'u-color',
                type: 'bg-color',
                data: '#000',
                title: '#000',
                screenIds: [2],
            },
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-color', [1])],
            },
        ]);
        expect(
            (await presentingFlow.getItems())![1].ccItems[0].screenIds,
        ).toEqual([1]);
    });
});

describe('a reference that answers to nothing', () => {
    test('removing an element takes its followers with it', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            MARQUEE,
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
                ccItems: [ccRef('u-marquee')],
                slideCcItems: { '7': [ccRef('u-marquee')] },
            },
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-marquee')],
            },
        ]);

        await presentingFlow.removeItemAtIndex(0);
        // Nothing is left naming a line that is not in the sheet — the empty
        // keys go with the last reference, as every other list here does.
        expect('ccItems' in jsonData.items[0]).toBe(false);
        expect('slideCcItems' in jsonData.items[0]).toBe(false);
        expect('ccItems' in jsonData.items[1]).toBe(false);
    });

    test('a hand-edited one is simply not drawn, and the host survives', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-gone'), ccRef('u-marquee')],
            },
            MARQUEE,
        ]);
        const item = (await presentingFlow.getItems())![0];
        expect(item.isError).toBe(false);
        expect(item.ccItems).toHaveLength(1);
        expect(item.ccItems[0].title).toBe('Marquee Top');
    });

    test('a line may not follow itself', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-host')],
            },
        ]);
        // It would fire twice on one click, once as the host and once as its
        // own follower.
        expect((await presentingFlow.getItems())![0].ccItems).toEqual([]);
    });

    test('a nonsense CC list reads as "no CCs" rather than erroring', () => {
        const item = genItem({
            type: 'bg-color',
            data: '#fff',
            ccItems: 'nonsense',
        });
        expect(item.hasCcItems).toBe(false);
        expect(item.ccItems).toEqual([]);
        expect(item.isError).toBe(false);
    });
});

describe('where a CC lands', () => {
    test('its own pin beats the host, and no pin follows the host', () => {
        expect(resolveCcScreenIds([], [2])).toEqual([2]);
        expect(resolveCcScreenIds([3], [2])).toEqual([3]);
        expect(resolveCcScreenIds([], [])).toEqual([]);
    });
});

describe('a document entry’s slides', () => {
    test('its own CCs ride with every one of them', async () => {
        const { presentingFlow } = genPresentingFlow([
            MARQUEE,
            { uuid: 'u-black', type: 'bg-color', data: '#000', title: '#000' },
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
                ccItems: [ccRef('u-marquee')],
                slideCcItems: { '7': [ccRef('u-black')] },
            },
        ]);
        const item = (await presentingFlow.getItems())![2];

        // A document is never presented as a unit, so a CC on the element would
        // otherwise never fire at all.
        expect(
            item.getEffectiveSlideCcItems(7).map((ccItem) => {
                return ccItem.title;
            }),
        ).toEqual(['Marquee Top', '#000']);
        // A slide with none of its own still carries the element's.
        expect(
            item.getEffectiveSlideCcItems(8).map((ccItem) => {
                return ccItem.title;
            }),
        ).toEqual(['Marquee Top']);
        // What is DRAWN under a slide is only its own.
        expect(item.getSlideCcItems(8)).toEqual([]);
    });

    test('a slide’s CC keys itself by slide id, and the map goes with the last one', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            MARQUEE,
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
            },
        ]);

        await presentingFlow.addItemCcFromItemIndex(
            1,
            7,
            presentingFlow.filePath,
            0,
        );
        expect(Object.keys(jsonData.items[1].slideCcItems)).toEqual(['7']);
        const item = (await presentingFlow.getItems())![1];
        expect(item.checkHasSlideCcItems(7)).toBe(true);
        // Its siblings are untouched.
        expect(item.checkHasSlideCcItems(8)).toBe(false);

        await presentingFlow.removeItemCcItemAtIndex(1, 7, 0);
        expect('slideCcItems' in jsonData.items[1]).toBe(false);
    });
});

describe('what may be re-used as a CC', () => {
    test('what belongs to being an element is stripped, the pin is kept', () => {
        expect(
            PresentingFlowItem.resolveCcItemJson({
                uuid: 'u-slide',
                type: 'slide' as any,
                filePath: '/docs/a.ows',
                id: 3,
                title: 'a #3',
                screenIds: [2],
                isDisabled: true,
                slideScreenIds: { '7': [1] },
                disabledSlideIds: [7],
                ccItems: [ccRef('u-marquee')],
                slideCcItems: { '7': [ccRef('u-marquee')] },
            }),
        ).toEqual({
            uuid: 'u-slide',
            type: 'slide',
            filePath: '/docs/a.ows',
            id: 3,
            title: 'a #3',
            screenIds: [2],
        });
    });

    test('what cannot follow anything is refused', () => {
        const base = { title: 'x' };
        expect(
            PresentingFlowItem.resolveCcItemJson({
                ...base,
                type: 'appDocument',
                filePath: '/docs/a.ows',
            } as any),
        ).toBeNull();
        expect(
            PresentingFlowItem.resolveCcItemJson({
                ...base,
                type: 'bg-audio',
                data: '/audio/a.mp3',
            } as any),
        ).toBeNull();
        expect(
            PresentingFlowItem.resolveCcItemJson({
                ...base,
                type: 'error',
            } as any),
        ).toBeNull();
        // A `Jump to` NAMES a line rather than following it, so a document —
        // which can never be a follower — is exactly what it is usually aimed at.
        expect(
            PresentingFlowItem.resolveCcItemJson(
                {
                    ...base,
                    type: 'appDocument',
                    filePath: '/docs/a.ows',
                } as any,
                true,
            ),
        ).not.toBeNull();
    });
});

describe('attaching a CC', () => {
    test('a listed element is attached by index, whatever kind it is', async () => {
        // The drag path for the kinds that carry NO payload of their own: an
        // action is not even a drag type, and a slide and a document both refuse
        // `dragSerialize`. Dropping one on a slide row used to do nothing at all.
        const { presentingFlow, jsonData } = genPresentingFlow([
            { uuid: 'u-bible', type: 'action', data: 'clear-bible' },
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
            },
            {
                uuid: 'u-slide',
                type: 'slide',
                filePath: '/docs/a.ows',
                id: 3,
                title: 'a #3',
            },
        ]);

        expect(
            await presentingFlow.addItemCcFromItemIndex(
                1,
                4,
                presentingFlow.filePath,
                0,
            ),
        ).toBe(true);
        expect(jsonData.items[1].slideCcItems['4']).toEqual([
            { uuid: 'u-bible' },
        ]);

        // A slide too, by the same route — and nothing is appended, since both
        // are already lines of this sheet.
        await presentingFlow.addItemCcFromItemIndex(
            1,
            4,
            presentingFlow.filePath,
            2,
        );
        expect(jsonData.items[1].slideCcItems['4']).toHaveLength(2);
        expect(jsonData.items).toHaveLength(3);
    });

    test('a payload from OUTSIDE becomes a line of the sheet first', async () => {
        // The rule the whole design rests on: a CC always has an element of its
        // own to follow, so a dropped payload is appended at the bottom and the
        // CC then points at it.
        const { presentingFlow, jsonData } = genPresentingFlow([
            { uuid: 'u-host', type: 'bg-color', data: '#fff', title: '#fff' },
        ]);

        expect(
            await presentingFlow.addItemCcFromDroppedData(
                0,
                null,
                { type: 'bg-color' as any, item: '#123456' },
                { type: 'bg-color' as any, data: '#123456' },
            ),
        ).toBe(true);
        expect(jsonData.items).toHaveLength(2);
        const appended = jsonData.items[1] as any;
        expect(appended.data).toBe('#123456');
        expect(jsonData.items[0].ccItems).toEqual([{ uuid: appended.uuid }]);
    });

    test('a refused payload appends nothing at all', async () => {
        const { presentingFlow, jsonData, save } = genPresentingFlow([
            { uuid: 'u-host', type: 'bg-color', data: '#fff', title: '#fff' },
        ]);

        // Audio is played from its own panel, so following one to a screen
        // would promise something nothing delivers.
        expect(
            await presentingFlow.addItemCcFromDroppedData(
                0,
                null,
                { type: 'bg-audio' as any, item: { src: '/audio/a.mp3' } },
                { type: 'bg-audio' as any, data: '/audio/a.mp3' },
            ),
        ).toBe(false);
        expect(jsonData.items).toHaveLength(1);
        expect('ccItems' in jsonData.items[0]).toBe(false);
        expect(save).not.toHaveBeenCalled();
    });

    test('a row of ANOTHER sheet is copied in as a line of this one', async () => {
        const { presentingFlow: other } = genPresentingFlow([
            { uuid: 'u-other', type: 'bg-color', data: '#abc', title: '#abc' },
        ]);
        const { presentingFlow, jsonData } = genPresentingFlow([
            { uuid: 'u-host', type: 'bg-color', data: '#fff', title: '#fff' },
        ]);

        expect(
            await presentingFlow.addItemCcFromItemIndex(
                0,
                null,
                other.filePath,
                0,
            ),
        ).toBe(true);
        expect(jsonData.items).toHaveLength(2);
        const appended = jsonData.items[1] as any;
        expect(appended.data).toBe('#abc');
        // A uuid is an identity WITHIN one sheet, so the copy gets its own.
        expect(appended.uuid).not.toBe('u-other');
        expect(jsonData.items[0].ccItems).toEqual([{ uuid: appended.uuid }]);
    });

    test('attaching by index refuses what cannot follow, and a stale index', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
            },
            {
                uuid: 'u-audio',
                type: 'bg-audio',
                data: '/audio/a.mp3',
                title: 'a.mp3',
            },
            { uuid: 'u-host', type: 'bg-color', data: '#fff', title: '#fff' },
        ]);

        // A document and an audio track reach no screen, so following one there
        // would promise nothing.
        expect(
            await presentingFlow.addItemCcFromItemIndex(
                2,
                null,
                presentingFlow.filePath,
                0,
            ),
        ).toBe(false);
        expect(
            await presentingFlow.addItemCcFromItemIndex(
                2,
                null,
                presentingFlow.filePath,
                1,
            ),
        ).toBe(false);
        // The presenting flow may have been edited between the drag and the drop.
        expect(
            await presentingFlow.addItemCcFromItemIndex(
                2,
                null,
                presentingFlow.filePath,
                9,
            ),
        ).toBe(false);
        expect('ccItems' in jsonData.items[2]).toBe(false);
        expect(jsonData.items).toHaveLength(3);
    });

    test('an out-of-range host or CC writes nothing at all', async () => {
        const { presentingFlow, jsonData, save } = genPresentingFlow([
            MARQUEE,
            {
                uuid: 'u-host',
                type: 'bg-color',
                data: '#fff',
                title: '#fff',
                ccItems: [ccRef('u-marquee')],
            },
        ]);
        const before = JSON.stringify(jsonData.items);

        expect(
            await presentingFlow.addItemCcFromItemIndex(
                3,
                null,
                presentingFlow.filePath,
                0,
            ),
        ).toBe(false);
        expect(await presentingFlow.removeItemCcItemAtIndex(1, null, 5)).toBe(
            false,
        );
        expect(await presentingFlow.moveItemCcItemToIndex(1, null, 5, 0)).toBe(
            false,
        );
        expect(
            await presentingFlow.setItemCcItemScreenIds(1, null, 5, [1]),
        ).toBe(false);

        expect(JSON.stringify(jsonData.items)).toBe(before);
        // "Wrote nothing" is half of what the guard promises.
        expect(save).not.toHaveBeenCalled();
    });

    test('CCs are reordered within their host', async () => {
        const genColor = (uuid: string, title: string) => {
            return { uuid, type: 'bg-color', data: title, title };
        };
        const { presentingFlow, jsonData } = genPresentingFlow([
            genColor('u-a', 'a'),
            genColor('u-b', 'b'),
            genColor('u-c', 'c'),
            {
                uuid: 'u-host',
                type: 'slide',
                filePath: '/docs/a.ows',
                id: 1,
                title: 'a #1',
                ccItems: [ccRef('u-a'), ccRef('u-b'), ccRef('u-c')],
            },
        ]);

        await presentingFlow.moveItemCcItemToIndex(3, null, 2, 0);
        expect(jsonData.items[3].ccItems).toEqual([
            { uuid: 'u-c' },
            { uuid: 'u-a' },
            { uuid: 'u-b' },
        ]);
    });

    test('duplicating an entry carries the references it HOLDS', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            MARQUEE,
            {
                uuid: 'u-doc',
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
                ccItems: [ccRef('u-marquee')],
                slideCcItems: { '7': [ccRef('u-marquee')] },
            },
        ]);

        await presentingFlow.duplicateItemAtIndex(1);
        expect(jsonData.items).toHaveLength(3);
        expect(jsonData.items[2].ccItems).toHaveLength(1);
        expect(jsonData.items[2].slideCcItems['7']).toHaveLength(1);

        // Editing the copy must not reach back into the original — the whole
        // point of duplicating rather than adding the same file again.
        await presentingFlow.removeItemCcItemAtIndex(2, null, 0);
        expect(jsonData.items[1].ccItems).toHaveLength(1);
        expect('ccItems' in jsonData.items[2]).toBe(false);
    });
});

describe('what a drag onto an element row does', () => {
    // A 30px row: its bands are 7px at each end, its middle is the rest.
    function genEvent(offsetY: number, modifiers: any = {}) {
        return {
            ...modifiers,
            clientY: 100 + offsetY,
            currentTarget: {
                getBoundingClientRect: () => ({ top: 100, height: 30 }),
            },
        };
    }

    test('the edges take the position and the middle attaches', () => {
        expect(toPresentingFlowRowDropKind(genEvent(2), true)).toBe('position');
        expect(toPresentingFlowRowDropKind(genEvent(28), true)).toBe(
            'position',
        );
        expect(toPresentingFlowRowDropKind(genEvent(15), true)).toBe('cc');
    });

    test('a short row keeps a middle to aim at', () => {
        // 12px tall: a fixed 7px band at each end would leave none.
        const event = {
            clientY: 106,
            currentTarget: {
                getBoundingClientRect: () => ({ top: 100, height: 12 }),
            },
        };
        expect(toPresentingFlowRowDropKind(event, true)).toBe('cc');
    });

    test('Ctrl forces the position and Alt forces the attach', () => {
        // Aimed at the middle, which would attach.
        expect(
            toPresentingFlowRowDropKind(genEvent(15, { ctrlKey: true }), true),
        ).toBe('position');
        expect(
            toPresentingFlowRowDropKind(genEvent(15, { metaKey: true }), true),
        ).toBe('position');
        // Aimed at an edge, which would take the position anyway.
        expect(
            toPresentingFlowRowDropKind(genEvent(2, { altKey: true }), true),
        ).toBe('cc');
        // Both held: the position wins.
        expect(
            toPresentingFlowRowDropKind(
                genEvent(15, { ctrlKey: true, altKey: true }),
                true,
            ),
        ).toBe('position');
    });

    test('a payload from elsewhere attaches by default, Ctrl still lands it', () => {
        // The bands mean nothing for it — dropping on a line has always
        // attached — but Ctrl is the only way to put it anywhere but the end of
        // the sheet, so it must still be honoured.
        expect(toPresentingFlowRowDropKind(genEvent(2), false)).toBe('cc');
        expect(toPresentingFlowRowDropKind(genEvent(15), false)).toBe('cc');
        expect(
            toPresentingFlowRowDropKind(genEvent(15, { ctrlKey: true }), false),
        ).toBe('position');
    });
});

describe('what a host will take as a CC', () => {
    // The two refusals must not be confused with each other: one says "not this
    // element", the other "not another one".
    async function attempt(hostJson: any) {
        vi.mocked(showSimpleToast).mockClear();
        const { presentingFlow, jsonData } = genPresentingFlow([
            MARQUEE,
            hostJson,
        ]);
        const isAdded = await presentingFlow.addItemCcFromItemIndex(
            1,
            null,
            presentingFlow.filePath,
            0,
        );
        return {
            isAdded,
            message: vi.mocked(showSimpleToast).mock.calls[0]?.[1],
            ccCount: (jsonData.items[1] as any).ccItems?.length ?? 0,
        };
    }

    test('a clock accepts NONE and says so', async () => {
        const result = await attempt({
            uuid: 'u-host',
            type: 'action',
            data: 'next-timeout',
            actionNumber: 5,
        });
        expect(result.isAdded).toBe(false);
        expect(result.message).toBe('This element does not accept CC element');
        expect(result.ccCount).toBe(0);
    });

    test('a screen show/hide accepts NONE, while a clear still takes them', async () => {
        // The split is per-action, not per-family: both of these are screen
        // actions, and only the pair that puts the WINDOW up and down refuses a
        // follower.
        for (const actionId of ['screen-show', 'screen-hide']) {
            const result = await attempt({
                uuid: 'u-host',
                type: 'action',
                data: actionId,
            });
            expect(result.isAdded).toBe(false);
            expect(result.message).toBe(
                'This element does not accept CC element',
            );
            expect(result.ccCount).toBe(0);
        }
        const clearResult = await attempt({
            uuid: 'u-host',
            type: 'action',
            data: 'clear-slide',
        });
        expect(clearResult.isAdded).toBe(true);
        expect(clearResult.ccCount).toBe(1);
    });

    test('a screen show/hide may still BE a CC of another line', async () => {
        // The other direction: "put this last slide up AND light the screen" is
        // one click worth having.
        const { presentingFlow, jsonData } = genPresentingFlow([
            {
                uuid: 'u-show',
                type: 'action',
                data: 'screen-show',
                screenIds: [1],
            },
            {
                uuid: 'u-host',
                type: 'slide',
                filePath: '/docs/a.ows',
                id: 3,
                title: 'a #3',
            },
        ]);
        expect(
            await presentingFlow.addItemCcFromItemIndex(
                1,
                null,
                presentingFlow.filePath,
                0,
            ),
        ).toBe(true);
        expect((jsonData.items[1] as any).ccItems).toEqual([
            { uuid: 'u-show' },
        ]);
        const [ccItem] = ((await presentingFlow.getItems()) ?? [])[1].ccItems;
        expect(ccItem.screenAction?.id).toBe('screen-show');
        // It takes the SCREEN it names with it: a follower of this one may not
        // ride whatever screens its host happened to resolve to.
        expect(ccItem.screenIds).toEqual([1]);
    });

    test('a Jump to takes one, and says the OTHER thing about a second', async () => {
        const first = await attempt({
            uuid: 'u-host',
            type: 'action',
            data: 'jump-to',
        });
        expect(first.isAdded).toBe(true);
        expect(first.ccCount).toBe(1);
        const second = await attempt({
            uuid: 'u-host',
            type: 'action',
            data: 'jump-to',
            ccItems: [ccRef('u-other')],
        });
        expect(second.isAdded).toBe(false);
        expect(second.message).toBe('This element takes only one CC element');
        expect(second.ccCount).toBe(1);
    });

    test('content takes as many as it is given', async () => {
        const result = await attempt({
            uuid: 'u-host',
            type: 'slide',
            filePath: '/docs/a.ows',
            id: 3,
            title: 'a #3',
            ccItems: [ccRef('u-x'), ccRef('u-y')],
        });
        expect(result.isAdded).toBe(true);
        expect(result.ccCount).toBe(3);
    });
});
