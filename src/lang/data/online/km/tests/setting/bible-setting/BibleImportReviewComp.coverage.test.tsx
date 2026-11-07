// @vitest-environment jsdom

// The review's paths BibleImportReviewComp.test.tsx does not take: installed
// keys, unreadable key lists, an invalid or changed locale, the digit picker,
// "Find more editions", and a save that fails.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import kmBibleBooks from '../../../bibleBooks.json';

const h = vi.hoisted(() => ({
    getAllXMLFileKeysMock: vi.fn(),
    getDownloadedBibleInfoListMock: vi.fn(),
    saveNewBibleImportMock: vi.fn(),
    callToolMock: vi.fn(),
}));

vi.mock('../../../../../../langHelpers', () => ({
    tran: (text: string) => text,
    allLocalesMap: { 'km-KH': 'km', 'fr-FR': 'fr', 'en-US': 'en' },
}));
vi.mock('../../../../../../../helper/appHooks', async () => {
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
vi.mock(
    '../../../../../../../setting/bible-setting/bibleXMLJsonDataHelpers',
    () => ({
        getAllXMLFileKeys: h.getAllXMLFileKeysMock,
    }),
);
vi.mock(
    '../../../../../../../helper/bible-helpers/bibleDownloadHelpers',
    () => ({
        getDownloadedBibleInfoList: h.getDownloadedBibleInfoListMock,
    }),
);
vi.mock(
    '../../../../../../../setting/bible-setting/bibleImportSaveHelpers',
    () => ({
        saveNewBibleImport: h.saveNewBibleImportMock,
    }),
);
vi.mock('../../../../../../../chatbot/mcpClient', () => ({
    callTool: h.callToolMock,
    parseToolJson: JSON.parse,
}));
vi.mock('../../../../../../../server/appProvider', () => ({
    default: { appInfo: { version: '2026.10.28' } },
}));

import BibleImportReviewComp from '../../../../../../../setting/bible-setting/BibleImportReviewComp';

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
        await typeInto(getByLabel('Locale'), 'en-US');
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
            { action: 'names', locale: 'en-US' },
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
                data={genData('en-US')}
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

// Paths the cases above leave out: a new locale drops the book names picked
// for the old one, a late failure for a locale already left stays quiet, and
// a good save hands over with the file's own names.
describe('BibleImportReviewComp locale changes and a good save', () => {
    test('a new locale resets the digits to its own and drops the chosen book names', async () => {
        await renderReview();
        await waitFor(() => getMappingOptionCount() > 1);
        expect(getByLabel<HTMLSelectElement>('Number mapping').value).toBe(
            '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩',
        );
        const books = getByLabel<HTMLSelectElement>('Book name mapping');
        await act(async () => {
            books.value = '0';
            books.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(books.value).toBe('0');

        await commitLocale('en-US');
        await waitFor(() => h.callToolMock.mock.calls.length === 2);
        await waitFor(() => getMappingOptionCount() > 1);

        expect(getByLabel<HTMLSelectElement>('Number mapping').value).toBe(
            '0 1 2 3 4 5 6 7 8 9',
        );
        expect(getByLabel<HTMLSelectElement>('Book name mapping').value).toBe(
            '-1',
        );
        expect(h.callToolMock).toHaveBeenLastCalledWith(
            'owa_bible_xml',
            { action: 'names', locale: 'en-US' },
            expect.anything(),
        );
    });

    test('a failed page for a locale no longer chosen is not reported', async () => {
        const onlineBooks = Array.from({ length: 66 }, (_, index) => {
            return `Online ${index}`;
        });
        let failMore!: (error: Error) => void;
        h.callToolMock.mockImplementation((_tool: string, args: any) => {
            if (args.offset !== undefined) {
                return new Promise<string>((_resolve, reject) => {
                    failMore = reject;
                });
            }
            return Promise.resolve(
                genNames({
                    bookNames: [onlineBooks],
                    sources: [{ label: 'First', url: 'https://x/1' }],
                    moreAvailable: args.locale === 'km-KH',
                    nextOffset: 3,
                }),
            );
        });
        await renderReview();
        await waitFor(() => findButton('Find more editions') !== null);
        await act(async () => findButton('Find more editions')!.click());

        await commitLocale('en-US');
        await waitFor(() => {
            return (
                h.callToolMock.mock.calls.length === 3 &&
                container.querySelector('[role="status"]') === null
            );
        });
        await act(async () => failMore(new Error('late')));
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });

        expect(container.textContent).not.toContain(
            'Some online sources are unavailable',
        );
    });

    test('a good save hands over, keeping the names in the file', async () => {
        const onImported = await renderReview();
        await waitFor(() => findButton('KM1954') !== null);
        await act(async () => findButton('KM1954')!.click());
        await waitFor(() => !findButton('Import')!.disabled);

        await act(async () => findButton('Import')!.click());

        expect(onImported).toHaveBeenCalledOnce();
        const [saved] = h.saveNewBibleImportMock.mock.calls[0];
        expect(saved.info.key).toBe('KM1954');
        expect(saved.info.keyBookMap).toEqual({ GEN: 'Genesis' });
        expect(saved.info.note).toContain('The names in the file');
    });

    test('an edition Find more editions adds reads as its source and first names', async () => {
        const onlineBooks = Array.from({ length: 66 }, (_, index) => {
            return `Online ${index}`;
        });
        const moreBooks = Array.from({ length: 66 }, (_, index) => {
            return `More ${index}`;
        });
        h.callToolMock.mockImplementation((_tool: string, args: any) => {
            return Promise.resolve(
                args.offset === undefined
                    ? genNames({
                          bookNames: [onlineBooks],
                          sources: [{ label: 'First', url: 'https://x/1' }],
                          moreAvailable: true,
                          nextOffset: 3,
                      })
                    : genNames({
                          bookNames: [moreBooks],
                          sources: [{ label: 'Second', url: 'https://x/2' }],
                      }),
            );
        });
        await renderReview();
        await waitFor(() => findButton('Find more editions') !== null);

        await act(async () => findButton('Find more editions')!.click());
        await waitFor(() => findButton('Find more editions') === null);

        const books = getByLabel<HTMLSelectElement>('Book name mapping');
        expect(books.options).toHaveLength(KM_SETS.length + 3);
        expect(books.options[books.options.length - 1].textContent).toContain(
            'Second — More 0, More 1, More 2',
        );
        // The search has settled: nothing says it is still looking.
        expect(container.querySelector('[role="status"]')).toBeNull();
    });
});
