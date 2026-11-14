// @vitest-environment jsdom
/**
 * The Markdown Preview window's hold on the page around a print, at the two
 * edges the other suites leave: an `afterprint` that no print of this window
 * asked for, and a second print main gets ready before the first one's paper
 * was ever made. The mock surface is `MarkdownPreviewAppComp.test.tsx`'s.
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
    mermaid: vi.fn(),
    watch: vi.fn(),
    print: vi.fn(),
    initAllLangCss: vi.fn(),
    decorate: vi.fn(),
    findRef: vi.fn(),
    openWindow: vi.fn(),
    readAppendix: vi.fn(),
    handleError: vi.fn(),
    requestPanel: vi.fn(),
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
    printHtmlText: h.print,
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
vi.mock('./MarkdownPreviewEditorComp', async () => {
    const react = await import('react');
    return {
        default: function StubEditorComp(props: EditorPropsType) {
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
vi.mock('../scrolling/ScrollToTopComp', () => ({
    default: () => null,
}));
vi.mock('./markdownPreviewReferenceHelpers', () => ({
    decorateMarkdownReferences: h.decorate,
    findMarkdownRef: h.findRef,
    openResourceFileWindow: h.openWindow,
}));
vi.mock('../location-name-lookup/detailPanelRequestHelpers', () => ({
    requestDetailPanelInReader: h.requestPanel,
}));
vi.mock('./markdownPrintAppendixReadHelpers', () => ({
    readPrintAppendix: h.readAppendix,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));

import MarkdownPreviewAppComp from './MarkdownPreviewAppComp';

type HolderType = { appPreparePrint?: () => Promise<boolean> };

let root: Root;
let container: HTMLDivElement;
let watchChange: () => void;
let scrollToDescriptor: PropertyDescriptor | undefined;

function genPage(className: string, words: string) {
    return {
        status: 'ready',
        html: `<p class="${className}">${words}</p>`,
        mermaidSources: [],
    };
}

function findWords(className: string) {
    return container.querySelector(`.${className}`)?.textContent ?? null;
}

async function render() {
    await act(async () => root.render(createElement(MarkdownPreviewAppComp)));
}

// What main calls before it makes the paper (`registerPrintPreparation`).
// Started in one act and waited for in the next: a print that draws the page
// waits for that render, which an act flushes only once its callback is done.
async function prepareFromMain() {
    const preparePrint = (globalThis as HolderType).appPreparePrint;
    expect(preparePrint).toBeTypeOf('function');
    let preparing: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
        preparing = preparePrint!();
    });
    let isReady: boolean | null = null;
    await act(async () => {
        isReady = await preparing;
    });
    return isReady;
}

// An editor beside the window saves the file: the watcher's debounce, then
// the reload.
async function saveBeside(className: string, words: string) {
    h.load.mockResolvedValue(genPage(className, words));
    watchChange();
    await act(async () => vi.advanceTimersByTime(500));
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
    h.load.mockResolvedValue(genPage('first', 'First page'));
    h.readText.mockResolvedValue({ status: 'ready', text: '# Saved' });
    h.renderText.mockImplementation((_path: string, text: string) => ({
        status: 'ready',
        html: `<p class="drawn">${text}</p>`,
        mermaidSources: [],
    }));
    h.save.mockResolvedValue(true);
    h.mermaid.mockResolvedValue(undefined);
    h.initAllLangCss.mockResolvedValue([]);
    h.decorate.mockResolvedValue(0);
    h.findRef.mockReturnValue(null);
    h.openWindow.mockResolvedValue(undefined);
    h.watch.mockImplementation(
        (_path: string, _options: unknown, callback: () => void) => {
            watchChange = callback;
            return { on: () => {} };
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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Markdown Preview window — the page around a print', () => {
    test('an afterprint no print of this window asked for holds nothing and lets nothing go', async () => {
        await render();
        expect(findWords('first')).toBe('First page');

        await act(async () => {
            globalThis.dispatchEvent(new Event('afterprint'));
        });
        expect(findWords('first')).toBe('First page');
        expect(h.print).not.toHaveBeenCalled();

        // Nothing is held: a save beside it is drawn as soon as it is read.
        await saveBeside('beside', 'Saved beside');
        expect(findWords('beside')).toBe('Saved beside');
        expect(findWords('first')).toBeNull();
    });

    test('a second print before the first one is made keeps the hold, and lets go 10 seconds after ITS ready', async () => {
        await render();
        await expect(prepareFromMain()).resolves.toBe(true);

        // Held by the first print: the save beside waits.
        await saveBeside('one', 'Saved once');
        expect(findWords('one')).toBeNull();
        expect(findWords('first')).toBe('First page');
        await act(async () => vi.advanceTimersByTime(4_000));

        // Main gets a second print ready before the first one's paper: the
        // page that waited is the one it draws for paper.
        await expect(prepareFromMain()).resolves.toBe(true);
        expect(findWords('one')).toBe('Saved once');

        // Saved again while the second print holds the page.
        await saveBeside('two', 'Saved twice');
        expect(findWords('two')).toBeNull();

        // The first print's 10 seconds are up: its release was called off,
        // so the page is still held.
        await act(async () => vi.advanceTimersByTime(5_500));
        expect(findWords('two')).toBeNull();
        expect(findWords('one')).toBe('Saved once');

        // The second's 10 seconds are up: the save it held is drawn.
        await act(async () => vi.advanceTimersByTime(4_000));
        expect(findWords('two')).toBe('Saved twice');
        expect(h.print).not.toHaveBeenCalled();
    });
});
