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

const h = vi.hoisted(() => ({
    load: vi.fn(),
    mermaid: vi.fn(),
    watch: vi.fn(),
    openExternalURL: vi.fn(),
    openFile: vi.fn(),
    reveal: vi.fn(),
    initAllLangCss: vi.fn(async () => [
        { fontFamily: 'Khmer' },
        { fontFamily: 'French' },
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
    toMarkdownPreviewTargetPath: (source: string, target: string) =>
        `${source.slice(0, source.lastIndexOf('/'))}/${target}`,
}));
vi.mock('./markdownMermaidHelpers', () => ({
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
        ).toBe('Khmer, French');
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
