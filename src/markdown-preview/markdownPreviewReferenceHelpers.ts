import {
    findStudyBible,
    findTextVerseRefs,
    genStudyBookNames,
} from '../chatbot/studyVerseCheckHelpers';
import type { StudyBookNamesType } from '../chatbot/studyVerseCheckHelpers';
import { listBibleBookNames } from '../helper/bible-helpers/bibleBookNameListHelpers';
import { toVerseFullKeyFormat } from '../helper/bible-helpers/bibleKeyFormatHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import type { DetailPanelRequestType } from '../location-name-lookup/detailPanelRequestHelpers';
import {
    loadLookupTextIndexFile,
    loadLookupTextNeedlesFile,
} from '../location-name-lookup/lookupIndexFileHelpers';
import { getSelectedLookupLangCode } from '../location-name-lookup/lookupLangHelpers';
import { findLookupTextMatchesByEvidence } from '../location-name-lookup/verseTextIndexHelpers';
import type {
    LookupTextIndexType,
    LookupTextNeedlesType,
} from '../location-name-lookup/verseTextIndexTypes';
import {
    findTranslatedLookupMatches,
    getChapterEvidence,
} from '../location-name-lookup/verseTextTranslatedHelpers';
import { getResourcesFolderList } from '../resources/resourcesFolderHelpers';
import {
    readBookChapterName,
    scanResourceFiles,
    type ResourceTargetType,
} from '../resources/resourcesScanHelpers';
import {
    fsCheckFileExist,
    pathBasename,
    pathDirname,
    pathJoin,
} from '../server/fileHelpers';
import {
    checkIsMarkdownPreviewFileName,
    MARKDOWN_REF_CLASS,
} from './markdownPreviewParamHelpers';

/**
 * The people, places, verses and files a Markdown file names, made links in
 * its preview (2026-11-11, the user, the Reader's Lookup Detail panel for
 * Moses beside the preview of `JHN.3.The New Birth and God's Love.md`: _have
 * to highlight name/location-name/bible-verse/other-resource and can click to
 * view. for name/location-name/bible-verse have to open the floating panel in
 * reader page and for the resource file referencing have to open its own
 * window_).
 *
 * Imported at the first render of a page, never with the window: a file only
 * read pays nothing until it is drawn. What it reads -- every installed
 * Bible's book names and the names index the Reader built (never built here,
 * `isBuildSkipped`) -- is held while pages keep being drawn (an editor beside
 * the page draws it at every pause in the typing) and let go
 * `HOLD_MILLISECONDS` after the last one.
 *
 * Found, earliest kind first where two overlap:
 * 1. a file named after a chapter (`MAT.18.pdf`, `JHN.3.Title.md`) that is
 *    there -- beside this file or in a Resources folder;
 * 2. a verse reference, as the English names or any installed Bible write
 *    the book (`Ezek. 36:25-27`, a Khmer one in Khmer digits) -- opened in
 *    the Bible named in brackets right after it (`**John 3:1-36**
 *    (Amplified)`, how the app's own studies head their passage) when that
 *    one is installed, else in the Bible that writes the book so;
 * 3. a person or a place: in English by the KJV index, in the lookup's
 *    language by its own names, with the chapter the file is named after as
 *    the evidence (`JHN.3.*` is John 3) -- without one, only an English name
 *    a single record bears.
 *
 * Never inside a link, code, a diagram or a drawing. A link is a `<span>`,
 * so its words can still be selected and copied; what it opens is held HERE,
 * by the element, never in an attribute -- the file's own HTML could write a
 * span of the same class, and such a span opens nothing.
 */

const HOLD_MILLISECONDS = 30_000;
// A page past this is drawn as written: the walk is per text node, and a
// book-length file is not a study.
export const MAX_REFERENCE_TEXT_LENGTH = 256 * 1024;
const MAX_FILE_CANDIDATES = 50;
const MAX_FILE_NAME_LENGTH = 160;

