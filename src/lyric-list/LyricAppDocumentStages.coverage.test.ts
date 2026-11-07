// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The stage documents for REAL — `LyricAppDocument`, the abstract stage, the
// six layouts, the look-ahead mixin, `LyricSlide` on the real `Slide`, the
// element-map cache (`unlockingCacher` + `CacheManager`), the stage style and
// warm-deck stores — over a fake open-lyric previewer. `AppDocument` is a
// faithful stand-in for its instance cache: a key per class, mimetype, path
// and suffix, and the same `Invalid Instance` check.
const { mocks, state } = vi.hoisted(() => ({
    mocks: {
        handleError: vi.fn(),
        notifyElementHighlight: vi.fn(),
        bringDomToCenterView: vi.fn(),
        initOpenLyric: vi.fn(),
    },
    state: {
        settings: new Map<string, string>(),
        fontSetting: { fontSize: 16 } as {
            fontSize: number;
            fontFamily?: string;
        },
        lyricAppDocumentGetter: null as null | ((filePath: string) => any),
        getStageByStage: null as unknown as (
            filePath: string,
            stage: number,
        ) => [number, any],
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        envUtils: {},
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => mocks.handleError(...args),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        state.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        state.settings.delete(key);
    },
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: (json: unknown) => structuredClone(json),
    bringDomToCenterView: (...args: any[]) => {
        return mocks.bringDomToCenterView(...args);
    },
}));
vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: (...args: any[]) => {
        return mocks.notifyElementHighlight(...args);
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            fullName: filePath.split('/').pop(),
            fireUpdateEvent: () => {},
        }),
    },
}));
vi.mock('../server/fontHelpers', () => ({
    getFontFamilies: async () => [],
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: () => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
}));
vi.mock('../app-document-list/AppDocument', () => {
    const instances = new Map<string, unknown>();
    class FakeAppDocument {
        static readonly mimetypeName: string = 'appDocument';
        constructor(readonly filePath: string) {}
        static _getInstance(
            filePath: string,
            createInstance: () => unknown,
            cacheKeySuffix = '',
        ) {
            const cacheKey =
                `${this.name}:${this.mimetypeName}:${filePath}` +
                (cacheKeySuffix === '' ? '' : `:${cacheKeySuffix}`);
            if (!instances.has(cacheKey)) {
                instances.set(cacheKey, createInstance());
            }
            const instance = instances.get(cacheKey);
            if (!(instance instanceof this)) {
                throw new TypeError('Invalid Instance');
            }
            return instance;
        }
    }
    return { default: FakeAppDocument };
});
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    genEditSlideContextMenuItem: (onSelect: () => void) => ({
        menuElement: 'Edit',
        onSelect,
    }),
    // Kept as a plain function: the registration happens once, at import.
    setLyricAppDocumentGetter: (getter: (filePath: string) => any) => {
        state.lyricAppDocumentGetter = getter;
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: () => {},
}));
vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: { handleSlideSelecting: () => {} },
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: () => [],
}));
vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_BLACK: '#000000' }));
vi.mock('../slide-editor/canvas/CanvasItemHtml', () => ({
    genHtmlDefaultProps: () => ({
        color: '#FFFFFF',
        fontSize: 60,
        fontFamily: null,
        fontWeight: null,
        textHorizontalAlignment: 'center',
        textVerticalAlignment: 'center',
    }),
}));
function genFakeCanvasItemClass(type: string) {
    return {
        default: {
            genCanvasItemPropsFromLink: (link: string, boxProps: object) => ({
                ...boxProps,
                type,
                link,
            }),
        },
    };
}
vi.mock('../slide-editor/canvas/CanvasItemImage', () => {
    return genFakeCanvasItemClass('image');
});
vi.mock('../slide-editor/canvas/CanvasItemVideo', () => {
    return genFakeCanvasItemClass('video');
});
vi.mock('../slide-editor/canvas/CanvasItemAudio', () => {
    return genFakeCanvasItemClass('audio');
});
vi.mock('../slide-editor/canvas/CanvasItemYouTube', () => {
    return genFakeCanvasItemClass('youtube');
});
vi.mock('../slide-editor/canvas/CanvasItemWebsite', () => {
    return genFakeCanvasItemClass('website');
});
vi.mock('./lyricEditorHelpers', () => ({
    openPopupLyricEditorWindow: () => null,
}));
vi.mock('./Lyric', () => ({
    default: { getInstance: (filePath: string) => ({ filePath }) },
}));
vi.mock('./lyricHelpers', () => ({
    DEFAULT_OPEN_LYRIC_FONT_SIZE: 16,
    getOpenLyricFontSetting: () => state.fontSetting,
    initOpenLyric: (...args: any[]) => mocks.initOpenLyric(...args),
    getLyricAppDocumentStageByStage: (filePath: string, stage: number) => {
        return state.getStageByStage(filePath, stage);
    },
}));

