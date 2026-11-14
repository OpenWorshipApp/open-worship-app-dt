// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    refByElement: new Map<Element, unknown>(),
}));

// What a link opens is held by the module that made the links; here, by the
// test, for the elements it made.
vi.mock('./markdownPreviewReferenceHelpers', () => ({
    findMarkdownRef: (target: Element | null) => {
        const element = target?.closest('.app-markdown-ref') ?? null;
        return element === null ? null : (h.refByElement.get(element) ?? null);
    },
}));

import type {
    PrintAppendixLabelsType,
    PrintAppendixType,
} from './markdownPrintAppendixHelpers';
import {
    addPrintAppendix,
    collectPrintReferences,
    countPrintReferences,
    genPrintAppendixElement,
} from './markdownPrintAppendixHelpers';

const LABELS: PrintAppendixLabelsType = {
    verses: 'Verses',
    names: 'Names',
    places: 'Places',
    modernIdentification: 'Modern identification',
    leftOut: '{count} more could not be added.',
};

function genPage(parts: (string | { text: string; ref: unknown })[]) {
    const page = document.createElement('div');
    for (const part of parts) {
        if (typeof part === 'string') {
            page.append(part);
            continue;
        }
        const span = document.createElement('span');
        span.className = 'app-markdown-ref';
        span.textContent = part.text;
        if (part.ref !== null) {
            h.refByElement.set(span, part.ref);
        }
        page.append(span);
    }
    document.body.append(page);
    return page;
}

function panel(
    kind: 'verse' | 'name' | 'location',
    target: string,
    bibleKey?: string,
) {
    return {
        kind: 'panel',
        request: {
            kind,
            target,
            name: target,
            ...(bibleKey === undefined ? {} : { bibleKey }),
        },
    };
}

afterEach(() => {
    h.refByElement.clear();
    document.body.innerHTML = '';
});

describe('the references a print could carry', () => {
    test('are each verse, person and place the page links, once, in the order the page first names them', () => {
        const page = genPage([
            { text: 'Nicodemus', ref: panel('name', 'n-1') },
            ' came by night. ',
            { text: 'John 3:16', ref: panel('verse', 'JHN 3:16') },
            { text: 'Ezek. 36:25-27', ref: panel('verse', 'EZK 36:25-27') },
            { text: 'Jerusalem', ref: panel('location', 'l-1') },
            { text: 'Nicodemus', ref: panel('name', 'n-1') },
            { text: 'John 3:16', ref: panel('verse', 'JHN 3:16') },
            // The same verse as another Bible writes it is its own.
            { text: 'Jn 3:16', ref: panel('verse', 'JHN 3:16', 'OTHER') },
            { text: 'Moses', ref: panel('name', 'n-2') },
            // `John 3:1-36 (Amplified)`: that Bible alone.
            {
                text: 'John 3:1-36',
                ref: {
                    ...panel('verse', 'JHN 3:1-36', 'Amplified'),
                    isBibleNamed: true,
                },
            },
        ]);

        const references = collectPrintReferences(page);

        expect(
            references.verses.map((request) => {
                return [request.target, request.bibleKey, request.isBibleNamed];
            }),
        ).toEqual([
            ['JHN 3:16', undefined, undefined],
            ['EZK 36:25-27', undefined, undefined],
            ['JHN 3:16', 'OTHER', undefined],
            ['JHN 3:1-36', 'Amplified', true],
        ]);
        expect(
            references.names.map((request) => {
                return request.target;
            }),
        ).toEqual(['n-1', 'n-2']);
        expect(references.places).toEqual([
            { kind: 'location', target: 'l-1', name: 'l-1' },
        ]);
        expect(countPrintReferences(references)).toBe(7);
    });

    test('are never a file, nor a span the page wrote itself', () => {
        const page = genPage([
            {
                text: 'MAT.18.pdf',
                ref: { kind: 'file', filePath: '/r/MAT.18.pdf' },
            },
            // The file's own HTML can write a span of the same class: it
            // opens nothing, and is nothing to print.
            { text: 'John 3:16', ref: null },
        ]);

        const references = collectPrintReferences(page);

        expect(countPrintReferences(references)).toBe(0);
    });
});

const APPENDIX: PrintAppendixType = {
    verses: [
        {
            title: 'John 3:16-17',
            bibleKey: 'KJV',
            chapters: [
                {
                    title: null,
                    verses: [
                        { verse: '16', text: 'For God so loved the world,' },
                        { verse: '17', text: 'For God sent not his Son' },
                    ],
                },
            ],
            isCut: false,
        },
        {
            title: 'John 2:25-3:1',
            bibleKey: 'KJV',
            chapters: [
                {
                    title: 'John 2:25',
                    verses: [{ verse: '25', text: 'And needed not' }],
                },
                {
                    title: 'John 3:1',
                    verses: [{ verse: '1', text: 'There was a man' }],
                },
            ],
            isCut: true,
        },
    ],
    names: [
        {
            name: 'Nikodemos',
            kjvName: 'Nicodemus',
            summary: 'A Pharisee',
            description: 'He came to Jesus by night.',
            modernIdentification: '',
        },
        {
            name: 'Moses',
            kjvName: null,
            summary: '',
            description: '',
            modernIdentification: '',
        },
    ],
    places: [
        {
            name: 'Aenon',
            kjvName: null,
            summary: 'Where John baptized',
            description: '',
            modernIdentification: 'near Salim',
        },
    ],
    leftOutCount: 3,
};

