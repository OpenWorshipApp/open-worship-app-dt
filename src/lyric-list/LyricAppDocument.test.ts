import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setLyricAppDocumentGetter: vi.fn(),
    genEditSlideContextMenuItem: vi.fn((onSelect: () => void) => ({
        key: 'edit',
        onSelect,
    })),
    getDefaultScreenDisplay: vi.fn(),
    showAppContextMenu: vi.fn(),
    handleSlideSelecting: vi.fn(),
    genShowOnScreensContextMenu: vi.fn((onSelect: (event: any) => void) => [
        { key: 'screens', onSelect },
    ]),
    getLyricStageStyle: vi.fn(),
    resolveLiveOpenLyric: vi.fn(),
    genLyricReloadContextMenuItem: vi.fn((onSelect: () => void) => ({
        key: 'reload',
        onSelect,
    })),
    openPopupLyricEditorWindow: vi.fn(),
    lyricGetInstance: vi.fn((filePath: string) => ({ filePath })),
    genLyricPlaySteps: vi.fn(),
    initOpenLyric: vi.fn(),
    genHtmlDefaultProps: vi.fn(() => ({ htmlDefault: true })),
}));

vi.mock('../app-document-list/AppDocument', () => ({
    default: class AppDocument {
        static instances = new Map<string, any>();
        filePath: string;
        fileSource = { fireUpdateEvent: vi.fn() };

        constructor(filePath: string) {
            this.filePath = filePath;
        }

        static _getInstance(filePath: string, create: () => unknown) {
            const existing = this.instances.get(`${this.name}:${filePath}`);
            if (existing) return existing;
            const instance = create();
            this.instances.set(`${this.name}:${filePath}`, instance);
            return instance;
        }
    },
}));

vi.mock('../app-document-list/appDocumentHelpers', () => ({
    genEditSlideContextMenuItem: mocks.genEditSlideContextMenuItem,
    setLyricAppDocumentGetter: mocks.setLyricAppDocumentGetter,
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: mocks.getDefaultScreenDisplay,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));

vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: { handleSlideSelecting: mocks.handleSlideSelecting },
}));

vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: mocks.genShowOnScreensContextMenu,
}));

vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_BLACK: '#000000' }));

vi.mock('../slide-editor/canvas/CanvasItemHtml', () => ({
    genHtmlDefaultProps: mocks.genHtmlDefaultProps,
}));

vi.mock('./lyricStageStyleHelpers', () => ({
    getLyricStageStyle: mocks.getLyricStageStyle,
}));

vi.mock('./lyricWarmSlidesHelpers', () => ({
    resolveLiveOpenLyric: mocks.resolveLiveOpenLyric,
}));

vi.mock('./lyricContextMenuHelpers', () => ({
    genLyricReloadContextMenuItem: mocks.genLyricReloadContextMenuItem,
}));

vi.mock('./lyricEditorHelpers', () => ({
    openPopupLyricEditorWindow: mocks.openPopupLyricEditorWindow,
}));

vi.mock('./Lyric', () => ({
    default: { getInstance: mocks.lyricGetInstance },
}));

vi.mock('./lyricStructureHelpers', () => ({
    genLyricPlaySteps: mocks.genLyricPlaySteps,
}));

vi.mock('./lyricHelpers', () => ({
    initOpenLyric: mocks.initOpenLyric,
}));

vi.mock('./LyricSlide', () => ({
    LYRIC_SLIDE_TYPE_KEY: 'lyric',
    default: class LyricSlide {
        id: number;
        constructor(
            public filePath: string,
            public props: any,
            public openLyricKey: string,
            public openLyricIndex = -1,
            public openLyricRepeat: unknown = null,
        ) {
            this.id = props.id;
        }

        toJson() {
            return { id: this.id, filePath: this.filePath };
        }
    },
}));

import LyricAppDocument, {
    OPEN_LYRIC_FIRST_KEY,
    OPEN_LYRIC_INFO_KEY,
    OPEN_LYRIC_NONE_KEY,
} from './LyricAppDocument';

const FILE_PATH = 'C:/songs/song.owl';
const DISPLAY_DIM = { width: 1920, height: 1080 };
const BOUNDS = { x: 19, y: 19, width: 1882, height: 1042 };

