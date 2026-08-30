import type {
    MentionLocationMatch,
    MentionNameMatch,
    NamesLookupManager,
} from 'bible-note';

import {
    getLookupVerseBibleKey,
    shortToVerseTitle,
} from '../location-name-lookup/bibleVerseHelpers';
import type { LookupManagersType } from '../location-name-lookup/lookupDataHelpers';
import {
    getNameTypeIconClass,
    getNameTypeSingularLabel,
    getPlainReferenceText,
    getRecordKjvName,
    LOCATION_ICON_CLASS,
} from '../location-name-lookup/lookupPresentationHelpers';
import { resolveLocationReference } from '../location-name-lookup/lookupRecordHelpers';
import type {
    GraphAdjacencyType,
    GraphNeighbourType,
    GraphNodeRefType,
    GraphNodeViewType,
    GraphPathHopType,
    GraphRelationDefType,
    GraphRelationKindType,
    GraphSourceType,
} from './core';
import { findShortestPath, linkAdjacency } from './core';

/**
 * The lookup dataset as a graph source.
 *
 * `bible-note` is imported TYPE-ONLY here. A value import would put its ~46MB
 * graph into whatever chunk reaches this module, which is the same reason
 * `lookupPresentationHelpers` reimplements two of its helpers rather than
 * importing them.
 */

export const LOOKUP_GRAPH_SOURCE_ID = 'location-name';

export const LOOKUP_NODE_KIND = {
    NAME: 'name',
    LOCATION: 'location',
} as const;

/**
 * The relations the lookup dataset carries.
 *
 * `parent` and `child` share the canonical kind `child`, so the same line
 * discovered from either end is one edge, stored pointing parent -> child.
 * `location` and `mentioned-by` likewise share `location`. `sibling`, `spouse`
 * and `cousin` keep their own kinds, which is what lets Abraham and Sarah
 * carry both a sibling line and a spouse line.
 */
export const LOOKUP_RELATION_DEF_LIST: readonly GraphRelationDefType[] = [
    {
        kind: 'parent',
        canonicalKind: 'child',
        canonicalFrom: 'target',
        isDirected: true,
        label: 'Parents',
        styleKey: 'parentage',
    },
    {
        kind: 'spouse',
        canonicalKind: 'spouse',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Spouses',
        styleKey: 'spouse',
    },
    {
        kind: 'sibling',
        canonicalKind: 'sibling',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Siblings',
        styleKey: 'sibling',
    },
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin',
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
    {
        kind: 'cousin',
        canonicalKind: 'cousin',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Cousins',
        styleKey: 'cousin',
    },
    {
        kind: 'location',
        canonicalKind: 'location',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Locations',
        styleKey: 'placement',
    },
    {
        kind: 'related-location',
        canonicalKind: 'related-location',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Related locations',
        styleKey: 'placement',
    },
    {
        kind: 'mentioned-by',
        canonicalKind: 'location',
        canonicalFrom: 'target',
        isDirected: false,
        label: 'Mentioned by',
        styleKey: 'placement',
    },
];

/**
 * Name-to-name relations only.
 *
 * Path search is restricted to these on purpose: a shared location is a hub
 * that links almost anyone to anyone in two hops, so allowing places as
 * stepping stones would return a technically-connected chain that tells the
 * reader nothing.
 */
const NAME_RELATION_FIELD_LIST = [
    'parents',
    'children',
    'spouses',
    'siblings',
    // Singular in the dataset. Reading `cousins` here silently drops 22 of
    // Jacob's relations and every other cousin link in the corpus.
    'cousin',
] as const;

/**
 * How a related record is named FROM the point of view of the record it hangs
 * off: an edge pointing at Joseph as a child reads `son`, one pointing at Leah
 * as a spouse reads `wife`.
 *
 * The datasets keep `gender` in English in EVERY language — `"gender": "male"`
 * sits beside a Khmer name — exactly like `type`, so what arrives is a KEY,
 * not text to show. Bare English literals for the same reason `NAME_TYPE_LABEL`
 * is: a `tran` at module scope runs before the language data is ready.
 */
const RELATION_GENDER_LABEL: {
    [kind: string]: { male: string; female: string; neutral: string };
} = {
    child: { male: 'son', female: 'daughter', neutral: 'child' },
    spouse: { male: 'husband', female: 'wife', neutral: 'spouse' },
    sibling: { male: 'brother', female: 'sister', neutral: 'sibling' },
    cousin: { male: 'cousin', female: 'cousin', neutral: 'cousin' },
    location: {
        male: 'located at',
        female: 'located at',
        neutral: 'located at',
    },
    'related-location': {
        male: 'related location',
        female: 'related location',
        neutral: 'related location',
    },
};

