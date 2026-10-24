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
    // The person a name record is (`lookupNameAliasHelpers.ts`): Sem is
    // Shem, so Noah's children are three, not four. Left out, every record
    // is itself.
    toMainNameId?: (id: string) => string;
};

/** A record named beside another, with the line that tells them apart. */
export type LookupRecordBriefType = {
    id: string;
    name: string;
    kjvName?: string;
    summary?: string;
};

/**
 * What a person's record is given beside its own fields (2026-10-22): its
 * other names -- the KJV's Greek spellings and renamings, each with the
 * verses that use it -- and the other people of the same name.
 */
export type NameRecordExtraType = {
    otherForms: (LookupRecordBriefType & { verses: string[] })[];
    sameName: LookupRecordBriefType[];
    // Every verse of the person under any of its names, in Bible order.
    verses: string[];
};

/** A place's distance and direction, in kilometres and miles. */
export type PlaceDistanceType = {
    km: number;
    miles: number;
    // From the first place to the second, on the eight points of a compass.
    direction: string;
};

/**
 * What a place's record is given beside its own fields (2026-10-22): how
 * far it is from Jerusalem and which way, the places nearest it, the people
 * the lookup ties to it, and the other places of the same name.
 */
export type LocationRecordExtraType = {
    fromJerusalem: PlaceDistanceType | null;
    nearby: (LookupRecordBriefType & PlaceDistanceType)[];
    people: LookupRecordBriefType[];
    peopleCount: number;
    sameName: LookupRecordBriefType[];
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

/**
 * A person's family list with each person named once, by the record that
 * IS that person: Noah's children list Sem (Luke's spelling) beside Shem,
 * and Sem's parents Noe beside Noah -- one son and one father each
 * (2026-10-22). The record itself and its own other names are left out.
 */
function toPeopleList(
    idList: string[],
    resolver: LookupRecordResolverType,
    selfIdSet: ReadonlySet<string>,
) {
    const toMain = resolver.toMainNameId ?? ((id: string) => id);
    const seen = new Set<string>();
    const idListShown = (idList ?? []).flatMap((id) => {
        const mainId = toMain(id);
        if (selfIdSet.has(id) || selfIdSet.has(mainId) || seen.has(mainId)) {
            return [];
        }
        seen.add(mainId);
        return [resolver.findName(mainId) === null ? id : mainId];
    });
    return toNamedList(idListShown, resolver.findName);
}

/** A record as named beside another: its id, name and one line. */
export function toRecordBrief(record: {
    id: string | null;
    name: string;
    kjvName: string | null;
    title: string;
}): LookupRecordBriefType | null {
    if (record.id === null) {
        return null;
    }
    const kjvName = toKjvName(record);
    const summary = toPlainRecordText(record.title);
    return {
        id: record.id,
        name: record.name,
        ...(kjvName === null ? {} : { kjvName }),
        ...(summary === '' ? {} : { summary }),
    };
}

// `GEN 5:29-30` -> [book index, chapter, verse] for sorting in Bible order.
function toVerseKeyOrder(key: string, bookKeyList: readonly string[]) {
    const match = /^(\S+) (\d+):(\d+)/.exec(key.trim());
    if (match === null) {
        return [Number.MAX_SAFE_INTEGER, 0, 0];
    }
    const bookIndex = bookKeyList.indexOf(match[1]);
    return [
        bookIndex === -1 ? Number.MAX_SAFE_INTEGER : bookIndex,
        Number(match[2]),
        Number(match[3]),
    ];
}

/**
 * Several records' verse keys as one list, each once, in the Bible's own
 * order -- Noah's Genesis before Noe's Matthew 24:37.
 */
export function mergeVerseKeyLists(
    lists: readonly (readonly string[])[],
    bookKeyList: readonly string[],
) {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const list of lists) {
        for (const key of list ?? []) {
            if (typeof key !== 'string' || key.trim() === '' || seen.has(key)) {
                continue;
            }
            seen.add(key);
            merged.push(key);
        }
    }
    return merged.sort((a, b) => {
        const orderA = toVerseKeyOrder(a, bookKeyList);
        const orderB = toVerseKeyOrder(b, bookKeyList);
        return (
            orderA[0] - orderB[0] ||
            orderA[1] - orderB[1] ||
            orderA[2] - orderB[2]
        );
    });
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.609344;
const COMPASS_POINT_LIST = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
];

