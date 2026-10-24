import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    shortToVerseTitle: vi.fn(
        async (key: string, verse: string) => `${key}:${verse}`,
    ),
}));

vi.mock('../location-name-lookup/bibleVerseHelpers', () => ({
    getLookupVerseBibleKey: () => 'KJV',
    shortToVerseTitle: fixture.shortToVerseTitle,
}));
vi.mock('../location-name-lookup/lookupPresentationHelpers', () => ({
    getNameTypeIconClass: (type: string) => `${type}-icon`,
    getNameTypeSingularLabel: (type: string) => `A ${type}`,
    getPlainReferenceText: (text: string) => text,
    getRecordKjvName: (record: { name: string }) => `${record.name} KJV`,
    LOCATION_ICON_CLASS: 'location-icon',
}));
vi.mock('../location-name-lookup/lookupRecordHelpers', () => ({
    resolveLocationReference: (
        manager: {
            getRecordById: (id: string) => unknown;
            getByName: (name: string) => unknown;
        },
        entry: string,
    ) => manager.getRecordById(entry) ?? manager.getByName(entry),
}));

import type { LookupManagersType } from '../location-name-lookup/lookupDataHelpers';
import {
    buildUndirectedNameAdjacency,
    findNamesMentioningLocation,
    getPairRelation,
    getPathHopList,
    lookupGraphSource,
    toLocationTypeKey,
} from './lookupGraphSource';

function nameRecord(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        name: id.toUpperCase(),
        type: 'person',
        gender: 'unknown',
        title: 'GEN 1:1',
        verses: ['GEN 1:1'],
        parents: [],
        children: [],
        spouses: [],
        siblings: [],
        cousin: [],
        locations: [],
        ...overrides,
    };
}

function locationRecord(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        name: id.toUpperCase(),
        type: 'city',
        title: 'GEN 1:1',
        verses: ['GEN 1:1'],
        relatedLocations: [],
        ...overrides,
    };
}

function makeManagers() {
    const names = [
        nameRecord('abraham', {
            name: 'Abraham',
            gender: 'male',
            children: ['isaac'],
            spouses: ['sarah'],
            locations: ['jerusalem', 'Jerusalem', 'missing'],
        }),
        nameRecord('isaac', {
            name: 'Isaac',
            parents: [],
            locations: ['jerusalem'],
        }),
        nameRecord('sarah', {
            name: 'Sarah',
            gender: 'female',
            spouses: ['abraham'],
        }),
    ];
    const locations = [
        locationRecord('jerusalem', {
            name: 'Jerusalem',
            relatedLocations: ['bethel', 'missing'],
        }),
        locationRecord('bethel', { name: 'Bethel', type: 'region' }),
    ];
    const namesLookupManager = {
        getAllRecords: vi.fn(() => names),
        getRecordById: (id: string) =>
            names.find((record) => record.id === id) ?? null,
        getRecordsByIds: (ids: string[]) =>
            names.filter((record) => ids.includes(record.id)),
        searchNames: (query: string, { limit }: { limit: number }) =>
            names
                .filter((record) =>
                    record.name.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, limit),
    };
    const locationsLookupManager = {
        getRecordById: (id: string) =>
            locations.find((record) => record.id === id) ?? null,
        getByName: (name: string) =>
            locations.find((record) => record.name === name) ?? null,
    };
    const managers = {
        namesLookupManager,
        locationsLookupManager,
    } as unknown as LookupManagersType;
    return { managers, names, locations, namesLookupManager };
}

const nameRef = (recordId: string) => ({
    kind: 'name' as const,
    recordId,
    name: recordId,
});
const locationRef = (recordId: string) => ({
    kind: 'location' as const,
    recordId,
    name: recordId,
});