const SKIPPED_SELECTOR = [
    'a',
    'code',
    'pre',
    'svg',
    'script',
    'style',
    '.app-markdown-mermaid',
    `.${MARKDOWN_REF_CLASS}`,
].join(', ');

// `<BOOK>.<chapter>[.<title>].<extension>`: the book and the chapter are
// checked by `readBookChapterName`, the file by the disk. The title is tried
// last and as short as it can be, so `MAT.18.pdf and JHN.3.Love.md` is two
// names, never one.
const FILE_NAME_PATTERN =
    /(?<![\p{L}\p{N}_.\\/-])[1-4]?\p{L}{2,3}\.\p{Nd}{1,3}(?:\.[^\n\\/:*?"<>|]*?)??\.(?:md|markdown|pdf|own)(?![\p{L}\p{N}_])/giu;

// `John 3:1-36 (Amplified)`: what is in the brackets is looked up among the
// installed Bibles' keys, so `(see also)` names none.
const WRITTEN_BIBLE_PATTERN = /^\s*\(([^()\n]{1,40})\)/u;
const WRITTEN_BIBLE_READ_LENGTH = 64;
// The marks a reference's words may sit in, read out of for the brackets
// after them: `**John 3:1-36** (Amplified)`.
const INLINE_MARK_TAG_SET = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'MARK']);

export type MarkdownRefType =
    | {
          kind: 'panel';
          request: DetailPanelRequestType;
          // A verse whose Bible was named in brackets after it, not taken
          // from the language its book is written in: that Bible alone.
          isBibleNamed?: true;
      }
    | { kind: 'file'; filePath: string };

type RefMatchType = {
    start: number;
    end: number;
    text: string;
    className: string;
    ref: MarkdownRefType;
};

const refByElementMap = new WeakMap<Element, MarkdownRefType>();

/** What a press on this element opens, or null when it opens nothing. */
export function findMarkdownRef(target: Element | null) {
    const element = target?.closest?.(`.${MARKDOWN_REF_CLASS}`) ?? null;
    if (element === null) {
        return null;
    }
    return refByElementMap.get(element) ?? null;
}

type ReferenceDataType = {
    bookNames: StudyBookNamesType | null;
    index: LookupTextIndexType | null;
    needles: LookupTextNeedlesType | null;
};

let heldData: { langCode: string; promise: Promise<ReferenceDataType> } | null =
    null;
const releaseAttemptTimeout = genTimeoutAttempt(HOLD_MILLISECONDS);

async function loadReferenceData(langCode: string): Promise<ReferenceDataType> {
    const [bookNames, index, needles] = await Promise.all([
        listBibleBookNames()
            .then(genStudyBookNames)
            .catch(() => {
                return null;
            }),
        loadLookupTextIndexFile({ isBuildSkipped: true }).catch(() => {
            return null;
        }),
        loadLookupTextNeedlesFile(langCode, { isBuildSkipped: true }).catch(
            () => {
                return null;
            },
        ),
    ]);
    return { bookNames, index, needles };
}

function getReferenceData() {
    const langCode = getSelectedLookupLangCode();
    if (heldData?.langCode !== langCode) {
        heldData = { langCode, promise: loadReferenceData(langCode) };
    }
    releaseAttemptTimeout(() => {
        heldData = null;
    });
    return heldData.promise;
}

/** For the tests: what is held, let go now. */
export function releaseReferenceData() {
    heldData = null;
}

function collectTextNodes(element: HTMLElement) {
    const walker = element.ownerDocument.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (
                    parent === null ||
                    parent.closest(SKIPPED_SELECTOR) !== null ||
                    (node.nodeValue ?? '').trim() === ''
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        },
    );
    const textNodeList: Text[] = [];
    let totalLength = 0;
    let node = walker.nextNode();
    while (node !== null) {
        totalLength += (node.nodeValue ?? '').length;
        if (totalLength > MAX_REFERENCE_TEXT_LENGTH) {
            return null;
        }
        textNodeList.push(node as Text);
        node = walker.nextNode();
    }
    return textNodeList;
}

