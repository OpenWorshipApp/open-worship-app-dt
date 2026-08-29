import type { AnyObjectType } from '../helper/typeHelpers';
import { DEFAULT_LANG_CODE, getLangDataByCodeAsync } from '../lang/langHelpers';
import { readJsonFile } from '../lang/lookupDataVersionHelpers';
import { getPlainReferenceText } from './lookupPresentationHelpers';
import type {
    LookupRecordLabelsType,
    LookupTextIndexType,
} from './verseTextIndexTypes';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

/**
 * Builds the slim in-text lookup index from the shipped lookup dataset.
 *
 * This module is imported DYNAMICALLY and only on a cache miss, because running
 * it is the one moment the app pays for the full ~35MB dataset: it is read,
 * reduced to surface forms plus verse evidence, and dropped again. The results
 * are written to the data folder so no later run repeats any of it.
 *
 * ONE pass produces BOTH output files — the index and its labels sidecar — so
 * the dataset is never read twice even though the two are loaded independently.
 *
 * The INDEX is always built from English and only from English: it exists to
 * match KJV wording in rendered verse text, so its surface forms have to be the
 * KJV's. Only the LABELS sidecar follows the user's lookup language, and it is
 * aligned to the English record ids, so a translated package is read purely to
 * relabel records the English pass already identified.
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

// One line under a name in a list, nothing more. The raw descriptions run to
// paragraphs, and carrying them whole would roughly double the sidecar for text
// no row ever shows.
const MAXIMUM_TITLE_LENGTH = 120;

function toShortTitle(rawTitle: unknown): string {
    if (typeof rawTitle !== 'string' || rawTitle.trim() === '') {
        return '';
    }
    const plainTitle = getPlainReferenceText(rawTitle).trim();
    if (plainTitle.length <= MAXIMUM_TITLE_LENGTH) {
        return plainTitle;
    }
    return plainTitle.slice(0, MAXIMUM_TITLE_LENGTH).trimEnd() + '...';
}

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

async function readRawLookupData(langCode: string) {
    const langData = await getLangDataByCodeAsync(langCode);
    if (langData?.getLookupData === undefined) {
        return null;
    }
    return await langData.getLookupData({
        packageDir: langData.packageDir,
        readJsonFile,
    });
}

// Names are an id-keyed object and locations have been both an array and an
// id-keyed object across dataset versions; `Object.values` reads either.
function toRecordList(rawMap: unknown): AnyObjectType[] {
    return Object.values((rawMap ?? {}) as AnyObjectType);
}

type RecordDisplayType = {
    label: string;
    type: string;
    title: string;
    // Filled in by the translated pass only, from the English label this pass
    // wrote — never read out of the translated package's own `kjvName`, which a
    // partially updated dataset can be missing.
    kjvName: string;
};

export type BuiltLookupDataType = {
    index: LookupTextIndexType;
    recordLabels: LookupRecordLabelsType;
};

/**
 * The English pass: the index itself plus a display record per id.
 *
 * Kept in its own function so the ~35MB of raw English JSON and the record
 * arrays over it become unreachable the moment it returns. A translated pass
 * reads another ~35MB right after, and holding both at once is exactly the
 * doubled peak this app cannot afford.
 */
