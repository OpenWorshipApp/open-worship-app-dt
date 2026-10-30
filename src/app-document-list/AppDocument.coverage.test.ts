// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SlidePropsType } from './Slide';

/**
 * `AppDocument` and its real base class, over an in-memory editing history.
 *
 * The history is the boundary faked here: the head an editor reads and writes,
 * and the saved file only Save touches. Everything above it -- the base class's
 * pending-write tracking, `Slide`, the document's slide operations -- is the
 * real code.
 */

type HistoryStateType = {
    original: string | null;
    entries: string[];
    index: number;
    // While set, `addHistory` stalls on it: a slow disk write.
    gate: Promise<void> | null;
};

const mocks = vi.hoisted(() => {
    const histories = new Map<string, HistoryStateType>();
    const getHistory = (filePath: string) => {
        let state = histories.get(filePath);
        if (state === undefined) {
            state = { original: null, entries: [], index: 0, gate: null };
            histories.set(filePath, state);
        }
        return state;
    };
    const fileSources = new Map<string, any>();
    const getFileSource = (filePath: string) => {
        let fileSource = fileSources.get(filePath);
        if (fileSource === undefined) {
            const fullName = filePath.split('/').at(-1) ?? filePath;
            const dotIndex = fullName.lastIndexOf('.');
            fileSource = {
                filePath,
                fullName,
                name: dotIndex === -1 ? fullName : fullName.slice(0, dotIndex),
                extension: dotIndex === -1 ? '' : fullName.slice(dotIndex + 1),
                fireUpdateEvent: vi.fn(),
            };
            fileSources.set(filePath, fileSource);
        }
        return fileSource;
    };
    return {
        histories,
        getHistory,
        fileSources,
        getFileSource,
        // The order history operations reached the history in.
        log: [] as string[],
        appProviderMock: {
            appDocumentEditorHomePage: '/app-document-editor.html',
        },
        checkIsImagesInClipboardMock: vi.fn(),
        createNewFileDetailMock: vi.fn(),
        createNewSlidesFromDroppedDataMock: vi.fn(),
        fsCheckFileExistMock: vi.fn(),
        genSelectedSlidesContextMenuItemsMock: vi.fn(),
        genSlideContextMenuItemsMock: vi.fn(),
        getBibleFontFamilyMock: vi.fn(),
        getDefaultScreenDisplayMock: vi.fn(),
        getFontFamiliesMock: vi.fn(),
        getSelectedVaryAppDocumentMock: vi.fn(),
        handleErrorMock: vi.fn(),
        notifyElementHighlightMock: vi.fn(),
        openPopupWindowMock: vi.fn(),
        readImagesFromClipboardMock: vi.fn(),
        readTextFromClipboardMock: vi.fn(),
        setParamFileFullNameMock: vi.fn(),
        setParamIdNumMock: vi.fn(),
        showAppAlertMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
        writeTextToClipboardMock: vi.fn(),
    };
});

vi.mock('../editing-manager/EditingHistoryManager', () => {
    // Plain functions, not `vi.fn`: the config's `mockReset` would wipe them.
    const getInstance = (filePath: string) => {
        const state = mocks.getHistory(filePath);
        const getHead = () => {
            return state.entries.length > 0
                ? state.entries[state.index]
                : state.original;
        };
        return {
            async getOriginalData() {
                return state.original;
            },
            async getCurrentHistory() {
                return getHead();
            },
            async addHistory(dataText: string) {
                mocks.log.push('addHistory:start');
                if (state.gate !== null) {
                    await state.gate;
                }
                if (state.entries.length === 0) {
                    state.entries = [state.original ?? ''];
                    state.index = 0;
                }
                state.entries = state.entries.slice(0, state.index + 1);
                state.entries.push(dataText);
                state.index = state.entries.length - 1;
                mocks.log.push('addHistory:end');
            },
            async undo() {
                mocks.log.push('undo');
                if (state.index === 0) {
                    return false;
                }
                state.index -= 1;
                return true;
            },
            async redo() {
                mocks.log.push('redo');
                if (state.index >= state.entries.length - 1) {
                    return false;
                }
                state.index += 1;
                return true;
            },
            async discard() {
                mocks.log.push('discard');
                state.entries = [];
                state.index = 0;
                return true;
            },
            async save(sanitizeData?: (data: string) => string | null) {
                mocks.log.push('save');
                let dataText = getHead();
                if (dataText !== null && sanitizeData !== undefined) {
                    dataText = sanitizeData(dataText);
                }
                if (dataText === null) {
                    return false;
                }
                state.original = dataText;
                return true;
            },
            async deleteHistories() {
                state.entries = [];
                state.index = 0;
            },
        };
    };
    return { default: { getInstance } };
});

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => mocks.getFileSource(filePath),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: mocks.fsCheckFileExistMock,
    createNewFileDetail: mocks.createNewFileDetailMock,
    getMimetypeExtensions: (mimetypeName: string) => {
        return mimetypeName === 'appDocument' ? ['ows'] : [];
    },
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: vi.fn() },
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../server/appProvider', () => ({ default: mocks.appProviderMock }));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: mocks.getDefaultScreenDisplayMock,
}));

