import { describe, expect, test, vi } from 'vitest';

// Only the attachment → canvas-item dispatch is under test here, so the heavy
// half of the module graph (`AppDocument`, the open-lyric previewer, the
// element-map cache) is stubbed out. The canvas item classes are stubbed too:
// their `genCanvasItemPropsFromLink` factories are covered for real in
// `CanvasItemModels.test.ts`, and stubbing them keeps this a node-env test.
const mocks = vi.hoisted(() => ({
    imagePropsMock: vi.fn(() => ({ type: 'image' })),
    videoPropsMock: vi.fn(() => ({ type: 'video' })),
    audioPropsMock: vi.fn(() => ({ type: 'audio' })),
    youtubePropsMock: vi.fn(() => ({ type: 'youtube' })),
    websitePropsMock: vi.fn(() => ({ type: 'website' })),
}));

vi.mock('./LyricAppDocument', () => ({
    OPEN_LYRIC_NONE_KEY: 'None',
    OPEN_LYRIC_FIRST_KEY: 'First',
    OPEN_LYRIC_INFO_KEY: 'Info',
    default: class {},
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: vi.fn(),
    unlockingCacher: vi.fn(),
}));

vi.mock('../others/CacheManager', () => ({
    default: class {
        deleteMatchedSync() {}
    },
}));

vi.mock('./lyricHelpers', () => ({
    DEFAULT_OPEN_LYRIC_FONT_SIZE: 16,
    getOpenLyricFontSetting: vi.fn(),
}));