type CoordinatesType = { latitude: number; longitude: number };

function toRadians(degrees: number) {
    return (degrees * Math.PI) / 180;
}

function checkIsCoordinates(value: unknown): value is CoordinatesType {
    const coordinates = value as CoordinatesType | null;
    return (
        typeof coordinates?.latitude === 'number' &&
        typeof coordinates?.longitude === 'number' &&
        Number.isFinite(coordinates.latitude) &&
        Number.isFinite(coordinates.longitude)
    );
}

/**
 * How far one place is from another over the ground, and which way -- the
 * great-circle distance, rounded to a tenth under 100 km and to the
 * kilometre past it. Asked _how far is Bethlehem from Jerusalem?_ with both
 * coordinates in the dataset, the assistant had answered that neither the
 * record nor the Bible says (2026-10-22): a model is not to be trusted with
 * the arithmetic, so the tool does it.
 */
export function toPlaceDistance(
    from: unknown,
    to: unknown,
): PlaceDistanceType | null {
    if (!checkIsCoordinates(from) || !checkIsCoordinates(to)) {
        return null;
    }
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const latitudeDelta = toLatitude - fromLatitude;
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(fromLatitude) *
            Math.cos(toLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;
    const km =
        2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
    const bearing =
        (Math.atan2(
            Math.sin(longitudeDelta) * Math.cos(toLatitude),
            Math.cos(fromLatitude) * Math.sin(toLatitude) -
                Math.sin(fromLatitude) *
                    Math.cos(toLatitude) *
                    Math.cos(longitudeDelta),
        ) *
            180) /
            Math.PI +
        360;
    const round = (value: number) => {
        return value < 100 ? Math.round(value * 10) / 10 : Math.round(value);
    };
    return {
        km: round(km),
        miles: round(km / KM_PER_MILE),
        direction: COMPASS_POINT_LIST[Math.round((bearing % 360) / 45) % 8],
    };
}

// Jerusalem's record, the same id in every language's dataset: the place
// every other is measured from (`fromJerusalem`).
export const JERUSALEM_PLACE_ID = '00000000-0000-4000-8000-000000000117';

// The places named as nearest: a handful, and only those a day or two's walk
// away -- the next town over, not the next country.
export const MAX_NEARBY_PLACES = 6;
const MAX_NEARBY_KM = 80;

type PlaceLikeType = {
    id: string | null;
    name: string;
    kjvName: string | null;
    title: string;
    coordinates: unknown;
};

/** The places nearest one, nearest first, with how far and which way. */
export function listNearbyPlaces(
    place: PlaceLikeType,
    placeList: readonly PlaceLikeType[],
) {
    if (!checkIsCoordinates(place.coordinates)) {
        return [];
    }
    const nearList: (LookupRecordBriefType & PlaceDistanceType)[] = [];
    for (const other of placeList) {
        if (other.id === place.id || other.id === null) {
            continue;
        }
        const distance = toPlaceDistance(place.coordinates, other.coordinates);
        const brief = toRecordBrief(other);
        if (
            distance === null ||
            brief === null ||
            distance.km > MAX_NEARBY_KM
        ) {
            continue;
        }
        nearList.push({ ...brief, ...distance });
    }
    return nearList
        .sort((a, b) => {
            return a.km - b.km;
        })
        .slice(0, MAX_NEARBY_PLACES);
}

// The people named for a place: enough to answer "who lived there?",
// counted past it (`peopleCount`), never dropped in silence.
export const MAX_PLACE_PEOPLE = 40;

type PersonLikeType = {
    id: string | null;
    name: string;
    kjvName: string | null;
    title: string;
    locations: string[];
    verses: string[];
};

/**
 * The people the lookup ties to a place -- every person whose record lists
 * it -- each once by the record that is that person, the most written about
 * first. _Who was born or lived in Bethlehem?_ had been answered with the
 * three a place's own words name; twenty-three people list it (2026-10-22).
 */
export function listPlacePeople(
    place: { id: string | null; name: string },
    personList: readonly PersonLikeType[],
    toMainNameId: (id: string) => string = (id) => id,
) {
    const byMainId = new Map<string, PersonLikeType>();
    for (const person of personList) {
        if (
            person.id === null ||
            !(person.locations ?? []).some((one) => {
                return one === place.id || one === place.name;
            })
        ) {
            continue;
        }
        const mainId = toMainNameId(person.id);
        const known = byMainId.get(mainId);
        // The main record names the person, whichever form listed the place.
        if (known === undefined || person.id === mainId) {
            byMainId.set(mainId, person);
        }
    }
    const ranked = Array.from(byMainId.values()).sort((a, b) => {
        return (
            (b.verses?.length ?? 0) - (a.verses?.length ?? 0) ||
            a.name.localeCompare(b.name)
        );
    });
    return {
        people: ranked.slice(0, MAX_PLACE_PEOPLE).flatMap((person) => {
            const brief = toRecordBrief(person);
            return brief === null ? [] : [brief];
        }),
        peopleCount: ranked.length,
    };
}

// The other records of the same name a person or place has: a handful.
export const MAX_SAME_NAME = 8;

/**
 * The other people (or places) of a record's name, each with the line that
 * tells them apart -- always, not only when the record was asked for by
 * name. Opened from a panel by its id, Noah's record had said nothing of
 * the daughter of Zelophehad, and _is anyone else in the Bible called
 * Noah?_ was answered "no" (2026-10-22). The record's own other names are
 * not others.
 */
export function listSameNameRecords(
    candidateList: readonly {
        id: string | null;
        name: string;
        kjvName: string | null;
        title: string;
    }[],
    selfIdSet: ReadonlySet<string>,
) {
    const seen = new Set<string>();
    const list: LookupRecordBriefType[] = [];
    for (const candidate of candidateList) {
        if (
            candidate.id === null ||
            selfIdSet.has(candidate.id) ||
            seen.has(candidate.id)
        ) {
            continue;
        }
        seen.add(candidate.id);
        const brief = toRecordBrief(candidate);
        if (brief !== null) {
            list.push(brief);
        }
    }
    return list.slice(0, MAX_SAME_NAME);
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
    extra: NameRecordExtraType | null = null,
) {
    const kjvName = toKjvName(record);
    // The record and its other names are one person: never their own
    // parent, child or brother.
    const selfIdSet = new Set<string>(
        [record.id, ...(extra?.otherForms ?? []).map((one) => one.id)].filter(
            (id): id is string => {
                return typeof id === 'string';
            },
        ),
    );
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
            ['parents', toPeopleList(record.parents, resolver, selfIdSet)],
            ['spouses', toPeopleList(record.spouses, resolver, selfIdSet)],
            ['children', toPeopleList(record.children, resolver, selfIdSet)],
            ['siblings', toPeopleList(record.siblings, resolver, selfIdSet)],
            ['cousins', toPeopleList(record.cousin, resolver, selfIdSet)],
            // The same person under another name, with the verses that
            // use it: Noe in Matthew 24 and Luke 17 is Noah.
            ['otherForms', extra?.otherForms ?? []],
            ['sameName', extra?.sameName ?? []],
            ['links', toLinkList(record)],
        ]),
        ...withVerses(extra?.verses ?? record.verses, quoted),
    };
}

export function toLocationRecordResult(
    record: LookupLocationRecordType,
    resolver: LookupRecordResolverType,
    quoted: QuotedVerseType[],
    extra: LocationRecordExtraType | null = null,
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
        ...(extra?.fromJerusalem ? { fromJerusalem: extra.fromJerusalem } : {}),
        ...withLists([
            [
                'relatedPlaces',
                toNamedList(record.relatedLocations, resolver.findLocation),
            ],
            ['nearby', extra?.nearby ?? []],
            ['people', extra?.people ?? []],
            ['sameName', extra?.sameName ?? []],
            ['links', toLinkList(record)],
        ]),
        ...((extra?.peopleCount ?? 0) > (extra?.people.length ?? 0)
            ? { peopleCount: extra?.peopleCount }
            : {}),
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
