// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { StoreType } from './monacoEditorHelpers';

const h = vi.hoisted(() => ({
    models: [] as any[],
    editors: [] as any[],
    attachedUris: new Set<string>(),
    hasModel: true,
    errors: [] as unknown[][],
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
                disposed: false,
                dispose() {
                    model.disposed = true;
                },
                isAttachedToEditor: () => h.attachedUris.has(uri.toString()),
                getFullModelRange: () => ({ startLineNumber: 1 }),
            };
            h.models.push(model);
            return model;
        },
        create: (div: HTMLDivElement, options: any) => {
            const instance = {
                div,
                options,
                actions: [] as any[],
                edits: [] as unknown[],
                disposed: 0,
                addAction(action: any) {
                    instance.actions.push(action);
                },
                onMouseDown() {},
                onDidChangeModelContent() {},
                getModel: () => (h.hasModel ? options.model : null),
                getSelection: () => ({ startLineNumber: 2 }),
                getValue: () => '',
                executeEdits(_source: string, edits: unknown[]) {
                    instance.edits.push(...edits);
                },
                focus() {},
                updateOptions() {},
                layout() {},
                dispose() {
                    instance.disposed += 1;
                },
            };
            h.editors.push(instance);
            return instance;
        },
    },
    KeyMod: { CtrlCmd: 1, Alt: 2 },
    KeyCode: { KeyV: 4, KeyZ: 8 },
}));

// The `?worker` constructors would spawn real workers; each stand-in says
// which one it is.
vi.mock('monaco-editor/editor/editor.worker?worker', () => ({
    default: class {
        kind = 'editor';
    },
}));
vi.mock('monaco-editor/languages/features/json/json.worker?worker', () => ({
    default: class {
        kind = 'json';
    },
}));
vi.mock('monaco-editor/languages/features/css/css.worker?worker', () => ({
    default: class {
        kind = 'css';
    },
}));
vi.mock('monaco-editor/languages/features/html/html.worker?worker', () => ({
    default: class {
        kind = 'html';
    },
}));
vi.mock('monaco-editor/languages/features/typescript/ts.worker?worker', () => ({
    default: class {
        kind = 'ts';
    },
}));
vi.mock('./settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingBoolean: (_name: string, defaultValue: boolean) => {
            return react.useState(defaultValue);
        },
    };
});
vi.mock('./appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});
vi.mock('../others/themeHelpers', () => ({ checkIsDarkMode: () => false }));
vi.mock('./loggerHelpers', () => ({
    appError: (...args: unknown[]) => {
        h.errors.push(args);
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import { useInitMonacoEditor } from './monacoEditorHelpers';

let root: Root;
let container: HTMLDivElement;
let store: StoreType;

function ProbeComp({ uri }: Readonly<{ uri: string }>) {
    store = useInitMonacoEditor({
        settingName: 'wrap',
        options: { value: 'text' },
        uri: { toString: () => uri } as any,
        language: 'plaintext',
    });
    return null;
}

async function mount(uri: string, isStrict = false) {
    const probe = createElement(ProbeComp, { uri });
    await act(async () => {
        root.render(isStrict ? createElement(StrictMode, null, probe) : probe);
    });
}

async function remount(uri: string) {
    await act(async () => {
        root.unmount();
    });
    root = createRoot(container);
    await mount(uri);
}

beforeEach(() => {
    h.models.length = 0;
    h.editors.length = 0;
    h.attachedUris.clear();
    h.hasModel = true;
    h.errors.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    await act(async () => {
        vi.runAllTimers();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('monaco environment', () => {
    test.each([
        ['json', 'json'],
        ['css', 'css'],
        ['scss', 'css'],
        ['less', 'css'],
        ['html', 'html'],
        ['handlebars', 'html'],
        ['razor', 'html'],
        ['typescript', 'ts'],
        ['javascript', 'ts'],
        ['plaintext', 'editor'],
    ])('a %s model gets the %s worker', async (label, kind) => {
        await mount(`file:///worker-${label}`);
        const environment = (globalThis as any).MonacoEnvironment;
        expect(environment.getWorker('workerId', label).kind).toBe(kind);
    });
});

describe('useInitMonacoEditor edges', () => {
    test('replacing the value of an editor that lost its model does nothing', async () => {
        await mount('file:///no-model');
        h.hasModel = false;
        store.setNewValue('new text');
        expect(h.editors.at(-1).edits).toEqual([]);
        // The system content is still what the caller set.
        expect(store.editorStore.systemContent).toBe('new text');
    });

    test('pasting without a clipboard API logs and edits nothing', async () => {
        await mount('file:///no-clipboard');
        vi.stubGlobal('navigator', {});
        const paste = h.editors
            .at(-1)
            .actions.find(
                (action: any) => action.id === 'paste-from-clipboard',
            );
        await act(async () => {
            await paste.run(h.editors.at(-1));
        });
        expect(h.errors).toEqual([
            ['Clipboard API not supported in this browser.'],
        ]);
        expect(h.editors.at(-1).edits).toEqual([]);
    });

    test('a container that is not there attaches nothing', async () => {
        await mount('file:///no-container');
        const release = store.onContainerInit(null);
        expect(store.editorStore.div.isConnected).toBe(false);
        expect(() => {
            release();
        }).not.toThrow();
    });

    test('a StrictMode remount cancels the deferred dispose', async () => {
        await mount('file:///strict', true);
        // StrictMode ran the effect, its cleanup and the effect again. The
        // dispose that cleanup scheduled must not fire on the live editor.
        // (StrictMode also runs the memo twice; the store keeps one editor.)
        const liveEditor = store.editorStore.editorInstance as any;
        await act(async () => {
            vi.runAllTimers();
        });
        expect(liveEditor.disposed).toBe(0);
        // A real unmount still releases it.
        await act(async () => {
            root.unmount();
        });
        await act(async () => {
            vi.runAllTimers();
        });
        expect(liveEditor.disposed).toBe(1);
        root = createRoot(container);
    });

    test('a model still shown by an editor is never evicted from the cache', async () => {
        await mount('file:///attached');
        const attachedModel = h.models[0];
        h.attachedUris.add('file:///attached');
        for (let index = 0; index < 5; index++) {
            await remount(`file:///other-${index}`);
        }
        // Six models now: the oldest is the attached one, so the next oldest
        // unattached model goes instead.
        expect(attachedModel.disposed).toBe(false);
        expect(h.models[1].disposed).toBe(true);
        expect(h.models.slice(2).map((model) => model.disposed)).toEqual([
            false,
            false,
            false,
            false,
        ]);
    });
});
