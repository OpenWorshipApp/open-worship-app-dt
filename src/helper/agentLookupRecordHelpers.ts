/**
 * What `owa_lookup_record` says about one person or place of the names
 * lookup: every field the Lookup Detail panel draws, in fields a model reads
 * -- English keys, the record's own words as values, a related record named
 * and given its id so the next call can follow it.
 *
 * Pure: the records come in through the two resolvers the worker
 * (`agentLookupHelpers.ts`) builds over the lookup managers, so this module
 * neither loads the ~34MB dataset nor pulls `bible-note` in, and a test can
 * hand it a record of its own.
 */

// The record types as the dataset fills them (`bible-note`'s
// `MentionNameMatch` / `MentionLocationMatch`), written out as far as they
// are read here: a type import of that package is free, but its shape is the
// only thing this module needs.
export type LookupNameRecordType = {
    id: string | null;
    name: string;
    kjvName: string | null;
    oldName: string | null;
    title: string;
    description: string;
    gender: string;
    age: string;
    years: { type: string; start: number; end: number }[];
    locations: string[];
    spouses: string[];
    children: string[];
    parents: string[];
    siblings: string[];
    cousin: string[];
    type: string;
    verses: string[];
    links: { type: string; url: string }[];
    wikipedia: string | null;
};

export type LookupLocationRecordType = {
    id: string | null;
    name: string;
    kjvName: string | null;
    oldName: string | null;
    title: string;
    description: string;
    type: string;
    relatedLocations: string[];
    modernIdentification: string | null;
    coordinates: { latitude: number; longitude: number } | null;
    verses: string[];
    links: { type: string; url: string }[];
    wikipedia: string | null;
    uncertainty: boolean;
};

type LookupRecordRefType = {
    id: string | null;
    name: string;
    kjvName: string | null;
};

export type LookupRecordResolverType = {
    findName: (id: string) => LookupRecordRefType | null;
    findLocation: (idOrName: string) => LookupRecordRefType | null;
};

export type QuotedVerseType = {
    key: string;
    ref: string;
    title?: string;
    text: string;
};

// Aaron's 249 references are the most any record has; a list past this is
// cut and counted (`verseCount`), never dropped in silence.
export const MAX_LISTED_VERSES = 300;
// The references quoted with their words, first first: what "what does the
// Bible say about them" is answered from without a second call.
export const MAX_QUOTED_VERSES = 8;
const MAX_TEXT_CHARS = 1200;

/**
 * Where every person and place of the names lookup comes from, said on each
 * record so a question about it can be answered (the user, 2026-10-18:
 * _chatbot should know the location/name is from KJV, in case want to
 * know_). The English dataset was drawn from the King James Version; a
 * translated one (Khmer, French) is that dataset put into its language, its
 * `kjvName` the KJV's own spelling, and the verse keys the KJV's numbering.
 */
export const LOOKUP_SOURCE_TEXT =
    'The names lookup, drawn from the King James Version (KJV) of the ' +
    'Bible; a record in another language is a translation of the KJV ' +
    'record, kjvName is the name as the KJV spells it, and verse keys ' +
    'follow the KJV numbering.';

// "[Genesis](book-key://GEN)" -> "Genesis": the label is the words; the
// address is the panel's to follow, and a model reads the record's ids from
// the fields that carry them.
const REFERENCE_TOKEN_PATTERN =
    /\[([^\]]+)\]\((?:name-id|location-id|book-key|chapter-key|verse-key):\/\/[^)]*\)/g;

export function toPlainRecordText(value: string | null | undefined) {
    return typeof value === 'string'
        ? value
              .replace(REFERENCE_TOKEN_PATTERN, '$1')
              .replaceAll(/\s+/g, ' ')
              .trim()
              .slice(0, MAX_TEXT_CHARS)
        : '';
}

function checkIsKnown(value: string | null | undefined) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed !== '' && trimmed.toLowerCase() !== 'unknown';
}

function toKjvName(record: { name: string; kjvName: string | null }) {
    const kjvName = (record.kjvName ?? '').trim();
    return kjvName === '' || kjvName === record.name.trim() ? null : kjvName;
}

function toLinkList(record: {
    links: { type: string; url: string }[];
    wikipedia: string | null;
}) {
    const byUrl = new Map<string, { type: string; url: string }>();
    for (const link of record.links ?? []) {
        if (typeof link?.url === 'string' && /^https?:\/\//.test(link.url)) {
            byUrl.set(link.url, { type: String(link.type), url: link.url });
        }
    }
    if (
        typeof record.wikipedia === 'string' &&
        /^https?:\/\//.test(record.wikipedia) &&
        !byUrl.has(record.wikipedia)
    ) {
        byUrl.set(record.wikipedia, {
            type: 'wikipedia',
            url: record.wikipedia,
        });
    }
    return Array.from(byUrl.values());
}

