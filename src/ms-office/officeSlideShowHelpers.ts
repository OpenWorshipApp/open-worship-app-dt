// How a PowerPoint deck is SHOWN: a slide's transition, the seconds it
// waits before the next one by itself, and the deck's slide size --
// changed for `owa_office_edit` (2026-11-20, the goal _chatbot can change
// do everything on a given pptx_: _add a fade transition to every slide_
// and _make the slides 4:3_ had both been answered "that must be done in
// PowerPoint").
//
// Pure, strings in and out.

import {
    type BoxPlaceType,
    type SlideSizeType,
    listSlideBoxes,
    readBoxPlace,
    setBoxPlaceXml,
} from './officeSlideBoxHelpers';

// The transitions every PowerPoint since 2007 draws, by the name a person
// says; "uncover" is PresentationML's `pull`.
const TRANSITION_XML_MAP: Record<string, string> = {
    fade: '<p:fade/>',
    push: '<p:push/>',
    wipe: '<p:wipe/>',
    cover: '<p:cover/>',
    uncover: '<p:pull/>',
    split: '<p:split/>',
    dissolve: '<p:dissolve/>',
    zoom: '<p:zoom/>',
    wheel: '<p:wheel/>',
    random: '<p:random/>',
    cut: '<p:cut/>',
};

export const OFFICE_TRANSITION_LIST = [
    ...Object.keys(TRANSITION_XML_MAP),
    'none',
];

/** A transition's name as asked ("Fade", "fade in"), or null. */
export function toOfficeTransition(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value
        .trim()
        .toLowerCase()
        .replace(/\s+(?:in|out|through|transition)$/, '');
    return OFFICE_TRANSITION_LIST.includes(text) ? text : null;
}

type SlideChildType = { start: number; end: number; xml: string };