/**
 * Folds `unknown` into the neutral column rather than trusting it as a value —
 * it is what the datasets write for "not recorded", which is the same call
 * `checkHasDetailValue` already makes for every other lookup surface.
 */
function toGenderColumn(gender: string): 'male' | 'female' | 'neutral' {
    const normalized = gender.trim().toLowerCase();
    if (normalized === 'male' || normalized === 'female') {
        return normalized;
    }
    return 'neutral';
}

function toNameNeighbour(
    record: Readonly<MentionNameMatch>,
    relation: GraphRelationKindType,
): GraphNeighbourType {
    return {
        kind: LOOKUP_NODE_KIND.NAME,
        recordId: record.id,
        name: record.name,
        relation,
    };
}

function toLocationNeighbour(
    record: Readonly<MentionLocationMatch>,
    relation: GraphRelationKindType,
): GraphNeighbourType {
    return {
        kind: LOOKUP_NODE_KIND.LOCATION,
        recordId: record.id,
        name: record.name,
        relation,
    };
}

/**
 * The names that list a location, found by scanning rather than by lookup.
 *
 * The dataset carries no location-to-name array, so this is the only way a
 * location box can lead anywhere but to other locations. It is a single pass
 * over ~2,558 records, run ONLY when a location is expanded, and it retains
 * nothing: `getAllRecords()` and the result are locals, and only `id`/`name`
 * are copied out before they go out of scope.
 *
 * `getAllRecords()` may hand back the manager's own internal array — it is
 * iterated read-only and never sorted or spliced.
 */
export function findNamesMentioningLocation(
    managers: LookupManagersType,
    locationId: string,
): MentionNameMatch[] {
    const { namesLookupManager, locationsLookupManager } = managers;
    const resultList: MentionNameMatch[] = [];
    for (const record of namesLookupManager.getAllRecords()) {
        for (const entry of record.locations) {
            // Fast path first: the overwhelmingly common id form costs one
            // string compare, and only a legacy plain-name entry pays for a
            // resolve.
            if (entry === locationId) {
                resultList.push(record);
                break;
            }
            const resolved = resolveLocationReference(
                locationsLookupManager,
                entry,
            );
            if (resolved !== null && resolved.id === locationId) {
                resultList.push(record);
                break;
            }
        }
    }
    return resultList;
}

function getNameNeighbours(
    managers: LookupManagersType,
    record: Readonly<MentionNameMatch>,
): GraphNeighbourType[] {
    const { namesLookupManager, locationsLookupManager } = managers;
    const resultList: GraphNeighbourType[] = [];
    const fieldRelationList: [readonly string[], GraphRelationKindType][] = [
        [record.parents, 'parent'],
        [record.spouses, 'spouse'],
        [record.siblings, 'sibling'],
        [record.children, 'child'],
        [record.cousin, 'cousin'],
    ];
    for (const [idList, relation] of fieldRelationList) {
        for (const related of namesLookupManager.getRecordsByIds(idList)) {
            resultList.push(toNameNeighbour(related, relation));
        }
    }
    for (const entry of record.locations) {
        // Location references are stored as ids, but older records carry the
        // plain name instead, and a name only resolves when unambiguous. An
        // entry that resolves to nothing is DROPPED: a detail panel can show
        // the raw string as text, but a box with no record behind it is a dead
        // end the user cannot do anything with.
        const location = resolveLocationReference(
            locationsLookupManager,
            entry,
        );
        if (location !== null) {
            resultList.push(toLocationNeighbour(location, 'location'));
        }
    }
    return resultList;
}

function getLocationNeighbours(
    managers: LookupManagersType,
    record: Readonly<MentionLocationMatch>,
): GraphNeighbourType[] {
    const { locationsLookupManager } = managers;
    const resultList: GraphNeighbourType[] = [];
    for (const entry of record.relatedLocations) {
        const location = resolveLocationReference(
            locationsLookupManager,
            entry,
        );
        if (location !== null) {
            resultList.push(toLocationNeighbour(location, 'related-location'));
        }
    }
    for (const nameRecord of findNamesMentioningLocation(managers, record.id)) {
        resultList.push(toNameNeighbour(nameRecord, 'mentioned-by'));
    }
    return resultList;
}

/**
 * The undirected name-to-name adjacency the path search walks.
 *
 * Built undirected by construction because the stored arrays are NOT reliably
 * symmetric — a record may list another under `children` while that record's
 * `parents` is empty — so trusting only what is written would miss real
 * connections in one direction.
 *
 * Ids the dataset references but never defines are filtered out here, so the
 * search itself never has to guard.
 *
 * Deliberately NOT cached. The build is a few tens of milliseconds, searches
 * are user-initiated at human speed so there is no burst to amortize, and
 * anything retained would sit OUTSIDE the reference count in
 * `lookupDataHelpers` — surviving after the last consumer unmounted, which is
 * exactly the shape that refcount exists to prevent.
 */