function findFileNameCandidates(text: string) {
    const candidateList: { start: number; end: number; name: string }[] = [];
    for (const match of text.matchAll(FILE_NAME_PATTERN)) {
        const name = match[0];
        if (
            name.length <= MAX_FILE_NAME_LENGTH &&
            readBookChapterName(name) !== null
        ) {
            const start = match.index ?? 0;
            candidateList.push({ start, end: start + name.length, name });
        }
    }
    return candidateList;
}

/**
 * Where each named file is, by its lower-case name: beside this file first,
 * then in a Resources folder (one walk a folder for all of them, the
 * Resources panel's own, cached by it for a few seconds).
 */
async function resolveFileNames(nameList: string[], filePath: string) {
    const foundMap = new Map<string, string>();
    const dirPath = pathDirname(filePath);
    const missingList: string[] = [];
    await Promise.all(
        nameList.map(async (name) => {
            const besidePath = pathJoin(dirPath, name);
            if (await fsCheckFileExist(besidePath).catch(() => false)) {
                foundMap.set(name.toLowerCase(), besidePath);
            } else {
                missingList.push(name);
            }
        }),
    );
    if (missingList.length === 0) {
        return foundMap;
    }
    const targetMap = new Map<string, ResourceTargetType>();
    for (const name of missingList) {
        const bookChapter = readBookChapterName(name);
        if (bookChapter !== null) {
            targetMap.set(
                `${bookChapter.bookKey}.${bookChapter.chapter}`,
                bookChapter,
            );
        }
    }
    const wantedSet = new Set(
        missingList.map((name) => {
            return name.toLowerCase();
        }),
    );
    for (const folderPath of getResourcesFolderList()) {
        const result = await scanResourceFiles(folderPath, [
            ...targetMap.values(),
        ]).catch(() => {
            return null;
        });
        for (const foundPath of result?.filePaths ?? []) {
            const lowerName = pathBasename(foundPath).toLowerCase();
            if (wantedSet.has(lowerName) && !foundMap.has(lowerName)) {
                foundMap.set(lowerName, foundPath);
            }
        }
    }
    return foundMap;
}

function toPanelMatch(
    start: number,
    end: number,
    text: string,
    request: DetailPanelRequestType,
    isBibleNamed = false,
): RefMatchType {
    return {
        start,
        end,
        text,
        className: `${MARKDOWN_REF_CLASS} ${MARKDOWN_REF_CLASS}-${request.kind}`,
        ref: isBibleNamed
            ? { kind: 'panel', request, isBibleNamed: true }
            : { kind: 'panel', request },
    };
}

type PageFindersType = {
    fileMap: Map<string, string>;
    bookNames: StudyBookNamesType | null;
    findNameMatches: (text: string) => RefMatchType[];
};

function genNameFinder(
    data: ReferenceDataType,
    filePath: string,
): (text: string) => RefMatchType[] {
    const { index, needles } = data;
    if (index === null) {
        return () => [];
    }
    const bookChapter = readBookChapterName(pathBasename(filePath));
    const shortChapter =
        bookChapter === null || bookChapter.chapter < 1
            ? null
            : `${bookChapter.bookKey} ${bookChapter.chapter}`;
    const chapterEvidence =
        shortChapter === null ? null : getChapterEvidence(index);
    const evidence = {
        nameIndexSet: new Set(
            chapterEvidence?.names.get(shortChapter ?? '') ?? [],
        ),
        locationIndexSet: new Set(
            chapterEvidence?.locations.get(shortChapter ?? '') ?? [],
        ),
    };
    return (text) => {
        const matchList = findLookupTextMatchesByEvidence(
            index,
            text,
            evidence,
        );
        if (needles !== null && shortChapter !== null) {
            // `:0`, a verse no chapter has: the chapter's evidence alone.
            matchList.push(
                ...findTranslatedLookupMatches(
                    index,
                    needles,
                    text,
                    `${shortChapter}:0`,
                ),
            );
        }
        return matchList.map((match) => {
            return toPanelMatch(match.start, match.end, match.text, {
                kind: match.kind,
                target: match.recordId,
                name: match.text,
            });
        });
    };
}