describe('the appendix after the page', () => {
    test("is the verses' words, then the people, then the places, and how many were left out", () => {
        const page = genPage(['The page.']);

        expect(addPrintAppendix(page, APPENDIX, LABELS)).toBe(true);

        const appendix = page.lastElementChild!;
        expect(appendix.className).toBe('app-markdown-print-appendix');
        expect(
            [...appendix.querySelectorAll('h2')].map((element) => {
                return element.textContent;
            }),
        ).toEqual(['Verses', 'Names', 'Places']);
        const [single, crossing] = appendix.querySelectorAll(
            '.app-markdown-print-appendix-entry--verse',
        );
        expect(
            single.querySelector('.app-markdown-print-appendix-title')
                ?.textContent,
        ).toBe('John 3:16-17 (KJV)');
        // Each verse's number set above its words.
        expect(single.querySelector('p:last-child')?.innerHTML).toBe(
            '<sup>16</sup> For God so loved the world, <sup>17</sup> For God sent not his Son',
        );
        // Over chapters, each under its own title; a cut passage says so.
        expect(
            [
                ...crossing.querySelectorAll(
                    '.app-markdown-print-appendix-chapter',
                ),
            ].map((element) => {
                return element.textContent;
            }),
        ).toEqual(['John 2:25', 'John 3:1']);
        expect(crossing.lastElementChild?.textContent).toBe(
            '1 There was a man …',
        );
        const [nicodemus, moses, aenon] = appendix.querySelectorAll(
            '.app-markdown-print-appendix-entry:not(.app-markdown-print-appendix-entry--verse)',
        );
        expect(nicodemus.textContent).toBe(
            'Nikodemos (Nicodemus) — A PhariseeHe came to Jesus by night.',
        );
        expect(moses.textContent).toBe('Moses');
        expect(aenon.textContent).toBe(
            'Aenon — Where John baptizedModern identification: near Salim',
        );
        expect(appendix.lastElementChild?.textContent).toBe(
            '3 more could not be added.',
        );
    });

    test('carries the words as words, never as markup', () => {
        const page = genPage(['The page.']);
        const hostile = '<img src=x onerror="alert(1)">';

        addPrintAppendix(
            page,
            {
                verses: [
                    {
                        title: hostile,
                        bibleKey: hostile,
                        chapters: [
                            {
                                title: null,
                                verses: [{ verse: hostile, text: hostile }],
                            },
                        ],
                        isCut: false,
                    },
                ],
                names: [
                    {
                        name: hostile,
                        kjvName: hostile,
                        summary: hostile,
                        description: hostile,
                        modernIdentification: hostile,
                    },
                ],
                places: [],
                leftOutCount: 0,
            },
            LABELS,
        );

        expect(page.querySelector('img')).toBeNull();
        expect(page.textContent).toContain(hostile);
    });

    test('a print with nothing read adds nothing, and drops one left behind', () => {
        const page = genPage(['The page.']);
        addPrintAppendix(page, APPENDIX, LABELS);

        expect(
            addPrintAppendix(
                page,
                { verses: [], names: [], places: [], leftOutCount: 4 },
                LABELS,
            ),
        ).toBe(false);

        expect(page.innerHTML).toBe('The page.');
    });

    test('is taken away once the print is done, and only one is ever on the page', () => {
        const page = genPage(['The page.']);
        addPrintAppendix(page, APPENDIX, LABELS);
        addPrintAppendix(page, { ...APPENDIX, leftOutCount: 0 }, LABELS);
        expect(
            page.querySelectorAll('.app-markdown-print-appendix'),
        ).toHaveLength(1);

        globalThis.dispatchEvent(new Event('afterprint'));

        expect(page.innerHTML).toBe('The page.');
    });
});

// The Word export reads the appendix after the page, never putting it on it.
describe('the appendix for a Word document', () => {
    test('is built as the print builds it, put nowhere, and gone with nothing after a print', () => {
        const element = genPrintAppendixElement(document, APPENDIX, LABELS)!;
        expect(element.isConnected).toBe(false);
        expect(element.className).toBe('app-markdown-print-appendix');
        expect(
            [...element.querySelectorAll('h2')].map((one) => {
                return one.textContent;
            }),
        ).toEqual(['Verses', 'Names', 'Places']);
        // No print takes it away: it was never anywhere to take away from.
        globalThis.dispatchEvent(new Event('afterprint'));
        expect(element.querySelectorAll('h2')).toHaveLength(3);
    });

    test('is nothing when nothing was read', () => {
        expect(
            genPrintAppendixElement(
                document,
                { verses: [], names: [], places: [], leftOutCount: 2 },
                LABELS,
            ),
        ).toBeNull();
    });
});
