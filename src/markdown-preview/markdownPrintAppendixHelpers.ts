import type { DetailPanelRequestType } from '../location-name-lookup/detailPanelRequestHelpers';
import { MARKDOWN_REF_CLASS } from './markdownPreviewParamHelpers';
import { findMarkdownRef } from './markdownPreviewReferenceHelpers';
import {
    PRINT_APPENDIX_CLASS_NAME,
    removePrintAppendix,
} from './markdownPrintHelpers';

/**
 * The Bible text and the people and places a Markdown page names, printed
 * after its last line when the person asks for them (2026-11-12, the user:
 * _as a user I'd like to have bible text and name/location-name detail at
 * the bottom of the pdf_; _when print if there bible verses and names, ask
 * user do they want to print those information_).
 *
 * Imported only for a page that HAS such a link, and only to count them for
 * the question: what reads the verses and the records is
 * `markdownPrintAppendixReadHelpers.ts`, imported once the person says yes.
 * By then `markdownPreviewReferenceHelpers` made those links, so the import
 * below costs nothing more.
 */

// A page naming more than this prints the first ones and says how many were
// left out: a whole chapter is ~5 000 letters, and a low-spec machine reads
// every one of them before the print.
export const MAX_PRINTED_VERSES = 60;
export const MAX_PRINTED_RECORDS = 80;

// A verse whose Bible was named in brackets after it is that Bible's words
// alone (`readVerseEntries`).
export type PrintVerseRequestType = DetailPanelRequestType & {
    isBibleNamed?: true;
};

export type PrintReferencesType = {
    verses: PrintVerseRequestType[];
    names: DetailPanelRequestType[];
    places: DetailPanelRequestType[];
};

export type PrintVerseChapterType = {
    // `John 3:16-18` in the Bible's own words; null where the passage is
    // one chapter, whose title is the passage's.
    title: string | null;
    verses: { verse: string; text: string }[];
};

export type PrintVerseEntryType = {
    title: string;
    bibleKey: string;
    chapters: PrintVerseChapterType[];
    isCut: boolean;
};

export type PrintRecordEntryType = {
    name: string;
    // The KJV's spelling, where the record's own name is another.
    kjvName: string | null;
    summary: string;
    description: string;
    // A place's, where it is known.
    modernIdentification: string;
};

export type PrintAppendixType = {
    verses: PrintVerseEntryType[];
    names: PrintRecordEntryType[];
    places: PrintRecordEntryType[];
    // References past the caps, and ones nothing could be read for.
    leftOutCount: number;
};

export type PrintAppendixLabelsType = {
    verses: string;
    names: string;
    places: string;
    modernIdentification: string;
    // `{count}` is the number.
    leftOut: string;
};

function toRequestKey(request: DetailPanelRequestType) {
    return `${request.kind}|${request.bibleKey ?? ''}|${request.target}`;
}

/**
 * Every verse, person and place the page links, each once, in the order the
 * page first names it. A link the page's own HTML wrote is no reference
 * (`findMarkdownRef` knows only the ones it made), and nor is a file.
 */
export function collectPrintReferences(
    container: HTMLElement,
): PrintReferencesType {
    const references: PrintReferencesType = {
        verses: [],
        names: [],
        places: [],
    };
    const seenSet = new Set<string>();
    for (const element of container.querySelectorAll(
        `.${MARKDOWN_REF_CLASS}`,
    )) {
        const ref = findMarkdownRef(element);
        if (ref === null || ref.kind !== 'panel') {
            continue;
        }
        const key = toRequestKey(ref.request);
        if (seenSet.has(key)) {
            continue;
        }
        seenSet.add(key);
        if (ref.request.kind === 'verse') {
            references.verses.push(
                ref.isBibleNamed === true
                    ? { ...ref.request, isBibleNamed: true }
                    : ref.request,
            );
        } else if (ref.request.kind === 'name') {
            references.names.push(ref.request);
        } else {
            references.places.push(ref.request);
        }
    }
    return references;
}

export function countPrintReferences(references: PrintReferencesType) {
    return (
        references.verses.length +
        references.names.length +
        references.places.length
    );
}

