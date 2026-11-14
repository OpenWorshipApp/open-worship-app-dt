import { beforeEach, describe, expect, test, vi } from 'vitest';

// EC-540: an undo of a start put the session's settings back and left its
// countdown on the wall. These are the screens' half of the fix.
const { state } = vi.hoisted(() => ({
    state: {
        isPagePresenter: true,
        managers: [] as any[],
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return state.isPagePresenter;
        },
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => state.managers,
    getScreenManagerByScreenId: (screenId: number) =>
        state.managers.find((manager) => manager.screenId === screenId) ?? null,
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {
        // The real one revives a countdown's `dateTime` the same way.
        parseAllForegroundData: (data: any) => ({
            countdownDataList: (data.countdownDataList ?? []).map(
                (item: any) => ({ ...item, dateTime: new Date(item.dateTime) }),
            ),
            messageDataList: data.messageDataList ?? [],
        }),
    },
}));

import {
    applyScreenRestore,
    captureForegroundLists,
    captureWidgetScreens,
    checkScreenRestores,
    diffCapturedForeground,
    diffWidgetScreens,
    snapshotScreenRestore,
    toForegroundListKey,
} from './agentScreenRestoreHelpers';

function genManager(
    screenId: number,
    countdownDataList: any[],
    options: { isLocked?: boolean; isDeleted?: boolean } = {},
) {
    const foregroundData: any = { countdownDataList, messageDataList: [] };
    const setCountdownList = vi.fn((list: any[]) => {
        foregroundData.countdownDataList = list;
    });
    // The text layer a Bible passage and a Long Text Show share (EC-550).
    const screenLongTextManager: any = {
        screenViewData: null,
        applyFullDataSrcWithSyncGroup: vi.fn((data: any) => {
            screenLongTextManager.screenViewData = data;
        }),
    };
    return {
        screenId,
        isLocked: options.isLocked ?? false,
        isDeleted: options.isDeleted ?? false,
        setCountdownList,
        screenForegroundManager: {
            foregroundData,
            setterMap: new Map([['countdownDataList', setCountdownList]]),
        },
        screenLongTextManager,
    };
}

const slot = {
    type: 'screen-foreground' as const,
    screenId: 0,
    listKey: 'countdownDataList',
    itemKey: 's9',
    items: [] as unknown[],
    foreground: 'countdown',
};

beforeEach(() => {
    state.isPagePresenter = true;
    state.managers = [];
});

describe('the list a component is held in', () => {
    test('is its own, and a Long Text Show has none: it is in the text layer', () => {
        expect(toForegroundListKey('countdown')).toBe('countdownDataList');
        expect(toForegroundListKey('time')).toBe('timeDataList');
        expect(toForegroundListKey('long-text')).toBeNull();
    });
});

describe('a show, read around it', () => {
    test('names the slot it filled on each live screen, and no other', () => {
        const other = { id: 'other', dateTime: new Date(0) };
        state.managers = [
            genManager(0, [other]),
            genManager(1, [], { isDeleted: true }),
        ];
        const beforeList = captureForegroundLists('countdownDataList');
        state.managers[0].screenForegroundManager.foregroundData.countdownDataList =
            [other, { id: 's9', dateTime: new Date(5000) }];

        expect(
            diffCapturedForeground(
                'countdown',
                'countdownDataList',
                beforeList,
            ),
        ).toEqual([slot]);
    });

    test('is kept as JSON, apart from the live objects', () => {
        const item = { id: 's9', dateTime: new Date(0) };
        state.managers = [genManager(0, [item])];
        const [captured] = captureForegroundLists('countdownDataList');
        expect(captured.items).toEqual([
            { id: 's9', dateTime: '1970-01-01T00:00:00.000Z' },
        ]);
        expect(captured.items[0]).not.toBe(item);
    });
});

describe('putting a slot back', () => {
    test('takes the overlay a start put up off, leaving the rest', async () => {
        const other = { id: 'other' };
        const manager = genManager(0, [other, { id: 's9' }]);
        state.managers = [manager];

        await applyScreenRestore(slot);

        expect(manager.setCountdownList).toHaveBeenCalledTimes(1);
        const [list] = manager.setCountdownList.mock.calls[0];
        expect(list).toEqual([other]);
        expect(list[0]).toBe(other);
    });

    test('puts back what a show replaced, its time a Date again', async () => {
        const manager = genManager(0, [{ id: 's9', text: 'new' }]);
        state.managers = [manager];

        await applyScreenRestore({
            ...slot,
            items: [{ id: 's9', dateTime: '1970-01-01T00:00:05.000Z' }],
        });

        const [list] = manager.setCountdownList.mock.calls[0];
        expect(list).toEqual([{ id: 's9', dateTime: new Date(5000) }]);
    });

    test('a screen that is gone has nothing to take off', async () => {
        const manager = genManager(0, [{ id: 's9' }], { isDeleted: true });
        state.managers = [manager];

        await applyScreenRestore(slot);

        expect(manager.setCountdownList).not.toHaveBeenCalled();
    });

    test('keeps what the slot holds now, so an undo of the undo puts it up', () => {
        state.managers = [
            genManager(0, [
                { id: 'other' },
                { id: 's9', dateTime: new Date(0) },
            ]),
        ];

        expect(snapshotScreenRestore(slot)).toEqual({
            ...slot,
            items: [{ id: 's9', dateTime: '1970-01-01T00:00:00.000Z' }],
        });
    });
});

