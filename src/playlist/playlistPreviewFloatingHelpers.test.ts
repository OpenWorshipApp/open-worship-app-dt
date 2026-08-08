// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getSettingMock, setSettingMock, removeSettingMock } = vi.hoisted(
    () => ({
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        removeSettingMock: vi.fn(),
    }),
);

// Partial: only the three accessors are stubbed. The path→setting-name
// sanitizer is real, because the keys these tests assert on are the sanitized
// ones.
vi.mock('../helper/settingHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../helper/settingHelpers')>();
    return {
        ...actual,
        getSetting: getSettingMock,
        setSetting: setSettingMock,
        removeSetting: removeSettingMock,
    };
});

import PlaylistItem from './PlaylistItem';
import type { PlaylistActionIdType } from './playlistActionHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import {
    checkIsPlaylistPreviewItemExpanded,
    checkIsPlaylistPreviewItemSelected,
    requestPlaylistPreviewChildEntry,
    clearPlaylistPreviewSelectedItem,
    findNextPlaylistPreviewChildIndex,
    findNextPlaylistPreviewIndex,
    registerPlaylistPreviewChildStepping,
    stepPlaylistPreviewChild,
    resolvePlaylistPreviewSelectedChildIndex,
    resolvePlaylistPreviewSelectedIndex,
    setAllPlaylistPreviewItemsCollapsed,
    setPlaylistPreviewFilePath,
    setPlaylistPreviewItemCollapsed,
    setPlaylistPreviewSelectedChild,
    setPlaylistPreviewSelectedItem,
    toPlaylistPreviewItemKey,
} from './playlistPreviewFloatingHelpers';

const PLAYLIST_FILE_PATH = '/data/playlists/pl2.owp';
const SETTING_NAME = 'playlist-preview-collapsed-_data_playlists_pl2_owp';

function genActionItem(actionId: PlaylistActionIdType) {
    return PlaylistItem.fromJson(
        PLAYLIST_FILE_PATH,
        PlaylistItem.fromActionId(actionId),
    );
}

function genSlideItem(playlistFilePath = PLAYLIST_FILE_PATH, id = 3) {
    return PlaylistItem.fromJson(playlistFilePath, {
        type: DragTypeEnum.SLIDE,
        filePath: '/data/documents/aa.owj',
        id,
        title: `aa #${id}`,
    });
}

