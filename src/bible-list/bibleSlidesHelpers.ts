import AppDocument from '../app-document-list/AppDocument';
import Slide from '../app-document-list/Slide';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { getVerses } from '../helper/bible-helpers/bibleInfoHelpers';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { dirSourceSettingNames } from '../helper/constants';
import DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    getAvailableFileName,
    toPortableFileName,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import CanvasItemBibleItem from '../slide-editor/canvas/CanvasItemBibleItem';
import CanvasItemText from '../slide-editor/canvas/CanvasItemText';
import type { CanvasItemBiblePropsType } from '../slide-editor/canvas/CanvasItemBibleItem';
import type { CanvasItemTextPropsType } from '../slide-editor/canvas/CanvasItemText';
import { genTextStyle } from '../slide-editor/canvas/canvasHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type BibleItem from './BibleItem';
import { escapeHtmlText } from '../helper/sanitizeHelpers';
import { type AppColorType } from '../others/color/colorValueHelpers';

const SLIDE_BACKGROUND = '#101b29db' as AppColorType;
const READING_COLOR = '#f4f3ef' as AppColorType;
const PREVIEW_COLOR = '#ffffff59' as AppColorType;
const NEXT_VERSE_FONT_RATIO = 0.85;

export type BibleSlideOptions = {
    // Canvas pixels before fitting; omitted keeps the automatic reading size.
    fontSize?: number;
    theme?: 'dark' | 'light';
};

function genBackground({
    left,
    top,
    width,
    height,
    backgroundColor,
}: {
    left: number;
    top: number;
    width: number;
    height: number;
    backgroundColor: AppColorType;
}) {
    const background = CanvasItemText.genDefaultItem();
    background.applyProps({
        id: 0,
        text: '',
        left,
        top,
        width: Math.floor(width - left * 2),
        height: Math.floor(height - top * 2),
        backgroundColor,
        locked: true,
    });
    return background.toJson();
}

// Measure using the same markup and script-safe line height as the canvas.
// Long verses shrink to their allotted section instead of overlapping another
// translation. The measurement element exists only while generating this box.
function createTextProbe(
    props: CanvasItemTextPropsType | CanvasItemBiblePropsType,
) {
    const probe = document.createElement('div');
    Object.assign(probe.style, genTextStyle(props), {
        position: 'absolute',
        left: '-100000px',
        visibility: 'hidden',
        width: `${props.width}px`,
        height: 'auto',
        display: 'block',
        boxSizing: 'content-box',
    });
    if (props.type === 'text') {
        probe.innerHTML = props.text.replaceAll('\n', '<br />');
    } else {
        probe.innerHTML = props.html;
    }
    document.body.appendChild(probe);
    return probe;
}

function fitText(props: CanvasItemTextPropsType | CanvasItemBiblePropsType) {
    const probe = createTextProbe(props);
    try {
        const fits = (size: number) => {
            probe.style.fontSize = `${size}px`;
            probe.style.padding = `${size / 10}px`;
            // Canvas content boxes add their padding outside the declared size.
            return (
                probe.scrollHeight <= props.height &&
                probe.scrollWidth <= props.width + size / 5 + 1
            );
        };
        if (fits(props.fontSize)) {
            return;
        }
        let low = 1;
        let high = props.fontSize;
        for (let attempt = 0; attempt < 8; attempt++) {
            const middle = (low + high) / 2;
            if (fits(middle)) {
                low = middle;
            } else {
                high = middle;
            }
        }
        props.fontSize = Math.floor(low * 10) / 10;
    } finally {
        probe.remove();
    }
}

