import { toVerseFullKeyFormat } from '../helper/bible-helpers/bibleKeyFormatHelpers';
import type { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import {
    genLookupFileStore,
    loadLookupRecordLabelsFile,
} from './lookupIndexFileHelpers';
import {
    LOCATION_ICON_CLASS,
    getNameTypeIconClass,
} from './lookupPresentationHelpers';
import { findLookupTextMatches } from './verseTextIndexHelpers';
import type {
    LookupRecordLabelsType,
    LookupTextIndexType,
} from './verseTextIndexTypes';

/**
 * Answers "which names and locations does scripture attest in THESE verses".
 *
 * TWO sources, unioned, because neither alone is right:
 *
 * - The dataset's own verse evidence (`verseNames` / `verseLocations`), which is
 *   what names a record the verse never spells out — "Satan" in Luke 13:16 is
 *   there under "the devil".
 * - The very same in-text scan that underlines names in the reader. The evidence
 *   map is incomplete: Luke 13:1 says "Pilate" in so many words and the reader
 *   underlines him, yet the map does not list him. Reporting only the evidence
 *   would contradict what the user can see two panes to the left.
 *
 * The scan needs the KJV wording — the dataset was extracted from it — so the
 * caller passes the KJV chapter, whatever bible the pane displays. Everything
 * else is integer-map lookups over already-resident data; the ~35MB lookup
 * dataset stays untouched.
 */

/**
 * The labels sidecar, or null while it loads. Held only while something renders
 * a record list, then released — see `lookupIndexFileHelpers`.
 */
export const useLookupRecordLabels = genLookupFileStore<LookupRecordLabelsType>(
    loadLookupRecordLabelsFile,
);

export type VerseRecordType = {
    recordId: string;
    kind: 'name' | 'location';
    label: string;
    title: string;
    iconClass: string;
    // Verse numbers within this target that attest the record, in order.
    verseList: number[];
};

export type VerseRecordGroupType = {
    names: VerseRecordType[];
    locations: VerseRecordType[];
};

const EMPTY_GROUP: VerseRecordGroupType = { names: [], locations: [] };

/**
 * Whether the two derived files describe the same set of records.
 *
 * They are written by one build pass, so a mismatch means one of them was
 * hand-edited or half-written. Rendering anyway would attach the wrong name to
 * every record, so the caller shows "unavailable" instead.
 */
export function checkIsRecordLabelsMatching(
    index: LookupTextIndexType,
    recordLabels: LookupRecordLabelsType,
) {
    return recordLabels.labels.length === index.ids.length;
}

// The index stores record ids interned as integers, but the in-text scan hands
// back the id itself. Kept per index object so the reverse map is built once and
// dies with the index rather than on every reader change.
const recordIndexMapCache = new WeakMap<
    LookupTextIndexType,
    Map<string, number>
>();

function getRecordIndexMap(index: LookupTextIndexType) {
    const cachedMap = recordIndexMapCache.get(index);
    if (cachedMap !== undefined) {
        return cachedMap;
    }
    const recordIndexMap = new Map(
        index.ids.map((recordId, recordIndex) => {
            return [recordId, recordIndex] as const;
        }),
    );
    recordIndexMapCache.set(index, recordIndexMap);
    return recordIndexMap;
}

type CandidateType = { recordIndex: number; kind: 'name' | 'location' };

// Null for a record the dataset attests but never named: there is nothing to
// show in a row and nothing to open behind it.
function toVerseRecord(
    index: LookupTextIndexType,
    recordLabels: LookupRecordLabelsType,
    recordIndex: number,
    kind: 'name' | 'location',
    verse: number,
): VerseRecordType | null {
    const label = recordLabels.labels[recordIndex] ?? '';
    if (label === '') {
        return null;
    }
    return {
        recordId: index.ids[recordIndex],
        kind,
        label,
        title: recordLabels.titles[recordIndex] ?? '',
        iconClass:
            kind === 'location'
                ? LOCATION_ICON_CLASS
                : getNameTypeIconClass(recordLabels.types[recordIndex]),
        verseList: [verse],
    };
}

function collectVerseCandidates(
    index: LookupTextIndexType,
    shortVerse: string,
    verseText: string | undefined,
): CandidateType[] {
    const candidateList: CandidateType[] = (
        index.verseNames[shortVerse] ?? []
    ).map((recordIndex) => {
        return { recordIndex, kind: 'name' as const };
    });
    for (const recordIndex of index.verseLocations[shortVerse] ?? []) {
        candidateList.push({ recordIndex, kind: 'location' });
    }
    if (verseText === undefined || verseText === '') {
        return candidateList;
    }
    const recordIndexMap = getRecordIndexMap(index);
    for (const match of findLookupTextMatches(index, verseText, shortVerse)) {
        const recordIndex = recordIndexMap.get(match.recordId);
        if (recordIndex !== undefined) {
            candidateList.push({ recordIndex, kind: match.kind });
        }
    }
    return candidateList;
}

export function collectVerseRecords(
    index: LookupTextIndexType,
    recordLabels: LookupRecordLabelsType,
    target: BibleTargetType,
    // The KJV chapter this target sits in, keyed by verse number as `getVerses`
    // returns it. Null when KJV is not installed — the evidence map alone still
    // answers, just less completely.
    kjvVerseMap: { [verse: string]: string } | null,
): VerseRecordGroupType {
    const { bookKey, chapter, verseStart, verseEnd } = target;
    if (
        verseEnd < verseStart ||
        !checkIsRecordLabelsMatching(index, recordLabels)
    ) {
        return EMPTY_GROUP;
    }
    // Keyed by record index so a name spanning several verses is ONE row that
    // accumulates its verses, not a repeated row per verse. Insertion order is
    // scripture order, which is the order a reader expects to see them in.
    const recordMap = new Map<number, VerseRecordType>();
    for (let verse = verseStart; verse <= verseEnd; verse++) {
        const shortVerse = toVerseFullKeyFormat(bookKey, chapter, verse);
        const candidateList = collectVerseCandidates(
            index,
            shortVerse,
            kjvVerseMap?.[verse.toString()],
        );
        for (const { recordIndex, kind } of candidateList) {
            const existingRecord = recordMap.get(recordIndex);
            if (existingRecord !== undefined) {
                // Both sources can name the same record in the same verse.
                if (existingRecord.verseList.at(-1) !== verse) {
                    existingRecord.verseList.push(verse);
                }
                continue;
            }
            const record = toVerseRecord(
                index,
                recordLabels,
                recordIndex,
                kind,
                verse,
            );
            if (record !== null) {
                recordMap.set(recordIndex, record);
            }
        }
    }
    const recordList = Array.from(recordMap.values());
    return {
        names: recordList.filter((record) => record.kind === 'name'),
        locations: recordList.filter((record) => record.kind === 'location'),
    };
}

/**
 * `3:1, 3:2` — the verses of the group this record occurs in, so a row read on
 * its own still says where it came from.
 */
export function toVerseListLabel(chapter: number, verseList: number[]) {
    return verseList
        .map((verse) => {
            return `${chapter}:${verse}`;
        })
        .join(', ');
}
