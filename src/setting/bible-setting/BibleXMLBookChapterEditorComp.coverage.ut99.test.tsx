// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Book Chapter tab with its reads actually run: which book it opens on,
// moving between books and chapters, and the chapter-0 introduction.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        books: [] as
            { bookKey: string; book: string; isAvailable: boolean }[] | null,
        chapters: {} as Record<
            string,
            { chapter: number; chapterLocaleString: string }[] | null
        >,
        chapterData: {} as Record<string, unknown>,
        editorProps: null as any,
    },
    mocks: {
        genBookMatches: vi.fn(),
        getChapterData: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                setValue(undefined);
                void read().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: mocks.genBookMatches,
    useChapterMatch: (_bibleKey: string, bookKey: string) =>
        state.chapters[bookKey] ?? null,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getChapterData: mocks.getChapterData,
}));
vi.mock('./bibleXMLHelpers', () => ({
    getBibleXMLDataFromKey: async () => null,
    saveJsonDataToXMLfile: async () => true,
}));
vi.mock('./BibleXMLEditorComp', () => ({
    default: (props: any) => {
        state.editorProps = props;
        return (
            <div className="editor">
                {props.jsonData.bookKey} {props.jsonData.chapter}
            </div>
        );
    },
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <span className="loading">Loading</span>,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../settingHelpers', () => ({ forceReloadAppWindows: vi.fn() }));
vi.mock('./schemas/bibleSchemaHelpers', () => ({
    bookChapterEditorSchemaHandler: {},
}));
vi.mock('./schemas/bibleEditorUriHelpers', () => ({
    bibleBookChapterUri: 'chapter:test',
}));

import BibleXMLBookChapterEditorComp from './BibleXMLBookChapterEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const genesis = { verses: { '1': 'In the beginning' }, newLines: ['GEN 1:1'] };
const exodus = { verses: { '1': 'Now these' } };

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render() {
    await act(async () => {
        root.render(<BibleXMLBookChapterEditorComp bibleKey="KJV" />);
    });
    await wait();
    await wait();
}

function getSelects() {
    return Array.from(container.querySelectorAll('select'));
}

async function choose(select: HTMLSelectElement, value: string) {
    await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wait();
    await wait();
}

beforeEach(() => {
    state.books = [
        { bookKey: 'GEN', book: 'Genesis', isAvailable: true },
        { bookKey: 'EXO', book: 'Exodus', isAvailable: true },
        { bookKey: 'TOB', book: 'TOB', isAvailable: false },
    ];
    state.chapters = {
        GEN: [
            { chapter: 0, chapterLocaleString: '0' },
            { chapter: 1, chapterLocaleString: '1' },
            { chapter: 2, chapterLocaleString: '２' },
        ],
        EXO: [{ chapter: 1, chapterLocaleString: '1' }],
    };
    state.chapterData = { 'GEN 1': genesis, 'EXO 1': exodus };
    state.editorProps = null;
    mocks.genBookMatches.mockImplementation(async () => state.books);
    mocks.getChapterData.mockImplementation(
        async (_bibleKey: string, bookKey: string, chapter: number) =>
            state.chapterData[`${bookKey} ${chapter}`] ?? null,
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('choosing what to edit', () => {
    test('opens on the first available book at chapter 1', async () => {
        await render();
        expect(mocks.genBookMatches).toHaveBeenCalledWith('KJV');
        const [bookSelect, chapterSelect] = getSelects();
        expect(bookSelect.value).toBe('GEN');
        // An unavailable book is listed but cannot be picked.
        const options = Array.from(bookSelect.options);
        expect(options.map((option) => option.textContent)).toEqual([
            'Genesis (GEN)',
            'Exodus (EXO)',
            'TOB',
        ]);
        expect(options[2].disabled).toBe(true);
        expect(chapterSelect.value).toBe('1');
        expect(
            Array.from(chapterSelect.options).map(
                (option) => option.textContent,
            ),
        ).toEqual(['0', '1', '２ (2)']);
        expect(mocks.getChapterData).toHaveBeenCalledWith('KJV', 'GEN', 1);
        expect(state.editorProps.jsonData).toEqual({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 1,
            verses: { '1': 'In the beginning' },
            newLines: ['GEN 1:1'],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
    });

    test('opens nothing when no book is available', async () => {
        state.books = [{ bookKey: 'TOB', book: 'Tobit', isAvailable: false }];
        await render();
        expect(getSelects()).toHaveLength(1);
        expect(getSelects()[0].value).toBe('');
        expect(container.querySelector('.editor')).toBeNull();
        expect(mocks.getChapterData).not.toHaveBeenCalled();
    });

    test('another book and another chapter load their own data', async () => {
        await render();
        await choose(getSelects()[0], 'EXO');
        expect(mocks.getChapterData).toHaveBeenLastCalledWith('KJV', 'EXO', 1);
        expect(container.querySelector('.editor')!.textContent).toBe('EXO 1');

        await choose(getSelects()[0], 'GEN');
        await choose(getSelects()[1], '2');
        expect(mocks.getChapterData).toHaveBeenLastCalledWith('KJV', 'GEN', 2);
        expect(container.textContent).toContain('Chapter data not found.');
        expect(container.querySelector('.editor')).toBeNull();
    });

    test('a chapter 0 the Bible has no text for is edited as its introduction', async () => {
        await render();
        await choose(getSelects()[1], '0');
        expect(state.editorProps.jsonData).toEqual({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 0,
            verses: {},
            newLines: [],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
    });

    test('a chapter list that cannot be read says so', async () => {
        state.chapters = { GEN: null };
        await render();
        expect(container.textContent).toContain('Unable to load chapter list.');
    });

    test('shows a spinner while the chapter loads', async () => {
        let finish!: (value: unknown) => void;
        mocks.getChapterData.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        await render();
        expect(container.querySelector('.loading')).not.toBeNull();
        expect(container.querySelector('.editor')).toBeNull();
        await act(async () => {
            finish(genesis);
        });
        expect(container.querySelector('.editor')!.textContent).toBe('GEN 1');
    });
});