vi.mock('../server/fontHelpers', () => ({
    getFontFamilies: mocks.getFontFamiliesMock,
}));

vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        genDefaultItem: () => {
            const props = {
                id: 0,
                type: 'text',
                left: 0,
                top: 0,
                width: 700,
                height: 400,
            };
            return {
                props,
                applyProps: (newProps: object) => {
                    Object.assign(props, newProps);
                },
                toJson: () => ({ ...props }),
            };
        },
    },
}));

vi.mock('./appDocumentHelpers', () => ({
    genSelectedSlidesContextMenuItems:
        mocks.genSelectedSlidesContextMenuItemsMock,
    genSlideContextMenuItems: mocks.genSlideContextMenuItemsMock,
    getSelectedVaryAppDocument: mocks.getSelectedVaryAppDocumentMock,
}));

vi.mock('./appDocumentTypeHelpers', () => ({}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));

vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (iconName: string) => iconName,
}));

vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: mocks.checkIsImagesInClipboardMock,
    readImagesFromClipboard: mocks.readImagesFromClipboardMock,
}));

vi.mock('../app-document-presenter/items/appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'data-vary-app-document-item',
    createNewSlidesFromDroppedData: mocks.createNewSlidesFromDroppedDataMock,
}));

vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: mocks.notifyElementHighlightMock,
    openPopupWindow: mocks.openPopupWindowMock,
    setParamFileFullName: mocks.setParamFileFullNameMock,
    setParamIdNum: mocks.setParamIdNumMock,
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: mocks.getBibleFontFamilyMock,
}));

vi.mock('../server/clipboardHelpers', () => ({
    readTextFromClipboard: mocks.readTextFromClipboardMock,
    writeTextToClipboard: mocks.writeTextToClipboardMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: mocks.showAppAlertMock,
}));

import AppDocument, {
    checkIsAppDocumentSelected,
    openAppDocumentEditorExternal,
} from './AppDocument';
import Slide from './Slide';

const DOC_PATH = '/docs/service.ows';
const META = {
    app: 'OpenWorship',
    fileVersion: 1,
    initDate: '2026-10-01T00:00:00.000Z',
};
const DISPLAY_1080 = {
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};
const DISPLAY_720 = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1280, height: 720 },
};

function uuidFor(slideId: number, itemId: number) {
    return (
        '10000000-0000-4000-8000-' +
        slideId.toString(16).padStart(6, '0') +
        itemId.toString(16).padStart(6, '0')
    );
}

function genItem(
    slideId: number,
    itemId: number,
    extra: Record<string, unknown> = {},
) {
    return {
        id: itemId,
        uuid: uuidFor(slideId, itemId),
        type: 'text',
        text: 'Words',
        fontSize: 40,
        ...extra,
    } as unknown as SlidePropsType['canvasItems'][number];
}

function genSlideJson(
    id: number,
    name: string,
    extra: Partial<SlidePropsType> = {},
): SlidePropsType {
    return {
        id,
        name,
        metadata: { width: 1920, height: 1080 },
        canvasItems: [],
        type: 'slide',
        ...extra,
    };
}

function toDocText(items: SlidePropsType[]) {
    return JSON.stringify({ metadata: META, items });
}

/** The saved file, and optionally a head the editing history moved on to. */
function seedDocument(
    filePath: string,
    savedItems: SlidePropsType[],
    headItems?: SlidePropsType[],
) {
    const state = mocks.getHistory(filePath);
    state.original = toDocText(savedItems);
    if (headItems !== undefined) {
        state.entries = [state.original, toDocText(headItems)];
        state.index = 1;
    }
}

