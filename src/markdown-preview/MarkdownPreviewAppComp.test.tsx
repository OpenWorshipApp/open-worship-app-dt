// @vitest-environment jsdom

import { act, createElement } from 'react';
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

type EditorPropsType = {
    text: string;
    isDarkMode: boolean;
    onDraftChange: (text: string) => void;
    onSave: () => void;
};

const h = vi.hoisted(() => ({
    load: vi.fn(),
    readText: vi.fn(),
    renderText: vi.fn(),
    save: vi.fn(),
    editorProps: null as EditorPropsType | null,
    editorMounts: 0,
    mermaid: vi.fn(),
    watch: vi.fn(),
    openExternalURL: vi.fn(),
    openFile: vi.fn(),
    reveal: vi.fn(),
    initAllLangCss: vi.fn(async () => [
        { fontFamily: 'app-Xx-Face' },
        { fontFamily: 'app-Yy-Face' },
    ]),
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
        useAppEffectAsync: (
            method: (context: {
                setLangFontFamilies: (value: string) => void;
            }) => Promise<void>,
            deps: unknown[],
            context: { setLangFontFamilies: (value: string) => void },
        ) =>
            react.useEffect(() => {
                void method(context);
            }, deps),
    };
});
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    initAllLangCss: h.initAllLangCss,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal File',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.reveal,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        windowTitle: 'Open Worship',
        fileUtils: { watch: h.watch },
        systemUtils: { openFile: h.openFile },
        browserUtils: { openExternalURL: h.openExternalURL },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathBasename: (path: string) => path.split('/').at(-1),
}));
vi.mock('./markdownPreviewFileHelpers', () => ({
    loadMarkdownPreviewFile: h.load,
    readMarkdownPreviewText: h.readText,
    renderMarkdownPreviewText: h.renderText,
    saveMarkdownPreviewFile: h.save,
    toMarkdownPreviewTargetPath: (source: string, target: string) =>
        `${source.slice(0, source.lastIndexOf('/'))}/${target}`,
}));
// Monaco is not run here: the stand-in shows the text it was given and hands
// the window's callbacks to the test, which types by calling them.
vi.mock('./MarkdownPreviewEditorComp', async () => {
    const react = await import('react');
    return {
        default: function StubEditorComp(props: EditorPropsType) {
            h.editorProps = props;
            react.useEffect(() => {
                h.editorMounts++;
            }, []);
            return react.createElement(
                'div',
                { className: 'stub-editor' },
                props.text,
            );
        },
    };
});
// Drawing is the stand-in's; keeping what is already drawn is the real code.
vi.mock('./markdownMermaidHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./markdownMermaidHelpers')>()),
    renderMermaidDiagrams: h.mermaid,
}));

import MarkdownPreviewAppComp from './MarkdownPreviewAppComp';

let root: Root;
let container: HTMLDivElement;
let watchChange: () => void;
let watchError: Mock<(listener: () => void) => void>;
let watchSignal: AbortSignal;
let scrollToDescriptor: PropertyDescriptor | undefined;
let scrollIntoViewDescriptor: PropertyDescriptor | undefined;

function button(label: string) {
    const element = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    );
    expect(element).not.toBeNull();
    return element!;
}

async function render() {
    await act(async () => root.render(createElement(MarkdownPreviewAppComp)));
}

