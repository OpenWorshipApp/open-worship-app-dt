// A Word file's PAGE COLOUR and a PICTURE put into its body, for
// `owa_office_edit`: what PowerPoint could already be given (a slide's
// background, a picture on a slide), given to a `.docx`.
//
// Pure, strings in and out, the same tag rules as `officeXmlEditHelpers`:
// no DOM parser, so a megabyte body keeps every byte it is not asked to
// change. The package plumbing (the media part, its relationship and content
// type) is the caller's.

import { escapeXMLAttribute } from './officeXmlHelpers';
import { type ElementType, listChildElements } from './officeXmlEditHelpers';

const WORD_DRAWING_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const DRAWING_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/main';
const PICTURE_NAMESPACE =
    'http://schemas.openxmlformats.org/drawingml/2006/picture';
const RELATIONSHIP_NAMESPACE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const EMU_PER_PIXEL = 9525;
const EMU_PER_TWIP = 635;
// Word's own default page: Letter, an inch each side
const DEFAULT_PAGE_WIDTH_TWIPS = 12240;
const DEFAULT_MARGIN_TWIPS = 1440;
const DEFAULT_TEXT_WIDTH_EMU = 6.5 * 914400;

// An element's open tag; a quoted value may hold `>`.
function genOpenTagPattern(name: string) {
    return new RegExp(`<${name}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*?(/?)>`);
}

const DOCUMENT_OPEN_PATTERN = genOpenTagPattern('w:document');
const SETTINGS_OPEN_PATTERN = genOpenTagPattern('w:settings');

function readAttribute(tag: string, name: string) {
    const matched = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    ).exec(tag);
    return matched === null ? null : (matched[1] ?? matched[2]);
}

// An element taken out with the indent before it, so a pretty-printed part
// keeps no empty line behind.
function toRemovalStart(xml: string, element: ElementType) {
    let at = element.start;
    while (at > 0 && /\s/.test(xml[at - 1])) {
        at--;
    }
    return xml[at - 1] === '>' ? at : element.start;
}

type EditType = { start: number; end: number; text: string };

function applyEdits(xml: string, edits: EditType[]) {
    return [...edits]
        .sort((a, b) => {
            // at one place, a removal goes before what is put there
            return b.start - a.start || b.end - a.end;
        })
        .reduce((out, edit) => {
            return out.slice(0, edit.start) + edit.text + out.slice(edit.end);
        }, xml);
}

// The children of the part's root, or null when it has none to hold.
function readRootChildren(xml: string, openPattern: RegExp, name: string) {
    const open = openPattern.exec(xml);
    if (open === null) {
        return null;
    }
    const innerStart = open.index + open[0].length;
    if (open[1] === '/') {
        return { open, innerStart, innerEnd: innerStart, children: [] };
    }
    const innerEnd = xml.lastIndexOf(`</${name}>`);
    if (innerEnd < innerStart) {
        return null;
    }
    const children = listChildElements(xml, innerStart, innerEnd);
    return { open, innerStart, innerEnd, children };
}

// --- page colour --------------------------------------------------------------

/**
 * The Word body with one page colour, `RRGGBB`, as `w:background` -- the
 * document's first child, before `w:body` -- or, `null`, with none. A
 * background already there is replaced by the plain colour (a picture or
 * gradient fill it held is dropped). Word shows it only with
 * `setWordDisplayBackgroundXml` on in the settings part.
 */
export function setWordPageColorXml(
    documentXml: string,
    color: string | null,
): string | { reason: string } {
    if (color !== null && !/^[\da-f]{6}$/i.test(color)) {
        return {
            reason:
                `The page colour ${JSON.stringify(color)} is not one: give ` +
                'it as 6 hex digits with no #, such as FFF2CC, or null to ' +
                'take the page colour off.',
        };
    }
    const root = readRootChildren(
        documentXml,
        DOCUMENT_OPEN_PATTERN,
        'w:document',
    );
    if (root === null || root.open[1] === '/') {
        return {
            reason:
                'This Word file has no document body to colour: its main ' +
                'part may be damaged. Open it in Word and save it again.',
        };
    }
    const backgrounds = root.children.filter((child) => {
        return child.name === 'w:background';
    });
    if (color === null && backgrounds.length === 0) {
        return documentXml;
    }
    const edits: EditType[] = backgrounds.map((child) => {
        return {
            start: toRemovalStart(documentXml, child),
            end: child.end,
            text: '',
        };
    });
    if (color !== null) {
        edits.push({
            start: root.innerStart,
            end: root.innerStart,
            text: `<w:background w:color="${color.toUpperCase()}"/>`,
        });
    }
    return applyEdits(documentXml, edits);
}

