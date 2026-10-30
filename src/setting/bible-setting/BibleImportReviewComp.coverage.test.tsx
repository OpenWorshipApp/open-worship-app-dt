// @vitest-environment jsdom

// The review's paths BibleImportReviewComp.test.tsx does not take: installed
// keys, unreadable key lists, an invalid or changed locale, the digit picker,
// "Find more editions", and a save that fails.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import kmBibleBooks from '../../lang/data/km/bibleBooks.json';

const h = vi.hoisted(() => ({
    getAllXMLFileKeysMock: vi.fn(),
    getDownloadedBibleInfoListMock: vi.fn(),
    saveNewBibleImportMock: vi.fn(),
    callToolMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
    allLocalesMap: { 'km-KH': 'km', 'fr-FR': 'fr', 'en-US': 'en' },
}));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: h.getAllXMLFileKeysMock,
}));
vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: h.getDownloadedBibleInfoListMock,
}));
vi.mock('./bibleImportSaveHelpers', () => ({
    saveNewBibleImport: h.saveNewBibleImportMock,
}));
vi.mock('../../chatbot/mcpClient', () => ({
    callTool: h.callToolMock,
    parseToolJson: JSON.parse,
}));
vi.mock('../../server/appProvider', () => ({
    default: { appInfo: { version: '2026.10.28' } },
}));

import BibleImportReviewComp from './BibleImportReviewComp';

const KM_SETS = kmBibleBooks as { keys: string[]; books: string[] }[];
const ORIGIN = {
    by: 'settings',
    url: 'https://example.org/Khmer1954.xml',
    fileName: 'Khmer1954.xml',
    bytes: 1024,
} as const;

function genData(locale = 'km-KH') {
    return {
        info: {
            key: '',
            locale,
            title: 'Khmer Bible 1954',
            numbersMap: {},
            keyBookMap: { GEN: 'Genesis' },
        },
        books: { GEN: { '1': { '1': 'ដើមដំបូង' } } },
    } as any;
}

function genNames(overrides: Record<string, unknown>) {
    return JSON.stringify({
        bookNames: [],
        sources: [],
        warnings: [],
        searchUrl: '',
        moreAvailable: false,
        nextOffset: 0,
        ...overrides,
    });
}

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent === text;
        }) ?? null
    );
}

function getByLabel<T extends Element>(label: string) {
    return container.querySelector(`[aria-label="${label}"]`) as T;
}

function readAlerts() {
    return Array.from(container.querySelectorAll('[role="alert"]')).map(
        (alert) => {
            return alert.textContent;
        },
    );
}

async function waitFor(check: () => boolean) {
    for (let tick = 0; tick < 80 && !check(); tick++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
        });
    }
    expect(check()).toBe(true);
}