describe('an undo that changes a screen', () => {
    test('is asked nothing when no screen is in it', () => {
        state.isPagePresenter = false;
        expect(
            checkScreenRestores([
                { type: 'app-setting', key: 'k', text: null },
            ]),
        ).toBeNull();
    });

    test('runs only on the Presenter page', () => {
        state.isPagePresenter = false;
        state.managers = [genManager(0, [])];
        expect(checkScreenRestores([slot])).toMatch(
            /Switch it to the Presenter, then undo again\. Nothing was changed\.$/,
        );
    });

    test('is refused by a locked screen, named', () => {
        state.managers = [
            genManager(0, [], { isLocked: true }),
            genManager(1, []),
        ];
        expect(checkScreenRestores([slot, { ...slot, screenId: 1 }])).toMatch(
            /^Screen 0 is locked, so it refuses a change\./,
        );
    });

    test('runs when every screen in it can be changed', () => {
        state.managers = [genManager(0, [])];
        expect(checkScreenRestores([slot])).toBeNull();
    });

    // owa_screen_edit's restores: a locked screen's card still takes its
    // group, display, transitions and tick, and refuses Line Sync and a layer.
    test("lets a locked screen's other controls go back", () => {
        state.managers = [genManager(0, [], { isLocked: true })];
        expect(
            checkScreenRestores([
                {
                    type: 'screen-setting',
                    field: 'transition',
                    screenId: 0,
                    target: 'background',
                    value: 'fade',
                },
                {
                    type: 'screen-setting',
                    field: 'group',
                    screenId: 0,
                    value: null,
                },
                { type: 'screen-setting', field: 'style', value: {} },
            ]),
        ).toBeNull();
        expect(
            checkScreenRestores([
                {
                    type: 'screen-setting',
                    field: 'line-sync',
                    screenId: 0,
                    value: false,
                },
            ]),
        ).toMatch(/^Screen 0 is locked/);
        expect(
            checkScreenRestores([
                {
                    type: 'screen-layer',
                    screenId: 0,
                    layer: 'background',
                    data: null,
                    expect: '',
                },
            ]),
        ).toMatch(/^Screen 0 is locked/);
    });

    test('is not refused by a lock the same undo takes off', () => {
        state.managers = [genManager(0, [], { isLocked: true })];
        expect(
            checkScreenRestores([
                {
                    type: 'screen-layer',
                    screenId: 0,
                    layer: 'background',
                    data: null,
                    expect: '',
                },
                {
                    type: 'screen-setting',
                    field: 'lock',
                    screenId: 0,
                    value: false,
                },
            ]),
        ).toBeNull();
    });
});

