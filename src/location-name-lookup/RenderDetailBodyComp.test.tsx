// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    nameRecord: null as any,
    locationRecord: null as any,
}));

// The lookup language is a made-up one (`xx`); the app interface stays
// English.
vi.mock('./lookupLangHelpers', () => ({
    useLookupLangPresentation: () => ({
        fontFamily: undefined,
        translate: (text: string) => `xx:${text}`,
    }),
}));
vi.mock('./lookupManagersContext', () => ({
    useLookupManagersContext: () => ({
        namesLookupManager: { getRecordById: () => h.nameRecord },
        locationsLookupManager: { getRecordById: () => h.locationRecord },
    }),
}));
vi.mock('./bibleVerseHelpers', () => ({
    shortToVerseData: vi.fn(),
    useLookupVerseBibleKey: () => 'KJV',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/LoadingComp', () => ({ default: () => null }));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (current: unknown) => ({ current }),
    useAppEffect: () => undefined,
    useAppStateAsync: () => [undefined],
}));
// The parts are rendered as plain markers: the subject here is WHAT the body
// hands them, not how they draw it.
vi.mock('./LookupDetailPartsComp', () => ({
    BasicInfoComp: ({ facts }: { facts: string[] }) => (
        <div className="facts">{facts.join('|')}</div>
    ),
    DetailsSectionComp: ({ children }: { children: unknown }) => (
        <div>{children as any}</div>
    ),
    DetailRowComp: () => null,
    OptionalTextRowComp: ({
        label,
        value,
    }: {
        label: string;
        value: string | null;
    }) => {
        const trimmedValue = (value ?? '').trim();
        return trimmedValue === '' ||
            trimmedValue.toLowerCase() === 'unknown' ? null : (
            <div className={`row ${label}`}>{value}</div>
        );
    },
    OptionalTextListRowComp: ({
        label,
        values,
    }: {
        label: string;
        values: string[];
    }) => <div className={`row ${label}`}>{values.join('|')}</div>,
    OptionalLocationListRowComp: () => null,
    OptionalNameListRowComp: () => null,
    OptionalVerseListRowComp: () => null,
    OptionalLinkRowComp: () => null,
    ReferenceTextComp: () => null,
}));
vi.mock('./lookupRecordHelpers', () => ({
    // As the real one: blank and `unknown` are no value.
    checkHasDetailValue: (value: string | null) => {
        const trimmedValue = (value ?? '').trim();
        return trimmedValue !== '' && trimmedValue.toLowerCase() !== 'unknown';
    },
    getDisplayLinks: () => [],
    // Shows which dictionary it was handed: the lookup language's, or not.
    getFormattedYearRange: (
        value: { type: string },
        translate: (text: string) => string,
    ) => translate(value.type),
}));

import {
    RenderLocationDetailComp,
    RenderNameDetailComp,
} from './RenderDetailBodyComp';

function render(element: React.ReactElement) {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(element);
    return {
        facts: host.querySelector('.facts')?.textContent ?? '',
        rowText: (label: string) =>
            host.querySelector(`.row.${label}`)?.textContent ?? null,
    };
}

function genNameRecord(overrides: object = {}) {
    return {
        title: '',
        description: '',
        type: 'person',
        gender: 'male',
        age: 'unknown',
        oldName: null,
        years: [],
        locations: [],
        parents: [],
        spouses: [],
        children: [],
        siblings: [],
        cousin: [],
        verses: [],
        ...overrides,
    };
}

