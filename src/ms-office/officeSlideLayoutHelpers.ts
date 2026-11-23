// A NEW slide for a PowerPoint deck, made from one of the deck's own
// LAYOUTS -- Title Slide, Title and Content, Blank ... -- for
// `owa_office_edit` (2026-11-20): the assistant could change every slide a
// deck had, but not add one.
//
// The slide is what PowerPoint's New Slide writes: one placeholder box per
// placeholder of the layout that holds words, each naming the layout's own
// by its type and index and saying no place and no look of its own, so it is
// drawn where and how the deck draws that layout. A placeholder for a
// picture, a chart, a table, a video or a diagram is left off (an empty one
// would show only in PowerPoint's editor), and so are the date, footer,
// slide number and header ones (PowerPoint leaves them off a new slide).
//
// Pure, strings in and out. The package work -- the new part, its
// relationship to the layout, the content type, `presentation.xml`'s slide
// list -- is the caller's.

import { listSlideBoxes } from './officeSlideBoxHelpers';
import {
    escapeXmlText,
    scanTags,
    toXmlSafeText,
    unescapeXml,
} from './officeXmlEditHelpers';

export type OfficeLayoutPlaceholderType = {
    // as `p:ph type` reads it; 'body' for one named by its index alone
    type: string;
    idx: string | null;
    // the layout box's own name
    name: string;
};

export type OfficeLayoutType = {
    path: string;
    name: string;
    placeholders: OfficeLayoutPlaceholderType[];
};

// what a layout keeps for itself: a new slide carries none of them
const NOT_ON_SLIDE_SET = new Set(['dt', 'ftr', 'sldNum', 'hdr']);
// what holds no words: a new slide carries none of them either
const NO_WORDS_SET = new Set([
    'pic',
    'chart',
    'tbl',
    'media',
    'clipArt',
    'dgm',
]);
const TITLE_SET = new Set(['title', 'ctrTitle']);
const LINES_SET = new Set(['body', 'obj', 'subTitle']);

// PowerPoint's name for a placeholder box, before its number ("Title 1",
// "Content Placeholder 2"); a `p:ph` with no type is a content one
const PLACEHOLDER_NAME_MAP = new Map([
    ['title', 'Title'],
    ['ctrTitle', 'Title'],
    ['subTitle', 'Subtitle'],
    ['body', 'Text Placeholder'],
    ['obj', 'Content Placeholder'],
]);

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NAMESPACE_ATTRIBUTES =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const GROUP_HEADER_XML =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
    '</p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/>' +
    '<a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/>' +
    '</a:xfrm></p:grpSpPr>';
// what PowerPoint writes in a placeholder no one has typed in
const EMPTY_PARAGRAPH_XML = '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>';

/** The layout's own name (`<p:cSld name=...>`), null when it has none. */
export function readLayoutName(layoutXml: string): string | null {
    for (const tag of scanTags(layoutXml)) {
        if (tag.name !== 'p:cSld' || tag.isClose) {
            continue;
        }
        const matched = /(?:^|\s)name\s*=\s*("([^"]*)"|'([^']*)')/.exec(
            tag.attributes,
        );
        const name = unescapeXml(matched?.[2] ?? matched?.[3] ?? '').trim();
        return name === '' ? null : name;
    }
    return null;
}

// A `p:ph` attribute written back on the slide: a word or a number, as the
// schema has them all -- anything else is not copied.
function readPlaceholderAttribute(tag: string, name: string) {
    const matched = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    ).exec(tag);
    const value = matched === null ? null : (matched[1] ?? matched[2]);
    return value !== null && /^[A-Za-z0-9]+$/.test(value) ? value : null;
}

type LayoutPlaceholderType = OfficeLayoutPlaceholderType & {
    // the type as written, null when it is not
    writtenType: string | null;
    orient: string | null;
    sz: string | null;
};