function toNamedList(
    idList: string[],
    find: (id: string) => LookupRecordRefType | null,
) {
    return (idList ?? []).map((idOrName) => {
        const found = find(idOrName);
        if (found === null) {
            return { name: idOrName };
        }
        const kjvName = toKjvName(found);
        return {
            ...(found.id === null ? {} : { id: found.id }),
            name: found.name,
            ...(kjvName === null ? {} : { kjvName }),
        };
    });
}

// Only the lists a record fills: an empty "cousins" is a field a model
// reads as "has none", which the dataset does not say.
function withLists(entries: [string, unknown[]][]) {
    return Object.fromEntries(
        entries.filter(([_key, list]) => {
            return list.length > 0;
        }),
    );
}

function withVerses(verses: string[], quoted: QuotedVerseType[]) {
    const list = (verses ?? []).filter((one) => {
        return typeof one === 'string' && one.trim().length > 0;
    });
    return {
        verseCount: list.length,
        ...(list.length > 0
            ? { verses: list.slice(0, MAX_LISTED_VERSES) }
            : {}),
        ...(quoted.length > 0 ? { quoted } : {}),
    };
}

export function toNameRecordResult(
    record: LookupNameRecordType,
    resolver: LookupRecordResolverType,
    quoted: QuotedVerseType[],
) {
    const kjvName = toKjvName(record);
    return {
        kind: 'name',
        source: LOOKUP_SOURCE_TEXT,
        id: record.id,
        name: record.name,
        ...(kjvName === null ? {} : { kjvName }),
        ...(checkIsKnown(record.oldName)
            ? { alsoCalled: toPlainRecordText(record.oldName) }
            : {}),
        ...(checkIsKnown(record.type) ? { type: record.type } : {}),
        ...(checkIsKnown(record.gender) ? { gender: record.gender } : {}),
        ...(checkIsKnown(record.age) ? { age: record.age } : {}),
        ...(record.years?.length > 0
            ? {
                  years: record.years.map((range) => {
                      return `${range.type}: ${range.start} – ${range.end}`;
                  }),
              }
            : {}),
        summary: toPlainRecordText(record.title),
        description: toPlainRecordText(record.description),
        ...withLists([
            ['places', toNamedList(record.locations, resolver.findLocation)],
            ['parents', toNamedList(record.parents, resolver.findName)],
            ['spouses', toNamedList(record.spouses, resolver.findName)],
            ['children', toNamedList(record.children, resolver.findName)],
            ['siblings', toNamedList(record.siblings, resolver.findName)],
            ['cousins', toNamedList(record.cousin, resolver.findName)],
            ['links', toLinkList(record)],
        ]),
        ...withVerses(record.verses, quoted),
    };
}

export function toLocationRecordResult(
    record: LookupLocationRecordType,
    resolver: LookupRecordResolverType,
    quoted: QuotedVerseType[],
) {
    const kjvName = toKjvName(record);
    return {
        kind: 'location',
        source: LOOKUP_SOURCE_TEXT,
        id: record.id,
        name: record.name,
        ...(kjvName === null ? {} : { kjvName }),
        ...(checkIsKnown(record.oldName)
            ? { alsoCalled: toPlainRecordText(record.oldName) }
            : {}),
        ...(checkIsKnown(record.type) ? { type: record.type } : {}),
        summary: toPlainRecordText(record.title),
        description: toPlainRecordText(record.description),
        ...(checkIsKnown(record.modernIdentification)
            ? {
                  modernIdentification: toPlainRecordText(
                      record.modernIdentification,
                  ),
              }
            : {}),
        ...(record.coordinates === null || record.coordinates === undefined
            ? {}
            : { coordinates: record.coordinates }),
        ...(record.uncertainty === true ? { isPlaceUncertain: true } : {}),
        ...withLists([
            [
                'relatedPlaces',
                toNamedList(record.relatedLocations, resolver.findLocation),
            ],
            ['links', toLinkList(record)],
        ]),
        ...withVerses(record.verses, quoted),
    };
}

/** `GEN 2:19-21` -> `Genesis 2:19-21`, by the English book names given. */
export function toEnglishVerseRef(
    key: string,
    bookNameMap: { [bookKey: string]: string },
) {
    return key.replace(/^(\S+)/, (bookKey) => {
        return bookNameMap[bookKey] ?? bookKey;
    });
}

/** A passage's words, cut to what one answer can carry. */
export function toQuotedText(text: string, limit = MAX_TEXT_CHARS) {
    const flat = text.replaceAll(/[ \t]+/g, ' ').trim();
    return flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat;
}
