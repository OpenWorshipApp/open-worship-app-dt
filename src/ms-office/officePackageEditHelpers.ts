// A whole PowerPoint or Word package read as lines and changed by a list of
// asks -- the rules behind `owa_office_edit` (2026-11-20, the user: _open
// pptx or docx in chatbot then interact to edit the powerpoint_, _able to
// undo_, the goal _chatbot smart enough to help editor the pptx and docx
// file_).
//
// Pure: the package is handed in as its part names and a reader of one part,
// and what comes back is the parts to write (`null` for one taken out). The
// app's worker (`src/helper/agentOfficeEditHelpers.ts`) reads the file, backs
// it up and writes it; nothing here touches a disk.
//
// What a deck is to PowerPoint, and kept that way so it never asks to
// "repair" the file: the slides' order is `p:sldIdLst` in
// `ppt/presentation.xml`, each slide a part reached by a relationship; its
// speaker notes a part its own relationships name; every part listed in
// `[Content_Types].xml`. A slide moved, copied or taken out changes all of
// them together, and one another slide links to, or a custom show lists, is
// refused rather than left pointing nowhere.

import {
    type OfficeDialectType,
    type OfficeParagraphType,
    escapeXmlText,
    listOfficeParagraphs,
    rebuildParagraph,
    replaceInParagraph,
    setParagraphText,
    toWrittenText,
    toXmlSafeText,
    unescapeXml,
} from './officeXmlEditHelpers';
import {
    DEFAULT_DOCX_SIZE,
    DEFAULT_PPTX_SIZE,
    type OfficeLookType,
    applyParagraphLook,
    applyWordsLook,
    checkIsOfficeColorOff,
    describeOfficeLook,
    readOfficeLook,
    setSlideBackgroundXml,
    setSlideHiddenXml,
    toOfficeColor,
    toOfficeColorWords,
    toOfficeFill,
    toOfficeFillWords,
    listOfficeLinkTokens,
} from './officeXmlLookHelpers';
import {
    type BoxPlaceType,
    type OfficeShapeType,
    type SlideBoxKindType,
    type SlideBoxType,
    type SlideSizeType,
    addSlideShapeXml,
    addSlideTextBoxXml,
    OFFICE_SHAPE_WORD_LIST,
    toOfficeShape,
    findBoxPlace,
    findFreeBoxName,
    findCoveringPicture,
    findNamedBoxes,
    listSlideBoxes,
    readBoxPlaceholder,
    readInheritedSize,
    readSlideSize,
    removeSlideBoxXml,
    setBoxPlaceXml,
    setBoxShapeXml,
    toBoxPlace,
    toPercentPlace,
} from './officeSlideBoxHelpers';
import {
    OFFICE_SLIDE_SIZE_LIST,
    OFFICE_TRANSITION_LIST,
    readSlideTransition,
    scaleSlidePartXml,
    setPresentationSizeXml,
    setSlideTransitionXml,
    toOfficeSlideSize,
    toOfficeTransition,
} from './officeSlideShowHelpers';
import {
    OFFICE_ANIMATION_LIST,
    readSlideAnimations,
    setShapeAnimationXml,
    toOfficeAnimation,
} from './officeSlideAnimationHelpers';
import {
    addTableColumnXml,
    addTableRowXml,
    listSlideTables,
    removeTableColumnXml,
    removeTableRowXml,
} from './officeSlideTableHelpers';
import {
    type OfficeLayoutType,
    genSlideFromLayout,
    pickLayout,
    readOfficeLayout,
} from './officeSlideLayoutHelpers';
import {
    type OfficeChartDataType,
    findSheetPath,
    listSheetTablePaths,
    readChartData,
    setChartDataXml,
    setSheetCellsXml,
    setSheetTableXml,
} from './officeChartHelpers';
import {
    OFFICE_CHART_KIND_LIST,
    setChartKindXml,
    toOfficeChartKind,
} from './officeChartKindHelpers';
import { setTableLookXml } from './officeSlideTableLookHelpers';
import {
    fitWordPicture,
    genWordPictureParagraphXml,
    nextWordDrawingId,
    readWordPageColor,
    readWordTextWidthEmu,
    setWordDisplayBackgroundXml,
    setWordPageColorXml,
} from './officeWordLookHelpers';
import { openOfficePackage, rewriteZipParts } from './officePackageIoHelpers';
import {
    type OfficePictureInfoType,
    addSlidePictureXml,
    checkIsFillingPlace,
    genPictureCropXml,
    listCoveredWordBoxes,
    readBoxPictureRelId,
    readPictureInfo,
    setBoxPictureXml,
    toPicturePlace,
    withRelationshipNamespace,
} from './officeSlidePictureHelpers';
import {
    type OfficeMediaInfoType,
    OFFICE_MEDIA_REL_TYPE,
    addMediaTimingXml,
    dropMediaTimingXml,
    fitMediaBox,
    genMediaPicXml,
    genMediaPosterPng,
    readOfficeMediaDurationMs,
    readOfficeMediaInfo,
} from './officeSlideMediaHelpers';
import {
    SMARTART_ARRANGE_LIST,
    type SmartArtArrangeType,
    convertSmartArtToShapesXml,
    describeSmartArtShapes,
} from './officeSmartArtShapeHelpers';
import {
    SMARTART_LAYOUT_CHOICES_TEXT,
    SMARTART_LAYOUT_LIST,
    changeSmartArtLayoutXml,
    describeSmartArtLayout,
    toSmartArtLayoutRoom,
} from './officeSmartArtLayoutHelpers';
import {
    type SmartArtBoxEditType,
    changeSmartArtLayoutFromXml,
    copyMissingStyleLabels,
    describeSmartArtBoxWords,
    editSmartArtBoxesXml,
    listSmartArtBoxWords,
    readSmartArtLayoutId,
    removeSmartArtDrawingLink,
} from './officeSmartArtModelHelpers';
import {
    type OfficeFooterKindType,
    checkIsTitleLayout,
    setSlideFooterXml,
} from './officeSlideFooterHelpers';
import {
    type OfficeBoxLookType,
    applyBoxLookXml,
    describeOfficeBoxLook,
    moveSlideBoxXml,
    readOfficeBoxLook,
} from './officeSlideBoxLookHelpers';
import {
    genNotesMasterXml,
    genNotesSlideXml,
    genThemeXml,
} from './pptxXmlHelpers';
import { findSlidesSaying, readSlideValue } from './officeSlideNameHelpers';
import {
    applyOfficeThemeXml,
    type OfficeThemeAskType,
    readOfficeThemeAsk,
    toOfficeThemeWords,
} from './officeThemeHelpers';

export type OfficePackageType = {
    names: readonly string[];
    readText: (name: string) => Promise<string | null>;
    // a part's own bytes -- a chart's embedded workbook, itself a package
    readBytes?: (name: string) => Promise<Uint8Array | null>;
};

export type OfficeKindType = OfficeDialectType;

export type OfficeLineType = OfficeParagraphType & { id: string };

export type OfficeSlideType = {
    number: number;
    partPath: string;
    relsPath: string;
    notesPath: string | null;
    relId: string;
    sldId: string;
    isHidden: boolean;
    lines: OfficeLineType[];
    note: string | null;
    // its boxes by name, where each is and the lines in it, the picture
    // covering the whole slide said
    boxes: OfficeBoxType[];
    // the layout it shows, when its relationships name one
    layoutPath: string | null;
    transition: { kind?: string; advance?: number } | null;
    /**
     * A slide master or a layout read as a slide (`SHARED_SLIDE_BASE`):
     * its own shapes are on every slide that uses it. What the model
     * writes in `slide` for it ("master", "layout: Title Slide"), and
     * what the answer calls it.
     */
    sharedValue?: string;
    sharedLabel?: string;
    // a layout's: the slides that show it
    sharedSlideNumbers?: number[];
};

/**
 * The numbers the slide masters and the layouts are read under: no deck
 * comes near them, so every change a slide takes reaches a master's own
 * shapes unchanged, and the words said are put right on the way out
 * (`toSharedSlideWords`). 2026-11-21, the goal _chatbot can change do
 * everything on a given pptx_: the master's own shapes had been
 * PowerPoint's.
 */
export const SHARED_SLIDE_BASE = 10000;
const SHARED_LAYOUT_BASE = 10100;

// A slide named with its first words: the answer relays where a picture
// went by what that slide shows (2026-11-21: a picture asked for on a
// slide named by words no slide had went on the last slide, said only as
// "slide 4").
const MAX_SLIDE_SHOWN_CHARS = 40;
function toSlideShownText(slide: OfficeSlideType) {
    const first =
        slide.lines
            .map((line) => {
                return line.text.replace(/\s+/g, ' ').trim();
            })
            .find((text) => {
                return text !== '';
            }) ?? '';
    if (first === '') {
        return `slide ${slide.number}`;
    }
    const shown =
        first.length > MAX_SLIDE_SHOWN_CHARS
            ? `${first.slice(0, MAX_SLIDE_SHOWN_CHARS - 1)}…`
            : first;
    return `slide ${slide.number} (${JSON.stringify(shown)})`;
}

const MAX_SLIDES_LISTED = 12;

function toSlidesListedText(slides: readonly OfficeSlideType[]) {
    const listed = slides.slice(0, MAX_SLIDES_LISTED).map((slide) => {
        return toSlideShownText(slide);
    });
    const more = slides.length - listed.length;
    return listed.join(', ') + (more > 0 ? ` and ${more} more` : '');
}

// what a master or a layout never takes: a slide's own place, notes,
// show and the deck's whole
const SHARED_REFUSED_KEY_LIST = [
    'note',
    'to',
    'removeSlide',
    'duplicate',
    'hidden',
    'transition',
    'advance',
    'slideNumbers',
    'footer',
    'slideSize',
    'theme',
    'media',
    'play',
    'animation',
    'byLine',
    'when',
    'seconds',
    'newSlide',
    'layout',
    'title',
    'lines',
    'pageColor',
    'width',
    'toShapes',
    'arrange',
    'smartArtLayout',
    'smartArtAdd',
    'smartArtRemove',
    'smartArtMove',
] as const;

// where a SmartArt's boxes were laid out, in a box's `at` (% of the
// slide), so a bigger place can be asked for
function toLaidPlaceText(
    place: { x: number; y: number; cx: number; cy: number } | null,
    size: SlideSizeType,
) {
    if (place === null) {
        return '';
    }
    const at = [
        place.x / size.cx,
        place.y / size.cy,
        place.cx / size.cx,
        place.cy / size.cy,
    ].map((value) => {
        return Math.round(value * 100);
    });
    return `, in at [${at.join(', ')}] of the slide (another \`at\` lays it out bigger)`;
}

// how a SmartArt's boxes were laid out, said back
const ARRANGE_TEXT_MAP: Record<
    SmartArtArrangeType,
    { text: string; arrows: string }
> = {
    cycle: {
        text: 'in a circle, clockwise from the top',
        arrows: ', an arrow from each to the next and from the last back to the first',
    },
    row: {
        text: 'in a row, left to right',
        arrows: ', an arrow between each two',
    },
    column: {
        text: 'in a column, top to bottom',
        arrows: ', an arrow between each two',
    },
};

/**
 * The master or the layout a `slide` names -- "master", "master 2",
 * "layout: Title Slide" -- null when it names neither, a reason when it
 * names one the deck does not have or no slide uses.
 */
function findSharedSlide(
    document: OfficeDocumentType,
    value: unknown,
): OfficeSlideType | { reason: string } | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().replace(/\s+/g, ' ');
    const master = /^(?:the )?(?:slide )?master(?: (\d+))?$/i.exec(text);
    const layout = /^layout ?: ?(.+)$/i.exec(text);
    if (master === null && layout === null) {
        return null;
    }
    if (document.kind !== 'pptx') {
        return { reason: 'A Word file has no slide master.' };
    }
    const shared = document.shared ?? [];
    const wanted =
        master !== null
            ? master[1] === undefined || master[1] === '1'
                ? 'master'
                : `master ${master[1]}`
            : `layout: ${(layout?.[1] ?? '').trim()}`;
    const found = shared.find((one) => {
        return one.sharedValue?.toLowerCase() === wanted.toLowerCase();
    });
    if (found !== undefined) {
        return found;
    }
    return {
        reason:
            `The deck has no ${JSON.stringify(wanted)}` +
            (layout === null ? '' : ' that a slide uses') +
            '. It has: ' +
            (shared.length === 0
                ? 'none'
                : shared
                      .map((one) => {
                          return JSON.stringify(one.sharedValue);
                      })
                      .join(', ')) +
            '.',
    };
}

/**
 * The words a change said of a master or a layout read under its number
 * (`SHARED_SLIDE_BASE`): "slide 10001" said as "the slide master", and a
 * `slide` to write as the one the model gives.
 */
function toSharedSlideWords(document: OfficeDocumentType, text: string) {
    if (document.kind !== 'pptx' || (document.shared ?? []).length === 0) {
        return text;
    }
    let out = text;
    for (const shared of document.shared ?? []) {
        const label = shared.sharedLabel ?? 'the slide master';
        const title = label.charAt(0).toUpperCase() + label.slice(1);
        out = out
            // "Line 10001.2 now reads": its line, by the id it was read by
            .replace(
                new RegExp(`\\b(L|l)ine (${shared.number}\\.\\d+)`, 'g'),
                (_match, letter: string, id: string) => {
                    return `${letter === 'L' ? title : label}'s line ${id}`;
                },
            )
            .replace(
                new RegExp(`\\bslide: ${shared.number}\\b`, 'g'),
                `slide: ${JSON.stringify(shared.sharedValue)}`,
            )
            .replace(new RegExp(`\\bSlide ${shared.number}\\b`, 'g'), title)
            .replace(new RegExp(`\\bslides? ${shared.number}\\b`, 'g'), label);
    }
    return out;
}

/**
 * Each change's `slide` as a number: a slide named by its words (`EC-774`)
 * is the one slide saying them. None or several is a refusal that lists
 * the slides, so the model asks which one instead of choosing.
 */
function resolveSlideNames(
    document: OfficeDocumentType,
    changes: readonly OfficeAskedChangeType[],
): { changes: OfficeChangeType[] } | { reason: string } {
    const resolved: OfficeChangeType[] = [];
    for (const change of changes) {
        const shared = findSharedSlide(document, change.slide);
        if (shared !== null) {
            if ('reason' in shared) {
                return shared;
            }
            const refusedKey = SHARED_REFUSED_KEY_LIST.find((key) => {
                return change[key] !== undefined;
            });
            if (refusedKey !== undefined) {
                return {
                    reason:
                        `\`${refusedKey}\` is a slide's, never ` +
                        `${shared.sharedLabel ?? 'the slide master'}'s: a ` +
                        'master or a layout takes its own boxes (their ' +
                        'words, looks, place and pictures), new text boxes, ' +
                        'shapes and pictures, and its background.',
                };
            }
            resolved.push({ ...change, slide: shared.number });
            continue;
        }
        const value = readSlideValue(change.slide);
        if (value.kind === 'none') {
            resolved.push(change as OfficeChangeType);
            continue;
        }
        if (value.kind === 'bad') {
            return {
                reason:
                    "`slide` is a slide's number, or the words written " +
                    'on it that the person named it by.',
            };
        }
        if (value.kind === 'number') {
            resolved.push({ ...change, slide: value.number });
            continue;
        }
        if (document.kind !== 'pptx') {
            return { reason: 'A Word file has no slides.' };
        }
        const numbers = findSlidesSaying(
            document.slides.map((slide) => {
                return {
                    number: slide.number,
                    text: slide.lines
                        .map((line) => {
                            return line.text;
                        })
                        .join('\n'),
                };
            }),
            value.words,
        );
        if (numbers.length === 1) {
            resolved.push({ ...change, slide: numbers[0] });
            continue;
        }
        const ask =
            ' Ask the person which slide they mean, the slides as OPTIONS; ' +
            'never choose one for them.';
        if (numbers.length === 0) {
            return {
                reason:
                    `No slide says ${JSON.stringify(value.words)}. The ` +
                    `slides: ${toSlidesListedText(document.slides)}.${ask}`,
            };
        }
        return {
            reason:
                `${numbers.length} slides say ` +
                `${JSON.stringify(value.words)}: ` +
                `${toSlidesListedText(
                    document.slides.filter((slide) => {
                        return numbers.includes(slide.number);
                    }),
                )}.${ask}`,
        };
    }
    return { changes: resolved };
}

export type OfficeBoxType = {
    name: string;
    kind: SlideBoxKindType;
    // its `p:cNvPr id`: what an animation targets
    shapeId: string | null;
    // a table's size, a chart's words and numbers, the box's entrance
    // animation (EC-771)
    table?: { rows: number; columns: number };
    chart?: OfficeChartDataType & { path: string };
    chartRelId?: string;
    // a SmartArt's words, read off its data part; the drawing PowerPoint
    // keeps beside it for readers that cannot lay one out changes with it
    smartArt?: {
        words: string[];
        dataPath: string;
        drawingPath: string | null;
        // its layout's id ("chevron1"), and each box under another by the
        // words of the box it is under (EC-787)
        layout: string | null;
        under: Record<string, string> | null;
    };
    smartArtRelId?: string;
    animation?: { effect: string; byLine: boolean };
    // a placeholder's type ("title", "body"), as a line's `box` reads it
    placeholder: string | null;
    // [x, y, width, height] in % of the slide; null when nothing says
    at: number[] | null;
    isFilling: boolean;
    lineIds: string[];
};

export type OfficeDocumentType =
    | {
          kind: 'pptx';
          mainPath: string;
          slides: OfficeSlideType[];
          notesMasterPath: string | null;
          slideSize: SlideSizeType;
          // the deck's own layouts, what a new slide is made from
          layouts: OfficeLayoutType[];
          // the slide masters and the layouts the slides use, as slides
          shared?: OfficeSlideType[];
      }
    | {
          kind: 'docx';
          mainPath: string;
          lines: OfficeLineType[];
          // its page's own colour (RRGGBB), null when it has none
          pageColor?: string | null;
      };

/** A change as asked: `slide` may be the words the slide says (`EC-774`). */
export type OfficeAskedChangeType = Omit<OfficeChangeType, 'slide'> & {
    slide?: number | string;
};

export type OfficeChangeType = {
    id?: string;
    text?: string;
    remove?: boolean;
    after?: string;
    before?: string;
    slide?: number;
    note?: string;
    to?: number;
    removeSlide?: boolean;
    duplicate?: boolean;
    // the words' look -- on a line (`id`, or the new line `after` /
    // `before` makes), every line of a `slide`, or with neither, every line
    // of the file (`officeXmlLookHelpers.ts`)
    color?: string;
    highlight?: string;
    // points, or a change of each word's own size ("+20%", "-4")
    size?: number | string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    font?: string;
    align?: string;
    // a soft shadow behind the words, the space from line to line (times
    // one line) and a deck's bullets on or off (2026-11-21)
    shadow?: boolean;
    strike?: boolean;
    lineSpacing?: number | string;
    bullets?: boolean;
    // a box's own look, on `box` or on the new `textBox` / `picture`
    // (`officeSlideBoxLookHelpers.ts`, 2026-11-21): its fill and outline
    // (a colour, "none"), how see-through its fill or a picture is (0 to
    // 100), a picture's brightness (-100 to 100), its turn in degrees,
    // where its words sit and its place in front of or behind the others
    fill?: string;
    outline?: string;
    transparency?: number | string;
    // a deck's words made a link: a web address, "slide 3", "none"
    link?: string | number;
    // Insert → Header & Footer: each slide's number, and a footer's words
    // ("none" off); no `slide`: every slide but a title slide
    slideNumbers?: boolean;
    footer?: string;
    // a new shape on `slide` at `at` -- an arrow, a circle, a star, a line
    // (`toOfficeShape`) -- its words the `textBox` given with it
    shape?: string;
    brightness?: number | string;
    rotate?: number | string;
    flip?: string;
    valign?: string;
    order?: string;
    // a slide's own: its background colour ("none": its layout's again)
    // and whether the show skips it; with no `slide`, the background of
    // every slide
    background?: string;
    hidden?: boolean;
    // a box of the slide taken out by its name (a picture, a text box);
    // with no `slide`, that box of every slide that has one
    removeBox?: string;
    // the SmartArt named by `box` turned into the shapes it is drawn with,
    // as PowerPoint's Convert to Shapes (2026-11-21)
    toShapes?: boolean;
    // its boxes laid out in a circle, a row or a column as they become
    // shapes (2026-11-21)
    arrange?: SmartArtArrangeType;
    // the SmartArt named by `box` given another of PowerPoint's layouts and
    // kept a SmartArt (2026-11-21, EC-784) -- one of five, or the layout
    // read on another SmartArt of the deck (EC-787)
    smartArtLayout?: string;
    // a box of the SmartArt named by `box` added, taken out or moved, by
    // the words on the boxes, in any layout (2026-11-21, EC-787)
    smartArtAdd?: string;
    smartArtRemove?: string;
    smartArtMove?: string;
    afterBox?: string;
    beforeBox?: string;
    underBox?: string;
    /** With `words` alone: every place they are written, a master's box too. */
    everywhere?: boolean;
    // the look given to these words only, wherever the change reaches
    words?: string;
    // a box by name (or a line's `box`, or a line id in it): moved and
    // sized by `at`, or the lines in it given a look; no `slide`, on every
    // slide that has it
    box?: string;
    // [x, y, width, height] in % of the slide; a null keeps one
    at?: (number | null)[];
    // a new text box's words, on `slide`, at `at`, in the look given
    textBox?: string;
    // a slide's transition ("fade", "none" …) and the seconds it waits
    // before going on by itself (0: a click); no `slide`, every slide
    transition?: string;
    advance?: number;
    // the deck's slide size: "16:9", "4:3", "16:10"
    slideSize?: string;
    // the deck's theme: {colors, headingFont, bodyFont} (officeThemeHelpers)
    theme?: unknown;
    // a picture attached to the chat -- its path, as the window put it in
    // -- put on `slide` at `at` (none: every slide), or with `box` in the
    // place of the picture that box draws
    picture?: string;
    // a video or a sound attached to the chat -- its path, as the window put
    // it in -- put on `slide` at `at` to play there (2026-11-21): `play`
    // "click" (the default: as PowerPoint puts one in) or "auto"
    media?: string;
    play?: string;
    // an entrance animation on a `box` (none named: every box of words on
    // the slide; no `slide`: every slide), "none" taking it off (EC-771)
    animation?: string;
    byLine?: boolean;
    when?: 'click' | 'with' | 'after';
    seconds?: number;
    // a table on `slide`, by its name: a row or a column added (the number
    // it becomes, its words in `cells`) or taken out
    table?: string;
    addRow?: number;
    removeRow?: number;
    addColumn?: number;
    removeColumn?: number;
    cells?: string[];
    // the table's own colours: its cells' fill (only `rows` / `columns`
    // when named), the style's header row and bands, its borders
    tableLook?: {
        fill?: string | null;
        rows?: number[];
        columns?: number[];
        header?: boolean;
        banded?: boolean;
        borders?: string | null;
    };
    // a Word file's page colour ("none" off), and a picture's width there
    // in % of the page's text width
    pageColor?: string;
    width?: number;
    // a new slide on one of the deck's layouts, at `to` (none: the end)
    newSlide?: boolean;
    layout?: string;
    title?: string;
    lines?: string[];
    // a chart on `slide`, by its name: its title, category labels and a
    // series' name or numbers (by its index as read)
    chart?: string;
    // its kind: column, bar, line, pie, doughnut or area
    chartKind?: string;
    chartTitle?: string;
    categories?: string[];
    series?: { index: number; name?: string; values?: (number | null)[] }[];
};

export type OfficeReplaceType = { from: string; to: string };

export type OfficeEditResultType =
    | {
          // part name -> its new text, a new picture's bytes, or null when
          // it is taken out
          parts: Map<string, string | Uint8Array | null>;
          changed: string[];
      }
    | { reason: string };

const REL_TYPE_BASE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const NOTES_SLIDE_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml';
const NOTES_MASTER_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml';
const THEME_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.theme+xml';
const SLIDE_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
// Words one ask may write: far past any deck, short of a pasted book.
const MAX_CHANGE_TEXT_CHARS = 20000;

// --- relationships and paths ----------------------------------------------

type RelType = {
    id: string;
    type: string;
    target: string;
    isExternal: boolean;
    xml: string;
};