// EC-550: an undo of a Long Text Show's start left its text on the wall.
describe("a Long Text Show's text layer", () => {
    const longText = (sourceId: string, scroll = 0) => ({
        type: 'long-text',
        locale: 'en',
        longTextData: { sourceId, renderedList: [] },
        scroll,
        selectedKJVVerseKey: null,
    });
    const verse = {
        type: 'bible-item',
        locale: 'en',
        bibleItemData: {
            renderedList: [],
            bibleItem: { bibleKey: 'KJV', target: { bookKey: 'JHN' } },
        },
        scroll: 0,
        selectedKJVVerseKey: null,
    };
    const textSlot = {
        type: 'screen-text' as const,
        screenId: 0,
        data: verse as unknown,
        expect: 'long-text:long-text',
        foreground: 'long-text',
    };

    test('a start is read around it in the layer, and only where it changed', () => {
        state.managers = [genManager(0, []), genManager(1, [])];
        state.managers[0].screenLongTextManager.screenViewData = verse;
        const captured = captureWidgetScreens('long-text');
        state.managers[0].screenLongTextManager.screenViewData =
            longText('long-text');

        expect(diffWidgetScreens('long-text', captured)).toEqual([textSlot]);
        // A component in a list is read in its list, as before.
        expect(captureWidgetScreens('countdown')).toEqual({
            listKey: 'countdownDataList',
            beforeList: [
                { screenId: 0, items: [] },
                { screenId: 1, items: [] },
            ],
        });
        expect(diffWidgetScreens('long-text', null)).toEqual([]);
    });

    test('an undo puts the verse back where the text it replaced is', async () => {
        const manager = genManager(0, []);
        // Scrolled since: still that text.
        manager.screenLongTextManager.screenViewData = longText(
            'long-text',
            120,
        );
        state.managers = [manager];

        await applyScreenRestore(textSlot);

        expect(
            manager.screenLongTextManager.applyFullDataSrcWithSyncGroup,
        ).toHaveBeenCalledWith(verse);
        expect(manager.screenLongTextManager.screenViewData).not.toBe(
            textSlot.data,
        );
    });

    test('takes the text off a layer that held nothing', async () => {
        const manager = genManager(0, []);
        manager.screenLongTextManager.screenViewData = longText('long-text');
        state.managers = [manager];

        await applyScreenRestore({ ...textSlot, data: null });

        expect(manager.screenLongTextManager.screenViewData).toBeNull();
    });

    test('leaves a verse or another text put up since', async () => {
        const manager = genManager(0, []);
        state.managers = [manager];
        for (const now of [verse, longText('long-text-s2'), null]) {
            manager.screenLongTextManager.screenViewData = now;
            await applyScreenRestore({ ...textSlot, data: null });
            expect(manager.screenLongTextManager.screenViewData).toBe(now);
        }
        expect(
            manager.screenLongTextManager.applyFullDataSrcWithSyncGroup,
        ).not.toHaveBeenCalled();
    });

    test('keeps what the layer holds now, so an undo of the undo puts the text up', async () => {
        const manager = genManager(0, []);
        manager.screenLongTextManager.screenViewData = longText(
            'long-text',
            40,
        );
        state.managers = [manager];

        // Over the verse this undo puts back, and over nothing else.
        const redo = snapshotScreenRestore(textSlot);
        expect(redo).toEqual({
            ...textSlot,
            data: longText('long-text', 40),
            expect: 'bible:{"bibleKey":"KJV","target":{"bookKey":"JHN"}}',
        });

        await applyScreenRestore(textSlot);
        await applyScreenRestore(redo);
        expect(manager.screenLongTextManager.screenViewData).toEqual(
            longText('long-text', 40),
        );
    });

    test('is refused by a locked screen, before anything', () => {
        state.managers = [genManager(0, [], { isLocked: true })];
        expect(checkScreenRestores([textSlot])).toMatch(
            /^Screen 0 is locked, so it refuses a change\./,
        );
        state.isPagePresenter = false;
        expect(checkScreenRestores([textSlot])).toMatch(
            /Switch it to the Presenter/,
        );
    });
});

// EC-630: an undo of a screen added takes it away only while nothing has
// been done with it.
describe('a screen added, taken away again', () => {
    function genAddedScreen(
        options: {
            isShowing?: boolean;
            holds?: string;
            isLocked?: boolean;
        } = {},
    ) {
        const genLayer = (name: string) => {
            return { isShowing: options.holds === name };
        };
        return {
            screenId: 2,
            isDeleted: false,
            isLocked: options.isLocked ?? false,
            isShowing: options.isShowing ?? false,
            screenBackgroundManager: genLayer('background'),
            screenVaryAppDocumentManager: genLayer('slide'),
            screenLongTextManager: genLayer('bible'),
            screenForegroundManager: genLayer('foreground'),
            screenDrawManager: genLayer('drawing'),
        };
    }
    const added = {
        type: 'screen-presence' as const,
        screenId: 2,
        present: false,
    };

    test('goes while it is off, unlocked and empty, or is gone already', () => {
        state.managers = [genAddedScreen()];
        expect(checkScreenRestores([added])).toBeNull();
        state.managers = [];
        expect(checkScreenRestores([added])).toBeNull();
        // Putting one back is never refused.
        expect(checkScreenRestores([{ ...added, present: true }])).toBeNull();
    });

    test('stays once it is on, holds anything or is locked, named', () => {
        state.managers = [genAddedScreen({ isShowing: true })];
        expect(checkScreenRestores([added])).toMatch(
            /^Screen 2 has been turned on since it was added, .*Delete in its Mini Screen card's menu\. Nothing was changed\.$/,
        );
        for (const holds of [
            'background',
            'slide',
            'bible',
            'foreground',
            'drawing',
        ]) {
            state.managers = [genAddedScreen({ holds })];
            expect(checkScreenRestores([added]), holds).toMatch(
                /^Screen 2 holds something since it was added, so the undo leaves it: clear it first/,
            );
        }
        state.managers = [genAddedScreen({ isLocked: true })];
        expect(checkScreenRestores([added])).toMatch(
            /^Screen 2 is locked, so it refuses a change\./,
        );
    });

    test('is taken away only from the Presenter page', () => {
        state.isPagePresenter = false;
        state.managers = [genAddedScreen()];
        expect(checkScreenRestores([added])).toMatch(
            /Switch it to the Presenter, then undo again\./,
        );
    });
});
