// A slide's NUMBER and FOOTER put on or taken off for `owa_office_edit`
// (2026-11-21, the goal _chatbot can change do everything on a given
// pptx_): what PowerPoint's Insert → Header & Footer does to each slide.
//
// PowerPoint writes no setting for it: each slide gets a placeholder box of
// the kind its layout holds (`<p:ph type="sldNum">`, `type="ftr"`), with the
// layout's own `p:ph` tag so the box takes the layout's place and look, and
// a slide number is a FIELD (`a:fld type="slidenum"`) every reader fills
// in. A layout with no such box (and a master with none) has no place for
// one: that slide is said, never given a box out of nowhere.
//
// Pure, strings in and out, the same tag scanner as the words.

import { escapeXmlText } from './officeXmlEditHelpers';
import { findFreeBoxName, listSlideBoxes } from './officeSlideBoxHelpers';

export type OfficeFooterKindType = 'sldNum' | 'ftr';

const BOX_NAME_MAP: Record<OfficeFooterKindType, string> = {
    sldNum: 'Slide Number Placeholder',
    ftr: 'Footer Placeholder',
};
// the field id PowerPoint's own blank deck uses, when the layout has none
const SLIDE_NUMBER_FIELD_ID = '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}';

function findPlaceholderTag(xml: string, kind: OfficeFooterKindType) {
    return (
        new RegExp(`<p:ph\\b[^>]*\\stype="${kind}"[^>]*?/?>`).exec(xml)?.[0] ??
        null
    );
}

/** The boxes of `kind` the slide has, last first (to take off in turn). */
function listFooterBoxes(slideXml: string, kind: OfficeFooterKindType) {
    return listSlideBoxes(slideXml)
        .filter((box) => {
            return (
                !box.isGrouped &&
                new RegExp(`<p:ph\\b[^>]*\\stype="${kind}"`).test(
                    slideXml.slice(box.start, box.end),
                )
            );
        })
        .reverse();
}

/** Whether the slide's layout is a title slide's. */
export function checkIsTitleLayout(layoutXml: string | null) {
    return /<p:sldLayout\b[^>]*\stype="title"/.test(layoutXml ?? '');
}

/**
 * The slide with its number or footer put on -- `text` the footer's words,
 * escaped here -- or taken off (`text` null for a footer, `isOn` false for
 * a number). `state`: what was done; `noPlace` when neither its layout nor
 * its master has a box of that kind.
 */
export function setSlideFooterXml(
    slideXml: string,
    kind: OfficeFooterKindType,
    isOn: boolean,
    text: string | null,
    layoutXml: string | null,
    masterXml: string | null,
    // what the number reads until the show fills it in
    slideNumber = 1,
): {
    xml: string;
    state: 'added' | 'changed' | 'removed' | 'unchanged' | 'noPlace';
} {
    const present = listFooterBoxes(slideXml, kind);
    if (!isOn) {
        let xml = slideXml;
        for (const box of present) {
            xml = xml.slice(0, box.start) + xml.slice(box.end);
        }
        return {
            xml,
            state: present.length === 0 ? 'unchanged' : 'removed',
        };
    }
    const fieldId =
        /<a:fld\b[^>]*\sid="(\{[0-9A-Fa-f-]+\})"[^>]*\stype="slidenum"/.exec(
            layoutXml ?? '',
        )?.[1] ?? SLIDE_NUMBER_FIELD_ID;
    const paragraph =
        kind === 'sldNum'
            ? `<a:p><a:fld id="${fieldId}" type="slidenum"><a:rPr/>` +
              `<a:t>${slideNumber}</a:t></a:fld><a:endParaRPr/></a:p>`
            : `<a:p><a:r><a:rPr/><a:t>${escapeXmlText(text ?? '')}</a:t>` +
              '</a:r></a:p>';
    if (present.length > 0) {
        if (kind === 'sldNum') {
            return { xml: slideXml, state: 'unchanged' };
        }
        // the footer's words replaced, its box and look kept
        const box = present[present.length - 1];
        const boxXml = slideXml.slice(box.start, box.end);
        const first = boxXml.search(/<a:p[\s>]/);
        const last = boxXml.lastIndexOf('</a:p>');
        const made =
            first < 0 || last < first
                ? boxXml.replace('</p:txBody>', `${paragraph}</p:txBody>`)
                : boxXml.slice(0, first) +
                  paragraph +
                  boxXml.slice(last + '</a:p>'.length);
        return {
            xml: slideXml.slice(0, box.start) + made + slideXml.slice(box.end),
            state: made === boxXml ? 'unchanged' : 'changed',
        };
    }
    const tag =
        findPlaceholderTag(layoutXml ?? '', kind) ??
        findPlaceholderTag(masterXml ?? '', kind);
    const treeEnd = slideXml.lastIndexOf('</p:spTree>');
    if (tag === null || treeEnd < 0) {
        return { xml: slideXml, state: 'noPlace' };
    }
    const { id, name } = findFreeBoxName(slideXml, BOX_NAME_MAP[kind]);
    const boxXml =
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr>` +
        `<a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${tag.replace(/\s*\/?>$/, '/>')}` +
        '</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
        `${paragraph}</p:txBody></p:sp>`;
    return {
        xml: slideXml.slice(0, treeEnd) + boxXml + slideXml.slice(treeEnd),
        state: 'added',
    };
}