vi.mock('../slide-editor/canvas/CanvasItemImage', () => ({
    default: { genCanvasItemPropsFromLink: mocks.imagePropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemVideo', () => ({
    default: { genCanvasItemPropsFromLink: mocks.videoPropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemAudio', () => ({
    default: { genCanvasItemPropsFromLink: mocks.audioPropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemYouTube', () => ({
    default: { genCanvasItemPropsFromLink: mocks.youtubePropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemWebsite', () => ({
    default: { genCanvasItemPropsFromLink: mocks.websitePropsMock },
}));

import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { getOpenLyricFontSetting } from './lyricHelpers';
import { unlockingCacher } from '../server/unlockingHelpers';
import CacheManager from '../others/CacheManager';
import {
    getLyricWarmDeck,
    getLyricWarmGeneration,
    holdLyricWarmSlides,
    setLyricWarmDeck,
} from './lyricWarmSlidesHelpers';

const BOX_PROPS = {
    id: -1,
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
};

const CANVAS_ITEM_BOUNDS = { x: 19, y: 19, width: 1882, height: 1042 };

// The method reaches `this.genCanvasItemBoundsProps` (on `LyricAppDocument`,
// stubbed above), so it is called against a minimal `this` rather than a real
// document instance.
function genPropsFromAttachment(attachment: any) {
    const genCanvasItemBoundsProps = vi.fn(() => BOX_PROPS);
    const result =
        LyricAppDocumentStageAbstract.prototype.genCanvasItemPropsFromAttachment.call(
            { genCanvasItemBoundsProps } as any,
            attachment,
            CANVAS_ITEM_BOUNDS as any,
        );
    return { result, genCanvasItemBoundsProps };
}

describe('LyricAppDocumentStageAbstract attachments', () => {
    test('gives every attachment kind the whole slide as its box', () => {
        const { result, genCanvasItemBoundsProps } = genPropsFromAttachment({
            title: 'Backing track',
            type: 'audio',
            link: 'https://www.openworship.app/shared/audios/Doxology.mp3',
        });

        expect(result).toEqual({ type: 'audio' });
        // id -1, LOCKED, and the bounds handed in rather than re-read.
        expect(genCanvasItemBoundsProps).toHaveBeenCalledWith(
            -1,
            true,
            CANVAS_ITEM_BOUNDS,
        );
        expect(mocks.audioPropsMock).toHaveBeenCalledWith(
            'https://www.openworship.app/shared/audios/Doxology.mp3',
            BOX_PROPS,
        );
    });

    test('dispatches each attachment type to its own canvas item class', () => {
        const cases = [
            ['youtube', 'https://www.youtube.com/watch?v=abc', 'youtube'],
            ['image', 'https://a.com/chart.png', 'image'],
            ['video', 'https://a.com/clip.mp4', 'video'],
            ['audio', 'https://a.com/track.mp3', 'audio'],
            // Anything else that IS a url becomes the page it is.
            ['other', 'https://a.com/lyrics', 'website'],
        ] as const;

        for (const [type, link, expectedType] of cases) {
            const { result } = genPropsFromAttachment({
                title: 't',
                type,
                link,
            });
            expect(result).toEqual({ type: expectedType });
        }
    });

    test('a `file://` attachment is dispatched like any other url', () => {
        // How a chart or a backing track on the operator's own machine travels
        // with the song; open-lyric writes it as a url, not as a path.
        const { result } = genPropsFromAttachment({
            title: 'Chart',
            type: 'image',
            link: 'file:///C:/songs/chart.png',
        });
        expect(result).toEqual({ type: 'image' });
        expect(mocks.imagePropsMock).toHaveBeenCalledWith(
            'file:///C:/songs/chart.png',
            BOX_PROPS,
        );
    });

    test('refuses a pdf and anything whose link is not a url', () => {
        // A pdf link is a real url but has no canvas item yet.
        expect(
            genPropsFromAttachment({
                title: 'Handout',
                type: 'pdf',
                link: 'https://a.com/handout.pdf',
            }).result,
        ).toBeNull();

        // open-lyric falls back to `other` with the RAW TEXT as `link` when the
        // line does not parse as a url. Without the gate this would become a
        // website iframe pointed at a relative path, on a projected screen.
        for (const attachment of [
            { title: 'Note', type: 'other', link: 'see the songbook' },
            { title: 'Old', type: 'other', link: 'ftp://a.com/x.mp3' },
            { title: 'Inline', type: 'image', link: 'data:image/png;base64,a' },
            { title: 'Path', type: 'audio', link: 'C:\\songs\\track.mp3' },
            { title: 'Empty', type: 'video', link: '' },
        ]) {
            expect(genPropsFromAttachment(attachment).result).toBeNull();
        }

        expect(mocks.websitePropsMock).not.toHaveBeenCalled();
        expect(mocks.imagePropsMock).not.toHaveBeenCalled();
        expect(mocks.audioPropsMock).not.toHaveBeenCalled();
        expect(mocks.videoPropsMock).not.toHaveBeenCalled();
    });
});

// `allOpenLyricOptions` is a getter, so it is reached through its descriptor and
// called against a minimal `this` — the same trick as `genPropsFromAttachment`
// above, and the reason neither needs a real document instance.
const getAllOpenLyricOptions = Object.getOwnPropertyDescriptor(
    LyricAppDocumentStageAbstract.prototype,
    'allOpenLyricOptions',
)!.get!;

const STAGE_CSS = '.ol-preview-lyric-segment__chord { display: none }';

function genAllOptions(customCss: string, basicCss?: string) {
    return getAllOpenLyricOptions.call({
        stageStyle: { customCss },
        basicOpenLyricOptions: { type: 'html', css: basicCss },
        stageOpenLyricOptions: { css: STAGE_CSS },
        withCustomCss: LyricAppDocumentStageAbstract.prototype[
            'withCustomCss'
        ] as any,
    } as any);
}

describe('LyricAppDocumentStageAbstract custom css', () => {
    test('APPENDS to the stage css instead of replacing it', () => {
        // The regression this feature could introduce: `css` is a plain string,
        // so a custom rule that landed in either spread object would wipe stage
        // 0's own layout css and turn it into stage 1.
        const customCss = '.ol-preview-line { color: red }';
        const { css } = genAllOptions(customCss);

        expect(css).toContain(STAGE_CSS);
        expect(css).toContain(customCss);
        // The stage's own rules come FIRST, so equal-specificity custom rules
        // win — which is what an override box is for.
        expect(css.indexOf(STAGE_CSS)).toBeLessThan(css.indexOf(customCss));
    });

    test.each([[''], ['   '], ['\n\t ']])(
        'blank custom css %j leaves the options object untouched',
        (customCss) => {
            const options = genAllOptions(customCss);
            // Same `css`, so `genCacheKey` is byte-identical to what it was
            // before this feature — an install that never opens the panel gets
            // no cold-start re-render of every song.
            expect(options.css).toBe(STAGE_CSS);
        },
    );

    test('never leaks `undefined` when there is no css to append to', () => {
        const options = getAllOpenLyricOptions.call({
            stageStyle: { customCss: '.a { color: red }' },
            basicOpenLyricOptions: { type: 'html' },
            stageOpenLyricOptions: {},
            withCustomCss: LyricAppDocumentStageAbstract.prototype[
                'withCustomCss'
            ] as any,
        } as any);

        expect(options.css).not.toContain('undefined');
        expect(options.css).toContain('.a { color: red }');
    });
});

describe('LyricAppDocumentStage1.genSlideHtml', () => {
    const badge =
        '<span class="ol-song-view__section-index" style="width: 9px">2/7</span>';

    test('names the part and the play of a repeat in the corner', async () => {
        const { default: LyricAppDocumentStage1 } =
            await import('./LyricAppDocumentStage1');
        const html = LyricAppDocumentStage1.prototype.genSlideHtml(
            badge,
            'Chorus',
            6,
            { index: 1, count: 3 },
        );
        // Step 7, not the `2` open-lyric stamped on the part's one render.
        expect(html).toContain('>Chorus (2/3) · 7/7</span>');
    });

    test('a part played once carries its name alone', async () => {
        const { default: LyricAppDocumentStage1 } =
            await import('./LyricAppDocumentStage1');
        const html = LyricAppDocumentStage1.prototype.genSlideHtml(
            badge,
            'Verse 1',
            1,
            null,
        );
        expect(html).toContain('>Verse 1 · 2/7</span>');
    });
});

describe('stage slide and rendering options', () => {
    test('saved font and stage settings determine off-screen render options', () => {
        vi.mocked(getOpenLyricFontSetting).mockReturnValue({
            fontFamily: 'Noto Sans Khmer',
            fontSize: 42,
        } as any);
        const getOptions = Object.getOwnPropertyDescriptor(
            LyricAppDocumentStageAbstract.prototype,
            'basicOpenLyricOptions',
        )!.get!;
        const context = {
            canvasItemBounds: { width: 800, height: 450 },
            stageStyle: {
                backgroundAlphaPercentage: 35,
                theme: 'dark',
                extraFontSize: 3,
            },
            liveOpenLyric: null as any,
        };
        const saved = getOptions.call(context);
        expect(saved).toMatchObject({
            type: 'html',
            width: 800,
            height: 450,
            backgroundAlpha: 0.35,
            fontSize: 45,
            fontFamily: 'Noto Sans Khmer',
        });
        expect(saved.css).toContain('Noto Sans Khmer, sans-serif');

        context.liveOpenLyric = { fontFamily: 'Arial', fontSize: '65px' };
        expect(getOptions.call(context)).toMatchObject({
            fontFamily: 'Arial',
            fontSize: 68,
        });
        context.liveOpenLyric.fontSize = 'bad';
        expect(getOptions.call(context).fontSize).toBe(19);
    });

    test('single-key slides use the cached map and keep the play step metadata', async () => {
        const genSlide = vi.fn((key: string) => ({ openLyricKey: key }));
        const genLyricSlide = vi.fn(
            (_id: number, key: string, items: any[]) => ({
                openLyricKey: key,
                canvasItems: items,
            }),
        );
        const getElementMap = vi.fn(async () => ({ Chorus: '<p>Chorus</p>' }));
        const getFirstCanvasItemProps = vi.fn(async () => ({ type: 'image' }));
        const context = {
            genSlide,
            genLyricSlide,
            getElementMap,
            getFirstCanvasItemProps,
            allOpenLyricOptions: { type: 'html' },
        };
        const method = LyricAppDocumentStageAbstract.prototype.getStageSlides;
        expect(await method.call(context as any, 'None')).toEqual([
            { openLyricKey: 'None' },
        ]);
        expect(await method.call(context as any, 'First')).toEqual([
            { openLyricKey: 'First', canvasItems: [{ type: 'image' }] },
        ]);
        expect(getElementMap).not.toHaveBeenCalled();
        expect(
            await method.call(context as any, 'Chorus', {
                openLyricIndex: 2,
                openLyricRepeat: { index: 1, count: 3 },
            } as any),
        ).toEqual([{ openLyricKey: 'Chorus' }]);
        expect(getElementMap).toHaveBeenCalledWith({
            type: 'html',
            key: 'Chorus',
        });
        expect(genSlide).toHaveBeenLastCalledWith(
            'Chorus',
            -1,
            { Chorus: '<p>Chorus</p>' },
            undefined,
            2,
            { index: 1, count: 3 },
        );
    });

    test('whole-song slides append attachments after the play order', async () => {
        const previewer = {
            getInfo: () => ({
                sections: [
                    { partName: 'Verse', repeatText: '' },
                    { partName: 'Chorus', repeatText: '' },
                ],
            }),
            getAttachments: () => [
                { title: 'Chart', type: 'image', link: 'https://a/chart.png' },
            ],
        };
        const genSlide = vi.fn((key: string, id: number) => ({
            id,
            openLyricKey: key,
        }));
        const attachments = [{ id: -1, openLyricKey: 'Chart' }];
        const context = {
            getOpenLyricPreviewer: vi.fn(async () => previewer),
            getFirstCanvasItemProps: vi.fn(async () => null),
            getElementMap: vi.fn(async () => ({ Verse: 'v', Chorus: 'c' })),
            allOpenLyricOptions: { type: 'html' },
            displayDim: { width: 1280, height: 720 },
            canvasItemBounds: { x: 10, y: 10, width: 1260, height: 700 },
            genSlide,
            extendExtraSlide: vi.fn((slides: any[]) => [
                { id: 0, openLyricKey: 'First' },
                ...slides,
                { id: 3, openLyricKey: 'Info' },
            ]),
            genSlidesFromAttachments: vi.fn(() => attachments),
        };
        const slides =
            await LyricAppDocumentStageAbstract.prototype.getStageSlides.call(
                context as any,
            );
        expect(slides.map((slide) => slide.openLyricKey)).toEqual([
            'First',
            'Verse',
            'Chorus',
            'Info',
            'Chart',
        ]);
        expect(attachments[0].id).toBe(4);
        expect(genSlide).toHaveBeenNthCalledWith(
            1,
            'Verse',
            0,
            { Verse: 'v', Chorus: 'c' },
            context.displayDim,
            0,
            null,
            // Read once for the song and handed to every verse: each read of
            // it is a blocking display lookup in the main process.
            context.canvasItemBounds,
        );
    });

    test('unrenderable attachments still retain their place in the slide list', () => {
        const genLyricSlide = vi.fn(
            (id: number, key: string, items: any[]) => ({
                id,
                openLyricKey: key,
                canvasItems: items,
            }),
        );
        const context = {
            displayDim: { width: 1920, height: 1080 },
            canvasItemBounds: CANVAS_ITEM_BOUNDS,
            genCanvasItemPropsFromAttachment: vi.fn((attachment: any) =>
                attachment.type === 'pdf' ? null : { type: 'image' },
            ),
            genLyricSlide,
        };
        const slides =
            LyricAppDocumentStageAbstract.prototype.genSlidesFromAttachments.call(
                context as any,
                [
                    {
                        title: 'Chart',
                        type: 'image',
                        link: 'https://a/chart.png',
                    },
                    { title: 'PDF', type: 'pdf', link: 'https://a/file.pdf' },
                ] as any,
            );
        expect(slides.map((slide) => slide.openLyricKey)).toEqual([
            'Chart',
            'PDF',
        ]);
        expect(
            slides.map((slide) => (slide as any).canvasItems.length),
        ).toEqual([1, 0]);
        expect(genLyricSlide).toHaveBeenCalledWith(
            -1,
            'PDF',
            [],
            context.displayDim,
        );
    });

    test('slide lookup falls back for appended slides and preserves quick ids', async () => {
        const quick = { id: 2, openLyricKey: 'Verse' };
        const full = { id: -1, openLyricKey: 'Verse' };
        const slow = { id: 5, openLyricKey: 'Attachment' };
        const context = {
            getWarmSlide: vi.fn(() => null),
            getSlidesQuick: vi.fn(async () => [quick]),
            getSlides: vi.fn(async () => [full]),
            getSlideByIdSlow: vi.fn(async () => slow),
        };
        const method = LyricAppDocumentStageAbstract.prototype.getSlideById;
        expect(await method.call(context as any, 2)).toBe(full);
        expect(full.id).toBe(2);
        expect(context.getSlides).toHaveBeenCalledWith('Verse', quick);
        expect(context.getSlideByIdSlow).not.toHaveBeenCalled();

        expect(await method.call(context as any, 5)).toBe(slow);
        expect(context.getSlideByIdSlow).toHaveBeenCalledWith(5);
        context.getSlides.mockResolvedValueOnce([]);
        expect(await method.call(context as any, 2)).toBe(slow);
    });
});

describe('slides built ahead of the click', () => {
    const prototype = LyricAppDocumentStageAbstract.prototype;
    const WARM_KEY = 'deck|stage:2';

    // The stage document as the click path sees it: the warm lookups are the
    // real ones, everything that DERIVES a slide is a spy that must not run.
    function genStageContext(filePath: string, warmKey = WARM_KEY) {
        return {
            filePath,
            stage: 2,
            genWarmDeckKey: vi.fn(() => warmKey),
            getWarmDeck: prototype.getWarmDeck,
            getWarmSlide: prototype.getWarmSlide,
            getSlidesQuick: vi.fn(async () => [] as any[]),
            getSlides: vi.fn(async () => [] as any[]),
            getSlideByIdSlow: vi.fn(async () => null),
            getStageSlides: vi.fn(async () => [] as any[]),
        };
    }

    test('a click on a held song is served from its deck, deriving nothing', async () => {
        const filePath = '/warm-click.owl';
        const release = holdLyricWarmSlides(filePath, {} as any);
        const deck = [{ id: 0 }, { id: 1 }, { id: 2 }];
        setLyricWarmDeck(
            filePath,
            2,
            WARM_KEY,
            deck as any,
            getLyricWarmGeneration(filePath),
        );
        const context = genStageContext(filePath);

        expect(await prototype.getSlideById.call(context as any, 1)).toBe(
            deck[1],
        );
        expect(context.getSlidesQuick).not.toHaveBeenCalled();
        expect(context.getSlides).not.toHaveBeenCalled();
        release();
    });

    test('a deck built from other options is not served', async () => {
        const filePath = '/warm-stale-key.owl';
        const release = holdLyricWarmSlides(filePath, {} as any);
        setLyricWarmDeck(
            filePath,
            2,
            WARM_KEY,
            [{ id: 1 }] as any,
            getLyricWarmGeneration(filePath),
        );
        // The stage's font, style or display changed since it was built.
        const context = genStageContext(filePath, `${WARM_KEY}|changed`);

        await prototype.getSlideById.call(context as any, 1);
        expect(context.getSlidesQuick).toHaveBeenCalled();
        release();
    });

    test('a song no pane holds never computes the deck key', async () => {
        const context = genStageContext('/not-held-click.owl');
        await prototype.getSlideById.call(context as any, 1);
        // The key reads the stage's settings and asks the main process for
        // the display; a song nobody holds has no deck to compare it with.
        expect(context.genWarmDeckKey).not.toHaveBeenCalled();
        expect(context.getSlidesQuick).toHaveBeenCalled();
    });

    test('the whole deck is kept only while the song is held', async () => {
        const filePath = '/warm-store.owl';
        const deck = [{ id: 0 }];
        const context = genStageContext(filePath);
        context.getStageSlides.mockResolvedValue(deck);

        expect(await prototype.getSlides.call(context as any)).toBe(deck);
        expect(context.genWarmDeckKey).not.toHaveBeenCalled();

        const release = holdLyricWarmSlides(filePath, {} as any);
        expect(await prototype.getSlides.call(context as any)).toBe(deck);
        expect(getLyricWarmDeck(filePath, 2, WARM_KEY)).toBe(deck);

        // One part's slide is not the deck, and must not replace it.
        context.getStageSlides.mockResolvedValue([{ id: 7 }]);
        await prototype.getSlides.call(context as any, 'Chorus');
        expect(context.getStageSlides).toHaveBeenLastCalledWith(
            'Chorus',
            undefined,
        );
        expect(getLyricWarmDeck(filePath, 2, WARM_KEY)).toBe(deck);
        release();
    });

    test('an edit landing mid-build keeps the stale deck out', async () => {
        const filePath = '/warm-race.owl';
        const release = holdLyricWarmSlides(filePath, {} as any);
        const context = {
            ...genStageContext(filePath),
            clearCache: prototype.clearCache,
        };
        context.getStageSlides.mockImplementation(async () => {
            // The file's `update` arrives while open-lyric is still rendering.
            context.clearCache();
            return [{ id: 0 }];
        });

        await prototype.getSlides.call(context as any);
        expect(getLyricWarmDeck(filePath, 2, WARM_KEY)).toBeNull();
        release();
    });

    test('clearing the song drops its decks at every stage', () => {
        const filePath = '/warm-clear.owl';
        const release = holdLyricWarmSlides(filePath, {} as any);
        const generation = getLyricWarmGeneration(filePath);
        setLyricWarmDeck(filePath, 0, 'a', [] as any, generation);
        setLyricWarmDeck(filePath, 2, 'b', [] as any, generation);

        prototype.clearCache.call({ filePath } as any);
        expect(getLyricWarmDeck(filePath, 0, 'a')).toBeNull();
        expect(getLyricWarmDeck(filePath, 2, 'b')).toBeNull();
        release();
    });

    test('a look-ahead stage rebuilds the deck only when none is held', async () => {
        const { withLyricLookAhead } =
            await import('./LyricAppDocumentStageLookAhead');
        const LookAhead = withLyricLookAhead(class {} as any, {} as any);
        const warmSlide = { id: 3 };
        const context = {
            getWarmSlide: vi.fn(() => warmSlide),
            getSlides: vi.fn(async () => [{ id: 3 }]),
        };
        expect(
            await LookAhead.prototype.getSlideById.call(context as any, 3),
        ).toBe(warmSlide);
        expect(context.getSlides).not.toHaveBeenCalled();

        context.getWarmSlide.mockReturnValue(null as any);
        expect(
            await LookAhead.prototype.getSlideById.call(context as any, 3),
        ).toEqual({ id: 3 });
        expect(context.getSlides).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Below: the stage IDENTITY, the two cached open-lyric reads, the per-stage
// layouts and the look-ahead arrangement — on the same stubs as above.
// ---------------------------------------------------------------------------

describe('getStageInstance', () => {
    // A layout class standing in for a concrete stage: the base document is
    // stubbed above, so the instance cache it would supply is supplied here,
    // keyed the way the real one is (class, path, suffix).
    function genLayoutClass(defaultStage: number) {
        const Base = LyricAppDocumentStageAbstract as any;
        return class TestLayoutStage extends Base {
            static readonly cache = new Map<string, any>();
            static readonly suffixes: string[] = [];
            static _getInstance(
                filePath: string,
                create: () => any,
                cacheKeySuffix: string,
            ) {
                this.suffixes.push(cacheKeySuffix);
                const key = `${this.name}:${filePath}:${cacheKeySuffix}`;
                if (!this.cache.has(key)) {
                    this.cache.set(key, create());
                }
                return this.cache.get(key);
            }
            stage = defaultStage;
            filePath: string;
            constructor(filePath: string) {
                super();
                this.filePath = filePath;
            }
        } as any;
    }

    test('each stage number is its own instance, stamped with that number', () => {
        const LayoutClass = genLayoutClass(1);
        const stage4 = LayoutClass.getStageInstance('/song.owl', 4);
        const stage5 = LayoutClass.getStageInstance('/song.owl', 5);

        // Not the layout's default: the number asked for.
        expect(stage4.stage).toBe(4);
        expect(stage5.stage).toBe(5);
        expect(stage4).not.toBe(stage5);
        expect(stage4.filePath).toBe('/song.owl');
        expect(LayoutClass.suffixes).toEqual(['stage:4', 'stage:5']);
        // ...and cached, so a second ask is the same document.
        expect(LayoutClass.getStageInstance('/song.owl', 4)).toBe(stage4);
    });
});

describe('cache keys', () => {
    const genCacheKey = LyricAppDocumentStageAbstract.prototype.genCacheKey;

    test('hash every option in a stable order, then the file and the stage', () => {
        const context = { filePath: '/song.owl', stage: 2 };
        const key = genCacheKey.call(context as any, 'get-element-map', {
            type: 'html',
            fontSize: 61,
            css: '.a { color: red }',
        });
        expect(key).toBe(
            'get-element-map|css:".a { color: red }"|fontSize:61' +
                '|type:"html"|filePath:/song.owl|stage:2',
        );
        // The same options in another order are the same entry.
        expect(
            genCacheKey.call(context as any, 'get-element-map', {
                fontSize: 61,
                css: '.a { color: red }',
                type: 'html',
            }),
        ).toBe(key);
        // Another stage of the same song is another entry.
        expect(
            genCacheKey.call({ ...context, stage: 3 } as any, 'x', {}),
        ).not.toBe(genCacheKey.call(context as any, 'x', {}));
    });

    test('a built deck is keyed on its options AND the display it fills', () => {
        const genWarmDeckKey =
            LyricAppDocumentStageAbstract.prototype.genWarmDeckKey;
        const context = {
            filePath: '/song.owl',
            stage: 0,
            displayDim: { width: 1920, height: 1080 },
            allOpenLyricOptions: { type: 'html' },
            genCacheKey,
        };
        expect(genWarmDeckKey.call(context as any)).toBe(
            'deck|type:"html"|filePath:/song.owl|stage:0|dim:1920x1080',
        );
        context.displayDim = { width: 1280, height: 720 };
        expect(genWarmDeckKey.call(context as any)).toContain('dim:1280x720');
    });

    test("clearing one song never drops another song's slides", () => {
        const deleteMatched = vi.spyOn(
            CacheManager.prototype as any,
            'deleteMatchedSync',
        );
        LyricAppDocumentStageAbstract.prototype.clearCache.call({
            filePath: '/songs/a.owl',
        } as any);

        expect(deleteMatched).toHaveBeenCalledTimes(1);
        const [checkIsMatched] = deleteMatched.mock.calls[0] as [
            (key: string) => boolean,
        ];
        const keyOf = (filePath: string) =>
            genCacheKey.call({ filePath, stage: 1 } as any, 'get-value', {
                type: 'html',
            });
        expect(checkIsMatched(keyOf('/songs/a.owl'))).toBe(true);
        // A path that merely STARTS like this one is another song.
        expect(checkIsMatched(keyOf('/songs/a.owl.bak'))).toBe(false);
        expect(checkIsMatched(keyOf('/songs/b.owl'))).toBe(false);
    });
});

describe('cached open-lyric reads', () => {
    const prototype = LyricAppDocumentStageAbstract.prototype;

    function genReadContext() {
        const previewer = {
            getElementMap: vi.fn(async () => ({
                Verse: '<p>v</p>',
                note: 'n',
            })),
            getValue: vi.fn(async () => 'data:image/png;base64,AAA'),
        };
        return {
            previewer,
            context: {
                filePath: '/song.owl',
                stage: 0,
                genCacheKey: prototype.genCacheKey,
                getOpenLyricPreviewer: vi.fn(async () => previewer),
                cleanDataMap: vi.fn((dataMap: any) => {
                    delete dataMap.note;
                }),
            },
        };
    }

    test('a miss renders through the previewer and cleans the map', async () => {
        vi.mocked(unlockingCacher).mockImplementation(
            async (_key: string, callback: () => unknown) => callback(),
        );
        const { previewer, context } = genReadContext();
        const options = { type: 'html', key: 'Verse' } as any;

        const dataMap = await prototype.getElementMap.call(
            context as any,
            options,
        );
        expect(dataMap).toEqual({ Verse: '<p>v</p>' });
        expect(previewer.getElementMap).toHaveBeenCalledWith(options);
        expect(context.cleanDataMap).toHaveBeenCalledTimes(1);
        const [cacheKey, , cache] = vi.mocked(unlockingCacher).mock.calls[0];
        expect(cacheKey).toBe(
            'get-element-map|key:"Verse"|type:"html"|filePath:/song.owl|stage:0',
        );
        expect(cache).toBeInstanceOf(CacheManager);

        const value = await prototype.getValue.call(
            context as any,
            {
                type: 'png-image',
            } as any,
        );
        expect(value).toBe('data:image/png;base64,AAA');
        expect(vi.mocked(unlockingCacher).mock.calls[1][0]).toMatch(
            /^get-value\|/,
        );
    });

    test('a hit never resolves the previewer (no file re-read)', async () => {
        vi.mocked(unlockingCacher).mockImplementation(
            async () => 'cached' as any,
        );
        const { context } = genReadContext();
        expect(
            await prototype.getElementMap.call(context as any, {} as any),
        ).toBe('cached');
        expect(await prototype.getValue.call(context as any, {} as any)).toBe(
            'cached',
        );
        expect(context.getOpenLyricPreviewer).not.toHaveBeenCalled();
    });

    test('the slow lookup reads the whole deck', async () => {
        const getSlideByIdSlow = (prototype as any).getSlideByIdSlow;
        const context = {
            getSlides: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
        };
        expect(await getSlideByIdSlow.call(context, 2)).toEqual({ id: 2 });
        expect(await getSlideByIdSlow.call(context, 9)).toBeNull();
        expect(context.getSlides).toHaveBeenCalledWith();
    });
});

describe('stage layouts', () => {
    test('stage 0 hides chords and titles, has no title card, drops notes', async () => {
        const { default: LyricAppDocumentStage0 } =
            await import('./LyricAppDocumentStage0');
        const stage0 = new (LyricAppDocumentStage0 as any)();
        const options = stage0.stageOpenLyricOptions;
        expect(options.isShowingIndex).toBe(false);
        expect(options.css).toMatch(
            /\.ol-preview-lyric-segment__chord \{\s*display: none;/,
        );
        expect(options.css).toMatch(
            /\.ol-song-view__section-title \{\s*display: none;/,
        );
        expect(await stage0.getFirstCanvasItemProps()).toBeNull();

        const dataMap = { 'Note 1': 'a', NOTE: 'b', Verse: 'v', Chorus: 'c' };
        stage0.cleanDataMap(dataMap);
        expect(dataMap).toEqual({ Verse: 'v', Chorus: 'c' });
    });

    test('stage 1 keys the notes, counts the sections and keeps every part', async () => {
        const { default: LyricAppDocumentStage1 } =
            await import('./LyricAppDocumentStage1');
        const stage1 = new (LyricAppDocumentStage1 as any)();
        expect(stage1.stage).toBe(1);
        expect(stage1.stageOpenLyricOptions).toMatchObject({
            isWithKeyNote: true,
            isShowingCommentText: true,
            isShowingTotalIndex: true,
        });
        const dataMap = { Note: 'n', Verse: 'v' };
        stage1.cleanDataMap(dataMap);
        expect(dataMap).toEqual({ Note: 'n', Verse: 'v' });
    });

    test('stage 1 draws its title card as a whole-song picture, custom css included', async () => {
        const { default: LyricAppDocumentStage1 } =
            await import('./LyricAppDocumentStage1');
        const stage1 = new (LyricAppDocumentStage1 as any)();
        Object.defineProperty(stage1, 'stageStyle', {
            value: { customCss: '.ol-song-view { color: gold; }' },
        });
        Object.defineProperty(stage1, 'basicOpenLyricOptions', {
            value: { type: 'html', fontSize: 61, css: 'basic' },
        });
        stage1.getValue = vi.fn(async () => 'data:image/png;base64,QQ==');
        stage1.genCanvasItemImageProps = vi.fn((id: number, src: string) => ({
            id,
            src,
        }));

        expect(await stage1.getFirstCanvasItemProps()).toEqual({
            id: 0,
            src: 'data:image/png;base64,QQ==',
        });
        const [options] = stage1.getValue.mock.calls[0];
        expect(options.type).toBe('png-image');
        expect(options.fontSize).toBe(61);
        expect(options.css).toContain('.ol-song-view__title');
        expect(options.css.trimEnd()).toMatch(
            /\.ol-song-view \{ color: gold; \}$/,
        );
    });

    test('stages 2 to 5 are their own numbers over the right base layout', async () => {
        const [stage0Module, stage1Module, ...lookAheadModules] =
            await Promise.all([
                import('./LyricAppDocumentStage0'),
                import('./LyricAppDocumentStage1'),
                import('./LyricAppDocumentStage2'),
                import('./LyricAppDocumentStage3'),
                import('./LyricAppDocumentStage4'),
                import('./LyricAppDocumentStage5'),
            ]);
        const instances = lookAheadModules.map(
            ({ default: StageClass }) => new (StageClass as any)(),
        );
        expect(instances.map((instance) => instance.stage)).toEqual([
            2, 3, 4, 5,
        ]);
        // 2, 3 and 5 show the band's stage-1 slides; 4 the audience's plain
        // stage-0 ones, two to a screen.
        const [stage2, stage3, stage4, stage5] = instances;
        for (const instance of [stage2, stage3, stage5]) {
            expect(instance).toBeInstanceOf(stage1Module.default);
        }
        expect(stage4).toBeInstanceOf(stage0Module.default);
        expect(stage4).not.toBeInstanceOf(stage1Module.default);
    });
});

describe('look-ahead arrangement', () => {
    const DISPLAY = { width: 1920, height: 1080 };

    function genSlide(openLyricIndex: number, openLyricKey: string) {
        return {
            openLyricIndex,
            openLyricKey,
            canvasItemsJson: [
                {
                    id: 0,
                    type: 'html',
                    html: `<p>${openLyricKey}</p>`,
                    left: 0,
                    top: 0,
                    width: DISPLAY.width,
                    height: DISPLAY.height,
                },
            ],
            _originalJson: {} as any,
        };
    }

    async function genLookAheadStage(slides: any[]) {
        const { withLyricLookAhead } =
            await import('./LyricAppDocumentStageLookAhead');
        const { genRowArrangement } = await import('./lyricLookAheadHelpers');
        class BaseStage {
            displayDim = DISPLAY;
            genCanvasItemHtmlProps = vi.fn(
                (id: number, html: string, box: any) => ({
                    id,
                    type: 'html',
                    html,
                    left: box.x,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                }),
            );
            // A PROTOTYPE method, as on the real stages: an instance field
            // would shadow the mixin's override.
            async getStageSlides(_key?: string, _step?: unknown) {
                return slides;
            }
        }
        const LookAheadStage = withLyricLookAhead(
            BaseStage as any,
            genRowArrangement([1]),
        );
        // The mixin is abstract only to the compiler.
        return new (LookAheadStage as any)();
    }

    test('lays each song slide out with the next one under it', async () => {
        const { checkIsLookAheadItems } =
            await import('./lyricLookAheadHelpers');
        const slides = [
            genSlide(-1, 'First'),
            genSlide(0, 'Verse'),
            genSlide(1, 'Chorus'),
            genSlide(-1, 'Info'),
            genSlide(-1, 'Backing track'),
        ];
        const stage = await genLookAheadStage(slides);

        expect(await stage.getStageSlides()).toBe(slides);
        const verseItems = slides[1]._originalJson.canvasItems;
        expect(checkIsLookAheadItems(verseItems)).toBe(true);
        const htmls = verseItems.map((item: any) => item.html).join('');
        // Itself, and the Chorus that comes next.
        expect(htmls).toContain('<p>Verse</p>');
        expect(htmls).toContain('<p>Chorus</p>');
        // The extra slides lead the deck and are arranged too...
        expect(slides[0]._originalJson.canvasItems).toBeDefined();
        expect(slides[3]._originalJson.canvasItems).toBeDefined();
        // ...the attachment after them keeps its full size.
        expect(slides[4]._originalJson.canvasItems).toBeUndefined();
        // Boxes over the WHOLE slide, handed straight to the item builder.
        expect(stage.genCanvasItemHtmlProps).toHaveBeenCalledWith(
            -1,
            expect.stringContaining('lyric-look-ahead-frame'),
            expect.objectContaining({ x: 0, y: 0 }),
        );
    });

    test('a deck with no attachments is arranged whole', async () => {
        const slides = [genSlide(0, 'Verse'), genSlide(1, 'Chorus')];
        const stage = await genLookAheadStage(slides);
        await stage.getStageSlides();
        expect(slides.every((slide) => slide._originalJson.canvasItems)).toBe(
            true,
        );
    });

    test('a single part is not arranged: it cannot know what follows it', async () => {
        const slides = [genSlide(1, 'Chorus')];
        const stage = await genLookAheadStage(slides);
        expect(
            await stage.getStageSlides('Chorus', { openLyricIndex: 1 }),
        ).toBe(slides);
        expect(slides[0]._originalJson.canvasItems).toBeUndefined();
    });
});
