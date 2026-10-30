// @vitest-environment jsdom

// The book and chapter pickers of the chapter editor, with their lists read
// for real (BibleXMLBookChapterEditorComp.test.tsx answers them with fixed
// values): the first available book chosen by itself, both pickers changed,
// lists that cannot be read, and a chapter with no data.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    chapters: [] as { chapter: number; chapterLocaleString: string }[] | null,
    editorProps: null as any,
    genBookMatchesMock: vi.fn(),
    getChapterDataMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(callee: () => Promise<T>, deps: any[] = []) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let isActive = true;
                setValue(undefined);
                callee().then((newValue) => {
                    if (isActive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: h.genBookMatchesMock,
    useChapterMatch: () => h.chapters,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getChapterData: h.getChapterDataMock,
}));
vi.mock('./bibleXMLHelpers', () => ({
    getBibleXMLDataFromKey: vi.fn(),
    saveJsonDataToXMLfile: vi.fn(),
}));
vi.mock('./BibleXMLEditorComp', () => ({
    default: (props: any) => {
        h.editorProps = props;
        return <div data-testid="editor" />;
    },
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <span data-testid="loading" />,
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

const BOOKS = [
    { bookKey: 'GEN', book: 'Genesis', isAvailable: false },
    { bookKey: 'EXO', book: 'Exodus', isAvailable: true },
    { bookKey: 'LEV', book: 'LEV', isAvailable: true },
];

let container: HTMLDivElement;
let root: Root;

function getSelects() {
    return Array.from(container.querySelectorAll('select'));
}

async function settle() {
    for (let tick = 0; tick < 3; tick++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

async function choose(select: HTMLSelectElement, value: string) {
    await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
}

async function renderEditor() {
    await act(async () =>
        root.render(<BibleXMLBookChapterEditorComp bibleKey="KJV" />),
    );
    await settle();
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.chapters = [
        { chapter: 0, chapterLocaleString: '0' },
        { chapter: 1, chapterLocaleString: '1' },
        { chapter: 2, chapterLocaleString: '២' },
    ];
    h.editorProps = null;
    h.genBookMatchesMock.mockResolvedValue(BOOKS);
    h.getChapterDataMock.mockImplementation(
        async (_bibleKey: string, bookKey: string, chapter: number) => {
            return chapter === 0
                ? null
                : { title: `${bookKey} ${chapter}`, verses: { '1': 'v1' } };
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BibleXMLBookChapterEditorComp pickers', () => {
    test('opens on the first available book and edits its first chapter', async () => {
        await renderEditor();

        expect(h.genBookMatchesMock).toHaveBeenCalledWith('KJV');
        const [bookSelect, chapterSelect] = getSelects();
        expect(bookSelect.value).toBe('EXO');
        expect(
            Array.from(bookSelect.options).map((option) => {
                return [option.textContent, option.disabled];
            }),
        ).toEqual([
            ['Genesis (GEN)', true],
            ['Exodus (EXO)', false],
            ['LEV', false],
        ]);
        expect(
            Array.from(chapterSelect.options).map((option) => {
                return option.textContent;
            }),
        ).toEqual(['0', '1', '២ (2)']);
        expect(h.getChapterDataMock).toHaveBeenLastCalledWith('KJV', 'EXO', 1);
        // A chapter missing its optional parts is edited with them empty.
        expect(h.editorProps.jsonData).toEqual({
            bibleKey: 'KJV',
            bookKey: 'EXO',
            chapter: 1,
            verses: { '1': 'v1' },
            newLines: [],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
    });

    test('a book and a chapter picked are the ones edited', async () => {
        await renderEditor();

        await choose(getSelects()[0], 'LEV');
        expect(h.getChapterDataMock).toHaveBeenLastCalledWith('KJV', 'LEV', 1);

        await choose(getSelects()[1], '2');
        expect(h.getChapterDataMock).toHaveBeenLastCalledWith('KJV', 'LEV', 2);
        expect(h.editorProps.jsonData).toMatchObject({
            bookKey: 'LEV',
            chapter: 2,
        });
    });

    test('a chapter 0 with no data is an empty introduction to write', async () => {
        await renderEditor();

        await choose(getSelects()[1], '0');

        expect(h.editorProps.jsonData).toEqual({
            bibleKey: 'KJV',
            bookKey: 'EXO',
            chapter: 0,
            verses: {},
            newLines: [],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
    });

    test('any other chapter with no data says so', async () => {
        h.getChapterDataMock.mockResolvedValue(null);
        await renderEditor();
        expect(container.textContent).toContain('Chapter data not found.');
        expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    });

    test('shows loading while the chapter is read', async () => {
        h.getChapterDataMock.mockReturnValue(new Promise(() => {}));
        await renderEditor();
        expect(container.querySelector('[data-testid="loading"]')).not.toBe(
            null,
        );
        expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    });
});

describe('BibleXMLBookChapterEditorComp lists that cannot be used', () => {
    test('a Bible with no available book picks none and edits nothing', async () => {
        h.genBookMatchesMock.mockResolvedValue([BOOKS[0]]);
        await renderEditor();
        expect(getSelects()).toHaveLength(1);
        expect(h.getChapterDataMock).not.toHaveBeenCalled();
        expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    });

    test('a book list that cannot be read says so', async () => {
        h.genBookMatchesMock.mockResolvedValue(null);
        await renderEditor();
        expect(container.textContent).toBe('Unable to load book list.');
    });

    test('a chapter list that cannot be read says so', async () => {
        h.chapters = null;
        await renderEditor();
        expect(container.textContent).toContain('Unable to load chapter list.');
    });
});
