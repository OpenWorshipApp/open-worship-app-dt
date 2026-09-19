import { describe, expect, test, vi } from 'vitest';

// `tran` is the only thing this module pulls from the lang layer, and importing
// the real one drags the whole locale/bible-bundle graph into a node test.
// English is the identity translation, which is what the assertions read as.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import {
    buildLocationSummary,
    buildNameSummary,
    checkHasDetailValue,
    escapeHtml,
    getDisplayLinks,
    getFormattedDetailValue,
    getFormattedLinkType,
    getFormattedYearRange,
    getTrimmedString,
    resolveLocationReference,
} from './lookupRecordHelpers';

function genNameRecord(overrides: Record<string, any> = {}): any {
    return {
        id: 'n-1',
        name: 'Moses',
        oldName: null,
        title: 'Leader of Israel',
        description: '',
        gender: 'male',
        age: '120',
        years: [],
        locations: [],
        spouses: [],
        children: [],
        parents: [],
        siblings: [],
        cousin: [],
        type: 'person',
        verses: [],
        links: [],
        wikipedia: null,
        matterRange: 0,
        ...overrides,
    };
}

function genLocationRecord(overrides: Record<string, any> = {}): any {
    return {
        id: 'l-1',
        name: 'Egypt',
        oldName: null,
        title: 'A land',
        description: '',
        type: 'region',
        relatedLocations: [],
        modernIdentification: null,
        coordinates: null,
        verses: [],
        links: [],
        wikipedia: null,
        uncertainty: false,
        matterRange: 0,
        ...overrides,
    };
}

function genManagers(
    names: Record<string, any> = {},
    locations: Record<string, any> = {},
) {
    return {
        namesLookupManager: {
            getRecordById: (id: string) => names[id] ?? null,
        } as any,
        locationsLookupManager: {
            getRecordById: (id: string) => locations[id] ?? null,
            getRecordsByName: (name: string) => {
                return Object.values(locations).filter((record: any) => {
                    return record.name === name;
                });
            },
        } as any,
    };
}

describe('detail values', () => {
    test('trims, and treats a missing value as empty', () => {
        expect(getTrimmedString('  a  ')).toBe('a');
        expect(getTrimmedString(null)).toBe('');
        expect(getTrimmedString(undefined)).toBe('');
    });

    // The dataset writes a literal "unknown" where it has nothing. Rendering
    // that verbatim reads as a fact rather than as an absence.
    test('a literal "unknown" counts as no value', () => {
        expect(checkHasDetailValue('unknown')).toBe(false);
        expect(checkHasDetailValue(' UNKNOWN ')).toBe(false);
        expect(checkHasDetailValue('')).toBe(false);
        expect(checkHasDetailValue(null)).toBe(false);
        expect(checkHasDetailValue('male')).toBe(true);
    });

    test('formats "unknown" through `tran` so it can be localized', () => {
        expect(getFormattedDetailValue('UNKNOWN')).toBe('Unknown');
        expect(getFormattedDetailValue('  male ')).toBe('male');
        expect(getFormattedDetailValue(null)).toBe('');
    });

    test('a year range reads as a range, not as a sentence', () => {
        expect(
            getFormattedYearRange({ type: 'born', start: 1, end: 2 } as any),
        ).toBe('born: 1 – 2');
    });

    test('capitalizes a link type without touching the rest', () => {
        expect(getFormattedLinkType('wikipedia')).toBe('Wikipedia');
        expect(getFormattedLinkType('')).toBe('');
    });
});

describe('the link list', () => {
    test('appends the wikipedia entry a record does not already carry', () => {
        expect(
            getDisplayLinks({
                links: [{ type: 'other', url: 'https://a' }],
                wikipedia: 'https://wiki',
            }),
        ).toEqual([
            { type: 'other', url: 'https://a' },
            { type: 'wikipedia', url: 'https://wiki' },
        ]);
    });

    test('does not show the same url twice', () => {
        expect(
            getDisplayLinks({
                links: [{ type: 'wikipedia', url: 'https://wiki' }],
                wikipedia: 'https://wiki',
            }),
        ).toEqual([{ type: 'wikipedia', url: 'https://wiki' }]);
    });

    test('a record with no wikipedia page keeps just its own links', () => {
        expect(getDisplayLinks({ links: [], wikipedia: null })).toEqual([]);
    });
});