describe('playlist preview collapsing', () => {
    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('an element with no stored state is expanded', () => {
        const playlistItem = genSlideItem();
        expect(
            checkIsPlaylistPreviewItemExpanded(
                playlistItem.filePath,
                toPlaylistPreviewItemKey(playlistItem),
            ),
        ).toBe(true);
    });

    test('collapsing stores the key under the playlist file', () => {
        const playlistItem = genSlideItem();
        const itemKey = toPlaylistPreviewItemKey(playlistItem);
        setPlaylistPreviewItemCollapsed(playlistItem.filePath, itemKey, true);
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify([itemKey]),
        );
        expect(
            checkIsPlaylistPreviewItemExpanded(playlistItem.filePath, itemKey),
        ).toBe(false);
    });

    test('expanding the last collapsed element removes the setting', () => {
        const playlistItem = genSlideItem();
        const itemKey = toPlaylistPreviewItemKey(playlistItem);
        setPlaylistPreviewItemCollapsed(playlistItem.filePath, itemKey, true);
        setPlaylistPreviewItemCollapsed(playlistItem.filePath, itemKey, false);
        expect(removeSettingMock).toHaveBeenCalledWith(SETTING_NAME);
        expect(
            checkIsPlaylistPreviewItemExpanded(playlistItem.filePath, itemKey),
        ).toBe(true);
    });

    test('a stored state is read back for a playlist opened later', () => {
        const playlistItem = genSlideItem();
        const itemKey = toPlaylistPreviewItemKey(playlistItem);
        // A different playlist is looked at in between, so the answer cannot
        // come from what the previous playlist left in memory.
        getSettingMock.mockReturnValue(JSON.stringify([itemKey]));
        expect(
            checkIsPlaylistPreviewItemExpanded(
                '/data/playlists/pl1.owp',
                itemKey,
            ),
        ).toBe(false);
        expect(
            checkIsPlaylistPreviewItemExpanded(playlistItem.filePath, itemKey),
        ).toBe(false);
        // Only the collapsed element is folded.
        expect(
            checkIsPlaylistPreviewItemExpanded(
                playlistItem.filePath,
                toPlaylistPreviewItemKey(genSlideItem(PLAYLIST_FILE_PATH, 4)),
            ),
        ).toBe(true);
    });

    test('a damaged setting reads as everything expanded', () => {
        getSettingMock.mockReturnValue('}{ not json');
        const playlistItem = genSlideItem('/data/playlists/damaged.owp');
        expect(
            checkIsPlaylistPreviewItemExpanded(
                playlistItem.filePath,
                toPlaylistPreviewItemKey(playlistItem),
            ),
        ).toBe(true);
    });

    test('the same element in two playlists is remembered separately', () => {
        const playlistItem = genSlideItem();
        const itemKey = toPlaylistPreviewItemKey(playlistItem);
        setPlaylistPreviewItemCollapsed(playlistItem.filePath, itemKey, true);
        expect(
            checkIsPlaylistPreviewItemExpanded(
                '/data/playlists/pl1.owp',
                itemKey,
            ),
        ).toBe(true);
    });

    test('collapsing all folds every listed element in one write', () => {
        const itemKeys = [3, 4, 5].map((id) => {
            return toPlaylistPreviewItemKey(
                genSlideItem(PLAYLIST_FILE_PATH, id),
            );
        });
        setAllPlaylistPreviewItemsCollapsed(PLAYLIST_FILE_PATH, itemKeys, true);
        expect(setSettingMock).toHaveBeenCalledTimes(1);
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify(itemKeys),
        );
        for (const itemKey of itemKeys) {
            expect(
                checkIsPlaylistPreviewItemExpanded(PLAYLIST_FILE_PATH, itemKey),
            ).toBe(false);
        }
    });

    test('expanding all drops the setting rather than emptying it', () => {
        const itemKey = toPlaylistPreviewItemKey(genSlideItem());
        setAllPlaylistPreviewItemsCollapsed(
            PLAYLIST_FILE_PATH,
            [itemKey],
            true,
        );
        setAllPlaylistPreviewItemsCollapsed(
            PLAYLIST_FILE_PATH,
            [itemKey],
            false,
        );
        expect(removeSettingMock).toHaveBeenCalledWith(SETTING_NAME);
        expect(
            checkIsPlaylistPreviewItemExpanded(PLAYLIST_FILE_PATH, itemKey),
        ).toBe(true);
    });

    test('collapsing all forgets elements no longer in the playlist', () => {
        const goneItemKey = toPlaylistPreviewItemKey(
            genSlideItem(PLAYLIST_FILE_PATH, 9),
        );
        getSettingMock.mockReturnValue(JSON.stringify([goneItemKey]));
        const itemKey = toPlaylistPreviewItemKey(genSlideItem());
        setAllPlaylistPreviewItemsCollapsed(
            PLAYLIST_FILE_PATH,
            [itemKey],
            true,
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify([itemKey]),
        );
    });

    test('the key follows the element, not its position', () => {
        expect(toPlaylistPreviewItemKey(genSlideItem())).toBe(
            toPlaylistPreviewItemKey(genSlideItem()),
        );
        expect(toPlaylistPreviewItemKey(genSlideItem())).not.toBe(
            toPlaylistPreviewItemKey(genSlideItem(PLAYLIST_FILE_PATH, 4)),
        );
    });

    test("an action's key is its stored id, not its translated title", () => {
        const clearAll = genActionItem('clear-all');
        const clearSlide = genActionItem('clear-slide');
        expect(toPlaylistPreviewItemKey(clearAll)).toContain('clear-all');
        // The title is what the app has translated for the current language, so
        // a folded action would otherwise unfold itself when the language is
        // switched.
        expect(toPlaylistPreviewItemKey(clearAll)).not.toContain(
            clearAll.title,
        );
        expect(toPlaylistPreviewItemKey(clearAll)).not.toBe(
            toPlaylistPreviewItemKey(clearSlide),
        );
    });
});

