// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    books: [] as
        | undefined
        | null
        | { bookKey: string; book: string; isAvailable: boolean }[],
    chapters: [{ chapter: 1, chapterLocaleString: '1' }],
    chapter: {
        verses: { '1': 'old' },
        newLines: [] as string[],
        newLinesTitleMap: {},
        customVersesMap: {},
    } as null | undefined | Record<string, unknown>,
    nextSave: null as null | Record<string, unknown>,
    xml: null as null | Record<string, any>,
    saveXml: vi.fn(async () => true),
    toast: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppStateAsync: (_read: () => Promise<unknown>, deps: unknown[]) =>
            deps.length === 1 ? [h.books] : [h.chapter],
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: vi.fn(),
    useChapterMatch: () => h.chapters,
}));
vi.mock('../../helper/bible-helpers/bibleInfoHelpers', () => ({
    getChapterData: vi.fn(),
}));
vi.mock('./bibleXMLHelpers', () => ({
    getBibleXMLDataFromKey: async () => h.xml,
    saveJsonDataToXMLfile: h.saveXml,
}));
vi.mock('./BibleXMLEditorComp', () => ({
    default: ({
        jsonData,
        save,
    }: {
        jsonData: Record<string, unknown>;
        save: (data: Record<string, unknown>) => void;
    }) => (
        <div data-editor="chapter">
            <span data-json>{JSON.stringify(jsonData)}</span>
            <button type="button" onClick={() => save(h.nextSave ?? jsonData)}>
                Save chapter
            </button>
        </div>
    ),
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <span>Loading chapter</span>,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../settingHelpers', () => ({ forceReloadAppWindows: h.reload }));
vi.mock('./schemas/bibleSchemaHelpers', () => ({
    bookChapterEditorSchemaHandler: {},
}));
vi.mock('./schemas/bibleEditorUriHelpers', () => ({
    bibleBookChapterUri: 'chapter:test',
}));

import BibleXMLBookChapterEditorComp from './BibleXMLBookChapterEditorComp';

describe('BibleXMLBookChapterEditorComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function renderEditor() {
        await act(async () =>
            root.render(<BibleXMLBookChapterEditorComp bibleKey="KJV" />),
        );
    }

    async function save() {
        await act(async () => {
            container.querySelector<HTMLButtonElement>('button')!.click();
            await Promise.resolve();
        });
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.books = [{ bookKey: 'GEN', book: 'Genesis', isAvailable: true }];
        h.chapters = [{ chapter: 1, chapterLocaleString: '1' }];
        h.chapter = {
            verses: { '1': 'old' },
            newLines: [],
            newLinesTitleMap: {},
            customVersesMap: {},
        };
        h.nextSave = null;
        h.xml = {
            books: { GEN: { '1': { '1': 'old', '2': 'keep' } } },
            customVersesMap: { existing: 'old' },
            newLinesTitleMap: { existing: 'old' },
            newLines: ['seen'],
        };
        h.saveXml.mockReset().mockResolvedValue(true);
        h.toast.mockClear();
        h.reload.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('selects the first available book and exposes its chapter data', async () => {
        h.books = [
            { bookKey: 'EXO', book: 'Exodus', isAvailable: false },
            { bookKey: 'GEN', book: 'Genesis', isAvailable: true },
        ];
        await renderEditor();
        expect(container.querySelectorAll('select')).toHaveLength(2);
        expect(
            container.querySelector<HTMLSelectElement>('select')?.value,
        ).toBe('GEN');
        expect(
            container
                .querySelector('option[value="EXO"]')
                ?.hasAttribute('disabled'),
        ).toBe(true);
        expect(
            JSON.parse(container.querySelector('[data-json]')!.textContent!),
        ).toMatchObject({
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 1,
            verses: { '1': 'old' },
        });
    });

    test('rejects changed identifiers before any XML write', async () => {
        await renderEditor();
        const data = JSON.parse(
            container.querySelector('[data-json]')!.textContent!,
        );
        for (const [key, value, message] of [
            ['bibleKey', 'OTHER', 'Invalid Bible Key OTHER'],
            ['bookKey', 'EXO', 'Invalid Book Key EXO'],
            ['chapter', 2, 'Invalid Chapter Number 2'],
        ] as const) {
            h.nextSave = { ...data, [key]: value };
            await save();
            expect(h.toast).toHaveBeenLastCalledWith(
                'Saving Bible Data',
                message,
            );
        }
        expect(h.saveXml).not.toHaveBeenCalled();
    });

    test('merges verse overrides, new lines and titles before reloading', async () => {
        await renderEditor();
        h.nextSave = {
            bibleKey: 'KJV',
            bookKey: 'GEN',
            chapter: 1,
            verses: { '1': 'edited' },
            customVersesMap: { added: 'new' },
            newLinesTitleMap: { added: 'title' },
            newLines: ['seen', 'new line'],
        };
        await save();
        expect(h.saveXml).toHaveBeenCalledWith(
            expect.objectContaining({
                customVersesMap: { existing: 'old', added: 'new' },
                newLinesTitleMap: { existing: 'old', added: 'title' },
                newLines: ['seen', 'new line'],
                books: { GEN: { '1': { '1': 'edited', '2': 'keep' } } },
            }),
        );
        expect(h.reload).toHaveBeenCalledOnce();
    });

    test('reports missing XML and does not reload after a failed save', async () => {
        await renderEditor();
        h.xml = null;
        await save();
        expect(h.toast).toHaveBeenLastCalledWith(
            'Saving Bible Data',
            'Bible Data not found for key KJV',
        );
        expect(h.saveXml).not.toHaveBeenCalled();
        h.xml = { books: { GEN: { '1': {} } } };
        h.saveXml.mockResolvedValue(false);
        await save();
        expect(h.reload).not.toHaveBeenCalled();
    });

    test('shows loading and unavailable states without an editor', async () => {
        h.books = undefined;
        await renderEditor();
        expect(container.textContent).toContain('Loading chapter');
        h.books = null;
        await renderEditor();
        expect(container.textContent).toContain('Unable to load book list.');
        h.books = [];
        await renderEditor();
        expect(container.querySelector('[data-editor]')).toBeNull();
    });
});