// Fit the whole reading layout together so the next verse stays exactly 85%
// of the current verse, even for long passages and scripts with tall glyphs.
function layoutVerseSlides(
    slides: ReturnType<typeof Slide.defaultSlideData>[],
    bibleCount: number,
    width: number,
    height: number,
    baseFontSize: number,
) {
    const gap = height * 0.01;
    const groupGap = height * 0.025;
    const margin = height * 0.02;
    const layouts = slides.map((slide) =>
        slide.canvasItems.slice(1).map((canvasItem, index) => {
            const props = canvasItem as
                CanvasItemTextPropsType | CanvasItemBiblePropsType;
            props.left = width * (index < bibleCount ? 0.02 : 0.04);
            props.width = width * (index < bibleCount ? 0.95 : 0.93);
            return { props, probe: createTextProbe(props), footprint: 0 };
        }),
    );
    try {
        const measure = (scale: number) => {
            // Batch style writes before measuring so a long chapter only needs
            // one browser layout per fitting attempt, not one per text box.
            for (const layout of layouts) {
                for (const [index, item] of layout.entries()) {
                    const size =
                        baseFontSize *
                        scale *
                        (index < bibleCount ? 1 : NEXT_VERSE_FONT_RATIO);
                    item.props.fontSize = size;
                    item.probe.style.fontSize = `${size}px`;
                    item.probe.style.padding = `${size / 10}px`;
                }
            }
            let fits = true;
            for (const layout of layouts) {
                let totalHeight = 0;
                for (const item of layout) {
                    const size = item.props.fontSize;
                    item.props.height = Math.max(1, item.probe.scrollHeight);
                    // The renderer adds its text padding outside the canvas box.
                    item.footprint = item.props.height + size / 5;
                    totalHeight += item.footprint;
                    if (
                        item.probe.scrollWidth >
                        item.props.width + size / 5 + 1
                    ) {
                        fits = false;
                    }
                }
                totalHeight += gap * (layout.length - 1);
                if (layout.length > bibleCount) {
                    totalHeight += groupGap;
                }
                if (totalHeight > height - margin * 2) {
                    fits = false;
                }
            }
            return fits;
        };
        if (!measure(1)) {
            let low = 0.001;
            let high = 1;
            for (let attempt = 0; attempt < 10; attempt++) {
                const middle = (low + high) / 2;
                if (measure(middle)) {
                    low = middle;
                } else {
                    high = middle;
                }
            }
            measure(low);
        }
        for (const layout of layouts) {
            let top = margin;
            for (const item of layout.slice(0, bibleCount)) {
                item.props.top = top;
                top += item.footprint + gap;
            }
            const previews = layout.slice(bibleCount);
            top =
                height -
                margin -
                previews.reduce((sum, item) => sum + item.footprint, 0) -
                gap * (previews.length - 1);
            for (const item of previews) {
                item.props.top = top;
                top += item.footprint + gap;
            }
        }
    } finally {
        for (const layout of layouts) {
            for (const { probe } of layout) {
                probe.remove();
            }
        }
    }
}