describe('detail body facts follow the lookup language', () => {
    // Pilate under a non-English lookup read its word for a human beside an
    // English `Male`.
    test('a name record translates its gender with its type', () => {
        h.nameRecord = genNameRecord();
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('xx:Person|xx:Male');
        expect(rowText('Gender')).toBe('xx:Male');
    });

    test('an unknown gender grows neither a chip nor a row', () => {
        h.nameRecord = genNameRecord({ gender: 'unknown' });
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('xx:Person');
        expect(rowText('Gender')).toBeNull();
    });

    // Abraham under a non-English lookup read `175 years` beside its words
    // for human and male.
    test('a name record translates its age and its year ranges', () => {
        h.nameRecord = genNameRecord({
            age: '175 years',
            years: [{ type: 'reign', start: -1010, end: -970 }],
        });
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('xx:Person|xx:Male|xx:175 years');
        expect(rowText('Age')).toBe('xx:175 years');
        expect(rowText('Years')).toBe('xx:reign');
    });

    // Siloam under a non-English lookup read `Pool`.
    test('a location record translates its type', () => {
        h.locationRecord = {
            name: 'Siloam',
            title: '',
            description: '',
            type: 'pool',
            oldName: null,
            modernIdentification: null,
            relatedLocations: [],
            verses: [],
            coordinates: null,
        };
        const { facts, rowText } = render(
            <RenderLocationDetailComp
                recordId="x"
                onVersesResolved={() => {}}
            />,
        );
        expect(facts).toBe('xx:Pool');
        expect(rowText('Type')).toBe('xx:Pool');
    });
});

describe('detail bodies for a record that is gone or has a place on the map', () => {
    function renderHost(element: React.ReactElement) {
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(element);
        return host;
    }

    test('a record id that no longer resolves says so', () => {
        h.nameRecord = null;
        h.locationRecord = null;
        expect(
            renderHost(
                <RenderNameDetailComp
                    recordId="gone"
                    onVersesResolved={() => {}}
                />,
            ).textContent,
        ).toBe('Record not found');
        expect(
            renderHost(
                <RenderLocationDetailComp
                    recordId="gone"
                    onVersesResolved={() => {}}
                />,
            ).textContent,
        ).toBe('Record not found');
    });

    test('a place with coordinates gets a sandboxed lazy map and a link out', () => {
        h.locationRecord = {
            name: 'Jerusalem',
            title: '',
            description: '',
            type: 'city',
            oldName: null,
            modernIdentification: null,
            relatedLocations: [],
            verses: [],
            coordinates: { latitude: 31.77, longitude: 35.23 },
        };
        const host = renderHost(
            <RenderLocationDetailComp
                recordId="x"
                onVersesResolved={() => {}}
            />,
        );
        const frame = host.querySelector('iframe')!;
        expect(frame.getAttribute('title')).toBe('Jerusalem');
        expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
        expect(frame.getAttribute('loading')).toBe('lazy');
        expect(frame.getAttribute('referrerpolicy')).toBe(
            'strict-origin-when-cross-origin',
        );
        expect(frame.getAttribute('src')).toBe(
            'https://maps.google.com/maps?q=31.77%2C35.23&z=8&output=embed',
        );
        expect(frame.hasAttribute('allowfullscreen')).toBe(false);
        const link = host.querySelector('.location-name-lookup__map a')!;
        expect(link.getAttribute('href')).toBe(
            'https://www.google.com/maps/search/?api=1&query=31.77%2C35.23',
        );
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noreferrer');
        expect(link.textContent).toBe('Open in Google Maps');
        expect(
            host.querySelector('.location-name-lookup__map-note')!.textContent,
        ).toBe('Approximate location, the marker is an estimated point');
    });

    test('a place without coordinates draws no map', () => {
        h.locationRecord = {
            name: 'Ophir',
            title: '',
            description: '',
            type: 'region',
            oldName: null,
            modernIdentification: null,
            relatedLocations: [],
            verses: [],
            coordinates: null,
        };
        const host = renderHost(
            <RenderLocationDetailComp
                recordId="x"
                onVersesResolved={() => {}}
            />,
        );
        expect(host.querySelector('iframe')).toBeNull();
        expect(host.querySelector('.location-name-lookup__map')).toBeNull();
    });
});
