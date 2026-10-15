// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';
import type { StoreType } from './monacoEditorHelpers';

const h = vi.hoisted(() => ({
    models: [] as any[],
    editors: [] as any[],
    setting: false,
    errors: vi.fn(),
    dark: false,
}));

vi.mock('monaco-editor', () => ({
    editor: {
        createModel: (
            value: string,
            language: string,
            uri: { toString: () => string },
        ) => {
            const model = {
                value,
                language,
                uri: uri.toString(),
                dispose: vi.fn(),
                isAttachedToEditor: vi.fn(() => false),
                getFullModelRange: vi.fn(() => ({
                    startLineNumber: 1,
                    endLineNumber: 1,
                })),
            };
            h.models.push(model);
            return model;
        },
        create: (div: HTMLDivElement, options: any) => {
            const instance = {
                div,
                options,
                actions: [] as any[],
                mouseDown: undefined as undefined | ((event: any) => void),
                contentChange: undefined as undefined | (() => void),
                content: options.model.value as string,
                addAction(action: any) {
                    this.actions.push(action);
                },
                onMouseDown(callback: (event: any) => void) {
                    this.mouseDown = callback;
                },
                onDidChangeModelContent(callback: () => void) {
                    this.contentChange = callback;
                },
                getModel: () => options.model,
                getSelection: () => ({ startLineNumber: 2, endLineNumber: 2 }),
                getValue() {
                    return this.content;
                },
                executeEdits: vi.fn(function (
                    this: any,
                    _source: string,
                    edits: any[],
                ) {
                    instance.content = edits[0].text;
                    instance.contentChange?.();
                }),
                focus: vi.fn(),
                updateOptions: vi.fn(),
                layout: vi.fn(),
                dispose: vi.fn(),
            };
            h.editors.push(instance);
            return instance;
        },
    },
    KeyMod: { CtrlCmd: 1, Alt: 2 },
    KeyCode: { KeyV: 4, KeyZ: 8 },
}));
vi.mock('./settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingBoolean: () => {
            const [value, setValue] = react.useState(h.setting);
            const save = (next: boolean) => {
                h.setting = next;
                setValue(next);
            };
            return [value, save] as const;
        },
    };
});
vi.mock('./appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});
vi.mock('../others/themeHelpers', () => ({
    checkIsDarkMode: () => h.dark,
}));
vi.mock('./loggerHelpers', () => ({ appError: h.errors }));
// This suite isolates editor behavior; the one label exists in both source dictionaries.
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import { useInitMonacoEditor } from './monacoEditorHelpers';

let root: Root;
let container: HTMLDivElement;
let store: StoreType;
let onContentChange: Mock<(oldContent: string, newContent: string) => void>;
let observer: {
    callback: ResizeObserverCallback;
    disconnect: Mock<() => void>;
};
let uriCounter = 0;
let currentUri: string;

function Probe({ uri = 'file:///one' }: { uri?: string }) {
    store = useInitMonacoEditor({
        settingName: 'wrap',
        options: { value: 'original', fontSize: 20 },
        uri: { toString: () => uri } as any,
        language: 'json',
        onContentChange,
    });
    useEffect(() => {
        return store.onContainerInit(container);
        // The container attachment is intentionally one-time, as in the editor host.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

function editor() {
    return h.editors.at(-1)!;
}

async function mount(uri = currentUri) {
    await act(async () => root.render(createElement(Probe, { uri })));
}

beforeEach(() => {
    currentUri = `file:///unit-${++uriCounter}`;
    h.models.length = 0;
    h.editors.length = 0;
    h.setting = false;
    h.dark = false;
    h.errors.mockClear();
    onContentChange = vi.fn<(oldContent: string, newContent: string) => void>();
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            constructor(callback: ResizeObserverCallback) {
                observer = { callback, disconnect: vi.fn() };
            }
            observe() {}
            disconnect() {
                observer.disconnect();
            }
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    await act(async () => vi.runAllTimers());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('Monaco editor hook', () => {
    it('creates a themed editor with a model and records mouse position', async () => {
        h.dark = true;
        await mount();
        expect(editor().options).toMatchObject({
            theme: 'vs-dark',
            fontSize: 20,
            model: h.models[0],
        });
        expect(h.models[0]).toMatchObject({
            value: 'original',
            language: 'json',
            uri: currentUri,
        });
        expect(container.contains(store.editorStore.div)).toBe(true);
        editor().mouseDown({ event: { posx: 18, posy: 34 } });
        expect(store.editorStore.lastMouseClickPos).toEqual({ x: 18, y: 34 });
    });

    it('replaces content, reports changes and toggles wrapping', async () => {
        await mount();
        await act(async () => store.setNewValue('replacement'));
        expect(editor().executeEdits).toHaveBeenCalledWith('paste', [
            { range: h.models[0].getFullModelRange(), text: 'replacement' },
        ]);
        expect(store.editorStore.systemContent).toBe('replacement');
        await act(async () => editor().contentChange());
        expect(onContentChange).toHaveBeenLastCalledWith(
            'replacement',
            'replacement',
        );
        const toggle = editor().actions.find(
            (action: any) => action.id === 'toggle-wrap-text',
        );
        await act(async () => toggle.run());
        expect(store.isWrapText).toBe(true);
        expect(h.setting).toBe(true);
        expect(editor().updateOptions).toHaveBeenLastCalledWith({
            wordWrap: 'on',
        });
    });

    it('pastes clipboard text at the selection and ignores empty or failed reads', async () => {
        await mount();
        const readText = vi
            .fn()
            .mockResolvedValueOnce('copied')
            .mockResolvedValueOnce('')
            .mockRejectedValueOnce(new Error('denied'));
        vi.stubGlobal('navigator', { clipboard: { readText } });
        const paste = editor().actions.find(
            (action: any) => action.id === 'paste-from-clipboard',
        );
        await act(async () => paste.run(editor()));
        expect(editor().executeEdits).toHaveBeenLastCalledWith('paste', [
            { range: editor().getSelection(), text: 'copied' },
        ]);
        await act(async () => paste.run(editor()));
        await act(async () => paste.run(editor()));
        expect(editor().executeEdits).toHaveBeenCalledTimes(1);
        expect(h.errors).toHaveBeenCalledWith(
            'Failed to read clipboard contents:',
            expect.any(Error),
        );
    });

    it('debounces resize layout and releases the editor after unmount', async () => {
        await mount();
        editor().layout.mockClear();
        observer.callback([], observer as any);
        observer.callback([], observer as any);
        await act(async () => vi.advanceTimersByTime(499));
        expect(editor().layout).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(editor().layout).toHaveBeenCalledTimes(1);
        const instance = editor();
        await act(async () => root.unmount());
        expect(observer.disconnect).toHaveBeenCalledTimes(1);
        expect(instance.dispose).not.toHaveBeenCalled();
        await act(async () => vi.runAllTimers());
        expect(instance.dispose).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });

    it('reuses recent models and evicts an old unattached model after six others', async () => {
        await mount('file:///cache-start');
        const firstModel = h.models[0];
        await act(async () => root.unmount());
        root = createRoot(container);
        await mount('file:///cache-start');
        expect(editor().options.model).toBe(firstModel);
        for (let index = 0; index < 6; index++) {
            await act(async () => root.unmount());
            root = createRoot(container);
            await mount(`file:///cache-${index}`);
        }
        expect(firstModel.dispose).toHaveBeenCalledTimes(1);
        expect(h.models.length).toBe(7);
    });
});
