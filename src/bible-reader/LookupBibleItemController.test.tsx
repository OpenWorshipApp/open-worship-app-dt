// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    const settingStore = new Map<string, string>();
    class FakeReadItem {
        _id: number;
        _bibleKey: string;
        _target: any;
        extraBibleKeys: string[] | undefined;
        isAudioEnabled: boolean | undefined;
        constructor(json: any) {
            this._id = json.id;
            this._bibleKey = json.bibleKey;
            this._target = json.target;
            this.extraBibleKeys = json.extraBibleKeys;
            this.isAudioEnabled = json.isAudioEnabled;
        }
        get id() {
            return this._id;
        }
        set id(v: number) {
            this._id = v;
        }
        get bibleKey() {
            return this._bibleKey;
        }
        set bibleKey(v: string) {
            this._bibleKey = v;
        }
        get target() {
            return this._target;
        }
        set target(v: any) {
            this._target = v;
        }
        static fromJson(json: any) {
            return new this(json);
        }
        toJson() {
            return {
                id: this._id,
                bibleKey: this._bibleKey,
                target: this._target,
                extraBibleKeys: this.extraBibleKeys,
                isAudioEnabled: this.isAudioEnabled,
            };
        }
        checkIsSameId(o: any) {
            return this._id === (typeof o === 'number' ? o : o.id);
        }
        async toTitle() {
            return `${this._bibleKey} title`;
        }
        toVerseFullKey() {
            return `VK-${this._id}`;
        }
        async getJumpingChapter(isNext: boolean) {
            return isNext ? { bookKey: 'GEN', chapter: 2 } : null;
        }
    }
    const makeFound = (bibleKey = 'KJV') =>
        new FakeReadItem({ id: -99, bibleKey, target: { chapter: 1 } });
    return {
        settingStore,
        FakeReadItem,
        makeFound,
        getSettingMock: vi.fn((key: string) =>
            settingStore.has(key) ? settingStore.get(key) : null,
        ),
        setSettingMock: vi.fn((key: string, value: string | null) => {
            settingStore.set(key, value ?? '');
        }),
        handleErrorMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        closeCurrentEditingBibleItemMock: vi.fn(),
        genFoundMenuMock: vi.fn(() => [{ menuElement: 'found' }]),
        setBibleLookupInputFocusMock: vi.fn(),
        setBibleSearchingTabTypeMock: vi.fn(),
        tranMock: vi.fn((key: string) => key),
        elementDivider: { __divider: true },
        genIconMock: vi.fn((n: string) => `icon-${n}`),
        genShortcutMock: vi.fn(() => 'shortcut'),
        bibleRenderToTitleMock: vi.fn(async () => 'Rendered Title'),
        unlockingMock: vi.fn(async (_key: string, cb: any) => cb()),
        extractBibleTitleMock: vi.fn(),
        getShouldModelNewLineMock: vi.fn(() => true),
        setShouldModelNewLineMock: vi.fn(),
        genTimeoutAttemptMock: vi.fn(() => (fn: any) => fn()),
        getLangDataFromBibleKeyMock: vi.fn(async () => null),
        cacheStore: new Map<string, any>(),
    };
});

// ---- base BibleItemsViewController leaf deps ----
vi.mock('../event/EventHandler', () => ({
    default: class {
        addPropEvent = vi.fn();
        registerEventListener = vi.fn(() => ['evt']);
        unregisterEventListener = vi.fn();
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: h.tranMock }));
vi.mock('../helper/appHooks', () => ({ useAppEffect: vi.fn() }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSettingMock,
    setSetting: h.setSettingMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: vi.fn(),
}));
vi.mock('../server/appProvider', () => ({ default: { isDev: false } }));
vi.mock('../helper/helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    bringDomToCenterView: vi.fn(),
    bringDomToNearestView: vi.fn(),
    bringDomToTopView: vi.fn(),
}));
vi.mock('../helper/bibleViewHelpers', () => ({
    BIBLE_VIEW_TEXT_CLASS: 'bible-view',
    VERSE_TEXT_CLASS: 'verse-text',
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getShouldModelNewLine: h.getShouldModelNewLineMock,
    setShouldModelNewLine: h.setShouldModelNewLineMock,
    extractBibleTitle: h.extractBibleTitleMock,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: h.elementDivider,
    genContextMenuItemShortcutKey: h.genShortcutMock,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: h.genIconMock,
}));
vi.mock('./ReadIdOnlyBibleItem', () => ({
    ReadIdOnlyBibleItem: h.FakeReadItem,
}));
vi.mock('./readBibleScrollHelpers', () => ({
    checkIsVerseAtBottom: vi.fn(() => false),
    checkIsVersePartialInvisible: vi.fn(() => false),
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromVerseKey: vi.fn(async () => null) },
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: h.genTimeoutAttemptMock,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getLangDataFromBibleKey: h.getLangDataFromBibleKeyMock,
}));