function readHead(filePath = DOC_PATH): SlidePropsType[] {
    const state = mocks.getHistory(filePath);
    const dataText =
        state.entries.length > 0 ? state.entries[state.index] : state.original;
    return JSON.parse(dataText ?? 'null').items;
}

function readSaved(filePath = DOC_PATH): SlidePropsType[] {
    return JSON.parse(mocks.getHistory(filePath).original ?? 'null').items;
}

function toNames(items: { name?: string }[]) {
    return items.map((item) => item.name);
}

function toIds(items: { id: number }[]) {
    return items.map((item) => item.id);
}

function getLastMenuItems() {
    const [, menuItems] = mocks.showAppContextMenuMock.mock.lastCall as [
        unknown,
        { menuElement: string; onSelect?: () => unknown }[],
    ];
    return menuItems;
}

function flushPendingWork() {
    // Every hop the document makes is a microtask; one macrotask lets them
    // all run until something waits on a timer or a gate.
    return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
    mocks.histories.clear();
    mocks.fileSources.clear();
    mocks.log.length = 0;
    mocks.getDefaultScreenDisplayMock.mockReturnValue(DISPLAY_1080);
    mocks.getFontFamiliesMock.mockResolvedValue(['arial']);
    mocks.fsCheckFileExistMock.mockResolvedValue(true);
    mocks.setParamFileFullNameMock.mockImplementation(
        (pathname: string, fileFullName: string) => {
            return `${pathname}?file=${fileFullName}`;
        },
    );
    mocks.setParamIdNumMock.mockImplementation(
        (pathname: string, id: number) => {
            return `${pathname}&id=${id}`;
        },
    );
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('AppDocument reads and writes the editing-history head', () => {
    test('slides come from the head, and the saved file decides which are unsaved', async () => {
        seedDocument(
            DOC_PATH,
            [genSlideJson(1, 'A'), genSlideJson(2, 'B')],
            [
                genSlideJson(1, 'A'),
                genSlideJson(2, 'B edited'),
                genSlideJson(3, 'C new'),
            ],
        );
        const appDocument = new AppDocument(DOC_PATH);

        const slides = await appDocument.getSlides();

        expect(toNames(slides)).toEqual(['A', 'B edited', 'C new']);
        // Unchanged, edited, and not in the saved file at all.
        expect(slides.map((slide) => slide.isChanged)).toEqual([
            false,
            true,
            true,
        ]);
        expect(toNames((await appDocument.getJsonData(true)).items)).toEqual([
            'A',
            'B',
        ]);
    });

    test('a head that cannot be parsed falls back to the saved file without a reset', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A')]);
        const state = mocks.getHistory(DOC_PATH);
        state.entries = [state.original as string, '{ not json'];
        state.index = 1;
        const appDocument = new AppDocument(DOC_PATH);

        const jsonData = await appDocument.getJsonData();

        expect(toNames(jsonData.items)).toEqual(['A']);
        expect(mocks.showSimpleToastMock).not.toHaveBeenCalled();
        expect(mocks.log).toEqual([]);
    });

    test('an edit lands in the history only, until Save writes the head to the file', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A'), genSlideJson(2, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.addNewSlide();

        expect(toIds(readHead())).toEqual([1, 2, 3]);
        expect(toIds(readSaved())).toEqual([1, 2]);

        expect(await appDocument.save()).toBe(true);

        expect(toIds(readSaved())).toEqual([1, 2, 3]);
        const savedMetadata = JSON.parse(
            mocks.getHistory(DOC_PATH).original as string,
        ).metadata;
        expect(Number.isNaN(Date.parse(savedMetadata.lastEditDate))).toBe(
            false,
        );
        expect(mocks.log).toEqual([
            'addHistory:start',
            'addHistory:end',
            'save',
        ]);
    });

    test('an undo pressed straight after a fire-and-forget slide update takes back that update', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A'), genSlideJson(2, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);
        const [, slideB] = await appDocument.getSlides();
        slideB.name = 'B nudged';
        let releaseWrite = () => {};
        mocks.getHistory(DOC_PATH).gate = new Promise<void>((resolve) => {
            releaseWrite = resolve;
        });

        // The canvas does not await its update; Ctrl+Z comes in the same breath.
        const updating = appDocument.updateSlide(slideB);
        const undoing = appDocument.historyUndo();
        await flushPendingWork();

        // The write is under way and the undo is still waiting for it.
        expect(mocks.log).toEqual(['addHistory:start']);

        releaseWrite();
        await Promise.all([updating, undoing]);

        expect(mocks.log).toEqual([
            'addHistory:start',
            'addHistory:end',
            'undo',
        ]);
        // Took back the nudge, not the edit before it.
        expect(toNames(readHead())).toEqual(['A', 'B']);
        await appDocument.historyRedo();
        expect(toNames(readHead())).toEqual(['A', 'B nudged']);
    });
});