import LyricAppDocument from './LyricAppDocument';
import LyricAppDocumentStage0 from './LyricAppDocumentStage0';
import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import LyricAppDocumentStage2 from './LyricAppDocumentStage2';
import LyricAppDocumentStage3 from './LyricAppDocumentStage3';
import LyricAppDocumentStage4 from './LyricAppDocumentStage4';
import LyricAppDocumentStage5 from './LyricAppDocumentStage5';
import LyricSlide from './LyricSlide';
import { bringDomToCenterView } from '../helper/helpers';
import { checkIsLookAheadItems } from './lyricLookAheadHelpers';
import { getTargetLyricSlideItemData } from './lyricSlideScreenHelpers';
import { holdLyricWarmSlides } from './lyricWarmSlidesHelpers';

const STAGE_CLASSES = [
    LyricAppDocumentStage0,
    LyricAppDocumentStage1,
    LyricAppDocumentStage2,
    LyricAppDocumentStage3,
    LyricAppDocumentStage4,
    LyricAppDocumentStage5,
];
state.getStageByStage = (filePath, stage) => {
    const StageClass = STAGE_CLASSES[stage] ?? LyricAppDocumentStage1;
    return [stage, StageClass.getStageInstance(filePath, stage)];
};

const TITLE_IMAGE = 'data:image/png;base64,VElUTEU=';

// Fresh per call: a stage's `cleanDataMap` edits the map it is given.
function genDataMap() {
    return {
        'Verse 1': '<div class="verse">Amazing grace</div>',
        Chorus:
            '<div class="chorus">' +
            '<span class="ol-song-view__section-index">2/2</span>' +
            'How sweet the sound</div>',
        Info: '<div class="info">Amazing Grace · John Newton</div>',
        Note1: '<p>Play it softly</p>',
    };
}

// open-lyric's previewer as the stage documents read it: a two-step song
// whose Chorus is played twice (`Cx2`), and one chart attached.
function genFakeOpenLyric() {
    return {
        fontFamily: '',
        fontSize: '20px',
        getInfo: () => ({
            sections: [
                { partName: 'Verse 1', repeatText: '' },
                { partName: 'Chorus', repeatText: '2x' },
            ],
        }),
        getElementMap: vi.fn(async (_options: any) => genDataMap()),
        getValue: vi.fn(async (_options: any) => TITLE_IMAGE),
        getAttachments: () => [
            {
                title: 'Chord Chart',
                type: 'image',
                link: 'https://example.com/chart.png',
            },
        ],
    };
}

let songCount = 0;
function genSongPath() {
    songCount += 1;
    return `/songs/song-${songCount}.owl`;
}

function genStageDoc(stage: number, filePath = genSongPath()) {
    const [, doc] = state.getStageByStage(filePath, stage);
    const openLyric = genFakeOpenLyric();
    doc.openLyric = openLyric;
    return { doc, openLyric, filePath };
}

// The blank that closes the song follows its last part, before attachments.
const SONG_SLIDE_NAMES = [
    'First',
    'Info',
    'None',
    '(1)-Verse 1',
    '(2)-Chorus (1/2)',
    '(2)-Chorus (2/2)',
    'None',
];