async function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function commitLocale(locale: string) {
    const input = getByLabel<HTMLInputElement>('Locale');
    await typeInto(input, locale);
    await act(async () => {
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
}

async function renderReview(data = genData()) {
    const onImported = vi.fn();
    await act(async () => {
        root.render(
            <BibleImportReviewComp
                data={data}
                origin={ORIGIN}
                keyChoices={[]}
                onCancel={vi.fn()}
                onImported={onImported}
            />,
        );
    });
    return onImported;
}

function getMappingOptionCount() {
    return getByLabel<HTMLSelectElement>('Book name mapping').options.length;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.getAllXMLFileKeysMock.mockResolvedValue({ KJV: '/bibles/KJV.xml' });
    h.getDownloadedBibleInfoListMock.mockResolvedValue([{ key: 'KSV' }]);
    h.saveNewBibleImportMock.mockResolvedValue(true);
    h.callToolMock.mockRejectedValue(new Error('offline'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BibleImportReviewComp keys', () => {
    test('a key an installed Bible holds is refused, XML or downloaded', async () => {
        await renderReview();
        await waitFor(() => findButton('KM1954') !== null);

        await typeInto(getByLabel('Bible key'), 'ksv');

        expect(readAlerts()).toContain('Key is already taken');
        expect(findButton('Import')!.disabled).toBe(true);

        await typeInto(getByLabel('Bible key'), 'KJV');
        expect(readAlerts()).toContain('Key is already taken');

        await typeInto(getByLabel('Bible key'), 'KM2026');
        expect(readAlerts()).toEqual([]);
        expect(findButton('Import')!.disabled).toBe(false);
    });

    test('a key list that cannot be read says so and blocks the import', async () => {
        h.getDownloadedBibleInfoListMock.mockResolvedValue(null);
        await renderReview();
        await waitFor(() => readAlerts().length > 0);

        await typeInto(getByLabel('Bible key'), 'KM2026');

        expect(readAlerts()).toEqual(['Could not check installed Bible keys']);
        expect(findButton('Import')!.disabled).toBe(true);
    });
});

describe('BibleImportReviewComp locale and digits', () => {
    test('an unknown locale asks for a valid one and looks nothing up', async () => {
        await renderReview(genData('xx-XX'));
        await waitFor(() => findButton('XX1954') !== null);

        expect(readAlerts()).toContain('Choose a valid locale');
        expect(h.callToolMock).not.toHaveBeenCalled();
        expect(getMappingOptionCount()).toBe(1);
        await act(async () => findButton('XX1954')!.click());
        expect(findButton('Import')!.disabled).toBe(true);
    });

    test('a new locale is taken on leaving the box, with its names and digits', async () => {
        await renderReview();
        await waitFor(() => getMappingOptionCount() > 1);
        await act(async () => findButton('KM1954')!.click());
        expect(getByLabel<HTMLSelectElement>('Number mapping').value).toBe(
            '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩',
        );

        // Typed but not yet left: nothing is looked up, Import waits.
        await typeInto(getByLabel('Locale'), 'fr-FR');
        expect(findButton('Import')!.disabled).toBe(true);
        expect(h.callToolMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            getByLabel('Locale').dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });
        await waitFor(() => h.callToolMock.mock.calls.length === 2);

        expect(h.callToolMock.mock.calls[1].slice(0, 2)).toEqual([
            'owa_bible_xml',
            { action: 'names', locale: 'fr-FR' },
        ]);
        expect(getByLabel<HTMLSelectElement>('Number mapping').value).toBe(
            '0 1 2 3 4 5 6 7 8 9',
        );
        expect(findButton('Import')!.disabled).toBe(false);

        // An invalid one is taken too, but keeps the digits it had.
        await commitLocale('zz');
        expect(readAlerts()).toContain('Choose a valid locale');
        expect(getByLabel<HTMLSelectElement>('Number mapping').value).toBe(
            '0 1 2 3 4 5 6 7 8 9',
        );
        expect(findButton('Import')!.disabled).toBe(true);
    });

    test('the digits picked are the digits saved', async () => {
        await renderReview();
        await waitFor(() => findButton('KM1954') !== null);
        await act(async () => findButton('KM1954')!.click());
        const numberSelect = getByLabel<HTMLSelectElement>('Number mapping');
        expect(
            Array.from(numberSelect.options).map((option) => {
                return option.textContent;
            }),
        ).toEqual(['០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ (Recommended)', '0 1 2 3 4 5 6 7 8 9']);

        await act(async () => {
            numberSelect.value = '0 1 2 3 4 5 6 7 8 9';
            numberSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await act(async () => findButton('Import')!.click());

        const [saved] = h.saveNewBibleImportMock.mock.calls[0];
        expect(saved.info.numbersMap).toEqual({
            '0': '0',
            '1': '1',
            '2': '2',
            '3': '3',
            '4': '4',
            '5': '5',
            '6': '6',
            '7': '7',
            '8': '8',
            '9': '9',
        });
        // No list chosen: the names in the file are kept.
        expect(saved.info.keyBookMap).toEqual({ GEN: 'Genesis' });
    });
});

describe('BibleImportReviewComp Find more editions', () => {
    const EDITION_A = 'https://bible.example/editions/a';
    const MIRROR_B = 'https://mirror.example/b';
    const OTHER_C = 'https://bible.example/editions/c';
    const otherBooks = Array.from({ length: 66 }, (_, index) => {
        return `Other ${index}`;
    });

    function mockFirstAnswer() {
        h.callToolMock.mockResolvedValueOnce(
            genNames({
                bookNames: [KM_SETS[1].books],
                sources: [{ label: 'Publisher', url: EDITION_A }],
                searchUrl: 'https://search.example/?q=khmer',
                moreAvailable: true,
                nextOffset: 3,
            }),
        );
    }

    function getPreviewLinks() {
        return Array.from(container.querySelectorAll('details a')).map(
            (link) => {
                return link.getAttribute('href');
            },
        );
    }

    test('adds the next editions, each link once, and asks from where it stopped', async () => {
        mockFirstAnswer();
        await renderReview();
        await waitFor(() => findButton('Find more editions') !== null);
        // The online copy of a built-in list is a link on that list.
        expect(getMappingOptionCount()).toBe(1 + KM_SETS.length);
        expect(getPreviewLinks()).toEqual([EDITION_A]);
        expect(
            container.querySelector(
                'a[href="https://search.example/?q=khmer"]',
            ),
        ).not.toBeNull();
        h.callToolMock.mockResolvedValueOnce(
            genNames({
                bookNames: [KM_SETS[1].books, otherBooks],
                sources: [
                    {
                        label: 'Publisher again',
                        url: EDITION_A,
                        references: [{ label: 'Mirror', url: MIRROR_B }],
                    },
                    { label: 'Another edition', url: OTHER_C },
                ],
            }),
        );

        await act(async () => findButton('Find more editions')!.click());
        await waitFor(() => getMappingOptionCount() === 2 + KM_SETS.length);

        expect(h.callToolMock).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'names',
            locale: 'km-KH',
            offset: 3,
        });
        expect(getPreviewLinks()).toEqual([EDITION_A, MIRROR_B, OTHER_C]);
        // Nothing more to find.
        expect(findButton('Find more editions')).toBeNull();
    });

    test('a failed search for more says the sources are unavailable', async () => {
        mockFirstAnswer();
        await renderReview();
        await waitFor(() => findButton('Find more editions') !== null);
        expect(container.textContent).not.toContain(
            'Some online sources are unavailable',
        );
        h.callToolMock.mockRejectedValueOnce(new Error('offline'));

        await act(async () => findButton('Find more editions')!.click());
        await waitFor(() => !findButton('Find more editions')!.disabled);

        expect(container.textContent).toContain(
            'Some online sources are unavailable',
        );
    });

    test('editions found for a locale left meanwhile are dropped', async () => {
        mockFirstAnswer();
        await renderReview();
        await waitFor(() => findButton('Find more editions') !== null);
        let answerMore!: (text: string) => void;
        h.callToolMock.mockReturnValueOnce(
            new Promise<string>((resolve) => {
                answerMore = resolve;
            }),
        );
        await act(async () => findButton('Find more editions')!.click());
        expect(findButton('Find more editions')!.disabled).toBe(true);

        await commitLocale('en-US');
        await act(async () =>
            answerMore(
                genNames({
                    bookNames: [otherBooks],
                    sources: [{ label: 'Another edition', url: OTHER_C }],
                }),
            ),
        );
        await waitFor(() => h.callToolMock.mock.calls.length === 3);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });

        expect(container.textContent).not.toContain('Another edition');
        expect(getPreviewLinks()).not.toContain(OTHER_C);
    });
});