function readAttribute(tag: string, name: string) {
    const matched = new RegExp(
        `\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    ).exec(tag);
    return matched === null
        ? null
        : unescapeXml(matched[2] ?? matched[3] ?? '');
}

export function parseRels(xml: string): RelType[] {
    const out: RelType[] = [];
    for (const matched of xml.matchAll(/<Relationship\b[^>]*?\/?>/g)) {
        const tag = matched[0];
        out.push({
            id: readAttribute(tag, 'Id') ?? '',
            type: readAttribute(tag, 'Type') ?? '',
            target: readAttribute(tag, 'Target') ?? '',
            isExternal: readAttribute(tag, 'TargetMode') === 'External',
            xml: tag,
        });
    }
    return out;
}

function checkIsRelType(rel: RelType, name: string) {
    return (
        rel.type === `${REL_TYPE_BASE}${name}` || rel.type.endsWith(`/${name}`)
    );
}

/** `ppt/slides/slide1.xml` → `ppt/slides/_rels/slide1.xml.rels`. */
export function toRelsPath(partPath: string) {
    const index = partPath.lastIndexOf('/');
    return index < 0
        ? `_rels/${partPath}.rels`
        : `${partPath.slice(0, index)}/_rels/${partPath.slice(index + 1)}.rels`;
}

/** A relationship's target, from the part that names it, as a part name. */
export function resolvePartPath(sourcePath: string, target: string) {
    const parts = target.startsWith('/')
        ? []
        : sourcePath.split('/').slice(0, -1);
    for (const piece of target.replace(/^\//, '').split('/')) {
        if (piece === '..') {
            parts.pop();
        } else if (piece !== '.' && piece !== '') {
            parts.push(piece);
        }
    }
    return parts.join('/');
}

/** A part as a relationship from `sourcePath` names it: `../notesSlides/x`. */
function toRelativeTarget(sourcePath: string, partPath: string) {
    const from = sourcePath.split('/').slice(0, -1);
    const to = partPath.split('/');
    let shared = 0;
    while (
        shared < from.length &&
        shared < to.length - 1 &&
        from[shared] === to[shared]
    ) {
        shared++;
    }
    return [
        ...Array(from.length - shared).fill('..'),
        ...to.slice(shared),
    ].join('/');
}

function escapeXmlAttribute(value: string) {
    return escapeXmlText(value).replace(/"/g, '&quot;');
}

function genRelXml(id: string, type: string, target: string) {
    return (
        `<Relationship Id="${escapeXmlAttribute(id)}" ` +
        `Type="${escapeXmlAttribute(type)}" ` +
        `Target="${escapeXmlAttribute(target)}"/>`
    );
}

function genRelsXml(rels: string[]) {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels.join('') +
        '</Relationships>'
    );
}

function addRelToXml(relsXml: string | null, relXml: string) {
    if (relsXml === null) {
        return genRelsXml([relXml]);
    }
    return relsXml.replace(
        /<\/Relationships>\s*$/,
        `${relXml}</Relationships>`,
    );
}

function nextRelId(rels: RelType[]) {
    const max = rels.reduce((value, rel) => {
        const number = /^rId(\d+)$/.exec(rel.id)?.[1];
        return number === undefined ? value : Math.max(value, Number(number));
    }, 0);
    return `rId${max + 1}`;
}

function addContentTypeOverride(
    xml: string,
    partPath: string,
    contentType: string,
) {
    const override =
        `<Override PartName="/${escapeXmlAttribute(partPath)}" ` +
        `ContentType="${contentType}"/>`;
    return xml.replace(/<\/Types>\s*$/, `${override}</Types>`);
}

function removeContentTypeOverride(xml: string, partPath: string) {
    return xml.replace(/<Override\b[^>]*?\/>/g, (tag) => {
        const name = readAttribute(tag, 'PartName');
        return name !== null && name.replace(/^\//, '') === partPath ? '' : tag;
    });
}

// --- reading ---------------------------------------------------------------

async function findMainPath(pkg: OfficePackageType) {
    const rootRels = await pkg.readText('_rels/.rels');
    if (rootRels === null) {
        return null;
    }
    const main = parseRels(rootRels).find((rel) => {
        return checkIsRelType(rel, 'officeDocument');
    });
    return main === undefined ? null : resolvePartPath('', main.target);
}

function toLines(
    paragraphs: OfficeParagraphType[],
    toId: (index: number) => string,
): OfficeLineType[] {
    return paragraphs
        .filter((paragraph) => {
            return !paragraph.isHidden;
        })
        .map((paragraph, index) => {
            return { ...paragraph, id: toId(index + 1) };
        });
}

/** The speaker notes' own lines: the notes placeholder's, never the page's. */
function findNoteParagraphs(xml: string) {
    return listOfficeParagraphs(xml, 'pptx').filter((paragraph) => {
        return !paragraph.isHidden && paragraph.box === 'body';
    });
}

type SldIdEntryType = { xml: string; id: string; relId: string };

function readSldIdList(presentationXml: string) {
    const listMatch = /<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/.exec(
        presentationXml,
    );
    if (listMatch === null) {
        return { entries: [] as SldIdEntryType[], listMatch: null };
    }
    const entries: SldIdEntryType[] = [];
    for (const matched of listMatch[1].matchAll(
        /<p:sldId\b[^>]*?(?:\/>|>[\s\S]*?<\/p:sldId>)/g,
    )) {
        entries.push({
            xml: matched[0],
            id: readAttribute(matched[0], 'id') ?? '',
            relId: readAttribute(matched[0], 'r:id') ?? '',
        });
    }
    return { entries, listMatch };
}

/** The package read as lines, or why it cannot be. */
export async function readOfficeDocument(
    pkg: OfficePackageType,
    kind: OfficeKindType,
): Promise<OfficeDocumentType | { reason: string }> {
    const mainPath = await findMainPath(pkg);
    if (mainPath === null) {
        return { reason: 'The file is not a PowerPoint or Word package.' };
    }
    const mainXml = await pkg.readText(mainPath);
    if (mainXml === null) {
        return { reason: 'The file is damaged: its main part is missing.' };
    }
    if (kind === 'docx') {
        if (!/<w:document\b/.test(mainXml)) {
            return { reason: 'The file is not a Word document.' };
        }
        return {
            kind,
            mainPath,
            lines: toLines(listOfficeParagraphs(mainXml, 'docx'), String),
            pageColor: readWordPageColor(mainXml),
        };
    }
    if (!/<p:presentation\b/.test(mainXml)) {
        return { reason: 'The file is not a PowerPoint presentation.' };
    }
    const mainRels = parseRels(
        (await pkg.readText(toRelsPath(mainPath))) ?? '',
    );
    const notesMaster = mainRels.find((rel) => {
        return checkIsRelType(rel, 'notesMaster');
    });
    const { entries } = readSldIdList(mainXml);
    const slideSize = readSlideSize(mainXml);
    const slides: OfficeSlideType[] = [];
    // layouts and masters, read once a call: a box takes its place from them
    const readShared = genSharedPartReader(pkg.readText);
    for (const entry of entries) {
        const rel = mainRels.find((one) => {
            return one.id === entry.relId;
        });
        if (rel === undefined) {
            continue;
        }
        const partPath = resolvePartPath(mainPath, rel.target);
        const slideXml = await pkg.readText(partPath);
        if (slideXml === null) {
            continue;
        }
        const number = slides.length + 1;
        const relsPath = toRelsPath(partPath);
        const slideRels = parseRels((await pkg.readText(relsPath)) ?? '');
        const notesRel = slideRels.find((one) => {
            return checkIsRelType(one, 'notesSlide');
        });
        const notesPath =
            notesRel === undefined
                ? null
                : resolvePartPath(partPath, notesRel.target);
        const notesXml =
            notesPath === null ? null : await pkg.readText(notesPath);
        const layoutRel = slideRels.find((one) => {
            return checkIsRelType(one, 'slideLayout');
        });
        const layoutPath =
            layoutRel === undefined
                ? null
                : resolvePartPath(partPath, layoutRel.target);
        const { layoutXml, masterXml } = await readShared.layoutOf(layoutPath);
        const lines = toLines(
            listOfficeParagraphs(slideXml, 'pptx'),
            (index) => {
                return `${number}.${index}`;
            },
        );
        const boxes = toOfficeBoxes(
            slideXml,
            slideSize,
            lines,
            layoutXml,
            masterXml,
        );
        // a chart's words and numbers, read off its own part
        for (const box of boxes) {
            const chartRel = slideRels.find((one) => {
                return one.id === box.chartRelId;
            });
            if (chartRel === undefined) {
                continue;
            }
            const chartPath = resolvePartPath(partPath, chartRel.target);
            const chartXml = await pkg.readText(chartPath);
            const data = chartXml === null ? null : readChartData(chartXml);
            if (data !== null) {
                box.chart = { ...data, path: chartPath };
            }
        }
        // a SmartArt's words, and the drawing kept beside them
        for (const box of boxes) {
            const dataRel = slideRels.find((one) => {
                return one.id === box.smartArtRelId;
            });
            if (dataRel === undefined) {
                continue;
            }
            const dataPath = resolvePartPath(partPath, dataRel.target);
            const dataXml = await pkg.readText(dataPath);
            if (dataXml === null) {
                continue;
            }
            const drawingRelId =
                /<dsp:dataModelExt\b[^>]*?\srelId="([^"]+)"/.exec(dataXml)?.[1];
            const drawingRel = slideRels.find((one) => {
                return one.id === drawingRelId;
            });
            const under: Record<string, string> = {};
            const boxWords = listSmartArtBoxWords(dataXml);
            for (const one of boxWords) {
                if (one.under !== null && one.words !== '') {
                    under[one.words] = one.under;
                }
            }
            // in the boxes' own order, which a move changes and the file's
            // order of points does not (EC-787: a box moved first was read
            // back last, and the model told it had not moved)
            const words = (
                boxWords.length > 0
                    ? boxWords.flatMap((one) => {
                          return one.words.split('\n');
                      })
                    : listOfficeParagraphs(dataXml, 'pptx').map((paragraph) => {
                          return paragraph.text;
                      })
            )
                .map((text) => {
                    return text.trim();
                })
                .filter((text) => {
                    return text !== '';
                });
            box.smartArt = {
                layout: readSmartArtLayoutId(dataXml),
                under: Object.keys(under).length === 0 ? null : under,
                words,
                dataPath,
                drawingPath:
                    drawingRel === undefined
                        ? null
                        : resolvePartPath(partPath, drawingRel.target),
            };
        }
        slides.push({
            number,
            partPath,
            relsPath,
            notesPath: notesXml === null ? null : notesPath,
            relId: entry.relId,
            sldId: entry.id,
            isHidden: /<p:sld\b[^>]*\sshow="(?:0|false)"/.test(slideXml),
            lines,
            note:
                notesXml === null
                    ? null
                    : findNoteParagraphs(notesXml)
                          .map((paragraph) => {
                              return paragraph.text;
                          })
                          .join('\n'),
            boxes,
            layoutPath,
            transition: readSlideTransition(slideXml),
        });
    }
    const layouts: OfficeLayoutType[] = [];
    for (const name of pkg.names) {
        if (!/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)) {
            continue;
        }
        const layoutXml = await readShared.read(name);
        if (layoutXml === null) {
            continue;
        }
        layouts.push(readOfficeLayout(name, layoutXml));
    }
    // in the deck's own order: slideLayout1, slideLayout2, ... slideLayout10
    layouts.sort((one, other) => {
        return (
            Number(/(\d+)\.xml$/.exec(one.path)?.[1]) -
            Number(/(\d+)\.xml$/.exec(other.path)?.[1])
        );
    });
    const shared = await readSharedSlides(
        mainPath,
        mainRels,
        slides,
        layouts,
        slideSize,
        readShared.read,
    );
    return {
        kind,
        mainPath,
        slides,
        slideSize,
        layouts,
        shared,
        notesMasterPath:
            notesMaster === undefined
                ? null
                : resolvePartPath(mainPath, notesMaster.target),
    };
}

/**
 * The slide masters and the layouts the slides use, each read as a slide
 * of its own SHAPES -- never its placeholders, which only say how the
 * slides' own boxes look -- so a logo, a line or words on every slide
 * change as a slide's box does.
 */
async function readSharedSlides(
    mainPath: string,
    mainRels: RelType[],
    slides: readonly OfficeSlideType[],
    layouts: readonly OfficeLayoutType[],
    slideSize: SlideSizeType,
    read: (partPath: string) => Promise<string | null>,
) {
    const toPathNumber = (path: string) => {
        return Number(/(\d+)\.xml$/.exec(path)?.[1] ?? 0);
    };
    const masterPaths = mainRels
        .filter((rel) => {
            return checkIsRelType(rel, 'slideMaster');
        })
        .map((rel) => {
            return resolvePartPath(mainPath, rel.target);
        })
        .sort((one, other) => {
            return toPathNumber(one) - toPathNumber(other);
        });
    const layoutPaths: string[] = [];
    for (const slide of slides) {
        if (
            slide.layoutPath !== null &&
            !layoutPaths.includes(slide.layoutPath)
        ) {
            layoutPaths.push(slide.layoutPath);
        }
    }
    const wanted = [
        ...masterPaths.map((partPath, index) => {
            return {
                partPath,
                number: SHARED_SLIDE_BASE + 1 + index,
                value: index === 0 ? 'master' : `master ${index + 1}`,
                label:
                    index === 0
                        ? 'the slide master'
                        : `slide master ${index + 1}`,
                slideNumbers: undefined,
            };
        }),
        ...layoutPaths.map((partPath, index) => {
            const name =
                layouts.find((layout) => {
                    return layout.path === partPath;
                })?.name ?? partPath.slice(partPath.lastIndexOf('/') + 1, -4);
            return {
                partPath,
                number: SHARED_LAYOUT_BASE + 1 + index,
                value: `layout: ${name}`,
                label: `the "${name}" layout`,
                slideNumbers: slides
                    .filter((slide) => {
                        return slide.layoutPath === partPath;
                    })
                    .map((slide) => {
                        return slide.number;
                    }),
            };
        }),
    ];
    const out: OfficeSlideType[] = [];
    for (const one of wanted) {
        const xml = await read(one.partPath);
        if (xml === null) {
            continue;
        }
        const lines = toLines(listOfficeParagraphs(xml, 'pptx'), (index) => {
            return `${one.number}.${index}`;
        });
        const boxes = toOfficeBoxes(xml, slideSize, lines, null, null).filter(
            (box) => {
                return box.placeholder === null;
            },
        );
        out.push({
            number: one.number,
            partPath: one.partPath,
            relsPath: toRelsPath(one.partPath),
            notesPath: null,
            relId: '',
            sldId: '',
            isHidden: false,
            lines,
            note: null,
            boxes,
            layoutPath: null,
            transition: null,
            sharedValue: one.value,
            sharedLabel: one.label,
            ...(one.slideNumbers === undefined
                ? {}
                : { sharedSlideNumbers: one.slideNumbers }),
        });
    }
    return out;
}

/**
 * A reader of the parts many slides share -- layouts, masters, their
 * relationships -- each read once for as long as the reader lives (one
 * call), and the layout and master a slide's layout path leads to.
 */
function genSharedPartReader(
    readText: (name: string) => Promise<string | null>,
) {
    const partMap = new Map<string, string | null>();
    const read = async (partPath: string) => {
        if (!partMap.has(partPath)) {
            partMap.set(partPath, await readText(partPath));
        }
        return partMap.get(partPath) ?? null;
    };
    const layoutOf = async (layoutPath: string | null) => {
        if (layoutPath === null) {
            return { layoutXml: null, masterXml: null };
        }
        const layoutXml = await read(layoutPath);
        const master = parseRels(
            (await read(toRelsPath(layoutPath))) ?? '',
        ).find((rel) => {
            return checkIsRelType(rel, 'slideMaster');
        });
        const masterXml =
            master === undefined
                ? null
                : await read(resolvePartPath(layoutPath, master.target));
        return { layoutXml, masterXml };
    };
    return { read, layoutOf };
}

/** A slide's own boxes, each with where it is and the lines in it. */
function toOfficeBoxes(
    slideXml: string,
    size: SlideSizeType,
    lines: OfficeLineType[],
    layoutXml: string | null,
    masterXml: string | null,
): OfficeBoxType[] {
    const tableMap = new Map(
        listSlideTables(slideXml).map((table) => {
            return [table.name, table];
        }),
    );
    const animationMap = new Map(
        readSlideAnimations(slideXml).map((animation) => {
            return [animation.shapeId, animation];
        }),
    );
    return listSlideBoxes(slideXml, size)
        .filter((box) => {
            return !box.isGrouped;
        })
        .map((box) => {
            const boxXml = slideXml.slice(box.start, box.end);
            const place = findBoxPlace(boxXml, layoutXml, masterXml);
            const shapeId =
                /<p:cNvPr\b[^>]*?\sid="(\d+)"/.exec(boxXml)?.[1] ?? null;
            const table =
                box.kind === 'table' ? tableMap.get(box.name) : undefined;
            const animation =
                shapeId === null ? undefined : animationMap.get(shapeId);
            const chartRelId =
                box.kind === 'chart'
                    ? /<c:chart\b[^>]*?\sr:id="([^"]+)"/.exec(boxXml)?.[1]
                    : undefined;
            const smartArtRelId =
                box.kind === 'smartart'
                    ? /<dgm:relIds\b[^>]*?\sr:dm="([^"]+)"/.exec(boxXml)?.[1]
                    : undefined;
            return {
                name: box.name,
                kind: box.kind,
                shapeId,
                ...(table === undefined
                    ? {}
                    : { table: { rows: table.rows, columns: table.columns } }),
                ...(animation === undefined
                    ? {}
                    : {
                          animation: {
                              effect: animation.effect,
                              byLine: animation.byLine,
                          },
                      }),
                ...(chartRelId === undefined ? {} : { chartRelId }),
                ...(smartArtRelId === undefined ? {} : { smartArtRelId }),
                placeholder:
                    box.kind === 'group'
                        ? null
                        : (readBoxPlaceholder(boxXml)?.type ?? null),
                at: place === null ? null : toPercentPlace(place, size),
                isFilling: box.isFilling,
                lineIds: lines
                    .filter((line) => {
                        return box.start <= line.start && line.start < box.end;
                    })
                    .map((line) => {
                        return line.id;
                    }),
            };
        });
}

/** "2.2-2.7": a box's line ids, a run as its ends. */
function toLineRangeText(ids: string[]) {
    if (ids.length <= 1) {
        return ids.join('');
    }
    const numbers = ids.map((id) => {
        return Number(id.split('.')[1]);
    });
    const isRun = numbers.every((number, index) => {
        return index === 0 || number === numbers[index - 1] + 1;
    });
    return isRun ? `${ids[0]}-${ids[ids.length - 1]}` : ids.join(', ');
}

function toShownBox(box: OfficeBoxType) {
    return {
        name: box.name,
        ...(box.kind === 'text' ? {} : { kind: box.kind }),
        ...(box.at === null ? {} : { at: box.at }),
        ...(box.isFilling ? { fills: true } : {}),
        ...(box.lineIds.length === 0
            ? {}
            : { lines: toLineRangeText(box.lineIds) }),
        ...(box.table === undefined ? {} : box.table),
        ...(box.smartArt === undefined
            ? {}
            : {
                  words: box.smartArt.words,
                  ...(box.smartArt.layout === null
                      ? {}
                      : { layout: box.smartArt.layout }),
                  ...(box.smartArt.under === null
                      ? {}
                      : { under: box.smartArt.under }),
              }),
        ...(box.chart === undefined
            ? {}
            : {
                  chart: {
                      kind: box.chart.kind,
                      title: box.chart.title,
                      categories: box.chart.categories,
                      series: box.chart.series,
                  },
              }),
        ...(box.animation === undefined
            ? {}
            : {
                  animation:
                      box.animation.effect +
                      (box.animation.byLine ? ', line by line' : ''),
              }),
    };
}

/**
 * A master or a layout as the model reads it: the `slide` that names it,
 * the slides it is on, its own boxes and the words in them.
 */
function toShownSharedSlide(shared: OfficeSlideType) {
    const ownIds = new Set(
        shared.boxes.flatMap((box) => {
            return box.lineIds;
        }),
    );
    let lastBox: string | null = null;
    const lines = shared.lines
        .filter((line) => {
            return ownIds.has(line.id) && line.text.trim() !== '';
        })
        .map((line) => {
            const out: Record<string, string> = { id: line.id };
            if (line.box !== null && line.box !== lastBox) {
                out.box = line.box;
            }
            lastBox = line.box;
            out.text = line.text;
            return out;
        });
    return {
        slide: shared.sharedValue,
        ...(shared.sharedSlideNumbers === undefined
            ? { on: 'every slide' }
            : { on: `slides ${toSlideRangeText(shared.sharedSlideNumbers)}` }),
        ...(shared.boxes.length === 0
            ? {}
            : { boxes: shared.boxes.map(toShownBox) }),
        ...(lines.length === 0 ? {} : { lines }),
    };
}

// --- what the model reads --------------------------------------------------

const DEFAULT_READ_CHARS = 24000;

/**
 * The document as the model reads it: every line by id and words, the box a
 * slide line is in (said once a box), a Word line's style, the speaker
 * notes. Cut at `maxChars`, from `start` (a slide, or a Word line number):
 * `nextStart` says where to read on.
 */
export function toOfficeReadResult(
    document: OfficeDocumentType,
    start = 1,
    maxChars = DEFAULT_READ_CHARS,
) {
    let used = 0;
    if (document.kind === 'pptx') {
        const slides: Record<string, unknown>[] = [];
        let nextStart: number | null = null;
        for (const slide of document.slides) {
            if (slide.number < start) {
                continue;
            }
            let lastBox: string | null = null;
            const lines = slide.lines.map((line) => {
                const out: Record<string, string> = { id: line.id };
                if (line.box !== null && line.box !== lastBox) {
                    out.box = line.box;
                }
                lastBox = line.box;
                out.text = line.text;
                return out;
            });
            const shown: Record<string, unknown> = {
                slide: slide.number,
                ...(slide.isHidden ? { hidden: true } : {}),
                lines,
                ...(slide.note === null || slide.note === ''
                    ? {}
                    : { note: slide.note }),
                ...(slide.boxes.length === 0
                    ? {}
                    : { boxes: slide.boxes.map(toShownBox) }),
                ...(slide.transition === null
                    ? {}
                    : { transition: slide.transition }),
            };
            const size = JSON.stringify(shown).length;
            if (slides.length > 0 && used + size > maxChars) {
                nextStart = slide.number;
                break;
            }
            used += size;
            slides.push(shown);
        }
        // the master's and the layouts' own shapes, with the first part
        const masters =
            start > 1
                ? []
                : (document.shared ?? [])
                      .filter((shared) => {
                          return (
                              shared.boxes.length > 0 ||
                              shared.sharedValue === 'master'
                          );
                      })
                      .map((shared) => {
                          return toShownSharedSlide(shared);
                      });
        return {
            kind: 'PowerPoint' as const,
            slideCount: document.slides.length,
            ...(document.layouts.length === 0
                ? {}
                : {
                      layouts: document.layouts.map((layout) => {
                          return layout.name;
                      }),
                  }),
            slides,
            ...(masters.length === 0 ? {} : { masters }),
            ...(nextStart === null ? {} : { nextStart }),
        };
    }
    const lines: Record<string, unknown>[] = [];
    let nextStart: number | null = null;
    for (const line of document.lines) {
        if (Number(line.id) < start) {
            continue;
        }
        const shown: Record<string, unknown> = {
            id: line.id,
            ...(line.box === null ? {} : { style: line.box }),
            ...(line.isTable ? { table: true } : {}),
            // a line holding a picture: removable by its id like any other
            ...(/<w:(?:drawing|pict)\b/.test(line.xml)
                ? { picture: true }
                : {}),
            text: line.text,
        };
        const size = JSON.stringify(shown).length;
        if (lines.length > 0 && used + size > maxChars) {
            nextStart = Number(line.id);
            break;
        }
        used += size;
        lines.push(shown);
    }
    return {
        kind: 'Word' as const,
        lineCount: document.lines.length,
        ...(typeof document.pageColor === 'string'
            ? { pageColor: toOfficeColorWords(document.pageColor) }
            : {}),
        lines,
        ...(nextStart === null ? {} : { nextStart }),
    };
}

// --- changing --------------------------------------------------------------

type NewLineType = {
    text: string;
    look: OfficeLookType | null;
    // a line written whole (a Word picture's), never rebuilt from its
    // neighbour
    xml?: string;
};

type ParagraphPlanType = {
    setText?: string;
    isRemoved?: boolean;
    look?: OfficeLookType;
    // a look for some words of the line only, each from its change
    wordLooks: {
        words: string;
        look: OfficeLookType;
        change: OfficeChangeType;
    }[];
    before: NewLineType[];
    after: NewLineType[];
};

function quote(text: string, max = 60) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return `“${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}”`;
}

function checkIsText(value: unknown): value is string {
    return typeof value === 'string';
}

function splicePart(
    xml: string,
    edits: { start: number; end: number; replacement: string }[],
) {
    let out = xml;
    for (const edit of [...edits].sort((a, b) => {
        return b.start - a.start;
    })) {
        out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    }
    return out;
}

function checkIsLineChange(change: OfficeChangeType) {
    return (
        change.id !== undefined ||
        change.after !== undefined ||
        change.before !== undefined
    );
}

/** Every part a word replace reaches, in reading order. */
// the parts `replace` reaches; a copy (a SmartArt's drawing) changes too,
// uncounted
function listTextParts(
    document: OfficeDocumentType,
): { path: string; isCopy: boolean }[] {
    if (document.kind === 'docx') {
        return [{ path: document.mainPath, isCopy: false }];
    }
    const slideParts = document.slides.flatMap((slide) => {
        const smartArtParts = slide.boxes.flatMap((box) => {
            if (box.smartArt === undefined) {
                return [];
            }
            return [
                { path: box.smartArt.dataPath, isCopy: false },
                ...(box.smartArt.drawingPath === null
                    ? []
                    : [{ path: box.smartArt.drawingPath, isCopy: true }]),
            ];
        });
        return [
            { path: slide.partPath, isCopy: false },
            ...(slide.notesPath === null
                ? []
                : [{ path: slide.notesPath, isCopy: false }]),
            ...smartArtParts,
        ];
    });
    // words written on the master or a layout are on the slides too
    return [
        ...slideParts,
        ...(document.shared ?? []).map((shared) => {
            return { path: shared.partPath, isCopy: false };
        }),
    ];
}

/**
 * The asks applied to the package: words replaced everywhere first (lines
 * keep their ids through it), then each line's own change, then speaker
 * notes, then slides moved, copied or taken out -- line ids and slide
 * numbers always as the document was READ. All or nothing: one ask that
 * cannot be done refuses the whole call, and nothing is written.
 */
/** The boxes of a slide `value` names: a line id in it, a name, a type. */
function matchOfficeBoxes(slide: OfficeSlideType, value: string) {
    const wanted = value.trim();
    const byLine = slide.boxes.filter((box) => {
        return box.lineIds.includes(wanted);
    });
    if (byLine.length > 0) {
        return byLine;
    }
    const byName = slide.boxes.filter((box) => {
        return box.name === wanted;
    });
    if (byName.length > 0) {
        return byName;
    }
    const byCase = slide.boxes.filter((box) => {
        return box.name.toLowerCase() === wanted.toLowerCase();
    });
    if (byCase.length > 0) {
        return byCase;
    }
    return slide.boxes.filter((box) => {
        return box.placeholder === wanted;
    });
}

/** "on slide 2" / "on 6 slides (2-7)". */
function toOnSlidesText(numbers: number[]) {
    return numbers.length === 1
        ? `on slide ${numbers[0]}`
        : `on ${numbers.length} slides (${toSlideRangeText(numbers)})`;
}

type PlacedType = { number: number; at: number[]; wasAt: number[] | null };

const CONTENT_TYPES_PATH = '[Content_Types].xml';

// A picture's name as the person knows it: the file's, never its folder.
function toPictureName(picture: string) {
    return picture.split(/[\\/]/).pop() ?? picture;
}

// `ppt/media/image<N>.<extension>` (`word/media/` in a Word file), N one
// past every picture's the file has.
function genFreeMediaPath(
    names: readonly string[],
    extension: string,
    folder = 'ppt/media',
    stem = 'image',
) {
    const pattern = new RegExp(`^${folder}/${stem}(\\d+)\\.`, 'i');
    const highest = names.reduce((value, name) => {
        const number = pattern.exec(name)?.[1];
        return number === undefined ? value : Math.max(value, Number(number));
    }, 0);
    return `${folder}/${stem}${highest + 1}.${extension}`;
}

// The package says what a picture of this extension is, once.
function addContentTypeDefault(
    xml: string,
    extension: string,
    contentType: string,
) {
    if (new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'i').test(xml)) {
        return xml;
    }
    return xml.replace(/<Types\b[^>]*>/, (tag) => {
        return (
            `${tag}<Default Extension="${extension}" ` +
            `ContentType="${contentType}"/>`
        );
    });
}

// How far a place reaches past the slide's edges, in % (0: inside).
function measureOffSlide([x, y, width, height]: number[]) {
    return Math.max(0, -x, -y, x + width - 100, y + height - 100);
}

/**
 * Where a box was put, said once when every slide has it in one place,
 * and when the move took it further off the slide than it was.
 */
function genPlacedWords(name: string, placed: PlacedType[]) {
    const numbers = [
        ...new Set(
            placed.map((one) => {
                return one.number;
            }),
        ),
    ];
    const isOff = placed.some(({ at, wasAt }) => {
        const off = measureOffSlide(at);
        return off > 0.5 && off > (wasAt === null ? 0 : measureOffSlide(wasAt));
    });
    const isSame = placed.every((one) => {
        return one.at.join() === placed[0].at.join();
    });
    const where = isSame
        ? `at [${placed[0].at.join(', ')}]`
        : placed
              .map((one) => {
                  return `slide ${one.number} at [${one.at.join(', ')}]`;
              })
              .join('; ');
    return (
        `Moved "${name}" ${toOnSlidesText(numbers)}: ${where} ` +
        '(x, y, width, height in % of the slide).' +
        (isOff
            ? ' Part of it is off the slide now: say so, and offer to ' +
              'fit it on the slide.'
            : '')
    );
}

/**
 * The size, in points, a Word paragraph's runs with none of their own are
 * drawn at: its style's, the styles it is based on, the document's
 * defaults. Null when none says.
 */
export function findWordStyleSize(stylesXml: string, styleId: string | null) {
    const styles = [
        ...stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g),
    ].map((match) => {
        return {
            id: /\sw:styleId="([^"]*)"/.exec(match[1])?.[1] ?? '',
            isParagraphDefault:
                /\sw:type="paragraph"/.test(match[1]) &&
                /\sw:default="(?:1|true)"/.test(match[1]),
            body: match[2],
        };
    });
    let id =
        styleId ??
        styles.find((style) => {
            return style.isParagraphDefault;
        })?.id ??
        null;
    for (let depth = 0; id !== null && depth < 12; depth++) {
        const style = styles.find((one) => {
            return one.id === id;
        });
        if (style === undefined) {
            break;
        }
        const size = /<w:rPr>[\s\S]*?<w:sz\s+w:val="(\d+)"/.exec(
            style.body,
        )?.[1];
        if (size !== undefined) {
            return Number(size) / 2;
        }
        id = /<w:basedOn\s+w:val="([^"]*)"/.exec(style.body)?.[1] ?? null;
    }
    const fallback = /<w:rPrDefault>[\s\S]*?<w:sz\s+w:val="(\d+)"/.exec(
        stylesXml,
    )?.[1];
    return fallback === undefined ? null : Number(fallback) / 2;
}

/** "1, 3, 5-9": slide numbers in order, a run as its ends. */
function toSlideRangeText(numbers: number[]) {
    const runs: string[] = [];
    let start = numbers[0];
    for (let i = 1; i <= numbers.length; i++) {
        if (numbers[i] !== numbers[i - 1] + 1) {
            const end = numbers[i - 1];
            runs.push(start === end ? `${start}` : `${start}-${end}`);
            start = numbers[i];
        }
    }
    return runs.join(', ');
}

/**
 * Said when a background colour went behind a picture that fills the slide
 * (the user's hymn deck: a curtain on every slide): it does not show, and
 * how to let it -- a slide's own picture by `removeBox`, a layout's or a
 * master's by `removeBox` on that master or layout (`slide: "master"`).
 */
function genCoveredBackgroundWords(coveredMap: Map<string, number[]>) {
    const found: string[] = [];
    const onSlide: string[] = [];
    const onShared: string[] = [];
    for (const [key, numbers] of coveredMap) {
        const [name, where, holder] = JSON.parse(key) as [
            string,
            string,
            string | null,
        ];
        const slidesText =
            (numbers.length === 1 ? 'slide ' : 'slides ') +
            toSlideRangeText(numbers);
        found.push(`"${name}"${where} on ${slidesText}`);
        if (where === '') {
            onSlide.push(name);
        } else if (typeof holder === 'string') {
            const ask = JSON.stringify({ slide: holder, removeBox: name });
            if (!onShared.includes(ask)) {
                onShared.push(ask);
            }
        }
    }
    const ways = [
        ...(onSlide.length === 0
            ? []
            : [
                  `{removeBox: ${onSlide
                      .map((name) => {
                          return JSON.stringify(name);
                      })
                      .join(' | ')}} with no slide takes that picture off ` +
                      'every slide that has it',
              ]),
        // on a master or a layout: off every slide showing it (2026-11-21)
        ...onShared.map((ask) => {
            return `${ask} takes it off every slide that shows it`;
        }),
    ];
    return (
        'It does NOT show: a picture fills the slide in front of it -- ' +
        `${found.join('; ')}. Say so` +
        (ways.length === 0
            ? '; a picture on a layout or a master is changed in PowerPoint.'
            : `; ${ways.join('; ')}, and the colour shows there.`)
    );
}

/**
 * A chart's embedded workbook given the cells its new numbers and words
 * are in, so PowerPoint's Edit Data opens on them; a sentence when it
 * could not be (the chart still draws the new ones, from its cache).
 */
async function writeChartWorkbook(
    pkg: OfficePackageType,
    chartPath: string,
    chartXml: string,
    cells: { sheet: string; ref: string; value: string | number | null }[],
    readPart: (name: string) => Promise<string | null>,
    parts: Map<string, string | Uint8Array | null>,
) {
    if (cells.length === 0) {
        return '';
    }
    const notWritten =
        ' Its data sheet (Edit Data in PowerPoint) still has the old ones.';
    const relId = /<c:externalData\b[^>]*?\sr:id="([^"]+)"/.exec(chartXml)?.[1];
    const rel = parseRels((await readPart(toRelsPath(chartPath))) ?? '').find(
        (one) => {
            return one.id === relId;
        },
    );
    if (rel === undefined || /TargetMode="External"/.test(rel.xml)) {
        return notWritten;
    }
    const workbookPath = resolvePartPath(chartPath, rel.target);
    const known = parts.get(workbookPath);
    const bytes =
        known instanceof Uint8Array
            ? known
            : ((await pkg.readBytes?.(workbookPath)) ?? null);
    if (bytes === null) {
        return notWritten;
    }
    const opened = openOfficePackage(bytes);
    if ('reason' in opened) {
        return notWritten;
    }
    const workbookXml = await opened.pkg.readText('xl/workbook.xml');
    const workbookRelsXml = await opened.pkg.readText(
        'xl/_rels/workbook.xml.rels',
    );
    if (workbookXml === null || workbookRelsXml === null) {
        return notWritten;
    }
    const sheetParts = new Map<string, string | null>();
    for (const sheet of new Set(
        cells.map((cell) => {
            return cell.sheet;
        }),
    )) {
        const sheetPath = findSheetPath(workbookXml, workbookRelsXml, sheet);
        const sheetXml =
            sheetPath === null ? null : await opened.pkg.readText(sheetPath);
        if (sheetPath === null || sheetXml === null) {
            return notWritten;
        }
        const sheetCells = cells.filter((cell) => {
            return cell.sheet === sheet;
        });
        sheetParts.set(sheetPath, setSheetCellsXml(sheetXml, sheetCells));
        // an Excel table over those cells: its header names and its size
        // kept true to them, or Excel repairs the workbook
        const sheetRelsXml = await opened.pkg.readText(toRelsPath(sheetPath));
        for (const tablePath of sheetRelsXml === null
            ? []
            : listSheetTablePaths(sheetRelsXml, sheetPath)) {
            const tableXml = await opened.pkg.readText(tablePath);
            if (tableXml !== null) {
                sheetParts.set(
                    tablePath,
                    setSheetTableXml(tableXml, sheetCells),
                );
            }
        }
    }
    // Excel's list of formulas to work out: one written over is a file
    // Excel repairs, and it builds the list again when it is not there
    if (opened.pkg.names.includes('xl/calcChain.xml')) {
        const typesXml = await opened.pkg.readText('[Content_Types].xml');
        sheetParts.set('xl/calcChain.xml', null);
        sheetParts.set(
            'xl/_rels/workbook.xml.rels',
            workbookRelsXml.replace(
                /<Relationship\b[^>]*?Target="[^"]*calcChain\.xml"[^>]*\/>/g,
                '',
            ),
        );
        if (typesXml !== null) {
            sheetParts.set(
                '[Content_Types].xml',
                typesXml.replace(
                    /<Override\b[^>]*?PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
                    '',
                ),
            );
        }
    }
    const written = await rewriteZipParts(bytes, sheetParts);
    if (!(written instanceof Uint8Array)) {
        return notWritten;
    }
    parts.set(workbookPath, written);
    return '';
}

const TABLE_OPERATION_LIST = [
    'addRow',
    'removeRow',
    'addColumn',
    'removeColumn',
] as const;

function checkIsTextList(value: unknown, max: number) {
    return (
        Array.isArray(value) &&
        value.length <= max &&
        value.every((one) => {
            return typeof one === 'string' && one.length <= 2000;
        })
    );
}

/**
 * What is wrong with an animation, a table's rows or columns, a new slide
 * or a chart asked for (EC-771); null when nothing is.
 */
function checkShapeChange(change: OfficeChangeType): string | null {
    if (change.animation !== undefined) {
        if (toOfficeAnimation(change.animation) === null) {
            return (
                '`animation` is one of ' +
                `${OFFICE_ANIMATION_LIST.join(', ')}, or "none" to take ` +
                "a box's off."
            );
        }
        if (
            change.when !== undefined &&
            !['click', 'with', 'after'].includes(change.when)
        ) {
            return '`when` is "click", "with" (the one before) or "after" it.';
        }
        if (
            change.seconds !== undefined &&
            (typeof change.seconds !== 'number' ||
                !(change.seconds >= 0.1 && change.seconds <= 60))
        ) {
            return '`seconds` is how long the animation takes, 0.1 to 60.';
        }
    }
    const operations = TABLE_OPERATION_LIST.filter((key) => {
        return change[key] !== undefined;
    });
    const isTableLook = change.tableLook !== undefined;
    if (change.table !== undefined || operations.length > 0 || isTableLook) {
        if (!checkIsText(change.table) || change.table.trim() === '') {
            return (
                "`table` is a table's name as read (`boxes`), with " +
                '`addRow`, `removeRow`, `addColumn`, `removeColumn` or ' +
                '`tableLook`.'
            );
        }
        if (operations.length + (isTableLook ? 1 : 0) !== 1) {
            return (
                'A table change does ONE of `addRow`, `removeRow`, ' +
                '`addColumn`, `removeColumn`, `tableLook`: send each as ' +
                'its own change.'
            );
        }
        const number = isTableLook ? 1 : change[operations[0]];
        if (
            typeof number !== 'number' ||
            !Number.isInteger(number) ||
            number < 1
        ) {
            return `\`${operations[0]}\` is a row or column number, from 1.`;
        }
        if (change.slide === undefined) {
            return 'A table is on one slide: give its `slide`.';
        }
        if (isTableLook && change.cells !== undefined) {
            return '`cells` go with `addRow` or `addColumn`, not `tableLook`.';
        }
        if (change.cells !== undefined && !checkIsTextList(change.cells, 50)) {
            return "`cells` are the new row's or column's words, in order.";
        }
    } else if (change.cells !== undefined) {
        return '`cells` go with `table` and `addRow` or `addColumn`.';
    }
    if (change.newSlide !== undefined) {
        if (change.newSlide !== true) {
            return '`newSlide` is true, to add a slide.';
        }
        if (change.slide !== undefined || change.duplicate === true) {
            return (
                'A new slide is placed by `to` (none: the end); to copy ' +
                'a slide that is there, use {slide, duplicate}.'
            );
        }
        if (change.layout !== undefined && !checkIsText(change.layout)) {
            return "`layout` is one of the deck's layouts by name (`layouts`).";
        }
        if (change.title !== undefined && !checkIsText(change.title)) {
            return "`title` is the new slide's title words.";
        }
        if (change.lines !== undefined && !checkIsTextList(change.lines, 50)) {
            return "`lines` are the new slide's lines of words, in order.";
        }
    } else if (change.layout !== undefined || change.lines !== undefined) {
        return '`layout` and `lines` go with `newSlide: true`.';
    }
    if (change.chart !== undefined) {
        if (!checkIsText(change.chart) || change.chart.trim() === '') {
            return "`chart` is a chart's name as read (`boxes`).";
        }
        if (change.slide === undefined) {
            return 'A chart is on one slide: give its `slide`.';
        }
        if (
            change.chartKind === undefined &&
            change.chartTitle === undefined &&
            change.categories === undefined &&
            change.series === undefined
        ) {
            return (
                'Say what to change in the chart: `chartKind`, ' +
                '`chartTitle`, `categories` or `series` [{index, name, ' +
                'values}].'
            );
        }
        if (
            change.chartKind !== undefined &&
            toOfficeChartKind(change.chartKind) === null
        ) {
            return (
                `No chart kind "${String(change.chartKind)}": ` +
                `${OFFICE_CHART_KIND_LIST.join(', ')}.`
            );
        }
    } else if (change.chartKind !== undefined) {
        return "`chartKind` goes with `chart`, the chart's name as read.";
    }
    return null;
}

