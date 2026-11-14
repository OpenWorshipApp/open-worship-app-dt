import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { toPlainRecordText } from '../helper/agentLookupRecordHelpers';
import { getAllLocalBibleInfoList } from '../helper/bible-helpers/bibleDownloadHelpers';
import { fromVerseKey } from '../helper/bible-helpers/bibleInfoHelpers';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import type { BibleTargetType } from '../helper/bible-helpers/bibleTargetHelpers';
import {
    checkIsCrossChapterTarget,
    toSingleChapterTarget,
} from '../helper/bible-helpers/bibleTargetHelpers';
import type { DetailPanelRequestType } from '../location-name-lookup/detailPanelRequestHelpers';
import {
    acquireLookupData,
    releaseLookupData,
} from '../location-name-lookup/lookupDataHelpers';
import { getSelectedLookupLangCode } from '../location-name-lookup/lookupLangHelpers';
import type {
    PrintAppendixType,
    PrintRecordEntryType,
    PrintReferencesType,
    PrintVerseChapterType,
    PrintVerseEntryType,
    PrintVerseRequestType,
} from './markdownPrintAppendixHelpers';
import {
    MAX_PRINTED_RECORDS,
    MAX_PRINTED_VERSES,
} from './markdownPrintAppendixHelpers';

/**
 * What the print's appendix says (`markdownPrintAppendixHelpers.ts`), read
 * when the person has asked for it and not before: imported by the Add and
 * Print press, so a page printed without it never loads a Bible reader or
 * the names dataset.
 *
 * A verse is read in the Bible its reference was written in (one written
 * with a Bible's own book names and digits, or named in brackets after it,
 * `John 3:1-36 (Amplified)`, in that Bible), else the KJV -- the lookup's own
 * Bible in a window with no Reader -- else the first installed; a passage
 * whole, up to `MAX_PASSAGE_CHARS`. A passage one printed before it already
 * holds is not printed again, and one that starts inside it without being
 * held is read from its Bible (`readVerseEntries`).
 * A person or a place is read from the names lookup in the lookup's language,
 * the ~34 MB dataset taken for the reading and given back at once: an open
 * lookup panel's copy is the one read, and none is kept for the print.
 */

// As much of one passage as `owa_lookup_record` quotes: a whole chapter.
const MAX_PASSAGE_CHARS = 6000;
// The Bible renderer's mark for a verse the Bible does not have.
const MISSING_VERSE_TEXT = '??';

type BibleChoiceType = {
    choose: (wanted: string | undefined) => string | null;
    // The language an installed Bible's locale names, '' when it names none.
    langOf: (bibleKey: string) => string;
};

function toLocaleLang(locale: unknown) {
    return (
        String(locale ?? '')
            .trim()
            .split(/[-_]/)[0] ?? ''
    ).toLowerCase();
}

async function genBibleChoice(): Promise<BibleChoiceType> {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    const keyList = infoList.map((info) => {
        return info.key;
    });
    const langMap = new Map(
        infoList.map((info) => {
            return [info.key, toLocaleLang(info.locale)];
        }),
    );
    const findInstalled = (wanted: string | undefined) => {
        if (wanted === undefined || wanted === '') {
            return null;
        }
        const lowerWanted = wanted.toLowerCase();
        return (
            keyList.find((key) => {
                return key.toLowerCase() === lowerWanted;
            }) ?? null
        );
    };
    return {
        choose: (wanted) => {
            return (
                findInstalled(wanted) ??
                findInstalled(BIBLE_KJV_KEY) ??
                keyList[0] ??
                null
            );
        },
        langOf: (bibleKey) => {
            return langMap.get(bibleKey) ?? '';
        },
    };
}

// A chapter and a verse as one number, so one passage's place in its book is
// a span of two (no chapter has 1000 verses).
function toSpanPoint(chapter: number, verse: number) {
    return chapter * 1000 + verse;
}

type PrintedSpanType = {
    bibleKey: string;
    lang: string;
    bookKey: string;
    start: number;
    // The last verse on paper, and the last its reference asked for: a
    // passage cut short asked for more than it printed.
    end: number;
    askedEnd: number;
};

/** One passage, every chapter of it, as far as `MAX_PASSAGE_CHARS`. */
export async function readPrintVerseEntry(
    bibleKey: string,
    verseKey: string,
): Promise<PrintVerseEntryType | null> {
    const target = await fromVerseKey(bibleKey, verseKey);
    if (target === null) {
        return null;
    }
    const read = await readTargetEntry(bibleKey, target);
    return read?.entry ?? null;
}

/**
 * The passage, and the last verse that went on paper (`lastPoint`): a cut
 * passage holds only as far as it was printed.
 */