export function buildUndirectedNameAdjacency(
    namesLookupManager: NamesLookupManager,
): GraphAdjacencyType {
    const adjacency: GraphAdjacencyType = new Map();
    const recordList = namesLookupManager.getAllRecords();
    for (const record of recordList) {
        if (!adjacency.has(record.id)) {
            adjacency.set(record.id, new Set());
        }
        for (const field of NAME_RELATION_FIELD_LIST) {
            for (const otherId of record[field]) {
                if (namesLookupManager.getRecordById(otherId) === null) {
                    continue;
                }
                linkAdjacency(adjacency, record.id, otherId);
            }
        }
    }
    return adjacency;
}

/**
 * How two name records are related, from the first one's point of view.
 *
 * Checked in a fixed order so a pair related in more than one way always
 * reports the same relation, and the reverse direction is checked with the
 * sense inverted — a record listing the other under `parents` means the other
 * sees it as a `child`.
 */
export function getPairRelation(
    fromRecord: Readonly<MentionNameMatch>,
    toRecord: Readonly<MentionNameMatch>,
): GraphRelationKindType | null {
    const forwardList: [readonly string[], GraphRelationKindType][] = [
        [fromRecord.parents, 'parent'],
        [fromRecord.children, 'child'],
        [fromRecord.spouses, 'spouse'],
        [fromRecord.siblings, 'sibling'],
        [fromRecord.cousin, 'cousin'],
    ];
    for (const [idList, relation] of forwardList) {
        if (idList.includes(toRecord.id)) {
            return relation;
        }
    }
    const reverseList: [readonly string[], GraphRelationKindType][] = [
        [toRecord.parents, 'child'],
        [toRecord.children, 'parent'],
        [toRecord.spouses, 'spouse'],
        [toRecord.siblings, 'sibling'],
        [toRecord.cousin, 'cousin'],
    ];
    for (const [idList, relation] of reverseList) {
        if (idList.includes(fromRecord.id)) {
            return relation;
        }
    }
    return null;
}

function getNameView(record: Readonly<MentionNameMatch>): GraphNodeViewType {
    return {
        name: record.name,
        kjvName: getRecordKjvName(record),
        title: getPlainReferenceText(record.title),
        caption: getNameTypeSingularLabel(record.type),
        iconClass: getNameTypeIconClass(record.type),
        typeKey: (record.type || 'person').trim().toLowerCase(),
        verseList: record.verses,
        labelHint: record.gender ?? '',
    };
}

function getLocationView(
    record: Readonly<MentionLocationMatch>,
): GraphNodeViewType {
    return {
        name: record.name,
        kjvName: getRecordKjvName(record),
        title: getPlainReferenceText(record.title),
        // A location's type is open-ended prose in the data, so it is shown as
        // written rather than looked up in a nine-way label map.
        caption: record.type,
        iconClass: LOCATION_ICON_CLASS,
        typeKey: toLocationTypeKey(record.type),
        verseList: record.verses,
        labelHint: '',
    };
}

/**
 * Buckets a location's free-form `type` into the handful of families the
 * palette can actually distinguish.
 *
 * The dataset holds 31 distinct values (city 325, settlement 230, region 112,
 * place 107, mountain 52 ... down to `street` and `tower` at one each), which
 * is far more than a small panel can carry as separate hues. Unrecognized
 * values fall back to `place`, the same neutral-default approach
 * `normalizeMentionNameType` takes.
 */
export function toLocationTypeKey(type: string) {
    const normalized = (type || '').trim().toLowerCase();
    if (
        ['city', 'settlement', 'town', 'village', 'encampment'].includes(
            normalized,
        )
    ) {
        return 'settlement';
    }
    if (['region', 'territory', 'country', 'province'].includes(normalized)) {
        return 'region';
    }
    if (
        [
            'mountain',
            'hill',
            'valley',
            'wilderness',
            'desert',
            'plain',
        ].includes(normalized)
    ) {
        return 'terrain';
    }
    if (
        ['river', 'sea', 'lake', 'well', 'spring', 'brook', 'island'].includes(
            normalized,
        )
    ) {
        return 'water';
    }
    if (
        ['gate', 'tower', 'road', 'street', 'building', 'temple'].includes(
            normalized,
        )
    ) {
        return 'structure';
    }
    return 'place';
}