async function clickLink(href: string, type = 'click', buttonNumber = 0) {
    const anchor = container.querySelector<HTMLAnchorElement>(
        `a[href="${href}"]`,
    )!;
    expect(anchor).not.toBeNull();
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: buttonNumber,
    });
    await act(async () => anchor.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    scrollToDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollTo',
    );
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollIntoView',
    );
    HTMLElement.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    history.replaceState(null, '', '/?preview-file=%2Fdocs%2Fstart.md');
    h.load.mockReset().mockResolvedValue({
        status: 'ready',
        html: '<h1 id="md-heading-top">Top</h1><a href="#top">Top link</a><a href="https://example.org">Web</a><a href="next.md">Next</a><a href="tool.exe">File</a>',
        mermaidSources: [],
    });
    h.readText
        .mockReset()
        .mockResolvedValue({ status: 'ready', text: '# Saved' });
    h.renderText.mockReset().mockImplementation((_path: string, text) => ({
        status: 'ready',
        html: `<p class="drawn">${text}</p><a href="next.md">Next</a>`,
        mermaidSources: [],
    }));
    h.save.mockReset().mockResolvedValue(true);
    h.editorProps = null;
    h.editorMounts = 0;
    h.mermaid.mockReset().mockResolvedValue(undefined);
    h.openExternalURL.mockReset();
    h.openFile.mockReset();
    h.reveal.mockReset();
    h.initAllLangCss.mockClear();
    watchError = vi.fn<(listener: () => void) => void>();
    h.watch
        .mockReset()
        .mockImplementation(
            (
                _path: string,
                options: { signal: AbortSignal },
                callback: () => void,
            ) => {
                watchSignal = options.signal;
                watchChange = callback;
                return {
                    on: (event: string, listener: () => void) => {
                        if (event === 'error') watchError(listener);
                    },
                };
            },
        );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (scrollToDescriptor) {
        Object.defineProperty(
            HTMLElement.prototype,
            'scrollTo',
            scrollToDescriptor,
        );
    } else {
        delete (HTMLElement.prototype as any).scrollTo;
    }
    if (scrollIntoViewDescriptor) {
        Object.defineProperty(
            HTMLElement.prototype,
            'scrollIntoView',
            scrollIntoViewDescriptor,
        );
    } else {
        delete (HTMLElement.prototype as any).scrollIntoView;
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Markdown Preview window', () => {
    it('rejects a non-Markdown path and disables file actions', async () => {
        history.replaceState(null, '', '/?preview-file=%2Fdocs%2Fscript.exe');
        await render();
        expect(container.textContent).toContain('File not found');
        expect(h.load).not.toHaveBeenCalled();
        expect(button('Reload').disabled).toBe(true);
        expect(button('Open in Default App').disabled).toBe(true);
    });

    it('loads the file, watches it and renders the prepared HTML and language fonts', async () => {
        await render();
        expect(h.load).toHaveBeenCalledWith('/docs/start.md');
        expect(h.watch).toHaveBeenCalledWith(
            '/docs/start.md',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
            expect.any(Function),
        );
        expect(document.title).toBe('Open Worship - start.md');
        expect(
            container.querySelector('.app-markdown-body')?.innerHTML,
        ).toContain('Top link');
        expect(
            container
                .querySelector<HTMLElement>('.app-markdown-body')
                ?.style.getPropertyValue('--app-markdown-lang-font-families'),
        ).toBe('app-Xx-Face, app-Yy-Face');
        expect(h.mermaid).toHaveBeenCalledWith(
            expect.any(HTMLDivElement),
            [],
            expect.objectContaining({ isDark: false }),
        );
        await act(async () => button('Open in Default App').click());
        await act(async () => button('Reveal File').click());
        expect(h.openFile).toHaveBeenCalledWith('/docs/start.md');
        expect(h.reveal).toHaveBeenCalledWith('/docs/start.md');
    });

    it('routes web, local Markdown, other files and heading links safely', async () => {
        await render();
        await clickLink('https://example.org');
        expect(h.openExternalURL).toHaveBeenCalledWith('https://example.org');
        await clickLink('tool.exe');
        expect(h.reveal).toHaveBeenCalledWith('/docs/tool.exe');
        expect(h.openFile).not.toHaveBeenCalled();
        await clickLink('#top');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
            block: 'start',
        });
        await clickLink('next.md');
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/next.md',
        );
        expect(h.load).toHaveBeenLastCalledWith('/docs/next.md');
        expect(button('Back').disabled).toBe(false);
        await act(async () => button('Back').click());
        expect(h.load).toHaveBeenLastCalledWith('/docs/start.md');
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/start.md',
        );
    });

    it('debounces file saves and re-arms the watcher after reload', async () => {
        await render();
        const firstSignal = watchSignal;
        watchChange();
        watchChange();
        await act(async () => vi.advanceTimersByTime(499));
        expect(h.load).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(1));
        expect(h.load).toHaveBeenCalledTimes(2);
        expect(firstSignal.aborted).toBe(true);
        expect(watchSignal).not.toBe(firstSignal);
        expect(watchError).toHaveBeenCalledWith(expect.any(Function));
        await act(async () => button('Reload').click());
        expect(h.load).toHaveBeenCalledTimes(3);
    });

    it('only a link press is taken over; a right press on one does nothing', async () => {
        await render();
        const heading = container.querySelector('h1')!;
        const plainClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => heading.dispatchEvent(plainClick));
        // Not a link: the press is the page's own (text selection etc).
        expect(plainClick.defaultPrevented).toBe(false);
        expect(h.openExternalURL).not.toHaveBeenCalled();
        expect(h.reveal).not.toHaveBeenCalled();

        // A right press (auxclick, button 2) is stopped but opens nothing.
        await clickLink('https://example.org', 'auxclick', 2);
        expect(h.openExternalURL).not.toHaveBeenCalled();
        // A middle press is a press.
        await clickLink('https://example.org', 'auxclick', 1);
        expect(h.openExternalURL).toHaveBeenCalledWith('https://example.org');
    });

    it('a mermaid pass is told it is stale once the file re-renders', async () => {
        // A fresh result per read, as the real loader returns.
        h.load.mockImplementation(async () => ({
            status: 'ready',
            html: '<div data-mermaid-index="0"><pre><code>graph TD</code></pre></div>',
            mermaidSources: ['graph TD'],
        }));
        await render();
        expect(h.mermaid).toHaveBeenCalledTimes(1);
        expect(h.mermaid).toHaveBeenCalledWith(
            expect.any(HTMLDivElement),
            ['graph TD'],
            expect.objectContaining({ isDark: false }),
        );
        const firstOptions = h.mermaid.mock.calls[0][2] as {
            checkIsStale: () => boolean;
        };
        expect(firstOptions.checkIsStale()).toBe(false);
        await act(async () => button('Reload').click());
        expect(h.mermaid).toHaveBeenCalledTimes(2);
        expect(firstOptions.checkIsStale()).toBe(true);
        const secondOptions = h.mermaid.mock.calls[1][2] as {
            checkIsStale: () => boolean;
        };
        expect(secondOptions.checkIsStale()).toBe(false);
    });

    it('shows a read error and permits retry', async () => {
        h.load
            .mockResolvedValueOnce({ status: 'unreadable' })
            .mockResolvedValueOnce({
                status: 'ready',
                html: '<p>Recovered</p>',
                mermaidSources: [],
            });
        await render();
        expect(container.textContent).toContain('Cannot read this file');
        await act(async () => button('Reload').click());
        expect(container.querySelector('.app-markdown-body')?.textContent).toBe(
            'Recovered',
        );
    });
});

