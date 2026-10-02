import type { MentionNameType } from 'bible-note';

// How many records one page of results shows.
export const PAGE_SIZE = 20;

// The sentinel filter value meaning "don't restrict by name type".
export const ALL_TYPES = 'all';

export const LOCATION_ICON_CLASS = 'bi bi-geo-alt-fill';

// A verse panel has no record behind it, so it names its own icon
// rather than reading one off a record's `type`.
export const VERSE_ICON_CLASS = 'bi bi-book-half';

const NAME_TYPE_ICON_CLASS: { [key in MentionNameType]: string } = {
    concept: 'bi-lightbulb-fill',
    deity: 'bi-brightness-high-fill',
    group: 'bi-people-fill',
    life: 'bi-heart-fill',
    month: 'bi-calendar-event-fill',
    person: 'bi-person-fill',
    place: 'bi-geo-alt-fill',
    supernatural: 'bi-stars',
    unknown: 'bi-question-circle-fill',
};

// Plural labels for the name-type filter. Kept as bare English literals so
// `tran` can translate them at the call site (a `tran` here would run at module
// load, before the language data is ready).
export const NAME_TYPE_LABEL: { [key in MentionNameType]: string } = {
    concept: 'Concepts',
    deity: 'Deities',
    group: 'Groups',
    life: 'Life',
    month: 'Months',
    person: 'People',
    place: 'Places',
    supernatural: 'Supernatural',
    unknown: 'Unknown',
};

// The same nine types named one at a time, for the places that label a SINGLE
// record rather than a filter over many — the detail panel's fact chip and its
// `Type` row. Bare English literals for the same reason as above.
export const NAME_TYPE_SINGULAR_LABEL: { [key in MentionNameType]: string } = {
    concept: 'Concept',
    deity: 'Deity',
    group: 'Group',
    life: 'Life',
    month: 'Month',
    person: 'Person',
    place: 'Place',
    supernatural: 'Supernatural',
    unknown: 'Unknown',
};

// Mirrors `bible-note`'s own `normalizeMentionNameType`, including its fallback
// to `person` for an unrecognized value. Reimplemented rather than imported so
// this module — and therefore the panel that renders before the dataset has
// loaded — pulls in none of that package's code.
function normalizeNameType(type: string | null | undefined): MentionNameType {
    const normalized = (type ?? '').trim().toLowerCase();
    if (normalized in NAME_TYPE_ICON_CLASS) {
        return normalized as MentionNameType;
    }
    return 'person';
}

export function getNameTypeIconClass(type: string | null | undefined): string {
    return `bi ${NAME_TYPE_ICON_CLASS[normalizeNameType(type)]}`;
}

/**
 * A name record's raw `type` as a readable label, ready for translation.
 *
 * The datasets keep this field in English whatever language the records
 * themselves are in (`"gender": "male"` sits beside a Khmer name), so it is a
 * key, not text to show. An empty type has nothing to label and stays empty
 * rather than becoming "Person" out of nowhere.
 */
export function getNameTypeSingularLabel(
    type: string | null | undefined,
): string {
    if (typeof type !== 'string' || type.trim() === '') {
        return '';
    }
    return NAME_TYPE_SINGULAR_LABEL[normalizeNameType(type)];
}

// A name record's `gender`. The datasets keep it in English whatever language
// the record is in, and it is a closed set (`male`, `female`, `unknown` across
// every package), so it is a key to translate, exactly like `type`. Bare English
// literals for the same reason as the maps above.
export const GENDER_LABEL: { [gender: string]: string } = {
    male: 'Male',
    female: 'Female',
};

