import type { MentionNameType } from 'bible-note';

// How many records one page of results shows.
export const PAGE_SIZE = 20;

// The sentinel filter value meaning "don't restrict by name type".
export const ALL_TYPES = 'all';

export const LOCATION_ICON_CLASS = 'bi bi-geo-alt-fill';

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

// Titles and descriptions carry inline reference tokens, e.g.
// "[Jesus](name-id://<id>)" or "[John 3:16](verse-key://<verse>)". Only the
// readable label belongs in a one-line summary; without this the raw markup
// shows through.
const MENTION_REFERENCE_TOKEN_REGEX =
    /\[([^\]]+)\]\((?:name-id|location-id|verse-key):\/\/[^)]*\)/g;

export function getPlainReferenceText(value: string): string {
    return value.replace(MENTION_REFERENCE_TOKEN_REGEX, '$1');
}