// Imported only when the menu command is pressed. Creating a document must not
// pull the slide editor into every Bible row (including the Reader) at startup.
export async function generateBibleItemSlides(
    source: BibleItem,
    selectedBibleKeys: string[] = [source.bibleKey],
    options: BibleSlideOptions = {},
) {
    const bibleItem = source.clone();
    const bibleKeys = [...new Set([bibleItem.bibleKey, ...selectedBibleKeys])];
    try {
        if (
            options.fontSize !== undefined &&
            (!Number.isFinite(options.fontSize) || options.fontSize <= 0)
        ) {
            throw new Error('Invalid Bible slide font size');
        }
        const isLightTheme = options.theme === 'light';
        const readingColor: AppColorType = isLightTheme
            ? '#182330'
            : READING_COLOR;
        const previewColor: AppColorType = isLightTheme
            ? '#18233066'
            : PREVIEW_COLOR;
        const dirSource = await DirSource.getInstance(
            dirSourceSettingNames.APP_DOCUMENT,
        );
        if (!dirSource.isDirPathValid) {
            throw new Error('Documents directory is unavailable');
        }
        const dirPath = dirSource.dirPath;
        const { bookKey, chapter, verseStart, verseEnd } = bibleItem.target;
        if (
            bibleItem.isError ||
            !Number.isInteger(verseStart) ||
            !Number.isInteger(verseEnd) ||
            verseStart > verseEnd
        ) {
            throw new Error('Bible passage is unavailable');
        }
        // Check the whole range before creating anything: never save a partial
        // passage or the Bible renderer's "??" missing-verse placeholder.
        for (const bibleKey of bibleKeys) {
            const verses = await getVerses(bibleKey, bookKey, chapter);
            for (let verse = verseStart; verse <= verseEnd; verse++) {
                if (!verses?.[String(verse)]?.trim()) {
                    showSimpleToast(
                        tran('Generate Slides'),
                        `${tran('Bible passage is unavailable in')}: ${bibleKey}`,
                    );
                    return null;
                }
            }
        }
        const kjvItem = bibleItem.clone();
        kjvItem.bibleKey = BIBLE_KJV_KEY;
        const title = await kjvItem.toTitle();
        const titleSlide = Slide.defaultSlideData(0);
        const { width, height } = titleSlide.metadata;
        const gap = Math.min(height * 0.01, (height * 0.2) / bibleKeys.length);
        const genBox = (index: number, contentHeight = height * 0.95) => ({
            id: index + 1,
            left: width * 0.02,
            top:
                height * 0.02 +
                (index * (contentHeight + gap)) / bibleKeys.length,
            width: width * 0.95,
            height:
                (contentHeight - gap * (bibleKeys.length - 1)) /
                bibleKeys.length,
            backgroundColor: '#00000000' as const,
            color: readingColor,
        });
        const fontScale =
            Math.min(width / 1920, height / 1080) / Math.sqrt(bibleKeys.length);
        const readingFontSize = options.fontSize ?? 88 * fontScale;
        titleSlide.name = title;
        const backgroundItemBox = genBox(0);
        const boxParams = {
            left: Math.floor(backgroundItemBox.left / 2),
            top: Math.floor(backgroundItemBox.top / 2),
            width,
            height,
            backgroundColor: isLightTheme
                ? ('#f4f3efdb' as AppColorType)
                : SLIDE_BACKGROUND,
        };
        const backgroundItem = genBackground(boxParams);
        titleSlide.canvasItems = [backgroundItem];
        const fontFamilies: string[] = [];
        for (const [index, bibleKey] of bibleKeys.entries()) {
            const titleBibleItem = bibleItem.clone();
            titleBibleItem.bibleKey = bibleKey;
            const titleItem = CanvasItemText.genDefaultItem();
            titleItem.applyProps({
                ...genBox(index),
                text: escapeHtmlText(
                    await titleBibleItem.toTitleWithBibleKey(),
                ),
                fontFamily: (await getBibleFontFamily(bibleKey)) || 'Arial',
                fontSize: readingFontSize * (112 / 88),
            });
            fontFamilies.push(titleItem.props.fontFamily!);
            if (titleItem.props.fontFamily) {
                await document.fonts.load(
                    `${titleItem.props.fontSize}px ${titleItem.props.fontFamily}`,
                );
            }
            fitText(titleItem.props);
            titleSlide.canvasItems.push(titleItem.toJson());
        }
        const slides = [titleSlide];
        for (let verse = verseStart; verse <= verseEnd; verse++) {
            const verseItem = bibleItem.clone();
            verseItem.target = {
                ...bibleItem.target,
                verseStart: verse,
                verseEnd: verse,
            };
            const slide = Slide.defaultSlideData(slides.length);
            slide.metadata = { width, height };
            slide.canvasItems = [genBackground(boxParams)];
            verseItem.bibleKey = BIBLE_KJV_KEY;
            slide.name = await verseItem.toTitle();
            for (const [index, bibleKey] of bibleKeys.entries()) {
                verseItem.bibleKey = bibleKey;
                const canvasItem = await CanvasItemBibleItem.fromBibleItem(
                    index + 1,
                    verseItem,
                );
                if (!(canvasItem instanceof CanvasItemBibleItem)) {
                    throw new Error('Unable to create Bible canvas item');
                }
                canvasItem.applyProps({
                    ...genBox(index),
                    fontFamily: fontFamilies[index],
                    fontSize: readingFontSize,
                    isCompactTitle: true,
                    isLightTheme,
                    html: CanvasItemBibleItem.genHtml(
                        canvasItem.props.bibleRenderingList,
                        true,
                        isLightTheme,
                    ),
                });
                slide.canvasItems.push(canvasItem.toJson());
            }
            if (verse < verseEnd) {
                const nextItem = bibleItem.clone();
                nextItem.target = {
                    ...bibleItem.target,
                    verseStart: verse + 1,
                    verseEnd: verse + 1,
                };
                const isOneKey = bibleKeys.length < 2;
                for (const [index, bibleKey] of bibleKeys.entries()) {
                    nextItem.bibleKey = bibleKey;
                    const preview = CanvasItemText.genDefaultItem();
                    const [nextVerse] =
                        (await nextItem.toVerseTextList()) ?? [];
                    if (!nextVerse) {
                        throw new Error('Unable to read the next verse');
                    }
                    preview.applyProps({
                        id: bibleKeys.length + index + 1,
                        text: escapeHtmlText(
                            `→ (${nextVerse.localeVerse})  ${nextVerse.text}` +
                                (isOneKey ? '' : ` (${bibleKey}) `),
                        ),
                        fontFamily: fontFamilies[index],
                        fontSize: readingFontSize * NEXT_VERSE_FONT_RATIO,
                        color: previewColor,
                        backgroundColor: '#00000000',
                        textHorizontalAlignment: 'left',
                        textVerticalAlignment: 'end',
                        left: 0,
                        top: 0,
                        width: 0,
                        height: 0,
                    });
                    slide.canvasItems.push(preview.toJson());
                }
            }
            slides.push(slide);
        }
        layoutVerseSlides(
            slides.slice(1),
            bibleKeys.length,
            width,
            height,
            readingFontSize,
        );
        // Serialize name selection + creation for repeated presses in this window.
        const fileSource = await unlocking(
            'generate-bible-slides',
            async () => {
                const name = await getAvailableFileName(
                    dirPath,
                    toPortableFileName(
                        `${title} ${bibleKeys.join('-')}`,
                        tran('Bible Item'),
                    ),
                    '.ows',
                );
                return AppDocument.createWithContent(dirPath, name, slides);
            },
        );
        if (fileSource === null) {
            throw new Error('Unable to create slide document');
        }
        dirSource.fireRefreshEvent();
        return fileSource;
    } catch (error) {
        handleError(error);
        showSimpleToast(
            tran('Generate Slides'),
            tran('Unable to generate slides from this Bible item'),
        );
        return null;
    }
}
