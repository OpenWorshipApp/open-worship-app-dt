import type { AnyObjectType } from '../helper/typeHelpers';
import { getAllLangsAsync } from '../lang/langHelpers';
import type { LookupTextIndexType } from './verseTextIndexTypes';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

/**
 * Builds the slim in-text lookup index from the shipped lookup dataset.
 *
 * This module is imported DYNAMICALLY and only on a cache miss, because running
 * it is the one moment the app pays for the full ~35MB dataset: it is read,
 * reduced to surface forms plus verse evidence, and dropped again. The result is
 * written to the data folder so no later run repeats any of it.
 */

// A record's `name` doubles as its display label, so ambiguous people carry a
// disambiguator that never appears in scripture verbatim ("Elhanan son of Dodo",
// "Cainan (son of Arphaxad)", "Jesus (name)", "Barachel, father of Elihu").
// Indexing only the full label would leave those records unreachable from text,
// so every label also contributes the bare name it is built on.
const DISAMBIGUATOR_PATTERN =
    /^(.*?)(?:\s*\(|,\s|\s+(?:son|daughter|father|mother|wife|husband|brother|sister|the)\s+of\s+)/i;

// Two characters is too short to be safe in running prose: the dataset's 2-char
// entries ("Er", "Uz") would false-positive against ordinary words.
const MINIMUM_NEEDLE_LENGTH = 3;

const DEFAULT_LOOKUP_LANG_CODE = 'en';

function deriveNeedleList(rawName: unknown): string[] {
    if (typeof rawName !== 'string') {
        return [];
    }
    const trimmedName = rawName.trim();
    if (trimmedName === '') {
        return [];
    }
    const needleSet = new Set<string>();
    const addNeedle = (value: string) => {
        const normalizedValue = value.trim().toLowerCase();
        if (normalizedValue.length >= MINIMUM_NEEDLE_LENGTH) {
            needleSet.add(normalizedValue);
        }
    };
    addNeedle(trimmedName);
    const matched = DISAMBIGUATOR_PATTERN.exec(trimmedName);
    if (matched !== null && matched[1].trim() !== '') {
        addNeedle(matched[1]);
    }
    return Array.from(needleSet);
}

async function readRawLookupData() {
    const langDataList = await getAllLangsAsync();
    for (const langData of langDataList) {
        if (
            langData.langCode !== DEFAULT_LOOKUP_LANG_CODE ||
            langData.getLookupData === undefined
        ) {
            continue;
        }
        const lookupData = await langData.getLookupData('');
        if (lookupData !== null) {
            return lookupData;
        }
    }
    return null;
}

export async function buildLookupTextIndex(): Promise<LookupTextIndexType | null> {
    const rawLookupData = await readRawLookupData();
    if (rawLookupData === null) {
        return null;
    }
    const namesFile = rawLookupData.namesMap as AnyObjectType;
    const locationsFile = rawLookupData.locationsMap as AnyObjectType;
    const nameRecordList: AnyObjectType[] = Object.values(
        namesFile.namesMap ?? {},
    );
    const rawLocationsMap = locationsFile.locationsMap ?? [];
    const locationRecordList: AnyObjectType[] = Array.isArray(rawLocationsMap)
        ? rawLocationsMap
        : Object.values(rawLocationsMap);

    // Record ids are 36-char UUIDs and each would otherwise be repeated in the
    // needle map and again in the verse map. Interning them into one list and
    // referring to them by integer index is what keeps the written file small.
    const idIndexMap = new Map<string, number>();
    const idList: string[] = [];
    const internId = (id: string) => {
        const existingIndex = idIndexMap.get(id);
        if (existingIndex !== undefined) {
            return existingIndex;
        }
        const idIndex = idList.length;
        idIndexMap.set(id, idIndex);
        idList.push(id);
        return idIndex;
    };

    const buildNeedleMap = (recordList: AnyObjectType[]) => {
        const needleMap: { [needle: string]: number[] } = {};
        for (const record of recordList) {
            const recordId = record.id;
            if (typeof recordId !== 'string') {
                continue;
            }
            for (const rawName of [record.name, record.oldName]) {
                for (const needle of deriveNeedleList(rawName)) {
                    const idIndexList = (needleMap[needle] ??= []);
                    const idIndex = internId(recordId);
                    if (!idIndexList.includes(idIndex)) {
                        idIndexList.push(idIndex);
                    }
                }
            }
        }
        return needleMap;
    };

    const buildVerseMap = (rawVerseMap: AnyObjectType | undefined) => {
        const verseMap: { [shortVerse: string]: number[] } = {};
        for (const [shortVerse, rawIdList] of Object.entries(
            rawVerseMap ?? {},
        )) {
            if (!Array.isArray(rawIdList) || rawIdList.length === 0) {
                continue;
            }
            verseMap[shortVerse] = rawIdList.map(internId);
        }
        return verseMap;
    };

    return {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids: idList,
        names: buildNeedleMap(nameRecordList),
        locations: buildNeedleMap(locationRecordList),
        verseNames: buildVerseMap(namesFile.versePersonsMap),
        verseLocations: buildVerseMap(locationsFile.verseLocationsMap),
    };
}