describe('resolving a location reference', () => {
    const egypt = genLocationRecord({ id: 'l-1', name: 'Egypt' });
    const ramahA = genLocationRecord({ id: 'l-2', name: 'Ramah' });
    const ramahB = genLocationRecord({ id: 'l-3', name: 'Ramah' });

    test('prefers an id', () => {
        const { locationsLookupManager } = genManagers(
            {},
            { 'l-1': egypt, 'l-2': ramahA },
        );
        expect(resolveLocationReference(locationsLookupManager, 'l-1')).toBe(
            egypt,
        );
    });

    // Older records store the plain name instead of an id.
    test('falls back to an unambiguous name', () => {
        const { locationsLookupManager } = genManagers({}, { 'l-1': egypt });
        expect(resolveLocationReference(locationsLookupManager, 'Egypt')).toBe(
            egypt,
        );
    });

    // Names are not unique in the dataset; guessing would send the reader to
    // the wrong place with no way to tell.
    test('refuses an ambiguous name', () => {
        const { locationsLookupManager } = genManagers(
            {},
            { 'l-2': ramahA, 'l-3': ramahB },
        );
        expect(
            resolveLocationReference(locationsLookupManager, 'Ramah'),
        ).toBeNull();
    });

    test('an unknown reference resolves to nothing', () => {
        const { locationsLookupManager } = genManagers({}, {});
        expect(
            resolveLocationReference(locationsLookupManager, 'nope'),
        ).toBeNull();
    });
});

describe('the clipboard summary', () => {
    test('escapes markup so a record name cannot inject HTML', () => {
        expect(escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
    });

    test('leads with the name and keeps both representations in step', () => {
        const managers = genManagers();
        const summary = buildNameSummary(managers, genNameRecord(), []);

        expect(summary.plainText.startsWith('Moses')).toBe(true);
        expect(summary.html).toContain('<strong>Moses</strong>');
    });

    // The panel is a bible study tool; the references are the point of it.
    test('includes the verses it is handed', () => {
        const managers = genManagers();
        const summary = buildNameSummary(
            managers,
            genNameRecord({ verses: ['EXO 6:23'] }),
            ['Exodus 6:23'],
        );

        expect(summary.plainText).toContain('Verses: Exodus 6:23');
    });

    // The regression this test exists for: the Verses section resolves its
    // titles lazily, so an unexpanded record used to hand `[]` down here and
    // the whole row was dropped without a word.
    test('drops the verses row only when there are genuinely none', () => {
        const managers = genManagers();
        const summary = buildNameSummary(managers, genNameRecord(), []);

        expect(summary.plainText).not.toContain('Verses');
    });

    test('resolves related ids to names, falling back to the raw id', () => {
        const aaron = genNameRecord({ id: 'n-2', name: 'Aaron' });
        const managers = genManagers({ 'n-2': aaron });
        const summary = buildNameSummary(
            managers,
            genNameRecord({ siblings: ['n-2', 'n-missing'] }),
            [],
        );

        expect(summary.plainText).toContain('Siblings: Aaron, n-missing');
    });

    // Titles and descriptions carry inline `[label](name-id://…)` tokens; the
    // raw markup has no business in a pasted summary.
    test('strips reference markup from the title and description', () => {
        const managers = genManagers();
        const summary = buildNameSummary(
            managers,
            genNameRecord({
                title: 'Brother of [Aaron](name-id://n-2)',
                description: 'Led [Israel](location-id://l-9) out',
            }),
            [],
        );

        expect(summary.plainText).toContain('Brother of Aaron');
        expect(summary.plainText).toContain('Led Israel out');
        expect(summary.plainText).not.toContain('name-id://');
    });

    test('omits the facts row when every fact is unknown', () => {
        const managers = genManagers();
        const summary = buildNameSummary(
            managers,
            genNameRecord({ type: 'unknown', gender: 'unknown', age: '' }),
            [],
        );

        expect(summary.plainText).not.toContain('unknown');
    });

    test('a location summary carries its coordinates', () => {
        const { locationsLookupManager } = genManagers();
        const summary = buildLocationSummary(
            locationsLookupManager,
            genLocationRecord({
                coordinates: { latitude: 30.1, longitude: 31.2 },
            }),
            [],
        );

        expect(summary.plainText).toContain('Coordinates: 30.1, 31.2');
    });

    test('a location summary omits an absent modern identification', () => {
        const { locationsLookupManager } = genManagers();
        const summary = buildLocationSummary(
            locationsLookupManager,
            genLocationRecord({ modernIdentification: 'unknown' }),
            [],
        );

        expect(summary.plainText).not.toContain('Modern identification');
    });
});
