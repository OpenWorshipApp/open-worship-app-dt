import {
    genLookupLangFileStore,
    loadLookupTextNeedlesFile,
} from './lookupIndexFileHelpers';
import type { LookupTextMatchType } from './verseTextIndexHelpers';
import { NEEDLE_SEPARATOR } from './verseTextIndexTypes';
import type {
    LookupTextIndexType,
    LookupTextNeedlesType,
} from './verseTextIndexTypes';

/**
 * Making names and locations clickable inside a bible that is NOT the KJV.
 *
 * The English matcher works by reading the text: it cuts it into words, requires
 * a capital letter, and looks each run of words up in a map of every surface
 * form in the dataset. None of that survives translation. Khmer writes no spaces
 * between words and has no capitals, so there is nothing to cut on and nothing
 * that tells a name from an ordinary word — and it is the capital that carries
 * most of the English matcher's precision. Run the same way, the dataset's own
 * Khmer for Jehudijah ("the Jews"), Scythia ("wild"), Mammon ("riches") and
 * Baali ("lord") match ordinary prose: measured over the whole shipped Khmer
 * bible, that fallback added 824 matches of which the visibly wrong ones ran to
 * dozens of occurrences each.
 *
 * So this matcher runs the other way round. It starts from the handful of
 * records the dataset attests for THIS verse — and, failing that, for this
 * chapter — and looks for exactly those few names in the text. There is no
 * "this form belongs to exactly one record in the dataset" tier at all: a
 * translated bible gets evidence or it gets nothing. Measured over the same
 * text that is 3 216 matches on 3 673 verses with no wrong one found by hand,
 * at 0.017ms a verse — a quarter of what the English scan costs, because ~11
 * needles are probed per verse rather than a whole dataset.
 *
 * The chapter tier is what covers the evidence map's own gaps: it lists Isaac
 * for some verses of a chapter about Isaac and not others, and the name is
 * spelled out in all of them. It cannot let a common word in, because a chapter
 * that does not mention Scythia never puts Scythia among its candidates.
 */

// Zero-width and soft-breaking characters. The Khmer bibles mark word boundaries
// with U+200B and join clusters with U+200C, and where one falls INSIDE a name
// the two spellings differ by an invisible character alone. The builder takes
// them out of the needle; the matcher skips them in the text, so the offsets it
// reports stay offsets into the ORIGINAL string and the verse renders back
// byte-for-byte.
const INVISIBLE_PATTERN = /[\u00ad\u200b-\u200f\u2060\ufeff]/;

/**
 * The needles for one language, or null while they load. Subscribing is what
 * triggers the load; the last consumer to unsubscribe releases them.
 */
export const useLookupTextNeedles =
    genLookupLangFileStore<LookupTextNeedlesType>(loadLookupTextNeedlesFile);

type ChapterEvidenceType = {
    names: Map<string, number[]>;
    locations: Map<string, number[]>;
};

// Derived rather than built into the index file, because only this path wants it
// and every KJV reader would otherwise hold it. Keyed on the index OBJECT, so
// the derived maps are released exactly when the index they came out of is —
// there is no second lifetime to manage.
const chapterEvidenceMap = new WeakMap<
    LookupTextIndexType,
    ChapterEvidenceType
>();

function toChapterMap(verseMap: { [shortVerse: string]: number[] }) {
    const chapterMap = new Map<string, number[]>();
    for (const [shortVerse, recordIndexList] of Object.entries(verseMap)) {
        const separatorIndex = shortVerse.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }
        const shortChapter = shortVerse.slice(0, separatorIndex);
        let chapterList = chapterMap.get(shortChapter);
        if (chapterList === undefined) {
            chapterList = [];
            chapterMap.set(shortChapter, chapterList);
        }
        for (const recordIndex of recordIndexList) {
            if (!chapterList.includes(recordIndex)) {
                chapterList.push(recordIndex);
            }
        }
    }
    return chapterMap;
}

/**
 * Which records the dataset attests anywhere in each chapter.
 *
 * One pass over both verse maps, ~9ms for the whole bible, and the result is
 * ~859 chapters averaging 7 records each. Built on the first translated verse
 * rendered and reused for every verse after it.
 */
function getChapterEvidence(index: LookupTextIndexType) {
    let chapterEvidence = chapterEvidenceMap.get(index);
    if (chapterEvidence === undefined) {
        chapterEvidence = {
            names: toChapterMap(index.verseNames),
            locations: toChapterMap(index.verseLocations),
        };
        chapterEvidenceMap.set(index, chapterEvidence);
    }
    return chapterEvidence;
}

type NeedleCandidateType = {
    kind: 'name' | 'location';
    verseRecordIndexList: number[];
    chapterRecordIndexList: number[];
};