async function readTargetEntry(
    bibleKey: string,
    target: BibleTargetType,
): Promise<{ entry: PrintVerseEntryType; lastPoint: number } | null> {
    const verseList = await bibleRenderHelper.toVerseTextList(
        bibleKey,
        target,
        true,
    );
    if (verseList === null) {
        return null;
    }
    const chapterList: (PrintVerseChapterType & {
        chapter: number;
        firstVerse: number;
        lastVerse: number;
    })[] = [];
    let charCount = 0;
    let isCut = false;
    for (const verse of verseList) {
        const text = verse.text.trim();
        if (text === '' || text === MISSING_VERSE_TEXT) {
            continue;
        }
        if (charCount > 0 && charCount + text.length > MAX_PASSAGE_CHARS) {
            isCut = true;
            break;
        }
        charCount += text.length;
        let chapter = chapterList.at(-1);
        if (chapter?.chapter !== verse.chapter) {
            chapter = {
                title: null,
                verses: [],
                chapter: verse.chapter,
                firstVerse: verse.verse,
                lastVerse: verse.verse,
            };
            chapterList.push(chapter);
        }
        chapter.verses.push({ verse: verse.localeVerse, text });
        chapter.lastVerse = verse.verse;
    }
    if (chapterList.length === 0) {
        return null;
    }
    // Over chapters, each under its own title, as the Bible copy writes it.
    if (checkIsCrossChapterTarget(target)) {
        for (const chapter of chapterList) {
            chapter.title = await bibleRenderHelper.toTitle(
                bibleKey,
                toSingleChapterTarget(
                    target.bookKey,
                    chapter.chapter,
                    chapter.firstVerse,
                    chapter.lastVerse,
                ),
            );
        }
    }
    const lastChapter = chapterList[chapterList.length - 1];
    return {
        entry: {
            title: await bibleRenderHelper.toTitle(bibleKey, target),
            bibleKey,
            chapters: chapterList.map(({ title, verses }) => {
                return { title, verses };
            }),
            isCut,
        },
        lastPoint: toSpanPoint(lastChapter.chapter, lastChapter.lastVerse),
    };
}

/**
 * The verses' passages in page order, at most `MAX_PRINTED_VERSES`. A
 * passage a passage printed BEFORE it holds whole is `covered` and not
 * printed again: a study's sections name the verses of the chapter it quotes
 * at the top (`John 3:3-8` under `John 3:1-36`), and each repeat was a
 * chapter file read and a page of paper. Only one already printed covers,
 * because only then is it known how far it went on paper. A reference whose
 * Bible was named after it is covered in that Bible alone; any other -- read
 * in a Bible for the language its book is written in, or in the default one
 * -- by a passage from any Bible of that language. The user's John 3 study
 * heads its chapter `John 3:1-36 (Amplified)`, and its part in a second
 * language with the chapter in that language's words and one of its Bibles
 * named the same way: its plain `John 3:16`, printed again from the KJV, or
 * one of that part's from the first Bible that writes John as it does, would
 * be the same verse twice.
 *
 * Such a reference that STARTS inside a passage printed before it from a
 * Bible of its language, and is not held by it -- the passage was cut short,
 * or the reference runs past it -- is read from that passage's Bible, so the
 * paper carries it on in one translation (`findCarryingBibleKey`): on the
 * user's study the Amplified chapter stops at `MAX_PASSAGE_CHARS` after verse
 * 31, and its `John 3:31-36` had been printed from the KJV.
 */
async function readVerseEntries(requestList: PrintVerseRequestType[]) {
    const { choose, langOf } = await genBibleChoice();
    const entryList: PrintVerseEntryType[] = [];
    const printedList: PrintedSpanType[] = [];
    let coveredCount = 0;
    // One at a time: a low-spec machine reads one chapter file, not sixty.
    for (const request of requestList) {
        const bibleKey = choose(request.bibleKey);
        if (bibleKey === null) {
            break;
        }
        const target = await fromVerseKey(bibleKey, request.target).catch(
            () => {
                return null;
            },
        );
        if (target === null) {
            continue;
        }
        const start = toSpanPoint(target.chapter, target.verseStart);
        const end = toSpanPoint(
            target.chapterEnd ?? target.chapter,
            target.verseEnd,
        );
        const lang = request.isBibleNamed === true ? '' : langOf(bibleKey);
        const isCovered = printedList.some((printed) => {
            return (
                (printed.bibleKey === bibleKey ||
                    (lang !== '' && printed.lang === lang)) &&
                printed.bookKey === target.bookKey &&
                printed.start <= start &&
                end <= printed.end
            );
        });
        if (isCovered) {
            coveredCount += 1;
            continue;
        }
        // Past the cap a reference is still looked at: one a printed
        // passage holds is on paper all the same, not left out.
        if (entryList.length >= MAX_PRINTED_VERSES) {
            continue;
        }
        const carryingKey = findCarryingBibleKey(printedList, {
            bibleKey,
            lang,
            bookKey: target.bookKey,
            start,
        });
        const read =
            (carryingKey === null
                ? null
                : await readCarriedEntry(carryingKey, request.target)) ??
            (await readSpanEntry(bibleKey, target));
        if (read !== null) {
            entryList.push(read.entry);
            printedList.push({
                bibleKey: read.entry.bibleKey,
                lang: langOf(read.entry.bibleKey),
                bookKey: target.bookKey,
                start,
                end: read.lastPoint,
                askedEnd: end,
            });
        }
    }
    return { verses: entryList, coveredCount };
}