async function buildEnglishPass() {
    const rawLookupData = await readRawLookupData(DEFAULT_LANG_CODE);
    if (rawLookupData === null) {
        return null;
    }
    const namesFile = rawLookupData.namesMap as AnyObjectType;
    const locationsFile = rawLookupData.locationsMap as AnyObjectType;
    const nameRecordList = toRecordList(namesFile.namesMap);
    const locationRecordList = toRecordList(locationsFile.locationsMap);

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

    // Display data for EVERY record, so a record reachable only through the
    // verse maps (never spelled out in the text) still gets a label. Held as a
    // map because interning order is not known until all four maps are built.
    const displayMap = new Map<string, RecordDisplayType>();
    const collectDisplay = (
        recordList: AnyObjectType[],
        isKeepingType: boolean,
    ) => {
        for (const record of recordList) {
            if (typeof record.id !== 'string') {
                continue;
            }
            const rawType = record.type;
            displayMap.set(record.id, {
                label: typeof record.name === 'string' ? record.name : '',
                type:
                    isKeepingType && typeof rawType === 'string' ? rawType : '',
                // Truncated here rather than kept whole, so the raw paragraphs
                // are the only thing this pass lets go of.
                title: toShortTitle(record.title),
                kjvName: '',
            });
        }
    };
    collectDisplay(nameRecordList, true);
    // Locations carry a `type` of their own, but their icon is fixed and the
    // kind is already known from which verse map a record came out of, so
    // keeping it would only cost bytes.
    collectDisplay(locationRecordList, false);

    const index: LookupTextIndexType = {
        version: LOOKUP_TEXT_INDEX_VERSION,
        ids: idList,
        names: buildNeedleMap(nameRecordList),
        locations: buildNeedleMap(locationRecordList),
        verseNames: buildVerseMap(namesFile.versePersonsMap),
        verseLocations: buildVerseMap(locationsFile.verseLocationsMap),
    };
    return { index, displayMap };
}

/**
 * Overwrites the English label and title of every record the translated package
 * also carries, IN PLACE.
 *
 * Records it does not carry keep their English text: a partially translated
 * package must leave a readable row rather than an empty one, which
 * `toVerseRecord` would drop from the list altogether.
 *
 * `type` is deliberately not touched — it is an enum the icon map is keyed on,
 * not prose, and a translated package spelling it differently would silently
 * cost every one of those records its icon.
 */
async function applyTranslatedLabels(
    langCode: string,
    displayMap: Map<string, RecordDisplayType>,
) {
    const rawLookupData = await readRawLookupData(langCode);
    if (rawLookupData === null) {
        return;
    }
    const namesFile = rawLookupData.namesMap as AnyObjectType;
    const locationsFile = rawLookupData.locationsMap as AnyObjectType;
    for (const record of [
        ...toRecordList(namesFile.namesMap),
        ...toRecordList(locationsFile.locationsMap),
    ]) {
        if (typeof record.id !== 'string') {
            continue;
        }
        const display = displayMap.get(record.id);
        if (display === undefined) {
            // Known to the translated package but not to the English one, so no
            // id was interned for it and nothing can ever reference it.
            continue;
        }
        if (typeof record.name === 'string' && record.name.trim() !== '') {
            // The English label is worth keeping beside the translated one, the
            // way a bible book reads `លោកុប្បត្តិ (Genesis)` — but only when the
            // two actually differ, so a record the translation spells
            // identically does not gain a row saying its own name twice.
            display.kjvName =
                display.label.trim() === record.name.trim()
                    ? ''
                    : display.label;
            display.label = record.name;
        }
        const translatedTitle = toShortTitle(record.title);
        if (translatedTitle !== '') {
            display.title = translatedTitle;
        }
    }
}

/**
 * @param labelsLangCode which language the labels sidecar is written in. The
 * index is English whatever this says.
 */
export async function buildLookupTextIndex(
    labelsLangCode: string = DEFAULT_LANG_CODE,
): Promise<BuiltLookupDataType | null> {
    const englishPass = await buildEnglishPass();
    if (englishPass === null) {
        return null;
    }
    const { index, displayMap } = englishPass;
    if (labelsLangCode !== DEFAULT_LANG_CODE) {
        await applyTranslatedLabels(labelsLangCode, displayMap);
    }
    const recordLabels: LookupRecordLabelsType = {
        version: LOOKUP_TEXT_INDEX_VERSION,
        labels: index.ids.map((id) => displayMap.get(id)?.label ?? ''),
        types: index.ids.map((id) => displayMap.get(id)?.type ?? ''),
        titles: index.ids.map((id) => displayMap.get(id)?.title ?? ''),
        kjvNames: index.ids.map((id) => displayMap.get(id)?.kjvName ?? ''),
    };
    return { index, recordLabels };
}