describe('AppDocument.getSlides', () => {
    test('resolves every Bible font once before the slides are drawn', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A', {
                canvasItems: [
                    genItem(1, 1, { type: 'bible', bibleKeys: ['KJV', 'NIV'] }),
                    genItem(1, 2, { type: 'bible' }),
                ],
            }),
            genSlideJson(2, 'B', {
                canvasItems: [
                    genItem(2, 1, { type: 'bible', bibleKeys: ['KJV'] }),
                    genItem(2, 2, { bibleKeys: ['IGNORED'] }),
                ],
            }),
        ]);

        await new AppDocument(DOC_PATH).getSlides();

        expect(mocks.getBibleFontFamilyMock.mock.calls).toEqual([
            ['KJV'],
            ['NIV'],
        ]);
    });

    test('a slide that cannot be built is toasted and kept as an error slide', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A'), genSlideJson(2, 'B')]);
        vi.spyOn(Slide, 'fromJson').mockImplementationOnce(() => {
            throw new Error('Broken slide');
        });

        const slides = await new AppDocument(DOC_PATH).getSlides();

        expect(mocks.showSimpleToastMock).toHaveBeenCalledExactlyOnceWith(
            'Instantiating Slide',
            'Broken slide',
        );
        expect(slides.map((slide) => slide.isError)).toEqual([true, false]);
        expect(slides[0].toJson()).toMatchObject({ id: 1, name: 'A' });
        expect(slides[1].name).toBe('B');
    });

    test('lists each missing font once across every slide', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A', {
                canvasItems: [
                    genItem(1, 1, { fontFamily: 'Arial' }),
                    genItem(1, 2, { fontFamily: 'Missing One' }),
                ],
            }),
            genSlideJson(2, 'B', {
                canvasItems: [
                    genItem(2, 1, { fontFamily: 'Missing One' }),
                    genItem(2, 2, { fontFamily: 'Missing Two' }),
                ],
            }),
        ]);

        expect(
            await new AppDocument(DOC_PATH).getMissingFontFamilyList(),
        ).toEqual(['Missing One', 'Missing Two']);
    });
});