function addCandidate(
    candidateMap: Map<string, NeedleCandidateType>,
    needles: LookupTextNeedlesType,
    recordIndex: number,
    kind: 'name' | 'location',
    isVerseEvidence: boolean,
) {
    const joinedNeedle = needles.needles[recordIndex] ?? '';
    if (joinedNeedle === '') {
        return;
    }
    for (const needle of joinedNeedle.split(NEEDLE_SEPARATOR)) {
        let candidate = candidateMap.get(needle);
        if (candidate === undefined) {
            candidate = {
                kind,
                verseRecordIndexList: [],
                chapterRecordIndexList: [],
            };
            candidateMap.set(needle, candidate);
        }
        const recordIndexList = isVerseEvidence
            ? candidate.verseRecordIndexList
            : candidate.chapterRecordIndexList;
        if (!recordIndexList.includes(recordIndex)) {
            recordIndexList.push(recordIndex);
        }
        // A form two records share is dropped below whatever their kinds are, so
        // the first kind recorded is only ever read for one that survives.
    }
}

/**
 * Where `needle` ends in `text` if it starts at `start`, or -1.
 *
 * Compares against the ORIGINAL text and steps over the invisible characters in
 * it, so `អ័ដាម` matches `អ័‌ដាម` and the returned offset still points at the
 * real string. Doing it this way rather than matching a cleaned copy is what
 * saves building an offset map per verse.
 */
function matchNeedleAt(text: string, start: number, needle: string) {
    let textIndex = start;
    let needleIndex = 0;
    while (needleIndex < needle.length) {
        if (textIndex >= text.length) {
            return -1;
        }
        const character = text[textIndex];
        if (INVISIBLE_PATTERN.test(character)) {
            textIndex += 1;
            continue;
        }
        if (character !== needle[needleIndex]) {
            return -1;
        }
        textIndex += 1;
        needleIndex += 1;
    }
    return textIndex;
}

/**
 * Every attested name and location spelled out in `text`, in this language.
 *
 * `kjvShortVerse` is the KJV reference (`GEN 4:1`) whatever the bible is, which
 * is what lets the English-keyed evidence answer for a translation — the app
 * carries it on every verse already.
 */
export function findTranslatedLookupMatches(
    index: LookupTextIndexType,
    needles: LookupTextNeedlesType,
    text: string,
    kjvShortVerse: string,
): LookupTextMatchType[] {
    const separatorIndex = kjvShortVerse.indexOf(':');
    if (separatorIndex === -1 || text === '') {
        return [];
    }
    const shortChapter = kjvShortVerse.slice(0, separatorIndex);
    const chapterEvidence = getChapterEvidence(index);
    const candidateMap = new Map<string, NeedleCandidateType>();
    for (const [kind, verseMap, chapterMap] of [
        ['name', index.verseNames, chapterEvidence.names],
        ['location', index.verseLocations, chapterEvidence.locations],
    ] as const) {
        for (const recordIndex of verseMap[kjvShortVerse] ?? []) {
            addCandidate(candidateMap, needles, recordIndex, kind, true);
        }
        for (const recordIndex of chapterMap.get(shortChapter) ?? []) {
            addCandidate(candidateMap, needles, recordIndex, kind, false);
        }
    }

    const matchList: LookupTextMatchType[] = [];
    for (const [needle, candidate] of candidateMap) {
        const { verseRecordIndexList, chapterRecordIndexList } = candidate;
        // Two records this verse attests writing their name the same way is
        // exactly the case the English matcher refuses to guess at either.
        let recordIndex: number | null = null;
        if (verseRecordIndexList.length === 1) {
            recordIndex = verseRecordIndexList[0];
        } else if (
            verseRecordIndexList.length === 0 &&
            chapterRecordIndexList.length === 1
        ) {
            recordIndex = chapterRecordIndexList[0];
        }
        if (recordIndex === null) {
            continue;
        }
        let searchIndex = 0;
        while (searchIndex < text.length) {
            const start = text.indexOf(needle[0], searchIndex);
            if (start === -1) {
                break;
            }
            const end = matchNeedleAt(text, start, needle);
            if (end === -1) {
                searchIndex = start + 1;
                continue;
            }
            matchList.push({
                start,
                end,
                text: text.slice(start, end),
                kind: candidate.kind,
                recordId: index.ids[recordIndex],
            });
            searchIndex = end;
        }
    }
    // Longest first at a shared start, so `អ័ដាម` (Adam) wins over `អ័ដា`
    // (Adah), and then no two decorations may overlap.
    matchList.sort((one, another) => {
        return one.start - another.start || another.end - one.end;
    });
    const keptMatchList: LookupTextMatchType[] = [];
    let cursor = 0;
    for (const match of matchList) {
        if (match.start < cursor) {
            continue;
        }
        keptMatchList.push(match);
        cursor = match.end;
    }
    return keptMatchList;
}