/**
 * The Bible of a passage printed before this reference that it starts
 * inside, from a Bible of the reference's language other than the one it
 * would be read from -- null for a reference whose Bible was named (`lang`
 * '') or that starts in no such passage.
 */
function findCarryingBibleKey(
    printedList: PrintedSpanType[],
    reference: {
        bibleKey: string;
        lang: string;
        bookKey: string;
        start: number;
    },
) {
    if (reference.lang === '') {
        return null;
    }
    const printed = printedList.find((item) => {
        return (
            item.lang === reference.lang &&
            item.bookKey === reference.bookKey &&
            item.start <= reference.start &&
            reference.start <= item.askedEnd
        );
    });
    if (printed === undefined || printed.bibleKey === reference.bibleKey) {
        return null;
    }
    return printed.bibleKey;
}

async function readSpanEntry(bibleKey: string, target: BibleTargetType) {
    return readTargetEntry(bibleKey, target).catch(() => {
        return null;
    });
}

// Null when that Bible cannot read the reference: it is read as it would
// have been.
async function readCarriedEntry(bibleKey: string, verseKey: string) {
    const target = await fromVerseKey(bibleKey, verseKey).catch(() => {
        return null;
    });
    if (target === null) {
        return null;
    }
    return readSpanEntry(bibleKey, target);
}

type RecordFieldsType = {
    name: string;
    kjvName: string | null;
    title: string;
    description: string;
    modernIdentification?: string | null;
};

function toRecordEntry(record: RecordFieldsType): PrintRecordEntryType {
    const name = record.name.trim();
    const kjvName = (record.kjvName ?? '').trim();
    return {
        name,
        kjvName: kjvName === '' || kjvName === name ? null : kjvName,
        summary: toPlainRecordText(record.title),
        description: toPlainRecordText(record.description),
        modernIdentification: toPlainRecordText(record.modernIdentification),
    };
}

async function readRecordEntries(
    nameRequestList: DetailPanelRequestType[],
    placeRequestList: DetailPanelRequestType[],
) {
    if (nameRequestList.length === 0 && placeRequestList.length === 0) {
        return { names: [], places: [] };
    }
    const langCode = getSelectedLookupLangCode();
    try {
        const managers = await acquireLookupData(langCode);
        const names = nameRequestList.flatMap((request) => {
            const record = managers.namesLookupManager.getRecordById(
                request.target,
            );
            return record === null ? [] : [toRecordEntry(record)];
        });
        const places = placeRequestList.flatMap((request) => {
            const record = managers.locationsLookupManager.getRecordById(
                request.target,
            );
            return record === null ? [] : [toRecordEntry(record)];
        });
        return { names, places };
    } finally {
        // Taken for this reading alone: what was read is a few kilobytes of
        // words, and the dataset goes back now (`acquireLookupData` counted
        // the asking even when the load failed).
        releaseLookupData(langCode);
    }
}

/**
 * Everything the appendix prints, in the page's order: the verses' words and
 * the people's and places' details. Past `MAX_PRINTED_VERSES` /
 * `MAX_PRINTED_RECORDS`, and wherever nothing could be read, a reference is
 * counted in `leftOutCount` instead -- never one a printed passage holds.
 */
export async function readPrintAppendix(
    references: PrintReferencesType,
): Promise<PrintAppendixType> {
    const recordRequestList = [...references.names, ...references.places].slice(
        0,
        MAX_PRINTED_RECORDS,
    );
    const nameRequestList = recordRequestList.filter((request) => {
        return request.kind === 'name';
    });
    const placeRequestList = recordRequestList.filter((request) => {
        return request.kind === 'location';
    });
    const { verses, coveredCount } = await readVerseEntries(references.verses);
    const { names, places } = await readRecordEntries(
        nameRequestList,
        placeRequestList,
    );
    const askedCount =
        references.verses.length +
        references.names.length +
        references.places.length;
    return {
        verses,
        names,
        places,
        leftOutCount:
            askedCount -
            coveredCount -
            verses.length -
            names.length -
            places.length,
    };
}