describe('AppDocument slide lookups', () => {
    test('finds a slide by index, by id and by identity', async () => {
        seedDocument(DOC_PATH, [genSlideJson(4, 'A'), genSlideJson(9, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);

        expect((await appDocument.getSlideByIndex(1))?.name).toBe('B');
        expect(await appDocument.getSlideByIndex(2)).toBeNull();
        expect((await appDocument.getItemById(4))?.name).toBe('A');
        expect(await appDocument.getItemById(5)).toBeNull();
        const outsider = new Slide(DOC_PATH, genSlideJson(5, 'X'));
        expect(await appDocument.getSlideIndex(outsider)).toBe(-1);
        expect(await appDocument.getMaxSlideId()).toBe(9);
        expect(() => {
            appDocument.setItemById(4, outsider);
        }).toThrow('Method not implemented.');
    });

    test('an empty document has no max slide id', async () => {
        seedDocument(DOC_PATH, []);

        expect(await new AppDocument(DOC_PATH).getMaxSlideId()).toBe(0);
    });
});

describe('AppDocument slide mutations', () => {
    test('updateSlide writes a slide in its own place and ignores a stranger', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A'), genSlideJson(2, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);
        const stranger = new Slide(DOC_PATH, genSlideJson(7, 'Z'));

        await appDocument.updateSlide(stranger);
        expect(mocks.log).toEqual([]);

        const [slideA] = await appDocument.getSlides();
        slideA.name = 'A renamed';
        await appDocument.updateSlide(slideA);

        expect(toNames(readHead())).toEqual(['A renamed', 'B']);
    });

    test('duplicating nothing, or a slide that is not in the document, writes nothing', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A')]);
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.duplicateSlides([]);
        await appDocument.duplicateSlides([
            new Slide(DOC_PATH, genSlideJson(8, 'X')),
        ]);

        expect(mocks.log).toEqual([]);
    });

    test('moveSlideToIndex moves a slide and highlights it, but not out of range or onto itself', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B'),
            genSlideJson(3, 'C'),
        ]);
        const appDocument = new AppDocument(DOC_PATH);
        const slides = await appDocument.getSlides();

        await appDocument.moveSlideToIndex(slides[0], -1);
        await appDocument.moveSlideToIndex(slides[0], 3);
        await appDocument.moveSlideToIndex(slides[1], 1);
        await appDocument.moveSlideToIndex(
            new Slide(DOC_PATH, genSlideJson(9, 'X')),
            0,
        );
        expect(mocks.log).toEqual([]);
        expect(mocks.notifyElementHighlightMock).not.toHaveBeenCalled();

        await appDocument.moveSlideToIndex(slides[0], 2);

        expect(toNames(readHead())).toEqual(['B', 'C', 'A']);
        expect(mocks.notifyElementHighlightMock).toHaveBeenCalledTimes(1);
    });

    test('a highlighted slide is found by its id among the cards', async () => {
        const card = document.createElement('div');
        card.className = 'data-vary-app-document-item';
        card.dataset.varyAppDocumentItemId = '12';
        document.body.append(card);
        const appDocument = new AppDocument(DOC_PATH);

        appDocument.notifyNewSlidesAdded([12, 13]);

        const getters = mocks.notifyElementHighlightMock.mock.calls.map(
            ([getter]) => getter as () => Element | null,
        );
        expect(getters).toHaveLength(2);
        expect(getters[0]()).toBe(card);
        expect(getters[1]()).toBeNull();
    });

    test('addSlides numbers new slides after the highest id, in this file, and announces each', async () => {
        seedDocument(DOC_PATH, [genSlideJson(3, 'A'), genSlideJson(7, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);
        const fromElsewhere = [
            new Slide('/docs/other.ows', genSlideJson(1, 'X')),
            new Slide('/docs/other.ows', genSlideJson(2, 'Y')),
        ];

        await appDocument.addSlides([]);
        expect(mocks.log).toEqual([]);

        await appDocument.addSlides(fromElsewhere);

        expect(toIds(readHead())).toEqual([3, 7, 8, 9]);
        expect(toNames(readHead())).toEqual(['A', 'B', 'X', 'Y']);
        expect(fromElsewhere.map((slide) => slide.filePath)).toEqual([
            DOC_PATH,
            DOC_PATH,
        ]);
        expect(mocks.notifyElementHighlightMock).toHaveBeenCalledTimes(2);
    });

    test('swapSlides swaps two slides in range and refuses any index out of it', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B'),
            genSlideJson(3, 'C'),
        ]);
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.swapSlides(-1, 1);
        await appDocument.swapSlides(3, 1);
        await appDocument.swapSlides(0, -1);
        await appDocument.swapSlides(0, 3);
        expect(mocks.log).toEqual([]);

        await appDocument.swapSlides(0, 2);

        expect(toNames(readHead())).toEqual(['C', 'B', 'A']);
        expect(mocks.notifyElementHighlightMock).toHaveBeenCalledTimes(2);
    });

    test('moveSlide wraps around both ends', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B'),
            genSlideJson(3, 'C'),
        ]);
        const appDocument = new AppDocument(DOC_PATH);
        const slideC = (await appDocument.getSlides())[2];

        await appDocument.moveSlide(slideC, true);
        expect(toNames(readHead())).toEqual(['C', 'A', 'B']);

        // Backward from the first lands on the LAST, not on index -1.
        const firstSlide = (await appDocument.getSlides())[0];
        await appDocument.moveSlide(firstSlide, false);
        expect(toNames(readHead())).toEqual(['A', 'B', 'C']);

        const before = mocks.log.length;
        await appDocument.moveSlide(
            new Slide(DOC_PATH, genSlideJson(9, 'X')),
            true,
        );
        expect(mocks.log).toHaveLength(before);
    });

    test('a new slide is sized to the default screen and numbered after the last', async () => {
        mocks.getDefaultScreenDisplayMock.mockReturnValue(DISPLAY_720);
        seedDocument(DOC_PATH, [genSlideJson(5, 'A')]);
        const appDocument = new AppDocument(DOC_PATH);

        const newSlide = await appDocument.genNewSlide();

        expect(newSlide.toJson()).toEqual({
            id: 6,
            metadata: { width: 1280, height: 720 },
            canvasItems: [],
            type: 'slide',
        });
        expect(newSlide.filePath).toBe(DOC_PATH);

        await appDocument.addNewSlide();
        expect(readHead()[1]).toMatchObject({
            id: 6,
            metadata: { width: 1280, height: 720 },
        });
    });

    test('deleteSlides removes only the slides named, and nothing for none', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B'),
            genSlideJson(3, 'C'),
        ]);
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.deleteSlides([]);
        expect(mocks.log).toEqual([]);

        const slides = await appDocument.getSlides();
        await appDocument.deleteSlides([slides[0], slides[2]]);

        expect(toNames(readHead())).toEqual(['B']);
    });
});