/** The Word body's page colour, `RRGGBB`, or null when it has none. */
export function readWordPageColor(documentXml: string): string | null {
    const root = readRootChildren(
        documentXml,
        DOCUMENT_OPEN_PATTERN,
        'w:document',
    );
    const background = root?.children.find((child) => {
        return child.name === 'w:background';
    });
    if (background === undefined) {
        return null;
    }
    const tag = documentXml.slice(background.start, background.openEnd);
    // `auto` and a missing colour are no colour
    const color = readAttribute(tag, 'w:color');
    return color !== null && /^[\da-f]{6}$/i.test(color)
        ? color.toUpperCase()
        : null;
}

// What comes before `w:displayBackgroundShape` in CT_Settings; everything
// else comes after it.
const SETTINGS_BEFORE_BACKGROUND_SET = new Set([
    'w:writeProtection',
    'w:view',
    'w:zoom',
    'w:removePersonalInformation',
    'w:removeDateAndTime',
    'w:doNotDisplayPageBoundaries',
]);
const DISPLAY_BACKGROUND_NAME = 'w:displayBackgroundShape';

function checkIsSwitchOn(tag: string) {
    const value = readAttribute(tag, 'w:val');
    return value === null || /^(?:1|true|on)$/i.test(value.trim());
}

/**
 * `word/settings.xml` with `w:displayBackgroundShape` -- without it Word
 * draws no page colour -- in its schema place, or with it taken out.
 * Unchanged when there is nothing to change or no `w:settings`.
 */
export function setWordDisplayBackgroundXml(
    settingsXml: string,
    isOn: boolean,
): string {
    const root = readRootChildren(
        settingsXml,
        SETTINGS_OPEN_PATTERN,
        'w:settings',
    );
    if (root === null) {
        return settingsXml;
    }
    const found = root.children.filter((child) => {
        return child.name === DISPLAY_BACKGROUND_NAME;
    });
    if (!isOn && found.length === 0) {
        return settingsXml;
    }
    if (
        isOn &&
        found.length === 1 &&
        checkIsSwitchOn(settingsXml.slice(found[0].start, found[0].openEnd))
    ) {
        return settingsXml;
    }
    const edits: EditType[] = found.map((child) => {
        return {
            start: toRemovalStart(settingsXml, child),
            end: child.end,
            text: '',
        };
    });
    if (isOn) {
        const shapeXml = `<${DISPLAY_BACKGROUND_NAME}/>`;
        if (root.open[1] === '/') {
            // `<w:settings/>` is opened to hold it
            const openXml = root.open[0].replace(/\s*\/>$/, '>');
            return (
                settingsXml.slice(0, root.open.index) +
                openXml +
                shapeXml +
                '</w:settings>' +
                settingsXml.slice(root.innerStart)
            );
        }
        const next = root.children.find((child) => {
            return (
                child.name !== DISPLAY_BACKGROUND_NAME &&
                !SETTINGS_BEFORE_BACKGROUND_SET.has(child.name)
            );
        });
        const before = root.children.filter((child) => {
            return SETTINGS_BEFORE_BACKGROUND_SET.has(child.name);
        });
        const at =
            next?.start ?? before[before.length - 1]?.end ?? root.innerStart;
        edits.push({ start: at, end: at, text: shapeXml });
    }
    return applyEdits(settingsXml, edits);
}

// --- a picture ------------------------------------------------------------------

/**
 * One paragraph holding an INLINE picture: `relId` its image's relationship
 * from the body, `pictureId` a `wp:docPr` id no other drawing has
 * (`nextWordDrawingId`), its size in EMU. The `wp`, `a`, `pic` and `r`
 * prefixes are declared where they are used: a body Word wrote declares
 * them all, one another program wrote (this app's own Bible export) may
 * declare only `w`.
 */