function readLayoutPlaceholders(layoutXml: string) {
    const out: LayoutPlaceholderType[] = [];
    for (const box of listSlideBoxes(layoutXml)) {
        if (box.isGrouped || box.kind === 'group') {
            continue;
        }
        const boxXml = layoutXml.slice(box.start, box.end);
        const nonVisual = /<p:nv\w+Pr\b[\s\S]*?<\/p:nv\w+Pr>/.exec(boxXml)?.[0];
        const tag =
            nonVisual === undefined
                ? undefined
                : /<p:ph\b[^>]*>/.exec(nonVisual)?.[0];
        if (tag === undefined) {
            continue;
        }
        const writtenType = readPlaceholderAttribute(tag, 'type');
        const type = writtenType ?? 'body';
        if (NOT_ON_SLIDE_SET.has(type)) {
            continue;
        }
        out.push({
            type,
            idx: readPlaceholderAttribute(tag, 'idx'),
            name: box.name,
            writtenType,
            orient: readPlaceholderAttribute(tag, 'orient'),
            sz: readPlaceholderAttribute(tag, 'sz'),
        });
    }
    return out;
}

/**
 * The layout's placeholders that hold words or content on a slide, in its
 * order -- not its date, footer, slide number or header.
 */
export function listLayoutPlaceholders(
    layoutXml: string,
): OfficeLayoutPlaceholderType[] {
    return readLayoutPlaceholders(layoutXml).map(({ type, idx, name }) => {
        return { type, idx, name };
    });
}

/**
 * A layout part read for `pickLayout`; one with no name is called by its
 * file's ("slideLayout3").
 */
export function readOfficeLayout(
    path: string,
    layoutXml: string,
): OfficeLayoutType {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    return {
        path,
        name: readLayoutName(layoutXml) ?? fileName.replace(/\.xml$/i, ''),
        placeholders: listLayoutPlaceholders(layoutXml),
    };
}

// --- which layout --------------------------------------------------------

// words a name is asked with that say nothing of which layout it is
const FILLER_WORD_SET = new Set([
    'a',
    'an',
    'and',
    'the',
    'with',
    'layout',
    'slide',
]);

// any case, any script; spaces and punctuation are not words
function toWords(text: string) {
    return text
        .toLowerCase()
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter((word) => {
            return word !== '';
        });
}

function withoutFillers(words: string[]) {
    const kept = words.filter((word) => {
        return !FILLER_WORD_SET.has(word);
    });
    return kept.length > 0 ? kept : words;
}

function checkHasType(layout: OfficeLayoutType, types: readonly string[]) {
    return layout.placeholders.some((placeholder) => {
        return types.includes(placeholder.type);
    });
}

function checkIsTitleAndContent(layout: OfficeLayoutType) {
    return (
        checkHasType(layout, ['title']) && checkHasType(layout, ['body', 'obj'])
    );
}

/**
 * Which layout a new slide takes. `asked` is a name as the model wrote it:
 * any case, spaces and punctuation ignored, "layout" / "slide" / "and" left
 * aside, a word of the name enough ("caption"); 'blank' is the layout with
 * no placeholders, 'title' the title slide's (a centred title). Null asks
 * for the deck's "Title and Content" one -- a title and a body -- else its
 * first. The deck's order is its parts' numbers, whatever order they come
 * in. Null when nothing fits the name asked.
 */
export function pickLayout(
    layouts: readonly OfficeLayoutType[],
    asked: string | null,
): OfficeLayoutType | null {
    const ordered = [...layouts].sort((a, b) => {
        return a.path.localeCompare(b.path, undefined, { numeric: true });
    });
    const askedWords = asked === null ? [] : toWords(asked);
    if (askedWords.length === 0) {
        return (
            ordered.find((layout) => {
                return (
                    checkIsTitleAndContent(layout) &&
                    withoutFillers(toWords(layout.name)).join(' ') ===
                        'title content'
                );
            }) ??
            ordered.find((layout) => {
                return (
                    checkIsTitleAndContent(layout) &&
                    layout.placeholders.length === 2
                );
            }) ??
            ordered.find(checkIsTitleAndContent) ??
            ordered[0] ??
            null
        );
    }
    const named = ordered.map((layout) => {
        return { layout, words: toWords(layout.name) };
    });
    const wanted = withoutFillers(askedWords);
    const wantedKey = wanted.join('');
    const found =
        named.find((one) => {
            return one.words.join('') === askedWords.join('');
        }) ??
        named.find((one) => {
            return withoutFillers(one.words).join('') === wantedKey;
        }) ??
        (wantedKey === 'blank'
            ? named.find((one) => {
                  return one.layout.placeholders.length === 0;
              })
            : undefined) ??
        (wantedKey === 'title'
            ? named.find((one) => {
                  return checkHasType(one.layout, ['ctrTitle']);
              })
            : undefined) ??
        named.find((one) => {
            return wanted.every((word) => {
                return one.words.includes(word);
            });
        }) ??
        named.find((one) => {
            const key = one.words.join('');
            return wanted.every((word) => {
                return key.includes(word);
            });
        });
    return found?.layout ?? null;
}