describe('AppDocument slide dimensions', () => {
    test('describes a wrong dimension in words', () => {
        expect(
            AppDocument.toWrongDimensionString({
                slide: { width: 1920, height: 1080 },
                display: { width: 1280, height: 720 },
            }),
        ).toBe('⚠️ Slide: 1920x1080 Display: 1280x720');
    });

    test('reports the first slide that does not fit the display, or null', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B', { metadata: { width: 1280, height: 720 } }),
        ]);
        const appDocument = new AppDocument(DOC_PATH);

        const onWide = await appDocument.getIsWrongDimension(DISPLAY_1080);
        expect(onWide?.slide.width).toBe(1280);
        expect(onWide?.display).toEqual({ width: 1920, height: 1080 });

        const onSmall = await appDocument.getIsWrongDimension(DISPLAY_720);
        expect(onSmall?.slide.width).toBe(1920);

        seedDocument(DOC_PATH, [genSlideJson(1, 'A')]);
        expect(await appDocument.getIsWrongDimension(DISPLAY_1080)).toBeNull();
    });

    test('changeSlidesDimension resizes every slide, or only a target that is wrong', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A'), genSlideJson(2, 'B')]);
        const appDocument = new AppDocument(DOC_PATH);
        const small = { width: 1280, height: 720 };

        const [, slideB] = await appDocument.getSlides();
        await appDocument.changeSlidesDimension(small, slideB);
        expect(readHead().map((item) => item.metadata)).toEqual([
            { width: 1920, height: 1080 },
            small,
        ]);

        // Already the target size: left as it is.
        const [, resizedB] = await appDocument.getSlides();
        await appDocument.changeSlidesDimension(small, resizedB);
        expect(readHead()[1].metadata).toEqual(small);

        await appDocument.changeSlidesDimension({ width: 800, height: 600 });
        expect(readHead().map((item) => item.metadata)).toEqual([
            { width: 800, height: 600 },
            { width: 800, height: 600 },
        ]);
    });

    test('fixSlidesDimensionForDisplay fits only the slides that are wrong', async () => {
        seedDocument(DOC_PATH, [
            genSlideJson(1, 'A'),
            genSlideJson(2, 'B', {
                metadata: { width: 1280, height: 720, note: 'keep' },
            }),
        ]);

        await new AppDocument(DOC_PATH).fixSlidesDimensionForDisplay(
            DISPLAY_720,
        );

        expect(readHead().map((item) => item.metadata)).toEqual([
            { width: 1280, height: 720 },
            { width: 1280, height: 720, note: 'keep' },
        ]);
    });
});

describe('AppDocument.validate', () => {
    test('accepts a document and rejects a bad one with the reason', () => {
        expect(() => {
            AppDocument.validate({
                metadata: META,
                items: [genSlideJson(1, 'A')],
            });
        }).not.toThrow();
        expect(() => {
            AppDocument.validate({ metadata: META, items: {} });
        }).toThrow(TypeError);
        expect(() => {
            AppDocument.validate({ metadata: META, items: [{ id: 1 }] });
        }).toThrow('Invalid slide data json');
        expect(() => {
            AppDocument.validate({ metadata: { app: 1 }, items: [] });
        }).toThrow('Invalid data');
    });
});

