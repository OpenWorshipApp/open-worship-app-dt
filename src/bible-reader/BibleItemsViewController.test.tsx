// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    const settingStore = new Map<string, string>();
    class FakeItem {
        id: number;
        bibleKey: string;
        target: any;
        extraBibleKeys: string[] | undefined;
        isAudioEnabled: boolean | undefined;
        constructor(json: any) {
            this.id = json.id;
            this.bibleKey = json.bibleKey;
            this.target = json.target;
            this.extraBibleKeys = json.extraBibleKeys;
            this.isAudioEnabled = json.isAudioEnabled;
        }
        static fromJson(json: any) {
            return new FakeItem(json);
        }
        toJson() {
            return {
                id: this.id,
                bibleKey: this.bibleKey,
                target: this.target,
                extraBibleKeys: this.extraBibleKeys,
                isAudioEnabled: this.isAudioEnabled,
            };
        }
        checkIsSameId(other: any) {
            return this.id === (typeof other === 'number' ? other : other.id);
        }
        async toTitle() {
            return `${this.bibleKey} title`;
        }
        toVerseFullKey() {
            return `VK-${this.id}`;
        }
    }
    return {
        settingStore,
        FakeItem,
        captured: { effectCb: undefined as any },
        useAppEffectMock: vi.fn(),
        getSettingMock: vi.fn((key: string) =>
            settingStore.has(key) ? settingStore.get(key) : null,
        ),
        setSettingMock: vi.fn((key: string, value: string | null) => {
            settingStore.set(key, value ?? '');
        }),
        handleErrorMock: vi.fn(),
        tranMock: vi.fn((key: string) => key),
        showSimpleToastMock: vi.fn(),
        showBibleKeyOptionMock: vi.fn(),
        bringTopMock: vi.fn(),
        bringCenterMock: vi.fn(),
        bringNearestMock: vi.fn(),
        getShouldModelNewLineMock: vi.fn(() => true),
        setShouldModelNewLineMock: vi.fn(),
        elementDivider: { __divider: true },
        genContextMenuItemIconMock: vi.fn((n: string) => `icon-${n}`),
        checkIsVerseAtBottomMock: vi.fn(() => false),
        checkIsVersePartialInvisibleMock: vi.fn(() => false),
        bibleItemFromVerseKeyMock: vi.fn(async (bibleKey: string) =>
            bibleKey === 'skip' ? null : { bibleKey, __bibleItem: true },
        ),
        genTimeoutAttemptMock: vi.fn(() => (fn: any) => fn()),
        getLangDataFromBibleKeyMock: vi.fn(async () => null),
    };
});

vi.mock('../event/EventHandler', () => ({
    default: class {
        addPropEvent = vi.fn();
        registerEventListener = vi.fn(() => ['evt']);
        unregisterEventListener = vi.fn();
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: h.tranMock }));
vi.mock('../helper/appHooks', () => ({ useAppEffect: h.useAppEffectMock }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSettingMock,
    setSetting: h.setSettingMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOptionMock,
}));
vi.mock('../server/appProvider', () => ({ default: { isDev: false } }));
vi.mock('../helper/helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    bringDomToCenterView: h.bringCenterMock,
    bringDomToNearestView: h.bringNearestMock,
    bringDomToTopView: h.bringTopMock,
}));
vi.mock('../helper/bibleViewHelpers', () => ({
    BIBLE_VIEW_TEXT_CLASS: 'bible-view',
    VERSE_TEXT_CLASS: 'verse-text',
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getShouldModelNewLine: h.getShouldModelNewLineMock,
    setShouldModelNewLine: h.setShouldModelNewLineMock,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: h.elementDivider,
    genContextMenuItemIcon: h.genContextMenuItemIconMock,
}));
vi.mock('./ReadIdOnlyBibleItem', () => ({ ReadIdOnlyBibleItem: h.FakeItem }));
vi.mock('./readBibleScrollHelpers', () => ({
    checkIsVerseAtBottom: h.checkIsVerseAtBottomMock,
    checkIsVersePartialInvisible: h.checkIsVersePartialInvisibleMock,
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { fromVerseKey: h.bibleItemFromVerseKeyMock },
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: h.genTimeoutAttemptMock,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getLangDataFromBibleKey: h.getLangDataFromBibleKeyMock,
}));

