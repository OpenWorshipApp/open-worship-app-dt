// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HookArgsType = {
    settingName: string;
    isWrapTextDefault?: boolean;
    options: { language?: string; value?: string };
    onInit?: (editorInstance: any) => void;
    onContentChange?: (oldContent: string, newContent: string) => void;
    uri: { toString: () => string };
    language: string;
};

const h = vi.hoisted(() => ({
    hookArgs: null as HookArgsType | null,
    actions: [] as any[],
    modelValue: '',
    setValue: vi.fn(),
    setTheme: vi.fn(),
    containerInits: 0,
    isAIEnabled: true,
    openMarkdownInChatbot: vi.fn(),
    // The editor's own box and scrolling: 20px a line.
    editorElement: null as HTMLElement | null,
    editorScrollTop: 0,
    setScrollTop: vi.fn(),
    scrollListeners: new Set<(event: { scrollTopChanged: boolean }) => void>(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
// The words selected are read for real; only the press is watched.
vi.mock('./markdownPreviewChatbotHelpers', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('./markdownPreviewChatbotHelpers')
    >()),
    openMarkdownInChatbot: h.openMarkdownInChatbot,
}));

vi.mock('monaco-editor', () => ({
    editor: { setTheme: h.setTheme },
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { KeyS: 49 },
    Uri: { parse: (value: string) => ({ toString: () => value }) },
}));
vi.mock('../helper/appHooks', async () => {
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// The real hook builds a Monaco editor; this one keeps what it was asked for
// and a model whose `setValue` reports a change the way Monaco's does.
vi.mock('../helper/monacoEditorHelpers', async () => {
    const react = await import('react');
    return {
        useInitMonacoEditor: (args: HookArgsType) => {
            h.hookArgs = args;
            const editorStore = react.useMemo(() => {
                const model = {
                    getValue: () => h.modelValue,
                    setValue: (value: string) => {
                        h.setValue(value);
                        h.modelValue = value;
                        args.onContentChange?.('', value);
                    },
                    getLineCount: () => 20,
                };
                const editorInstance = {
                    getModel: () => model,
                    addAction: (action: any) => {
                        h.actions.push(action);
                    },
                    getContainerDomNode: () => h.editorElement,
                    getScrollTop: () => h.editorScrollTop,
                    setScrollTop: (scrollTop: number) => {
                        h.setScrollTop(scrollTop);
                        h.editorScrollTop = scrollTop;
                        for (const listener of h.scrollListeners) {
                            listener({ scrollTopChanged: true });
                        }
                    },
                    getTopForLineNumber: (lineNumber: number) => {
                        return (lineNumber - 1) * 20;
                    },
                    onDidScrollChange: (
                        listener: (event: {
                            scrollTopChanged: boolean;
                        }) => void,
                    ) => {
                        h.scrollListeners.add(listener);
                        return {
                            dispose: () => {
                                h.scrollListeners.delete(listener);
                            },
                        };
                    },
                };
                args.onInit?.(editorInstance);
                return { editorInstance };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return {
                editorStore,
                // A new callback each render, as the real hook hands out.
                onContainerInit: (element: HTMLElement | null) => {
                    if (element !== null) {
                        h.containerInits++;
                    }
                    return () => {};
                },
            };
        },
    };
});

import MarkdownPreviewEditorComp from './MarkdownPreviewEditorComp';

let root: Root;
let container: HTMLDivElement;
// The page beside the editor, and the drawn file in it: one marked block a
// line, 40px apart from the page's top.
let page: HTMLDivElement;
let article: HTMLDivElement;
let pageScrollTop = 0;
const pageRef = { current: null as HTMLElement | null };
const articleRef = { current: null as HTMLElement | null };
const onDraftChange = vi.fn<(text: string) => void>();
const onSave = vi.fn<() => void>();

function drawPage() {
    page = document.createElement('div');
    Object.defineProperty(page, 'scrollTop', {
        configurable: true,
        get: () => pageScrollTop,
        set: (value: number) => {
            pageScrollTop = value;
        },
    });
    page.getBoundingClientRect = () => ({ top: 0, height: 400 }) as DOMRect;
    article = document.createElement('div');
    for (let line = 0; line < 20; line++) {
        const block = document.createElement('p');
        block.setAttribute('data-source-line', `${line}`);
        block.getBoundingClientRect = () => {
            return {
                top: line * 40 - pageScrollTop,
                height: 40,
                width: 500,
            } as DOMRect;
        };
        article.appendChild(block);
    }
    page.appendChild(article);
    document.body.appendChild(page);
    pageRef.current = page;
    articleRef.current = article;
}

async function render(props: { text?: string; isDarkMode?: boolean } = {}) {
    await act(async () =>
        root.render(
            createElement(MarkdownPreviewEditorComp, {
                text: props.text ?? '# Saved',
                isDarkMode: props.isDarkMode ?? false,
                pageRef,
                articleRef,
                onDraftChange,
                onSave,
            }),
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.hookArgs = null;
    h.actions = [];
    h.modelValue = '';
    h.setValue.mockClear();
    h.setTheme.mockClear();
    h.containerInits = 0;
    h.isAIEnabled = true;
    h.openMarkdownInChatbot.mockReset();
    h.editorElement = document.createElement('div');
    h.editorScrollTop = 0;
    h.setScrollTop.mockClear();
    h.scrollListeners.clear();
    onDraftChange.mockClear();
    onSave.mockClear();
    pageScrollTop = 0;
    drawPage();
    // Beside the root's box, which React empties as it first draws.
    document.body.appendChild(h.editorElement);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    h.editorElement?.remove();
    page.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Markdown Preview editor', () => {
    it('is a wrapping markdown editor on one model for the whole window', async () => {
        await render();
        expect(h.hookArgs).toMatchObject({
            settingName: 'markdown-preview-wrap-text',
            isWrapTextDefault: true,
            language: 'markdown',
            options: { language: 'markdown', value: '# Saved' },
        });
        expect(h.hookArgs!.uri.toString()).toBe('markdown-preview-editor');
    });

    it('puts its text in a model holding another, without calling that a draft', async () => {
        h.modelValue = '# Another file';
        await render({ text: '# Saved' });
        expect(h.setValue).toHaveBeenCalledWith('# Saved');
        expect(onDraftChange).not.toHaveBeenCalled();
        // The person's own change is a draft.
        await act(async () => h.hookArgs!.onContentChange!('', '# Typed'));
        expect(onDraftChange).toHaveBeenCalledWith('# Typed');
    });

    it('leaves a model already holding its text alone, keeping its undo', async () => {
        h.modelValue = '# Draft';
        await render({ text: '# Draft' });
        expect(h.setValue).not.toHaveBeenCalled();
    });

    it('saves on Ctrl+S through the newest callback', async () => {
        await render();
        const saveAction = h.actions.find((action) => {
            return action.id === 'save-markdown-file';
        });
        expect(saveAction).toMatchObject({
            label: 'Save',
            keybindings: [2048 | 49],
        });
        const newerOnSave = vi.fn();
        await act(async () =>
            root.render(
                createElement(MarkdownPreviewEditorComp, {
                    text: '# Saved',
                    isDarkMode: false,
                    pageRef,
                    articleRef,
                    onDraftChange,
                    onSave: newerOnSave,
                }),
            ),
        );
        saveAction.run();
        expect(newerOnSave).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    // 2026-11-11, the user: _selected text in editor should have option to
    // mention in chatbot input text_.
    it('offers the words selected to the assistant, with the file shown', async () => {
        await render();
        const askAction = h.actions.find((action) => {
            return action.id === 'ask-assistant-about-selection';
        });
        expect(askAction).toMatchObject({
            label: 'Ask the assistant about this',
            // Greyed out in the menu with nothing selected.
            precondition: 'editorHasSelection',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 2,
        });
        const lineList = ['# Title', 'For God so loved the world'];
        const actionEditor = {
            getModel: () => ({
                getLineContent: (lineNumber: number) => {
                    return lineList[lineNumber - 1];
                },
                getValueInRange: () => 'so loved',
            }),
            getSelection: () => ({
                startLineNumber: 2,
                startColumn: 9,
                endLineNumber: 2,
                endColumn: 17,
                isEmpty: () => false,
            }),
        };
        // The file the window shows at the press, read off its address.
        const filePath = 'C:\\r\\JHN.3.notes.md';
        globalThis.history.replaceState(
            null,
            '',
            `/markdownPreview.html?preview-file=${encodeURIComponent(filePath)}`,
        );
        askAction.run(actionEditor);
        expect(h.openMarkdownInChatbot).toHaveBeenCalledWith(filePath, {
            text: 'so loved',
            before: 'For God ',
            after: ' the world',
            start: null,
            end: null,
            lines: { first: 2, last: 2 },
        });
        // No file in the address: nothing to hand over.
        globalThis.history.replaceState(null, '', '/markdownPreview.html');
        askAction.run(actionEditor);
        expect(h.openMarkdownInChatbot).toHaveBeenCalledTimes(1);
    });

    it('offers nothing to the assistant while AI is off', async () => {
        h.isAIEnabled = false;
        await render();
        expect(
            h.actions.map((action) => {
                return action.id;
            }),
        ).toEqual(['save-markdown-file']);
    });

    it('follows the window theme', async () => {
        await render({ isDarkMode: true });
        expect(h.setTheme).toHaveBeenLastCalledWith('vs-dark');
        await render({ isDarkMode: false });
        expect(h.setTheme).toHaveBeenLastCalledWith('vs-light');
    });

    it('keeps its element in the page across re-renders', async () => {
        await render({ isDarkMode: true });
        await render({ isDarkMode: false });
        await render({ isDarkMode: true });
        expect(h.containerInits).toBe(1);
    });

    // 2026-11-12, the user: _when editor manual scrolling stopped then the
    // preview should follow, when preview manual scrolling stopped then
    // editor should follow_.
    it('follows the page and is followed by it once the person stops scrolling', async () => {
        vi.useFakeTimers();
        // Opened with line 3 at the page's top, and so at the editor's.
        pageScrollTop = 120;
        await render();
        expect(h.setScrollTop).toHaveBeenCalledTimes(1);
        expect(h.setScrollTop).toHaveBeenCalledWith(60);
        h.setScrollTop.mockClear();
        // A wheel on the page, which stops halfway down line 5.
        article.children[5].dispatchEvent(
            new MouseEvent('wheel', { bubbles: true }),
        );
        pageScrollTop = 220;
        page.dispatchEvent(new Event('scroll'));
        vi.advanceTimersByTime(249);
        expect(h.setScrollTop).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(h.setScrollTop).toHaveBeenCalledTimes(1);
        expect(h.setScrollTop).toHaveBeenCalledWith(110);
        // Keys in the editor, which stops with line 10 at its top.
        h.editorElement!.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true }),
        );
        h.editorScrollTop = 200;
        for (const listener of h.scrollListeners) {
            listener({ scrollTopChanged: true });
        }
        vi.advanceTimersByTime(250);
        expect(pageScrollTop).toBe(400);
        expect(h.setScrollTop).toHaveBeenCalledTimes(1);
        // Gone with the editor.
        await act(async () => root.unmount());
        expect(h.scrollListeners.size).toBe(0);
        root = createRoot(container);
    });
});