describe('AppDocument context menus', () => {
    test("a slide's menu carries the selected-editing flag and the extras after it", () => {
        const appDocument = new AppDocument(DOC_PATH);
        const slide = new Slide(DOC_PATH, genSlideJson(1, 'A'));
        const event = { type: 'contextmenu' };
        const extra = { menuElement: 'Extra' };
        mocks.genSlideContextMenuItemsMock.mockReturnValue([
            { menuElement: 'Edit' },
        ]);

        appDocument.showSlideContextMenu(event, slide, [extra], true);

        expect(mocks.genSlideContextMenuItemsMock).toHaveBeenCalledWith(
            appDocument,
            slide,
            true,
        );
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledWith(event, [
            { menuElement: 'Edit' },
            extra,
        ]);

        appDocument.showSlideContextMenu(event, slide);
        expect(mocks.genSlideContextMenuItemsMock).toHaveBeenLastCalledWith(
            appDocument,
            slide,
            false,
        );
    });

    test('the held slides get the selection menu', () => {
        const appDocument = new AppDocument(DOC_PATH);
        const slides = [new Slide(DOC_PATH, genSlideJson(1, 'A'))];
        mocks.genSelectedSlidesContextMenuItemsMock.mockReturnValue([
            { menuElement: 'Delete Selected' },
        ]);

        appDocument.showHoldingSlidesContextMenu('event', slides);

        expect(
            mocks.genSelectedSlidesContextMenuItemsMock,
        ).toHaveBeenCalledWith(appDocument, slides);
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledWith('event', [
            { menuElement: 'Delete Selected' },
        ]);
    });

    test('with an empty clipboard the menu adds a slide or reloads', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A')]);
        mocks.checkIsImagesInClipboardMock.mockResolvedValue(false);
        mocks.readTextFromClipboardMock.mockResolvedValue(null);
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.showContextMenu('event', [{ menuElement: 'Extra' }]);

        const menuItems = getLastMenuItems();
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'New Slide',
            'Reload',
            'Extra',
        ]);
        menuItems[1].onSelect?.();
        expect(
            mocks.getFileSource(DOC_PATH).fireUpdateEvent,
        ).toHaveBeenCalledOnce();
        menuItems[0].onSelect?.();
        await flushPendingWork();
        expect(toIds(readHead())).toEqual([1, 2]);
    });

    test('copied slides and clipboard images add Paste and Paste Image', async () => {
        seedDocument(DOC_PATH, [genSlideJson(1, 'A')]);
        const copied = new Slide('/docs/other.ows', genSlideJson(4, 'Copied'));
        mocks.readTextFromClipboardMock.mockResolvedValue(
            ['not a slide', copied.clipboardSerialize(), ''].join('\n'),
        );
        mocks.checkIsImagesInClipboardMock.mockResolvedValue(true);
        const blobs = [new Blob(['1']), new Blob(['2'])];
        mocks.readImagesFromClipboardMock.mockImplementation(
            async function* () {
                yield* blobs;
            },
        );
        const appDocument = new AppDocument(DOC_PATH);

        await appDocument.showContextMenu('event');

        const menuItems = getLastMenuItems();
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Paste',
            'New Slide',
            'Reload',
            'Paste Image',
        ]);
        menuItems[0].onSelect?.();
        await flushPendingWork();
        expect(toNames(readHead())).toEqual(['A', 'Copied']);
        expect(readHead()[1].id).toBe(2);

        await menuItems[3].onSelect?.();
        expect(
            mocks.createNewSlidesFromDroppedDataMock,
        ).toHaveBeenCalledExactlyOnceWith(appDocument, blobs);
    });
});

describe('AppDocument clipboard', () => {
    test('copied slides go to the clipboard one per line and come back', async () => {
        const slides = [
            new Slide('/docs/a.ows', genSlideJson(1, 'A')),
            new Slide('/docs/a.ows', genSlideJson(2, 'B')),
        ];
        mocks.writeTextToClipboardMock.mockResolvedValue(true);

        await AppDocument.setCopiedSlides(slides);

        const [clipboardText] = mocks.writeTextToClipboardMock.mock
            .lastCall as [string];
        expect(clipboardText.split('\n')).toHaveLength(2);
        mocks.readTextFromClipboardMock.mockResolvedValue(clipboardText);
        const restored = await AppDocument.getCopiedSlides();
        expect(restored.map((slide) => slide.toJson())).toEqual(
            slides.map((slide) => slide.toJson()),
        );
        expect(restored.every((slide) => slide instanceof Slide)).toBe(true);
    });

    test('an empty clipboard holds no slides', async () => {
        mocks.readTextFromClipboardMock.mockResolvedValue(null);

        expect(await AppDocument.getCopiedSlides()).toEqual([]);
    });
});