describe('BibleImportReviewComp saving', () => {
    async function pressImport() {
        await waitFor(() => findButton('KM1954') !== null);
        await act(async () => findButton('KM1954')!.click());
        await act(async () => findButton('Import')!.click());
    }

    test('a save the store refused says so and nothing is reported imported', async () => {
        h.saveNewBibleImportMock.mockResolvedValue(false);
        const onImported = await renderReview();

        await pressImport();

        expect(readAlerts()).toEqual(['Failed to save Bible data']);
        expect(onImported).not.toHaveBeenCalled();
        // Ready to try again.
        expect(findButton('Import')!.disabled).toBe(false);
    });

    test('a save that throws shows why', async () => {
        h.saveNewBibleImportMock.mockRejectedValue(new Error('Disk is full'));
        const onImported = await renderReview();

        await pressImport();

        expect(readAlerts()).toEqual(['Disk is full']);
        expect(onImported).not.toHaveBeenCalled();
    });
});

test('a review closed before the built-in names arrive looks nothing up', async () => {
    act(() => {
        root.render(
            <BibleImportReviewComp
                data={genData('fr-FR')}
                origin={ORIGIN}
                keyChoices={[]}
                onCancel={vi.fn()}
                onImported={vi.fn()}
            />,
        );
    });
    act(() => root.unmount());
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(h.callToolMock).not.toHaveBeenCalled();
    root = createRoot(container);
});