function checkIsInlineWords(node: Node) {
    return (
        node.nodeType === Node.TEXT_NODE ||
        (node.nodeType === Node.ELEMENT_NODE &&
            INLINE_MARK_TAG_SET.has((node as Element).tagName))
    );
}

/**
 * The words right after a run of text in its own paragraph, out of the
 * marks it ends in and past spaces: `**John 3:5** *(KJV)*`.
 */
function readTextAfterNode(textNode: Text) {
    let node: Node = textNode;
    while (node.nextSibling === null) {
        const parent = node.parentElement;
        if (parent === null || !INLINE_MARK_TAG_SET.has(parent.tagName)) {
            return '';
        }
        node = parent;
    }
    let text = '';
    let next: ChildNode | null = node.nextSibling;
    while (next !== null && text.trim() === '' && checkIsInlineWords(next)) {
        text += next.textContent ?? '';
        next = next.nextSibling;
    }
    return text.slice(0, WRITTEN_BIBLE_READ_LENGTH);
}

/**
 * The installed Bible a reference names in brackets right after it: in the
 * rest of its own run of text, or in the run after it when nothing but
 * spaces is left there.
 */
function findWrittenBibleKey(
    textNode: Text,
    text: string,
    end: number,
    bookNames: StudyBookNamesType,
) {
    const restText = text.slice(end, end + WRITTEN_BIBLE_READ_LENGTH);
    const followingText =
        restText.trim() === ''
            ? restText + readTextAfterNode(textNode)
            : restText;
    const match = WRITTEN_BIBLE_PATTERN.exec(followingText);
    if (match === null) {
        return undefined;
    }
    return findStudyBible(bookNames, match[1].trim())?.key;
}

function findVerseMatches(
    textNode: Text,
    text: string,
    bookNames: StudyBookNamesType,
) {
    return findTextVerseRefs(text, bookNames).map((ref) => {
        const request: DetailPanelRequestType = {
            kind: 'verse',
            target: toVerseFullKeyFormat(
                ref.bookKey,
                ref.chapter,
                ref.verseStart,
                ref.verseEnd,
            ),
            name: ref.written,
        };
        const namedBibleKey = findWrittenBibleKey(
            textNode,
            text,
            ref.end,
            bookNames,
        );
        const bibleKey = namedBibleKey ?? ref.bibleKey;
        if (bibleKey !== undefined) {
            request.bibleKey = bibleKey;
        }
        return toPanelMatch(
            ref.start,
            ref.end,
            ref.written,
            request,
            namedBibleKey !== undefined,
        );
    });
}

function findNodeMatches(textNode: Text, finders: PageFindersType) {
    const text = textNode.nodeValue ?? '';
    const fileMatchList: RefMatchType[] = [];
    for (const candidate of findFileNameCandidates(text)) {
        const foundPath = finders.fileMap.get(candidate.name.toLowerCase());
        if (foundPath !== undefined) {
            fileMatchList.push({
                start: candidate.start,
                end: candidate.end,
                text: candidate.name,
                className: `${MARKDOWN_REF_CLASS} ${MARKDOWN_REF_CLASS}-file`,
                ref: { kind: 'file', filePath: foundPath },
            });
        }
    }
    const verseMatchList =
        finders.bookNames === null
            ? []
            : findVerseMatches(textNode, text, finders.bookNames);
    const keptList: RefMatchType[] = [];
    for (const matchList of [
        fileMatchList,
        verseMatchList,
        finders.findNameMatches(text),
    ]) {
        for (const match of matchList) {
            const isOverlapping = keptList.some((kept) => {
                return match.start < kept.end && kept.start < match.end;
            });
            if (!isOverlapping && match.end > match.start) {
                keptList.push(match);
            }
        }
    }
    return keptList.sort((one, another) => {
        return one.start - another.start;
    });
}