describe('LyricAppDocument', () => {
    beforeEach(() => {
        for (const mock of Object.values(mocks)) {
            if (mock !== mocks.setLyricAppDocumentGetter) mock.mockClear();
        }
        mocks.getDefaultScreenDisplay.mockReturnValue({
            bounds: { x: 0, y: 0, ...DISPLAY_DIM },
        });
        mocks.getLyricStageStyle.mockReturnValue({
            paddingPercentage: 1,
            customCss: '',
        });
        mocks.resolveLiveOpenLyric.mockReturnValue(null);
        mocks.genLyricPlaySteps.mockReturnValue([
            { key: 'verse-a', structureIndex: 2, repeat: null },
        ]);
        mocks.initOpenLyric.mockResolvedValue({ value: 'loaded from file' });
    });

    test('returns the cached document instance for a path', () => {
        const first = LyricAppDocument.getInstance(FILE_PATH);

        expect(first).toBeInstanceOf(LyricAppDocument);
        expect(LyricAppDocument.getInstance(FILE_PATH)).toBe(first);
        expect(first.filePath).toBe(FILE_PATH);
    });

    test('reads stage style and derives display and canvas bounds at call time', () => {
        const document = new LyricAppDocument(FILE_PATH);
        document.stage = 3;

        expect(document.stageStyle).toEqual({
            paddingPercentage: 1,
            customCss: '',
        });
        expect(mocks.getLyricStageStyle).toHaveBeenCalledWith(3);
        expect(document.displayDim).toEqual(DISPLAY_DIM);
        expect(document.canvasItemBounds).toEqual(BOUNDS);
    });

    test('builds transparent boxes, full-size images, and locked HTML items', () => {
        const document = new LyricAppDocument(FILE_PATH);

        expect(
            document.genCanvasItemBoundsProps(4, true, BOUNDS as any),
        ).toEqual({
            id: 4,
            top: 19,
            left: 19,
            rotate: 0,
            width: 1882,
            height: 1042,
            backgroundColor: '#00000000',
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            locked: true,
        });

        expect(
            document.genCanvasItemImageProps(5, { url: 'chart.png' } as any),
        ).toMatchObject({
            type: 'image',
            id: 5,
            srcData: { url: 'chart.png' },
            mediaWidth: DISPLAY_DIM.width - 2 * 19,
            mediaHeight: DISPLAY_DIM.height - 2 * 19,
        });

        expect(
            document.genCanvasItemHtmlProps(6, '<b>Verse</b>', BOUNDS as any),
        ).toMatchObject({
            htmlDefault: true,
            id: 6,
            locked: true,
            html: '<b>Verse</b>',
            type: 'html',
        });
    });

    test('wraps source markup in a lyric slide and uses empty markup for a cache miss', () => {
        const document = new LyricAppDocument(FILE_PATH);
        document.stage = 2;
        const dataMap = { chorus: '<i>Sing</i>' };

        const slide = document.genSlide(
            'chorus',
            4,
            dataMap,
            DISPLAY_DIM,
            7,
            { count: 2 } as any,
            BOUNDS,
        );
        expect(slide).toMatchObject({
            id: 4,
            filePath: FILE_PATH,
            openLyricKey: 'chorus',
            openLyricIndex: 7,
            openLyricRepeat: { count: 2 },
            props: {
                id: 4,
                type: 'lyric',
                stage: 2,
                metadata: DISPLAY_DIM,
                canvasItems: [expect.objectContaining({ html: '<i>Sing</i>' })],
            },
        });

        expect(
            document.genSlide('missing', 5, {}, DISPLAY_DIM, -1, null, BOUNDS),
        ).toMatchObject({
            props: { canvasItems: [expect.objectContaining({ html: '' })] },
        });
    });

    test('adds first, info, and none slides before the song and renumbers all slides', () => {
        const document = new LyricAppDocument(FILE_PATH);
        const songSlide = document.genLyricSlide(9, 'verse', [], DISPLAY_DIM);
        const firstItem = { id: 10, type: 'html' } as any;

        const slides = document.extendExtraSlide(
            [songSlide],
            { [OPEN_LYRIC_INFO_KEY]: 'About the song' },
            firstItem,
        );

        expect(slides.map((slide) => slide.id)).toEqual([0, 1, 2, 3]);
        expect(slides.map((slide) => slide.openLyricKey)).toEqual([
            OPEN_LYRIC_FIRST_KEY,
            OPEN_LYRIC_INFO_KEY,
            OPEN_LYRIC_NONE_KEY,
            'verse',
        ]);
        // `LyricSlide` is mocked above with a `props` field the real class does
        // not have, so the runtime shape is read through a cast.
        const mockedSlides = slides as unknown as {
            props: { canvasItems: { html?: string }[] };
        }[];
        expect(mockedSlides[0].props.canvasItems).toEqual([firstItem]);
        expect(mockedSlides[1].props.canvasItems[0].html).toBe(
            'About the song',
        );
        expect(mockedSlides[2].props.canvasItems).toEqual([]);
    });

    test('uses the live preview instance and loads the file only on a cold miss', async () => {
        const document = new LyricAppDocument(FILE_PATH);
        const live = { value: 'current preview' };
        mocks.resolveLiveOpenLyric.mockReturnValueOnce(live);

        await expect(document.getOpenLyricPreviewer()).resolves.toBe(live);
        expect(mocks.initOpenLyric).not.toHaveBeenCalled();

        await expect(document.getOpenLyricPreviewer()).resolves.toEqual({
            value: 'loaded from file',
        });
        expect(mocks.initOpenLyric).toHaveBeenCalledWith(FILE_PATH, true);
    });

    test('builds the quick play deck in structure order and prepends its special slides', async () => {
        const document = new LyricAppDocument(FILE_PATH);
        const preview = { parts: ['a'] };
        mocks.resolveLiveOpenLyric.mockReturnValue(preview);

        const slides = await document.getSlidesQuick();

        expect(mocks.genLyricPlaySteps).toHaveBeenCalledWith(preview);
        expect(slides.map((slide) => slide.openLyricKey)).toEqual([
            OPEN_LYRIC_FIRST_KEY,
            OPEN_LYRIC_INFO_KEY,
            OPEN_LYRIC_NONE_KEY,
            'verse-a',
        ]);
        expect(slides[3]).toMatchObject({ openLyricIndex: 2 });
        await expect(document.getSlides()).resolves.toEqual(slides);
    });

    test('opens the reload menu and fires its update callback', async () => {
        const document = new LyricAppDocument(FILE_PATH);
        const event = { clientX: 4 };
        const extra = [{ key: 'extra' }] as any;

        await document.showContextMenu(event, extra);

        const [shownEvent, items] = mocks.showAppContextMenu.mock.calls[0];
        expect(shownEvent).toBe(event);
        expect(items.map((item: any) => item.key)).toEqual(['reload', 'extra']);
        items[0].onSelect();
        expect(document.fileSource.fireUpdateEvent).toHaveBeenCalledOnce();
    });

    test('routes slide context actions to screen selection and the lyric editor', () => {
        const document = new LyricAppDocument(FILE_PATH);
        const event = { screenId: 2 };
        const slide = {
            id: 8,
            filePath: FILE_PATH,
            toJson: () => ({ id: 8, type: 'lyric' }),
        } as any;

        document.showSlideContextMenu(event, slide, [{ key: 'extra' } as any]);

        const [, items] = mocks.showAppContextMenu.mock.calls[0];
        expect(items.map((item: any) => item.key)).toEqual([
            'edit',
            'screens',
            'extra',
        ]);
        items[1].onSelect({ target: 'screen' });
        expect(mocks.handleSlideSelecting).toHaveBeenCalledWith(
            { target: 'screen' },
            FILE_PATH,
            { id: 8, type: 'lyric' },
            true,
        );
        items[0].onSelect();
        expect(mocks.lyricGetInstance).toHaveBeenCalledWith(FILE_PATH);
        expect(mocks.openPopupLyricEditorWindow).toHaveBeenCalledWith(
            { filePath: FILE_PATH },
            8,
        );
    });

    test('cannot save slides and clearing its empty base cache is harmless', async () => {
        const document = new LyricAppDocument(FILE_PATH);

        await expect(document.save()).rejects.toThrow(
            'LyricAppDocument does not support saving slides.',
        );
        expect(document.clearCache()).toBeUndefined();
    });
});