function genDocumentItem() {
    return PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
        type: DragTypeEnum.APP_DOCUMENT,
        filePath: '/data/documents/bb.owj',
        data: '/data/documents/bb.owj',
        title: 'bb',
    });
}

function genDisabledSlideItem() {
    return PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
        type: DragTypeEnum.SLIDE,
        filePath: '/data/documents/aa.owj',
        id: 5,
        title: 'aa #5',
        isDisabled: true,
    });
}

function genDisabledDocumentItem() {
    return PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
        type: DragTypeEnum.APP_DOCUMENT,
        filePath: '/data/documents/cc.owj',
        data: '/data/documents/cc.owj',
        title: 'cc',
        isDisabled: true,
    });
}

function genAudioItem() {
    return PlaylistItem.fromJson(PLAYLIST_FILE_PATH, {
        type: DragTypeEnum.BACKGROUND_AUDIO,
        data: { src: 'file:///data/audios/cc.mp3' },
        title: 'cc.mp3',
    });
}

function select(playlistItems: PlaylistItem[], index: number) {
    setPlaylistPreviewSelectedItem(
        PLAYLIST_FILE_PATH,
        toPlaylistPreviewItemKey(playlistItems[index]),
        index,
    );
}

describe('playlist preview next-element stepping', () => {
    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
        clearPlaylistPreviewSelectedItem();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('nothing selected reads as "before the first element"', () => {
        const playlistItems = [genSlideItem()];
        expect(
            resolvePlaylistPreviewSelectedIndex(
                PLAYLIST_FILE_PATH,
                playlistItems,
            ),
        ).toBe(-1);
        expect(findNextPlaylistPreviewIndex(playlistItems, -1)).toBe(0);
    });

    test('the remembered element is found again', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        select(playlistItems, 1);
        expect(
            resolvePlaylistPreviewSelectedIndex(
                PLAYLIST_FILE_PATH,
                playlistItems,
            ),
        ).toBe(1);
    });

    test('another playlist does not inherit the selection', () => {
        const playlistItems = [genSlideItem()];
        select(playlistItems, 0);
        expect(
            resolvePlaylistPreviewSelectedIndex(
                '/data/playlists/pl1.owp',
                playlistItems,
            ),
        ).toBe(-1);
    });

    test('two identical entries are told apart by position', () => {
        const playlistItems = [genSlideItem(), genSlideItem()];
        select(playlistItems, 1);
        expect(
            resolvePlaylistPreviewSelectedIndex(
                PLAYLIST_FILE_PATH,
                playlistItems,
            ),
        ).toBe(1);
    });

    test('a reordered element is followed to its new position', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        select(playlistItems, 1);
        expect(
            resolvePlaylistPreviewSelectedIndex(PLAYLIST_FILE_PATH, [
                playlistItems[1],
                playlistItems[0],
            ]),
        ).toBe(0);
    });

    test('only ONE of two identical entries is marked', () => {
        const playlistItems = [genSlideItem(), genSlideItem()];
        const itemKey = toPlaylistPreviewItemKey(playlistItems[1]);
        select(playlistItems, 1);
        // They share a key, so the position is the only thing telling them
        // apart — marking both would show two cursors for one run.
        expect(
            checkIsPlaylistPreviewItemSelected(PLAYLIST_FILE_PATH, itemKey, 1),
        ).toBe(true);
        expect(
            checkIsPlaylistPreviewItemSelected(PLAYLIST_FILE_PATH, itemKey, 0),
        ).toBe(false);
    });

    test('a reorder repairs the stored position, so the mark comes back', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        const itemKey = toPlaylistPreviewItemKey(playlistItems[1]);
        select(playlistItems, 1);
        resolvePlaylistPreviewSelectedIndex(PLAYLIST_FILE_PATH, [
            playlistItems[1],
            playlistItems[0],
        ]);
        expect(
            checkIsPlaylistPreviewItemSelected(PLAYLIST_FILE_PATH, itemKey, 0),
        ).toBe(true);
    });

    test('a removed element reads as nothing selected', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        select(playlistItems, 1);
        expect(
            resolvePlaylistPreviewSelectedIndex(PLAYLIST_FILE_PATH, [
                playlistItems[0],
            ]),
        ).toBe(-1);
    });

    test('nothing is stepped over for being unshowable', () => {
        // PARKED is the only reason to pass a line by. Everything else takes the
        // cursor — including the two that do nothing when reached (an audio
        // track, which is played from its own panel, and a damaged entry), so
        // the operator can see where the run has got to.
        const playlistItems = [
            genSlideItem(),
            genDocumentItem(),
            genAudioItem(),
            PlaylistItem.fromJsonError(PLAYLIST_FILE_PATH, {}),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPlaylistPreviewIndex(playlistItems, 0)).toBe(1);
        expect(findNextPlaylistPreviewIndex(playlistItems, 1)).toBe(2);
        expect(findNextPlaylistPreviewIndex(playlistItems, 2)).toBe(3);
        expect(findNextPlaylistPreviewIndex(playlistItems, 3)).toBe(4);
    });

    test('a document is stopped on whether or not it is unfolded', () => {
        const playlistItems = [
            genSlideItem(),
            genDocumentItem(),
            genSlideItem(undefined, 4),
        ];
        // Being folded is how the operator READS the sheet — it says nothing
        // about what is in the run, and the landing unfolds it.
        expect(findNextPlaylistPreviewIndex(playlistItems, 0)).toBe(1);
    });

    test('the last element is the end — it does not wrap', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        expect(findNextPlaylistPreviewIndex(playlistItems, 1)).toBe(-1);
        expect(
            findNextPlaylistPreviewIndex([...playlistItems, genAudioItem()], 2),
        ).toBe(-1);
    });

    test('an element walks its own slides before the run leaves it', () => {
        const varySlides = [
            { isDisabled: false },
            { isDisabled: true },
            { isDisabled: false },
        ];
        // Nothing of it showing yet: it opens at its first slide.
        expect(findNextPlaylistPreviewChildIndex(varySlides, -1)).toBe(0);
        // A disabled slide is passed over, exactly as the presenter passes it.
        expect(findNextPlaylistPreviewChildIndex(varySlides, 0)).toBe(2);
        // Its last slide is showing — the run may now move to the next element.
        expect(findNextPlaylistPreviewChildIndex(varySlides, 2)).toBe(-1);
    });

    test('an element whose only remaining slides are disabled is finished', () => {
        expect(
            findNextPlaylistPreviewChildIndex(
                [{ isDisabled: false }, { isDisabled: true }],
                0,
            ),
        ).toBe(-1);
    });

    test('a slide the RUN SHEET parked is skipped like a document-disabled one', () => {
        const varySlides = [
            { isDisabled: false },
            { isDisabled: false },
            { isDisabled: false },
        ];
        // The slide itself says nothing — only the playlist knows it is parked.
        const checkIsDisabled = (index: number) => {
            return index === 1;
        };
        expect(
            findNextPlaylistPreviewChildIndex(varySlides, 0, checkIsDisabled),
        ).toBe(2);
        expect(
            findNextPlaylistPreviewChildIndex(varySlides, 2, checkIsDisabled),
        ).toBe(-1);
    });

    test('a parked element is stepped over', () => {
        const playlistItems = [
            genSlideItem(),
            genDisabledSlideItem(),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPlaylistPreviewIndex(playlistItems, 0)).toBe(2);
    });

    test('a parked document is stepped over, slides or no slides', () => {
        const playlistItems = [
            genSlideItem(),
            genDisabledDocumentItem(),
            genSlideItem(undefined, 4),
        ];
        // A document is otherwise always stopped on now, so parked is the one
        // thing still keeping the run off it.
        expect(findNextPlaylistPreviewIndex(playlistItems, 0)).toBe(2);
    });

    test('a run sheet parked to its end does not wrap', () => {
        expect(
            findNextPlaylistPreviewIndex(
                [genSlideItem(), genDisabledSlideItem()],
                0,
            ),
        ).toBe(-1);
    });

    test('a registered stepping is reachable and drops on cleanup', () => {
        const stepping = vi.fn().mockReturnValue(true);
        const unregister = registerPlaylistPreviewChildStepping(2, stepping);
        const mouseEvent = new MouseEvent('click');
        expect(stepPlaylistPreviewChild(2, mouseEvent, false)).toBe(true);
        expect(stepping).toHaveBeenCalledWith(mouseEvent, false);
        // An element with nothing registered simply has nothing to walk.
        expect(stepPlaylistPreviewChild(3, mouseEvent, false)).toBe(false);
        unregister();
        expect(stepPlaylistPreviewChild(2, mouseEvent, false)).toBe(false);
    });

    test('crossing into an element is told apart from walking it', () => {
        const stepping = vi.fn().mockReturnValue(true);
        registerPlaylistPreviewChildStepping(4, stepping);
        const mouseEvent = new MouseEvent('click');
        stepPlaylistPreviewChild(4, mouseEvent, true);
        expect(stepping).toHaveBeenCalledWith(mouseEvent, true);
    });

    test('a re-registered position is not dropped by the old cleanup', () => {
        const oldStepping = vi.fn().mockReturnValue(true);
        const newStepping = vi.fn().mockReturnValue(true);
        const unregisterOld = registerPlaylistPreviewChildStepping(
            1,
            oldStepping,
        );
        registerPlaylistPreviewChildStepping(1, newStepping);
        unregisterOld();
        expect(
            stepPlaylistPreviewChild(1, new MouseEvent('click'), false),
        ).toBe(true);
        expect(oldStepping).not.toHaveBeenCalled();
        expect(newStepping).toHaveBeenCalled();
    });

    test('an element landed on while still loading is entered when it can be', async () => {
        const mouseEvent = new MouseEvent('click');
        requestPlaylistPreviewChildEntry(7, mouseEvent);
        const stepping = vi.fn().mockReturnValue(true);

        // Nothing happens until the slides actually arrive...
        expect(stepping).not.toHaveBeenCalled();
        registerPlaylistPreviewChildStepping(7, stepping);
        // ...and then a macrotask later, not inside the mount that registered it.
        expect(stepping).not.toHaveBeenCalled();
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(stepping).toHaveBeenCalledWith(mouseEvent, true);

        // Spent: a later re-register must not enter it all over again.
        const laterStepping = vi.fn().mockReturnValue(true);
        registerPlaylistPreviewChildStepping(7, laterStepping);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(laterStepping).not.toHaveBeenCalled();
    });

    test('the run moving on drops an entry that had not happened yet', async () => {
        const playlistItems = [genSlideItem(), genDocumentItem()];
        requestPlaylistPreviewChildEntry(8, new MouseEvent('click'));
        // The operator stepped somewhere else while the document was loading.
        select(playlistItems, 0);

        const stepping = vi.fn().mockReturnValue(true);
        registerPlaylistPreviewChildStepping(8, stepping);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(stepping).not.toHaveBeenCalled();
    });

    test('closing the widget forgets where the run had got to', () => {
        const playlistItems = [genSlideItem()];
        setPlaylistPreviewFilePath(PLAYLIST_FILE_PATH);
        select(playlistItems, 0);
        setPlaylistPreviewFilePath(null);
        expect(
            resolvePlaylistPreviewSelectedIndex(
                PLAYLIST_FILE_PATH,
                playlistItems,
            ),
        ).toBe(-1);
    });
});