// A location record's `type`: also English in every package, and also a
// closed set -- these 31 words are every value the shipped datasets use. A
// value a newer dataset adds is shown as written until it is listed here.
// `height` is a hill, not a measurement, so it does not borrow the `Height` key
// the rest of the app already translates as a dimension.
export const LOCATION_TYPE_LABEL: { [type: string]: string } = {
    battlefield: 'Battlefield',
    camp: 'Camp',
    cape: 'Cape',
    city: 'City',
    cliff: 'Cliff',
    encampment: 'Encampment',
    gate: 'Gate',
    height: 'Heights',
    island: 'Island',
    landmark: 'Landmark',
    'memorial place': 'Memorial place',
    mountain: 'Mountain',
    place: 'Place',
    plain: 'Plain',
    pool: 'Pool',
    region: 'Region',
    river: 'River',
    road: 'Road',
    sea: 'Sea',
    settlement: 'Settlement',
    site: 'Site',
    spring: 'Spring',
    street: 'Street',
    stronghold: 'Stronghold',
    territory: 'Territory',
    tower: 'Tower',
    town: 'Town',
    valley: 'Valley',
    waterbody: 'Body of water',
    well: 'Well',
    wilderness: 'Wilderness',
};

/**
 * A record's enum field (`gender`, a location's `type`) as a label in the
 * lookup language.
 *
 * Decided on the ENGLISH value and only then translated, for the reason the
 * name type is: `unknown` is dropped by comparing the string, and a translated
 * `មិនស្គាល់` would no longer be recognized as one. A value missing from the
 * map is shown as the dataset wrote it -- never handed to `translate`, where it
 * could collide with an unrelated key of the app's dictionary.
 */
export function toRecordEnumLabel(
    value: string | null | undefined,
    labelMap: Readonly<{ [key: string]: string }>,
    translate: (text: string) => string,
): string {
    const trimmedValue = (value ?? '').trim();
    const key = trimmedValue.toLowerCase();
    if (key === '' || key === 'unknown') {
        return '';
    }
    // Own keys only: `constructor` is a word, too.
    return Object.hasOwn(labelMap, key)
        ? translate(labelMap[key])
        : trimmedValue;
}

/**
 * Every inline reference scheme the datasets emit.
 *
 * Kept in ONE place because two modules must agree on it: this stripper and the
 * renderer in `LookupDetailPartsComp`. When the datasets grew `book-key` and
 * `chapter-key` tokens, a list that knew only the older three left the raw
 * `[Acts](book-key://ACT)` markup showing through as text.
 */
export const REFERENCE_TOKEN_SCHEME_LIST = [
    'name-id',
    'location-id',
    'book-key',
    'chapter-key',
    'verse-key',
] as const;

const REFERENCE_TOKEN_SCHEME_PATTERN = REFERENCE_TOKEN_SCHEME_LIST.join('|');

// Titles and descriptions carry inline reference tokens, e.g.
// "[Jesus](name-id://<id>)" or "[John 3:16](verse-key://<verse>)". Only the
// readable label belongs in a one-line summary; without this the raw markup
// shows through.
const MENTION_REFERENCE_TOKEN_REGEX = new RegExp(
    String.raw`\[([^\]]+)\]\((?:` +
        REFERENCE_TOKEN_SCHEME_PATTERN +
        String.raw`):\/\/[^)]*\)`,
    'g',
);

export function getPlainReferenceText(value: string): string {
    return value.replace(MENTION_REFERENCE_TOKEN_REGEX, '$1');
}

/**
 * The English name worth showing beside a record's own name, or `''` when there
 * is nothing to add — the KJV dataset itself, whose `name` already IS the
 * English one, or a translated record that spells it identically.
 *
 * Shown the way a bible book reads in a translated UI: `លោកុប្បត្តិ (Genesis)`.
 *
 * Mirrors `bible-note`'s own `getMentionKjvName`, reimplemented here for the
 * same reason as `normalizeNameType` above: this module is imported by surfaces
 * that render before — and without — that ~46MB package, and a value import
 * would put its whole graph in their eager chunk.
 */
export function getRecordKjvName(
    record: Readonly<{ name: string; kjvName?: string | null }>,
): string {
    const kjvName = (record.kjvName ?? '').trim();
    return kjvName === '' || kjvName === record.name.trim() ? '' : kjvName;
}

/**
 * `name (KjvName)` as ONE string, for the places that cannot render two
 * elements — a `title` tooltip, a clipboard summary.
 */
export function getRecordDisplayName(
    record: Readonly<{ name: string; kjvName?: string | null }>,
): string {
    const kjvName = getRecordKjvName(record);
    return kjvName === '' ? record.name : `${record.name} (${kjvName})`;
}
