// @vitest-environment jsdom
/**
 * The Markdown Preview window's editing at the edges the main suite leaves:
 * a Save asked for with nothing unsaved or while one is writing, an Edit
 * whose read fails, and an Edit whose read is still on its way when a link
 * opens another file. The mock surface is `MarkdownPreviewAppComp.test.tsx`'s.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
    mermaid: vi.fn(),
    watch: vi.fn(),
    initAllLangCss: vi.fn(),
    decorate: vi.fn(),
    findRef: vi.fn(),
    openWindow: vi.fn(),
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
    keepThemeWhilePrinting: vi.fn(),
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal File',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    printHtmlText: vi.fn(),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        windowTitle: 'Open Worship',
        fileUtils: { watch: h.watch },
        systemUtils: { openFile: vi.fn(), isMac: false },
        browserUtils: { openExternalURL: vi.fn() },
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
            return react.createElement(
                'div',
                { className: 'stub-editor' },
                props.text,
            );
        },
    };
});
vi.mock('./markdownMermaidHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./markdownMermaidHelpers')>()),
    renderMermaidDiagrams: h.mermaid,
}));
vi.mock('./MarkdownPreviewChatbotButtonComp', () => ({
    default: () => null,
}));
// Tested in `ScrollToTopComp.test.tsx`.
vi.mock('../scrolling/ScrollToTopComp', () => ({
    default: () => null,
}));
// What makes the links and what a press on one opens have tests of their own
// (`markdownPreviewReferenceHelpers.test.ts`); here, only where a link opens.
vi.mock('./markdownPreviewReferenceHelpers', () => ({
    decorateMarkdownReferences: h.decorate,
    findMarkdownRef: h.findRef,
    openResourceFileWindow: h.openWindow,
}));

import MarkdownPreviewAppComp from './MarkdownPreviewAppComp';

let root: Root;
let container: HTMLDivElement;
let scrollToDescriptor: PropertyDescriptor | undefined;

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

async function flush() {
    // The editor is a lazy chunk: its import resolves a tick later.
    for (let i = 0; i < 3; i++) {
        await act(async () => {
            await Promise.resolve();
        });
    }
}

function genDeferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    scrollToDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'scrollTo',
    );
    HTMLElement.prototype.scrollTo = vi.fn();
    history.replaceState(null, '', '/?preview-file=%2Fdocs%2Fstart.md');
    h.load.mockResolvedValue({
        status: 'ready',
        html: '<h1>Top</h1><a href="next.md">Next</a>',
        mermaidSources: [],
    });
    h.readText.mockResolvedValue({ status: 'ready', text: '# Saved' });
    h.renderText.mockImplementation((_path: string, text: string) => ({
        status: 'ready',
        html: `<p class="drawn">${text}</p>`,
        mermaidSources: [],
    }));
    h.save.mockResolvedValue(true);
    h.mermaid.mockResolvedValue(undefined);
    h.initAllLangCss.mockResolvedValue([]);
    h.watch.mockImplementation(() => ({ on: () => {} }));
    h.decorate.mockReset().mockResolvedValue(0);
    h.findRef.mockReset().mockReturnValue(null);
    h.openWindow.mockReset().mockResolvedValue(undefined);
    h.editorProps = null;
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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Markdown Preview window — Save', () => {
    test('a Save the editor asks for with nothing unsaved writes nothing', async () => {
        await render();
        await act(async () => button('Edit').click());
        await flush();
        expect(h.editorProps).not.toBeNull();
        await act(async () => h.editorProps!.onSave());
        expect(h.save).not.toHaveBeenCalled();
    });

    test('a second Save while the first is writing writes nothing more', async () => {
        const writing = genDeferred<boolean>();
        h.save.mockReturnValueOnce(writing.promise);
        await render();
        await act(async () => button('Edit').click());
        await flush();
        await act(async () => h.editorProps!.onDraftChange('# Changed'));
        await act(async () => {
            void h.editorProps!.onSave();
            void h.editorProps!.onSave();
        });
        expect(h.save).toHaveBeenCalledTimes(1);
        expect(h.save).toHaveBeenCalledWith('/docs/start.md', '# Changed');
        await act(async () => writing.resolve(true));
        expect(
            container.querySelector('.app-markdown-preview-unsaved'),
        ).toBeNull();
    });
});

describe('Markdown Preview window — Edit', () => {
    test('an Edit whose read fails says the file cannot be read, and opens no editor', async () => {
        h.readText.mockResolvedValueOnce({ status: 'unreadable' });
        await render();
        await act(async () => button('Edit').click());
        await flush();
        expect(h.readText).toHaveBeenCalledWith('/docs/start.md');
        expect(container.textContent).toContain('Cannot read this file');
        expect(container.querySelector('.stub-editor')).toBeNull();
        expect(button('Edit').className).not.toContain('active');
    });

    // 2026-11-11, the user: _own window for every type_ -- a linked file
    // opens in a window of its own and this one keeps its file, so an Edit
    // read still on its way is this file's and becomes its editor.
    test('an Edit read still on its way when a link opens another file opens this file', async () => {
        const reading = genDeferred<{ status: string; text: string }>();
        h.readText.mockReturnValueOnce(reading.promise);
        await render();
        await act(async () => button('Edit').click());
        // The person presses a link to another file before the read is back.
        const anchor =
            container.querySelector<HTMLAnchorElement>('a[href="next.md"]')!;
        await act(async () => {
            anchor.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });
        await flush();
        expect(h.openWindow).toHaveBeenCalledWith('/docs/next.md');
        expect(h.load).toHaveBeenCalledTimes(1);
        expect(h.load).toHaveBeenLastCalledWith('/docs/start.md');
        expect(h.readText).toHaveBeenCalledWith('/docs/start.md');
        await act(async () =>
            reading.resolve({ status: 'ready', text: '# Old' }),
        );
        await flush();
        expect(container.querySelector('.stub-editor')?.textContent).toBe(
            '# Old',
        );
        expect(button('Hide Editor').className).toContain('active');
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/start.md',
        );
    });
});