describe('Markdown Preview window — editing', () => {
    async function flush() {
        // The editor is a lazy chunk: its import resolves a tick later.
        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await Promise.resolve();
            });
        }
    }

    async function startEditing() {
        await act(async () => button('Edit').click());
        await flush();
        expect(h.editorProps).not.toBeNull();
    }

    async function type(text: string) {
        await act(async () => h.editorProps!.onDraftChange(text));
    }

    function warningText() {
        return (
            container.querySelector('.app-markdown-preview-warning')
                ?.textContent ?? ''
        );
    }

    function unsavedMark() {
        return container.querySelector('.app-markdown-preview-unsaved');
    }

    it('cannot edit a file it could not read', async () => {
        h.load.mockResolvedValueOnce({ status: 'unreadable' });
        await render();
        expect(button('Edit').disabled).toBe(true);
    });

    it('Edit opens the editor on the left of the page, read afresh from the file', async () => {
        await render();
        expect(container.querySelector('button[aria-label="Save"]')).toBeNull();
        expect(
            container.querySelector('.app-markdown-preview-editor-pane'),
        ).toBeNull();
        const article = container.querySelector('.app-markdown-body');
        await startEditing();
        expect(h.readText).toHaveBeenCalledWith('/docs/start.md');
        const panes = Array.from(
            container.querySelector('.app-markdown-preview-body')!.children,
        );
        expect(panes.map((pane) => pane.className)).toEqual([
            'app-markdown-preview-editor-pane',
            'app-markdown-preview-page',
        ]);
        expect(panes[0].querySelector('.stub-editor')?.textContent).toBe(
            '# Saved',
        );
        // The page stays, the same element, and is not drawn again for it.
        expect(panes[1].querySelector('.app-markdown-body')).toBe(article);
        expect(article?.innerHTML).toContain('Top link');
        expect(h.mermaid).toHaveBeenCalledTimes(1);
        expect(button('Hide Editor').className).toContain('active');
        // Nothing to save until something is typed.
        expect(button('Save').disabled).toBe(true);
        expect(unsavedMark()).toBeNull();
        // The editor read the file itself; the disk is not read again for it.
        expect(h.readText).toHaveBeenCalledTimes(1);
    });

    it('a typed change is marked unsaved, holds Back and Reload, and Save writes it', async () => {
        await render();
        await clickLink('next.md');
        await startEditing();
        expect(button('Back').disabled).toBe(false);
        await type('# Changed');
        expect(unsavedMark()?.getAttribute('title')).toBe('Unsaved changes');
        expect(document.title).toBe('Open Worship - next.md *');
        expect(button('Back').disabled).toBe(true);
        expect(button('Reload').disabled).toBe(true);
        expect(button('Save').disabled).toBe(false);
        // Typing back what was saved is nothing unsaved.
        await type('# Saved');
        expect(unsavedMark()).toBeNull();
        await type('# Changed');
        await act(async () => h.editorProps!.onSave());
        expect(h.save).toHaveBeenCalledWith('/docs/next.md', '# Changed');
        expect(unsavedMark()).toBeNull();
        expect(document.title).toBe('Open Worship - next.md');
        expect(button('Save').disabled).toBe(true);
        expect(button('Back').disabled).toBe(false);
    });

    it('a save that fails keeps the draft and says so', async () => {
        h.save.mockResolvedValueOnce(false);
        await render();
        await startEditing();
        await type('# Changed');
        await act(async () => button('Save').click());
        expect(h.save).toHaveBeenCalledTimes(1);
        expect(unsavedMark()).not.toBeNull();
        expect(warningText()).toContain('Error');
        // The bar is a note: it goes by itself.
        await act(async () => vi.advanceTimersByTime(6000));
        expect(warningText()).toBe('');
    });

    it('the page beside the editor draws the draft once typing pauses', async () => {
        await render();
        await startEditing();
        const loadCount = h.load.mock.calls.length;
        await type('# D');
        await type('# Draft');
        await act(async () => vi.advanceTimersByTime(499));
        expect(h.renderText).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(1));
        // One draw for the two keys, of the last text, from no disk read.
        expect(h.renderText).toHaveBeenCalledTimes(1);
        expect(h.renderText).toHaveBeenCalledWith('/docs/start.md', '# Draft');
        expect(h.load).toHaveBeenCalledTimes(loadCount);
        expect(container.querySelector('.drawn')?.textContent).toBe('# Draft');
    });

    it('Hide Editor keeps an unsaved draft on the page, and Discard puts the saved text back', async () => {
        await render();
        await startEditing();
        await type('# Draft');
        const loadCount = h.load.mock.calls.length;
        await act(async () => button('Hide Editor').click());
        // Drawn at once, not after the typing's wait.
        expect(h.renderText).toHaveBeenCalledWith('/docs/start.md', '# Draft');
        expect(h.load).toHaveBeenCalledTimes(loadCount);
        expect(container.querySelector('.stub-editor')).toBeNull();
        expect(container.querySelector('.drawn')?.textContent).toBe('# Draft');
        // Still unsaved, and still savable from the page.
        expect(unsavedMark()).not.toBeNull();
        expect(button('Save').disabled).toBe(false);
        // The wait that was running draws nothing over it.
        const renderCount = h.renderText.mock.calls.length;
        await act(async () => vi.advanceTimersByTime(500));
        expect(h.renderText).toHaveBeenCalledTimes(renderCount);

        // Back into the editor with the same draft, not the disk's text.
        await act(async () => button('Edit').click());
        await flush();
        expect(h.readText).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.stub-editor')?.textContent).toBe(
            '# Draft',
        );

        // Discard in the editor: it starts again from what is saved, and the
        // page beside it draws that at once.
        const mounts = h.editorMounts;
        await act(async () => button('Discard unsaved changes').click());
        await flush();
        expect(h.editorMounts).toBe(mounts + 1);
        expect(container.querySelector('.stub-editor')?.textContent).toBe(
            '# Saved',
        );
        expect(container.querySelector('.drawn')?.textContent).toBe('# Saved');
        expect(unsavedMark()).toBeNull();

        // Discard with the editor hidden: the file is read from disk again.
        await type('# Draft again');
        await act(async () => button('Hide Editor').click());
        expect(container.querySelector('.drawn')?.textContent).toBe(
            '# Draft again',
        );
        await act(async () => button('Discard unsaved changes').click());
        expect(h.load).toHaveBeenCalledTimes(loadCount + 1);
        expect(unsavedMark()).toBeNull();
        expect(container.querySelector('button[aria-label="Save"]')).toBeNull();
    });

    it('Ctrl+S saves wherever the focus is, once when the editor answered it', async () => {
        await render();
        await startEditing();
        await type('# Draft');
        const handledKey = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            cancelable: true,
        });
        // As the editor's own Ctrl+S leaves it.
        handledKey.preventDefault();
        await act(async () => globalThis.dispatchEvent(handledKey));
        expect(h.save).not.toHaveBeenCalled();
        const saveKey = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            cancelable: true,
        });
        await act(async () => globalThis.dispatchEvent(saveKey));
        expect(saveKey.defaultPrevented).toBe(true);
        expect(h.save).toHaveBeenCalledWith('/docs/start.md', '# Draft');
        expect(unsavedMark()).toBeNull();
    });

    it('a diagram that did not change is kept, not drawn again, as the draft is drawn', async () => {
        const diagramHtml =
            '<div data-mermaid-index="0"><pre><code>graph TD</code></pre></div>';
        h.load.mockResolvedValue({
            status: 'ready',
            html: diagramHtml,
            mermaidSources: ['graph TD'],
        });
        h.renderText.mockImplementation((_path: string, text: string) => ({
            status: 'ready',
            html: `<p class="drawn">${text}</p>${diagramHtml}`,
            mermaidSources: ['graph TD'],
        }));
        await render();
        // What the real drawing leaves in the page.
        const placeholder = container.querySelector<HTMLElement>(
            '[data-mermaid-index="0"]',
        )!;
        placeholder.innerHTML = '<svg id="drawn-diagram"></svg>';
        placeholder.classList.add('app-markdown-mermaid--rendered');
        await startEditing();
        await type('# Draft');
        await act(async () => vi.advanceTimersByTime(500));
        expect(container.querySelector('.drawn')?.textContent).toBe('# Draft');
        const kept = container.querySelector('[data-mermaid-index="0"]')!;
        expect(kept.querySelector('#drawn-diagram')).not.toBeNull();
        expect(kept.classList.contains('app-markdown-mermaid--rendered')).toBe(
            true,
        );
    });

    it('a clean draft is let go when the editor is hidden, and the page reads the disk', async () => {
        await render();
        await startEditing();
        const loadCount = h.load.mock.calls.length;
        await act(async () => button('Hide Editor').click());
        expect(h.load).toHaveBeenCalledTimes(loadCount + 1);
        expect(h.renderText).not.toHaveBeenCalled();
        expect(
            container.querySelector('.app-markdown-body')?.innerHTML,
        ).toContain('Top link');
        // The next Edit reads the file again.
        await startEditing();
        expect(h.readText).toHaveBeenCalledTimes(2);
    });

    it('unsaved words block another markdown file and closing the window', async () => {
        await render();
        await startEditing();
        await type('# Draft');
        // From the page beside the editor, and with the editor hidden.
        await clickLink('next.md');
        expect(warningText()).toContain(
            'Unsaved changes: Please save or discard them before reloading.',
        );
        await act(async () => button('Hide Editor').click());
        await clickLink('next.md');
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/start.md',
        );
        expect(warningText()).toContain(
            'Unsaved changes: Please save or discard them before reloading.',
        );

        const unload = new Event('beforeunload', { cancelable: true });
        await act(async () => globalThis.dispatchEvent(unload));
        expect(unload.defaultPrevented).toBe(true);
        expect(warningText()).toContain('Or attempt 3 times to force leaving.');

        // Ctrl+S saves with the editor hidden too, and the guard goes with it.
        const saveKey = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            cancelable: true,
        });
        await act(async () => globalThis.dispatchEvent(saveKey));
        expect(saveKey.defaultPrevented).toBe(true);
        expect(h.save).toHaveBeenCalledWith('/docs/start.md', '# Draft');
        const laterUnload = new Event('beforeunload', { cancelable: true });
        await act(async () => globalThis.dispatchEvent(laterUnload));
        expect(laterUnload.defaultPrevented).toBe(false);
        await clickLink('next.md');
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/next.md',
        );
    });

    it('a change on disk reaches an editor with nothing unsaved, never one with unsaved words', async () => {
        await render();
        await startEditing();
        const mounts = h.editorMounts;
        h.readText.mockResolvedValue({ status: 'ready', text: '# From disk' });
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));
        await flush();
        expect(h.editorMounts).toBe(mounts + 1);
        expect(container.querySelector('.stub-editor')?.textContent).toBe(
            '# From disk',
        );
        // The page beside it draws the same text, with no load of its own.
        expect(h.renderText).toHaveBeenLastCalledWith(
            '/docs/start.md',
            '# From disk',
        );
        expect(container.querySelector('.drawn')?.textContent).toBe(
            '# From disk',
        );
        expect(h.load).toHaveBeenCalledTimes(1);

        await type('# Mine');
        h.readText.mockResolvedValue({ status: 'ready', text: '# Newer' });
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));
        await flush();
        expect(h.editorMounts).toBe(mounts + 1);
        expect(unsavedMark()).not.toBeNull();
        await act(async () => h.editorProps!.onSave());
        expect(h.save).toHaveBeenLastCalledWith('/docs/start.md', '# Mine');
    });
});
