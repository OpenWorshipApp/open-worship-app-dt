// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getSettingMock, setSettingMock, removeSettingMock } = vi.hoisted(
    () => ({
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        removeSettingMock: vi.fn(),
    }),
);

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
    removeSetting: removeSettingMock,
}));

import PlaylistItem from './PlaylistItem';
import type { PlaylistActionIdType } from './playlistActionHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import {
    checkIsPlaylistPreviewItemExpanded,
    checkPlaylistPreviewHasChildren,
    clearPlaylistPreviewSelectedItem,
    findNextPlaylistPreviewChildIndex,
    findNextPlaylistPreviewIndex,
    registerPlaylistPreviewChildStepping,
    stepPlaylistPreviewChild,
    resolvePlaylistPreviewSelectedIndex,
    setAllPlaylistPreviewItemsCollapsed,
    setPlaylistPreviewFilePath,
    setPlaylistPreviewItemCollapsed,
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

    test('a removed element reads as nothing selected', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        select(playlistItems, 1);
        expect(
            resolvePlaylistPreviewSelectedIndex(PLAYLIST_FILE_PATH, [
                playlistItems[0],
            ]),
        ).toBe(-1);
    });

    test('the kinds a screen cannot take are stepped over', () => {
        const playlistItems = [
            genSlideItem(),
            genDocumentItem(),
            genAudioItem(),
            PlaylistItem.fromJsonError(PLAYLIST_FILE_PATH, {}),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPlaylistPreviewIndex(playlistItems, 0)).toBe(4);
    });

    test('a document whose slides are loaded is stopped on, not stepped over', () => {
        const playlistItems = [
            genSlideItem(),
            genDocumentItem(),
            genSlideItem(undefined, 4),
        ];
        const checkIsEnterable = (index: number) => {
            return index === 1;
        };
        expect(
            findNextPlaylistPreviewIndex(playlistItems, 0, checkIsEnterable),
        ).toBe(1);
        // Folded away (nothing registered), it is passed over as before.
        expect(
            findNextPlaylistPreviewIndex(playlistItems, 0, () => {
                return false;
            }),
        ).toBe(2);
    });

    test('the last element is the end — it does not wrap', () => {
        const playlistItems = [genSlideItem(), genSlideItem(undefined, 4)];
        expect(findNextPlaylistPreviewIndex(playlistItems, 1)).toBe(-1);
        // ...and neither does a trailing element no screen can take.
        expect(
            findNextPlaylistPreviewIndex([...playlistItems, genAudioItem()], 1),
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

    test('a registered stepping is reachable and drops on cleanup', () => {
        const stepping = vi.fn().mockReturnValue(true);
        const unregister = registerPlaylistPreviewChildStepping(2, stepping);
        expect(checkPlaylistPreviewHasChildren(2)).toBe(true);
        const mouseEvent = new MouseEvent('click');
        expect(stepPlaylistPreviewChild(2, mouseEvent, false)).toBe(true);
        expect(stepping).toHaveBeenCalledWith(mouseEvent, false);
        // An element with nothing registered simply has nothing to walk.
        expect(stepPlaylistPreviewChild(3, mouseEvent, false)).toBe(false);
        unregister();
        expect(checkPlaylistPreviewHasChildren(2)).toBe(false);
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
        expect(checkPlaylistPreviewHasChildren(1)).toBe(true);
        stepPlaylistPreviewChild(1, new MouseEvent('click'), false);
        expect(oldStepping).not.toHaveBeenCalled();
        expect(newStepping).toHaveBeenCalled();
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