function appendElement<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tagName: K,
    className: string,
    text?: string,
) {
    const element = parent.ownerDocument.createElement(tagName);
    if (className !== '') {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    parent.append(element);
    return element;
}

const ENTRY_CLASS_NAME = `${PRINT_APPENDIX_CLASS_NAME}-entry`;
const TITLE_CLASS_NAME = `${PRINT_APPENDIX_CLASS_NAME}-title`;

function appendVerseEntry(section: HTMLElement, entry: PrintVerseEntryType) {
    const entryElement = appendElement(
        section,
        'div',
        `${ENTRY_CLASS_NAME} ${ENTRY_CLASS_NAME}--verse`,
    );
    const titleElement = appendElement(
        entryElement,
        'p',
        TITLE_CLASS_NAME,
        entry.title,
    );
    appendElement(
        titleElement,
        'span',
        `${PRINT_APPENDIX_CLASS_NAME}-bible`,
        ` (${entry.bibleKey})`,
    );
    for (const chapter of entry.chapters) {
        if (chapter.title !== null) {
            appendElement(
                entryElement,
                'p',
                `${PRINT_APPENDIX_CLASS_NAME}-chapter`,
                chapter.title,
            );
        }
        const textElement = appendElement(entryElement, 'p', '');
        chapter.verses.forEach(({ verse, text }, index) => {
            appendElement(textElement, 'sup', '', verse);
            textElement.append(
                ` ${text}${index < chapter.verses.length - 1 ? ' ' : ''}`,
            );
        });
        if (entry.isCut && chapter === entry.chapters.at(-1)) {
            textElement.append(' …');
        }
    }
}

function appendRecordEntry(
    section: HTMLElement,
    entry: PrintRecordEntryType,
    labels: PrintAppendixLabelsType,
) {
    const entryElement = appendElement(section, 'div', ENTRY_CLASS_NAME);
    const titleElement = appendElement(entryElement, 'p', TITLE_CLASS_NAME);
    appendElement(
        titleElement,
        'strong',
        '',
        entry.kjvName === null
            ? entry.name
            : `${entry.name} (${entry.kjvName})`,
    );
    if (entry.summary !== '') {
        titleElement.append(` — ${entry.summary}`);
    }
    if (entry.description !== '') {
        appendElement(entryElement, 'p', '', entry.description);
    }
    if (entry.modernIdentification !== '') {
        const modernElement = appendElement(entryElement, 'p', '');
        appendElement(
            modernElement,
            'em',
            '',
            `${labels.modernIdentification}: `,
        );
        modernElement.append(entry.modernIdentification);
    }
}

function appendSection(
    appendixElement: HTMLElement,
    heading: string,
    appendEntries: (section: HTMLElement) => void,
) {
    const section = appendElement(
        appendixElement,
        'section',
        `${PRINT_APPENDIX_CLASS_NAME}-section`,
    );
    appendElement(section, 'h2', '', heading);
    appendEntries(section);
}

/**
 * The appendix, built of text nodes only -- a record's or a verse's words
 * are never markup here -- and put nowhere: null when there is nothing in
 * it. The print puts it after the page's last line (`addPrintAppendix`); the
 * Word export reads it after the page's, never putting it on the page.
 */
export function genPrintAppendixElement(
    ownerDocument: Document,
    appendix: PrintAppendixType,
    labels: PrintAppendixLabelsType,
) {
    if (
        appendix.verses.length === 0 &&
        appendix.names.length === 0 &&
        appendix.places.length === 0
    ) {
        return null;
    }
    const appendixElement = ownerDocument.createElement('div');
    appendixElement.className = PRINT_APPENDIX_CLASS_NAME;
    appendElement(appendixElement, 'hr', '');
    if (appendix.verses.length > 0) {
        appendSection(appendixElement, labels.verses, (section) => {
            for (const entry of appendix.verses) {
                appendVerseEntry(section, entry);
            }
        });
    }
    if (appendix.names.length > 0) {
        appendSection(appendixElement, labels.names, (section) => {
            for (const entry of appendix.names) {
                appendRecordEntry(section, entry, labels);
            }
        });
    }
    if (appendix.places.length > 0) {
        appendSection(appendixElement, labels.places, (section) => {
            for (const entry of appendix.places) {
                appendRecordEntry(section, entry, labels);
            }
        });
    }
    if (appendix.leftOutCount > 0) {
        appendElement(
            appendixElement,
            'p',
            `${PRINT_APPENDIX_CLASS_NAME}-left-out`,
            labels.leftOut.replace('{count}', String(appendix.leftOutCount)),
        );
    }
    return appendixElement;
}

/**
 * Puts the appendix after the page's last line. Shown on paper alone
 * (`MarkdownPreviewAppComp.scss`), and taken away when the print is done
 * (`afterprint`), or by the next print, or with the page drawn again.
 * Returns whether there was anything to put.
 */
export function addPrintAppendix(
    container: HTMLElement,
    appendix: PrintAppendixType,
    labels: PrintAppendixLabelsType,
) {
    removePrintAppendix(container);
    const appendixElement = genPrintAppendixElement(
        container.ownerDocument,
        appendix,
        labels,
    );
    if (appendixElement === null) {
        return false;
    }
    container.append(appendixElement);
    globalThis.addEventListener(
        'afterprint',
        () => {
            appendixElement.remove();
        },
        { once: true },
    );
    return true;
}