export async function applyOfficeChanges(
    pkg: OfficePackageType,
    document: OfficeDocumentType,
    askedChanges: readonly OfficeAskedChangeType[],
    replaces: readonly OfficeReplaceType[] = [],
    // the bytes of each `picture` a change names, read by the caller
    pictures: ReadonlyMap<string, Uint8Array> = new Map(),
): Promise<OfficeEditResultType> {
    const result = await applyOfficeChangesAsRead(
        pkg,
        document,
        askedChanges,
        replaces,
        pictures,
    );
    if ('reason' in result) {
        return { reason: toSharedSlideWords(document, result.reason) };
    }
    return {
        ...result,
        changed: result.changed.map((line) => {
            return toSharedSlideWords(document, line);
        }),
    };
}

async function applyOfficeChangesAsRead(
    pkg: OfficePackageType,
    document: OfficeDocumentType,
    askedChanges: readonly OfficeAskedChangeType[],
    replaces: readonly OfficeReplaceType[],
    pictures: ReadonlyMap<string, Uint8Array>,
): Promise<OfficeEditResultType> {
    const named = resolveSlideNames(document, askedChanges);
    if ('reason' in named) {
        return named;
    }
    // a line's id with `at` and nothing else for the line: the box it is in
    const changes = named.changes.map((change) => {
        if (
            change.at === undefined ||
            change.id === undefined ||
            change.box !== undefined ||
            change.textBox !== undefined ||
            change.picture !== undefined ||
            change.media !== undefined ||
            change.text !== undefined ||
            change.remove !== undefined
        ) {
            return change;
        }
        const { id, ...rest } = change;
        return { ...rest, box: String(id) };
    });
    const parts = new Map<string, string | Uint8Array | null>();
    const changed: string[] = [];
    const readPart = async (name: string) => {
        if (parts.has(name)) {
            const value = parts.get(name);
            return typeof value === 'string' ? value : null;
        }
        return await pkg.readText(name);
    };
    const dialect: OfficeDialectType = document.kind;
    // what each change asks the words and the slide to look like, read once
    const lookMap = new Map<OfficeChangeType, OfficeLookType>();
    const boxLookMap = new Map<OfficeChangeType, OfficeBoxLookType>();
    // the boxes a change made, by slide: a look given with a new text box
    // or picture is that box's
    const newBoxMap = new Map<
        OfficeChangeType,
        { number: number; name: string }[]
    >();
    const backgroundMap = new Map<OfficeChangeType, string | null>();
    // the look a SmartArt's boxes are given as it is turned into shapes
    const toShapesLookMap = new Map<OfficeChangeType, OfficeBoxLookType>();
    // a box given another shape: `box` with `shape`
    const reshapeMap = new Map<OfficeChangeType, OfficeShapeType>();
    const themeMap = new Map<OfficeChangeType, OfficeThemeAskType>();
    const lineMap = new Map<string, { partPath: string; index: number }>();
    if (document.kind === 'pptx') {
        for (const slide of [...document.slides, ...(document.shared ?? [])]) {
            slide.lines.forEach((line, index) => {
                lineMap.set(line.id, { partPath: slide.partPath, index });
            });
        }
    } else {
        document.lines.forEach((line, index) => {
            lineMap.set(line.id, { partPath: document.mainPath, index });
        });
    }
    for (const change of changes) {
        if (change.arrange !== undefined && change.toShapes === undefined) {
            return {
                reason:
                    "`arrange` lays a SmartArt's boxes out as it is turned " +
                    'into shapes, after which it is no longer a SmartArt: ' +
                    '{slide, box, toShapes: true, arrange}. Say so and ask; ' +
                    'on their yes send that.',
            };
        }
        if (
            change.everywhere !== undefined &&
            (change.words === undefined ||
                change.slide !== undefined ||
                change.box !== undefined)
        ) {
            return {
                reason:
                    '`everywhere` goes with `words` alone, no `slide` or ' +
                    '`box`: every place the words are written, a slide ' +
                    "master's box too.",
            };
        }
        if (change.smartArtLayout !== undefined) {
            const boxName = String(change.box ?? '')
                .trim()
                .toLowerCase();
            if (
                change.toShapes !== undefined ||
                changes.some((other) => {
                    return (
                        other.toShapes !== undefined &&
                        String(other.box ?? '')
                            .trim()
                            .toLowerCase() === boxName
                    );
                })
            ) {
                return {
                    reason:
                        '`smartArtLayout` keeps it a SmartArt and `toShapes` ' +
                        'turns it into shapes: send the one they asked for.',
                };
            }
            if (
                document.kind !== 'pptx' ||
                !checkIsText(change.box) ||
                change.box.trim() === ''
            ) {
                return {
                    reason:
                        '`smartArtLayout` gives the SmartArt named by `box` ' +
                        "another of PowerPoint's layouts: {slide, box, " +
                        'smartArtLayout}.',
                };
            }
            if (
                !checkIsText(change.smartArtLayout) ||
                change.smartArtLayout.trim() === ''
            ) {
                return {
                    reason:
                        `\`smartArtLayout\` is ${SMARTART_LAYOUT_CHOICES_TEXT} ` +
                        "-- PowerPoint's Basic Cycle, Basic Process, Basic " +
                        'Pyramid, Basic Venn and Hierarchy (boxes under ' +
                        'boxes kept under them) -- or the `layout` read on ' +
                        'another SmartArt of the deck.',
                };
            }
            const keys = Object.keys(change).filter((key) => {
                return (
                    !['smartArtLayout', 'box', 'slide', 'at'].includes(key) &&
                    change[key as keyof OfficeChangeType] !== undefined
                );
            });
            if (keys.length > 0) {
                return {
                    reason:
                        '`smartArtLayout` takes `slide`, `box` and `at` ' +
                        `alone; send \`${keys[0]}\` apart, in a change of ` +
                        'its own after it.',
                };
            }
            continue;
        }
        const boxEditKeys = (
            ['smartArtAdd', 'smartArtRemove', 'smartArtMove'] as const
        ).filter((key) => {
            return change[key] !== undefined;
        });
        const placeKeys = (
            ['afterBox', 'beforeBox', 'underBox'] as const
        ).filter((key) => {
            return change[key] !== undefined;
        });
        if (boxEditKeys.length > 0 || placeKeys.length > 0) {
            const [editKey] = boxEditKeys;
            if (
                document.kind !== 'pptx' ||
                boxEditKeys.length !== 1 ||
                placeKeys.length > 1 ||
                !checkIsText(change.box) ||
                change.box.trim() === ''
            ) {
                return {
                    reason:
                        'A SmartArt named by `box` takes ONE of ' +
                        '`smartArtAdd` (new words), `smartArtRemove` or ' +
                        "`smartArtMove` (a box's words), with at most one " +
                        'of `afterBox`, `beforeBox` or `underBox` (the ' +
                        'words of the box it goes by): {slide, box, ' +
                        'smartArtAdd: "Pray", afterBox: "Read"}.',
                };
            }
            if (editKey === 'smartArtRemove' && placeKeys.length > 0) {
                return {
                    reason:
                        '`smartArtRemove` takes no place: the words drawn ' +
                        'inside the box go with it, a box of its own under ' +
                        'it moves up into its place.',
                };
            }
            if (editKey === 'smartArtMove' && placeKeys.length === 0) {
                return {
                    reason:
                        '`smartArtMove` takes `afterBox`, `beforeBox` or ' +
                        '`underBox`: where it goes.',
                };
            }
            for (const key of [editKey, ...placeKeys]) {
                const value = change[key];
                if (
                    !checkIsText(value) ||
                    value.trim() === '' ||
                    value.length > MAX_CHANGE_TEXT_CHARS
                ) {
                    return { reason: `\`${key}\` must be words.` };
                }
            }
            const keys = Object.keys(change).filter((key) => {
                return (
                    ![editKey, ...placeKeys, 'box', 'slide'].includes(key) &&
                    change[key as keyof OfficeChangeType] !== undefined
                );
            });
            if (keys.length > 0) {
                return {
                    reason:
                        `\`${editKey}\` takes \`slide\`, \`box\` and a place ` +
                        `alone; send \`${keys[0]}\` apart, in a change of ` +
                        'its own.',
                };
            }
            continue;
        }
        if (change.toShapes !== undefined) {
            // the SmartArt's own boxes may be given their fill, outline
            // and see-through as they are made (a small model turned it
            // on a yes and asked again before the green it was asked for)
            const keys = Object.keys(change).filter((key) => {
                return (
                    ![
                        'toShapes',
                        'box',
                        'slide',
                        'fill',
                        'outline',
                        'transparency',
                        'arrange',
                        'at',
                    ].includes(key) &&
                    change[key as keyof OfficeChangeType] !== undefined
                );
            });
            if (
                change.toShapes !== true ||
                document.kind !== 'pptx' ||
                !checkIsText(change.box) ||
                change.box.trim() === ''
            ) {
                return {
                    reason:
                        '`toShapes: true` turns the SmartArt named by `box` ' +
                        "into shapes (a deck's, with `slide`).",
                };
            }
            if (change.at !== undefined && change.arrange === undefined) {
                return {
                    reason:
                        '`at` with `toShapes` is the place to lay its boxes ' +
                        'out in: give `arrange` too, or send `at` apart, ' +
                        'after it, to each shape by its name.',
                };
            }
            if (
                change.arrange !== undefined &&
                !SMARTART_ARRANGE_LIST.includes(change.arrange)
            ) {
                return {
                    reason:
                        '`arrange` is "cycle", "row" or "column"; a SmartArt ' +
                        'kept a SmartArt is given another layout by ' +
                        '{slide, box, smartArtLayout: ' +
                        `${SMARTART_LAYOUT_CHOICES_TEXT}}, and any other ` +
                        "layout is PowerPoint's " +
                        '(SmartArt Design → Layouts).',
                };
            }
            if (keys.length > 0) {
                return {
                    reason:
                        '`toShapes` takes the `fill`, `outline` and ' +
                        "`transparency` of the SmartArt's boxes; send " +
                        `\`${keys[0]}\` apart, after it, to the shapes by ` +
                        'the names the answer gives.',
                };
            }
            const shapesLook = readOfficeBoxLook(change);
            if ('reason' in shapesLook) {
                return shapesLook;
            }
            if (shapesLook.look !== null) {
                toShapesLookMap.set(change, shapesLook.look);
            }
            continue;
        }
        for (const key of ['text', 'note'] as const) {
            const value = change[key];
            if (value !== undefined && !checkIsText(value)) {
                return { reason: `\`${key}\` must be words.` };
            }
            if (checkIsText(value) && value.length > MAX_CHANGE_TEXT_CHARS) {
                return { reason: `\`${key}\` is too long for one change.` };
            }
        }
        const isLineChange = checkIsLineChange(change);
        const isSlideChange =
            change.note !== undefined ||
            change.removeSlide === true ||
            change.duplicate === true ||
            change.newSlide === true ||
            change.to !== undefined;
        const lookRead = readOfficeLook(change);
        if ('reason' in lookRead) {
            return { reason: lookRead.reason };
        }
        if (lookRead.look !== null) {
            lookMap.set(change, lookRead.look);
        }
        const boxLookRead = readOfficeBoxLook(change);
        if ('reason' in boxLookRead) {
            return { reason: boxLookRead.reason };
        }
        if (boxLookRead.look !== null) {
            if (document.kind !== 'pptx') {
                return {
                    reason:
                        '`fill`, `outline`, `transparency`, `brightness`, ' +
                        "`rotate`, `valign` and `order` are a slide box's; " +
                        'a Word page is coloured with `pageColor`.',
                };
            }
            if (
                change.box === undefined &&
                change.textBox === undefined &&
                change.shape === undefined &&
                change.picture === undefined
            ) {
                // a look sent beside the change that makes its box: the
                // new box has no name yet, so the look rides that change
                const maker = changes.find((other) => {
                    return (
                        (other.picture !== undefined ||
                            other.textBox !== undefined ||
                            other.shape !== undefined) &&
                        (change.slide === undefined ||
                            other.slide === change.slide)
                    );
                });
                if (maker !== undefined) {
                    const kind =
                        maker.picture !== undefined
                            ? 'picture'
                            : maker.shape !== undefined
                              ? 'shape'
                              : 'textBox';
                    return {
                        reason:
                            `Give the look IN the change that adds the new ` +
                            `${{ picture: 'picture', shape: 'shape', textBox: 'text box' }[kind]}` +
                            ` -- {slide: ${maker.slide}, ${kind}, at, ` +
                            `${Object.keys(boxLookRead.look).join(', ')}}: ` +
                            'it has no name until it is made.',
                    };
                }
                return {
                    reason:
                        '`fill`, `outline`, `transparency`, `brightness`, ' +
                        "`rotate`, `valign` and `order` are a box's own: " +
                        'name it (`box`, no slide: on every slide that has ' +
                        'it), or give them with a new `textBox` or ' +
                        "`picture`. A slide's colour is its `background`.",
                };
            }
            if (
                change.media !== undefined ||
                change.animation !== undefined ||
                change.removeBox !== undefined ||
                change.table !== undefined ||
                change.chart !== undefined
            ) {
                return {
                    reason:
                        "A box's look (`fill`, `rotate`, `order`, …) is a " +
                        'change of its own: send it apart.',
                };
            }
            boxLookMap.set(change, boxLookRead.look);
        }
        const linkTarget = lookRead.look?.link;
        if (linkTarget !== undefined) {
            if (document.kind === 'docx') {
                return {
                    reason:
                        'A link in a Word file is made in Word: `link` is a ' +
                        "deck's.",
                };
            }
            const jump = linkTarget?.startsWith('slide:')
                ? Number(linkTarget.slice(6))
                : null;
            if (jump !== null && jump > document.slides.length) {
                return {
                    reason:
                        `There is no slide ${jump} to link to: the deck has ` +
                        `${document.slides.length}.`,
                };
            }
        }
        if (document.kind === 'docx' && lookRead.look?.bullets !== undefined) {
            return {
                reason:
                    "`bullets` are a deck's lines': a Word file's lists are " +
                    'made in Word.',
            };
        }
        const isSlideLook =
            change.background !== undefined ||
            change.hidden !== undefined ||
            change.removeBox !== undefined ||
            change.transition !== undefined ||
            change.advance !== undefined ||
            change.textBox !== undefined ||
            change.shape !== undefined ||
            change.slideNumbers !== undefined ||
            change.footer !== undefined ||
            change.at !== undefined ||
            change.box !== undefined ||
            change.slideSize !== undefined ||
            change.theme !== undefined ||
            change.picture !== undefined ||
            change.media !== undefined ||
            change.play !== undefined ||
            change.animation !== undefined ||
            change.table !== undefined ||
            change.chart !== undefined;
        const shapeReason = checkShapeChange(change);
        if (shapeReason !== null) {
            return { reason: shapeReason };
        }
        if (change.words !== undefined) {
            if (
                !checkIsText(change.words) ||
                change.words.trim() === '' ||
                change.words.length > 2000
            ) {
                return {
                    reason:
                        '`words` are the words to give a look to, exactly ' +
                        'as a line has them.',
                };
            }
            if (lookRead.look === null) {
                return {
                    reason:
                        '`words` names words to give a look to: say the ' +
                        'look too (`color`, `bold`, `size`, …).',
                };
            }
            if (
                lookRead.look.align !== undefined ||
                lookRead.look.lineSpacing !== undefined ||
                lookRead.look.bullets !== undefined
            ) {
                return {
                    reason:
                        '`align`, `lineSpacing` and `bullets` are a whole ' +
                        "line's: give them without `words`.",
                };
            }
            if (
                change.text !== undefined ||
                change.remove !== undefined ||
                change.after !== undefined ||
                change.before !== undefined ||
                change.textBox !== undefined
            ) {
                return {
                    reason:
                        '`words` goes with a look on a line (`id`), a box, a ' +
                        'slide or every line -- never with new words.',
                };
            }
        }
        // a Word page's colour, and a picture put in a Word file as a line
        // of its own
        const isPageColor = change.pageColor !== undefined;
        const isWordPicture =
            document.kind === 'docx' &&
            change.picture !== undefined &&
            change.at === undefined &&
            change.box === undefined &&
            (change.after !== undefined || change.before !== undefined);
        if (isPageColor) {
            if (document.kind !== 'docx') {
                return {
                    reason:
                        "A slide's colour is its `background`; `pageColor` " +
                        "is a Word page's.",
                };
            }
            if (!checkIsText(change.pageColor) || isLineChange) {
                return {
                    reason:
                        '`pageColor` is a colour (#RRGGBB or a name), or ' +
                        '"none", in a change of its own.',
                };
            }
        }
        if (change.width !== undefined && !isWordPicture) {
            return {
                reason:
                    "`width` is a Word picture's, in % of the page (with " +
                    "`after` or `before`); a slide's picture takes `at`.",
            };
        }
        if (
            !isLineChange &&
            !isSlideChange &&
            lookRead.look === null &&
            !isSlideLook &&
            !isPageColor
        ) {
            return {
                reason:
                    'A change names a line (`id`, or `after` / `before` for a ' +
                    'new one)' +
                    (document.kind === 'pptx'
                        ? ' or a `slide` with `note`, `to`, `duplicate`, ' +
                          '`removeSlide`, `background`, `hidden`, ' +
                          '`transition`, `advance`, `textBox`, `shape`, `picture`, ' +
                          '`media`, `animation`, `table` or `chart`, or ' +
                          "`removeBox`; a `box` with `at`; the deck's " +
                          '`slideSize`, `theme`, `slideNumbers` or `footer`; ' +
                          '`newSlide`; or it gives a look (`color`, ' +
                          '`size`, …) for every line.'
                        : ', or gives a look (`color`, `size`, …) for every ' +
                          'line.'),
            };
        }
        if (
            document.kind === 'docx' &&
            (change.slideNumbers !== undefined || change.footer !== undefined)
        ) {
            return {
                reason:
                    "`slideNumbers` and `footer` are a deck's: a Word " +
                    "file's page numbers and footer are set in Word.",
            };
        }
        if (document.kind === 'docx') {
            if (isSlideLook && !isWordPicture) {
                return {
                    reason:
                        'A Word file has no slides or boxes: its tables ' +
                        "and its layout are not changed here. Its words' " +
                        'look is (`color`, `highlight`, `size`, `words`, ' +
                        '…), its page colour `pageColor`, and a picture ' +
                        'goes in as a line of its own: {after | before: ' +
                        'id, picture, width}.',
                };
            }
            if (isWordPicture) {
                const bytes =
                    typeof change.picture === 'string'
                        ? pictures.get(change.picture)
                        : undefined;
                if (bytes === undefined) {
                    return {
                        reason:
                            '`picture` is a picture attached to the chat, ' +
                            'by its name; one with no file of its own ' +
                            '(pasted, or a picture of the screen) cannot go ' +
                            'into a file.',
                    };
                }
                if (readPictureInfo(bytes) === null) {
                    return {
                        reason:
                            `"${toPictureName(String(change.picture))}" is ` +
                            'not a PNG, JPEG, GIF or BMP picture.',
                    };
                }
                if (change.text !== undefined || lookRead.look !== null) {
                    return {
                        reason:
                            'A picture goes in a line of its own: send its ' +
                            'words or a look as a change apart.',
                    };
                }
            }
            if (
                !isLineChange &&
                (isSlideChange || change.slide !== undefined)
            ) {
                return {
                    reason:
                        'A Word file has no slides: change its lines by id, ' +
                        'or replace words.',
                };
            }
            continue;
        }
        if (isSlideLook && isLineChange) {
            return {
                reason:
                    "A slide's `background`, `hidden`, `removeBox`, " +
                    '`transition`, `advance`, a `box` and a `textBox` go ' +
                    'with `slide` (or none), never with a line id.',
            };
        }
        if (
            change.box !== undefined &&
            (!checkIsText(change.box) || change.box.trim() === '')
        ) {
            return {
                reason:
                    "`box` is a box's name as read (`boxes`), a line's " +
                    '`box`, or a line id in it.',
            };
        }
        if (
            change.box !== undefined &&
            change.at === undefined &&
            change.picture === undefined &&
            change.animation === undefined &&
            change.shape === undefined &&
            lookRead.look === null &&
            boxLookRead.look === null
        ) {
            return {
                reason:
                    `Say what to do with box "${change.box}": \`at\` ` +
                    '[x, y, width, height] moves or sizes it, a look ' +
                    '(`color`, `size`, …) is for its words, `fill`, ' +
                    '`outline`, `rotate`, `order` … are its own, ' +
                    '`animation` brings it in, `removeBox` takes it off.',
            };
        }
        if (
            change.at !== undefined &&
            change.box === undefined &&
            change.textBox === undefined &&
            change.shape === undefined &&
            change.picture === undefined &&
            change.media === undefined
        ) {
            return {
                reason:
                    '`at` places a box: name it (`box`), or give a new ' +
                    '`textBox` its words, a new `picture` or `media`.',
            };
        }
        if (change.picture !== undefined) {
            const bytes =
                typeof change.picture === 'string'
                    ? pictures.get(change.picture)
                    : undefined;
            if (bytes === undefined) {
                return {
                    reason:
                        '`picture` is a picture attached to the chat, by its ' +
                        'name; one with no file of its own (pasted, or a ' +
                        'picture of the screen) cannot go into a file.',
                };
            }
            if (readPictureInfo(bytes) === null) {
                return {
                    reason:
                        `"${toPictureName(change.picture)}" is not a PNG, ` +
                        'JPEG, GIF or BMP picture: those are what a slide ' +
                        'draws.',
                };
            }
            if (
                change.textBox !== undefined ||
                change.removeBox !== undefined ||
                lookRead.look !== null
            ) {
                return {
                    reason:
                        '`picture` puts a picture on a slide (`at`) or in ' +
                        "a picture box's place (`box`): send a text box, a " +
                        'box taken off or a look apart.',
                };
            }
        }
        if (change.media !== undefined) {
            const bytes =
                typeof change.media === 'string'
                    ? pictures.get(change.media)
                    : undefined;
            if (bytes === undefined) {
                return {
                    reason:
                        '`media` is a video or a sound attached to the chat, ' +
                        'by its name.',
                };
            }
            const mediaName = toPictureName(String(change.media));
            if (readOfficeMediaInfo(mediaName, bytes) === null) {
                return {
                    reason:
                        `"${mediaName}" is not a video or a sound a slide ` +
                        'plays: an MP4, MOV, WMV, AVI, MP3, M4A, WAV or WMA ' +
                        'file.',
                };
            }
            if (change.slide === undefined) {
                return {
                    reason:
                        'A video or a sound goes on one slide: give its ' +
                        '`slide`.',
                };
            }
            if (
                change.picture !== undefined ||
                change.textBox !== undefined ||
                change.box !== undefined ||
                change.removeBox !== undefined ||
                change.animation !== undefined ||
                lookRead.look !== null
            ) {
                return {
                    reason:
                        '`media` puts a video or a sound on a slide (`at`, ' +
                        '`play`): send a picture, a box or a look apart.',
                };
            }
        }
        if (
            change.play !== undefined &&
            (change.media === undefined ||
                (change.play !== 'click' && change.play !== 'auto'))
        ) {
            return {
                reason: '`play` is "click" or "auto", with the `media` it plays.',
            };
        }
        if (change.slideNumbers !== undefined || change.footer !== undefined) {
            if (
                change.slideNumbers !== undefined &&
                typeof change.slideNumbers !== 'boolean'
            ) {
                return { reason: '`slideNumbers` is true or false.' };
            }
            if (
                change.footer !== undefined &&
                (!checkIsText(change.footer) || change.footer.length > 200)
            ) {
                return {
                    reason:
                        '`footer` is the footer\'s words, or "none" to ' +
                        'take it off.',
                };
            }
            // words a master or a layout already puts on every slide are
            // changed there, never written again as a footer (2026-11-21:
            // "the church's name at the bottom of each slide, in green"
            // had been made a second "Grace Church" as a footer)
            const footerWords = checkIsText(change.footer)
                ? change.footer.trim().toLowerCase()
                : '';
            const sharedLine = (document.shared ?? [])
                .flatMap((shared) => {
                    return shared.lines.map((line) => {
                        return { shared, line };
                    });
                })
                .find(({ shared, line }) => {
                    // its own box: a footer placeholder's words are the
                    // slides' footer
                    return (
                        shared.boxes.some((box) => {
                            return box.lineIds.includes(line.id);
                        }) &&
                        footerWords !== '' &&
                        footerWords !== 'none' &&
                        line.text.trim().toLowerCase() === footerWords
                    );
                });
            if (sharedLine !== undefined) {
                const { shared, line } = sharedLine;
                return {
                    reason:
                        `"${line.text.trim()}" is already on ` +
                        `${toShownSharedSlide(shared).on}: ` +
                        `${shared.sharedLabel ?? 'the slide master'}'s box ` +
                        `"${line.box ?? ''}" (id ${line.id}). Change it ` +
                        `there -- {id: "${line.id}", text} for its words, ` +
                        `{slide: ${JSON.stringify(shared.sharedValue)}, box: ` +
                        `${JSON.stringify(line.box ?? '')}, color, bold, …} ` +
                        'for its look -- never as a footer.',
                };
            }
        }
        if (change.shape !== undefined) {
            const shape = toOfficeShape(change.shape);
            if (shape === null) {
                return {
                    reason:
                        '`shape` is one of ' +
                        `${OFFICE_SHAPE_WORD_LIST.join(', ')}.`,
                };
            }
            if (document.kind === 'pptx' && change.box !== undefined) {
                // a box given another shape (2026-11-21)
                if (shape.prst === 'line') {
                    return {
                        reason:
                            'A box cannot become a line: add one with ' +
                            '{slide, shape: "line", at}.',
                    };
                }
                if (
                    change.textBox !== undefined ||
                    change.removeBox !== undefined ||
                    change.picture !== undefined ||
                    change.media !== undefined
                ) {
                    return {
                        reason:
                            '`shape` with `box` gives that box another ' +
                            'shape: send a `textBox`, `removeBox`, ' +
                            '`picture` or `media` apart.',
                    };
                }
                reshapeMap.set(change, shape);
            } else if (document.kind !== 'pptx' || change.slide === undefined) {
                return {
                    reason: 'A new shape goes on one slide: give its `slide`.',
                };
            }
            if (shape.prst === 'line' && change.textBox !== undefined) {
                return {
                    reason:
                        'A line holds no words: add a `textBox` beside it ' +
                        'apart.',
                };
            }
            if (
                change.box === undefined &&
                (change.removeBox !== undefined ||
                    change.picture !== undefined ||
                    change.media !== undefined)
            ) {
                return {
                    reason:
                        '`shape` makes a new box; `removeBox`, a ' +
                        '`picture` or a `media` -- send them apart.',
                };
            }
        }
        if (change.textBox !== undefined) {
            if (!checkIsText(change.textBox) || change.textBox.trim() === '') {
                return { reason: "`textBox` is the new box's words." };
            }
            if (change.textBox.length > MAX_CHANGE_TEXT_CHARS) {
                return { reason: '`textBox` is too long for one change.' };
            }
            if (change.slide === undefined) {
                return {
                    reason: 'A new text box goes on one slide: give its `slide`.',
                };
            }
            if (change.box !== undefined || change.removeBox !== undefined) {
                return {
                    reason:
                        '`textBox` makes a new box; `box` and `removeBox` ' +
                        'name one that is there -- send them apart.',
                };
            }
        }
        if (
            change.transition !== undefined &&
            toOfficeTransition(change.transition) === null
        ) {
            return {
                reason:
                    `\`transition\` is one of ` +
                    `${OFFICE_TRANSITION_LIST.join(', ')}.`,
            };
        }
        if (
            change.advance !== undefined &&
            (typeof change.advance !== 'number' ||
                !(change.advance >= 0 && change.advance <= 3600))
        ) {
            return {
                reason:
                    '`advance` is the seconds a slide waits before going on ' +
                    'by itself, 0 to 3600 (0: it waits for a click).',
            };
        }
        if (change.theme !== undefined) {
            const themeRead = readOfficeThemeAsk(change.theme);
            if ('reason' in themeRead) {
                return themeRead;
            }
            if (change.slide !== undefined) {
                return {
                    reason:
                        "`theme` is the whole deck's: give it with no " +
                        '`slide`.',
                };
            }
            themeMap.set(change, themeRead.ask);
        }
        if (change.slideSize !== undefined) {
            if (toOfficeSlideSize(change.slideSize) === null) {
                return {
                    reason:
                        '`slideSize` is one of ' +
                        `${OFFICE_SLIDE_SIZE_LIST.join(', ')}.`,
                };
            }
            if (change.slide !== undefined) {
                return {
                    reason:
                        "`slideSize` is the whole deck's: give it with no " +
                        '`slide`.',
                };
            }
        }
        if (
            change.removeBox !== undefined &&
            (typeof change.removeBox !== 'string' ||
                change.removeBox.trim() === '')
        ) {
            return {
                reason:
                    "`removeBox` is a box's name as read: a picture's name " +
                    "(`pictures`) or a line's `box`.",
            };
        }
        if (change.hidden !== undefined) {
            if (typeof change.hidden !== 'boolean') {
                return { reason: '`hidden` is true or false.' };
            }
            if (change.slide === undefined) {
                return {
                    reason:
                        '`hidden` hides or shows one slide: give its ' +
                        '`slide` number.',
                };
            }
        }
        if (change.background !== undefined) {
            const background = checkIsOfficeColorOff(change.background)
                ? null
                : toOfficeFill(change.background);
            if (
                background === null &&
                !checkIsOfficeColorOff(change.background)
            ) {
                return {
                    reason:
                        `\`background\` ${JSON.stringify(change.background)} ` +
                        'is not a colour: write it as #RRGGBB or a ' +
                        "colour's English name, a gradient as colours " +
                        'joined by "to" ("dark blue to purple, left to ' +
                        'right"), a pattern ("navy stripes on white"), or ' +
                        '"none" for the layout\'s own background.',
                };
            }
            backgroundMap.set(change, background);
        }
    }

    // 1. words replaced everywhere
    for (const replace of replaces) {
        const from = toXmlSafeText(String(replace?.from ?? ''));
        const to = toWrittenText(String(replace?.to ?? ''));
        if (from === '') {
            return { reason: 'A replace needs `from`: the words to find.' };
        }
        if (from.includes('\n')) {
            return {
                reason:
                    'A replace finds words inside one line; to change ' +
                    'several lines, change each by its id.',
            };
        }
        let count = 0;
        for (const { path: partPath, isCopy } of listTextParts(document)) {
            const xml = await readPart(partPath);
            if (xml === null) {
                continue;
            }
            const edits: { start: number; end: number; replacement: string }[] =
                [];
            for (const paragraph of listOfficeParagraphs(xml, dialect)) {
                if (!paragraph.text.includes(from)) {
                    continue;
                }
                const result = replaceInParagraph(
                    paragraph.xml,
                    from,
                    to,
                    dialect,
                );
                if (result.count > 0) {
                    // the copy kept for old readers changes too, uncounted
                    count += paragraph.isHidden || isCopy ? 0 : result.count;
                    edits.push({
                        start: paragraph.start,
                        end: paragraph.end,
                        replacement: result.xml,
                    });
                }
            }
            if (edits.length > 0) {
                parts.set(partPath, splicePart(xml, edits));
            }
        }
        if (count === 0) {
            const lower = from.toLowerCase();
            const texts =
                document.kind === 'pptx'
                    ? document.slides.flatMap((slide) => {
                          return [
                              ...slide.lines.map((line) => {
                                  return line.text;
                              }),
                              slide.note ?? '',
                              ...slide.boxes.flatMap((box) => {
                                  return box.smartArt?.words ?? [];
                              }),
                          ];
                      })
                    : document.lines.map((line) => {
                          return line.text;
                      });
            const isOtherCase = texts.some((text) => {
                return text.toLowerCase().includes(lower);
            });
            return {
                reason:
                    `${quote(from)} is not in the document as written` +
                    (isOtherCase
                        ? ' -- it is there with other capital letters; ' +
                          'write `from` exactly as the document does.'
                        : '. Read it again and write `from` exactly as a ' +
                          'line has it.'),
            };
        }
        changed.push(
            `Replaced ${quote(from)} with ${quote(to)} (${count} ` +
                `${count === 1 ? 'place' : 'places'}).`,
        );
    }

    // 2. each line's own change, by its id as read
    const slideByNumber = (value: unknown) => {
        return document.kind === 'pptx' && Number.isInteger(value)
            ? ([...document.slides, ...(document.shared ?? [])].find(
                  (slide) => {
                      return slide.number === value;
                  },
              ) ?? null)
            : null;
    };
    const noSuchSlide = (value: unknown) => {
        return {
            reason:
                `There is no slide ${String(value)}: the deck has ` +
                `${document.kind === 'pptx' ? document.slides.length : 0}.`,
        };
    };
    const planMap = new Map<string, Map<number, ParagraphPlanType>>();
    // the parts many slides share, read once this call (as changed so far)
    const shared = genSharedPartReader(readPart);
    // where each `words` change reached, said with how many places
    const wordScopeMap = new Map<OfficeChangeType, string>();
    const wordCountMap = new Map<OfficeChangeType, number>();
    // the boxes a `box` names, on its slide or on every slide that has it
    const findBoxTargets = (value: string, slideNumber: unknown) => {
        let slides = document.kind === 'pptx' ? document.slides : [];
        if (slideNumber !== undefined) {
            const slide = slideByNumber(slideNumber);
            if (slide === null) {
                return noSuchSlide(slideNumber);
            }
            slides = [slide];
        }
        const found: { slide: OfficeSlideType; boxes: OfficeBoxType[] }[] = [];
        for (const slide of slides) {
            const boxes = matchOfficeBoxes(slide, value);
            if (boxes.length > 0) {
                found.push({ slide, boxes });
            }
        }
        if (found.length > 0) {
            return found;
        }
        if (slides.length === 1) {
            const names = slides[0].boxes
                .map((box) => {
                    return (
                        `"${box.name}"` +
                        (box.placeholder === null
                            ? ` (${box.kind})`
                            : ` (${box.placeholder})`)
                    );
                })
                .join(', ');
            return {
                reason:
                    `Slide ${slides[0].number} has no box "${value}". ` +
                    (names === ''
                        ? 'It has no boxes.'
                        : `Its boxes: ${names}.`),
            };
        }
        return {
            reason: `No slide has a box "${value}". Name a box as read (\`boxes\`).`,
        };
    };
    const toPlan = (id: string) => {
        const place = lineMap.get(id);
        if (place === undefined) {
            return null;
        }
        let partPlans = planMap.get(place.partPath);
        if (partPlans === undefined) {
            partPlans = new Map();
            planMap.set(place.partPath, partPlans);
        }
        let plan = partPlans.get(place.index);
        if (plan === undefined) {
            plan = { before: [], after: [], wordLooks: [] };
            partPlans.set(place.index, plan);
        }
        return plan;
    };
    const noSuchLine = (id: unknown) => {
        const slideNumber = Number(String(id).split('.')[0]);
        if (
            document.kind === 'pptx' &&
            slideNumber > document.slides.length &&
            changes.some((change) => {
                return change.duplicate === true || change.newSlide === true;
            })
        ) {
            // measured 2026-11-20: a copy and its new title in one call
            return {
                reason:
                    `There is no line "${String(id)}" yet: ids are as read, ` +
                    'and a copy made in this call has none. Make the copy ' +
                    "alone: the answer gives the copy's lines by their ids.",
            };
        }
        return {
            reason:
                `There is no line "${String(id)}". Use a line's id as read ` +
                (document.kind === 'pptx'
                    ? '("2.3" is slide 2, line 3).'
                    : '("12" is line 12).'),
        };
    };
    // a picture put in a Word file: its bytes once in `word/media/`, a
    // relationship from the document, and a line holding it inline
    const wordRelIdMap = new Map<string, string>();
    let wordDrawingId = 0;
    const genWordPicture = async (
        change: OfficeChangeType,
    ): Promise<{ xml: string; widthPercent: number } | { reason: string }> => {
        const name = String(change.picture);
        const bytes = pictures.get(name) as Uint8Array;
        const info = readPictureInfo(bytes) as OfficePictureInfoType;
        const mainXml = await readPart(document.mainPath);
        if (mainXml === null) {
            return { reason: 'The file is damaged: its main part is missing.' };
        }
        let relId = wordRelIdMap.get(name);
        if (relId === undefined) {
            const mediaPath = genFreeMediaPath(
                [...pkg.names, ...parts.keys()],
                info.extension,
                'word/media',
            );
            const types = await readPart(CONTENT_TYPES_PATH);
            if (types === null) {
                return { reason: 'The file says no content types.' };
            }
            parts.set(mediaPath, bytes);
            parts.set(
                CONTENT_TYPES_PATH,
                addContentTypeDefault(types, info.extension, info.contentType),
            );
            const relsPath = toRelsPath(document.mainPath);
            const relsXml = await readPart(relsPath);
            relId = nextRelId(parseRels(relsXml ?? ''));
            parts.set(
                relsPath,
                addRelToXml(
                    relsXml,
                    genRelXml(
                        relId,
                        `${REL_TYPE_BASE}image`,
                        toRelativeTarget(document.mainPath, mediaPath),
                    ),
                ),
            );
            wordRelIdMap.set(name, relId);
        }
        wordDrawingId =
            wordDrawingId === 0
                ? nextWordDrawingId(mainXml)
                : wordDrawingId + 1;
        const textWidth = readWordTextWidthEmu(mainXml);
        const fitted = fitWordPicture(
            info.width,
            info.height,
            textWidth,
            change.width,
        );
        return {
            xml: genWordPictureParagraphXml({
                relId,
                pictureId: wordDrawingId,
                name: toPictureName(name),
                widthEmu: fitted.widthEmu,
                heightEmu: fitted.heightEmu,
            }),
            widthPercent: Math.round((fitted.widthEmu / textWidth) * 100),
        };
    };
    for (const change of changes) {
        if (!checkIsLineChange(change)) {
            continue;
        }
        const look = lookMap.get(change) ?? null;
        if (change.after !== undefined || change.before !== undefined) {
            const anchorId = String(change.after ?? change.before);
            const plan = toPlan(anchorId);
            if (plan === null) {
                return noSuchLine(anchorId);
            }
            if (document.kind === 'docx' && change.picture !== undefined) {
                const pictured = await genWordPicture(change);
                if ('reason' in pictured) {
                    return pictured;
                }
                (change.after !== undefined ? plan.after : plan.before).push({
                    text: '',
                    look: null,
                    xml: pictured.xml,
                });
                changed.push(
                    `Put ${quote(toPictureName(String(change.picture)))} in ` +
                        `a line of its own ${
                            change.after !== undefined ? 'after' : 'before'
                        } ${anchorId}, ${pictured.widthPercent}% of the ` +
                        "page's width.",
                );
                continue;
            }
            if (!checkIsText(change.text)) {
                return {
                    reason:
                        'A new line needs `text`, with `after` or `before` ' +
                        'the id of the line it goes beside.',
                };
            }
            (change.after !== undefined ? plan.after : plan.before).push({
                text: change.text,
                look,
            });
            changed.push(
                `Added a line ${change.after !== undefined ? 'after' : 'before'} ` +
                    `${anchorId}: ${quote(change.text)}` +
                    (look === null ? '.' : ` (${describeOfficeLook(look)}).`),
            );
            continue;
        }
        const id = String(change.id);
        const plan = toPlan(id);
        if (plan === null) {
            return noSuchLine(id);
        }
        const isWords = change.remove === true || checkIsText(change.text);
        if (
            isWords &&
            (plan.setText !== undefined || plan.isRemoved === true)
        ) {
            return {
                reason: `Line ${id} is changed twice in one call; send one change for it.`,
            };
        }
        if (change.remove === true) {
            plan.isRemoved = true;
            changed.push(`Took out line ${id}.`);
            continue;
        }
        if (checkIsText(change.text)) {
            plan.setText = change.text;
            changed.push(`Line ${id} now reads ${quote(change.text)}.`);
        } else if (look === null) {
            return {
                reason:
                    `Say what to do with line ${id}: \`text\` for its new ` +
                    'words, `remove`: true, or its look (`color`, `size`, ' +
                    '`bold`, …).',
            };
        }
        if (look !== null && change.words !== undefined) {
            plan.wordLooks.push({ words: change.words, look, change });
            wordScopeMap.set(change, `in line ${id}`);
        } else if (look !== null) {
            plan.look = { ...plan.look, ...look };
            changed.push(`Line ${id}: ${describeOfficeLook(look)}.`);
        }
    }
    // A look for every line of the file, of a slide or of a box: each line
    // given it under any look of its own the call names (the line's wins,
    // then a box's, a slide's, the file's).
    const scopeList: {
        rank: number;
        ids: Set<string> | null;
        look: OfficeLookType;
    }[] = [];
    // every line of the file: a deck's slides, and the words a master or
    // a layout puts on every slide in a box of its own -- a church's name
    // "in green, everywhere" is the master's too (2026-11-21); never a
    // placeholder's prompt words, which no slide shows
    const allLineIds =
        document.kind === 'pptx'
            ? [
                  ...document.slides.flatMap((slide) => {
                      return slide.lines.map((line) => {
                          return line.id;
                      });
                  }),
                  ...(document.shared ?? []).flatMap((shared) => {
                      return shared.boxes.flatMap((box) => {
                          return box.lineIds;
                      });
                  }),
              ]
            : document.lines.map((line) => {
                  return line.id;
              });
    // Words given a look wherever they are, said by a master's or a
    // layout's own box AND by a slide's own line: which one is meant is
    // the person's to say (2026-11-21, asked in Khmer: "the church's name
    // at the bottom of every slide, green" came as those words everywhere
    // and greened a subtitle saying them too; changed on the master alone,
    // "every Grace Church in the file" left the subtitle and the answer
    // said all -- told which call fits, the free model chose both times).
    const findSharedAndSlideWords = (words: string) => {
        if (document.kind !== 'pptx') {
            return null;
        }
        const wanted = words.trim().toLowerCase();
        const sharedLine = (document.shared ?? [])
            .flatMap((shared) => {
                return shared.lines.map((line) => {
                    return { shared, line };
                });
            })
            .find(({ shared, line }) => {
                return (
                    wanted !== '' &&
                    shared.boxes.some((box) => {
                        return box.lineIds.includes(line.id);
                    }) &&
                    line.text.toLowerCase().includes(wanted)
                );
            });
        const slideLines = document.slides.flatMap((slide) => {
            return slide.lines
                .filter((line) => {
                    return line.text.toLowerCase().includes(wanted);
                })
                .map((line) => {
                    return { slide, line };
                });
        });
        if (sharedLine === undefined || slideLines.length === 0) {
            return null;
        }
        const { shared, line } = sharedLine;
        const slideNumbers = [
            ...new Set(
                slideLines.map((one) => {
                    return one.slide.number;
                }),
            ),
        ];
        const shown = JSON.stringify(words.trim());
        const sharedCall =
            `{slide: ${JSON.stringify(shared.sharedValue)}, box: ` +
            `${JSON.stringify(line.box ?? '')}, …the look}`;
        return (
            `${quote(words.trim())} is ${shared.sharedLabel ?? 'the slide master'}'s ` +
            `box "${line.box ?? ''}", on ${toShownSharedSlide(shared).on}, ` +
            `and is also written ${toOnSlidesText(slideNumbers)} itself ` +
            `(${quote(slideLines[0].line.text.trim())}). Send it again ` +
            'now, not asked, by one test: did their question WRITE ' +
            `${quote(words.trim())} itself? Then they mean every place it ` +
            `is written: {words: ${shown}, everywhere: true, …the look} -- ` +
            `that box and the words ${toOnSlidesText(slideNumbers)}. Did ` +
            'they name it instead by where or what it is (the name at the ' +
            'bottom of every slide, the church name) without writing those ' +
            `words? Then it is that box alone: ${sharedCall}.`
        );
    };
    for (const change of changes) {
        const look = lookMap.get(change);
        if (
            look === undefined ||
            checkIsLineChange(change) ||
            change.textBox !== undefined
        ) {
            continue;
        }
        let ids: Set<string> | null = null;
        let rank = 0;
        let where = 'every line';
        if (change.box !== undefined) {
            const found = findBoxTargets(change.box, change.slide);
            if ('reason' in found) {
                return found;
            }
            const lineIds = found.flatMap((one) => {
                return one.boxes.flatMap((box) => {
                    return box.lineIds;
                });
            });
            if (lineIds.length === 0) {
                return {
                    reason:
                        `"${change.box}" holds no words to give a look to.` +
                        (change.at === undefined
                            ? ''
                            : ' Send its `at` without a look.'),
                };
            }
            ids = new Set(lineIds);
            rank = 2;
            where = `the lines of "${found[0].boxes[0].name}" ${toOnSlidesText(
                found.map((one) => {
                    return one.slide.number;
                }),
            )}`;
        } else if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            if (slide.lines.length === 0) {
                return {
                    reason:
                        `Slide ${slide.number} has no words to give a look ` +
                        'to. Its `background` is changed with `slide` and ' +
                        '`background`.',
                };
            }
            ids = new Set(
                slide.lines.map((line) => {
                    return line.id;
                }),
            );
            rank = 1;
            where = `every line of slide ${slide.number}`;
        }
        if (change.words !== undefined) {
            // `everywhere`: the person said every one, all of them -- the
            // master's box and each slide saying the words (2026-11-21,
            // the Khmer "every Grace Church in the file" had been asked
            // about first)
            const both =
                ids === null && change.everywhere !== true
                    ? findSharedAndSlideWords(change.words)
                    : null;
            if (both !== null) {
                return { reason: both };
            }
            for (const id of ids ?? allLineIds) {
                toPlan(id)?.wordLooks.push({
                    words: change.words,
                    look,
                    change,
                });
            }
            wordScopeMap.set(change, `in ${where}`);
            continue;
        }
        scopeList.push({ rank, ids, look });
        changed.push(
            `${where[0].toUpperCase()}${where.slice(1)}: ` +
                `${describeOfficeLook(look)}.`,
        );
    }
    if (scopeList.length > 0) {
        scopeList.sort((a, b) => {
            return a.rank - b.rank;
        });
        // a master's or a layout's lines are reached only by a scope that
        // names them (its box, or it): "every line" is the slides'
        const slideIdSet = new Set(allLineIds);
        const sharedIds = new Set<string>();
        for (const scope of scopeList) {
            for (const id of scope.ids ?? []) {
                if (!slideIdSet.has(id)) {
                    sharedIds.add(id);
                }
            }
        }
        for (const id of [...allLineIds, ...sharedIds]) {
            let scopeLook: OfficeLookType = {};
            for (const scope of scopeList) {
                if (scope.ids === null || scope.ids.has(id)) {
                    scopeLook = { ...scopeLook, ...scope.look };
                }
            }
            if (Object.keys(scopeLook).length === 0) {
                continue;
            }
            const plan = toPlan(id);
            if (plan !== null) {
                plan.look = { ...scopeLook, ...plan.look };
            }
        }
    }
    // the size a line's runs with none of their own are drawn at, read
    // only for a size changed against it ("+20%")
    const checkNeedsBaseSize = (plan: ParagraphPlanType) => {
        return (
            plan.look?.sizeBy !== undefined ||
            plan.wordLooks.some((one) => {
                return one.look.sizeBy !== undefined;
            }) ||
            [...plan.before, ...plan.after].some((line) => {
                return line.look?.sizeBy !== undefined;
            })
        );
    };
    let wordStylesXml: string | null | undefined;
    const readBaseSize = async (
        partPath: string,
        xml: string,
        paragraph: OfficeParagraphType,
    ) => {
        if (document.kind === 'docx') {
            if (wordStylesXml === undefined) {
                wordStylesXml = await readPart(
                    resolvePartPath(document.mainPath, 'styles.xml'),
                );
            }
            return (
                findWordStyleSize(wordStylesXml ?? '', paragraph.box) ??
                DEFAULT_DOCX_SIZE
            );
        }
        const slide = document.slides.find((one) => {
            return one.partPath === partPath;
        });
        const { layoutXml, masterXml } = await shared.layoutOf(
            slide?.layoutPath ?? null,
        );
        return (
            readInheritedSize(xml, paragraph.start, layoutXml, masterXml) ??
            DEFAULT_PPTX_SIZE
        );
    };
    for (const [partPath, partPlans] of planMap) {
        const xml = await readPart(partPath);
        if (xml === null) {
            return {
                reason: 'The file is damaged: a slide could not be read.',
            };
        }
        const visible = listOfficeParagraphs(xml, dialect).filter(
            (paragraph) => {
                return !paragraph.isHidden;
            },
        );
        // a box, a cell or a body keeps one line: the last one standing is
        // emptied rather than taken out, and so is a Word line holding the
        // section's page settings
        const byContainer = new Map<number, number[]>();
        visible.forEach((paragraph, index) => {
            const list = byContainer.get(paragraph.containerStart) ?? [];
            list.push(index);
            byContainer.set(paragraph.containerStart, list);
        });
        for (const indexes of byContainer.values()) {
            const plans = indexes.map((index) => {
                return partPlans.get(index);
            });
            const isAllRemoved = plans.every((plan) => {
                return plan?.isRemoved === true;
            });
            const isAnyAdded = plans.some((plan) => {
                return (
                    plan !== undefined &&
                    (plan.before.length > 0 || plan.after.length > 0)
                );
            });
            if (isAllRemoved && !isAnyAdded) {
                const last = partPlans.get(indexes[indexes.length - 1]);
                if (last !== undefined) {
                    last.isRemoved = false;
                    last.setText = '';
                }
            }
        }
        const edits: { start: number; end: number; replacement: string }[] = [];
        for (const [index, plan] of partPlans) {
            const paragraph = visible[index];
            if (paragraph === undefined) {
                return { reason: 'The file changed while it was being read.' };
            }
            if (
                plan.isRemoved === true &&
                dialect === 'docx' &&
                /<w:sectPr\b/.test(paragraph.xml)
            ) {
                plan.isRemoved = false;
                plan.setText = '';
            }
            const baseSize = checkNeedsBaseSize(plan)
                ? await readBaseSize(partPath, xml, paragraph)
                : undefined;
            // a new line takes the look given to the line it is beside,
            // and its own over it
            const copies = (lines: NewLineType[]) => {
                return lines.map((line) => {
                    if (line.xml !== undefined) {
                        return line.xml;
                    }
                    const built = rebuildParagraph(
                        paragraph.xml,
                        line.text,
                        dialect,
                        true,
                    );
                    const look = { ...plan.look, ...line.look };
                    return built === null || Object.keys(look).length === 0
                        ? built
                        : applyParagraphLook(built, look, dialect, baseSize);
                });
            };
            const before = copies(plan.before);
            const after = copies(plan.after);
            const worded =
                plan.isRemoved === true
                    ? ''
                    : plan.setText !== undefined
                      ? setParagraphText(paragraph.xml, plan.setText, dialect)
                      : paragraph.xml;
            let own =
                worded === null || worded === '' || plan.look === undefined
                    ? worded
                    : applyParagraphLook(worded, plan.look, dialect, baseSize);
            for (const wordLook of plan.wordLooks) {
                if (own === null || own === '') {
                    break;
                }
                const result = applyWordsLook(
                    own,
                    wordLook.words,
                    wordLook.look,
                    dialect,
                    baseSize,
                );
                own = result === null ? null : result.xml;
                wordCountMap.set(
                    wordLook.change,
                    (wordCountMap.get(wordLook.change) ?? 0) +
                        (result?.count ?? 0),
                );
            }
            if (
                own === null ||
                before.some((one) => {
                    return one === null;
                }) ||
                after.some((one) => {
                    return one === null;
                })
            ) {
                return {
                    reason: 'A line of the file could not be read to change it.',
                };
            }
            edits.push({
                start: paragraph.start,
                end: paragraph.end,
                replacement: [...before, own, ...after].join(''),
            });
        }
        parts.set(partPath, splicePart(xml, edits));
    }

    for (const [change, where] of wordScopeMap) {
        const count = wordCountMap.get(change) ?? 0;
        const words = quote(String(change.words));
        if (count === 0) {
            return {
                reason:
                    `${words} is not ${where} as written. Write \`words\` ` +
                    'exactly as the line has them.',
            };
        }
        changed.push(
            `${words} ${where} (${count} ${count === 1 ? 'place' : 'places'}): ` +
                `${describeOfficeLook(lookMap.get(change) ?? {})}.`,
        );
    }

    if (document.kind === 'docx') {
        // the page's colour, shown by Word only with its settings saying so
        const pageChange = [...changes].reverse().find((change) => {
            return change.pageColor !== undefined;
        });
        if (pageChange !== undefined) {
            const asked = String(pageChange.pageColor).trim();
            const color = /^(?:none|off|white)$/i.test(asked)
                ? null
                : toOfficeColor(asked);
            if (color === null && !/^(?:none|off|white)$/i.test(asked)) {
                return {
                    reason:
                        `No colour "${asked}": a name or #RRGGBB, or ` +
                        '"none".',
                };
            }
            const mainXml = await readPart(document.mainPath);
            if (mainXml === null) {
                return {
                    reason: 'The file is damaged: its main part is missing.',
                };
            }
            const colored = setWordPageColorXml(mainXml, color);
            if (typeof colored !== 'string') {
                return { reason: colored.reason };
            }
            parts.set(document.mainPath, colored);
            const settingsPath = resolvePartPath(
                document.mainPath,
                'settings.xml',
            );
            const settingsXml = await readPart(settingsPath);
            if (settingsXml !== null) {
                parts.set(
                    settingsPath,
                    setWordDisplayBackgroundXml(settingsXml, color !== null),
                );
            }
            changed.push(
                color === null
                    ? 'The page has no colour of its own now: white.'
                    : `The page is ${toOfficeColorWords(color)} now.`,
            );
        }
        return { parts, changed };
    }

    // 3. speaker notes, a slide's background and whether it is shown,
    // then 4. slides moved, copied or taken out
    const extraParts: string[] = [];
    const contentTypesRead = await readPart('[Content_Types].xml');
    if (contentTypesRead === null) {
        return { reason: 'The file is damaged: its list of parts is missing.' };
    }
    let contentTypes = contentTypesRead;
    const allNames = () => {
        return [
            ...pkg.names.filter((name) => {
                return parts.get(name) !== null;
            }),
            ...extraParts,
        ];
    };
    const nextPartNumber = (folder: string, base: string) => {
        const pattern = new RegExp(`^${folder}/${base}(\\d+)\\.xml$`);
        return (
            allNames().reduce((max, name) => {
                const number = pattern.exec(name)?.[1];
                return number === undefined
                    ? max
                    : Math.max(max, Number(number));
            }, 0) + 1
        );
    };
    // A deck no one ever wrote a note in has no notes page layout: the one
    // the app's own export writes is given to it, with a theme of its own.
    const ensureNotesMaster = async () => {
        if (document.notesMasterPath !== null) {
            return document.notesMasterPath;
        }
        const mainRelsPath = toRelsPath(document.mainPath);
        const mainXml = await readPart(document.mainPath);
        const mainRelsXml = await readPart(mainRelsPath);
        if (
            mainXml === null ||
            mainRelsXml === null ||
            !/<\/p:sldMasterIdLst>/.test(mainXml)
        ) {
            return { reason: 'The deck has no notes page to write in.' };
        }
        const masterPath = `ppt/notesMasters/notesMaster${nextPartNumber(
            'ppt/notesMasters',
            'notesMaster',
        )}.xml`;
        const themePath = `ppt/theme/theme${nextPartNumber(
            'ppt/theme',
            'theme',
        )}.xml`;
        extraParts.push(masterPath, toRelsPath(masterPath), themePath);
        parts.set(masterPath, genNotesMasterXml());
        parts.set(
            toRelsPath(masterPath),
            genRelsXml([
                genRelXml(
                    'rId1',
                    `${REL_TYPE_BASE}theme`,
                    toRelativeTarget(masterPath, themePath),
                ),
            ]),
        );
        parts.set(themePath, genThemeXml('Notes'));
        contentTypes = addContentTypeOverride(
            addContentTypeOverride(
                contentTypes,
                masterPath,
                NOTES_MASTER_CONTENT_TYPE,
            ),
            themePath,
            THEME_CONTENT_TYPE,
        );
        const relId = nextRelId(parseRels(mainRelsXml));
        parts.set(
            mainRelsPath,
            addRelToXml(
                mainRelsXml,
                genRelXml(
                    relId,
                    `${REL_TYPE_BASE}notesMaster`,
                    toRelativeTarget(document.mainPath, masterPath),
                ),
            ),
        );
        parts.set(
            document.mainPath,
            mainXml.replace(
                /<\/p:sldMasterIdLst>/,
                '</p:sldMasterIdLst><p:notesMasterIdLst>' +
                    `<p:notesMasterId r:id="${relId}"/></p:notesMasterIdLst>`,
            ),
        );
        document.notesMasterPath = masterPath;
        return masterPath;
    };
    for (const change of changes) {
        if (change.note === undefined) {
            continue;
        }
        const slide = slideByNumber(change.slide);
        if (slide === null) {
            return noSuchSlide(change.slide);
        }
        const note = toWrittenText(String(change.note));
        if (slide.notesPath !== null) {
            const xml = await readPart(slide.notesPath);
            const noteParagraphs = xml === null ? [] : findNoteParagraphs(xml);
            if (xml === null || noteParagraphs.length === 0) {
                return {
                    reason:
                        `Slide ${slide.number}'s notes page has no notes box ` +
                        'to write in; add a note to it in PowerPoint once.',
                };
            }
            const template = noteParagraphs[0].xml;
            const written = note.split('\n').map((line) => {
                return rebuildParagraph(template, line, 'pptx', true);
            });
            if (
                written.some((one) => {
                    return one === null;
                })
            ) {
                return {
                    reason: 'The notes could not be read to change them.',
                };
            }
            parts.set(
                slide.notesPath,
                xml.slice(0, noteParagraphs[0].start) +
                    written.join('') +
                    xml.slice(noteParagraphs[noteParagraphs.length - 1].end),
            );
        } else if (note !== '') {
            const notesMasterPath = await ensureNotesMaster();
            if (typeof notesMasterPath !== 'string') {
                return notesMasterPath;
            }
            const notesPath = `ppt/notesSlides/notesSlide${nextPartNumber(
                'ppt/notesSlides',
                'notesSlide',
            )}.xml`;
            extraParts.push(notesPath);
            parts.set(notesPath, genNotesSlideXml(note));
            parts.set(
                toRelsPath(notesPath),
                genRelsXml([
                    genRelXml(
                        'rId1',
                        `${REL_TYPE_BASE}notesMaster`,
                        toRelativeTarget(notesPath, notesMasterPath),
                    ),
                    genRelXml(
                        'rId2',
                        `${REL_TYPE_BASE}slide`,
                        toRelativeTarget(notesPath, slide.partPath),
                    ),
                ]),
            );
            const slideRelsXml = await readPart(slide.relsPath);
            parts.set(
                slide.relsPath,
                addRelToXml(
                    slideRelsXml,
                    genRelXml(
                        nextRelId(parseRels(slideRelsXml ?? '')),
                        `${REL_TYPE_BASE}notesSlide`,
                        toRelativeTarget(slide.partPath, notesPath),
                    ),
                ),
            );
            contentTypes = addContentTypeOverride(
                contentTypes,
                notesPath,
                NOTES_SLIDE_CONTENT_TYPE,
            );
            slide.notesPath = notesPath;
        }
        changed.push(
            note === ''
                ? `Slide ${slide.number}'s speaker notes were emptied.`
                : `Slide ${slide.number}'s speaker notes now read ${quote(note)}.`,
        );
    }

    // boxes taken out first, so a background asked for in the same call
    // is judged on the slide as it will be
    for (const change of changes) {
        if (change.removeBox === undefined) {
            continue;
        }
        const name = String(change.removeBox).trim();
        let slides = document.slides;
        if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        const takenFrom: number[] = [];
        let lastReason = '';
        for (const slide of slides) {
            const xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            // every box going (a group's own boxes with it) takes its
            // timing along: an animation, a video's play step or a build
            // left naming a box no longer there is a repair PowerPoint asks
            // for. Matched as `removeSlideBoxXml` matches: by name, else
            // by name in any case.
            const boxList = listSlideBoxes(xml);
            const exactList = boxList.filter((box) => {
                return box.name === name.trim();
            });
            const goneIds = (
                exactList.length > 0
                    ? exactList
                    : boxList.filter((box) => {
                          return (
                              box.name.toLowerCase() ===
                              name.trim().toLowerCase()
                          );
                      })
            ).flatMap((box) => {
                return [
                    ...xml
                        .slice(box.start, box.end)
                        .matchAll(/<p:cNvPr\b[^>]*?\sid="(\d+)"/g),
                ].map((matched) => {
                    return matched[1];
                });
            });
            const removed = removeSlideBoxXml(xml, name);
            if ('reason' in removed) {
                lastReason = removed.reason;
                continue;
            }
            let removedXml = removed.xml;
            for (const id of new Set(goneIds)) {
                removedXml =
                    dropMediaTimingXml(removedXml, id, true) ?? removedXml;
            }
            parts.set(slide.partPath, removedXml);
            takenFrom.push(slide.number);
        }
        if (takenFrom.length === 0) {
            return {
                reason:
                    change.slide === undefined
                        ? `No slide has a box "${name}". Name a box as read.`
                        : `Slide ${String(change.slide)}: ${lastReason}`,
            };
        }
        changed.push(
            takenFrom.length === 1
                ? `Took "${name}" off slide ${takenFrom[0]}.`
                : `Took "${name}" off ${takenFrom.length} slides ` +
                      `(${toSlideRangeText(takenFrom)}).`,
        );
    }
    // a SmartArt turned into the shapes it is drawn with: the slide's own
    // boxes from here on, which every box change reaches (2026-11-21)
    for (const change of changes) {
        if (change.toShapes !== true) {
            continue;
        }
        const found = findBoxTargets(String(change.box), change.slide);
        if ('reason' in found) {
            return found;
        }
        for (const { slide, boxes } of found) {
            const smartArt = boxes.find((box) => {
                return box.kind === 'smartart';
            });
            if (smartArt === undefined) {
                return {
                    reason:
                        `"${boxes[0].name}" on slide ${slide.number} is ` +
                        `${boxes[0].kind === 'text' ? 'a box of words' : `a ${boxes[0].kind}`}, ` +
                        'no SmartArt: it is changed as it is.',
                };
            }
            const xml = await readPart(slide.partPath);
            const drawingXml =
                smartArt.smartArt?.drawingPath === undefined ||
                smartArt.smartArt.drawingPath === null
                    ? null
                    : await readPart(smartArt.smartArt.drawingPath);
            const frame =
                xml === null
                    ? undefined
                    : listSlideBoxes(xml).find((box) => {
                          return !box.isGrouped && box.name === smartArt.name;
                      });
            if (xml === null || frame === undefined) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            // the place asked for to lay it out in, else its own
            const area =
                change.at === undefined
                    ? undefined
                    : toBoxPlace(
                          change.at,
                          document.slideSize,
                          findBoxPlace(
                              xml.slice(frame.start, frame.end),
                              null,
                              null,
                          ),
                      );
            if (area !== undefined && 'reason' in area) {
                return area;
            }
            const converted =
                drawingXml === null
                    ? {
                          reason:
                              'PowerPoint kept no drawing of it in the ' +
                              'file: PowerPoint turns it into shapes ' +
                              '(SmartArt → Convert → Convert to Shapes).',
                      }
                    : convertSmartArtToShapesXml(
                          xml,
                          { ...frame, name: smartArt.name },
                          drawingXml,
                          slide.boxes.map((box) => {
                              return box.name;
                          }),
                          change.arrange === undefined
                              ? undefined
                              : {
                                    arrange: change.arrange,
                                    area,
                                    slideSize: document.slideSize,
                                },
                      );
            if ('reason' in converted) {
                return {
                    reason:
                        `The SmartArt "${smartArt.name}" on slide ` +
                        `${slide.number}: ${converted.reason}`,
                };
            }
            // its boxes -- the shapes holding its words -- in the look asked
            const shapesLook = toShapesLookMap.get(change);
            let lookText = '';
            if (shapesLook !== undefined) {
                for (const shape of converted.shapes) {
                    if (shape.words === '') {
                        continue;
                    }
                    const box = listSlideBoxes(converted.xml).find((one) => {
                        return !one.isGrouped && one.name === shape.name;
                    });
                    if (box === undefined) {
                        continue;
                    }
                    const styled = applyBoxLookXml(
                        converted.xml.slice(box.start, box.end),
                        shapesLook,
                        box.kind,
                    );
                    if ('reason' in styled) {
                        return {
                            reason: `"${shape.name}" on slide ${slide.number}: ${styled.reason}`,
                        };
                    }
                    converted.xml =
                        converted.xml.slice(0, box.start) +
                        styled.xml +
                        converted.xml.slice(box.end);
                }
                lookText =
                    ' Its boxes with words are now ' +
                    `${describeOfficeBoxLook(shapesLook)}.`;
            }
            // an animation of the SmartArt names a frame no longer there
            const frameXml = xml.slice(frame.start, frame.end);
            const frameId = /<p:cNvPr\b[^>]*?\sid="(\d+)"/.exec(frameXml)?.[1];
            parts.set(
                slide.partPath,
                frameId === undefined
                    ? converted.xml
                    : (dropMediaTimingXml(converted.xml, frameId, true) ??
                          converted.xml),
            );
            changed.push(
                `The SmartArt "${smartArt.name}" on slide ${slide.number} ` +
                    "is now shapes of the slide, as PowerPoint's Convert " +
                    'to Shapes makes it' +
                    (change.arrange === undefined
                        ? ''
                        : `, laid out ${ARRANGE_TEXT_MAP[change.arrange].text}` +
                          (converted.shapes.some((shape) => {
                              return shape.words === '';
                          })
                              ? ARRANGE_TEXT_MAP[change.arrange].arrows
                              : '') +
                          toLaidPlaceText(
                              converted.laidIn ?? null,
                              document.slideSize,
                          )) +
                    `: ${describeSmartArtShapes(converted.shapes)}. ` +
                    'Its words and look stay; it no longer lays itself out ' +
                    'as a SmartArt.' +
                    (lookText === ''
                        ? ' Now make the change they asked for on these ' +
                          'shapes, by their names, in the next call -- not ' +
                          'asked again.'
                        : lookText),
            );
        }
    }
    // a SmartArt's frame on its slide and the parts it names
    const readSmartArtFrame = async (
        slide: OfficeSlideType,
        smartArtName: string,
    ) => {
        const xml = await readPart(slide.partPath);
        const relsXml = await readPart(slide.relsPath);
        const frame =
            xml === null
                ? undefined
                : listSlideBoxes(xml).find((box) => {
                      return !box.isGrouped && box.name === smartArtName;
                  });
        if (xml === null || relsXml === null || frame === undefined) {
            return null;
        }
        const frameXml = xml.slice(frame.start, frame.end);
        const rels = parseRels(relsXml);
        const toPartPath = (attribute: string) => {
            const id = new RegExp(
                `<dgm:relIds\\b[^>]*?\\sr:${attribute}="([^"]+)"`,
            ).exec(frameXml)?.[1];
            const rel = rels.find((one) => {
                return one.id === id;
            });
            return rel === undefined
                ? null
                : resolvePartPath(slide.partPath, rel.target);
        };
        return {
            layoutPath: toPartPath('lo'),
            colorsPath: toPartPath('cs'),
            stylePath: toPartPath('qs'),
        };
    };
    // a SmartArt's drawing dropped after its shapes were written again from
    // its definition, as in a deck PowerPoint 2007 saved: PowerPoint and
    // LibreOffice lay it out again (EC-787)
    const dropSmartArtDrawing = async (
        slide: OfficeSlideType,
        dataXmlBefore: string,
        drawingPath: string | null,
    ) => {
        if (drawingPath === null) {
            return;
        }
        const relId = /<dsp:dataModelExt\b[^>]*?\srelId="([^"]+)"/.exec(
            dataXmlBefore,
        )?.[1];
        const relsXml = await readPart(slide.relsPath);
        if (relId !== undefined && relsXml !== null) {
            parts.set(
                slide.relsPath,
                relsXml.replace(/<Relationship\b[^>]*?\/>/g, (tag) => {
                    return readAttribute(tag, 'Id') === relId ? '' : tag;
                }),
            );
        }
        if (allNames().includes(drawingPath)) {
            parts.set(drawingPath, null);
        }
        contentTypes = removeContentTypeOverride(contentTypes, drawingPath);
    };
    // the SmartArt of the deck whose layout is the one asked for by its id
    const findDeckSmartArtLayout = async (asked: string) => {
        const wanted = asked.trim().toLowerCase();
        const seen = new Set<string>();
        for (const slide of document.slides) {
            for (const box of slide.boxes) {
                if (box.smartArt === undefined) {
                    continue;
                }
                const frame = await readSmartArtFrame(slide, box.name);
                if (frame?.layoutPath == null) {
                    continue;
                }
                const layoutXml = await readPart(frame.layoutPath);
                const dataXml = await readPart(box.smartArt.dataPath);
                const id =
                    layoutXml === null ? null : readSmartArtLayoutId(layoutXml);
                if (id !== null) {
                    seen.add(id);
                }
                if (
                    layoutXml === null ||
                    dataXml === null ||
                    id?.toLowerCase() !== wanted
                ) {
                    continue;
                }
                return {
                    id,
                    slide,
                    name: box.name,
                    dataXml,
                    layoutXml,
                    colorsXml:
                        frame.colorsPath === null
                            ? null
                            : await readPart(frame.colorsPath),
                    styleXml:
                        frame.stylePath === null
                            ? null
                            : await readPart(frame.stylePath),
                };
            }
        }
        return {
            reason:
                `no SmartArt of this deck has the layout "${asked}"` +
                (seen.size === 0
                    ? ''
                    : ` (theirs: ${[...seen]
                          .map((id) => {
                              return `"${id}"`;
                          })
                          .join(', ')})`) +
                `. Here it is ${SMARTART_LAYOUT_CHOICES_TEXT} or one of ` +
                "theirs; any other is PowerPoint's (SmartArt Design → " +
                'Layouts). A column of plain shapes is {slide, box, ' +
                'toShapes: true, arrange: "column"}, after which it is no ' +
                'longer a SmartArt (ask first).',
        };
    };
    // a SmartArt given another of PowerPoint's layouts, kept a SmartArt:
    // its data, definition and drawing written again (2026-11-21, EC-784)
    for (const change of changes) {
        if (change.smartArtLayout === undefined) {
            continue;
        }
        const asked = change.smartArtLayout.trim();
        const layout =
            SMARTART_LAYOUT_LIST.find((one) => {
                return one === asked.toLowerCase();
            }) ?? null;
        const found = findBoxTargets(String(change.box), change.slide);
        if ('reason' in found) {
            return found;
        }
        for (const { slide, boxes } of found) {
            const smartArt = boxes.find((box) => {
                return box.kind === 'smartart';
            });
            if (smartArt?.smartArt === undefined) {
                return {
                    reason:
                        `"${boxes[0].name}" on slide ${slide.number} is ` +
                        `${boxes[0].kind === 'text' ? 'a box of words' : `a ${boxes[0].kind}`}, ` +
                        'no SmartArt: only a SmartArt takes a SmartArt layout.',
                };
            }
            const xml = await readPart(slide.partPath);
            const relsXml = await readPart(slide.relsPath);
            const frame =
                xml === null
                    ? undefined
                    : listSlideBoxes(xml).find((box) => {
                          return !box.isGrouped && box.name === smartArt.name;
                      });
            if (xml === null || relsXml === null || frame === undefined) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            const frameXml = xml.slice(frame.start, frame.end);
            const rels = parseRels(relsXml);
            const toPartPath = (attribute: string) => {
                const id = new RegExp(
                    `<dgm:relIds\\b[^>]*?\\sr:${attribute}="([^"]+)"`,
                ).exec(frameXml)?.[1];
                const rel = rels.find((one) => {
                    return one.id === id;
                });
                return rel === undefined
                    ? null
                    : resolvePartPath(slide.partPath, rel.target);
            };
            const layoutPath = toPartPath('lo');
            const colorsPath = toPartPath('cs');
            const stylePath = toPartPath('qs');
            const { dataPath, drawingPath } = smartArt.smartArt;
            const dataXml = await readPart(dataPath);
            const current = findBoxPlace(frameXml, null, null);
            if (layoutPath === null || dataXml === null || current === null) {
                return {
                    reason:
                        `The SmartArt "${smartArt.name}" on slide ` +
                        `${slide.number} could not be read to change it.`,
                };
            }
            // the layout another SmartArt of the deck has (EC-787)
            if (layout === null) {
                const source = await findDeckSmartArtLayout(asked);
                if (source.reason !== undefined) {
                    return {
                        reason:
                            `The SmartArt "${smartArt.name}" on slide ` +
                            `${slide.number}: ${source.reason}`,
                    };
                }
                const result = changeSmartArtLayoutFromXml(dataXml, source);
                if ('reason' in result) {
                    return {
                        reason:
                            `The SmartArt "${smartArt.name}" on slide ` +
                            `${slide.number}: ${result.reason}`,
                    };
                }
                parts.set(dataPath, removeSmartArtDrawingLink(result.dataXml));
                parts.set(layoutPath, source.layoutXml);
                if (colorsPath !== null) {
                    const colorsXml = copyMissingStyleLabels(
                        await readPart(colorsPath),
                        source.colorsXml,
                        '</dgm:colorsDef>',
                        result.labelList,
                    );
                    if (colorsXml !== null) {
                        parts.set(colorsPath, colorsXml);
                    }
                }
                if (stylePath !== null) {
                    const styleXml = copyMissingStyleLabels(
                        await readPart(stylePath),
                        source.styleXml,
                        '</dgm:styleDef>',
                        result.labelList,
                    );
                    if (styleXml !== null) {
                        parts.set(stylePath, styleXml);
                    }
                }
                await dropSmartArtDrawing(slide, dataXml, drawingPath);
                changed.push(
                    `The SmartArt "${smartArt.name}" on slide ${slide.number} ` +
                        `has the layout "${source.id}" of "${source.name}" ` +
                        `on slide ${source.slide.number} now, still a ` +
                        `SmartArt: ${describeSmartArtBoxWords(
                            listSmartArtBoxWords(result.dataXml),
                        )}. PowerPoint and this app lay it out again from ` +
                        'that layout as they open it; its words stay.',
                );
                continue;
            }
            // its place: the one asked for, else its own -- a flat one
            // grown for a cycle or a pyramid
            let area = toSmartArtLayoutRoom(
                layout,
                current,
                document.slideSize,
            );
            if (change.at !== undefined) {
                const asked = toBoxPlace(
                    change.at,
                    document.slideSize,
                    current,
                );
                if ('reason' in asked) {
                    return asked;
                }
                area = asked;
            }
            const result = changeSmartArtLayoutXml(
                {
                    dataXml,
                    drawingXml:
                        drawingPath === null
                            ? null
                            : await readPart(drawingPath),
                    colorsXml:
                        colorsPath === null ? null : await readPart(colorsPath),
                    styleXml:
                        stylePath === null ? null : await readPart(stylePath),
                },
                layout,
                { cx: area.cx, cy: area.cy },
            );
            if ('reason' in result) {
                return {
                    reason:
                        `The SmartArt "${smartArt.name}" on slide ` +
                        `${slide.number}: ${result.reason}`,
                };
            }
            const isMoved =
                area.x !== current.x ||
                area.y !== current.y ||
                area.cx !== current.cx ||
                area.cy !== current.cy;
            if (isMoved) {
                const moved = setBoxPlaceXml(frameXml, area);
                if (moved === null) {
                    return {
                        reason:
                            `The SmartArt "${smartArt.name}" on slide ` +
                            `${slide.number} cannot be moved here.`,
                    };
                }
                parts.set(
                    slide.partPath,
                    xml.slice(0, frame.start) + moved + xml.slice(frame.end),
                );
            }
            parts.set(dataPath, result.dataXml);
            parts.set(layoutPath, result.layoutXml);
            if (colorsPath !== null && result.colorsXml !== null) {
                parts.set(colorsPath, result.colorsXml);
            }
            if (stylePath !== null && result.styleXml !== null) {
                parts.set(stylePath, result.styleXml);
            }
            if (drawingPath !== null && result.drawingXml !== null) {
                parts.set(drawingPath, result.drawingXml);
            }
            changed.push(
                `The SmartArt "${smartArt.name}" on slide ${slide.number} ` +
                    `has ${describeSmartArtLayout(layout)} as its layout ` +
                    'now, and is still a SmartArt' +
                    (isMoved ? toLaidPlaceText(area, document.slideSize) : '') +
                    `: ${result.words
                        .map((words) => {
                            return quote(words);
                        })
                        .join(', ')}. PowerPoint lays it out again its own ` +
                    'way as it opens it; its words and the colours of ' +
                    'its boxes stay.',
            );
        }
    }
    // a SmartArt's box added, taken out or moved, in any of its layouts:
    // its shapes drawn again from its own definition (2026-11-21, EC-787)
    for (const change of changes) {
        const editKey = (
            ['smartArtAdd', 'smartArtRemove', 'smartArtMove'] as const
        ).find((key) => {
            return change[key] !== undefined;
        });
        if (editKey === undefined) {
            continue;
        }
        const found = findBoxTargets(String(change.box), change.slide);
        if ('reason' in found) {
            return found;
        }
        const placeKey = (['afterBox', 'beforeBox', 'underBox'] as const).find(
            (key) => {
                return change[key] !== undefined;
            },
        );
        const place =
            placeKey === undefined
                ? null
                : (
                      {
                          afterBox: 'after',
                          beforeBox: 'before',
                          underBox: 'under',
                      } as const
                  )[placeKey];
        const target = placeKey === undefined ? null : String(change[placeKey]);
        const words = String(change[editKey]);
        const edit: SmartArtBoxEditType =
            editKey === 'smartArtAdd'
                ? { kind: 'add', words, place, target }
                : editKey === 'smartArtRemove'
                  ? { kind: 'remove', words }
                  : {
                        kind: 'move',
                        words,
                        place: place ?? 'after',
                        target: target ?? '',
                    };
        for (const { slide, boxes } of found) {
            const smartArt = boxes.find((box) => {
                return box.kind === 'smartart';
            });
            if (smartArt?.smartArt === undefined) {
                return {
                    reason:
                        `"${boxes[0].name}" on slide ${slide.number} is no ` +
                        'SmartArt: a box of a slide is added with ' +
                        '{slide, textBox} and taken out with {slide, removeBox}.',
                };
            }
            const { dataPath, drawingPath } = smartArt.smartArt;
            const frame = await readSmartArtFrame(slide, smartArt.name);
            const dataXml = await readPart(dataPath);
            const layoutXml =
                frame?.layoutPath == null
                    ? null
                    : await readPart(frame.layoutPath);
            if (dataXml === null || layoutXml === null) {
                return {
                    reason:
                        `The SmartArt "${smartArt.name}" on slide ` +
                        `${slide.number} could not be read to change it.`,
                };
            }
            const result = editSmartArtBoxesXml(dataXml, layoutXml, edit);
            if ('reason' in result) {
                return {
                    reason:
                        `The SmartArt "${smartArt.name}" on slide ` +
                        `${slide.number}: ${result.reason}`,
                };
            }
            parts.set(dataPath, removeSmartArtDrawingLink(result.dataXml));
            await dropSmartArtDrawing(slide, dataXml, drawingPath);
            const placeText =
                place === null
                    ? ''
                    : ` ${place === 'under' ? 'under' : place} ${JSON.stringify(target)}`;
            changed.push(
                `The SmartArt "${smartArt.name}" on slide ${slide.number}: ` +
                    (edit.kind === 'add'
                        ? `added ${JSON.stringify(words)}${placeText === '' ? ' at its end' : placeText}`
                        : edit.kind === 'remove'
                          ? `took out ${JSON.stringify(words)}` +
                            (result.takenWith.length === 0
                                ? ''
                                : ' and the words drawn inside it, ' +
                                  result.takenWith
                                      .map((one) => {
                                          return JSON.stringify(one);
                                      })
                                      .join(', '))
                          : `moved ${JSON.stringify(words)}${placeText}`) +
                    `. Its boxes now: ${describeSmartArtBoxWords(result.boxes)}. ` +
                    'Still a SmartArt in its own layout: PowerPoint and this ' +
                    'app lay it out again as they open it.',
            );
        }
    }
    // A background behind a picture that fills the slide shows nowhere:
    // said, never claimed as seen (the user's hymn deck, a curtain picture
    // on every slide). Layouts and masters are read once a call.
    const findCover = async (slide: OfficeSlideType, slideXml: string) => {
        const { layoutXml, masterXml } = await shared.layoutOf(
            slide.layoutPath,
        );
        return findCoveringPicture(
            slideXml,
            document.slideSize,
            layoutXml,
            masterXml,
        );
    };
    for (const change of changes) {
        const background = backgroundMap.get(change);
        if (background === undefined && change.hidden === undefined) {
            continue;
        }
        let slides = document.slides;
        if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        // a covering picture's name (and where it is) to the slides it covers
        const coveredMap = new Map<string, number[]>();
        for (const slide of slides) {
            let xml = await readPart(slide.partPath);
            if (background !== undefined && xml !== null) {
                xml = setSlideBackgroundXml(xml, background);
            }
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            if (change.hidden !== undefined) {
                xml = setSlideHiddenXml(xml, change.hidden);
            }
            parts.set(slide.partPath, xml);
            if (background !== undefined && background !== null) {
                const cover = await findCover(slide, xml);
                if (cover !== null) {
                    // the master or layout holding it, as `slide` names it
                    const sharedList = document.shared ?? [];
                    const masters = sharedList.filter((one) => {
                        return one.sharedSlideNumbers === undefined;
                    });
                    const holder =
                        cover.where === ' on its layout'
                            ? sharedList.find((one) => {
                                  return (
                                      one.sharedSlideNumbers?.includes(
                                          slide.number,
                                      ) === true
                                  );
                              })
                            : cover.where === ' on its master' &&
                                masters.length === 1
                              ? masters[0]
                              : undefined;
                    const key = JSON.stringify([
                        cover.name,
                        cover.where,
                        holder?.sharedValue ?? null,
                    ]);
                    coveredMap.set(key, [
                        ...(coveredMap.get(key) ?? []),
                        slide.number,
                    ]);
                }
            }
        }
        const whose =
            change.slide === undefined
                ? "Every slide's"
                : `Slide ${slides[0].number}'s`;
        if (background !== undefined) {
            changed.push(
                background === null
                    ? `${whose} background is its layout's again.`
                    : `${whose} background is now ${toOfficeFillWords(background)}.`,
            );
        }
        if (coveredMap.size > 0) {
            changed.push(genCoveredBackgroundWords(coveredMap));
        }
        if (change.hidden !== undefined) {
            changed.push(
                change.hidden
                    ? `Slide ${slides[0].number} is hidden in the show now.`
                    : `Slide ${slides[0].number} is shown in the show again.`,
            );
        }
    }

    // boxes moved and sized
    for (const change of changes) {
        if (
            change.at === undefined ||
            change.box === undefined ||
            change.toShapes !== undefined ||
            change.smartArtLayout !== undefined
        ) {
            continue;
        }
        const found = findBoxTargets(change.box, change.slide);
        if ('reason' in found) {
            return found;
        }
        const placed: PlacedType[] = [];
        for (const { slide, boxes } of found) {
            let xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            const { layoutXml, masterXml } = await shared.layoutOf(
                slide.layoutPath,
            );
            const names = new Set(
                boxes.map((box) => {
                    return box.name;
                }),
            );
            const targets = [...names]
                .flatMap((name) => {
                    return findNamedBoxes(xml as string, name);
                })
                .sort((a, b) => {
                    return b.start - a.start;
                });
            for (const target of targets) {
                const boxXml = xml.slice(target.start, target.end);
                const current = findBoxPlace(boxXml, layoutXml, masterXml);
                const place = toBoxPlace(
                    change.at,
                    document.slideSize,
                    current,
                );
                if ('reason' in place) {
                    return place;
                }
                const moved = setBoxPlaceXml(boxXml, place);
                if (moved === null) {
                    return {
                        reason:
                            `"${target.name}" on slide ${slide.number} ` +
                            'cannot be moved here.',
                    };
                }
                xml =
                    xml.slice(0, target.start) + moved + xml.slice(target.end);
                placed.push({
                    number: slide.number,
                    at: toPercentPlace(place, document.slideSize),
                    wasAt:
                        current === null
                            ? null
                            : toPercentPlace(current, document.slideSize),
                });
            }
            parts.set(slide.partPath, xml);
        }
        changed.push(genPlacedWords(found[0].boxes[0].name, placed));
    }
    // pictures put on slides, or in the place of a picture there
    const mediaPathMap = new Map<string, string>();
    for (const change of changes) {
        if (typeof change.picture !== 'string') {
            continue;
        }
        const bytes = pictures.get(change.picture) as Uint8Array;
        const info = readPictureInfo(bytes) as OfficePictureInfoType;
        const pictureName = toPictureName(change.picture);
        // the picture's bytes go in once, however many slides show it
        let mediaPath = mediaPathMap.get(change.picture);
        if (mediaPath === undefined) {
            mediaPath = genFreeMediaPath(
                [...pkg.names, ...parts.keys()],
                info.extension,
            );
            parts.set(mediaPath, bytes);
            mediaPathMap.set(change.picture, mediaPath);
            const types = await readPart(CONTENT_TYPES_PATH);
            if (types === null) {
                return { reason: 'The deck says no content types.' };
            }
            parts.set(
                CONTENT_TYPES_PATH,
                addContentTypeDefault(types, info.extension, info.contentType),
            );
        }
        const relateTo = async (slidePath: string) => {
            const relsPath = toRelsPath(slidePath);
            const relsXml = await readPart(relsPath);
            const rels = parseRels(relsXml ?? '');
            const known = rels.find((rel) => {
                return (
                    checkIsRelType(rel, 'image') &&
                    !rel.isExternal &&
                    resolvePartPath(slidePath, rel.target) === mediaPath
                );
            });
            if (known !== undefined) {
                return known.id;
            }
            const relId = nextRelId(rels);
            parts.set(
                relsPath,
                addRelToXml(
                    relsXml,
                    genRelXml(
                        relId,
                        `${REL_TYPE_BASE}image`,
                        toRelativeTarget(slidePath, mediaPath as string),
                    ),
                ),
            );
            return relId;
        };
        // the media part a box draws, by the slide's own relationships
        const readBoxMediaPath = async (slidePath: string, boxXml: string) => {
            const relId = readBoxPictureRelId(boxXml);
            if (relId === null) {
                return null;
            }
            const rel = parseRels(
                (await readPart(toRelsPath(slidePath))) ?? '',
            ).find((one) => {
                return one.id === relId && !one.isExternal;
            });
            return rel === undefined
                ? null
                : resolvePartPath(slidePath, rel.target);
        };
        if (change.box !== undefined) {
            const found = findBoxTargets(change.box, change.slide);
            if ('reason' in found) {
                return found;
            }
            const numbers: number[] = [];
            // what the replaced boxes drew, to find it again under another
            // name: the hymn deck's curtain is "Picture 2" on slide 1 and
            // "Picture 3" on the rest, and _use my picture instead of the
            // curtain_ had left slide 1's
            const replacedMedia = new Set<string>();
            const replacedBoxes = new Set<string>();
            for (const { slide, boxes } of found) {
                let xml = await readPart(slide.partPath);
                if (xml === null) {
                    return {
                        reason: `Slide ${slide.number} could not be read to change it.`,
                    };
                }
                const relId = await relateTo(slide.partPath);
                const { layoutXml, masterXml } = await shared.layoutOf(
                    slide.layoutPath,
                );
                const targets = [
                    ...new Set(
                        boxes.map((box) => {
                            return box.name;
                        }),
                    ),
                ]
                    .flatMap((name) => {
                        return findNamedBoxes(xml as string, name);
                    })
                    .sort((a, b) => {
                        return b.start - a.start;
                    });
                for (const target of targets) {
                    const boxXml = xml.slice(target.start, target.end);
                    const drawn = await readBoxMediaPath(
                        slide.partPath,
                        boxXml,
                    );
                    if (drawn !== null && drawn !== mediaPath) {
                        replacedMedia.add(drawn);
                    }
                    replacedBoxes.add(`${slide.number}/${target.name}`);
                    const place = findBoxPlace(boxXml, layoutXml, masterXml);
                    const next = setBoxPictureXml(
                        boxXml,
                        relId,
                        place === null ? '' : genPictureCropXml(info, place),
                    );
                    if (next === null) {
                        return {
                            reason:
                                `"${target.name}" on slide ${slide.number} ` +
                                'draws no picture to put one in the place ' +
                                'of: put the picture on the slide (`picture` ' +
                                'with `at`, no `box`).',
                        };
                    }
                    xml =
                        xml.slice(0, target.start) +
                        next +
                        xml.slice(target.end);
                }
                parts.set(slide.partPath, xml);
                numbers.push(slide.number);
            }
            // the same picture still drawn by a box of another name
            const alsoDrawn: { number: number; name: string }[] = [];
            const allSlides = document.kind === 'pptx' ? document.slides : [];
            for (const slide of replacedMedia.size === 0 ? [] : allSlides) {
                const xml = await readPart(slide.partPath);
                if (xml === null) {
                    continue;
                }
                for (const box of listSlideBoxes(xml, document.slideSize)) {
                    if (
                        box.kind !== 'picture' ||
                        replacedBoxes.has(`${slide.number}/${box.name}`)
                    ) {
                        continue;
                    }
                    const drawn = await readBoxMediaPath(
                        slide.partPath,
                        xml.slice(box.start, box.end),
                    );
                    if (drawn !== null && replacedMedia.has(drawn)) {
                        alsoDrawn.push({
                            number: slide.number,
                            name: box.name,
                        });
                    }
                }
            }
            changed.push(
                `Put ${quote(pictureName)} in the place of ` +
                    `"${found[0].boxes[0].name}" on ` +
                    (numbers.length === 1
                        ? `slide ${numbers[0]}`
                        : `${numbers.length} slides (${toSlideRangeText(numbers)})`) +
                    ': the same place and size, cropped to its shape, never ' +
                    'squeezed.' +
                    (alsoDrawn.length === 0
                        ? ''
                        : ' The picture it replaced is still drawn by ' +
                          alsoDrawn
                              .slice(0, 5)
                              .map((one) => {
                                  return `"${one.name}" on slide ${one.number}`;
                              })
                              .join(', ') +
                          (alsoDrawn.length > 5
                              ? ` and ${alsoDrawn.length - 5} more`
                              : '') +
                          ', left as it was: when they asked for it ' +
                          'everywhere, put it there too in this answer ' +
                          `({slide: ${alsoDrawn[0].number}, box: ` +
                          `${JSON.stringify(alsoDrawn[0].name)}, picture}).`),
            );
            continue;
        }
        let slides = document.kind === 'pptx' ? document.slides : [];
        if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        const place = toPicturePlace(change.at, info, document.slideSize);
        if ('reason' in place) {
            return place;
        }
        const isBehind = checkIsFillingPlace(place, document.slideSize);
        // a picture behind the words is hidden by one filling the slide
        // already: that one is replaced instead
        const covering = isBehind
            ? slides.flatMap((slide) => {
                  return slide.boxes
                      .filter((box) => {
                          return box.kind === 'picture' && box.isFilling;
                      })
                      .map((box) => {
                          return { number: slide.number, name: box.name };
                      });
              })
            : [];
        if (covering.length > 0) {
            const name = covering[0].name;
            return {
                reason:
                    `A picture filling the slide goes behind the words, and ` +
                    `"${name}" already fills slide ${covering[0].number} ` +
                    "there, so it would not show. Put it in that picture's " +
                    `place: {box: ${JSON.stringify(name)}, picture}` +
                    (change.slide === undefined
                        ? ' with no slide (every slide that has it).'
                        : ', with the slide.'),
            };
        }
        const cropXml = genPictureCropXml(info, place);
        const added: { number: number; name: string }[] = [];
        for (const slide of slides) {
            const xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            const relId = await relateTo(slide.partPath);
            const next = addSlidePictureXml(
                xml,
                relId,
                place,
                cropXml,
                isBehind,
                pictureName,
            );
            if (next === null) {
                return {
                    reason: `Slide ${slide.number} has no place for a picture.`,
                };
            }
            parts.set(slide.partPath, next.xml);
            added.push({ number: slide.number, name: next.name });
            newBoxMap.set(change, added);
        }
        const numbers = added.map((one) => {
            return one.number;
        });
        const percentPlace = toPercentPlace(place, document.slideSize);
        const covered = isBehind
            ? []
            : slides.flatMap((slide) => {
                  return listCoveredWordBoxes(percentPlace, slide.boxes).map(
                      (name) => {
                          return `"${name}" on slide ${slide.number}`;
                      },
                  );
              });
        changed.push(
            `Added ${quote(pictureName)} as "${added[0].name}" on ` +
                (slides.length === 1
                    ? toSlideShownText(slides[0])
                    : `${numbers.length} slides (${toSlideRangeText(numbers)})`) +
                ` at [${percentPlace.join(', ')}]` +
                (isBehind
                    ? ', behind the words, filling the slide'
                    : ', in front') +
                (cropXml === '' ? '' : ', cropped to that shape') +
                '.' +
                (covered.length === 0
                    ? ''
                    : ` It lies over the words of ${covered.slice(0, 3).join(', ')}` +
                      (covered.length > 3
                          ? ` and ${covered.length - 3} more`
                          : '') +
                      ': say so, and offer to move it or make it smaller ' +
                      `({box: "${added[0].name}", at}) or to move the words.`),
        );
    }
    // new text boxes, in the look of the slide's words, and new shapes
    for (const change of changes) {
        if (
            (change.textBox === undefined && change.shape === undefined) ||
            reshapeMap.has(change)
        ) {
            continue;
        }
        const shape =
            change.shape === undefined ? null : toOfficeShape(change.shape);
        const slide = slideByNumber(change.slide);
        if (slide === null) {
            return noSuchSlide(change.slide);
        }
        const xml = await readPart(slide.partPath);
        // a new shape with no place: a square a fifth of the slide wide,
        // in its middle (a circle asked for is round)
        const squareHeight =
            (20 * document.slideSize.cx) / document.slideSize.cy;
        const place = toBoxPlace(
            change.at ??
                (shape === null
                    ? [10, 40, 80, 20]
                    : shape.prst === 'line'
                      ? [30, 50, 40, 0]
                      : [40, 50 - squareHeight / 2, 20, squareHeight]),
            document.slideSize,
            null,
            shape?.prst === 'line',
        );
        if (xml === null) {
            return { reason: `Slide ${slide.number} could not be read.` };
        }
        if ('reason' in place) {
            return { reason: place.reason };
        }
        const runProps = (
            /<a:r>\s*(<a:rPr\b(?:[^>"']|"[^"]*"|'[^']*')*?(?:\/>|>[\s\S]*?<\/a:rPr>))/.exec(
                xml,
            )?.[1] ?? ''
        ).replace(/\s(?:dirty|err|smtClean)="[^"]*"/g, '');
        const lines =
            change.textBox === undefined
                ? []
                : toWrittenText(String(change.textBox))
                      .split('\n')
                      .map((line) => {
                          return escapeXmlText(line);
                      });
        const added =
            shape === null
                ? addSlideTextBoxXml(xml, lines, place, runProps)
                : addSlideShapeXml(
                      xml,
                      shape,
                      place,
                      lines,
                      /\slang="([\w-]+)"/.exec(runProps)?.[1] ?? null,
                  );
        if (added === null) {
            return {
                reason: `Slide ${slide.number} has no place for a new box.`,
            };
        }
        let written = added.xml;
        const look = lookMap.get(change);
        if (look !== undefined) {
            const boxStart = written.lastIndexOf('<p:sp>');
            const paragraphs = listOfficeParagraphs(written, 'pptx')
                .filter((paragraph) => {
                    return paragraph.start > boxStart;
                })
                .reverse();
            for (const paragraph of paragraphs) {
                const styled = applyParagraphLook(paragraph.xml, look, 'pptx');
                if (styled === null) {
                    return { reason: 'The new text box could not be styled.' };
                }
                written =
                    written.slice(0, paragraph.start) +
                    styled +
                    written.slice(paragraph.end);
            }
        }
        parts.set(slide.partPath, written);
        newBoxMap.set(change, [{ number: slide.number, name: added.name }]);
        changed.push(
            `Added ${shape === null ? 'a text box' : `a ${shape.words[0]}`} ` +
                `"${added.name}" on slide ${slide.number} at ` +
                `[${toPercentPlace(place, document.slideSize).join(', ')}]` +
                (change.textBox === undefined
                    ? ''
                    : `: ${quote(String(change.textBox))}`) +
                (look === undefined ? '.' : ` (${describeOfficeLook(look)}).`),
        );
    }
    // transitions, and the time a slide waits before going on by itself
    for (const change of changes) {
        if (change.transition === undefined && change.advance === undefined) {
            continue;
        }
        let slides = document.slides;
        if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        const kind =
            change.transition === undefined
                ? undefined
                : (toOfficeTransition(change.transition) ?? undefined);
        for (const slide of slides) {
            const xml = await readPart(slide.partPath);
            const next =
                xml === null
                    ? null
                    : setSlideTransitionXml(xml, {
                          kind,
                          advance: change.advance,
                      });
            if (next === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            parts.set(slide.partPath, next);
        }
        const said: string[] = [];
        if (kind !== undefined) {
            said.push(kind === 'none' ? 'no transition' : `${kind} transition`);
        }
        if (change.advance !== undefined) {
            said.push(
                change.advance > 0
                    ? `goes on by itself after ${change.advance} s`
                    : 'waits for a click',
            );
        }
        changed.push(
            `${change.slide === undefined ? 'Every slide' : `Slide ${slides[0].number}`}: ` +
                `${said.join(', ')}.`,
        );
    }
    // entrance animations: a named box, or every box of words on a slide
    for (const change of changes) {
        if (change.animation === undefined) {
            continue;
        }
        const effect = toOfficeAnimation(change.animation);
        if (effect === null) {
            continue;
        }
        let slides = document.slides;
        if (change.slide !== undefined) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        const named: string[] = [];
        const numbers: number[] = [];
        for (const slide of slides) {
            const boxes =
                change.box === undefined
                    ? slide.boxes.filter((box) => {
                          return box.lineIds.length > 0;
                      })
                    : matchOfficeBoxes(slide, String(change.box));
            if (boxes.length === 0) {
                if (change.slide !== undefined) {
                    return {
                        reason:
                            (change.box === undefined
                                ? `Slide ${slide.number} has no box of words.`
                                : `Slide ${slide.number} has no box ` +
                                  `"${change.box}".`) +
                            ` Its boxes: ${slide.boxes
                                .map((box) => {
                                    return `"${box.name}"`;
                                })
                                .join(', ')}.`,
                    };
                }
                continue;
            }
            let xml = await readPart(slide.partPath);
            if (xml === null) {
                return { reason: `Slide ${slide.number} could not be read.` };
            }
            for (const box of boxes) {
                if (box.shapeId === null) {
                    continue;
                }
                const next = setShapeAnimationXml(
                    xml,
                    box.shapeId,
                    effect === 'none'
                        ? null
                        : {
                              effect,
                              byLine: change.byLine === true,
                              start: change.when ?? 'click',
                              seconds: change.seconds ?? 0.5,
                          },
                );
                if (next === null) {
                    continue;
                }
                xml = next;
                if (!named.includes(box.name)) {
                    named.push(box.name);
                }
            }
            parts.set(slide.partPath, xml);
            numbers.push(slide.number);
        }
        if (numbers.length === 0) {
            return {
                reason: `No slide has a box "${change.box}" to animate.`,
            };
        }
        changed.push(
            `${named
                .map((name) => {
                    return `"${name}"`;
                })
                .join(', ')} ${toOnSlidesText(numbers)}: ` +
                (effect === 'none'
                    ? 'no animation now.'
                    : `comes in with ${effect}` +
                      (change.byLine === true ? ', line by line' : '') +
                      `, ${
                          change.when === 'with'
                              ? 'with the one before'
                              : change.when === 'after'
                                ? 'after the one before'
                                : 'on a click'
                      }.`),
        );
    }
    // videos and sounds put on a slide to play there (2026-11-21): the
    // clip once in ppt/media, a picture standing for it, the three
    // relationships PowerPoint writes, the box, and its timing -- after the
    // animations, so the slide's sequence is read as they left it
    for (const change of changes) {
        if (typeof change.media !== 'string') {
            continue;
        }
        const slide = slideByNumber(change.slide);
        if (slide === null) {
            return noSuchSlide(change.slide);
        }
        const bytes = pictures.get(change.media) as Uint8Array;
        const mediaName = toPictureName(change.media);
        const info = readOfficeMediaInfo(
            mediaName,
            bytes,
        ) as OfficeMediaInfoType;
        const names = [...pkg.names, ...parts.keys()];
        const mediaPath = genFreeMediaPath(
            names,
            info.extension,
            'ppt/media',
            'media',
        );
        parts.set(mediaPath, bytes);
        const posterPath = genFreeMediaPath([...names, mediaPath], 'png');
        parts.set(posterPath, genMediaPosterPng(info.kind));
        const types = await readPart(CONTENT_TYPES_PATH);
        if (types === null) {
            return { reason: 'The deck says no content types.' };
        }
        parts.set(
            CONTENT_TYPES_PATH,
            addContentTypeDefault(
                addContentTypeDefault(types, info.extension, info.contentType),
                'png',
                'image/png',
            ),
        );
        const relsPath = toRelsPath(slide.partPath);
        let relsXml = await readPart(relsPath);
        const rels = parseRels(relsXml ?? '');
        const target = toRelativeTarget(slide.partPath, mediaPath);
        const linkRelId = nextRelId(rels);
        const mediaRelId = `rId${Number(linkRelId.slice(3)) + 1}`;
        const posterRelId = `rId${Number(linkRelId.slice(3)) + 2}`;
        relsXml = addRelToXml(
            relsXml,
            genRelXml(
                linkRelId,
                info.kind === 'audio'
                    ? OFFICE_MEDIA_REL_TYPE.audio
                    : OFFICE_MEDIA_REL_TYPE.video,
                target,
            ),
        );
        relsXml = addRelToXml(
            relsXml,
            genRelXml(mediaRelId, OFFICE_MEDIA_REL_TYPE.media, target),
        );
        relsXml = addRelToXml(
            relsXml,
            genRelXml(
                posterRelId,
                `${REL_TYPE_BASE}image`,
                toRelativeTarget(slide.partPath, posterPath),
            ),
        );
        parts.set(relsPath, relsXml);
        const slideXml = await readPart(slide.partPath);
        if (slideXml === null) {
            return {
                reason: `Slide ${slide.number} could not be read to change it.`,
            };
        }
        let place: BoxPlaceType;
        if (change.at === undefined) {
            place = fitMediaBox(info, document.slideSize);
        } else {
            const asked = toPicturePlace(
                change.at,
                {
                    extension: 'png',
                    contentType: 'image/png',
                    width: info.width,
                    height: info.height,
                },
                document.slideSize,
            );
            if ('reason' in asked) {
                return asked;
            }
            place = asked;
        }
        const withNamespace = withRelationshipNamespace(slideXml);
        const { id, name } = findFreeBoxName(
            withNamespace,
            info.kind === 'audio' ? 'Audio' : 'Video',
        );
        const closeAt = withNamespace.lastIndexOf('</p:spTree>');
        if (closeAt < 0) {
            return {
                reason: `Slide ${slide.number} has no place for a video.`,
            };
        }
        const play = change.play === 'auto' ? 'auto' : 'click';
        const boxed =
            withNamespace.slice(0, closeAt) +
            genMediaPicXml({
                shapeId: id,
                name,
                description: mediaName,
                kind: info.kind,
                linkRelId,
                mediaRelId,
                posterRelId,
                place,
            }) +
            withNamespace.slice(closeAt);
        // its length is how long PowerPoint waits for it before an effect
        // set to come after it
        const timed = addMediaTimingXml(
            boxed,
            id,
            info.kind,
            play,
            readOfficeMediaDurationMs(mediaName, bytes),
        );
        if (timed === null) {
            return {
                reason:
                    `Slide ${slide.number}'s animations could not be read ` +
                    'to add the video to them: put it in in PowerPoint.',
            };
        }
        parts.set(slide.partPath, timed);
        const kindWord = info.kind === 'audio' ? 'sound' : 'video';
        const percentPlace = toPercentPlace(place, document.slideSize);
        const covered =
            info.kind === 'audio'
                ? []
                : listCoveredWordBoxes(percentPlace, slide.boxes);
        changed.push(
            `Added the ${kindWord} ${quote(mediaName)} as "${name}" on ` +
                `${toSlideShownText(slide)} at [${percentPlace.join(', ')}], ` +
                (play === 'auto'
                    ? 'playing by itself when the slide shows'
                    : 'playing when it is clicked in the slide show') +
                (info.kind === 'audio'
                    ? ': a small speaker on the slide stands for it'
                    : '') +
                '. The file is kept inside the PowerPoint.' +
                (covered.length === 0
                    ? ''
                    : ` It lies over the words of ${covered
                          .slice(0, 3)
                          .map((one) => {
                              return `"${one}"`;
                          })
                          .join(', ')}: say so, and offer to move it or make ` +
                      `it smaller ({slide: ${slide.number}, box: "${name}", ` +
                      'at}) or to move the words.'),
        );
    }
    // boxes given another shape, before any look of the same change
    for (const [change, shape] of reshapeMap) {
        const found = findBoxTargets(String(change.box), change.slide);
        if ('reason' in found) {
            return found;
        }
        const numbers: number[] = [];
        const names = new Set<string>();
        for (const { slide, boxes } of found) {
            let xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            for (const name of new Set(
                boxes.map((box) => {
                    return box.name;
                }),
            )) {
                for (const box of findNamedBoxes(xml, name).reverse()) {
                    if (!['text', 'shape', 'picture'].includes(box.kind)) {
                        return {
                            reason:
                                `"${box.name}" on slide ${slide.number} is ` +
                                `a ${box.kind}: only a box of words, a ` +
                                'shape or a picture takes another shape.' +
                                (box.kind === 'smartart'
                                    ? ' A SmartArt is given another ' +
                                      'layout, still a SmartArt, by ' +
                                      '{slide, box, smartArtLayout: ' +
                                      `${SMARTART_LAYOUT_CHOICES_TEXT}}, ` +
                                      'or turned into shapes first ' +
                                      '({slide, box, toShapes: true}; ' +
                                      'arrange: "cycle", "row" or "column" ' +
                                      'lays its boxes out so).'
                                    : ''),
                        };
                    }
                    const reshaped = setBoxShapeXml(
                        xml.slice(box.start, box.end),
                        shape.prst,
                    );
                    if (reshaped === null) {
                        continue;
                    }
                    xml =
                        xml.slice(0, box.start) + reshaped + xml.slice(box.end);
                    names.add(box.name);
                }
            }
            parts.set(slide.partPath, xml);
            numbers.push(slide.number);
        }
        changed.push(
            `${[...names]
                .map((name) => {
                    return `"${name}"`;
                })
                .join(', ')} ${toOnSlidesText(numbers)} ` +
                `${names.size === 1 ? 'is' : 'are'} now ` +
                `${/^[aeiou]/.test(shape.words[0]) ? 'an' : 'a'} ` +
                `${shape.words[0]}, its place, colours and words as they were.`,
        );
    }
    // boxes given a look of their own: a fill, an outline, see-through, a
    // picture's brightness, a turn, where the words sit, in front or behind
    const readBoxId = (boxXml: string) => {
        return /<p:cNvPr\b[^>]*?\sid="(\d+)"/.exec(boxXml)?.[1] ?? null;
    };
    for (const change of changes) {
        const look = boxLookMap.get(change);
        if (look === undefined) {
            continue;
        }
        let targets: { slide: OfficeSlideType; names: string[] }[] = [];
        if (change.box !== undefined) {
            const found = findBoxTargets(change.box, change.slide);
            if ('reason' in found) {
                return found;
            }
            targets = found.map(({ slide, boxes }) => {
                return {
                    slide,
                    names: [
                        ...new Set(
                            boxes.map((box) => {
                                return box.name;
                            }),
                        ),
                    ],
                };
            });
        } else {
            for (const { number, name } of newBoxMap.get(change) ?? []) {
                const slide = slideByNumber(number);
                if (slide !== null) {
                    targets.push({ slide, names: [name] });
                }
            }
        }
        const numbers: number[] = [];
        const shownNames = new Set<string>();
        const notes: string[] = [];
        let movedCount = 0;
        for (const { slide, names } of targets) {
            let xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            const { layoutXml, masterXml } = await shared.layoutOf(
                slide.layoutPath,
            );
            // by id: a box moved in front or behind is found again where
            // it went
            const findById = (slideXml: string, id: string) => {
                return (
                    listSlideBoxes(slideXml).find((box) => {
                        return (
                            !box.isGrouped &&
                            readBoxId(slideXml.slice(box.start, box.end)) === id
                        );
                    }) ?? null
                );
            };
            const ids = names.flatMap((name) => {
                return findNamedBoxes(xml as string, name).flatMap((box) => {
                    const id = readBoxId(
                        (xml as string).slice(box.start, box.end),
                    );
                    return id === null ? [] : [id];
                });
            });
            for (const id of new Set(ids)) {
                const box = findById(xml, id);
                if (box === null) {
                    continue;
                }
                shownNames.add(box.name);
                let boxXml = xml.slice(box.start, box.end);
                if (
                    (look.rotate !== undefined || look.flip !== undefined) &&
                    !/<(?:a|p):xfrm\b/.test(boxXml)
                ) {
                    // a box placed by its layout gets its own place to turn
                    const current = findBoxPlace(boxXml, layoutXml, masterXml);
                    if (current !== null) {
                        boxXml = setBoxPlaceXml(boxXml, current) ?? boxXml;
                    }
                }
                const styled = applyBoxLookXml(boxXml, look, box.kind);
                if ('reason' in styled) {
                    return {
                        reason:
                            `"${box.name}" on slide ${slide.number}: ` +
                            styled.reason,
                    };
                }
                xml = xml.slice(0, box.start) + styled.xml + xml.slice(box.end);
                if (look.order === undefined) {
                    continue;
                }
                const placed = findById(xml, id) as SlideBoxType;
                const moved = moveSlideBoxXml(xml, placed, look.order);
                if (moved === null) {
                    return {
                        reason:
                            `"${box.name}" on slide ${slide.number} cannot ` +
                            'be put in front or behind.',
                    };
                }
                xml = moved.xml;
                if (moved.isMoved) {
                    movedCount++;
                } else {
                    notes.push(
                        `"${box.name}" on slide ${slide.number} already was ` +
                            (look.order === 'front' || look.order === 'forward'
                                ? 'in front of every box'
                                : 'behind every box') +
                            ': nothing moved.',
                    );
                }
                // words sent behind a picture filling the slide are hidden
                const after = findById(xml, id) as SlideBoxType;
                const cover = listSlideBoxes(xml, document.slideSize).find(
                    (other) => {
                        return (
                            !other.isGrouped &&
                            other.isFilling &&
                            other.kind === 'picture' &&
                            other.start > after.start
                        );
                    },
                );
                if (
                    cover !== undefined &&
                    (after.kind === 'text' || after.kind === 'shape')
                ) {
                    notes.push(
                        `"${box.name}" on slide ${slide.number} is behind ` +
                            `"${cover.name}", which fills the slide: it will ` +
                            'not show. Say so, and offer to bring it to the ' +
                            'front.',
                    );
                }
            }
            parts.set(slide.partPath, xml);
            numbers.push(slide.number);
        }
        const nameText = [...shownNames]
            .map((name) => {
                return `"${name}"`;
            })
            .join(', ');
        // a move that moved nothing is said by its note alone
        const described = describeOfficeBoxLook(
            movedCount === 0 ? { ...look, order: undefined } : look,
        );
        changed.push(
            (described === ''
                ? ''
                : `${nameText} on ` +
                  (numbers.length === 1
                      ? `slide ${numbers[0]}`
                      : `${numbers.length} slides (${toSlideRangeText(numbers)})`) +
                  `: ${described}.` +
                  (notes.length === 0 ? '' : ' ')) + notes.join(' '),
        );
    }
    // slide numbers and a footer, as Insert → Header & Footer puts them
    for (const change of changes) {
        if (change.slideNumbers === undefined && change.footer === undefined) {
            continue;
        }
        const isEvery = change.slide === undefined;
        let slides = document.slides;
        if (!isEvery) {
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            slides = [slide];
        }
        const footerText =
            change.footer === undefined
                ? undefined
                : /^\s*(?:none|off|remove|)\s*$/i.test(change.footer)
                  ? null
                  : toWrittenText(change.footer.trim());
        const asked: { kind: OfficeFooterKindType; isOn: boolean }[] = [];
        if (change.slideNumbers !== undefined) {
            asked.push({ kind: 'sldNum', isOn: change.slideNumbers });
        }
        if (footerText !== undefined) {
            asked.push({ kind: 'ftr', isOn: footerText !== null });
        }
        const doneMap = new Map<string, number[]>();
        const noPlaceMap = new Map<string, number[]>();
        const titleSlides: number[] = [];
        for (const slide of slides) {
            let xml = await readPart(slide.partPath);
            if (xml === null) {
                return {
                    reason: `Slide ${slide.number} could not be read to change it.`,
                };
            }
            const { layoutXml, masterXml } = await shared.layoutOf(
                slide.layoutPath,
            );
            const isTitle = isEvery && checkIsTitleLayout(layoutXml);
            for (const { kind, isOn } of asked) {
                if (isOn && isTitle) {
                    if (!titleSlides.includes(slide.number)) {
                        titleSlides.push(slide.number);
                    }
                    continue;
                }
                const out = setSlideFooterXml(
                    xml,
                    kind,
                    isOn,
                    footerText ?? null,
                    layoutXml,
                    masterXml,
                    slide.number,
                );
                const key = `${kind}:${isOn}`;
                const map = out.state === 'noPlace' ? noPlaceMap : doneMap;
                map.set(key, [...(map.get(key) ?? []), slide.number]);
                xml = out.xml;
            }
            parts.set(slide.partPath, xml);
        }
        const onSlides = (numbers: number[]) => {
            return numbers.length === 1
                ? `slide ${numbers[0]}`
                : `slides ${toSlideRangeText(numbers)}`;
        };
        const sentences: string[] = [];
        for (const { kind, isOn } of asked) {
            const key = `${kind}:${isOn}`;
            const done = doneMap.get(key) ?? [];
            const what =
                kind === 'sldNum'
                    ? 'Slide numbers'
                    : `The footer ${quote(String(footerText ?? ''))}`;
            if (done.length > 0) {
                sentences.push(
                    isOn
                        ? `${what} on ${onSlides(done)}.`
                        : `${kind === 'sldNum' ? 'Slide numbers' : 'The footer'} ` +
                              `taken off ${onSlides(done)}.`,
                );
            }
            const noPlace = noPlaceMap.get(key) ?? [];
            if (noPlace.length > 0) {
                sentences.push(
                    `The layout of ${onSlides(noPlace)} has no place for ` +
                        `${kind === 'sldNum' ? 'a slide number' : 'a footer'}: ` +
                        'say so; a text box there can hold it.',
                );
            }
        }
        if (titleSlides.length > 0) {
            sentences.push(
                `Not on the title slide (${onSlides(titleSlides)}), as ` +
                    'PowerPoint offers: give its `slide` to put it there too.',
            );
        }
        changed.push(sentences.join(' '));
    }
    // a table's rows and columns
    for (const change of changes) {
        if (change.table === undefined) {
            continue;
        }
        const slide = slideByNumber(change.slide);
        if (slide === null) {
            return noSuchSlide(change.slide);
        }
        const xml = await readPart(slide.partPath);
        if (xml === null) {
            return { reason: `Slide ${slide.number} could not be read.` };
        }
        const tableName = String(change.table);
        const table = listSlideTables(xml).find((one) => {
            return one.name.toLowerCase() === tableName.trim().toLowerCase();
        });
        const cells = change.cells ?? [];
        let next: string | { reason: string };
        let said: string;
        if (change.tableLook !== undefined) {
            const asked = change.tableLook;
            // a colour in words or #RRGGBB; null or "none" takes it off
            const toLookColor = (value: string | null | undefined) => {
                if (value === undefined) {
                    return undefined;
                }
                if (value === null || /^(?:none|off)$/i.test(value.trim())) {
                    return null;
                }
                return toOfficeColor(value) ?? undefined;
            };
            const badColor = [asked.fill, asked.borders].find((value) => {
                return (
                    typeof value === 'string' &&
                    !/^(?:none|off)$/i.test(value.trim()) &&
                    toOfficeColor(value) === null
                );
            });
            if (badColor !== undefined) {
                return {
                    reason:
                        `No colour "${badColor}": a name or #RRGGBB, or ` +
                        '"none".',
                };
            }
            const look = {
                ...(asked.fill === undefined
                    ? {}
                    : { fill: toLookColor(asked.fill) }),
                ...(asked.borders === undefined
                    ? {}
                    : { borders: toLookColor(asked.borders) }),
                ...(asked.rows === undefined ? {} : { rows: asked.rows }),
                ...(asked.columns === undefined
                    ? {}
                    : { columns: asked.columns }),
                ...(asked.header === undefined ? {} : { header: asked.header }),
                ...(asked.banded === undefined ? {} : { banded: asked.banded }),
            };
            const looked = setTableLookXml(xml, tableName, look);
            next = 'reason' in looked ? looked : looked.xml;
            const where = [
                ...(asked.rows === undefined
                    ? []
                    : [`row ${asked.rows.join(', ')}`]),
                ...(asked.columns === undefined
                    ? []
                    : [`column ${asked.columns.join(', ')}`]),
            ].join(' x ');
            const saidList = [
                ...(look.fill === undefined
                    ? []
                    : [
                          look.fill === null
                              ? `the cells' own colour taken off${where === '' ? '' : ` (${where})`}`
                              : `the cells ${toOfficeColorWords(look.fill)}${where === '' ? '' : ` (${where})`}`,
                      ]),
                ...(look.borders === undefined
                    ? []
                    : [
                          look.borders === null
                              ? 'its own borders taken off'
                              : `borders ${toOfficeColorWords(look.borders)}`,
                      ]),
                ...(look.header === undefined
                    ? []
                    : [
                          `its header row ${look.header ? 'stands out' : 'plain'}`,
                      ]),
                ...(look.banded === undefined
                    ? []
                    : [`its rows ${look.banded ? 'banded' : 'not banded'}`]),
            ];
            said = saidList.join(', ');
        } else if (change.addRow !== undefined) {
            next = addTableRowXml(
                xml,
                tableName,
                table !== undefined && change.addRow > table.rows
                    ? null
                    : change.addRow,
                cells,
            );
            said = `added a row (now row ${
                table !== undefined && change.addRow > table.rows
                    ? table.rows + 1
                    : change.addRow
            })`;
        } else if (change.removeRow !== undefined) {
            next = removeTableRowXml(xml, tableName, change.removeRow);
            said = `took out row ${change.removeRow}`;
        } else if (change.addColumn !== undefined) {
            next = addTableColumnXml(
                xml,
                tableName,
                table !== undefined && change.addColumn > table.columns
                    ? null
                    : change.addColumn,
                cells,
            );
            said = `added a column (now column ${
                table !== undefined && change.addColumn > table.columns
                    ? table.columns + 1
                    : change.addColumn
            })`;
        } else {
            next = removeTableColumnXml(
                xml,
                tableName,
                Number(change.removeColumn),
            );
            said = `took out column ${change.removeColumn}`;
        }
        if (typeof next !== 'string') {
            return { reason: next.reason };
        }
        parts.set(slide.partPath, next);
        changed.push(
            `Table "${table?.name ?? tableName}" on slide ${slide.number}: ${said}` +
                (cells.length > 0
                    ? `, its words ${quote(cells.join(' | '))}`
                    : '') +
                '.',
        );
    }
    // a chart's words and numbers, in its cache and its embedded workbook
    for (const change of changes) {
        if (change.chart === undefined) {
            continue;
        }
        const slide = slideByNumber(change.slide);
        if (slide === null) {
            return noSuchSlide(change.slide);
        }
        const box = matchOfficeBoxes(slide, String(change.chart)).find(
            (one) => {
                return one.chart !== undefined;
            },
        );
        if (box?.chart === undefined) {
            const charts = slide.boxes.filter((one) => {
                return one.kind === 'chart';
            });
            return {
                reason:
                    `Slide ${slide.number} has no chart "${change.chart}"` +
                    (charts.length === 0
                        ? '.'
                        : `; its charts: ${charts
                              .map((one) => {
                                  return `"${one.name}"`;
                              })
                              .join(', ')}.`),
            };
        }
        const chartPath = box.chart.path;
        const chartXml = await readPart(chartPath);
        if (chartXml === null) {
            return { reason: `The chart "${box.name}" could not be read.` };
        }
        // its kind first: the data change reads the chart as it now is
        const kind =
            change.chartKind === undefined
                ? null
                : toOfficeChartKind(change.chartKind);
        let kindSaid = '';
        let nextChartXml = chartXml;
        if (kind !== null) {
            const kinded = setChartKindXml(chartXml, kind);
            if ('reason' in kinded) {
                return { reason: kinded.reason };
            }
            nextChartXml = kinded.xml;
            kindSaid =
                kinded.from === kind
                    ? `: already a ${kind} chart`
                    : `: a ${kind} chart now (it was a ${kinded.from} chart)`;
        }
        let sheetNote = '';
        if (
            change.chartTitle !== undefined ||
            change.categories !== undefined ||
            change.series !== undefined
        ) {
            const result = setChartDataXml(nextChartXml, {
                ...(change.chartTitle === undefined
                    ? {}
                    : { title: String(change.chartTitle) }),
                ...(change.categories === undefined
                    ? {}
                    : { categories: change.categories }),
                ...(change.series === undefined
                    ? {}
                    : { series: change.series }),
            });
            if ('reason' in result) {
                return { reason: result.reason };
            }
            nextChartXml = result.xml;
            parts.set(chartPath, nextChartXml);
            sheetNote = await writeChartWorkbook(
                pkg,
                chartPath,
                chartXml,
                result.cells,
                readPart,
                parts,
            );
        }
        parts.set(chartPath, nextChartXml);
        changed.push(
            `Changed the chart "${box.name}" on slide ${slide.number}` +
                kindSaid +
                (change.chartTitle === undefined
                    ? ''
                    : `${kindSaid === '' ? ':' : ','} its title ${quote(String(change.chartTitle))}`) +
                (change.categories === undefined ? '' : ', its categories') +
                (change.series === undefined ? '' : ', its numbers') +
                '.' +
                sheetNote,
        );
    }
    // the deck's slide size, every box placed for it
    const sizeChange = [...changes].reverse().find((change) => {
        return change.slideSize !== undefined;
    });
    const newSize =
        sizeChange === undefined
            ? null
            : toOfficeSlideSize(sizeChange.slideSize);
    if (newSize !== null) {
        const mainXml = await readPart(document.mainPath);
        if (mainXml === null) {
            return { reason: 'The file is damaged: its main part is missing.' };
        }
        const from = document.slideSize;
        parts.set(document.mainPath, setPresentationSizeXml(mainXml, newSize));
        const shownParts = [
            ...document.slides.map((slide) => {
                return slide.partPath;
            }),
            ...pkg.names.filter((name) => {
                return /^ppt\/slide(?:Layouts\/slideLayout|Masters\/slideMaster)\d+\.xml$/.test(
                    name,
                );
            }),
        ];
        for (const partPath of shownParts) {
            const xml = await readPart(partPath);
            if (xml !== null) {
                parts.set(partPath, scaleSlidePartXml(xml, from, newSize));
            }
        }
        const fromName =
            OFFICE_SLIDE_SIZE_LIST.find((name) => {
                const size = toOfficeSlideSize(name);
                return size?.cx === from.cx && size?.cy === from.cy;
            }) ?? `${from.cx}×${from.cy} EMU`;
        changed.push(
            fromName === newSize.name
                ? `The slides were ${newSize.name} already.`
                : `The slides are ${newSize.name} now (they were ` +
                      `${fromName}): every box was moved and sized with ` +
                      'them; words keep their size, so a line may wrap ' +
                      'where it did not.',
        );
    }

    // the deck's theme: each theme part a slide master uses
    if (themeMap.size > 0) {
        const themePaths = new Set<string>();
        const masterPaths = pkg.names.filter((name) => {
            return /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name);
        });
        for (const masterPath of masterPaths) {
            const relsXml = await readPart(toRelsPath(masterPath));
            for (const rel of parseRels(relsXml ?? '')) {
                if (checkIsRelType(rel, 'theme')) {
                    themePaths.add(resolvePartPath(masterPath, rel.target));
                }
            }
        }
        if (themePaths.size === 0) {
            return { reason: 'This deck has no theme to change.' };
        }
        for (const ask of themeMap.values()) {
            for (const themePath of themePaths) {
                const xml = await readPart(themePath);
                const next =
                    xml === null ? null : applyOfficeThemeXml(xml, ask);
                if (next === null) {
                    return {
                        reason:
                            "This deck's theme has no colour or font " +
                            'scheme to change.',
                    };
                }
                parts.set(themePath, next);
            }
            changed.push(toOfficeThemeWords(ask));
        }
    }

    const slideChanges = changes.filter((change) => {
        return (
            change.removeSlide === true ||
            change.duplicate === true ||
            change.newSlide === true ||
            (change.to !== undefined && change.id === undefined)
        );
    });
    if (slideChanges.length > 0) {
        const mainXml = await readPart(document.mainPath);
        const mainRelsPath = toRelsPath(document.mainPath);
        let mainRelsXml = await readPart(mainRelsPath);
        if (mainXml === null || mainRelsXml === null) {
            return {
                reason: 'The file is damaged: its slide list is missing.',
            };
        }
        const { entries, listMatch } = readSldIdList(mainXml);
        if (listMatch === null) {
            return { reason: 'The deck has no slide list to change.' };
        }
        const order = [...entries];
        let presentationXml = mainXml;
        for (const change of slideChanges) {
            if (change.newSlide === true) {
                const place = change.to ?? order.length + 1;
                if (
                    typeof place !== 'number' ||
                    !Number.isInteger(place) ||
                    place < 1 ||
                    place > order.length + 1
                ) {
                    return {
                        reason:
                            '`to` is where the new slide goes: a number from ' +
                            `1 to ${order.length + 1} (none: the end).`,
                    };
                }
                // in the section of the slide before it (the first one's,
                // at the front)
                const neighbour = order[place - 2] ?? order[0];
                // a deck whose slides each draw their own picture behind
                // the words (a curtain): the layout has none of it
                const besideSlide = document.slides.find((one) => {
                    return one.relId === neighbour?.relId;
                });
                const besidePicture = besideSlide?.boxes.find((box) => {
                    return box.kind === 'picture' && box.isFilling;
                });
                // No layout named beside a slide that draws its own picture
                // behind its words (a curtain, its words coloured for it):
                // a layout slide would come out plain, dark words on white,
                // so the slide is copied instead (2026-11-20, the hymn deck's
                // "a new slide that says Amen": a plain slide, then the offer)
                if (
                    change.layout === undefined &&
                    besideSlide !== undefined &&
                    besidePicture !== undefined
                ) {
                    return {
                        reason:
                            `Slide ${besideSlide.number} draws its own picture ` +
                            `"${besidePicture.name}" behind its words, and a ` +
                            "layout's slide has none of it. Copy that slide " +
                            `instead ({slide: ${besideSlide.number}, ` +
                            `duplicate: true, to: ${place}}) and then change ` +
                            "the copy's lines by the ids the answer gives; or " +
                            'name a `layout` for a plain slide.',
                    };
                }
                const layout = pickLayout(
                    document.layouts,
                    change.layout === undefined ? null : String(change.layout),
                );
                if (layout === null && document.layouts.length === 0) {
                    return {
                        reason:
                            'The deck has no layouts to make a slide from: ' +
                            'copy a slide instead ({slide, duplicate: true, ' +
                            'to}).',
                    };
                }
                if (layout === null) {
                    return {
                        reason:
                            `The deck has no layout "${change.layout}". Its ` +
                            `layouts: ${document.layouts
                                .map((one) => {
                                    return `"${one.name}"`;
                                })
                                .join(', ')}.`,
                    };
                }
                const layoutXml = await readPart(layout.path);
                if (layoutXml === null) {
                    return {
                        reason: `The layout "${layout.name}" could not be read.`,
                    };
                }
                const made = genSlideFromLayout(layoutXml, {
                    ...(change.title === undefined
                        ? {}
                        : { title: toWrittenText(String(change.title)) }),
                    ...(change.lines === undefined
                        ? {}
                        : {
                              lines: change.lines.map((line) => {
                                  return toWrittenText(line);
                              }),
                          }),
                });
                const newPath = `ppt/slides/slide${nextPartNumber(
                    'ppt/slides',
                    'slide',
                )}.xml`;
                extraParts.push(newPath, toRelsPath(newPath));
                parts.set(newPath, made.xml);
                parts.set(
                    toRelsPath(newPath),
                    genRelsXml([
                        genRelXml(
                            'rId1',
                            `${REL_TYPE_BASE}slideLayout`,
                            toRelativeTarget(newPath, layout.path),
                        ),
                    ]),
                );
                contentTypes = addContentTypeOverride(
                    contentTypes,
                    newPath,
                    SLIDE_CONTENT_TYPE,
                );
                const newRelId = nextRelId(parseRels(mainRelsXml));
                mainRelsXml = addRelToXml(
                    mainRelsXml,
                    genRelXml(
                        newRelId,
                        `${REL_TYPE_BASE}slide`,
                        toRelativeTarget(document.mainPath, newPath),
                    ),
                );
                const newId = String(
                    Math.max(
                        255,
                        ...[...entries, ...order].map((entry) => {
                            return Number(entry.id) || 0;
                        }),
                    ) + 1,
                );
                order.splice(place - 1, 0, {
                    xml: `<p:sldId id="${newId}" r:id="${newRelId}"/>`,
                    id: newId,
                    relId: newRelId,
                });
                if (neighbour !== undefined) {
                    presentationXml = presentationXml.replace(
                        new RegExp(
                            `(<p14:sldId\\s+id="${neighbour.id}"\\s*/>)`,
                        ),
                        place === 1
                            ? `<p14:sldId id="${newId}"/>$1`
                            : `$1<p14:sldId id="${newId}"/>`,
                    );
                }
                // what went into a box, never what the layout had no box for
                const placedTitle =
                    change.title === undefined ||
                    change.title.trim() === '' ||
                    made.leftOut.includes(toWrittenText(change.title))
                        ? null
                        : change.title;
                const placedLineCount = (change.lines ?? []).filter((line) => {
                    return (
                        line.trim() !== '' &&
                        !made.leftOut.includes(toWrittenText(line))
                    );
                }).length;
                changed.push(
                    `Added a new slide at place ${place} on the layout ` +
                        `"${layout.name}"` +
                        (placedTitle === null
                            ? ''
                            : `, titled ${quote(placedTitle)}`) +
                        (placedLineCount === 0
                            ? ''
                            : `, with ${placedLineCount} line` +
                              (placedLineCount === 1 ? '' : 's')) +
                        '.' +
                        (made.leftOut.length === 0
                            ? ''
                            : ` That layout has no box for ` +
                              `${quote(made.leftOut.join(' / '))}: say so, ` +
                              'and offer a layout with one, or a text box.') +
                        (besideSlide === undefined ||
                        besidePicture === undefined
                            ? ''
                            : ` It has the layout's plain look: slide ` +
                              `${besideSlide.number} draws its own picture ` +
                              `"${besidePicture.name}" behind its words, and ` +
                              'this one does not. Say so, and offer to take ' +
                              'it out and copy that slide instead ' +
                              '({slide, duplicate, to}).'),
                );
                continue;
            }
            const slide = slideByNumber(change.slide);
            if (slide === null) {
                return noSuchSlide(change.slide);
            }
            const at = order.findIndex((entry) => {
                return entry.relId === slide.relId;
            });
            if (at < 0) {
                return {
                    reason: `Slide ${slide.number} was already taken out in this call.`,
                };
            }
            if (change.removeSlide === true) {
                const reason = await findSlideLinkReason(
                    document.mainPath,
                    readPart,
                    allNames(),
                    slide,
                    presentationXml,
                );
                if (reason !== null) {
                    return { reason };
                }
                order.splice(at, 1);
                const removedParts = [slide.partPath, slide.relsPath];
                if (slide.notesPath !== null) {
                    removedParts.push(
                        slide.notesPath,
                        toRelsPath(slide.notesPath),
                    );
                }
                for (const name of removedParts) {
                    if (allNames().includes(name)) {
                        parts.set(name, null);
                    }
                    contentTypes = removeContentTypeOverride(
                        contentTypes,
                        name,
                    );
                }
                mainRelsXml = mainRelsXml.replace(
                    /<Relationship\b[^>]*?\/>/g,
                    (tag) => {
                        return readAttribute(tag, 'Id') === slide.relId
                            ? ''
                            : tag;
                    },
                );
                presentationXml = presentationXml.replace(
                    new RegExp(`<p14:sldId\\s+id="${slide.sldId}"\\s*/>`, 'g'),
                    '',
                );
                changed.push(`Took out slide ${slide.number}.`);
                continue;
            }
            if (change.duplicate === true) {
                // `to` puts the copy at that place in ONE change: "copy it to
                // the end" had been a copy and then a move of a slide the
                // first read did not have (2026-11-20, gemma4:cloud).
                const copyTo = change.to;
                if (
                    copyTo !== undefined &&
                    (typeof copyTo !== 'number' ||
                        !Number.isInteger(copyTo) ||
                        copyTo < 1 ||
                        copyTo > order.length + 1)
                ) {
                    return {
                        reason:
                            `\`to\` is where the copy of slide ${slide.number} ` +
                            `goes: a number from 1 to ${order.length + 1}.`,
                    };
                }
                const slideXml = await readPart(slide.partPath);
                if (slideXml === null) {
                    return {
                        reason: `Slide ${slide.number} could not be read.`,
                    };
                }
                const newNumber = nextPartNumber('ppt/slides', 'slide');
                const newPath = `ppt/slides/slide${newNumber}.xml`;
                extraParts.push(newPath);
                parts.set(newPath, slideXml);
                const slideRels = parseRels(
                    (await readPart(slide.relsPath)) ?? '',
                );
                const newRels: string[] = [];
                for (const rel of slideRels) {
                    // a comment belongs to the slide it was written on
                    if (/comment/i.test(rel.type)) {
                        continue;
                    }
                    if (checkIsRelType(rel, 'notesSlide')) {
                        const notesXml =
                            slide.notesPath === null
                                ? null
                                : await readPart(slide.notesPath);
                        if (notesXml === null || slide.notesPath === null) {
                            continue;
                        }
                        const newNotesPath = `ppt/notesSlides/notesSlide${nextPartNumber(
                            'ppt/notesSlides',
                            'notesSlide',
                        )}.xml`;
                        extraParts.push(newNotesPath);
                        parts.set(newNotesPath, notesXml);
                        const notesRels = parseRels(
                            (await readPart(toRelsPath(slide.notesPath))) ?? '',
                        ).map((one) => {
                            return checkIsRelType(one, 'slide')
                                ? genRelXml(
                                      one.id,
                                      one.type,
                                      toRelativeTarget(newNotesPath, newPath),
                                  )
                                : one.xml;
                        });
                        parts.set(
                            toRelsPath(newNotesPath),
                            genRelsXml(notesRels),
                        );
                        extraParts.push(toRelsPath(newNotesPath));
                        contentTypes = addContentTypeOverride(
                            contentTypes,
                            newNotesPath,
                            NOTES_SLIDE_CONTENT_TYPE,
                        );
                        newRels.push(
                            genRelXml(
                                rel.id,
                                rel.type,
                                toRelativeTarget(newPath, newNotesPath),
                            ),
                        );
                        continue;
                    }
                    newRels.push(rel.xml);
                }
                if (slideRels.length > 0) {
                    parts.set(toRelsPath(newPath), genRelsXml(newRels));
                    extraParts.push(toRelsPath(newPath));
                }
                contentTypes = addContentTypeOverride(
                    contentTypes,
                    newPath,
                    SLIDE_CONTENT_TYPE,
                );
                const newRelId = nextRelId(parseRels(mainRelsXml));
                mainRelsXml = addRelToXml(
                    mainRelsXml,
                    genRelXml(
                        newRelId,
                        `${REL_TYPE_BASE}slide`,
                        toRelativeTarget(document.mainPath, newPath),
                    ),
                );
                const newId = String(
                    Math.max(
                        255,
                        ...[...entries, ...order].map((entry) => {
                            return Number(entry.id) || 0;
                        }),
                    ) + 1,
                );
                order.splice(copyTo === undefined ? at + 1 : copyTo - 1, 0, {
                    xml: `<p:sldId id="${newId}" r:id="${newRelId}"/>`,
                    id: newId,
                    relId: newRelId,
                });
                // the copy sits in its slide's section
                presentationXml = presentationXml.replace(
                    new RegExp(`(<p14:sldId\\s+id="${slide.sldId}"\\s*/>)`),
                    `$1<p14:sldId id="${newId}"/>`,
                );
                changed.push(
                    copyTo === undefined
                        ? `Copied slide ${slide.number}; the copy comes right after it.`
                        : `Copied slide ${slide.number}; the copy is at place ${copyTo}.`,
                );
                continue;
            }
            const to = change.to;
            if (
                typeof to !== 'number' ||
                !Number.isInteger(to) ||
                to < 1 ||
                to > order.length
            ) {
                return {
                    reason:
                        `\`to\` is where slide ${slide.number} goes: a number ` +
                        `from 1 to ${order.length}.`,
                };
            }
            const [moved] = order.splice(at, 1);
            order.splice(to - 1, 0, moved);
            changed.push(`Moved slide ${slide.number} to place ${to}.`);
        }
        const newList = `<p:sldIdLst>${order
            .map((entry) => {
                return entry.xml;
            })
            .join('')}</p:sldIdLst>`;
        if (order.length === 0) {
            return { reason: 'A deck keeps at least one slide.' };
        }
        presentationXml = toOrderedSectionsXml(
            presentationXml.replace(
                /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
                newList,
            ),
            order.map((entry) => {
                return entry.id;
            }),
        );
        parts.set(document.mainPath, presentationXml);
        parts.set(mainRelsPath, mainRelsXml);
    }
    // each link's relationship, in the part its words are in
    for (const [partPath, content] of [...parts]) {
        if (typeof content !== 'string') {
            continue;
        }
        const tokens = listOfficeLinkTokens(content);
        if (tokens.size === 0) {
            continue;
        }
        const relsPath = toRelsPath(partPath);
        const stored = parts.get(relsPath);
        let relsXml =
            typeof stored === 'string' ? stored : await readPart(relsPath);
        let written = content;
        for (const [token, target] of tokens) {
            const isJump = target.startsWith('slide:');
            let relXml: string;
            let type: string;
            let relTarget: string;
            if (isJump) {
                const slide = document.slides[Number(target.slice(6)) - 1];
                if (slide === undefined || parts.get(slide.partPath) === null) {
                    return {
                        reason: `There is no ${target.replace(':', ' ')} to link to.`,
                    };
                }
                type = `${REL_TYPE_BASE}slide`;
                relTarget = toRelativeTarget(partPath, slide.partPath);
            } else {
                type = `${REL_TYPE_BASE}hyperlink`;
                relTarget = target;
            }
            const rels = parseRels(relsXml ?? '');
            let relId =
                rels.find((rel) => {
                    return (
                        rel.type === type &&
                        rel.isExternal === !isJump &&
                        rel.target === relTarget
                    );
                })?.id ?? null;
            if (relId === null) {
                relId = nextRelId(rels);
                relXml =
                    genRelXml(relId, type, relTarget).replace(/\/>$/, '') +
                    (isJump ? '/>' : ' TargetMode="External"/>');
                relsXml = addRelToXml(relsXml, relXml);
            }
            written = written
                .split(`r:id="${token}"`)
                .join(
                    `r:id="${relId}"` +
                        (isJump ? ' action="ppaction://hlinksldjump"' : ''),
                );
        }
        parts.set(partPath, written);
        parts.set(relsPath, relsXml);
    }
    if (contentTypes !== (await pkg.readText('[Content_Types].xml'))) {
        parts.set('[Content_Types].xml', contentTypes);
    }
    return { parts, changed };
}

const SECTION_LIST_PATTERN =
    /(<p14:sectionLst\b[^>]*>)([\s\S]*?)(<\/p14:sectionLst>)/;
const SECTION_PATTERN = /<p14:section\b[^>]*?(?:\/>|>[\s\S]*?<\/p14:section>)/g;
const SECTION_SLIDES_PATTERN =
    /<p14:sldIdLst\s*\/>|<p14:sldIdLst>[\s\S]*?<\/p14:sldIdLst>/;

/**
 * A deck's sections (`p14:sectionLst`) list its slides in the slide list's
 * order, each section one run of them, and a section list out of step with
 * the slides is a file PowerPoint has to repair. After slides moved, or a
 * copy went to a place of its own, each section's list is written again in
 * the slides' order: the longest run of slides still in section order keeps
 * its sections, and a slide out of it joins the section of the slide before
 * it (the first slides, the section of the first slide kept) -- as a slide
 * dragged into another section in PowerPoint does. Sections left with no
 * slide stay, empty, as PowerPoint keeps them. A list it cannot read whole
 * is left as it was.
 */
export function toOrderedSectionsXml(presentationXml: string, ids: string[]) {
    const listMatch = SECTION_LIST_PATTERN.exec(presentationXml);
    if (listMatch === null) {
        return presentationXml;
    }
    const sectionXmlList = listMatch[2].match(SECTION_PATTERN) ?? [];
    const sectionById = new Map<string, number>();
    for (const [index, sectionXml] of sectionXmlList.entries()) {
        if (!SECTION_SLIDES_PATTERN.test(sectionXml)) {
            return presentationXml;
        }
        for (const one of sectionXml.matchAll(
            /<p14:sldId\s+id="(\d+)"\s*\/>/g,
        )) {
            sectionById.set(one[1], index);
        }
    }
    if (sectionXmlList.length === 0) {
        return presentationXml;
    }
    const sections = ids.map((id) => {
        return sectionById.get(id) ?? -1;
    });
    // the longest run of slides in section order (non-decreasing)
    const lengths = sections.map(() => {
        return 0;
    });
    const previous = sections.map(() => {
        return -1;
    });
    let best = -1;
    for (let at = 0; at < sections.length; at++) {
        if (sections[at] < 0) {
            continue;
        }
        lengths[at] = 1;
        for (let before = 0; before < at; before++) {
            if (
                sections[before] >= 0 &&
                sections[before] <= sections[at] &&
                lengths[before] + 1 > lengths[at]
            ) {
                lengths[at] = lengths[before] + 1;
                previous[at] = before;
            }
        }
        if (best < 0 || lengths[at] > lengths[best]) {
            best = at;
        }
    }
    const kept = new Set<number>();
    for (let at = best; at >= 0; at = previous[at]) {
        kept.add(at);
    }
    let current = best < 0 ? 0 : sections[Math.min(...kept)];
    const slidesBySection = sectionXmlList.map(() => {
        return [] as string[];
    });
    for (const [at, id] of ids.entries()) {
        if (kept.has(at)) {
            current = sections[at];
        }
        slidesBySection[current].push(id);
    }
    const newSections = sectionXmlList.map((sectionXml, index) => {
        const slides = slidesBySection[index];
        return sectionXml.replace(
            SECTION_SLIDES_PATTERN,
            slides.length === 0
                ? '<p14:sldIdLst/>'
                : `<p14:sldIdLst>${slides
                      .map((id) => {
                          return `<p14:sldId id="${id}"/>`;
                      })
                      .join('')}</p14:sldIdLst>`,
        );
    });
    let sectionIndex = 0;
    const newInner = listMatch[2].replace(SECTION_PATTERN, () => {
        return newSections[sectionIndex++];
    });
    return presentationXml.replace(
        SECTION_LIST_PATTERN,
        (_whole, open: string, _inner: string, close: string) => {
            return open + newInner + close;
        },
    );
}

/**
 * Why a slide cannot be taken out: another part links to it, or a custom
 * show lists it. Null when nothing else names it.
 */
async function findSlideLinkReason(
    mainPath: string,
    readPart: (name: string) => Promise<string | null>,
    names: string[],
    slide: OfficeSlideType,
    presentationXml: string,
) {
    const own = new Set([
        toRelsPath(mainPath),
        slide.relsPath,
        ...(slide.notesPath === null ? [] : [toRelsPath(slide.notesPath)]),
    ]);
    for (const name of names) {
        if (!name.endsWith('.rels') || own.has(name)) {
            continue;
        }
        const relsXml = await readPart(name);
        if (relsXml === null) {
            continue;
        }
        const sourcePath = name
            .replace(/_rels\/([^/]+)\.rels$/, '$1')
            .replace(/^_rels\//, '');
        for (const rel of parseRels(relsXml)) {
            if (
                !rel.isExternal &&
                resolvePartPath(sourcePath, rel.target) === slide.partPath
            ) {
                const other = /slides\/slide\d+\.xml$/.test(sourcePath)
                    ? 'another slide links to it'
                    : 'another part of the deck points at it';
                return (
                    `Slide ${slide.number} cannot be taken out here: ${other}. ` +
                    'Remove it in PowerPoint, which mends the links.'
                );
            }
        }
    }
    const shows = /<p:custShowLst>[\s\S]*?<\/p:custShowLst>/.exec(
        presentationXml,
    );
    if (shows !== null && new RegExp(`r:id="${slide.relId}"`).test(shows[0])) {
        return (
            `Slide ${slide.number} is in a custom slide show, so it cannot be ` +
            'taken out here. Remove it in PowerPoint.'
        );
    }
    return null;
}
