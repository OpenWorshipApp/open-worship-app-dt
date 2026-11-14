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
    pageRef: { current: HTMLElement | null };
    articleRef: { current: HTMLElement | null };
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
    print: vi.fn(),
    theme: 'light' as 'light' | 'dark',
    keepTheme: vi.fn(),
    initAllLangCss: vi.fn(async () => [
        { fontFamily: 'app-Xx-Face' },
        { fontFamily: 'app-Yy-Face' },
    ]),
    effectError: vi.fn(),
    decorate: vi.fn(),
    findRef: vi.fn(),
    openWindow: vi.fn(),
    requestPanel: vi.fn(),
    readAppendix: vi.fn(),
    handleError: vi.fn(),
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
                // The real hook reports a rejection the same way.
                method(context).catch(h.effectError);
            }, deps),
    };
});
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    initAllLangCss: h.initAllLangCss,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
    keepThemeWhilePrinting: h.keepTheme,
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal File',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.reveal,
    printHtmlText: h.print,
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
// The toolbar's 🤖 has tests of its own; here it would ask main whether AI
// is on, through an appProvider this stand-in leaves out.
vi.mock('./MarkdownPreviewChatbotButtonComp', () => ({
    default: () => null,
}));
// The arrow back to the top has tests of its own (`ScrollToTopComp.test.tsx`);
// here, only where it is put.
vi.mock('../scrolling/ScrollToTopComp', async () => {
    const react = await import('react');
    return {
        default: (props: { style?: { right?: string } }) => {
            return react.createElement('i', {
                className: 'stub-to-top',
                'data-right': props.style?.right,
            });
        },
    };
});
// What makes the links and what a press on one opens have tests of their own
// (`markdownPreviewReferenceHelpers.test.ts`); here, only when they are asked.
vi.mock('./markdownPreviewReferenceHelpers', () => ({
    decorateMarkdownReferences: h.decorate,
    findMarkdownRef: h.findRef,
    openResourceFileWindow: h.openWindow,
}));
vi.mock('../location-name-lookup/detailPanelRequestHelpers', () => ({
    requestDetailPanelInReader: h.requestPanel,
}));
// Reading the Bible text and the records has tests of its own
// (`markdownPrintAppendixReadHelpers.test.ts`); here, only when it is asked.
vi.mock('./markdownPrintAppendixReadHelpers', () => ({
    readPrintAppendix: h.readAppendix,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: h.handleError,
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
    h.print.mockReset();
    h.theme = 'light';
    h.keepTheme.mockReset();
    h.initAllLangCss.mockClear();
    h.decorate.mockReset().mockResolvedValue(0);
    h.findRef.mockReset().mockReturnValue(null);
    h.openWindow.mockReset().mockResolvedValue(undefined);
    h.requestPanel.mockReset();
    h.readAppendix.mockReset();
    h.handleError.mockReset();
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
        expect(button('Print').disabled).toBe(true);
    });

    it('Print prints this window once the page is drawn, never before', async () => {
        let resolveLoad!: (value: unknown) => void;
        h.load.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveLoad = resolve;
            }),
        );
        await render();
        expect(button('Print').disabled).toBe(true);
        await act(async () =>
            resolveLoad({
                status: 'ready',
                html: '<p>Page</p>',
                mermaidSources: [],
            }),
        );
        expect(button('Print').disabled).toBe(false);
        await act(async () => button('Print').click());
        expect(h.print).toHaveBeenCalledTimes(1);
    });

    it('Print waits while the file cannot be read', async () => {
        h.load.mockResolvedValueOnce({ status: 'unreadable' });
        await render();
        expect(button('Print').disabled).toBe(true);
    });

    describe('getting the page ready for paper, which main asks before every print', () => {
        const DIAGRAM_PAGE = {
            status: 'ready',
            html: '<div class="app-markdown-mermaid" data-mermaid-index="0"><pre><code>graph TD</code></pre></div>',
            mermaidSources: ['graph TD'],
        };
        type HolderType = { appPreparePrint?: () => Promise<void> };

        function getPreparePrint() {
            const preparePrint = (globalThis as HolderType).appPreparePrint;
            expect(preparePrint).toBeTypeOf('function');
            return preparePrint!;
        }

        // Mermaid, drawing every placeholder in `element` with `picture`.
        function genDrawing(picture: string) {
            return async (element: HTMLElement) => {
                for (const placeholder of element.querySelectorAll(
                    '[data-mermaid-index]',
                )) {
                    placeholder.innerHTML = picture;
                    placeholder.classList.add('app-markdown-mermaid--rendered');
                }
            };
        }

        it('a dark page waits for its diagrams, draws them light beside their own for the paper, and drops them after the print', async () => {
            h.theme = 'dark';
            h.load.mockResolvedValue(DIAGRAM_PAGE);
            let finishScreenDrawing = () => {};
            h.mermaid.mockImplementationOnce((element: HTMLElement) => {
                return new Promise<void>((resolve) => {
                    finishScreenDrawing = () => {
                        void genDrawing('<svg class="dark"></svg>')(element);
                        resolve();
                    };
                });
            });
            await render();
            // The window keeps its theme while printing.
            expect(h.keepTheme).toHaveBeenCalled();
            const article =
                container.querySelector<HTMLElement>('.app-markdown-body')!;

            h.mermaid.mockImplementationOnce(
                genDrawing('<svg class="light"></svg>'),
            );
            let isReady = false;
            let preparing: Promise<void> = Promise.resolve();
            await act(async () => {
                preparing = getPreparePrint()().then(() => {
                    isReady = true;
                });
            });
            // The diagrams on screen are still being drawn.
            expect(isReady).toBe(false);
            expect(h.mermaid).toHaveBeenCalledTimes(1);
            expect(button('Print').disabled).toBe(true);

            await act(async () => {
                finishScreenDrawing();
                await preparing;
            });
            expect(isReady).toBe(true);
            expect(h.mermaid).toHaveBeenCalledTimes(2);
            expect(h.mermaid.mock.calls[1][2]).toEqual(
                expect.objectContaining({ isDark: false }),
            );
            const [screenDiagram, paperDiagram] = article.querySelectorAll(
                '.app-markdown-mermaid',
            );
            expect(screenDiagram.innerHTML).toBe('<svg class="dark"></svg>');
            expect(
                screenDiagram.classList.contains(
                    'app-markdown-mermaid--has-print',
                ),
            ).toBe(true);
            expect(paperDiagram.innerHTML).toBe('<svg class="light"></svg>');
            expect(
                paperDiagram.classList.contains('app-markdown-mermaid--print'),
            ).toBe(true);
            expect(button('Print').disabled).toBe(false);

            globalThis.dispatchEvent(new Event('afterprint'));
            expect(
                article.querySelectorAll('.app-markdown-mermaid'),
            ).toHaveLength(1);
        });

        it('Print gets a dark page ready itself, and only then prints', async () => {
            h.theme = 'dark';
            h.load.mockResolvedValue(DIAGRAM_PAGE);
            h.mermaid
                .mockImplementationOnce(genDrawing('<svg class="dark"></svg>'))
                .mockImplementationOnce(
                    genDrawing('<svg class="light"></svg>'),
                );
            await render();
            let paperAtPrint: string | null = null;
            h.print.mockImplementation(() => {
                paperAtPrint =
                    container.querySelector('.app-markdown-mermaid--print')
                        ?.innerHTML ?? null;
            });

            await act(async () => button('Print').click());

            expect(h.print).toHaveBeenCalledTimes(1);
            expect(paperAtPrint).toBe('<svg class="light"></svg>');
        });

        it('a light page is ready once its diagrams are drawn, with nothing drawn again', async () => {
            h.load.mockResolvedValue(DIAGRAM_PAGE);
            h.mermaid.mockImplementation(genDrawing('<svg></svg>'));
            await render();

            await act(async () => {
                await getPreparePrint()();
            });

            expect(h.mermaid).toHaveBeenCalledTimes(1);
            expect(
                container.querySelector('.app-markdown-mermaid--print'),
            ).toBeNull();
        });

        it('a print asked before the languages faces are read waits for its diagrams, never putting their source on paper', async () => {
            let resolveLangs: (
                list: { fontFamily: string }[],
            ) => void = () => {};
            h.initAllLangCss.mockImplementationOnce(() => {
                return new Promise((resolve) => {
                    resolveLangs = resolve;
                });
            });
            h.load.mockResolvedValue(DIAGRAM_PAGE);
            h.mermaid.mockImplementation(genDrawing('<svg></svg>'));
            await render();
            const article =
                container.querySelector<HTMLElement>('.app-markdown-body')!;
            let paperAtReady: string | null = null;
            let preparing: Promise<void> = Promise.resolve();
            await act(async () => {
                preparing = getPreparePrint()().then(() => {
                    paperAtReady = article.innerHTML;
                });
            });
            // Opened a moment ago: its diagrams still wait for the faces.
            expect(paperAtReady).toBeNull();
            expect(h.mermaid).not.toHaveBeenCalled();

            // The faces are known: the page is drawn in them (this act's
            // render), and only then is the print ready.
            await act(async () =>
                resolveLangs([{ fontFamily: 'app-Xx-Face' }]),
            );
            await act(async () => {
                await preparing;
            });
            expect(h.mermaid).toHaveBeenCalledTimes(1);
            expect(paperAtReady).toContain('<svg></svg>');
            expect(paperAtReady).not.toContain('graph TD');
        });

        it('faces never read hold a print of its diagrams 10 seconds at most', async () => {
            h.initAllLangCss.mockImplementationOnce(() => {
                return new Promise(() => {});
            });
            h.load.mockResolvedValue(DIAGRAM_PAGE);
            await render();
            await act(async () => button('Print').click());
            await act(async () => vi.advanceTimersByTime(9_999));
            expect(h.print).not.toHaveBeenCalled();
            await act(async () => vi.advanceTimersByTime(1));
            expect(h.print).toHaveBeenCalledTimes(1);
        });

        it('a page with no diagrams prints at once, its faces read or not', async () => {
            h.initAllLangCss.mockImplementationOnce(() => {
                return new Promise(() => {});
            });
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p>Words</p>',
                mermaidSources: [],
            });
            await render();
            await act(async () => button('Print').click());
            expect(h.print).toHaveBeenCalledTimes(1);
        });

        it('a page drawn again while it waits -- its theme switched -- is waited for in its turn', async () => {
            h.theme = 'dark';
            h.load.mockImplementation(async () => ({ ...DIAGRAM_PAGE }));
            let finishFirstDrawing = () => {};
            h.mermaid.mockImplementationOnce(() => {
                return new Promise<void>((resolve) => {
                    finishFirstDrawing = resolve;
                });
            });
            await render();
            let isReady = false;
            let preparing: Promise<void> = Promise.resolve();
            await act(async () => {
                preparing = getPreparePrint()().then(() => {
                    isReady = true;
                });
            });

            // The system turns the window light: its diagrams are drawn
            // again, which no print holds back.
            let finishSecondDrawing = () => {};
            h.mermaid.mockImplementationOnce((element: HTMLElement) => {
                return new Promise<void>((resolve) => {
                    finishSecondDrawing = () => {
                        void genDrawing('<svg class="light"></svg>')(element);
                        resolve();
                    };
                });
            });
            h.theme = 'light';
            await render();
            await act(async () => finishFirstDrawing());
            // The drawing it first waited for is done; the page's is not.
            expect(isReady).toBe(false);

            await act(async () => {
                finishSecondDrawing();
                await preparing;
            });
            expect(isReady).toBe(true);
            // Light now: nothing more is drawn for the paper.
            expect(h.mermaid).toHaveBeenCalledTimes(2);
            expect(
                container.querySelector('.app-markdown-mermaid--print'),
            ).toBeNull();
        });

        it('a save beside it while it is got ready waits for the paper, then is drawn', async () => {
            h.theme = 'dark';
            h.load.mockResolvedValueOnce(DIAGRAM_PAGE).mockResolvedValue({
                status: 'ready',
                html: '<p class="saved-beside">Saved beside</p>',
                mermaidSources: [],
            });
            let finishScreenDrawing = () => {};
            h.mermaid.mockImplementationOnce((element: HTMLElement) => {
                return new Promise<void>((resolve) => {
                    finishScreenDrawing = () => {
                        void genDrawing('<svg class="dark"></svg>')(element);
                        resolve();
                    };
                });
            });
            await render();
            let isReady = false;
            let preparing: Promise<void> = Promise.resolve();
            await act(async () => {
                preparing = getPreparePrint()().then(() => {
                    isReady = true;
                });
            });

            // Saved in an editor beside it while its diagrams draw.
            watchChange();
            await act(async () => vi.advanceTimersByTime(500));
            expect(h.load).toHaveBeenCalledTimes(2);
            h.mermaid.mockImplementationOnce(
                genDrawing('<svg class="light"></svg>'),
            );
            await act(async () => {
                finishScreenDrawing();
                await preparing;
            });
            expect(isReady).toBe(true);
            // The page asked for is the one ready for paper, its light
            // picture beside its own.
            expect(container.querySelector('.saved-beside')).toBeNull();
            expect(
                container.querySelector('.app-markdown-mermaid--print')
                    ?.innerHTML,
            ).toBe('<svg class="light"></svg>');

            // The paper is made: the page saved beside it is drawn.
            await act(async () => {
                globalThis.dispatchEvent(new Event('afterprint'));
            });
            expect(container.querySelector('.saved-beside')?.textContent).toBe(
                'Saved beside',
            );
            expect(container.querySelector('.app-markdown-mermaid')).toBeNull();
        });

        it('a print main never makes lets the page go 10 seconds after it was ready', async () => {
            await render();
            await act(async () => {
                await getPreparePrint()();
            });
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p class="saved-beside">Saved beside</p>',
                mermaidSources: [],
            });
            watchChange();
            await act(async () => vi.advanceTimersByTime(500));
            expect(container.querySelector('.saved-beside')).toBeNull();

            await act(async () => vi.advanceTimersByTime(9_499));
            expect(container.querySelector('.saved-beside')).toBeNull();
            await act(async () => vi.advanceTimersByTime(1));
            expect(container.querySelector('.saved-beside')?.textContent).toBe(
                'Saved beside',
            );
        });

        it('a picture far down, not fetched yet, is fetched for the paper and waited for', async () => {
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p>Words</p><p><img src="far-down.png" loading="lazy" alt="Far down"></p>',
                mermaidSources: [],
            });
            await render();
            const image = container.querySelector('img')!;
            expect(image.complete).toBe(false);

            await act(async () => button('Print').click());
            for (let round = 0; round < 3; round++) {
                await act(async () => {
                    await vi.dynamicImportSettled();
                });
            }
            expect(image.getAttribute('loading')).toBe('eager');
            expect(h.print).not.toHaveBeenCalled();

            await act(async () => {
                image.dispatchEvent(new Event('load'));
            });
            expect(h.print).toHaveBeenCalledTimes(1);
        });

        it('a picture that never comes holds the print 10 seconds at most', async () => {
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p><img src="never.png" loading="lazy" alt="Never"></p>',
                mermaidSources: [],
            });
            await render();
            await act(async () => button('Print').click());
            await act(async () => vi.advanceTimersByTime(9_999));
            expect(h.print).not.toHaveBeenCalled();
            await act(async () => vi.advanceTimersByTime(1));
            expect(h.print).toHaveBeenCalledTimes(1);
        });

        it('a page not drawn yet is printed as it is, and the preparation leaves with the window', async () => {
            h.load.mockReturnValueOnce(new Promise(() => {}));
            await render();

            await act(async () => {
                await getPreparePrint()();
            });
            expect(h.mermaid).not.toHaveBeenCalled();

            await act(async () => root.unmount());
            expect((globalThis as HolderType).appPreparePrint).toBeUndefined();
            root = createRoot(container);
        });
    });

    // 2026-11-12, the user: _when print if there bible verses and names, let
    // ask user do they want to print those information. if yes then append
    // to the last page with list of bible and name/location detail_.
    describe('a page naming verses, people or places asks before it prints', () => {
        const REF_PAGE = {
            status: 'ready',
            html:
                '<p><span class="app-markdown-ref">John 3:16</span> and ' +
                '<span class="app-markdown-ref">Moses</span> and ' +
                '<span class="app-markdown-ref">MAT.18.pdf</span></p>',
            mermaidSources: [],
        };
        const APPENDIX = {
            verses: [
                {
                    title: 'John 3:16',
                    bibleKey: 'KJV',
                    chapters: [
                        {
                            title: null,
                            verses: [{ verse: '16', text: 'For God so loved' }],
                        },
                    ],
                    isCut: false,
                },
            ],
            names: [
                {
                    name: 'Moses',
                    kjvName: null,
                    summary: 'A prophet',
                    description: '',
                    modernIdentification: '',
                },
            ],
            places: [],
            leftOutCount: 0,
        };
        type HolderType = { appPreparePrint?: () => Promise<boolean> };

        function getPreparePrint() {
            const preparePrint = (globalThis as HolderType).appPreparePrint;
            expect(preparePrint).toBeTypeOf('function');
            return preparePrint!;
        }

        function getDialog() {
            return container.querySelector('[role="dialog"]');
        }

        function dialogButton(label: string) {
            const element = [
                ...container.querySelectorAll<HTMLButtonElement>(
                    '[role="dialog"] button',
                ),
            ].find((one) => {
                return one.textContent === label;
            });
            expect(element).toBeDefined();
            return element!;
        }

        // The question's module comes in by a dynamic import.
        async function settle() {
            for (let round = 0; round < 5; round++) {
                await act(async () => {
                    await vi.dynamicImportSettled();
                });
            }
        }

        async function renderRefPage() {
            h.load.mockResolvedValue(REF_PAGE);
            await render();
            const [verse, moses, file] =
                container.querySelectorAll('.app-markdown-ref');
            h.findRef.mockImplementation((element: Element) => {
                if (element === verse) {
                    return {
                        kind: 'panel',
                        request: {
                            kind: 'verse',
                            target: 'JHN 3:16',
                            name: 'John 3:16',
                        },
                    };
                }
                if (element === moses) {
                    return {
                        kind: 'panel',
                        request: {
                            kind: 'name',
                            target: 'moses_1',
                            name: 'Moses',
                        },
                    };
                }
                return element === file
                    ? { kind: 'file', filePath: '/res/MAT.18.pdf' }
                    : null;
            });
        }

        it('a print pressed while the page is still being linked waits for its links, then asks', async () => {
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p>John 3:16</p>',
                mermaidSources: [],
            });
            let finishLinking = () => {};
            h.decorate.mockImplementation((article: HTMLElement) => {
                return new Promise<number>((resolve) => {
                    finishLinking = () => {
                        article
                            .querySelector('p')!
                            .classList.add('app-markdown-ref');
                        resolve(1);
                    };
                });
            });
            h.findRef.mockReturnValue({
                kind: 'panel',
                request: {
                    kind: 'verse',
                    target: 'JHN 3:16',
                    name: 'John 3:16',
                },
            });
            await render();
            await act(async () => button('Print').click());
            await settle();
            // Neither printed without the question nor asked yet.
            expect(h.print).not.toHaveBeenCalled();
            expect(getDialog()).toBeNull();

            await act(async () => finishLinking());
            await settle();
            expect(getDialog()).not.toBeNull();
            expect(
                container.querySelector('#app-markdown-print-ask-counts')
                    ?.textContent,
            ).toBe('Verses: 1');
            await act(async () => dialogButton('Cancel').click());
            await settle();
            expect(h.print).not.toHaveBeenCalled();
        });

        it('links that never come are waited for 10 seconds, then the page prints as it is', async () => {
            h.decorate.mockReturnValue(new Promise(() => {}));
            await render();
            await act(async () => button('Print').click());
            await settle();
            expect(h.print).not.toHaveBeenCalled();

            await act(async () => vi.advanceTimersByTime(10_000));
            await settle();
            expect(getDialog()).toBeNull();
            expect(h.print).toHaveBeenCalledTimes(1);
        });

        it('a page linking none prints at once, reading nothing', async () => {
            await render();
            await act(async () => button('Print').click());
            await settle();

            expect(getDialog()).toBeNull();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(h.readAppendix).not.toHaveBeenCalled();
        });

        it('says what the page names, and Cancel prints nothing', async () => {
            await renderRefPage();
            await act(async () => button('Print').click());
            await settle();

            expect(getDialog()).not.toBeNull();
            // A file is no verse, person or place.
            expect(
                container.querySelector('#app-markdown-print-ask-counts')
                    ?.textContent,
            ).toBe('Verses: 1 · Names: 1');
            expect(button('Print').disabled).toBe(true);

            await act(async () => dialogButton('Cancel').click());
            await settle();
            expect(getDialog()).toBeNull();
            expect(h.print).not.toHaveBeenCalled();
            expect(h.readAppendix).not.toHaveBeenCalled();
            expect(button('Print').disabled).toBe(false);
        });

        it('File > Print asks the same, and its Cancel tells main not to print', async () => {
            await renderRefPage();
            let answer: boolean | null = null;
            await act(async () => {
                void getPreparePrint()().then((value) => {
                    answer = value;
                });
            });
            await settle();
            expect(getDialog()).not.toBeNull();

            // Esc is Cancel too.
            await act(async () => {
                globalThis.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'Escape' }),
                );
            });
            await settle();
            expect(answer).toBe(false);
            expect(getDialog()).toBeNull();
        });

        it('Print Page Only prints the page alone, reading nothing', async () => {
            await renderRefPage();
            await act(async () => button('Print').click());
            await settle();
            await act(async () => dialogButton('Print Page Only').click());
            await settle();

            expect(h.print).toHaveBeenCalledTimes(1);
            expect(h.readAppendix).not.toHaveBeenCalled();
            expect(
                container.querySelector('.app-markdown-print-appendix'),
            ).toBeNull();
        });

        it('Add and Print reads the details, puts them after the page, prints, and main is not asked twice', async () => {
            await renderRefPage();
            let finishReading = (_value: unknown) => {};
            h.readAppendix.mockReturnValueOnce(
                new Promise((resolve) => {
                    finishReading = resolve;
                }),
            );
            let appendixAtPrint: string | null = null;
            h.print.mockImplementation(() => {
                appendixAtPrint =
                    container.querySelector('.app-markdown-print-appendix')
                        ?.textContent ?? null;
            });
            await act(async () => button('Print').click());
            await settle();
            await act(async () => dialogButton('Add and Print').click());
            await settle();

            // The question waits while they are read.
            expect(h.readAppendix).toHaveBeenCalledExactlyOnceWith({
                verses: [
                    { kind: 'verse', target: 'JHN 3:16', name: 'John 3:16' },
                ],
                names: [{ kind: 'name', target: 'moses_1', name: 'Moses' }],
                places: [],
            });
            expect(
                container
                    .querySelector('[role="dialog"]')
                    ?.getAttribute('aria-busy'),
            ).toBe('true');
            expect(h.print).not.toHaveBeenCalled();

            await act(async () => finishReading(APPENDIX));
            await settle();
            expect(getDialog()).toBeNull();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(appendixAtPrint).toBe(
                'Verses' +
                    'John 3:16 (KJV)16 For God so loved' +
                    'Names' +
                    'Moses — A prophet',
            );
            // After the page's last line, in the page.
            const article =
                container.querySelector<HTMLElement>('.app-markdown-body')!;
            expect(article.lastElementChild?.className).toBe(
                'app-markdown-print-appendix',
            );

            // Main asks as it prints: the page is ready, and asks nothing.
            let answer: boolean | null = null;
            await act(async () => {
                answer = await getPreparePrint()();
            });
            expect(answer).toBe(true);
            expect(getDialog()).toBeNull();

            globalThis.dispatchEvent(new Event('afterprint'));
            expect(
                container.querySelector('.app-markdown-print-appendix'),
            ).toBeNull();

            // The next print asks again.
            await act(async () => {
                void getPreparePrint()();
            });
            await settle();
            expect(getDialog()).not.toBeNull();
            await act(async () => dialogButton('Cancel').click());
            await settle();
        });

        it('details that cannot be read: the page prints without them', async () => {
            await renderRefPage();
            const error = new Error('no dataset');
            h.readAppendix.mockRejectedValueOnce(error);
            await act(async () => button('Print').click());
            await settle();
            await act(async () => dialogButton('Add and Print').click());
            await settle();

            expect(h.handleError).toHaveBeenCalledWith(error);
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(
                container.querySelector('.app-markdown-print-appendix'),
            ).toBeNull();
        });

        it('a save beside it while the question is open is drawn the moment Cancel is pressed', async () => {
            await renderRefPage();
            await act(async () => button('Print').click());
            await settle();
            expect(getDialog()).not.toBeNull();
            h.load.mockResolvedValue({
                status: 'ready',
                html: '<p class="saved-beside">Saved beside</p>',
                mermaidSources: [],
            });
            watchChange();
            await act(async () => vi.advanceTimersByTime(500));
            // The page asked about stays under the question.
            expect(container.querySelector('.saved-beside')).toBeNull();

            await act(async () => dialogButton('Cancel').click());
            await settle();
            expect(h.print).not.toHaveBeenCalled();
            expect(container.querySelector('.saved-beside')?.textContent).toBe(
                'Saved beside',
            );
        });

        it('a second print while one is asked prints nothing, and a question nobody answers is a Cancel', async () => {
            await renderRefPage();
            let firstAnswer: boolean | null = null;
            await act(async () => {
                void getPreparePrint()().then((value) => {
                    firstAnswer = value;
                });
            });
            await settle();
            let secondAnswer: boolean | null = null;
            await act(async () => {
                secondAnswer = await getPreparePrint()();
            });
            expect(secondAnswer).toBe(false);
            expect(getDialog()).not.toBeNull();

            await act(async () => vi.advanceTimersByTime(5 * 60_000 - 1));
            expect(firstAnswer).toBeNull();
            await act(async () => vi.advanceTimersByTime(1));
            await settle();
            expect(firstAnswer).toBe(false);
            expect(getDialog()).toBeNull();
        });
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

    // 2026-11-11, the user: _own window for every type_ -- a linked file
    // opens in a window of its own, and this one keeps its file.
    it('routes web links to the browser, a file to a window of its own, a heading in place', async () => {
        await render();
        expect(container.querySelector('button[aria-label="Back"]')).toBeNull();
        await clickLink('https://example.org');
        expect(h.openExternalURL).toHaveBeenCalledWith('https://example.org');
        await clickLink('tool.exe');
        await clickLink('next.md');
        expect(h.openWindow.mock.calls).toEqual([
            ['/docs/tool.exe'],
            ['/docs/next.md'],
        ]);
        expect(h.reveal).not.toHaveBeenCalled();
        expect(h.openFile).not.toHaveBeenCalled();
        await clickLink('#top');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
            block: 'start',
        });
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/start.md',
        );
        expect(h.load).toHaveBeenCalledTimes(1);
        expect(h.load).toHaveBeenLastCalledWith('/docs/start.md');
    });

    it('makes the page links once it is drawn, and tells a pass it is stale', async () => {
        await render();
        expect(h.decorate).toHaveBeenCalled();
        const [articleElement, filePath, checkIsStale] =
            h.decorate.mock.calls.at(-1)!;
        expect(articleElement.innerHTML).toContain('Top link');
        expect(filePath).toBe('/docs/start.md');
        expect(checkIsStale()).toBe(false);
        h.load.mockResolvedValue({
            status: 'ready',
            html: '<p>Saved again</p>',
            mermaidSources: [],
        });
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));
        expect(checkIsStale()).toBe(true);
        expect(h.decorate.mock.calls.at(-1)![0].innerHTML).toBe(
            '<p>Saved again</p>',
        );
    });

    it('a person, place, verse or file on the page opens; a forged or selected one does not', async () => {
        h.load.mockResolvedValue({
            status: 'ready',
            html: '<p><span class="app-markdown-ref">Moses</span> <span class="app-markdown-ref">MAT.18.pdf</span></p>',
            mermaidSources: [],
        });
        await render();
        const [moses, file] = container.querySelectorAll('.app-markdown-ref');
        const press = async (element: Element, type = 'click') => {
            await act(async () => {
                element.dispatchEvent(
                    new MouseEvent(type, { bubbles: true, button: 1 }),
                );
            });
        };
        const request = { kind: 'name', target: 'moses_1', name: 'Moses' };
        h.findRef.mockImplementation((element: Element) => {
            if (element === moses) {
                return { kind: 'panel', request };
            }
            return element === file
                ? { kind: 'file', filePath: '/res/MAT.18.pdf' }
                : null;
        });
        await press(moses);
        expect(h.requestPanel).toHaveBeenCalledExactlyOnceWith(request);
        await press(file);
        expect(h.openWindow).toHaveBeenCalledExactlyOnceWith('/res/MAT.18.pdf');
        // A middle press is no press on a mention.
        await press(moses, 'auxclick');
        expect(h.requestPanel).toHaveBeenCalledTimes(1);
        // A press that ends a drag-selection is someone selecting words.
        const selection = { isCollapsed: false };
        const selectionSpy = vi
            .spyOn(globalThis, 'getSelection')
            .mockReturnValue(selection as never);
        await press(moses);
        expect(h.requestPanel).toHaveBeenCalledTimes(1);
        // A span the file wrote itself opens nothing.
        selection.isCollapsed = true;
        h.findRef.mockReturnValue(null);
        await press(moses);
        expect(h.requestPanel).toHaveBeenCalledTimes(1);
        expect(h.openWindow).toHaveBeenCalledTimes(1);
        selectionSpy.mockRestore();
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

    it('a file deleted while it is shown says so, and nothing of its page is left', async () => {
        await render();
        expect(container.textContent).toContain('Top link');
        h.load.mockResolvedValueOnce({ status: 'not-found' });
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));

        expect(container.querySelector('.app-markdown-body')).toBeNull();
        expect(
            container.querySelector('.app-markdown-preview-status')
                ?.textContent,
        ).toBe('File not found');
        expect(container.textContent).not.toContain('Top link');

        // Back again: the page is drawn into a page of its own.
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));
        expect(
            container.querySelector('.app-markdown-preview-status'),
        ).toBeNull();
        expect(
            container.querySelector('.app-markdown-body')?.textContent,
        ).toContain('Top link');
        expect(container.textContent).not.toContain('File not found');
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

    it('draws the diagrams once the languages faces are known, the page at once', async () => {
        let resolveLangs: (list: { fontFamily: string }[]) => void = () => {};
        h.initAllLangCss.mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveLangs = resolve;
            });
        });
        h.load.mockResolvedValue({
            status: 'ready',
            html: '<div data-mermaid-index="0"><pre><code>graph TD</code></pre></div>',
            mermaidSources: ['graph TD'],
        });
        await render();
        const article =
            container.querySelector<HTMLElement>('.app-markdown-body')!;
        expect(article.textContent).toBe('graph TD');
        // A diagram is laid out once, in the faces named when it is drawn.
        expect(h.mermaid).not.toHaveBeenCalled();

        await act(async () => resolveLangs([{ fontFamily: 'app-Xx-Face' }]));
        expect(
            article.style.getPropertyValue('--app-markdown-lang-font-families'),
        ).toBe('app-Xx-Face');
        expect(h.mermaid).toHaveBeenCalledTimes(1);
        expect(h.mermaid).toHaveBeenCalledWith(
            article,
            ['graph TD'],
            expect.objectContaining({ isDark: false }),
        );
    });

    it('a languages list that cannot be read still lets the diagrams draw', async () => {
        const error = new Error('no plugins');
        h.initAllLangCss.mockRejectedValueOnce(error);
        h.load.mockResolvedValue({
            status: 'ready',
            html: '<div data-mermaid-index="0"><pre><code>graph TD</code></pre></div>',
            mermaidSources: ['graph TD'],
        });
        await render();
        expect(h.mermaid).toHaveBeenCalledTimes(1);
        // Still reported, as any failed effect is.
        expect(h.effectError).toHaveBeenCalledWith(error);
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
        // The page stays, the same element, drawn again from the text the
        // editor holds with each block's line marked: what each side reads
        // to follow the other's scrolling, handed to the editor.
        expect(panes[1].querySelector('.app-markdown-body')).toBe(article);
        expect(h.renderText).toHaveBeenCalledTimes(1);
        expect(h.renderText).toHaveBeenCalledWith(
            '/docs/start.md',
            '# Saved',
            true,
        );
        expect(article?.querySelector('.drawn')?.textContent).toBe('# Saved');
        expect(h.editorProps!.pageRef.current).toBe(panes[1]);
        expect(h.editorProps!.articleRef.current).toBe(article);
        expect(button('Hide Editor').className).toContain('active');
        // Nothing to save until something is typed.
        expect(button('Save').disabled).toBe(true);
        expect(unsavedMark()).toBeNull();
        // The editor read the file itself; the disk is not read again for it.
        expect(h.readText).toHaveBeenCalledTimes(1);
    });

    it('a typed change is marked unsaved, holds Reload, and Save writes it', async () => {
        await render();
        await startEditing();
        await type('# Changed');
        expect(unsavedMark()?.getAttribute('title')).toBe('Unsaved changes');
        expect(document.title).toBe('Open Worship - start.md *');
        expect(button('Reload').disabled).toBe(true);
        expect(button('Save').disabled).toBe(false);
        // Typing back what was saved is nothing unsaved.
        await type('# Saved');
        expect(unsavedMark()).toBeNull();
        await type('# Changed');
        await act(async () => h.editorProps!.onSave());
        expect(h.save).toHaveBeenCalledWith('/docs/start.md', '# Changed');
        expect(unsavedMark()).toBeNull();
        expect(document.title).toBe('Open Worship - start.md');
        expect(button('Save').disabled).toBe(true);
        expect(button('Reload').disabled).toBe(false);
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
        // Edit's own draw, of the text it read.
        expect(h.renderText).toHaveBeenCalledTimes(1);
        await type('# D');
        await type('# Draft');
        await act(async () => vi.advanceTimersByTime(499));
        expect(h.renderText).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(1));
        // One draw for the two keys, of the last text, from no disk read,
        // its lines marked like Edit's.
        expect(h.renderText).toHaveBeenCalledTimes(2);
        expect(h.renderText).toHaveBeenLastCalledWith(
            '/docs/start.md',
            '# Draft',
            true,
        );
        expect(h.load).toHaveBeenCalledTimes(loadCount);
        expect(container.querySelector('.drawn')?.textContent).toBe('# Draft');
    });

    describe('a print pressed before the typing pauses', () => {
        // The page's links and the question come in by dynamic imports.
        async function settle() {
            for (let round = 0; round < 5; round++) {
                await act(async () => {
                    await vi.dynamicImportSettled();
                });
            }
        }

        it('Print draws the last words first, and nothing is drawn over the print', async () => {
            await render();
            await startEditing();
            let pageAtPrint: string | null = null;
            h.print.mockImplementation(() => {
                pageAtPrint =
                    container.querySelector('.drawn')?.textContent ?? null;
            });
            await type('# Typed last');
            // Not drawn yet: the typing has not paused.
            expect(container.querySelector('.drawn')?.textContent).toBe(
                '# Saved',
            );

            await act(async () => button('Print').click());
            await settle();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(pageAtPrint).toBe('# Typed last');
            expect(h.renderText).toHaveBeenCalledTimes(2);
            expect(h.renderText).toHaveBeenLastCalledWith(
                '/docs/start.md',
                '# Typed last',
                true,
            );
            // The draw that waited on the typing was called off: it would
            // have drawn the page again under the print.
            await act(async () => vi.advanceTimersByTime(500));
            expect(h.renderText).toHaveBeenCalledTimes(2);
        });

        it('File > Print draws them too before main is told the page is ready', async () => {
            await render();
            await startEditing();
            await type('# Typed last');
            let pageWhenReady: string | null = null;
            await act(async () => {
                void (
                    globalThis as { appPreparePrint?: () => Promise<boolean> }
                ).appPreparePrint!().then((isReady) => {
                    pageWhenReady = isReady
                        ? (container.querySelector('.drawn')?.textContent ??
                          null)
                        : 'cancelled';
                });
            });
            await settle();
            expect(pageWhenReady).toBe('# Typed last');
        });

        it('words typed while the page is got ready for paper are drawn once it is made, never under the print', async () => {
            await render();
            await startEditing();
            // Its links take a while, and the print waits for them.
            let finishLinking = () => {};
            h.decorate.mockImplementation(() => {
                return new Promise<number>((resolve) => {
                    finishLinking = () => resolve(0);
                });
            });
            let pageAtPrint: string | null = null;
            h.print.mockImplementation(() => {
                pageAtPrint =
                    container.querySelector('.drawn')?.textContent ?? null;
            });
            await type('# Typed first');
            await act(async () => button('Print').click());
            await settle();
            expect(h.print).not.toHaveBeenCalled();
            expect(container.querySelector('.drawn')?.textContent).toBe(
                '# Typed first',
            );

            await type('# Typed meanwhile');
            await act(async () => vi.advanceTimersByTime(500));
            expect(container.querySelector('.drawn')?.textContent).toBe(
                '# Typed first',
            );

            await act(async () => finishLinking());
            await settle();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(pageAtPrint).toBe('# Typed first');
            expect(container.querySelector('.drawn')?.textContent).toBe(
                '# Typed first',
            );

            // The paper is made: the words typed meanwhile are drawn.
            await act(async () => {
                globalThis.dispatchEvent(new Event('afterprint'));
            });
            expect(container.querySelector('.drawn')?.textContent).toBe(
                '# Typed meanwhile',
            );
        });

        it('a page that paused already is printed as drawn, drawn no more', async () => {
            await render();
            await startEditing();
            await type('# Draft');
            await act(async () => vi.advanceTimersByTime(500));
            expect(h.renderText).toHaveBeenCalledTimes(2);

            await act(async () => button('Print').click());
            await settle();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(h.renderText).toHaveBeenCalledTimes(2);
        });

        it('a draft too large to draw prints as the window shows it, at once', async () => {
            await render();
            await startEditing();
            h.renderText.mockReturnValueOnce({ status: 'too-large' });
            await type('# Huge');

            await act(async () => button('Print').click());
            await settle();
            expect(h.print).toHaveBeenCalledTimes(1);
            expect(
                container.querySelector('.app-markdown-preview-status')
                    ?.textContent,
            ).toBe('This file is too large to preview');
        });
    });

    it('Hide Editor keeps an unsaved draft on the page, and Discard puts the saved text back', async () => {
        await render();
        await startEditing();
        await type('# Draft');
        const loadCount = h.load.mock.calls.length;
        await act(async () => button('Hide Editor').click());
        // Drawn at once, not after the typing's wait, and with no editor to
        // follow, no line marked.
        expect(h.renderText).toHaveBeenLastCalledWith(
            '/docs/start.md',
            '# Draft',
        );
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

        // Back into the editor with the same draft, not the disk's text, the
        // page drawn from it with its lines marked again.
        await act(async () => button('Edit').click());
        await flush();
        expect(h.readText).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.stub-editor')?.textContent).toBe(
            '# Draft',
        );
        expect(h.renderText).toHaveBeenLastCalledWith(
            '/docs/start.md',
            '# Draft',
            true,
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
        const renderCount = h.renderText.mock.calls.length;
        await act(async () => button('Hide Editor').click());
        // Drawn from the disk again, its lines no longer marked.
        expect(h.load).toHaveBeenCalledTimes(loadCount + 1);
        expect(h.renderText).toHaveBeenCalledTimes(renderCount);
        expect(
            container.querySelector('.app-markdown-body')?.innerHTML,
        ).toContain('Top link');
        // The next Edit reads the file again.
        await startEditing();
        expect(h.readText).toHaveBeenCalledTimes(2);
    });

    it('unsaved words block closing the window, never a linked file of its own window', async () => {
        await render();
        await startEditing();
        await type('# Draft');
        // From the page beside the editor, and with the editor hidden: the
        // linked file opens beside this one, which keeps its draft.
        await clickLink('next.md');
        await act(async () => button('Hide Editor').click());
        await clickLink('next.md');
        expect(h.openWindow.mock.calls).toEqual([
            ['/docs/next.md'],
            ['/docs/next.md'],
        ]);
        expect(new URL(location.href).searchParams.get('preview-file')).toBe(
            '/docs/start.md',
        );
        expect(unsavedMark()).not.toBeNull();

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
            true,
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

// 2026-11-12, the user: _when I'm viewing the markdown that has many titles
// (sections) I want to jump to the title (section) by open panel of the title
// list then click to scroll to the section_, and _add quick scroll top_.
describe('Markdown Preview window — Sections and back to the top', () => {
    const SECTIONED_HTML =
        '<h1 id="md-heading-top">Top</h1><p>Words</p>' +
        '<h2 id="md-heading-middle">Middle</h2>' +
        '<h3 id="md-heading-deep">Deep</h3>';

    function headingList() {
        return container.querySelector(
            '.app-markdown-preview-head > nav.app-markdown-heading-list',
        );
    }

    function headingEntry(text: string) {
        const element = Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                '.app-markdown-heading-list-item',
            ),
        ).find((candidate) => {
            return candidate.textContent === text;
        });
        expect(element).toBeDefined();
        return element!;
    }

    function placeAt(selector: string, top: number) {
        container.querySelector<HTMLElement>(selector)!.getBoundingClientRect =
            () => {
                return { top, height: 30 } as DOMRect;
            };
    }

    it('offers Sections only for a page with a heading', async () => {
        h.load.mockResolvedValue({
            status: 'ready',
            html: '<p>Plain words</p>',
            mermaidSources: [],
        });
        await render();
        expect(container.querySelector('.app-markdown-body')?.textContent).toBe(
            'Plain words',
        );
        expect(
            container.querySelector('button[aria-label="Sections"]'),
        ).toBeNull();
    });

    it('lists the headings under the head row, the section being read marked, and jumps to the one pressed', async () => {
        h.load.mockResolvedValue({
            status: 'ready',
            html: SECTIONED_HTML,
            mermaidSources: [],
        });
        await render();
        placeAt('.app-markdown-preview-page', 40);
        placeAt('#md-heading-top', -400);
        placeAt('#md-heading-middle', 50);
        placeAt('#md-heading-deep', 300);
        const sections = button('Sections');
        expect(sections.getAttribute('aria-expanded')).toBe('false');

        await act(async () => sections.click());
        expect(sections.getAttribute('aria-expanded')).toBe('true');
        expect(sections.classList.contains('active')).toBe(true);
        expect(
            Array.from(headingList()!.querySelectorAll('button')).map(
                (element) => {
                    return [
                        element.textContent,
                        element.getAttribute('aria-current'),
                    ];
                },
            ),
        ).toEqual([
            ['Top', null],
            ['Middle', 'location'],
            ['Deep', null],
        ]);
        expect(document.activeElement).toBe(headingEntry('Middle'));

        await act(async () => headingEntry('Deep').click());
        const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(scrollIntoView.mock.contexts.at(-1)).toBe(
            container.querySelector('#md-heading-deep'),
        );
        expect(headingList()).toBeNull();
        expect(sections.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(sections);
    });

    it('its button closes the list it opened, and a page drawn again closes it', async () => {
        // A new result for every read, as the file's own reads give.
        h.load.mockImplementation(async () => {
            return {
                status: 'ready',
                html: SECTIONED_HTML,
                mermaidSources: [],
            };
        });
        await render();
        const sections = button('Sections');
        await act(async () => sections.click());
        expect(headingList()).not.toBeNull();
        await act(async () => sections.click());
        expect(headingList()).toBeNull();

        await act(async () => sections.click());
        expect(headingList()).not.toBeNull();
        watchChange();
        await act(async () => vi.advanceTimersByTime(500));
        await act(async () => {});
        expect(h.load).toHaveBeenCalledTimes(2);
        expect(headingList()).toBeNull();
        expect(button('Sections').getAttribute('aria-expanded')).toBe('false');
    });

    it('puts the arrow back to the top in the scrolling page, clear of its scrollbar', async () => {
        await render();
        const arrow = container.querySelector<HTMLElement>('.stub-to-top')!;
        expect(
            arrow.parentElement!.classList.contains(
                'app-markdown-preview-page',
            ),
        ).toBe(true);
        expect(arrow.dataset.right).toBe('12px');
    });
});