export const lookupGraphSource: GraphSourceType<LookupManagersType> = {
    id: LOOKUP_GRAPH_SOURCE_ID,
    relationDefList: LOOKUP_RELATION_DEF_LIST,

    getNodeView(managers, node) {
        if (node.kind === LOOKUP_NODE_KIND.LOCATION) {
            const record = managers.locationsLookupManager.getRecordById(
                node.recordId,
            );
            return record === null ? null : getLocationView(record);
        }
        const record = managers.namesLookupManager.getRecordById(node.recordId);
        return record === null ? null : getNameView(record);
    },

    getNeighbours(managers, node) {
        if (node.kind === LOOKUP_NODE_KIND.LOCATION) {
            const record = managers.locationsLookupManager.getRecordById(
                node.recordId,
            );
            return record === null
                ? []
                : getLocationNeighbours(managers, record);
        }
        const record = managers.namesLookupManager.getRecordById(node.recordId);
        return record === null ? [] : getNameNeighbours(managers, record);
    },

    countNeighbours(managers, node) {
        return this.getNeighbours(managers, node).length;
    },

    getRelationLabel(relation, targetView) {
        const labelSet = RELATION_GENDER_LABEL[relation];
        if (labelSet === undefined) {
            // "Empty stays empty", the same contract as
            // `getNameTypeSingularLabel`: an unlabelled edge beats a guessed
            // label.
            return '';
        }
        return labelSet[toGenderColumn(targetView?.labelHint ?? '')];
    },

    searchNodes(managers, query, limit) {
        // Names only. A location can never be a path endpoint, so offering one
        // here would only let the user build a search that cannot run.
        return managers.namesLookupManager
            .searchNames(query, { limit })
            .map((record) => {
                return {
                    kind: LOOKUP_NODE_KIND.NAME,
                    recordId: record.id,
                    name: record.name,
                };
            });
    },

    findPath(managers, fromId, toId) {
        const { namesLookupManager } = managers;
        const adjacency = buildUndirectedNameAdjacency(namesLookupManager);
        const idList = findShortestPath(adjacency, fromId, toId);
        if (idList === null) {
            return null;
        }
        return idList.map((id) => {
            const record = namesLookupManager.getRecordById(id);
            return {
                kind: LOOKUP_NODE_KIND.NAME,
                recordId: id,
                name: record?.name ?? id,
            };
        });
        // `adjacency` goes out of scope here and is collected: see
        // `buildUndirectedNameAdjacency` for why it is deliberately not kept.
    },

    getPathHopList(managers, refList) {
        return getPathHopList(managers, refList);
    },

    /**
     * `GEN 30:42` -> `លោកុប្បត្តិ ៣០:៤២`.
     *
     * The record stores canonical keys; what a reference is CALLED belongs to
     * the bible the reader is showing, which is why the lookup managers passed
     * in here are not what answers this. One bible read per reference, so the
     * caller must ask only for the ones it is about to show.
     */
    async resolveVerseTitle(_managers, verse) {
        return await shortToVerseTitle(getLookupVerseBibleKey(), verse);
    },

    getPathBlockedReason(root) {
        return root.kind === LOOKUP_NODE_KIND.LOCATION
            ? 'A location cannot be a path endpoint'
            : '';
    },
};

/**
 * The relation of each hop along a found path, so the chain can label itself
 * with the same vocabulary an ordinary expansion uses.
 *
 * Derived after the search rather than carried through it: storing a relation
 * per adjacency entry would double the weight of a structure that exists for
 * one query and is thrown away.
 */
export function getPathHopList(
    managers: LookupManagersType,
    refList: readonly GraphNodeRefType[],
): GraphPathHopType[] {
    const { namesLookupManager } = managers;
    const resultList: GraphPathHopType[] = [];
    for (let index = 0; index + 1 < refList.length; index++) {
        const fromRecord = namesLookupManager.getRecordById(
            refList[index].recordId,
        );
        const toRecord = namesLookupManager.getRecordById(
            refList[index + 1].recordId,
        );
        if (fromRecord === null || toRecord === null) {
            resultList.push({ relation: '', isReversed: false });
            continue;
        }
        const relation = getPairRelation(fromRecord, toRecord);
        // The canonical kind is what an edge stores, so a hop found as
        // `parent` becomes the same `child` edge an expansion would have made
        // — pointing back down the chain, which is what `isReversed` records.
        const definition = LOOKUP_RELATION_DEF_LIST.find((item) => {
            return item.kind === relation;
        });
        resultList.push({
            relation: definition?.canonicalKind ?? '',
            isReversed: definition?.canonicalFrom === 'target',
        });
    }
    return resultList;
}