// --- the new slide -------------------------------------------------------

function toPlaceholderName(placeholder: LayoutPlaceholderType, id: number) {
    const kind =
        PLACEHOLDER_NAME_MAP.get(placeholder.writtenType ?? 'obj') ??
        'Placeholder';
    const vertical = placeholder.orient === 'vert' ? 'Vertical ' : '';
    return `${vertical}${kind} ${id - 1}`;
}

// The words of one paragraph: a line break in them is one inside it. Their
// runs say no language -- the words may be in any -- so the deck's own
// default is theirs.
function genParagraphXml(text: string) {
    const parts = toXmlSafeText(text).split('\n');
    if (
        parts.every((part) => {
            return part === '';
        })
    ) {
        return EMPTY_PARAGRAPH_XML;
    }
    const runs = parts
        .map((part) => {
            return part === ''
                ? ''
                : `<a:r><a:rPr dirty="0"/><a:t>${escapeXmlText(part)}</a:t></a:r>`;
        })
        .join('<a:br/>');
    return `<a:p>${runs}</a:p>`;
}

function genPlaceholderBoxXml(
    placeholder: LayoutPlaceholderType,
    id: number,
    paragraphsXml: string,
) {
    // the layout's own `p:ph`, so the box takes its place and look from it
    const attributes = (
        [
            ['type', placeholder.writtenType],
            ['orient', placeholder.orient],
            ['sz', placeholder.sz],
            ['idx', placeholder.idx],
        ] as const
    )
        .filter(([, value]) => {
            return value !== null;
        })
        .map(([name, value]) => {
            return ` ${name}="${value}"`;
        })
        .join('');
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" ` +
        `name="${toPlaceholderName(placeholder, id)}"/><p:cNvSpPr>` +
        '<a:spLocks noGrp="1"/></p:cNvSpPr>' +
        `<p:nvPr><p:ph${attributes}/></p:nvPr></p:nvSpPr><p:spPr/>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</p:txBody></p:sp>`
    );
}

/**
 * A new slide on the layout `layoutXml`: `title` in its first title box,
 * `lines` one paragraph each in its first text or content box, every other
 * box empty. `leftOut` holds the words the layout has no box for (a title
 * on a Blank one), to be told to the person -- never dropped silently.
 */
export function genSlideFromLayout(
    layoutXml: string,
    words: { title?: string; lines?: readonly string[] },
): { xml: string; leftOut: string[] } {
    const title = words.title ?? '';
    const lines = words.lines ?? [];
    const hasTitle = title.trim() !== '';
    const placeholders = readLayoutPlaceholders(layoutXml).filter(
        (placeholder) => {
            return !NO_WORDS_SET.has(placeholder.type);
        },
    );
    const titleAt = placeholders.findIndex((placeholder) => {
        return TITLE_SET.has(placeholder.type);
    });
    const linesAt = placeholders.findIndex((placeholder) => {
        return LINES_SET.has(placeholder.type);
    });
    const boxesXml = placeholders
        .map((placeholder, index) => {
            let paragraphsXml = EMPTY_PARAGRAPH_XML;
            if (index === titleAt && hasTitle) {
                paragraphsXml = genParagraphXml(title);
            } else if (index === linesAt && lines.length > 0) {
                paragraphsXml = lines.map(genParagraphXml).join('');
            }
            return genPlaceholderBoxXml(placeholder, index + 2, paragraphsXml);
        })
        .join('');
    const leftOut: string[] = [];
    if (hasTitle && titleAt < 0) {
        leftOut.push(title);
    }
    if (linesAt < 0) {
        leftOut.push(
            ...lines.filter((line) => {
                return line.trim() !== '';
            }),
        );
    }
    const xml =
        XML_HEADER +
        `<p:sld ${NAMESPACE_ATTRIBUTES}><p:cSld><p:spTree>` +
        GROUP_HEADER_XML +
        boxesXml +
        '</p:spTree></p:cSld>' +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
    return { xml, leftOut };
}

/** `genSlideFromLayout`'s slide alone. */
export function genSlideFromLayoutXml(
    layoutXml: string,
    words: { title?: string; lines?: readonly string[] },
): string {
    return genSlideFromLayout(layoutXml, words).xml;
}