function genLyricSlideJson(stage: number, overrides: object = {}) {
    return {
        id: 3,
        canvasItems: [],
        metadata: { width: 1920, height: 1080 },
        type: 'lyric-slide',
        stage,
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.useFakeTimers();
    state.settings.clear();
    state.fontSetting = { fontSize: 16 };
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('LyricSlide', () => {
    test('a verse slide is named by its place and play, an extra one by its key', () => {
        const chorus = new LyricSlide(
            '/songs/a.owl',
            genLyricSlideJson(2),
            'Chorus',
            1,
            { index: 0, count: 2 },
        );
        expect(chorus.name).toBe('(2)-Chorus (1/2)');
        expect(chorus.toJson().type).toBe('lyric-slide');
        expect(chorus.stage).toBe(2);
        expect(chorus.extraClassnames).toBe(
            'ol-slide--lyric-stage-2 ol-slide--lyric-index-1',
        );
        const verse = new LyricSlide(
            '/songs/a.owl',
            genLyricSlideJson(0),
            'V',
            0,
        );
        expect(verse.name).toBe('(1)-V');
        const first = new LyricSlide(
            '/songs/a.owl',
            genLyricSlideJson(0),
            'First',
        );
        expect(first.name).toBe('First');
        expect(first.openLyricIndex).toBe(-1);
        expect(first.openLyricRepeat).toBeNull();
        expect(first.extraClassnames).toBe(
            'ol-slide--lyric-stage-0 ol-slide--lyric-index--1',
        );
    });

    test('only lyric-slide json validates, and as a slide', () => {
        const json = genLyricSlideJson(1);
        expect(LyricSlide.tryValidate(json)).toBe(true);
        // Validated on a copy: the caller's json keeps its lyric type.
        expect(json.type).toBe('lyric-slide');
        expect(() => LyricSlide.validate({ ...json, type: 'slide' })).toThrow(
            'Invalid type',
        );
        expect(LyricSlide.tryValidate({ ...json, type: 'slide' })).toBe(false);
        expect(LyricSlide.tryValidate({ type: 'lyric-slide', id: 1 })).toBe(
            false,
        );
    });

    test('drags as a lyric slide carrying its own json', () => {
        const slide = new LyricSlide(
            '/songs/a.owl',
            genLyricSlideJson(0),
            'Chorus',
            1,
        );
        expect(slide.dragType).toBe('lyric-slide');
        const payload = slide.dragSerialize();
        expect(payload.type).toBe('lyric-slide');
        expect(JSON.parse(payload.data)).toEqual({
            filePath: '/songs/a.owl',
            data: slide.toJson(),
        });
    });

    test('flashes the card of that verse inside the given previewer only', () => {
        LyricSlide.notifyLyricElement(1, null);
        LyricSlide.notifyLyricElement(-1, document.body);
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();

        const other = document.createElement('div');
        other.innerHTML =
            '<div class="ol-slide--lyric-index-1">elsewhere</div>';
        const root = document.createElement('div');
        root.innerHTML =
            '<div class="ol-slide--lyric-index-0">Verse</div>' +
            '<div class="ol-slide--lyric-index-1">Chorus</div>';
        document.body.append(other, root);
        LyricSlide.notifyLyricElement(1, root);
        expect(mocks.notifyElementHighlight).toHaveBeenCalledTimes(1);
        const [getTarget, options] = mocks.notifyElementHighlight.mock.calls[0];
        expect(getTarget().textContent).toBe('Chorus');
        expect(options).toEqual({ moveToView: bringDomToCenterView });
        other.remove();
        root.remove();
    });
});

describe('stage documents', () => {
    test('one cached document per stage NUMBER, stamped with it', () => {
        const filePath = genSongPath();
        const stage1 = LyricAppDocumentStage1.getStageInstance(filePath, 1);
        expect(LyricAppDocumentStage1.getStageInstance(filePath, 1)).toBe(
            stage1,
        );
        expect(stage1.stage).toBe(1);
        // A stage past the layout list keeps its own number and instance.
        const stage7 = LyricAppDocumentStage1.getStageInstance(filePath, 7);
        expect(stage7).not.toBe(stage1);
        expect(stage7.stage).toBe(7);
        const stage0 = LyricAppDocumentStage0.getStageInstance(filePath, 0);
        expect(stage0).toBeInstanceOf(LyricAppDocumentStage0);
        expect(stage0.stage).toBe(0);
        expect(
            LyricAppDocumentStage1.getStageInstance(genSongPath(), 1),
        ).not.toBe(stage1);
    });

    test('the cache key names every option, sorted, then the file and stage', () => {
        const { doc, filePath } = genStageDoc(1);
        expect(doc.genCacheKey('get-value', { width: 2, css: 'a' })).toBe(
            `get-value|css:"a"|width:2|filePath:${filePath}|stage:1`,
        );
    });

    test('stage 0 renders plain lines, with no title picture and no notes', async () => {
        const { doc, openLyric } = genStageDoc(0);
        expect(doc.stageOpenLyricOptions.isShowingIndex).toBe(false);
        expect(doc.stageOpenLyricOptions.css).toContain(
            '.ol-preview-lyric-segment__chord',
        );
        expect(await doc.getFirstCanvasItemProps()).toBeNull();

        const slides = await doc.getSlides();
        expect(slides.map((slide: any) => slide.name)).toEqual([
            ...SONG_SLIDE_NAMES,
            'Chord Chart',
        ]);
        expect(slides.map((slide: any) => slide.id)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7,
        ]);
        expect(slides[0].canvasItemsJson).toEqual([]);
        expect(slides[6].canvasItemsJson).toEqual([]);
        expect(slides[3].canvasItemsJson[0].html).toBe(
            '<div class="verse">Amazing grace</div>',
        );
        // The whole song is one render, with stage 0's own rules.
        expect(openLyric.getElementMap).toHaveBeenCalledTimes(1);
        const options = openLyric.getElementMap.mock.calls[0][0];
        expect(options).toMatchObject({
            type: 'html',
            isShowingIndex: false,
            // The previewer's 20px plus the stage's default +45.
            fontSize: 65,
            width: 1882,
            height: 1058,
        });
        expect(options.css).toContain('.ol-song-view__section-title');
        const dataMap = await doc.getElementMap(doc.allOpenLyricOptions);
        expect(Object.keys(dataMap)).toEqual(['Verse 1', 'Chorus', 'Info']);
    });

    test('stage 1 adds the title picture and names the part in the corner', async () => {
        const { doc, openLyric } = genStageDoc(1);
        const firstProps = await doc.getFirstCanvasItemProps();
        expect(firstProps).toMatchObject({
            id: 0,
            type: 'image',
            srcData: TITLE_IMAGE,
            mediaWidth: 1882,
            mediaHeight: 1058,
            locked: false,
        });
        const valueOptions = openLyric.getValue.mock.calls[0][0];
        expect(valueOptions.type).toBe('png-image');
        expect(valueOptions.css).toContain('.ol-song-view__title');

        const slides = await doc.getSlides();
        expect(slides[0].canvasItemsJson[0].srcData).toBe(TITLE_IMAGE);
        expect(slides[4].canvasItemsJson[0].html).toContain(
            'Chorus (1/2) · 2/2',
        );
        expect(slides[5].canvasItemsJson[0].html).toContain(
            'Chorus (2/2) · 2/2',
        );
        expect(slides[6].canvasItemsJson).toEqual([]);
        expect(slides[7].canvasItemsJson[0]).toMatchObject({
            type: 'image',
            link: 'https://example.com/chart.png',
        });
        // Notes are kept on this stage.
        const dataMap = await doc.getElementMap(doc.allOpenLyricOptions);
        expect(dataMap).toHaveProperty('Note1');

        // Both renders are served from the cache the second time round.
        await doc.getSlides();
        expect(openLyric.getElementMap).toHaveBeenCalledTimes(1);
        expect(openLyric.getValue).toHaveBeenCalledTimes(1);
    });

    test('the custom CSS reaches the title picture of its stage', async () => {
        state.settings.set(
            'lyric-stage-style-1',
            JSON.stringify({ customCss: '.ol-song-view { color: red; }' }),
        );
        const { doc, openLyric } = genStageDoc(1);
        await doc.getFirstCanvasItemProps();
        expect(openLyric.getValue.mock.calls[0][0].css).toMatch(
            /\n\.ol-song-view \{ color: red; \}$/,
        );
    });

    test('clearing a song drops its own renders and nobody else', async () => {
        const first = genStageDoc(1);
        const second = genStageDoc(1);
        await first.doc.getSlides();
        await second.doc.getSlides();
        first.doc.clearCache();
        await first.doc.getSlides();
        await second.doc.getSlides();
        expect(first.openLyric.getElementMap).toHaveBeenCalledTimes(2);
        expect(second.openLyric.getElementMap).toHaveBeenCalledTimes(1);
    });

    test('a held song keeps its deck while the options it was built from hold', async () => {
        const { doc, openLyric, filePath } = genStageDoc(1);
        expect(doc.getWarmDeck()).toBeNull();
        const release = holdLyricWarmSlides(filePath, openLyric as any);
        const slides = await doc.getSlides();
        expect(doc.getWarmDeck()).toBe(slides);
        expect(doc.genWarmDeckKey()).toMatch(
            new RegExp(
                `^deck\\|.*\\|filePath:${filePath}\\|stage:1\\|dim:1920x1080$`,
            ),
        );
        expect(doc.getWarmSlide(4)).toBe(slides[4]);
        // The stage was restyled: the kept deck no longer matches.
        state.settings.set(
            'lyric-stage-style-1',
            JSON.stringify({ paddingPercentage: 5 }),
        );
        expect(doc.getWarmDeck()).toBeNull();
        release();
    });

    test('an id is found by its part, or past the structure by a full build', async () => {
        const { doc } = genStageDoc(1);
        const chorus = await doc.getSlideById(5);
        expect(chorus.id).toBe(5);
        expect(chorus.name).toBe('(2)-Chorus (2/2)');
        // The closing blank is in the quick list, so found by its key.
        const closing = await doc.getSlideById(6);
        expect(closing.name).toBe('None');
        expect(closing.id).toBe(6);
        // The attachment slide is numbered after the song's own.
        const chart = await doc.getSlideById(7);
        expect(chart.name).toBe('Chord Chart');
        expect(chart.id).toBe(7);
        expect(await doc.getSlideById(99)).toBeNull();
    });

    test('a document with no live previewer reads the song itself', async () => {
        const filePath = genSongPath();
        const [, doc] = state.getStageByStage(filePath, 0);
        const openLyric = genFakeOpenLyric();
        mocks.initOpenLyric.mockResolvedValue(openLyric);
        const slides = await doc.getSlides();
        expect(mocks.initOpenLyric).toHaveBeenCalledWith(filePath, true);
        expect(slides).toHaveLength(8);
    });
});

describe('look-ahead stages', () => {
    function countItems(slides: any[]) {
        return slides.map((slide) => slide.canvasItemsJson.length);
    }

    test.each([
        // Items per slide: First, Info, None, V1, C1, C2, None, then the chart.
        // A slide's own items + a frame per box that holds a slide + that
        // slide's text and pictures. None has no items; stage 0's First has
        // no title picture; the chart is media and keeps its single item.
        [2, LyricAppDocumentStage1, [4, 3, 3, 4, 4, 3, 1, 1]],
        [3, LyricAppDocumentStage1, [5, 5, 5, 6, 5, 3, 1, 1]],
        [4, LyricAppDocumentStage0, [3, 3, 3, 4, 4, 3, 1, 1]],
        // Previous AND next: Info's previous box shows First's picture.
        [5, LyricAppDocumentStage1, [4, 5, 5, 5, 6, 5, 3, 1]],
    ])(
        'stage %i shows each song slide with its neighbours, media left alone',
        async (stage, BaseClass, expectedCounts) => {
            const { doc } = genStageDoc(stage as number);
            expect(doc).toBeInstanceOf(BaseClass as any);
            expect(doc.stage).toBe(stage);
            const slides = await doc.getSlides();
            expect(slides.map((slide: any) => slide.name)).toEqual([
                ...SONG_SLIDE_NAMES,
                'Chord Chart',
            ]);
            expect(countItems(slides)).toEqual(expectedCounts);
            for (const slide of slides.slice(0, 7)) {
                expect(checkIsLookAheadItems(slide.canvasItemsJson)).toBe(true);
            }
            expect(checkIsLookAheadItems(slides[7].canvasItemsJson)).toBe(
                false,
            );
        },
    );

    test('a single part is one plain slide; an id is read off the whole deck', async () => {
        const { doc, openLyric, filePath } = genStageDoc(2);
        const [single] = await doc.getSlides('Chorus');
        expect(single.canvasItemsJson).toHaveLength(1);
        expect(checkIsLookAheadItems(single.canvasItemsJson)).toBe(false);

        const slide = await doc.getSlideById(3);
        expect(slide.name).toBe('(1)-Verse 1');
        expect(checkIsLookAheadItems(slide.canvasItemsJson)).toBe(true);
        expect(await doc.getSlideById(42)).toBeNull();

        // Held and built: the click is a lookup in the kept deck.
        const release = holdLyricWarmSlides(filePath, openLyric as any);
        const deck = await doc.getSlides();
        const getSlides = vi.spyOn(doc, 'getSlides');
        expect(await doc.getSlideById(4)).toBe(deck[4]);
        expect(getSlides).not.toHaveBeenCalled();
        release();
    });

    test('2 to 5 are the documented layouts', () => {
        const filePath = genSongPath();
        expect(
            STAGE_CLASSES.map((StageClass, stage) => {
                return StageClass.getStageInstance(filePath, stage).stage;
            }),
        ).toEqual([0, 1, 2, 3, 4, 5]);
        expect(LyricAppDocumentStage2.prototype).toBeInstanceOf(
            LyricAppDocumentStage1,
        );
        expect(LyricAppDocumentStage3.prototype).toBeInstanceOf(
            LyricAppDocumentStage1,
        );
        expect(LyricAppDocumentStage4.prototype).toBeInstanceOf(
            LyricAppDocumentStage0,
        );
        expect(LyricAppDocumentStage5.prototype).toBeInstanceOf(
            LyricAppDocumentStage1,
        );
    });
});

describe('lyricSlideScreenHelpers', () => {
    test('data already on the wanted stage, or no lyric slide, is passed through', async () => {
        const onStage = genLyricSlideJson(1);
        expect(await getTargetLyricSlideItemData('/a.owl', onStage, 1)).toBe(
            onStage,
        );
        const noStage = { ...genLyricSlideJson(1), stage: undefined };
        expect(await getTargetLyricSlideItemData('/a.owl', noStage, 0)).toBe(
            noStage,
        );
        const plainSlide = genLyricSlideJson(0, { type: 'slide' });
        expect(await getTargetLyricSlideItemData('/a.owl', plainSlide, 1)).toBe(
            plainSlide,
        );
    });

    test('a slide on another stage is rebuilt at the wanted one', async () => {
        const filePath = genSongPath();
        const openLyric = genFakeOpenLyric();
        mocks.initOpenLyric.mockResolvedValue(openLyric);
        // The stage-1 document carries its previewer, as a pane's does:
        // without one its title picture and element map would each import
        // `./lyricHelpers` at once, and vitest's mocker hands the second of
        // two CONCURRENT dynamic imports of a factory mock the real module.
        state.getStageByStage(filePath, 1)[1].openLyric = openLyric;
        const [, stage0] = state.getStageByStage(filePath, 0);
        const verseOnStage0 = (await stage0.getSlides())[3].toJson();
        expect(verseOnStage0.stage).toBe(0);

        const verseOnStage1 = await getTargetLyricSlideItemData(
            filePath,
            verseOnStage0,
            1,
        );
        expect(verseOnStage1).toMatchObject({
            id: 3,
            stage: 1,
            type: 'lyric-slide',
            name: '(1)-Verse 1',
        });

        // An id the stage cannot find keeps what was asked about.
        const missing = { ...verseOnStage0, id: 99 };
        expect(await getTargetLyricSlideItemData(filePath, missing, 1)).toBe(
            missing,
        );
    });
});

describe('LyricAppDocument', () => {
    test('teaches the document helpers to resolve a .owl path', () => {
        expect(state.lyricAppDocumentGetter).not.toBeNull();
        const filePath = genSongPath();
        const doc = state.lyricAppDocumentGetter!(filePath);
        expect(doc).toBeInstanceOf(LyricAppDocument);
        expect(doc).not.toBeInstanceOf(LyricAppDocumentStage0);
        expect(doc.filePath).toBe(filePath);
        expect(state.lyricAppDocumentGetter!(filePath)).toBe(doc);
    });
});
