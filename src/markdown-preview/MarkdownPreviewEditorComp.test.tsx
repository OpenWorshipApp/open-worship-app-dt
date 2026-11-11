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
                };
                const editorInstance = {
                    getModel: () => model,
                    addAction: (action: any) => {
                        h.actions.push(action);
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
const onDraftChange = vi.fn<(text: string) => void>();
const onSave = vi.fn<() => void>();

async function render(props: { text?: string; isDarkMode?: boolean } = {}) {
    await act(async () =>
        root.render(
            createElement(MarkdownPreviewEditorComp, {
                text: props.text ?? '# Saved',
                isDarkMode: props.isDarkMode ?? false,
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
    onDraftChange.mockClear();
    onSave.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
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
                    onDraftChange,
                    onSave: newerOnSave,
                }),
            ),
        );
        saveAction.run();
        expect(newerOnSave).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
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
});