describe('AppDocument creation and instances', () => {
    test('create writes one centred text slide and hands back the new file', async () => {
        mocks.createNewFileDetailMock.mockResolvedValue('/docs/New.ows');

        const fileSource = await AppDocument.create('/docs', 'New');

        expect(fileSource).toBe(mocks.getFileSource('/docs/New.ows'));
        const [dir, name, dataText, mimetypeName] = mocks
            .createNewFileDetailMock.mock.lastCall as [
            string,
            string,
            string,
            string,
        ];
        expect([dir, name, mimetypeName]).toEqual([
            '/docs',
            'New',
            'appDocument',
        ]);
        const jsonData = JSON.parse(dataText);
        expect(jsonData.metadata).toMatchObject({
            app: 'OpenWorship',
            fileVersion: 1,
        });
        expect(jsonData.items).toEqual([
            expect.objectContaining({
                id: 0,
                metadata: { width: 1920, height: 1080 },
                canvasItems: [expect.objectContaining({ left: 610, top: 340 })],
            }),
        ]);
    });

    test('a file that could not be made gives no document', async () => {
        mocks.createNewFileDetailMock.mockResolvedValue(null);

        expect(await AppDocument.create('/docs', 'New')).toBeNull();
    });

    test('createWithContent writes the given slides as they are', async () => {
        mocks.createNewFileDetailMock.mockResolvedValue('/docs/Imported.ows');
        const items = [genSlideJson(1, 'A'), genSlideJson(2, 'B')];

        const fileSource = await AppDocument.createWithContent(
            '/docs',
            'Imported',
            items,
        );

        expect(fileSource?.filePath).toBe('/docs/Imported.ows');
        const dataText = mocks.createNewFileDetailMock.mock.lastCall?.[2];
        expect(JSON.parse(dataText).items).toEqual(items);
    });

    test('getInstance hands out one instance per file and refuses a foreign extension', () => {
        const first = AppDocument.getInstance('/docs/instance-check.ows');

        expect(first).toBeInstanceOf(AppDocument);
        expect(AppDocument.getInstance('/docs/instance-check.ows')).toBe(first);
        expect(AppDocument.getInstance('/docs/other-check.ows')).not.toBe(
            first,
        );
        expect(() => AppDocument.getInstance('/docs/notes.txt')).toThrow(
            'File extension txt does not match expected extensions: ows',
        );
    });
});

describe('checkIsAppDocumentSelected', () => {
    test('is true only for an editable Open Worship document', async () => {
        mocks.getSelectedVaryAppDocumentMock.mockResolvedValue(
            new AppDocument(DOC_PATH),
        );
        expect(await checkIsAppDocumentSelected()).toBe(true);
        expect(mocks.showAppAlertMock).not.toHaveBeenCalled();
    });

    test.each([
        ['nothing selected', null],
        ['another kind of document', { filePath: '/docs/a.pdf' }],
    ])('alerts and refuses when %s', async (_label, selected) => {
        mocks.getSelectedVaryAppDocumentMock.mockResolvedValue(selected);

        expect(await checkIsAppDocumentSelected()).toBe(false);
        expect(mocks.showAppAlertMock).toHaveBeenCalledExactlyOnceWith(
            'No slide selected',
            'Please select an Open Worship slide first',
        );
    });

    test('alerts and refuses a document that cannot be edited', async () => {
        const readOnly = new AppDocument(DOC_PATH);
        readOnly.isEditable = false;
        mocks.getSelectedVaryAppDocumentMock.mockResolvedValue(readOnly);

        expect(await checkIsAppDocumentSelected()).toBe(false);
        expect(mocks.showAppAlertMock).toHaveBeenCalledOnce();
    });
});

describe('openAppDocumentEditorExternal', () => {
    test('opens the editor window on the file, and on one slide when asked', async () => {
        const appDocument = new AppDocument(DOC_PATH);

        await openAppDocumentEditorExternal(appDocument);

        expect(mocks.setParamIdNumMock).not.toHaveBeenCalled();
        expect(mocks.openPopupWindowMock).toHaveBeenLastCalledWith(
            '/app-document-editor.html?file=service.ows',
            expect.stringMatching(/^app_document_editor_\d+$/),
            'app_document_editor',
        );

        await openAppDocumentEditorExternal(appDocument, 3);

        expect(mocks.openPopupWindowMock).toHaveBeenLastCalledWith(
            '/app-document-editor.html?file=service.ows&id=3',
            expect.stringMatching(/^app_document_editor_\d+$/),
            'app_document_editor',
        );
    });
});