// ---- lookup-specific deps ----
vi.mock('./readBibleHelpers', () => ({
    closeCurrentEditingBibleItem: h.closeCurrentEditingBibleItemMock,
}));
vi.mock('../bible-lookup/selectionHelpers', () => ({
    setBibleLookupInputFocus: h.setBibleLookupInputFocusMock,
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitle: h.bibleRenderToTitleMock },
}));
vi.mock('../others/CacheManager', () => ({
    default: class {
        get = vi.fn(async (key: string) =>
            h.cacheStore.has(key) ? h.cacheStore.get(key) : null,
        );
        set = vi.fn(async (key: string, value: any) => {
            h.cacheStore.set(key, value);
        });
        clear = vi.fn(() => {
            h.cacheStore.clear();
        });
    },
}));
vi.mock('../server/unlockingHelpers', () => ({ unlocking: h.unlockingMock }));
vi.mock('../bible-lookup/bibleActionHelpers', () => ({
    genFoundBibleItemContextMenu: h.genFoundMenuMock,
}));
vi.mock('../bible-find/bibleFindHelpers', () => ({
    setBibleSearchingTabType: h.setBibleSearchingTabTypeMock,
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));

import LookupBibleItemController, {
    closeEventMapper,
    ctrlShiftMetaKeys,
    useLookupBibleItemControllerContext,
} from './LookupBibleItemController';
import {
    BibleItemsViewControllerContext,
    bibleHistoryStore,
} from './BibleItemsViewController';

const { FakeReadItem } = h;

function setDefaultExtract() {
    h.extractBibleTitleMock.mockImplementation(
        async (bibleKey: string, inputText: string, time?: number) => ({
            result: {
                bibleItem: h.makeFound(bibleKey),
                bookKey: 'GEN',
                chapter: 1,
            },
            bibleKey,
            oldInputText: inputText,
            time: time ?? Date.now(),
        }),
    );
}

function genController(suffix = '') {
    return new LookupBibleItemController(suffix);
}

async function flush() {
    await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
    });
}

// A fresh controller's first selection titles the box itself, a moment later.
async function settleFirstSelection(ctl: LookupBibleItemController) {
    ctl.selectedBibleItem;
    await flush();
}