// `p:sld`'s own children after `p:cSld`: what holds a transition (a plain
// one, or one Office wrote twice for older readers) and where one goes.
function readShowChildren(slideXml: string) {
    const cSldEnd = slideXml.indexOf('</p:cSld>');
    if (cSldEnd < 0) {
        return null;
    }
    let insertAt = cSldEnd + '</p:cSld>'.length;
    const colorMap = /^\s*<p:clrMapOvr\b[\s\S]*?<\/p:clrMapOvr>/.exec(
        slideXml.slice(insertAt),
    );
    if (colorMap !== null) {
        insertAt += colorMap[0].length;
    }
    let transition: SlideChildType | null = null;
    const rest = slideXml.slice(insertAt);
    const plain =
        /^\s*(<p:transition\b(?:[^>"']|"[^"]*"|'[^']*')*?(?:\/>|>[\s\S]*?<\/p:transition>))/.exec(
            rest,
        );
    const wrapped =
        /^\s*(<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>)/.exec(
            rest,
        );
    const found =
        plain ??
        (wrapped !== null && /<p:transition\b/.test(wrapped[1])
            ? wrapped
            : null);
    if (found !== null) {
        const start = insertAt + found[0].length - found[1].length;
        transition = {
            start,
            end: start + found[1].length,
            xml: found[1],
        };
    }
    return { insertAt, transition };
}

/**
 * A slide's transition (`kind`: a name of `OFFICE_TRANSITION_LIST`, "none"
 * takes it off) and the seconds it waits before going on by itself
 * (`advance`; 0 waits for a click again). Either left out is kept as it
 * was. Null when the slide cannot be read.
 */
export function setSlideTransitionXml(
    slideXml: string,
    change: { kind?: string; advance?: number },
) {
    const read = readShowChildren(slideXml);
    if (read === null) {
        return null;
    }
    const existing = read.transition;
    // only the time changed: written into each copy of what is there
    if (change.kind === undefined && existing !== null) {
        const advance = change.advance ?? 0;
        const xml = existing.xml.replace(
            /<p:transition\b[^>]*?(\/?)>/g,
            (tag, slash) => {
                const kept = tag
                    .replace(/\sadvTm="[^"]*"/, '')
                    .replace(/\s*\/?>$/, '');
                return (
                    kept +
                    (advance > 0
                        ? ` advTm="${Math.round(advance * 1000)}"`
                        : '') +
                    `${slash}>`
                );
            },
        );
        return (
            slideXml.slice(0, existing.start) +
            xml +
            slideXml.slice(existing.end)
        );
    }
    const oldTag =
        existing === null
            ? ''
            : (/<p:transition\b[^>]*>/.exec(existing.xml)?.[0] ?? '');
    const oldTime = /\sadvTm="(\d+)"/.exec(oldTag)?.[1];
    const time =
        change.advance === undefined
            ? oldTime === undefined
                ? null
                : Number(oldTime)
            : change.advance > 0
              ? Math.round(change.advance * 1000)
              : null;
    const effect =
        change.kind === undefined || change.kind === 'none'
            ? ''
            : TRANSITION_XML_MAP[change.kind];
    let written = '';
    if (effect !== '' || time !== null) {
        const attributes =
            (effect === '' ? '' : ' spd="med"') +
            (time === null ? '' : ` advTm="${time}"`);
        written =
            effect === ''
                ? `<p:transition${attributes}/>`
                : `<p:transition${attributes}>${effect}</p:transition>`;
    }
    return existing === null
        ? slideXml.slice(0, read.insertAt) +
              written +
              slideXml.slice(read.insertAt)
        : slideXml.slice(0, existing.start) +
              written +
              slideXml.slice(existing.end);
}

/** The transition a slide has, by name, and its seconds; for the read. */
export function readSlideTransition(slideXml: string) {
    const transition = readShowChildren(slideXml)?.transition ?? null;
    if (transition === null) {
        return null;
    }
    // of the two copies Office writes, the one every reader reads
    const fallback =
        /<mc:Fallback>([\s\S]*?)<\/mc:Fallback>/.exec(transition.xml)?.[1] ??
        transition.xml;
    const kind =
        Object.entries(TRANSITION_XML_MAP).find(([, xml]) => {
            return fallback.includes(xml.replace(/\/>$/, ''));
        })?.[0] ?? (/<p:transition\b[^>]*\/>/.test(fallback) ? null : 'other');
    const time = /\sadvTm="(\d+)"/.exec(fallback)?.[1];
    return {
        ...(kind === null ? {} : { kind }),
        ...(time === undefined ? {} : { advance: Number(time) / 1000 }),
    };
}

// --- the slide size ----------------------------------------------------------

// PowerPoint's own sizes, all as tall as each other.
const SLIDE_SIZE_MAP: Record<string, SlideSizeType & { type: string | null }> =
    {
        '16:9': { cx: 12192000, cy: 6858000, type: null },
        '4:3': { cx: 9144000, cy: 6858000, type: 'screen4x3' },
        '16:10': { cx: 10972800, cy: 6858000, type: 'screen16x10' },
    };

export const OFFICE_SLIDE_SIZE_LIST = Object.keys(SLIDE_SIZE_MAP);

/** "4:3", "4x3", "widescreen", "standard" -- the size meant, or null. */
export function toOfficeSlideSize(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value
        .trim()
        .toLowerCase()
        .replace(/\s*[x/]\s*/, ':');
    const word: Record<string, string> = {
        widescreen: '16:9',
        wide: '16:9',
        standard: '4:3',
    };
    const key = word[text] ?? text;
    return Object.hasOwn(SLIDE_SIZE_MAP, key)
        ? { name: key, ...SLIDE_SIZE_MAP[key] }
        : null;
}

/**
 * `presentation.xml` with its slide size `size`: written over the one it
 * has, or -- a deck that says none, drawn at the default -- put where the
 * schema has it, after the lists of masters and slides.
 */
export function setPresentationSizeXml(
    presentationXml: string,
    size: SlideSizeType & { type: string | null },
) {
    const written =
        `<p:sldSz cx="${size.cx}" cy="${size.cy}"` +
        (size.type === null ? '' : ` type="${size.type}"`) +
        '/>';
    const existing =
        /<p:sldSz\b(?:[^>"']|"[^"]*"|'[^']*')*?(?:\/>|>[\s\S]*?<\/p:sldSz>)/;
    if (existing.test(presentationXml)) {
        return presentationXml.replace(existing, () => {
            return written;
        });
    }
    for (const close of [
        '</p:sldIdLst>',
        '</p:handoutMasterIdLst>',
        '</p:notesMasterIdLst>',
        '</p:sldMasterIdLst>',
    ]) {
        const at = presentationXml.indexOf(close);
        if (at >= 0) {
            const end = at + close.length;
            return (
                presentationXml.slice(0, end) +
                written +
                presentationXml.slice(end)
            );
        }
    }
    return presentationXml.replace(/<p:presentation\b[^>]*>/, (tag) => {
        return tag + written;
    });
}

/**
 * Every box a slide, a layout or a master places itself, moved and sized
 * for a slide of `to` instead of `from`: stretched with it, but a picture
 * that does not fill the slide keeps its shape, centred where it was.
 * Words keep their size; a box that inherits its place moves with its
 * layout.
 */
export function scaleSlidePartXml(
    partXml: string,
    from: SlideSizeType,
    to: SlideSizeType,
) {
    const rx = to.cx / from.cx;
    const ry = to.cy / from.cy;
    if (rx === 1 && ry === 1) {
        return partXml;
    }
    const boxes = listSlideBoxes(partXml, from).filter((box) => {
        return !box.isGrouped;
    });
    let xml = partXml;
    for (const box of [...boxes].reverse()) {
        const boxXml = xml.slice(box.start, box.end);
        const place = readBoxPlace(boxXml);
        if (place === null) {
            continue;
        }
        let next: BoxPlaceType;
        if (box.kind === 'picture' && !box.isFilling) {
            const scale = Math.min(rx, ry);
            const cx = Math.round(place.cx * scale);
            const cy = Math.round(place.cy * scale);
            next = {
                x: Math.round((place.x + place.cx / 2) * rx - cx / 2),
                y: Math.round((place.y + place.cy / 2) * ry - cy / 2),
                cx,
                cy,
            };
        } else {
            next = {
                x: Math.round(place.x * rx),
                y: Math.round(place.y * ry),
                cx: Math.round(place.cx * rx),
                cy: Math.round(place.cy * ry),
            };
        }
        const moved = setBoxPlaceXml(boxXml, next);
        if (moved !== null) {
            xml = xml.slice(0, box.start) + moved + xml.slice(box.end);
        }
    }
    return xml;
}