describe('playlist preview slide cursor', () => {
    const VARY_SLIDES = [
        { id: 1, isDisabled: false },
        { id: 5, isDisabled: false },
        { id: 9, isDisabled: false },
    ];

    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
        clearPlaylistPreviewSelectedItem();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    function selectChild(
        playlistItems: PlaylistItem[],
        index: number,
        childId: number,
    ) {
        select(playlistItems, index);
        setPlaylistPreviewSelectedChild(
            PLAYLIST_FILE_PATH,
            toPlaylistPreviewItemKey(playlistItems[index]),
            index,
            childId,
        );
    }

    function resolveChild(
        playlistItems: PlaylistItem[],
        index: number,
        varySlides = VARY_SLIDES,
    ) {
        return resolvePlaylistPreviewSelectedChildIndex(
            PLAYLIST_FILE_PATH,
            toPlaylistPreviewItemKey(playlistItems[index]),
            index,
            varySlides,
        );
    }

    test('nothing on the cursor reads as "before the first slide"', () => {
        const playlistItems = [genDocumentItem()];
        select(playlistItems, 0);
        expect(resolveChild(playlistItems, 0)).toBe(-1);
        expect(findNextPlaylistPreviewChildIndex(VARY_SLIDES, -1)).toBe(0);
    });

    test('the remembered slide is found again by its id', () => {
        const playlistItems = [genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        expect(resolveChild(playlistItems, 0)).toBe(1);
    });

    test('a slide inserted ahead of it does not shift the cursor', () => {
        const playlistItems = [genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        expect(
            resolveChild(playlistItems, 0, [
                { id: 2, isDisabled: false },
                ...VARY_SLIDES,
            ]),
        ).toBe(2);
    });

    test('a slide edited away reads as nothing on the cursor', () => {
        const playlistItems = [genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        expect(
            resolveChild(playlistItems, 0, [
                { id: 1, isDisabled: false },
                { id: 9, isDisabled: false },
            ]),
        ).toBe(-1);
    });

    test('moving the run to another element forgets the slide', () => {
        const playlistItems = [genDocumentItem(), genSlideItem()];
        selectChild(playlistItems, 0, 9);
        select(playlistItems, 1);
        select(playlistItems, 0);
        expect(resolveChild(playlistItems, 0)).toBe(-1);
    });

    test('an element the run is not on cannot move the cursor', () => {
        const playlistItems = [genDocumentItem(), genSlideItem()];
        selectChild(playlistItems, 0, 5);
        // A re-render of the other element, while the run sits on the first:
        // refused, or the cursor would move out from under the operator.
        setPlaylistPreviewSelectedChild(
            PLAYLIST_FILE_PATH,
            toPlaylistPreviewItemKey(playlistItems[1]),
            1,
            9,
        );
        expect(resolveChild(playlistItems, 0)).toBe(1);
    });

    test('the second copy of a twice-listed document is not the first', () => {
        const playlistItems = [genDocumentItem(), genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        // Same key, different position — the cursor belongs to the copy that
        // was clicked, and only that one may answer for it or write to it.
        expect(resolveChild(playlistItems, 1)).toBe(-1);
        setPlaylistPreviewSelectedChild(
            PLAYLIST_FILE_PATH,
            toPlaylistPreviewItemKey(playlistItems[1]),
            1,
            9,
        );
        expect(resolveChild(playlistItems, 0)).toBe(1);
    });

    test('another playlist does not inherit the slide cursor', () => {
        const playlistItems = [genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        expect(
            resolvePlaylistPreviewSelectedChildIndex(
                '/data/playlists/pl1.owp',
                toPlaylistPreviewItemKey(playlistItems[0]),
                0,
                VARY_SLIDES,
            ),
        ).toBe(-1);
    });

    test('closing the widget forgets the slide too', () => {
        const playlistItems = [genDocumentItem()];
        setPlaylistPreviewFilePath(PLAYLIST_FILE_PATH);
        selectChild(playlistItems, 0, 5);
        setPlaylistPreviewFilePath(null);
        expect(resolveChild(playlistItems, 0)).toBe(-1);
    });

    test('the cursor is what the next slide is found from', () => {
        const playlistItems = [genDocumentItem()];
        selectChild(playlistItems, 0, 5);
        const fromIndex = resolveChild(playlistItems, 0);
        expect(findNextPlaylistPreviewChildIndex(VARY_SLIDES, fromIndex)).toBe(
            2,
        );
    });
});
