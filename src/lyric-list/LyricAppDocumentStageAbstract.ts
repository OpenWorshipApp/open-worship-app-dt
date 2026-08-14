import type {
    OpenLyricAttachment,
    OpenLyricElementMapOptions,
    OpenLyricValueOptions,
} from 'open-lyric';

import LyricAppDocument, {
    OPEN_LYRIC_FIRST_KEY,
    OPEN_LYRIC_NONE_KEY,
} from './LyricAppDocument';
import { type AnyObjectType } from '../helper/typeHelpers';
import { unlockingCacher } from '../server/unlockingHelpers';
import CacheManager from '../others/CacheManager';
import {
    DEFAULT_OPEN_LYRIC_FONT_SIZE,
    getOpenLyricFontSetting,
} from './lyricHelpers';
import type LyricSlide from './LyricSlide';
import { type CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import CanvasItemYouTube from '../slide-editor/canvas/CanvasItemYouTube';
import CanvasItemImage from '../slide-editor/canvas/CanvasItemImage';
import CanvasItemVideo from '../slide-editor/canvas/CanvasItemVideo';
import CanvasItemAudio from '../slide-editor/canvas/CanvasItemAudio';
import CanvasItemWebsite from '../slide-editor/canvas/CanvasItemWebsite';
import { checkIsUrlMediaSource } from '../helper/mediaSourceHelpers';

// Entries hold a whole song's rendered HTML, so keep the window short.
const cacheManager = new CacheManager<any>(10);

/**
 * The font rules that keep open-lyric's `<button>`s — the chord chips and the
 * `{p: #2}` pattern references — readable once the HTML leaves open-lyric.
 *
 * `getElementMap({ type: 'html' })` does not answer with markup plus a
 * stylesheet: it serializes the staged node with every computed style written
 * INLINE, minus each inherited property whose value already equals the parent's
 * — the parent is part of the returned string, so inheritance is expected to
 * reproduce those. `<button>` is the one element where that premise is false:
 * the UA sheet gives it `font: 400 13.333px Arial`, so a font the serializer
 * left out comes back as 13px Arial next to 61px lyrics.
 *
 * open-lyric styles the pattern reference `font: inherit`, i.e. byte-identical
 * to its parent, so BOTH its size and its family were dropped and `{p: #2}`
 * rendered tiny and in the wrong face. The chords keep their size on their own
 * (`.ol-preview-chord` is `.7em`, which differs from the parent) but lose the
 * family the same way.
 *
 * So the values below are deliberately NOT equal to the inherited ones —
 * `0.999em` rather than `1em` (0.1%, nothing can see it), and the family with a
 * fallback appended. That inequality is the entire mechanism: `1em` and
 * `inherit` compute to exactly the parent's value and get skipped again, which
 * is why the obvious spelling of this rule is a silent no-op. The real fix
 * belongs upstream — the serializer must not skip inherited properties on form
 * controls, which do not inherit them.
 */
function genFormControlFontCss(fontFamily?: string) {
    // open-lyric confines this sheet to its off-screen export stage
    // (`attachScopedStyle`), so the bare tag selector cannot reach anything
    // else — not the live preview, not another embed on the page.
    const familyRule = fontFamily
        ? `button {
                    font-family: ${fontFamily}, sans-serif !important;
                }`
        : '';
    return `${familyRule}

                .ol-preview-directive .ol-preview-pattern-reference {
                    font-size: 0.999em !important;
                }`;
}
export default abstract class LyricAppDocumentStageAbstract extends LyricAppDocument {
    get basicOpenLyricOptions() {
        const canvasItemBounds = this.canvasItemBounds;
        // Read ONCE for the whole options object: each access re-reads the
        // stage's setting, and this getter is on the per-slide path.
        const stageStyle = this.stageStyle;
        // `this.openLyric` is only ever assigned by `LyricSlidesPreviewerComp`,
        // so it is null in every renderer where that component has not mounted
        // (the screen window, a stage instance built on demand). Falling back to
        // the persisted setting keeps the projected slide at the same size as
        // the previewer instead of open-lyric's 16px default. Resolved BEFORE
        // the options below because the css has to NAME the family — see
        // `genFormControlFontCss`.
        const openLyric = this.openLyric;
        const savedFont = getOpenLyricFontSetting();
        const fontFamily = openLyric?.fontFamily || savedFont.fontFamily;
        const options: OpenLyricElementMapOptions = {
            type: 'html',
            isWithKeyNote: false,
            // open-lyric wants 0..1; the setting holds an integer percentage
            // because `AppRangeComp` cannot produce a fraction. Same conversion
            // as `toOpenLyricBackgroundAlpha`, inlined so this module keeps its
            // import list free of `./lyricStageStyleHelpers` (see `stageStyle`).
            backgroundAlpha: stageStyle.backgroundAlphaPercentage / 100,
            theme: stageStyle.theme,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
            isShowingAttachments: false,
            isShowingStrummingPatterns: false,
            css: `
                .ol-song-view__info-card .ol-song-view__title {
                    font-size: 1.6em !important;
                }

                ${genFormControlFontCss(fontFamily)}
            `,
        };
        const currentFontSize =
            openLyric === null
                ? savedFont.fontSize
                : Number.parseInt(openLyric.fontSize.split('px')[0]);
        options.fontSize =
            (Number.isNaN(currentFontSize)
                ? DEFAULT_OPEN_LYRIC_FONT_SIZE
                : currentFontSize) + stageStyle.extraFontSize;
        if (fontFamily) {
            options.fontFamily = fontFamily;
        }
        return options;
    }

    // OVERRIDES over `basicOpenLyricOptions`, never a standalone options bag —
    // `allOpenLyricOptions` spreads them on top of it. So every key is optional,
    // `type` included: the basic options are what settle it, and a stage that
    // had to restate it could silently ask for a form its slides cannot use.
    abstract get stageOpenLyricOptions(): Partial<OpenLyricElementMapOptions>;

    /**
     * The stage's own `css` with the operator's custom rules APPENDED.
     *
     * Appended, never handed to either side of the spread below: `css` is a
     * plain string, so whichever object carries it LAST replaces the other's
     * outright — and stage 0's css is what hides the chords and the section
     * titles and centres the lines. Dropping it would silently turn stage 0
     * into stage 1. Appending is also what the operator expects, since
     * equal-specificity rules are last-wins.
     *
     * Returns the SAME object when there is nothing to add, so `genCacheKey`
     * stays byte-identical for anyone who never opens the panel — no
     * cold-start re-render of every song for existing installs.
     */
    protected withCustomCss<T extends { css?: string }>(options: T): T {
        const customCss = this.stageStyle.customCss;
        if (customCss.trim() === '') {
            return options;
        }
        const stageCss = options.css ?? '';
        return { ...options, css: `${stageCss}\n${customCss}` };
    }

    get allOpenLyricOptions() {
        // Read ONCE each: both are getters that rebuild their object per access,
        // and `basicOpenLyricOptions` re-parses the font setting while doing it.
        const basicOptions = this.basicOpenLyricOptions;
        const stageOptions = this.stageOpenLyricOptions;
        // Only a side that HAS rules is joined. An empty one must not leave a
        // stray newline behind: `genCacheKey` hashes this string, so a stage
        // whose css is all on one side would otherwise get a different key —
        // and a cold re-render of every song — for no difference in the output.
        const css = [basicOptions.css, stageOptions.css]
            .filter(Boolean)
            .join('\n');
        return this.withCustomCss({
            ...basicOptions,
            ...stageOptions,
            css,
        });
    }

    genCacheKey(prefix: string, options: AnyObjectType) {
        const sortedKeys = Object.keys(options).sort();
        const keyParts = sortedKeys
            .map((key) => {
                const value = options[key];
                return `${key}:${JSON.stringify(value)}`;
            })
            .concat([`filePath:${this.filePath}`, `stage:${this.stage}`]);
        return `${prefix}|${keyParts.join('|')}`;
    }

    abstract cleanDataMap(dataMap: AnyObjectType): void;

    // `getOpenLyricPreviewer()` re-reads the lyric file and every language
    // module, so it must stay INSIDE the callback: `unlockingCacher` only runs
    // the callback on a cache miss, whereas awaiting the previewer up front made
    // every cache hit pay the full init cost.
    getElementMap(options: OpenLyricElementMapOptions) {
        return unlockingCacher<AnyObjectType>(
            this.genCacheKey('get-element-map', options),
            async () => {
                const openLyricPreviewer = await this.getOpenLyricPreviewer();
                const dataMap = await openLyricPreviewer.getElementMap(options);
                this.cleanDataMap(dataMap);
                return dataMap;
            },
            cacheManager,
        );
    }

    getValue(options: OpenLyricValueOptions) {
        return unlockingCacher<string>(
            this.genCacheKey('get-value', options),
            async () => {
                const openLyricPreviewer = await this.getOpenLyricPreviewer();
                return await openLyricPreviewer.getValue(options);
            },
            cacheManager,
        );
    }

    abstract getFirstCanvasItemProps(): Promise<CanvasItemPropsType | null>;

    // An attachment becomes ONE canvas item filling the whole slide. Each kind
    // builds its own props through its class's `genCanvasItemPropsFromLink`,
    // which takes the box rather than choosing one — deliberately NOT the
    // `genCanvasItemFromLink` factories, which is the obvious first instinct:
    // the image/video ones download the media just to measure it, and a song's
    // slides are rebuilt often enough that a fetch per attachment is not
    // acceptable — the box is the slide's bounds regardless of the media's own
    // ratio, so the measurement would be discarded anyway. Validation is not
    // lost: the props go through `CanvasItemX.fromJson` when the slide is
    // turned into a canvas.
    genCanvasItemPropsFromAttachment(
        attachment: OpenLyricAttachment,
        canvasItemBounds = this.canvasItemBounds,
    ): CanvasItemPropsType | null {
        const { type, link } = attachment;
        const boxProps = this.genCanvasItemBoundsProps(
            -1,
            true,
            canvasItemBounds,
        );
        if (type === 'youtube') {
            return CanvasItemYouTube.genCanvasItemPropsFromLink(link, boxProps);
        }
        if (type === 'pdf') {
            // will handle pdf in the future
            return null;
        }
        // open-lyric falls back to `other` with the RAW TEXT as `link` when the
        // line does not parse as a URL, and a media type is guessed from the
        // path extension of a link that may still be neither remote nor local
        // (`ftp://`, `data:`), so nothing below may assume `link` is usable.
        if (!checkIsUrlMediaSource(link)) {
            return null;
        }
        if (type === 'image') {
            return CanvasItemImage.genCanvasItemPropsFromLink(link, boxProps);
        }
        if (type === 'video') {
            return CanvasItemVideo.genCanvasItemPropsFromLink(link, boxProps);
        }
        if (type === 'audio') {
            return CanvasItemAudio.genCanvasItemPropsFromLink(link, boxProps);
        }
        // `other` — a link that points at no media the canvas can play is shown
        // as the page it is.
        return CanvasItemWebsite.genCanvasItemPropsFromLink(link, boxProps);
    }

    genSlidesFromAttachments(attachments: OpenLyricAttachment[]) {
        // Both getters walk the screen display list on every read, so they are
        // read once for the whole batch rather than once per attachment.
        const displayDim = this.displayDim;
        const canvasItemBounds = this.canvasItemBounds;
        const slides: LyricSlide[] = attachments.map((attachment) => {
            const canvasItemProps = this.genCanvasItemPropsFromAttachment(
                attachment,
                canvasItemBounds,
            );
            // An attachment the canvas cannot show still gets its slide, so the
            // song's slide list keeps naming everything the song attaches.
            return this.genLyricSlide(
                -1,
                attachment.title,
                canvasItemProps === null ? [] : [canvasItemProps],
                displayDim,
            );
        });
        return slides;
    }

    async getStageSlides(key?: string) {
        // Only the whole-song branch below needs the previewer instance; the
        // single-key branch is served from the element-map cache, so resolving
        // it up front would re-read the file for nothing.
        if (key !== undefined) {
            if (key === OPEN_LYRIC_NONE_KEY) {
                const slide = this.genSlide(key, -1, {});
                return [slide];
            } else if (key === OPEN_LYRIC_FIRST_KEY) {
                const firstCanvasItemProps =
                    await this.getFirstCanvasItemProps();
                const slide = this.genLyricSlide(
                    -1,
                    OPEN_LYRIC_FIRST_KEY,
                    firstCanvasItemProps === null ? [] : [firstCanvasItemProps],
                );
                return [slide];
            }
            const dataMap = await this.getElementMap({
                ...this.allOpenLyricOptions,
                key,
            });
            const slide = this.genSlide(key, -1, dataMap);
            return [slide];
        }

        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        const structure = openLyricPreviewer.getStructure();

        const [firstCanvasItemProps, dataMap] = await Promise.all([
            this.getFirstCanvasItemProps(),
            this.getElementMap(this.allOpenLyricOptions),
        ]);
        const displayDim = this.displayDim;
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i, dataMap, displayDim, i);
        });
        const newSlides = this.extendExtraSlide(
            slides,
            dataMap,
            firstCanvasItemProps,
        );
        const attachments = openLyricPreviewer.getAttachments();
        const attachmentSlides = this.genSlidesFromAttachments(attachments);
        const lastSlideId = newSlides.length - 1;
        attachmentSlides.forEach((slide, i) => {
            slide.id = lastSlideId + 1 + i;
        });
        newSlides.push(...attachmentSlides);
        return newSlides;
    }

    async getSlides(key?: string) {
        return this.getStageSlides(key);
    }

    private async getSlideByIdSlow(id: number) {
        const slides = await this.getSlides();
        return slides.find((slide) => slide.id === id) ?? null;
    }

    async getSlideById(id: number) {
        const slidesQuick = await this.getSlidesQuick();
        const slideQuick = slidesQuick.find((slide) => slide.id === id) ?? null;
        if (slideQuick === null) {
            // The quick list is `structure` alone, so it cannot see the slides
            // this stage APPENDS — the attachment slides (`genSlidesFromAttachments`)
            // and whatever `extendExtraSlide` adds, which are numbered after the
            // structure's own. A presenting flow stores a lyric slide by id, and an id
            // from up there missed here and left the entry unreadable: the row
            // previewed "Fail to read file data" and presented nothing at all.
            // Falling back to the full list is the slow path on purpose — it
            // renders the whole song — but it only runs for those few ids.
            return await this.getSlideByIdSlow(id);
        }
        const key = slideQuick.openLyricKey;
        const slides = await this.getSlides(key);
        const slide =
            slides.find((slide) => slide.openLyricKey === key) ?? null;
        if (slide === null) {
            return await this.getSlideByIdSlow(id);
        }
        slide.id = slideQuick.id;
        return slide;
    }

    /**
     * Drops the slides derived from THIS document, at every stage.
     *
     * `cacheManager` is module-level and shared by every stage of every lyric,
     * so a plain `clear()` would make one song's edit throw away the derived
     * slides of every other song too. The key carries the file path — see
     * `genCacheKey`.
     */
    clearCache() {
        cacheManager.deleteMatchedSync((key) => {
            return key.includes(`|filePath:${this.filePath}|`);
        });
    }
}