export function genWordPictureParagraphXml({
    relId,
    pictureId,
    name,
    widthEmu,
    heightEmu,
    align,
}: {
    relId: string;
    pictureId: number;
    name: string;
    widthEmu: number;
    heightEmu: number;
    align?: 'left' | 'center' | 'right';
}): string {
    const cx = Math.max(1, Math.round(widthEmu) || 0);
    const cy = Math.max(1, Math.round(heightEmu) || 0);
    const id = Math.max(1, Math.round(pictureId) || 0);
    const shownName = escapeXMLAttribute(
        name.trim() === '' ? `Picture ${id}` : name,
    );
    const propsXml =
        align === undefined ? '' : `<w:pPr><w:jc w:val="${align}"/></w:pPr>`;
    return (
        `<w:p>${propsXml}<w:r><w:drawing>` +
        `<wp:inline xmlns:wp="${WORD_DRAWING_NAMESPACE}" ` +
        `xmlns:a="${DRAWING_NAMESPACE}" ` +
        'distT="0" distB="0" distL="0" distR="0">' +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
        `<wp:docPr id="${id}" name="${shownName}"/>` +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/>' +
        '</wp:cNvGraphicFramePr>' +
        `<a:graphic><a:graphicData uri="${PICTURE_NAMESPACE}">` +
        `<pic:pic xmlns:pic="${PICTURE_NAMESPACE}" ` +
        `xmlns:r="${RELATIONSHIP_NAMESPACE}">` +
        `<pic:nvPicPr><pic:cNvPr id="0" name="${shownName}"/><pic:cNvPicPr/>` +
        '</pic:nvPicPr>' +
        `<pic:blipFill><a:blip r:embed="${escapeXMLAttribute(relId)}"/>` +
        '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
        `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
        '</pic:pic></a:graphicData></a:graphic></wp:inline>' +
        '</w:drawing></w:r></w:p>'
    );
}

/**
 * A picture's size in the body, in EMU, its shape kept: its own size at
 * 96 dpi, no wider than the text (`maxWidthEmu`), or -- `widthPercent`,
 * 1 to 100 -- that share of the text's width.
 */
export function fitWordPicture(
    pixelWidth: number,
    pixelHeight: number,
    maxWidthEmu: number,
    widthPercent?: number,
): { widthEmu: number; heightEmu: number } {
    const width = Math.max(1, pixelWidth || 0);
    const height = Math.max(1, pixelHeight || 0);
    const maxWidth = Math.max(1, maxWidthEmu || 0);
    const widthEmu =
        widthPercent !== undefined && Number.isFinite(widthPercent)
            ? maxWidth * (Math.min(100, Math.max(1, widthPercent)) / 100)
            : Math.min(width * EMU_PER_PIXEL, maxWidth);
    return {
        widthEmu: Math.max(1, Math.round(widthEmu)),
        heightEmu: Math.max(1, Math.round((widthEmu * height) / width)),
    };
}

// --- the page -------------------------------------------------------------------

const SECTION_OPEN = '<w:sectPr';

// The last `<w:sectPr` open tag before `before`, never `<w:sectPrChange`.
function findSectionOpen(xml: string, before: number) {
    let at = xml.lastIndexOf(SECTION_OPEN, before - 1);
    while (at >= 0 && !/[\s/>]/.test(xml[at + SECTION_OPEN.length] ?? '')) {
        at = xml.lastIndexOf(SECTION_OPEN, at - 1);
    }
    return at;
}

// The body's own section properties -- the last to close -- without the old
// copy a tracked change keeps inside them.
function readLastSectionXml(xml: string) {
    const close = xml.lastIndexOf('</w:sectPr>');
    if (close < 0) {
        return null;
    }
    let open = findSectionOpen(xml, close);
    if (open >= 0 && xml.lastIndexOf('</w:sectPrChange>', close) > open) {
        open = findSectionOpen(xml, xml.lastIndexOf('<w:sectPrChange', open));
    }
    if (open < 0) {
        return null;
    }
    const change = xml.indexOf('<w:sectPrChange', open);
    return xml.slice(open, change >= 0 && change < close ? change : close);
}

function readTwips(sectionXml: string, element: string, attribute: string) {
    const tag = genOpenTagPattern(element).exec(sectionXml)?.[0];
    const value = tag === undefined ? null : readAttribute(tag, attribute);
    const twips = value === null ? NaN : Number(value);
    return Number.isFinite(twips) ? twips : null;
}

/**
 * How wide the body's text runs, in EMU: the last section's page width less
 * its left and right margins and its gutter (Word takes that from the text
 * too). 6.5 inches -- Letter with inch margins -- when nothing says.
 */
export function readWordTextWidthEmu(documentXml: string): number {
    const sectionXml = readLastSectionXml(documentXml);
    if (sectionXml === null) {
        return DEFAULT_TEXT_WIDTH_EMU;
    }
    const pageWidth =
        readTwips(sectionXml, 'w:pgSz', 'w:w') ?? DEFAULT_PAGE_WIDTH_TWIPS;
    const left =
        readTwips(sectionXml, 'w:pgMar', 'w:left') ?? DEFAULT_MARGIN_TWIPS;
    const right =
        readTwips(sectionXml, 'w:pgMar', 'w:right') ?? DEFAULT_MARGIN_TWIPS;
    const gutter = readTwips(sectionXml, 'w:pgMar', 'w:gutter') ?? 0;
    const textTwips = pageWidth - left - right - gutter;
    return textTwips > 0
        ? Math.round(textTwips * EMU_PER_TWIP)
        : DEFAULT_TEXT_WIDTH_EMU;
}

/** One more than the largest `wp:docPr` id in the body: 1 when none. */
export function nextWordDrawingId(documentXml: string): number {
    let largest = 0;
    for (const matched of documentXml.matchAll(
        /<wp:docPr(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*?\sid\s*=\s*["'](\d+)["']/g,
    )) {
        largest = Math.max(largest, Number(matched[1]));
    }
    return largest + 1;
}