import BibleItemsViewController, {
    BibleItemsViewControllerContext,
    applyBibleItemHistoryPendingText,
    attemptAddingHistory,
    bibleHistoryStore,
    sanitizeNestedItems,
    stringifyNestedBibleItem,
    useBibleItemViewControllerUpdateEvent,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';

const { FakeItem } = h;

function genItem(id: number, bibleKey = 'KJV') {
    return FakeItem.fromJson({ id, bibleKey, target: { book: 'GEN' } }) as any;
}

function genController(suffix = 'test') {
    return new BibleItemsViewController(suffix);
}

describe('bible-reader BibleItemsViewController', () => {
    beforeEach(() => {
        h.settingStore.clear();
        vi.clearAllMocks();
        h.getShouldModelNewLineMock.mockReturnValue(true);
    });

    describe('module-level history helpers', () => {
        test('attemptAddingHistory immediate pushes right away', () => {
            const spy = vi
                .spyOn(bibleHistoryStore, 'addBibleItemHistory')
                .mockImplementation(() => {});
            attemptAddingHistory('KJV', 'Genesis 1:1', true);
            expect(spy).toHaveBeenCalledWith('(KJV) Genesis 1:1');
            // pendingText cleared -> next apply is a no-op
            spy.mockClear();
            applyBibleItemHistoryPendingText();
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('attemptAddingHistory debounced pushes through the timer', () => {
            const spy = vi
                .spyOn(bibleHistoryStore, 'addBibleItemHistory')
                .mockImplementation(() => {});
            attemptAddingHistory('ESV', 'John 3:16');
            expect(spy).toHaveBeenCalledWith('(ESV) John 3:16');
            spy.mockRestore();
        });
    });

    describe('nested item utilities', () => {
        test('sanitizeNestedItems flattens singletons and drops empties', () => {
            const a = genItem(1);
            const b = genItem(2);
            expect(sanitizeNestedItems([[a], b])).toEqual([a, b]);
            expect(sanitizeNestedItems(a)).toEqual([a]);
            expect(sanitizeNestedItems([[], a])).toEqual([a]);
        });

        test('stringifyNestedBibleItem serializes recursively', () => {
            const a = genItem(1);
            const result = stringifyNestedBibleItem([a, [genItem(2)]]);
            expect(Array.isArray(result)).toBe(true);
            expect((result as any)[0].id).toBe(1);
        });
    });

    describe('settings-backed getters/setters', () => {
        test('colorNoteMap round-trips and recovers from bad json', () => {
            const ctl = genController();
            expect(ctl.colorNoteMap).toEqual({});
            ctl.colorNoteMap = { 1: 'red' };
            expect(ctl.colorNoteMap).toEqual({ 1: 'red' });

            h.settingStore.set(
                ctl.toSettingName('bible-items-color-note'),
                '{bad',
            );
            expect(ctl.colorNoteMap).toEqual({});
            expect(h.handleErrorMock).toHaveBeenCalled();
        });

        test('shouldNewLine and shouldModelNewLine reflect settings', () => {
            const ctl = genController();
            expect(ctl.shouldNewLine).toBe(true);
            ctl.shouldNewLine = false;
            expect(ctl.shouldNewLine).toBe(false);
            expect(ctl.shouldModelNewLine).toBe(false);

            ctl.shouldNewLine = true;
            expect(ctl.shouldModelNewLine).toBe(true);
            h.getShouldModelNewLineMock.mockReturnValue(false);
            expect(ctl.shouldModelNewLine).toBe(false);

            ctl.shouldModelNewLine = true;
            expect(h.setShouldModelNewLineMock).toHaveBeenCalledWith(true);
        });

        test('bibleCrossReferenceVerseKey only returns parenthesized values', () => {
            const ctl = genController();
            expect(ctl.bibleCrossReferenceVerseKey).toBe('');
            const setBibleVerseKey = vi.fn();
            ctl.setBibleVerseKey = setBibleVerseKey;
            ctl.bibleCrossReferenceVerseKey = '(KJV) GEN 1:1';
            expect(ctl.bibleCrossReferenceVerseKey).toBe('(KJV) GEN 1:1');
            expect(setBibleVerseKey).toHaveBeenCalledWith('(KJV) GEN 1:1');
            ctl.bibleCrossReferenceVerseKey = 'no-paren';
            expect(ctl.bibleCrossReferenceVerseKey).toBe('');
        });
    });

    describe('parsing and loading', () => {
        test('parseNestedBibleItem throws on duplicate ids', () => {
            const ctl = genController();
            expect(() =>
                ctl.parseNestedBibleItem([
                    { id: 1, bibleKey: 'KJV', target: {} },
                    { id: 1, bibleKey: 'KJV', target: {} },
                ]),
            ).toThrow('Duplicate ReadOnlyBibleItem ID found');
        });

        test('parseNestedBibleItem returns a single item for non-array json', () => {
            const ctl = genController();
            const parsed = ctl.parseNestedBibleItem({
                id: 5,
                bibleKey: 'KJV',
                target: {},
            });
            expect(Array.isArray(parsed)).toBe(false);
            expect((parsed as any).id).toBe(5);
        });

        test('constructor recovers from corrupt stored data', () => {
            const suffix = 'corrupt';
            const key = `bible-items-preview-${suffix}-data`;
            h.settingStore.set(key, '{not-json');
            const ctl = genController(suffix);
            expect(h.handleErrorMock).toHaveBeenCalled();
            expect(ctl.straightBibleItems).toEqual([]);
        });

        test('nestedBibleItems setter persists and fires an update', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1), genItem(2)];
            expect(ctl.straightBibleItems).toHaveLength(2);
            expect((ctl as any).addPropEvent).toHaveBeenCalledWith('update');
            expect(h.settingStore.get(ctl.toSettingName('-data'))).toContain(
                '"id":1',
            );
        });
    });

    describe('color notes', () => {
        test('set/get color note and cleanup of stale ids', () => {
            const ctl = genController();
            const a = genItem(1);
            const b = genItem(2);
            ctl.nestedBibleItems = [a, b];
            ctl.setColorNote(a, 'red');
            expect(ctl.getColorNote(a)).toBe('red');
            expect(
                ctl.getBibleItemsByColorNote('red').map((i) => i.id),
            ).toEqual([1]);
            expect(ctl.getBibleItemsByColorNote('')).toEqual([]);

            // stale entry (id 99 not present) is pruned; clearing removes id 1
            ctl.colorNoteMap = { 1: 'red', 99: 'blue' };
            ctl.setColorNote(a, null);
            expect(ctl.colorNoteMap[99]).toBeUndefined();
            expect(ctl.colorNoteMap[1]).toBeUndefined();
        });

        test('isAlone reflects the item count', () => {
            const ctl = genController();
            expect(ctl.isAlone).toBe(true);
            ctl.nestedBibleItems = [genItem(1), genItem(2)];
            expect(ctl.isAlone).toBe(false);
        });
    });

    describe('seek / neighbors / mutations', () => {
        test('seek throws and toasts when item is missing', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            expect(() => ctl.seek(genItem(999))).toThrow('not found');
            expect(h.showSimpleToastMock).toHaveBeenCalled();
        });

        test('getNeighborBibleItems finds left/right neighbors in a row', () => {
            const ctl = genController();
            const a = genItem(1);
            const b = genItem(2);
            const c = genItem(3);
            ctl.nestedBibleItems = [a, b, c];
            const straight = ctl.straightBibleItems;
            const middle = straight[1];
            const neighbors = ctl.getNeighborBibleItems(middle, [
                'left',
                'right',
                'top',
                'bottom',
            ]);
            expect(neighbors.left?.id).toBe(1);
            expect(neighbors.right?.id).toBe(3);
        });

        test('getNeighborBibleItems handles nested orientation', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [
                [genItem(1), genItem(2)],
                [genItem(3), genItem(4)],
            ];
            const target = ctl.straightBibleItems[0];
            const neighbors = ctl.getNeighborBibleItems(target, [
                'left',
                'right',
                'top',
                'bottom',
            ]);
            expect(neighbors).toHaveProperty('bottom');
        });

        test('getNeighborBibleItems restricts to requested positions and wraps', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1), genItem(2), genItem(3)];
            const first = ctl.straightBibleItems[0];
            const neighbors = ctl.getNeighborBibleItems(first, ['left']);
            // only left requested -> others null
            expect(neighbors.right).toBeNull();
            expect(neighbors.top).toBeNull();
            expect(neighbors.bottom).toBeNull();
            // going left from the first wraps to the last item
            expect(neighbors.left?.id).toBe(3);
        });

        test('applyTargetOrBibleKey updates target, key and flags', () => {
            const ctl = genController();
            const a = genItem(1);
            ctl.nestedBibleItems = [a];
            const target = ctl.straightBibleItems[0];
            ctl.applyTargetOrBibleKey(target, {
                target: { book: 'EXO' } as any,
                bibleKey: 'ESV',
                extraBibleKeys: ['NIV'],
                isAudioEnabled: true,
            });
            const updated = ctl.straightBibleItems[0];
            expect(updated.bibleKey).toBe('ESV');
            expect(updated.target).toEqual({ book: 'EXO' });
            expect(updated.extraBibleKeys).toEqual(['NIV']);
            expect(updated.isAudioEnabled).toBe(true);
        });

        test('applyTargetOrBibleKey swallows errors for missing items', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            ctl.applyTargetOrBibleKey(genItem(999), { bibleKey: 'ESV' });
            expect(h.handleErrorMock).toHaveBeenCalled();
        });

        test('deleteBibleItem removes an item', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1), genItem(2)];
            ctl.deleteBibleItem(ctl.straightBibleItems[0]);
            expect(ctl.straightBibleItems.map((i) => i.id)).toEqual([2]);
        });

        test('deleteBibleItem handles missing items gracefully', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            ctl.deleteBibleItem(genItem(999));
            expect(h.handleErrorMock).toHaveBeenCalled();
        });
    });

    describe('adding items', () => {
        test('addBibleItem seeds the first item when none exists', () => {
            const ctl = genController();
            ctl.addBibleItemLeft(null as any, genItem(5));
            expect(ctl.straightBibleItems).toHaveLength(1);
        });

        test('addBibleItemRight inserts alongside in the same orientation', () => {
            const ctl = genController();
            const a = genItem(1);
            ctl.nestedBibleItems = [a];
            ctl.setColorNote(ctl.straightBibleItems[0], 'green');
            ctl.addBibleItemRight(ctl.straightBibleItems[0], genItem(2));
            expect(ctl.straightBibleItems).toHaveLength(2);
        });

        test('addBibleItemBottom nests into a new orientation', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1), genItem(2)];
            ctl.addBibleItemTop(ctl.straightBibleItems[0], genItem(3));
            expect(ctl.straightBibleItems.length).toBeGreaterThanOrEqual(3);
        });

        test('addBibleItem reports seek errors', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            ctl.addBibleItemLeft(genItem(999), genItem(2));
            expect(h.handleErrorMock).toHaveBeenCalled();
        });

        test('appendBibleItem appends to array and wraps singletons', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            ctl.appendBibleItem(ctl.straightBibleItems[0]);
            expect(ctl.straightBibleItems).toHaveLength(2);
            // wrap a single (non-array) nested item
            (ctl as any)._nestedBibleItems = genItem(9);
            ctl.appendBibleItem(genItem(10));
            expect(ctl.straightBibleItems.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('context menu', () => {
        test('genContextMenu builds items and runs split handlers', async () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            const item = ctl.straightBibleItems[0];
            const menu = await ctl.genContextMenu({}, item, 'uuid1');
            expect(menu.length).toBeGreaterThan(3);

            const addLeft = vi.spyOn(ctl, 'addBibleItemLeft');
            const addBottom = vi.spyOn(ctl, 'addBibleItemBottom');
            menu.find((m) => m.id === 'split-horizontal')!.onSelect!({} as any);
            expect(addLeft).toHaveBeenCalled();
            menu.find((m) => m.id === 'split-vertical')!.onSelect!({} as any);
            expect(addBottom).toHaveBeenCalled();

            // split-to handlers open the bible key option and run the callback
            h.showBibleKeyOptionMock.mockImplementation(
                (_e: any, cb: (k: string) => void) => cb('ESV'),
            );
            const splitHorizontalTo = menu.find(
                (m) => m.menuElement === 'Split Horizontal to',
            )!;
            splitHorizontalTo.onSelect!({} as any);
            const splitVerticalTo = menu.find(
                (m) => m.menuElement === 'Split Vertical to',
            )!;
            splitVerticalTo.onSelect!({} as any);
            expect(h.showBibleKeyOptionMock).toHaveBeenCalledTimes(2);
        });

        test('genContextMenu toggle full view targets the uuid element', async () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            const el = document.createElement('div');
            el.id = 'uuid-uuidX';
            document.body.appendChild(el);
            const menu = await ctl.genContextMenu(
                {},
                ctl.straightBibleItems[0],
                'uuidX',
            );
            menu.find((m) => m.menuElement === 'Toggle Widget Full View')!
                .onSelect!({} as any);
            expect(el.classList.contains('app-full-view')).toBe(true);
            el.remove();
        });

        test('genContextMenu includes lang-provided extra items', async () => {
            h.getLangDataFromBibleKeyMock.mockResolvedValue({
                extraBibleContextMenuItems: () => [
                    { menuElement: 'extra-lang' },
                ],
            } as any);
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            const menu = await ctl.genContextMenu(
                {},
                ctl.straightBibleItems[0],
                'uuidY',
            );
            expect(menu.some((m) => m.menuElement === 'extra-lang')).toBe(true);
        });
    });

    describe('DOM verse selection', () => {
        function makeVerseDom(kjvKey = 'GEN.1.1', verseKey = 'gen1:1') {
            const container = document.createElement('div');
            container.className = 'bible-view';
            container.setAttribute('data-bible-item-id', '1');
            const parent = document.createElement('div');
            const target = document.createElement('div');
            target.className = 'verse-text';
            target.setAttribute('data-kjv-verse-key', kjvKey);
            target.dataset.verseKey = verseKey;
            target.dataset.kjvVerseKey = kjvKey;
            parent.appendChild(target);
            container.appendChild(parent);
            document.body.appendChild(container);
            return { container, target };
        }

        test('getVerseElements queries by item id and verse key', () => {
            const inner = document.createElement('div');
            inner.className = 'bible-view';
            inner.setAttribute('data-bible-item-id', '1');
            const verse = document.createElement('div');
            verse.className = 'bible-view';
            const child = document.createElement('div');
            child.className = 'verse-text';
            verse.appendChild(child);
            inner.appendChild(verse);
            document.body.appendChild(inner);
            const ctl = genController();
            const elements = ctl.getVerseElements(1);
            expect(Array.isArray(elements)).toBe(true);
            inner.remove();
        });

        test('handleVersesSelecting toggles off when already selected', () => {
            const ctl = genController();
            const { target } = makeVerseDom();
            target.classList.add('selected');
            ctl.handleVersesSelecting(target, false, false);
            expect(target.classList.contains('selected')).toBe(false);
            target.remove();
        });

        test('handleVersesSelecting selects and scrolls to top', () => {
            const ctl = genController();
            const { target } = makeVerseDom();
            ctl.handleVersesSelecting(target, true, true);
            expect(target.classList.contains('selected')).toBe(true);
            expect(h.bringTopMock).toHaveBeenCalled();
            target.remove();
        });

        test('handleVersesSelecting centers a partially invisible bottom verse', () => {
            h.checkIsVersePartialInvisibleMock.mockReturnValue(true);
            h.checkIsVerseAtBottomMock.mockReturnValue(true);
            const ctl = genController();
            const { target } = makeVerseDom();
            ctl.handleVersesSelecting(target, false, true);
            expect(h.bringCenterMock).toHaveBeenCalled();
            target.remove();
        });

        test('handleVersesSelecting syncs color-note siblings', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1), genItem(2)];
            const items = ctl.straightBibleItems;
            ctl.setColorNote(items[0], 'red');
            ctl.setColorNote(items[1], 'red');
            const { target } = makeVerseDom('GEN.1.1', '(KJV) GEN 1:1');
            const syncSpy = vi.spyOn(ctl, 'syncBibleVerseSelection');
            ctl.handleVersesSelecting(target, false, true, items[0]);
            expect(ctl.bibleCrossReferenceVerseKey).toBe('(KJV) GEN 1:1');
            expect(syncSpy).toHaveBeenCalled();
            target.remove();
        });

        test('handleVersesSelecting returns early without a kjv verse key', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            const item = ctl.straightBibleItems[0];
            const container = document.createElement('div');
            const target = document.createElement('div');
            target.dataset.verseKey = '(KJV) GEN 1:1';
            // no dataset.kjvVerseKey
            container.appendChild(target);
            document.body.appendChild(container);
            const highlightSpy = vi.spyOn(
                ctl,
                'handleScreenBibleVersesHighlighting',
            );
            ctl.handleVersesSelecting(target, false, true, item);
            expect(highlightSpy).not.toHaveBeenCalled();
            container.remove();
        });

        test('handleVersesSelecting returns early when no color note is set', () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            const item = ctl.straightBibleItems[0];
            const container = document.createElement('div');
            const target = document.createElement('div');
            target.dataset.verseKey = '(KJV) GEN 1:1';
            target.dataset.kjvVerseKey = 'GEN.1.1';
            container.appendChild(target);
            document.body.appendChild(container);
            const highlightSpy = vi.spyOn(
                ctl,
                'handleScreenBibleVersesHighlighting',
            );
            const syncSpy = vi.spyOn(ctl, 'syncBibleVerseSelection');
            ctl.handleVersesSelecting(target, false, true, item);
            expect(highlightSpy).toHaveBeenCalled();
            expect(syncSpy).not.toHaveBeenCalled();
            container.remove();
        });

        test('handleVersesHighlighting selects matching kjv verses', () => {
            const ctl = genController();
            const { target } = makeVerseDom('GEN.1.2');
            target.parentElement!.parentElement!.classList.add('bible-view');
            ctl.handleVersesHighlighting('GEN.1.2', true);
            target.remove();
        });

        test('syncBibleVerseSelection delegates to handleVersesSelecting', () => {
            const ctl = genController();
            const { target } = makeVerseDom();
            const spy = vi.spyOn(ctl, 'handleVersesSelecting');
            ctl.syncBibleVerseSelection(genItem(1), 'GEN.1.1', false);
            expect(spy).toHaveBeenCalled();
            target.remove();
        });
    });

    describe('exporting and misc', () => {
        test('getBibleItemsForExportingMSWord maps, sorts and filters', async () => {
            const ctl = genController();
            // two identical keys exercise the equal-branch of the sort;
            // the "skip" item is filtered out by BibleItem.fromVerseKey
            ctl.nestedBibleItems = [
                genItem(1, 'KJV'),
                genItem(1, 'KJV'),
                genItem(2, 'skip'),
            ];
            const items = await ctl.getBibleItemsForExportingMSWord();
            expect(items).toHaveLength(2);
        });

        test('finalRenderer throws when not implemented', () => {
            const ctl = genController();
            expect(() => ctl.finalRenderer(genItem(1))).toThrow(
                'not implemented',
            );
        });

        test('genBibleItemUniqueId returns a positive number', () => {
            const ctl = genController();
            expect(ctl.genBibleItemUniqueId()).toBeGreaterThan(0);
        });

        test('getStraightBibleItemsForExportingMSWord returns straight list', async () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            expect(
                await ctl.getStraightBibleItemsForExportingMSWord(),
            ).toHaveLength(1);
        });
    });

    describe('context hooks', () => {
        let container: HTMLDivElement;
        let root: Root | null = null;

        beforeEach(() => {
            (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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

        test('useBibleItemsViewControllerContext returns provided or throws', async () => {
            const ctl = genController();
            let seen: any = null;
            function Probe() {
                seen = useBibleItemsViewControllerContext();
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
                    useBibleItemsViewControllerContext();
                    return <span>ok</span>;
                } catch (error: any) {
                    return <span>{error.message}</span>;
                }
            }
            await act(async () => {
                root?.render(<ThrowProbe />);
            });
            expect(container.textContent).toContain('must be used within');
        });

        test('useBibleItemViewControllerUpdateEvent wires update events', async () => {
            const ctl = genController();
            ctl.nestedBibleItems = [genItem(1)];
            let capturedUpdate: any = null;
            (ctl as any).registerEventListener = vi.fn(
                (_evts: any, update: any) => {
                    capturedUpdate = update;
                    return ['evt'];
                },
            );
            (ctl as any).unregisterEventListener = vi.fn();
            h.useAppEffectMock.mockImplementation((cb: any) => {
                h.captured.effectCb = cb;
            });
            const callback = vi.fn();
            function Probe() {
                useBibleItemViewControllerUpdateEvent(callback);
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

            let cleanup: any;
            await act(async () => {
                cleanup = h.captured.effectCb();
            });
            expect(ctl.registerEventListener).toHaveBeenCalled();

            await act(async () => {
                capturedUpdate();
            });
            expect(callback).toHaveBeenCalled();

            await act(async () => {
                cleanup?.();
            });
            expect(ctl.unregisterEventListener).toHaveBeenCalled();
        });
    });
});
