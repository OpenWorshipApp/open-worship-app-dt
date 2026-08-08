// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES: modules further down the graph subclass them, and a
// plain object throws "Class extends value is not a constructor" at import time —
// the same trap `presentingFlowArchiveHelpers.test.ts` documents.
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

const {
    applyPresentingFlowMediaControlPause,
    toPresentingFlowMediaControl,
    toPresentingFlowMediaControlPauseKind,
    toPresentingFlowMediaControlSummary,
} = await import('./presentingFlowMediaControlHelpers');
const { intersectCcScreenIds } = await import('./presentingFlowCcHelpers');
const { default: PresentingFlowItem } = await import('./PresentingFlowItem');
const { default: PresentingFlow } = await import('./PresentingFlow');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-08',
};

// `PresentingFlow.getInstance` caches by path, so each case needs its own.
let instanceCount = 0;

function genPresentingFlow(items: any[]) {
    instanceCount += 1;
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/media-control-${instanceCount}.owpf`,
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

function genSlideItem() {
    return {
        type: 'slide',
        uuid: 'host-uuid',
        filePath: '/documents/song.owdoc',
        id: 3,
        data: { filePath: '/documents/song.owdoc', id: 3 },
        title: 'song #3',
    };
}

describe('reading a media control config', () => {
    test('an unusable mode is the only thing that answers null', () => {
        expect(toPresentingFlowMediaControl(null)).toBe(null);
        expect(toPresentingFlowMediaControl('play')).toBe(null);
        expect(toPresentingFlowMediaControl({})).toBe(null);
        expect(toPresentingFlowMediaControl({ mode: 'rewind' })).toBe(null);
        expect(toPresentingFlowMediaControl({ mode: 'play' })).toEqual({
            mode: 'play',
        });
    });

    test('a garbage field is dropped and the rest of the config still runs', () => {
        expect(
            toPresentingFlowMediaControl({
                mode: 'play',
                delaySecond: 'soon',
                startAtSecond: -5,
                volume: 500,
                speed: 0,
                pauseAfterSecond: 60,
            }),
        ).toEqual({ mode: 'play', pauseAfterSecond: 60 });
    });

    test('the two pause fields are read as alternatives, media time winning', () => {
        expect(
            toPresentingFlowMediaControl({
                mode: 'play',
                pauseAfterSecond: 60,
                pauseAtSecond: 70,
            }),
        ).toEqual({ mode: 'play', pauseAtSecond: 70 });
    });

    test('writing one pause field deletes the other', () => {
        const atConfig = applyPresentingFlowMediaControlPause(
            { mode: 'play', pauseAfterSecond: 60 },
            'at',
            70,
        );
        expect(atConfig).toEqual({ mode: 'play', pauseAtSecond: 70 });
        expect(toPresentingFlowMediaControlPauseKind(atConfig)).toBe('at');

        const afterConfig = applyPresentingFlowMediaControlPause(
            atConfig,
            'after',
            30,
        );
        expect(afterConfig).toEqual({ mode: 'play', pauseAfterSecond: 30 });
        expect(toPresentingFlowMediaControlPauseKind(afterConfig)).toBe(
            'after',
        );

        const noneConfig = applyPresentingFlowMediaControlPause(
            afterConfig,
            'none',
            0,
        );
        expect(noneConfig).toEqual({ mode: 'play' });
        expect(toPresentingFlowMediaControlPauseKind(noneConfig)).toBe('none');
    });

    test('the row summary is numbers only, so nothing of it reaches a tran key', () => {
        expect(
            toPresentingFlowMediaControlSummary({
                mode: 'play',
                delaySecond: 3,
                startAtSecond: 10,
                pauseAtSecond: 70,
                volume: 70,
                speed: 2,
            }),
        ).toBe('+3s 10s→70s 70% 2x');
        expect(toPresentingFlowMediaControlSummary({ mode: 'pause' })).toBe('');
    });
});

describe('a media control pin narrows its host instead of redirecting it', () => {
    test('no pin follows the host, a pin intersects it', () => {
        expect(intersectCcScreenIds([], [1, 2])).toEqual([1, 2]);
        expect(intersectCcScreenIds([2], [1, 2])).toEqual([2]);
        // The whole point: a pin naming a screen the host never reached names a
        // screen with no media on it, so it runs nowhere rather than everywhere.
        expect(intersectCcScreenIds([3], [1, 2])).toEqual([]);
    });

    test('the registry says which reading each screen action takes', () => {
        const genScreenAction = (actionId: any) => {
            return PresentingFlowItem.fromJson(
                '/presenting-flows/flags.owpf',
                PresentingFlowItem.fromActionId(actionId),
            ).screenAction;
        };
        expect(
            genScreenAction('slide-media-control')?.filtersHostScreenIds,
        ).toBe(true);
        expect(genScreenAction('clear-all')?.filtersHostScreenIds).toBe(false);
        expect(genScreenAction('screen-show')?.filtersHostScreenIds).toBe(
            false,
        );
        // It must never be offered as a loose line of the sheet.
        expect(genScreenAction('slide-media-control')?.ccItemCount).toBe(0);
    });
});

describe('attaching a media control to a slide host', () => {
    test('the element and the reference to it land in ONE write', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            genSlideItem(),
        ]);

        const isAdded = await presentingFlow.addItemCcAction(
            0,
            null,
            'slide-media-control',
            { mediaControl: { mode: 'play', startAtSecond: 10 } },
        );

        expect(isAdded).toBe(true);
        expect(jsonData.items).toHaveLength(2);
        const [host, action] = jsonData.items as any[];
        expect(action.type).toBe('action');
        expect(action.data).toBe('slide-media-control');
        // The settings belong to the ATTACHMENT, never to the element.
        expect(action.mediaControl).toBeUndefined();
        expect(host.ccItems).toEqual([
            {
                uuid: action.uuid,
                mediaControl: { mode: 'play', startAtSecond: 10 },
            },
        ]);
    });

    test('the resolved CC reads the settings the attachment holds', async () => {
        const { presentingFlow } = genPresentingFlow([genSlideItem()]);
        await presentingFlow.addItemCcAction(0, null, 'slide-media-control', {
            mediaControl: { mode: 'play', startAtSecond: 10, speed: 2 },
        });

        const items = (await presentingFlow.getItems()) ?? [];
        const [ccItem] = items[0].ccItems;
        expect(ccItem.mediaControl).toEqual({
            mode: 'play',
            startAtSecond: 10,
            speed: 2,
        });
        // The listed element has none, which is why clicking it does nothing.
        expect(items[1].mediaControl).toBe(null);
        // And the row says what it will do, mode first.
        expect(ccItem.title).toBe('Slide: Media Control (Play 10s 2x)');
    });

    test('the same controller attached twice means two different things', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            genSlideItem(),
            { ...genSlideItem(), uuid: 'host-uuid-2', id: 4 },
        ]);
        await presentingFlow.addItemCcAction(0, null, 'slide-media-control', {
            mediaControl: { mode: 'play', startAtSecond: 10 },
        });
        const actionUuid = (jsonData.items as any[])[2].uuid;
        // The SECOND host points at the very same element, by uuid.
        await presentingFlow.addItemCcItem(1, null, actionUuid);
        await presentingFlow.setItemCcItemMediaControl(
            1,
            null,
            0,
            {
                mode: 'stop',
            },
            [],
        );

        const items = (await presentingFlow.getItems()) ?? [];
        expect(items[0].ccItems[0].mediaControl).toEqual({
            mode: 'play',
            startAtSecond: 10,
        });
        expect(items[1].ccItems[0].mediaControl).toEqual({ mode: 'stop' });
    });

    test('an element that carries settings by hand-edit is still ignored', async () => {
        const { presentingFlow } = genPresentingFlow([
            { ...genSlideItem(), ccItems: [{ uuid: 'mc-uuid' }] },
            {
                type: 'action',
                uuid: 'mc-uuid',
                data: 'slide-media-control',
                // Not a place the app ever writes, so it must not become a second
                // source of settings competing with the attachment's own.
                mediaControl: { mode: 'stop' },
            },
        ]);

        const items = (await presentingFlow.getItems()) ?? [];
        expect(items[0].ccItems[0].mediaControl).toBe(null);
    });
});

describe('the settings survive every unrelated CC mutation', () => {
    async function genAttached() {
        const { presentingFlow, jsonData } = genPresentingFlow([
            genSlideItem(),
            { type: 'bg-color', uuid: 'bg-uuid', data: '#00FFFF', title: 'bg' },
        ]);
        await presentingFlow.addItemCcAction(0, null, 'slide-media-control', {
            mediaControl: { mode: 'play', pauseAtSecond: 70 },
            screenIds: [2],
        });
        return { presentingFlow, jsonData };
    }

    test('reordering the CCs of a host keeps them', async () => {
        const { presentingFlow, jsonData } = await genAttached();
        await presentingFlow.addItemCcItem(0, null, 'bg-uuid');

        await presentingFlow.moveItemCcItemToIndex(0, null, 0, 1);

        const [host] = jsonData.items as any[];
        expect(host.ccItems).toHaveLength(2);
        expect(host.ccItems[1].mediaControl).toEqual({
            mode: 'play',
            pauseAtSecond: 70,
        });
        expect(host.ccItems[1].screenIds).toEqual([2]);
    });

    test('a duplicated host keeps its controller settings', async () => {
        const { presentingFlow, jsonData } = await genAttached();

        await presentingFlow.duplicateItemAtIndex(0);

        const items = jsonData.items as any[];
        // The copy is re-keyed, but the SETTINGS are per attachment and travel
        // with it — unlike `actionKey`, which must be unique and is dropped.
        expect(items[1].uuid).not.toBe(items[0].uuid);
        expect(items[1].ccItems[0].mediaControl).toEqual({
            mode: 'play',
            pauseAtSecond: 70,
        });
    });

    test('an emptied config deletes the key rather than storing a null', async () => {
        const { presentingFlow, jsonData } = await genAttached();

        await presentingFlow.setItemCcItemMediaControl(0, null, 0, null, []);

        const [host] = jsonData.items as any[];
        expect(host.ccItems[0]).toEqual({ uuid: host.ccItems[0].uuid });
    });
});