describe('bible-reader LookupBibleItemController', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.settingStore.clear();
        h.cacheStore.clear();
        vi.clearAllMocks();
        h.getShouldModelNewLineMock.mockReturnValue(true);
        h.unlockingMock.mockImplementation(async (_k: string, cb: any) => cb());
        setDefaultExtract();
    });

    test('exports keyboard mappers', () => {
        expect(closeEventMapper.key).toBe('w');
        expect(ctrlShiftMetaKeys.mControlKey).toContain('Meta');
    });

    test('constructor seeds a default editing bible item', () => {
        const ctl = genController();
        expect(ctl.isLookup).toBe(true);
        expect(ctl.straightBibleItems).toHaveLength(1);
        expect(ctl.straightBibleItems[0].bibleKey).toBe('KJV');
    });

    test('getSavedBibleId reads and defaults to -1', () => {
        const ctl = genController();
        expect(ctl.getSavedBibleId()).toBe(-1);
        h.settingStore.set(ctl.toSettingName('-selected-bible-item'), '42');
        expect(ctl.getSavedBibleId()).toBe(42);
    });

    test('selectedBibleItem getter selects the first item by default', () => {
        const ctl = genController();
        const selected = ctl.selectedBibleItem;
        expect(selected).toBeInstanceOf(FakeReadItem);
        expect(ctl.getSavedBibleId()).not.toBe(-1);
        expect(ctl.checkIsBibleItemSelected(selected)).toBe(true);
        expect(ctl.selectedIndex).toBe(0);
    });

    test('inputText getter/setter round-trips through settings', async () => {
        const ctl = genController();
        expect(ctl.inputText).toBe('');
        ctl.inputText = 'Genesis 1:1';
        expect(ctl.inputText).toBe('Genesis 1:1');
        expect(h.setBibleLookupInputFocusMock).toHaveBeenCalled();
        await flush();
    });

    test('getEditingResult caches and syncs found bible item', async () => {
        const ctl = genController();
        ctl.inputText = 'Genesis 1:1';
        const first = await ctl.getEditingResult();
        expect(first.result.bibleItem).not.toBeNull();
        // second call should hit the cache branch
        const second = await ctl.getEditingResult('Genesis 1:1');
        expect(second.result.bibleItem).not.toBeNull();
        await flush();
    });

    test('getEditingResult handles a null found item', async () => {
        h.extractBibleTitleMock.mockResolvedValue({
            result: { bibleItem: null },
            bibleKey: 'KJV',
            oldInputText: 'bad',
            time: Date.now(),
        });
        const ctl = genController();
        const result = await ctl.getEditingResult('bad');
        expect(result.result.bibleItem).toBeNull();
        await flush();
    });

    test('forceReloadEditingResult clears cache and reloads', () => {
        const ctl = genController();
        const reload = vi.fn();
        ctl.reloadEditingResult = reload;
        ctl.forceReloadEditingResult();
        expect(reload).toHaveBeenCalled();
    });

    test('setColorNote syncs by comparing selected colors', async () => {
        const ctl = genController();
        const selected = ctl.selectedBibleItem;
        ctl.setColorNote(selected, 'red');
        expect(ctl.getColorNote(ctl.selectedBibleItem)).toBe('red');
        await flush();
    });

    test('getStraightBibleItemsForExportingMSWord swaps editing item', async () => {
        const ctl = genController();
        // trigger selection so an EditingBibleItem exists in the list
        ctl.selectedBibleItem;
        const items = await ctl.getStraightBibleItemsForExportingMSWord();
        expect(items.length).toBeGreaterThanOrEqual(1);
        await flush();
    });

    test('resolveStraightBibleItems swaps the editing item for the found one', async () => {
        const ctl = genController();
        // Selecting is what turns the only open item into an EditingBibleItem.
        ctl.selectedBibleItem;
        const foundBibleItem = new FakeReadItem({
            id: 99,
            bibleKey: 'KJV',
            target: { bookKey: 'LUK', chapter: 3, verseStart: 1, verseEnd: 3 },
        }) as any;
        const resolved = ctl.resolveStraightBibleItems(foundBibleItem);
        expect(resolved).toHaveLength(1);
        // Every returned item must expose a usable target: the editing one
        // throws on `target`, which is the whole point of swapping it out.
        expect(resolved[0].target).toEqual(foundBibleItem.target);
        await flush();
    });

    test('resolveStraightBibleItems swaps the selected pane even when it lost its marker class', async () => {
        const ctl = genController();
        const selectedId = ctl.selectedBibleItem.id;
        // A split splices the caller's own instance back into the tree, so
        // the editing pane comes back as a PLAIN item carrying its stale
        // stored target — Genesis 27 here, while the input reads Genesis 29.
        const stale = {
            bookKey: 'GEN',
            chapter: 27,
            verseStart: 1,
            verseEnd: 46,
        };
        ctl.nestedBibleItems = [
            new FakeReadItem({
                id: selectedId,
                bibleKey: 'KJV',
                target: stale,
            }),
            new FakeReadItem({ id: 2, bibleKey: 'KJV', target: stale }),
        ] as any;
        const foundBibleItem = new FakeReadItem({
            id: selectedId,
            bibleKey: 'KJV',
            target: {
                bookKey: 'GEN',
                chapter: 29,
                verseStart: 1,
                verseEnd: 35,
            },
        }) as any;
        const resolved = ctl.resolveStraightBibleItems(foundBibleItem);
        expect(resolved.map((item) => item.target.chapter)).toEqual([29, 27]);
        await flush();
    });

    test('resolveStraightBibleItems drops the editing item without a result', async () => {
        const ctl = genController();
        ctl.selectedBibleItem;
        // An unparseable lookup input resolves to nothing; the pane then has no
        // verses to report rather than an item that throws on `target`.
        expect(ctl.resolveStraightBibleItems(null)).toEqual([]);
        await flush();
    });

    test('setLookupContentFromBibleItem applies target/key', async () => {
        const ctl = genController();
        const spy = vi.spyOn(ctl, 'applyTargetOrBibleKey');
        await ctl.setLookupContentFromBibleItem(
            new FakeReadItem({
                id: 5,
                bibleKey: 'ESV',
                target: { chapter: 1 },
            }) as any,
        );
        expect(spy).toHaveBeenCalled();
        await flush();
    });

    test('applyTargetOrBibleKey with extra keys reloads and edits selected', async () => {
        const ctl = genController();
        const selected = ctl.selectedBibleItem;
        ctl.applyTargetOrBibleKey(selected, {
            extraBibleKeys: ['NIV'],
            isAudioEnabled: true,
            bibleKey: 'ESV',
            target: { chapter: 2 } as any,
        });
        await flush();
        expect(h.extractBibleTitleMock).toHaveBeenCalled();
    });

    test('applyTargetOrBibleKey on a non-selected item defers to base', async () => {
        const ctl = genController();
        const other = new FakeReadItem({
            id: 777,
            bibleKey: 'KJV',
            target: { chapter: 1 },
        });
        ctl.appendBibleItem(other as any);
        const appended = ctl.straightBibleItems.find(
            (i) => i.id !== ctl.selectedBibleItem.id,
        )!;
        ctl.applyTargetOrBibleKey(appended, { bibleKey: 'ESV' });
        await flush();
        expect(ctl.straightBibleItems.length).toBeGreaterThanOrEqual(2);
    });

    test('editBibleItem switches selection and keeps found item', async () => {
        const ctl = genController();
        const extra = ctl.appendBibleItem(
            new FakeReadItem({
                id: 555,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        await ctl.editBibleItem(extra as any);
        await flush();
        expect(ctl.selectedBibleItem.id).toBe(extra.id);
    });

    // Measured live: moving the editor to another view painted the PREVIOUS
    // view's passage there for ~0.6 s -- the lookup answers the box's old
    // text again for the new id before the box is retitled.
    test('a result for the text the box held before a selection shows the selected view', async () => {
        const ctl = genController();
        await settleFirstSelection(ctl);
        ctl.inputText = 'Old Text';
        await flush();
        const other = ctl.appendBibleItem(
            new FakeReadItem({
                id: 777,
                bibleKey: 'NIV',
                target: {
                    bookKey: 'JHN',
                    chapter: 3,
                    verseStart: 16,
                    verseEnd: 16,
                },
            }) as any,
        );
        const staleResult = {
            result: {
                bibleItem: h.makeFound('KJV'),
                bookKey: 'GEN',
                chapter: 1,
            },
            bibleKey: 'KJV',
            inputText: 'Old Text',
            oldInputText: 'Old Text',
            time: 0,
        } as any;
        expect(ctl.toCurrentEditingResult(staleResult)).toBe(staleResult);

        ctl.selectedBibleItem = other;
        const shown = ctl.toCurrentEditingResult(staleResult)!;
        expect(shown).not.toBe(staleResult);
        expect(shown.bibleKey).toBe('NIV');
        expect(shown.result.bibleItem!.id).toBe(other.id);
        expect(shown.result.bibleItem!.target).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
        });
        expect(shown.result.bookKey).toBe('JHN');

        // A result for any other text means the box has moved on.
        ctl.settleEditingResult({ ...staleResult, oldInputText: 'John 3:16' });
        expect(ctl.toCurrentEditingResult(staleResult)).toBe(staleResult);
        await flush();
    });

    test('a result already showing the passage of the selected view stands', async () => {
        const ctl = genController();
        await settleFirstSelection(ctl);
        ctl.inputText = 'Same Title';
        await flush();
        const other = ctl.appendBibleItem(
            new FakeReadItem({
                id: 778,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        // `makeFound('KJV')` is KJV, chapter 1: the selected view's passage.
        const result = {
            result: { bibleItem: h.makeFound('KJV'), extraBibleItems: [{}] },
            bibleKey: 'KJV',
            inputText: 'Same Title',
            oldInputText: 'Same Title',
            time: 0,
        } as any;
        ctl.selectedBibleItem = other;
        expect(ctl.toCurrentEditingResult(result)).toBe(result);
        await flush();
    });

    test('typing without a selection change shows each result as it is', async () => {
        const ctl = genController();
        await settleFirstSelection(ctl);
        ctl.inputText = 'Gen';
        const result = {
            result: { bibleItem: null, bookKey: 'GEN', chapter: null },
            bibleKey: 'KJV',
            inputText: 'Gen',
            oldInputText: 'Gen',
            time: 0,
        } as any;
        ctl.settleEditingResult(result);
        expect(ctl.toCurrentEditingResult(result)).toBe(result);
        expect(ctl.toCurrentEditingResult(null)).toBeNull();
        await flush();
    });

    test('editBibleItem no-ops when already selected', async () => {
        const ctl = genController();
        const selected = ctl.selectedBibleItem;
        const deleteSpy = vi.spyOn(ctl, 'deleteBibleItem');
        await ctl.editBibleItem(selected);
        expect(deleteSpy).not.toHaveBeenCalled();
        await flush();
    });

    test('editBibleItem deletes old selection when no found item', async () => {
        h.extractBibleTitleMock.mockResolvedValue({
            result: { bibleItem: null },
            bibleKey: 'KJV',
            oldInputText: '',
            time: Date.now(),
        });
        const ctl = genController();
        const extra = ctl.appendBibleItem(
            new FakeReadItem({
                id: 321,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        const deleteSpy = vi.spyOn(ctl, 'deleteBibleItem');
        await ctl.editBibleItem(extra as any);
        await flush();
        expect(deleteSpy).toHaveBeenCalled();
    });

    test('deleteBibleItem respects the isAlone guard', () => {
        const ctl = genController();
        // only one item -> alone -> no delete
        ctl.deleteBibleItem(ctl.straightBibleItems[0]);
        expect(ctl.straightBibleItems).toHaveLength(1);
    });

    test('genContextMenu for selected item adds split shortcuts and close', async () => {
        const ctl = genController();
        ctl.appendBibleItem(
            new FakeReadItem({
                id: 999,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        const selected = ctl.selectedBibleItem;
        const menu = await ctl.genContextMenu({}, selected, 'uuid1');
        expect(menu.some((m) => m.menuElement === 'found')).toBe(true);
        expect(menu.some((m) => m.menuElement === 'Close')).toBe(true);
        // run the close handler for the selected branch
        const close = menu.find((m) => m.menuElement === 'Close')!;
        close.onSelect!({} as any);
        expect(h.closeCurrentEditingBibleItemMock).toHaveBeenCalled();
        await flush();
    });

    test('genContextMenu for non-selected item offers Edit and delete-close', async () => {
        const ctl = genController();
        const extra = ctl.appendBibleItem(
            new FakeReadItem({
                id: 888,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        const menu = await ctl.genContextMenu({}, extra as any, 'uuid2');
        const edit = menu.find((m) => m.menuElement === 'Edit')!;
        expect(edit).toBeDefined();
        const editSpy = vi.spyOn(ctl, 'editBibleItem').mockResolvedValue();
        edit.onSelect!({} as any);
        expect(editSpy).toHaveBeenCalled();
        const close = menu.find((m) => m.menuElement === 'Close')!;
        const deleteSpy = vi.spyOn(ctl, 'deleteBibleItem');
        close.onSelect!({} as any);
        expect(deleteSpy).toHaveBeenCalled();
        await flush();
    });

    test('tryJumpingChapter jumps to the next chapter', async () => {
        const ctl = genController();
        await ctl.tryJumpingChapter(true);
        await flush();
        expect(ctl.inputText).toBe('KJV title');
    });

    test('tryJumpingChapter toasts when no found item', async () => {
        h.extractBibleTitleMock.mockResolvedValue({
            result: { bibleItem: null },
            bibleKey: 'KJV',
            oldInputText: '',
            time: Date.now(),
        });
        const ctl = genController();
        await ctl.tryJumpingChapter(true);
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Jumping Chapter',
            expect.any(String),
        );
        await flush();
    });

    test('tryJumpingChapter toasts when no next chapter', async () => {
        const ctl = genController();
        await ctl.tryJumpingChapter(false); // getJumpingChapter(false) => null
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            expect.stringContaining('Previous'),
            expect.any(String),
        );
        await flush();
    });

    test('default no-op handlers are callable', () => {
        const ctl = genController();
        expect(() => {
            ctl.setInputText('x');
            ctl.setBibleKey('KJV');
            ctl.reloadEditingResult('x');
            ctl.onLookupSaveBibleItem();
            ctl.setIsAdvanceLookupOpened(true);
            ctl.setBibleVerseKey('x');
            ctl.handleScreenBibleVersesHighlighting('x', false);
        }).not.toThrow();
    });

    test('EditingBibleItem guards metadata and target access', () => {
        const ctl = genController();
        const selected = ctl.selectedBibleItem as any;
        expect(() => selected.metadata).toThrow();
        expect(() => {
            selected.metadata = {};
        }).toThrow();
        expect(() => selected.target).toThrow();
        expect(() => {
            selected.target = { chapter: 1 };
        }).toThrow();
    });

    test('getStraightBibleItemsForExportingMSWord keeps non-editing items', async () => {
        const ctl = genController();
        ctl.appendBibleItem(
            new FakeReadItem({
                id: 4321,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        // select the first item so it becomes an EditingBibleItem on reload
        ctl.selectedBibleItem;
        const items = await ctl.getStraightBibleItemsForExportingMSWord();
        expect(items.length).toBeGreaterThanOrEqual(2);
        await flush();
    });

    test('setColorNote else-branch syncs a non-selected item', async () => {
        const ctl = genController();
        const extra = ctl.appendBibleItem(
            new FakeReadItem({
                id: 2468,
                bibleKey: 'KJV',
                target: { chapter: 1 },
            }) as any,
        );
        ctl.setColorNote(extra as any, 'blue');
        expect(ctl.getColorNote(extra as any)).toBe('blue');
        await flush();
    });

    test('inputText setter reacts to a changed bible key', async () => {
        const ctl = genController();
        h.extractBibleTitleMock.mockImplementation(
            async (_bibleKey: string, inputText: string) => ({
                result: {
                    bibleItem: h.makeFound('ESV'),
                    bookKey: 'EXO',
                    chapter: 1,
                },
                bibleKey: 'ESV',
                oldInputText: inputText,
                time: 1,
            }),
        );
        ctl.inputText = 'Exodus 1:1';
        await flush();
        expect(h.bibleRenderToTitleMock).toHaveBeenCalled();
    });

    // Every keystroke is looked up, and the lookups finish in any order: the
    // half-typed `Genesis 1:1-3` of a fast `Genesis 1:1-31` landing last
    // became the reader's history entry.
    test('a lookup that lands after the box moved on adds no history', async () => {
        const addBibleItemHistory = vi.fn();
        const originalAdd = bibleHistoryStore.addBibleItemHistory;
        bibleHistoryStore.addBibleItemHistory = addBibleItemHistory;
        try {
            const ctl = genController();
            await settleFirstSelection(ctl);
            ctl.inputText = 'Genesis 1:1-31';
            await flush();
            // The box's own passage is still recorded.
            expect(addBibleItemHistory).toHaveBeenCalledWith('(KJV) KJV title');
            addBibleItemHistory.mockClear();

            await ctl.getEditingResult('Genesis 1:1-3');
            await flush();

            expect(addBibleItemHistory).not.toHaveBeenCalled();
        } finally {
            bibleHistoryStore.addBibleItemHistory = originalAdd;
        }
    });

    // The rewrite was guarded by a `Date.now()` stamp, which two keystrokes
    // inside one millisecond share -- scripted typing does it -- so the answer
    // to the half-typed text, landing after the full one, wrote the box back.
    test('a late answer for a half-typed text never writes the box back', async () => {
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        const resolverList: (() => void)[] = [];
        h.extractBibleTitleMock.mockImplementation(
            async (bibleKey: string, inputText: string, time?: number) => {
                if (inputText === 'Genesis 1:1-3') {
                    await new Promise<void>((resolve) => {
                        resolverList.push(resolve);
                    });
                }
                return {
                    result: {
                        bibleItem: h.makeFound(bibleKey),
                        bookKey: 'GEN',
                        chapter: 1,
                    },
                    bibleKey,
                    oldInputText: inputText,
                    time: time ?? Date.now(),
                };
            },
        );
        try {
            const ctl = genController();
            await settleFirstSelection(ctl);
            ctl.inputText = 'Genesis 1:1-3';
            ctl.inputText = 'Genesis 1:1-31';
            await flush();
            for (const resolve of resolverList) {
                resolve();
            }
            await flush();

            expect(ctl.inputText).toBe('Genesis 1:1-31');
        } finally {
            dateNowSpy.mockRestore();
        }
    });

    // The colour group follows the box through one lookup per keystroke, and
    // the lookups finish in any order: a slow `Mark 4:3` landing after
    // `Mark 4:39` left every synced pane on verse 3 beside the box's verse 39
    // (F1 of robot run 20261001-1646).
    test('a synced pane follows the box, not a late half-typed lookup', async () => {
        const resolverList: (() => void)[] = [];
        h.extractBibleTitleMock.mockImplementation(
            async (bibleKey: string, inputText: string, time?: number) => {
                if (inputText === 'Mark 4:3') {
                    await new Promise<void>((resolve) => {
                        resolverList.push(resolve);
                    });
                }
                const verse = Number.parseInt(inputText.split(':')[1] ?? '1');
                return {
                    result: {
                        bibleItem: new FakeReadItem({
                            id: -99,
                            bibleKey,
                            target: {
                                bookKey: 'MRK',
                                chapter: 4,
                                verseStart: verse,
                                verseEnd: verse,
                            },
                        }),
                        bookKey: 'MRK',
                        chapter: 4,
                    },
                    bibleKey,
                    oldInputText: inputText,
                    time: time ?? Date.now(),
                };
            },
        );
        const ctl = genController();
        await settleFirstSelection(ctl);
        const syncedBibleItem = ctl.appendBibleItem(
            new FakeReadItem({
                id: 1357,
                bibleKey: 'KJV',
                target: { bookKey: 'GEN', chapter: 1 },
            }) as any,
        );
        ctl.setColorNote(syncedBibleItem as any, 'red');
        ctl.setColorNote(ctl.selectedBibleItem, 'red');
        await flush();
        const applySpy = vi.spyOn(ctl, 'applyTargetOrBibleKey');

        ctl.inputText = 'Mark 4:3';
        ctl.inputText = 'Mark 4:39';
        await flush();
        for (const resolve of resolverList) {
            resolve();
        }
        await flush();

        const syncedVerses = applySpy.mock.calls
            .filter(([bibleItem]) => {
                return bibleItem.id === syncedBibleItem.id;
            })
            .map(([, { target }]) => {
                return target?.verseStart;
            });
        expect(syncedVerses).toContain(39);
        expect(syncedVerses.at(-1)).toBe(39);
        expect(syncedVerses).not.toContain(3);
    });

    test('tryJumpingChapter resets scroll containers', async () => {
        const ctl = genController();
        const scroller = document.createElement('div');
        scroller.setAttribute('data-scroll-on-next-chapter', '1');
        scroller.scrollTop = 40;
        document.body.appendChild(scroller);
        await ctl.tryJumpingChapter(true);
        await flush();
        expect(scroller.scrollTop).toBe(0);
        scroller.remove();
    });

    describe('useLookupBibleItemControllerContext', () => {
        let container: HTMLDivElement;
        let root: Root | null = null;
        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });
        afterEach(async () => {
            if (root) {
                await act(async () => root?.unmount());
                root = null;
            }
            container.remove();
        });

        test('returns the lookup controller or throws for non-lookup', async () => {
            const ctl = genController();
            let seen: any = null;
            function Probe() {
                seen = useLookupBibleItemControllerContext();
                return null;
            }
            await act(async () => {
                root = createRoot(container);
                root.render(
                    <BibleItemsViewControllerContext.Provider value={ctl}>
                        <Probe />
                    </BibleItemsViewControllerContext.Provider>,
                );
            });
            expect(seen).toBe(ctl);

            function ThrowProbe() {
                try {
                    useLookupBibleItemControllerContext();
                    return <span>ok</span>;
                } catch (error: any) {
                    return <span>{error.message}</span>;
                }
            }
            const nonLookup = genController();
            (nonLookup as any).isLookup = false;
            await act(async () => {
                root?.render(
                    <BibleItemsViewControllerContext.Provider value={nonLookup}>
                        <ThrowProbe />
                    </BibleItemsViewControllerContext.Provider>,
                );
            });
            expect(container.textContent).toContain('must be used within');
            await flush();
        });
    });
});