describe('lookup graph source', () => {
    it('finds direct and legacy-name location mentions once per name', () => {
        const { managers } = makeManagers();
        expect(
            findNamesMentioningLocation(managers, 'jerusalem').map(
                (record) => record.id,
            ),
        ).toEqual(['abraham', 'isaac']);
        expect(findNamesMentioningLocation(managers, 'bethel')).toEqual([]);
    });

    it('lists resolvable name and location relations without dead-end records', () => {
        const { managers } = makeManagers();
        expect(
            lookupGraphSource.getNeighbours(managers, nameRef('abraham')),
        ).toMatchObject([
            { kind: 'name', recordId: 'sarah', relation: 'spouse' },
            { kind: 'name', recordId: 'isaac', relation: 'child' },
            { kind: 'location', recordId: 'jerusalem', relation: 'location' },
            { kind: 'location', recordId: 'jerusalem', relation: 'location' },
        ]);
        expect(
            lookupGraphSource.getNeighbours(managers, locationRef('jerusalem')),
        ).toMatchObject([
            {
                kind: 'location',
                recordId: 'bethel',
                relation: 'related-location',
            },
            { kind: 'name', recordId: 'abraham', relation: 'mentioned-by' },
            { kind: 'name', recordId: 'isaac', relation: 'mentioned-by' },
        ]);
        expect(
            lookupGraphSource.getNeighbours(managers, nameRef('missing')),
        ).toEqual([]);
    });

    it('counts location mentions once per name and reuses the one-pass count map', () => {
        const { managers, namesLookupManager } = makeManagers();
        expect(
            lookupGraphSource.countNeighbours(
                managers,
                locationRef('jerusalem'),
            ),
        ).toBe(3);
        expect(
            lookupGraphSource.countNeighbours(
                managers,
                locationRef('jerusalem'),
            ),
        ).toBe(3);
        expect(namesLookupManager.getAllRecords).toHaveBeenCalledTimes(1);
        expect(
            lookupGraphSource.countNeighbours(managers, nameRef('abraham')),
        ).toBe(4);
        expect(
            lookupGraphSource.countNeighbours(managers, locationRef('missing')),
        ).toBe(0);
    });

    it('builds undirected name paths even when only one record lists the relation', () => {
        const { managers, namesLookupManager } = makeManagers();
        const adjacency = buildUndirectedNameAdjacency(
            managers.namesLookupManager,
        );
        expect(adjacency.get('abraham')).toEqual(new Set(['isaac', 'sarah']));
        expect(adjacency.get('isaac')).toEqual(new Set(['abraham']));
        expect(namesLookupManager.getAllRecords).toHaveBeenCalledTimes(1);
        expect(
            lookupGraphSource.findPath!(managers, 'isaac', 'sarah'),
        ).toMatchObject([
            { recordId: 'isaac' },
            { recordId: 'abraham' },
            { recordId: 'sarah' },
        ]);
        expect(
            lookupGraphSource.findPath!(managers, 'isaac', 'missing'),
        ).toBeNull();
    });

    it('labels forward and reverse family relationships consistently', () => {
        const parent = nameRecord('parent', { children: ['child'] });
        const child = nameRecord('child');
        expect(getPairRelation(parent as never, child as never)).toBe('child');
        expect(getPairRelation(child as never, parent as never)).toBe('parent');
        expect(
            getPairRelation(parent as never, nameRecord('other') as never),
        ).toBeNull();
        const { managers } = makeManagers();
        expect(
            getPathHopList(managers, [
                nameRef('isaac'),
                nameRef('abraham'),
                nameRef('sarah'),
            ]),
        ).toEqual([
            { relation: 'child', isReversed: true },
            { relation: 'spouse', isReversed: false },
        ]);
        expect(
            getPathHopList(managers, [nameRef('missing'), nameRef('abraham')]),
        ).toEqual([{ relation: '', isReversed: false }]);
    });

    it('provides presentation details, labels and name-only search results', async () => {
        const { managers } = makeManagers();
        expect(
            lookupGraphSource.getNodeView(managers, nameRef('sarah')),
        ).toMatchObject({
            name: 'Sarah',
            caption: 'A person',
            iconClass: 'person-icon',
            labelHint: 'female',
        });
        expect(
            lookupGraphSource.getNodeView(managers, locationRef('bethel')),
        ).toMatchObject({
            name: 'Bethel',
            caption: 'region',
            iconClass: 'location-icon',
            typeKey: 'region',
        });
        expect(
            lookupGraphSource.getNodeView(managers, locationRef('missing')),
        ).toBeNull();
        expect(lookupGraphSource.searchNodes!(managers, 'a', 1)).toMatchObject([
            { recordId: 'abraham' },
        ]);
        expect(
            lookupGraphSource.getRelationLabel('child', {
                labelHint: ' FEMALE ',
            } as never),
        ).toBe('daughter');
        expect(
            lookupGraphSource.getRelationLabel('spouse', {
                labelHint: 'unknown',
            } as never),
        ).toBe('spouse');
        expect(lookupGraphSource.getRelationLabel('parent', null)).toBe('');
        expect(
            await lookupGraphSource.resolveVerseTitle!(managers, 'GEN 1:1'),
        ).toBe('KJV:GEN 1:1');
        expect(
            lookupGraphSource.getPathBlockedReason!(locationRef('jerusalem')),
        ).toContain('cannot');
        expect(
            lookupGraphSource.getPathBlockedReason!(nameRef('abraham')),
        ).toBe('');
    });

    it('buckets free-form location types into palette families', () => {
        expect(toLocationTypeKey(' CITY ')).toBe('settlement');
        expect(toLocationTypeKey('province')).toBe('region');
        expect(toLocationTypeKey('valley')).toBe('terrain');
        expect(toLocationTypeKey('spring')).toBe('water');
        expect(toLocationTypeKey('temple')).toBe('structure');
        expect(toLocationTypeKey('unknown')).toBe('place');
    });
});
