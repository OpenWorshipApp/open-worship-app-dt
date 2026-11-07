// @vitest-environment jsdom

import { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The web file editor window: which file it opens (and when it refuses),
// the Monaco side -- the editor wrapper is mocked, monaco never loads -- and
// the live previewer beside it.
const h = vi.hoisted(() => ({
    fileFullName: null as string | null,
    webDirPath: null as string | null,
    existingFilePaths: new Set<string>(),
    dirSettingNames: [] as string[],
    fileContents: {} as Record<string, string | null>,
    writes: [] as [string, string][],
    fileEventEntries: new Set<{
        events: string[];
        filePath?: string;
        call: () => void;
    }>(),
    monacoOptions: null as any,
    containerElements: [] as (HTMLElement | null)[],
    resizeProps: null as any,
    editor: null as any,
    openExternalURL: vi.fn(),
}));

vi.mock('monaco-editor', () => ({
    Uri: { parse: (value: string) => ({ uri: value }) },
}));
vi.mock('../../helper/monacoEditorHelpers', async () => {
    const react = await import('react');
    return {
        useInitMonacoEditor: (options: any) => {
            h.monacoOptions = options;
            // Once, the way the real wrapper builds its editor once.
            react.useMemo(() => {
                options.onInit?.(h.editor);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return {
                editorStore: { editorInstance: h.editor },
                onContainerInit: (element: HTMLElement | null) => {
                    h.containerElements.push(element);
                },
            };
        },
    };
});
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            src: `file://${filePath}`,
            fullName: filePath.split('/').at(-1),
            readFileData: async () => h.fileContents[filePath] ?? null,
            writeFileData: async (content: string) => {
                h.writes.push([filePath, content]);
            },
        }),
    },
}));
vi.mock('../../helper/dirSourceHelpers', async () => {
    const react = await import('react');
    return {
        useFileSourceEvents: (
            events: string[],
            callback: () => void,
            _deps: unknown[],
            filePath?: string,
        ) => {
            const callbackRef = react.useRef(callback);
            callbackRef.current = callback;
            react.useEffect(() => {
                const entry = {
                    events,
                    filePath,
                    call: () => callbackRef.current(),
                };
                h.fileEventEntries.add(entry);
                return () => {
                    h.fileEventEntries.delete(entry);
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [filePath]);
        },
    };
});
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffectAsync: (
            effect: (methods: object) => Promise<unknown>,
            deps: unknown[],
        ) => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            react.useEffect(() => {
                void effect({});
            }, deps);
        },
    };
});
vi.mock('../../server/appProvider', () => ({
    default: {
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
    },
}));
vi.mock('../../helper/domHelpers', () => ({
    getParamFileFullName: (_href: string) => h.fileFullName,
}));
vi.mock('../../helper/DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            h.dirSettingNames.push(settingName);
            return h.webDirPath;
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    pathJoin: (dirPath: string, fileName: string) => `${dirPath}/${fileName}`,
    fsExistSync: (filePath: string) => h.existingFilePaths.has(filePath),
}));
vi.mock('../../others/labelIconHelpers', () => ({
    toWidgetLabel: (label: string) => ({ widgetName: label }),
}));
vi.mock('../../resize-actor/ResizeActorComp', async () => {
    const react = await import('react');
    return {
        default: (props: any) => {
            h.resizeProps = props;
            return (
                <div data-resize={props.flexSizeName}>
                    {props.dataInput.map(
                        ({ children: PaneComp, key, widgetName }: any) => (
                            <div
                                key={key}
                                data-pane={key}
                                data-widget-name={widgetName}
                            >
                                <react.Suspense
                                    fallback={<span data-loading />}
                                >
                                    <PaneComp />
                                </react.Suspense>
                            </div>
                        ),
                    )}
                </div>
            );
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import WebEditorComp from './WebEditorComp';
// Loaded up front so the editor window's lazy panes resolve from the module
// cache instead of a cold transform.
import WebEditorIDEComp from './WebEditorIDEComp';
import WebPreviewerComp from './WebPreviewerComp';
import { SelectedWebContext, useSelectedWebContext } from './webEditorHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const FILE_PATH = '/data/webs/welcome.html';

class ErrorBoundaryComp extends Component<
    { children: ReactNode },
    { message: string | null }
> {
    state = { message: null as string | null };
    static getDerivedStateFromError(error: Error) {
        return { message: error.message };
    }
    render() {
        return this.state.message === null ? (
            this.props.children
        ) : (
            <p data-error>{this.state.message}</p>
        );
    }
}

let host: HTMLDivElement;
let root: Root;
let caughtErrors: unknown[];

async function flush() {
    await act(async () => {
        for (let i = 0; i < 10; i += 1) {
            await Promise.resolve();
        }
    });
}

function fireFileEvent(eventName: string, filePath: string) {
    for (const entry of [...h.fileEventEntries]) {
        if (entry.filePath === filePath && entry.events.includes(eventName)) {
            entry.call();
        }
    }
}

function newEditor(value = '') {
    return {
        value,
        setValueCalls: [] as string[],
        actions: [] as any[],
        getValue() {
            return this.value;
        },
        setValue(newValue: string) {
            this.setValueCalls.push(newValue);
            this.value = newValue;
        },
        addAction(action: any) {
            this.actions.push(action);
        },
    };
}

function renderInWindow(children: ReactNode) {
    return act(async () =>
        root.render(
            <SelectedWebContext value={FILE_PATH}>
                {children}
            </SelectedWebContext>,
        ),
    );
}

beforeEach(() => {
    h.fileFullName = 'welcome.html';
    h.webDirPath = '/data/webs';
    h.existingFilePaths = new Set([FILE_PATH]);
    h.dirSettingNames = [];
    h.fileContents = { [FILE_PATH]: '<p>hi</p>' };
    h.writes = [];
    h.fileEventEntries.clear();
    h.monacoOptions = null;
    h.containerElements = [];
    h.resizeProps = null;
    h.editor = newEditor();
    caughtErrors = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host, {
        onCaughtError: (error) => {
            caughtErrors.push(error);
        },
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('web file editor window', () => {
    test('opens the file the address names from the Webs folder, editor beside previewer', async () => {
        await act(async () =>
            root.render(
                <ErrorBoundaryComp>
                    <WebEditorComp />
                </ErrorBoundaryComp>,
            ),
        );
        await flush();

        expect(h.dirSettingNames).toEqual(['select-dir-web-bg']);
        expect(h.resizeProps).toMatchObject({
            flexSizeName: 'web-previewer',
            isHorizontal: true,
            flexSizeDefault: { h1: ['1'], h2: ['1'] },
        });
        expect(
            [...host.querySelectorAll('[data-pane]')].map((element) => [
                element.getAttribute('data-pane'),
                element.getAttribute('data-widget-name'),
            ]),
        ).toEqual([
            ['h1', 'Editor'],
            ['h2', 'Previewer'],
        ]);
        expect(host.querySelector('[data-loading]')).toBeNull();
        const editorPane = host.querySelector('[data-pane="h1"]')!;
        expect(h.containerElements).toContain(
            editorPane.querySelector('.app-overflow-hidden'),
        );
        const iframe = host.querySelector<HTMLIFrameElement>(
            '[data-pane="h2"] iframe',
        )!;
        expect(iframe.getAttribute('src')).toBe(`file://${FILE_PATH}`);
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.title).toBe('welcome.html');
        // The editor got the file's content.
        expect(h.editor.setValueCalls).toEqual(['<p>hi</p>']);
        expect(caughtErrors).toEqual([]);
    });

    test.each([
        {
            name: 'no file in the address',
            setup: () => {
                h.fileFullName = null;
            },
            message: 'Web file not specified',
        },
        {
            name: 'no Webs folder set',
            setup: () => {
                h.webDirPath = null;
            },
            message: 'Web directory not set',
        },
        {
            name: 'the file is gone',
            setup: () => {
                h.existingFilePaths = new Set();
            },
            message: 'Web file not found: welcome.html',
        },
    ])('refuses to open with $name', async ({ setup, message }) => {
        setup();
        await act(async () =>
            root.render(
                <ErrorBoundaryComp>
                    <WebEditorComp />
                </ErrorBoundaryComp>,
            ),
        );
        expect(host.querySelector('[data-error]')?.textContent).toBe(message);
        expect(host.querySelector('[data-resize]')).toBeNull();
        expect((caughtErrors[0] as Error).message).toBe(message);
    });

    test('the editor is set up for HTML and writes every edit back to the file', async () => {
        await renderInWindow(<WebEditorIDEComp />);
        await flush();
        expect(h.monacoOptions).toMatchObject({
            settingName: 'web-editor-wrap-text',
            options: { language: 'html' },
            language: 'html',
            uri: { uri: 'web-editor' },
        });
        expect(h.editor.setValueCalls).toEqual(['<p>hi</p>']);

        h.monacoOptions.onContentChange('<p>hi</p>', '<p>bye</p>');
        expect(h.writes).toEqual([[FILE_PATH, '<p>bye</p>']]);

        const [action] = h.editor.actions;
        expect(action).toMatchObject({
            id: 'learn',
            label: 'Learn More About Web Development',
            contextMenuGroupId: 'navigation',
        });
        await action.run();
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://developer.mozilla.org/en-US/docs/Web/HTML',
        );
    });

    test('the editor does not reload content it already shows, nor a file it cannot read', async () => {
        h.editor = newEditor('<p>hi</p>');
        await renderInWindow(<WebEditorIDEComp />);
        await flush();
        expect(h.editor.setValueCalls).toEqual([]);

        h.fileContents[FILE_PATH] = null;
        vi.useFakeTimers();
        fireFileEvent('update', FILE_PATH);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        await flush();
        expect(h.editor.setValueCalls).toEqual([]);
        expect(h.editor.value).toBe('<p>hi</p>');
    });

    test('a burst of outside saves reloads the editor once, after the debounce', async () => {
        await renderInWindow(<WebEditorIDEComp />);
        await flush();
        vi.useFakeTimers();

        h.fileContents[FILE_PATH] = '<p>external</p>';
        fireFileEvent('update', FILE_PATH);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        fireFileEvent('update', FILE_PATH);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        await flush();
        expect(h.editor.setValueCalls).toEqual(['<p>hi</p>']);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        await flush();
        expect(h.editor.setValueCalls).toEqual([
            '<p>hi</p>',
            '<p>external</p>',
        ]);
        // Another file's save is none of this editor's business.
        h.fileContents[FILE_PATH] = '<p>later</p>';
        fireFileEvent('update', '/data/webs/other.html');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        await flush();
        expect(h.editor.setValueCalls).toHaveLength(2);
    });

    test('the previewer reloads the page on every save, past the cache', async () => {
        await renderInWindow(<WebPreviewerComp />);
        const iframe = host.querySelector<HTMLIFrameElement>('iframe')!;
        expect(iframe.getAttribute('src')).toBe(`file://${FILE_PATH}`);
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.title).toBe('welcome.html');

        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
        await act(async () => fireFileEvent('update', FILE_PATH));
        expect(iframe.getAttribute('src')).toBe(
            `file://${FILE_PATH}?t=1700000000000`,
        );
        // Stops listening once closed.
        act(() => root.unmount());
        expect(h.fileEventEntries.size).toBe(0);
        root = createRoot(host);
    });

    test('a part of the editor window refuses to render outside it', async () => {
        function ProbeComp() {
            return <span>{useSelectedWebContext()}</span>;
        }
        await act(async () =>
            root.render(
                <ErrorBoundaryComp>
                    <ProbeComp />
                </ErrorBoundaryComp>,
            ),
        );
        expect(host.querySelector('[data-error]')?.textContent).toBe(
            'No SelectedWebContext found',
        );

        await act(async () =>
            root.render(
                <SelectedWebContext value={FILE_PATH}>
                    <ProbeComp />
                </SelectedWebContext>,
            ),
        );
        expect(host.textContent).toBe(FILE_PATH);
    });
});