function decorateTextNode(textNode: Text, matchList: RefMatchType[]) {
    const text = textNode.nodeValue ?? '';
    const document = textNode.ownerDocument;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matchList) {
        if (match.start > cursor) {
            fragment.append(text.slice(cursor, match.start));
        }
        const linkElement = document.createElement('span');
        linkElement.className = match.className;
        linkElement.title = match.text;
        linkElement.textContent = text.slice(match.start, match.end);
        refByElementMap.set(linkElement, match.ref);
        fragment.append(linkElement);
        cursor = match.end;
    }
    if (cursor < text.length) {
        fragment.append(text.slice(cursor));
    }
    textNode.replaceWith(fragment);
}

/**
 * Makes the references on a drawn page links, in place. Stops, touching
 * nothing, once `checkIsStale` says the page was drawn again meanwhile.
 * Returns how many links it made.
 */
export async function decorateMarkdownReferences(
    element: HTMLElement,
    filePath: string,
    checkIsStale: () => boolean,
) {
    // A page drawn again before this pass began reads nothing at all.
    if (checkIsStale()) {
        return 0;
    }
    const textNodeList = collectTextNodes(element);
    if (textNodeList === null || textNodeList.length === 0) {
        return 0;
    }
    const nameSet = new Set<string>();
    for (const textNode of textNodeList) {
        for (const candidate of findFileNameCandidates(
            textNode.nodeValue ?? '',
        )) {
            if (nameSet.size < MAX_FILE_CANDIDATES) {
                nameSet.add(candidate.name);
            }
        }
    }
    const [data, fileMap] = await Promise.all([
        getReferenceData(),
        nameSet.size === 0
            ? new Map<string, string>()
            : resolveFileNames([...nameSet], filePath),
    ]);
    if (checkIsStale()) {
        return 0;
    }
    const finders: PageFindersType = {
        fileMap,
        bookNames: data.bookNames,
        findNameMatches: genNameFinder(data, filePath),
    };
    let count = 0;
    for (const textNode of textNodeList) {
        if (!textNode.isConnected) {
            continue;
        }
        const matchList = findNodeMatches(textNode, finders);
        if (matchList.length > 0) {
            decorateTextNode(textNode, matchList);
            count += matchList.length;
        }
    }
    return count;
}

/**
 * A file a link names, in a window of its own (the user's word: _own window
 * for every type_): a Markdown file in another preview, a PDF in its viewer,
 * a Bible note at its first note, read-only; anything else is shown in its
 * folder and never run. A window already open on the file is brought
 * forward rather than stacked.
 */
export async function openResourceFileWindow(filePath: string) {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.pdf')) {
        const { openPdfPreview } = await import('../helper/pdfPreviewHelpers');
        openPdfPreview(filePath);
        return;
    }
    if (checkIsMarkdownPreviewFileName(filePath)) {
        const { openMarkdownPreview } =
            await import('../resources/resourcePreviewOpenHelpers');
        openMarkdownPreview(filePath);
        return;
    }
    if (lowerPath.endsWith('.own')) {
        const { readResourceNoteItems } =
            await import('../resources/resourcePreviewHelpers');
        const result = await readResourceNoteItems(filePath);
        const noteItem = result.items.find((item) => {
            return item.kind === 'note';
        });
        if (noteItem !== undefined && noteItem.kind === 'note') {
            const { openBibleNotePreview } =
                await import('../resources/resourcePreviewOpenHelpers');
            openBibleNotePreview(filePath, noteItem.id);
            return;
        }
    }
    const { showFileOrDirExplorer } = await import('../server/appHelpers');
    showFileOrDirExplorer(filePath);
}
