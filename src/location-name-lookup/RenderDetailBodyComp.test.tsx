// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    nameRecord: null as any,
    locationRecord: null as any,
}));

// The lookup language is Khmer; the app interface stays English.
vi.mock('./lookupLangHelpers', () => ({
    useLookupLangPresentation: () => ({
        fontFamily: undefined,
        translate: (text: string) => `km:${text}`,
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
    // Pilate under `km` read `មនុស្ស` beside an English `Male`.
    test('a name record translates its gender with its type', () => {
        h.nameRecord = genNameRecord();
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('km:Person|km:Male');
        expect(rowText('Gender')).toBe('km:Male');
    });

    test('an unknown gender grows neither a chip nor a row', () => {
        h.nameRecord = genNameRecord({ gender: 'unknown' });
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('km:Person');
        expect(rowText('Gender')).toBeNull();
    });

    // Abraham under `km` read `175 years` beside `មនុស្ស` and `ប្រុស`.
    test('a name record translates its age and its year ranges', () => {
        h.nameRecord = genNameRecord({
            age: '175 years',
            years: [{ type: 'reign', start: -1010, end: -970 }],
        });
        const { facts, rowText } = render(
            <RenderNameDetailComp recordId="x" onVersesResolved={() => {}} />,
        );
        expect(facts).toBe('km:Person|km:Male|km:175 years');
        expect(rowText('Age')).toBe('km:175 years');
        expect(rowText('Years')).toBe('km:reign');
    });

    // Siloam under `km` read `Pool`.
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
        expect(facts).toBe('km:Pool');
        expect(rowText('Type')).toBe('km:Pool');
    });
});
