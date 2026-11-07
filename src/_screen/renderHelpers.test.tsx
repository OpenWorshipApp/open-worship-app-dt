// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fileSourceGetInstance = vi.fn((filePath: string) => ({
    filePath,
    src: `file://${filePath}`,
    name: filePath,
}));
const playMediaElementMock = vi.fn();
const releaseMediaElementMock = vi.fn();
const getLangDataAsyncMock = vi.fn(async (locale: string) => ({
    fontFamily: `Font-${locale}`,
    genCss: () => `@font-face { font-family: Font-${locale}; }`,
}));
const getVersesMock = vi.fn(async () => ({
    '1': 'Verse one',
    '2': 'Verse two',
}));
const getBibleLocaleMock = vi.fn(async () => 'en-US');
const toLocaleNumBibleMock = vi.fn(async (_bibleKey: string, n: number) => {
    return `${n}`;
});

vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getLangDataAsync: getLangDataAsyncMock,
    tran: (value: string) => value,
    checkIsRtl: (locale: string) => locale === 'arc',
}));

vi.mock('../helper/helpers', async () => {
    const actual = await vi.importActual('../helper/helpers');
    return {
        ...actual,
        getHTMLChild: <T extends HTMLElement>(parent: HTMLElement) => {
            const child = parent.firstElementChild;
            if (!(child instanceof HTMLElement)) {
                throw new TypeError('Invalid child');
            }
            return child as T;
        },
    };
});

vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: getVersesMock,
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    toLocaleNumBible: toLocaleNumBibleMock,
}));

vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: getBibleLocaleMock,
}));

vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: {
        toBibleVersesKey: vi.fn(
            (
                _bibleKey: string,
                target: { chapter: number; verseStart: number },
            ) => {
                return `VERSE-${target.chapter}-${target.verseStart}`;
            },
        ),
        toKJVBibleVersesKey: vi.fn(
            (target: { chapter: number; verseStart: number }) => {
                return `KJV-${target.chapter}-${target.verseStart}`;
            },
        ),
        // Two verses a chapter, from the chapter the range starts at.
        toVerseTextList: vi.fn(
            async (
                _bibleKey: string,
                target: { chapter: number; chapterEnd?: number },
                _isSkipExtra: boolean,
                range: { start: number; count: number },
            ) => {
                const isCrossChapter =
                    (target.chapterEnd ?? target.chapter) > target.chapter;
                const lastChapter = target.chapterEnd ?? target.chapter;
                const verseList = [];
                for (
                    let chapter = target.chapter + range.start;
                    chapter <= lastChapter &&
                    chapter < target.chapter + range.start + range.count;
                    chapter++
                ) {
                    for (const verse of [1, 2]) {
                        verseList.push({
                            chapter,
                            verse,
                            localeVerse: `${verse}`,
                            localeChapter: `${chapter}`,
                            text: verse === 1 ? 'Verse one' : 'Verse two',
                            bibleVersesKey: `VERSE-${chapter}-${verse}`,
                            kjvBibleVersesKey: `KJV-${chapter}-${verse}`,
                            isChapterStart: isCrossChapter && verse === 1,
                        });
                    }
                }
                return verseList;
            },
        ),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstance,
    },
}));

vi.mock('../helper/mediaHelpers', () => ({
    playMediaElement: playMediaElementMock,
    releaseMediaElement: releaseMediaElementMock,
}));

vi.mock('../background/RenderBackgroundWebIframeComp', () => ({
    default: ({
        iframeSource,
        width,
        height,
        targetWidth,
        targetHeight,
    }: any) => {
        return (
            <iframe
                data-file-path={iframeSource.filePath}
                width={width}
                height={height}
                data-target-width={targetWidth}
                data-target-height={targetHeight}
                title="background-web"
            />
        );
    },
}));

// Stands in for the real still-picture box so this test never drags in the
// capture chain (a hidden BrowserWindow IPC) to prove which branch was taken.
const genWebScreenShotElementMock = vi.fn(
    (url: string, _getCaptureSize: () => { width: number; height: number }) => {
        const element = document.createElement('div');
        element.setAttribute('data-web-shot-url', url);
        return element;
    },
);

vi.mock('./managers/screenWebsiteHelpers', () => ({
    genWebScreenShotElement: genWebScreenShotElementMock,
}));

vi.mock('../helper/sanitizeHelpers', async () => {
    const actual = await vi.importActual<
        typeof import('../helper/sanitizeHelpers')
    >('../helper/sanitizeHelpers');
    return {
        // The real one: a long text column's style goes through it on
        // its way into the table's CSS.
        sanitizeCssValue: actual.sanitizeCssValue,
        sanitizeHtml: (html: string) => {
            return html.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        },
    };
});

vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    toHexColorString: (color: string) => color.toLowerCase(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
    },
}));

vi.mock('./managers/screenEventHelpers', () => ({
    useScreenLongTextManagerEvents: vi.fn(),
}));

vi.mock('./managers/ScreenLongTextManager', () => ({
    default: class ScreenLongTextManager {
        static readonly textStyleTextColor = '#123456';
    },
}));

describe('screen render helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.requestAnimationFrame = vi.fn(() => 1) as any;
        globalThis.ResizeObserver = class {
            observe() {
                return undefined;
            }
            disconnect() {
                return undefined;
            }
        } as any;
    });

    test('exports runtime screen constants and loads type-only modules', async () => {
        const screenTypeHelpers = await import('./screenTypeHelpers');
        const appDocumentTypes = await import('./screenAppDocumentTypeHelpers');
        const screenManagerInf = await import('./preview/ScreenManagerInf');

        expect(screenTypeHelpers.bibleDataTypeList).toContain('bible-item');
        expect(screenTypeHelpers.screenTypeList).toContain('foreground');
        expect(appDocumentTypes).toBeDefined();
        expect(screenManagerInf).toBeDefined();
    });

    test('renders the Bible table with synced rows', async () => {
        const { BibleBibleTableComp } = await import('./bibleScreenComps');

        const html = renderToStaticMarkup(
            <BibleBibleTableComp
                bibleRenderingList={[
                    {
                        locale: 'en-US' as any,
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        langData: {
                            fontFamily: 'Font-en-US',
                            genCss: () => '',
                        } as any,
                        verses: [
                            {
                                num: '1',
                                text: 'In the beginning',
                                verseKey: 'KJV-GEN-1-1',
                                kjvVerseKey: 'GEN-1-1',
                            },
                            {
                                num: '2',
                                text: 'And then',
                                verseKey: 'KJV-GEN-1-2',
                                kjvVerseKey: 'GEN-1-2',
                            },
                        ],
                    },
                    {
                        locale: 'en-US' as any,
                        bibleKey: 'NIV',
                        title: 'Genesis 1:1-2',
                        langData: {
                            fontFamily: 'Font-en-US',
                            genCss: () => '',
                        } as any,
                        verses: [
                            {
                                num: '1',
                                text: 'At the start',
                                verseKey: 'NIV-GEN-1-1',
                                kjvVerseKey: 'GEN-1-1',
                            },
                            {
                                num: '2',
                                text: 'And next',
                                verseKey: 'NIV-GEN-1-2',
                                kjvVerseKey: 'GEN-1-2',
                            },
                        ],
                    },
                ]}
                isLineSync
            />,
        );

        expect(html).toContain('Genesis 1:1-2');
        expect(html).toContain('data-kjv-verse-key="GEN-1-1"');
        expect(html).toContain('data-kjv-verse-key="GEN-1-2"');
        // The family chosen in Bible/LongText Properties first, the language's own
        // behind it -- and alone while nothing is chosen.
        expect(html).toContain(
            'font-family:var(--bible-font-family, Font-en-US), Font-en-US',
        );
    });

    test('draws each Bible as its own column unless they are row by row', async () => {
        const { BibleBibleTableComp } = await import('./bibleScreenComps');
        const genRendering = (bibleKey: string) => {
            return {
                locale: 'en-US' as any,
                bibleKey,
                title: `${bibleKey} Genesis 1:1-2`,
                langData: {
                    fontFamily: 'Font-en-US',
                    genCss: () => '',
                } as any,
                verses: [1, 2].map((verse) => {
                    return {
                        num: `${verse}`,
                        text: `${bibleKey} verse ${verse}`,
                        verseKey: `${bibleKey}-GEN-1-${verse}`,
                        kjvVerseKey: `GEN-1-${verse}`,
                    };
                }),
            };
        };
        const render = (bibleKeys: string[], isLineSync: boolean) => {
            const host = document.createElement('div');
            host.innerHTML = renderToStaticMarkup(
                <BibleBibleTableComp
                    bibleRenderingList={bibleKeys.map(genRendering)}
                    isLineSync={isLineSync}
                />,
            );
            return host;
        };

        const columns = render(['KJV', 'NIV', 'ESV'], false);
        const root = columns.firstElementChild as HTMLElement;
        expect(root.className).toBe('screen-bible-columns');
        const columnList = Array.from(
            root.querySelectorAll<HTMLElement>(':scope > .screen-bible-column'),
        );
        expect(columnList.map((column) => column.className)).toEqual([
            'screen-bible-column screen-bible-column-0',
            'screen-bible-column screen-bible-column-1',
            'screen-bible-column screen-bible-column-2',
        ]);
        // Side by side in equal shares, each a table with its own header.
        expect(columnList.map((column) => column.style.width)).toEqual(
            Array.from({ length: 3 }, () => `${100 / 3}%`),
        );
        expect(columnList[2].style.left).toBe(`${(100 / 3) * 2}%`);
        columnList.forEach((column, i) => {
            expect(column.dataset.columnIndex).toBe(`${i}`);
            expect(column.querySelectorAll('table')).toHaveLength(1);
            expect(column.querySelectorAll('th.header')).toHaveLength(1);
            // The header still says which Bible of the row it is.
            expect(
                column.querySelector<HTMLElement>('.bible-name')?.dataset.index,
            ).toBe(`${i}`);
            expect(column.querySelectorAll('span.highlight')).toHaveLength(2);
        });

        // Row by row is one table: a row cannot be split between scrollers.
        const rows = render(['KJV', 'NIV'], true);
        expect(rows.querySelector('.screen-bible-column')).toBeNull();
        expect(rows.querySelectorAll('table')).toHaveLength(1);
        expect(rows.querySelectorAll('tbody tr')).toHaveLength(2);
        // And a single Bible has nothing to keep in step with.
        const single = render(['KJV'], false);
        expect(single.querySelector('.screen-bible-column')).toBeNull();
        expect(single.querySelectorAll('table')).toHaveLength(1);
    });

    test('draws a long text: language chips that open nothing, a style per column', async () => {
        const { LongTextTableComp } = await import('./bibleScreenComps');
        const genColumn = (code: string, sectionCount: number, style?: any) => {
            return {
                locale: (code === 'AR' ? 'arc' : 'en-US') as any,
                code,
                // The same title in every language, as a song often has.
                title: 'Amazing Grace',
                langData: {
                    fontFamily: `Font-${code}`,
                    genCss: () => '',
                } as any,
                sections: Array.from({ length: sectionCount }, (_, i) => {
                    return {
                        num: `${i + 1}`,
                        text: `${code} line a\n${code} line b`,
                        key: `lt-${i + 1}`,
                    };
                }),
                ...(style === undefined ? {} : { style }),
            };
        };
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[
                    genColumn('KM', 3),
                    // One section short: drawn with a blank cell, never read
                    // past its end.
                    genColumn('EN', 2, {
                        fontFamily: 'Georgia',
                        fontWeight: '300',
                        color: '#ff0000',
                        fontSizeScale: 0.8,
                        textAlign: 'center',
                        // Not a style this layer draws: it never reaches CSS.
                        background: 'url(x)',
                    }),
                ]}
                isLineSync
                isLongText
            />,
        );
        const root = host.firstElementChild as HTMLElement;
        expect(root.className).toBe('screen-long-text');
        // Both columns are there although they share a title.
        const headers = Array.from(root.querySelectorAll<HTMLElement>('th'));
        expect(headers).toHaveLength(2);
        // The header keeps the screen's size: no column class on it.
        expect(headers.map((header) => header.className)).toEqual([
            'header',
            'header',
        ]);
        // A language code, with no Bible versions menu to hang on it.
        expect(root.querySelector('.bible-name')).toBeNull();
        expect(
            Array.from(root.querySelectorAll('.bible-key')).map((chip) => {
                return chip.textContent;
            }),
        ).toEqual(['KM', 'EN']);
        expect(root.querySelector('th .highlight')).toBeNull();

        const rows = Array.from(root.querySelectorAll('tbody tr'));
        expect(rows).toHaveLength(3);
        expect(rows[2].querySelectorAll('td')).toHaveLength(2);
        expect(rows[2].querySelectorAll('span.highlight')).toHaveLength(1);
        // One key per row, shared by its languages, and no Bible verse key.
        const firstRowSpans =
            rows[0].querySelectorAll<HTMLElement>('span.highlight');
        expect(
            Array.from(firstRowSpans).map((span) => span.dataset.kjvVerseKey),
        ).toEqual(['lt-1', 'lt-1']);
        expect(firstRowSpans[0].hasAttribute('data-verse-key')).toBe(false);

        // KM keeps the screen's family ahead of its own; EN says its own,
        // and the screen's cannot win over it.
        expect(firstRowSpans[0].style.fontFamily).toContain(
            'var(--bible-font-family, Font-KM)',
        );
        expect(firstRowSpans[1].style.fontFamily).not.toContain('var(');
        expect(
            firstRowSpans[1].style.fontFamily.startsWith('"Georgia", Font-EN'),
        ).toBe(true);
        const styleText = root.querySelector('style')?.textContent ?? '';
        expect(styleText).toContain(
            '.screen-long-text-column-1 { font-size: 0.8em; }',
        );
        // A colour, a weight and a side of its own are not drawn: they are
        // Bible/LongText Properties', for every language.
        expect(styleText).not.toContain('#ff0000');
        expect(styleText).not.toContain('font-weight');
        expect(styleText).not.toContain('text-align');
        expect(styleText).not.toContain('column-0');
        expect(styleText).not.toContain('url(');
    });

    test('draws a Bible exactly as before: the versions chip, no column classes', async () => {
        const { BibleBibleTableComp } = await import('./bibleScreenComps');
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(
            <BibleBibleTableComp
                bibleRenderingList={['KJV', 'NIV'].map((bibleKey, i) => {
                    return {
                        locale: 'en-US' as any,
                        bibleKey,
                        title: 'Genesis 1:1-2',
                        langData: {
                            fontFamily: 'Font-en-US',
                            genCss: () => '',
                        } as any,
                        // The second version is a verse short.
                        verses: [1, 2].slice(0, 2 - i).map((verse) => {
                            return {
                                num: `${verse}`,
                                text: `${bibleKey} verse ${verse}`,
                                verseKey: `${bibleKey}-GEN-1-${verse}`,
                                kjvVerseKey: `GEN-1-${verse}`,
                            };
                        }),
                    };
                })}
                isLineSync
            />,
        );
        const root = host.firstElementChild as HTMLElement;
        expect(root.className).toBe('');
        expect(root.querySelectorAll('.bible-name')).toHaveLength(2);
        expect(root.querySelector('th')?.className).toBe('header');
        expect(root.querySelector('td')?.className).toBe('');
        // Rows run to the LONGER version; the shorter one's cell is blank.
        const rows = root.querySelectorAll('tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[1].querySelectorAll('span.highlight')).toHaveLength(1);
        expect(
            root.querySelector<HTMLElement>('span.highlight')?.dataset.verseKey,
        ).toBe('KJV-GEN-1-1');
    });

    test('builds Bible screen markup and wires verse selection handlers', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;
        const screenView =
            await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
                [
                    {
                        locale: 'en-US' as any,
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        verses: [
                            {
                                num: '1',
                                text: 'In the beginning',
                                verseKey: 'KJV-GEN-1-1',
                                kjvVerseKey: 'GEN-1-1',
                            },
                            {
                                num: '2',
                                text: 'Verse two',
                                verseKey: 'KJV-GEN-1-2',
                                kjvVerseKey: 'GEN-1-2',
                            },
                        ],
                    },
                    {
                        locale: 'en-US' as any,
                        bibleKey: 'NIV',
                        title: 'Genesis 1:1-2',
                        verses: [
                            {
                                num: '1',
                                text: 'At the start',
                                verseKey: 'NIV-GEN-1-1',
                                kjvVerseKey: 'GEN-1-1',
                            },
                            {
                                num: '2',
                                text: 'Verse two niv',
                                verseKey: 'NIV-GEN-1-2',
                                kjvVerseKey: 'GEN-1-2',
                            },
                        ],
                    },
                ],
                true,
            );

        const onSelectKey = vi.fn();
        const onBibleSelect = vi.fn();

        bibleScreenHelper.registerHighlight(screenView, {
            onSelectKey,
            onBibleSelect,
        });

        expect(screenView.querySelectorAll('span.highlight')).toHaveLength(4);

        const bibleName = screenView.querySelector(
            'div.bible-name[data-index="1"]',
        ) as HTMLDivElement | null;
        expect(bibleName).not.toBeNull();
        bibleName?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onBibleSelect).toHaveBeenCalledWith(expect.any(MouseEvent), 1);

        const firstVerse = screenView.querySelector(
            'span.highlight[data-kjv-verse-key="GEN-1-1"]',
        ) as HTMLSpanElement | null;
        expect(firstVerse).not.toBeNull();

        firstVerse?.dispatchEvent(
            new MouseEvent('mouseover', { bubbles: true }),
        );
        expect(screenView.querySelectorAll('span.hover')).toHaveLength(2);
        firstVerse?.dispatchEvent(
            new MouseEvent('mouseout', { bubbles: true }),
        );
        expect(screenView.querySelectorAll('span.hover')).toHaveLength(0);

        firstVerse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onSelectKey).toHaveBeenCalledWith('GEN-1-1', false);

        screenView.querySelectorAll('span.highlight').forEach((element) => {
            if (
                element instanceof HTMLElement &&
                element.dataset.kjvVerseKey === 'GEN-1-1'
            ) {
                element.classList.add('selected');
            }
        });
        firstVerse?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onSelectKey).toHaveBeenCalledWith(null, false);

        const secondVerse = screenView.querySelector(
            'span.highlight[data-kjv-verse-key="GEN-1-2"]',
        ) as HTMLSpanElement | null;
        secondVerse?.dispatchEvent(
            new MouseEvent('dblclick', { bubbles: true }),
        );
        expect(onSelectKey).toHaveBeenCalledWith('GEN-1-2', true);
    });

    test('treats alt-click verse selection as a top-promotion action', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;
        const screenView =
            await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
                [
                    {
                        locale: 'en-US' as any,
                        bibleKey: 'KJV',
                        title: 'Genesis 1:1-2',
                        verses: [
                            {
                                num: '1',
                                text: 'In the beginning',
                                verseKey: 'KJV-GEN-1-1',
                                kjvVerseKey: 'GEN-1-1',
                            },
                            {
                                num: '2',
                                text: 'Verse two',
                                verseKey: 'KJV-GEN-1-2',
                                kjvVerseKey: 'GEN-1-2',
                            },
                        ],
                    },
                ],
                true,
            );

        const onSelectKey = vi.fn();
        bibleScreenHelper.registerHighlight(screenView, {
            onSelectKey,
            onBibleSelect: vi.fn(),
        });

        const firstVerse = screenView.querySelector(
            'span.highlight[data-kjv-verse-key="GEN-1-1"]',
        ) as HTMLSpanElement | null;
        expect(firstVerse).not.toBeNull();

        firstVerse?.dispatchEvent(
            new MouseEvent('click', { bubbles: true, altKey: true }),
        );

        expect(onSelectKey).toHaveBeenCalledWith('GEN-1-1', true);
    });

    test('converts Bible items into render lists with localized verses', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;

        const rendered = await bibleScreenHelper.genBibleItemRenderList([
            {
                bibleKey: 'KJV',
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 2,
                },
                toTitle: vi.fn(async () => 'Genesis 1:1-2'),
            } as any,
        ]);

        expect(rendered).toHaveLength(1);
        expect(rendered[0].locale).toBe('en-US');
        expect(rendered[0].title).toBe('Genesis 1:1-2');
        expect(rendered[0].verses).toEqual([
            {
                num: '1',
                text: 'Verse one',
                verseKey: 'VERSE-1-1',
                kjvVerseKey: 'KJV-1-1',
            },
            {
                num: '2',
                text: 'Verse two',
                verseKey: 'VERSE-1-2',
                kjvVerseKey: 'KJV-1-2',
            },
        ]);
    });

    // GEN 1:1 to 5:2: three chapters are drawn, each opening on a divider
    // that names it; the operator's `...` asks for more.
    test('draws a passage across chapters chapter-labelled, as deep as asked', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;
        const bibleItem = {
            bibleKey: 'KJV',
            target: {
                bookKey: 'GEN',
                chapter: 1,
                verseStart: 1,
                verseEnd: 2,
                chapterEnd: 5,
            },
            toTitle: vi.fn(async () => 'Genesis 1:1-5:2'),
        } as any;
        const [rendered] = await bibleScreenHelper.genBibleItemRenderList([
            bibleItem,
        ]);
        expect(
            rendered.verses.map(({ kjvVerseKey, chapterLabel }) => {
                return `${kjvVerseKey}${chapterLabel ? ` [${chapterLabel}]` : ''}`;
            }),
        ).toEqual([
            'KJV-1-1 [1]',
            'KJV-1-2',
            'KJV-2-1 [2]',
            'KJV-2-2',
            'KJV-3-1 [3]',
            'KJV-3-2',
        ]);
        const [deeper] = await bibleScreenHelper.genBibleItemRenderList(
            [bibleItem],
            4,
        );
        expect(deeper.verses).toHaveLength(8);

        const screenView =
            await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
                [rendered],
                true,
                'Show the next chapter',
            );
        expect(
            Array.from(
                screenView.querySelectorAll('.bible-chapter-divider'),
            ).map((element) => element.textContent),
        ).toEqual(['1', '2', '3']);
        const moreButton = screenView.querySelector(
            '[data-bible-more-chapter]',
        ) as HTMLButtonElement;
        expect(moreButton.getAttribute('aria-label')).toBe(
            'Show the next chapter',
        );
        const onShowMoreChapter = vi.fn();
        const onSelectKey = vi.fn();
        bibleScreenHelper.registerHighlight(screenView, {
            onSelectKey,
            onBibleSelect: vi.fn(),
            onShowMoreChapter,
        });
        moreButton.click();
        expect(onShowMoreChapter).toHaveBeenCalledTimes(1);
        expect(onSelectKey).not.toHaveBeenCalled();

        const projectorView =
            await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
                [rendered],
                true,
            );
        expect(
            projectorView.querySelector('[data-bible-more-chapter]'),
        ).toBeNull();
    });

    test('a marquee keeps its edge slide unless it carries its own transition', async () => {
        const { genHtmlForegroundMarquee, genMarqueeTransitionCss } =
            await import('./screenForegroundHelpers');
        // No transition of its own: the band slides in from its edge -- NOT
        // the screen's Foreground effect -- and "Slide In" is the same slide.
        const edge = genMarqueeTransitionCss(undefined, '-100%');
        expect(edge.base).toBe('transform: translateY(-100%);');
        expect(genMarqueeTransitionCss('move', '-100%')).toEqual(edge);
        expect(genMarqueeTransitionCss('fade', '100%').base).toBe(
            'opacity: 0;',
        );
        expect(genMarqueeTransitionCss('zoom', '100%').inFrames).toContain(
            'scale(1)',
        );
        // A cut: nothing hidden, nothing animated, nothing to wait for.
        expect(genMarqueeTransitionCss('none', '100%')).toEqual({
            base: '',
            inFrames: '',
            outFrames: '',
            millisecond: 0,
        });

        const fading = genHtmlForegroundMarquee(
            { text: 'Hello there', extraStyle: {}, transitionEffect: 'fade' },
            { height: 768 } as any,
            'bottom',
        );
        const fadingCss = fading.element.querySelector('style')?.textContent;
        expect(fadingCss).toContain('opacity: 0;');
        expect(fadingCss).not.toContain('translateY');

        const cut = genHtmlForegroundMarquee(
            { text: 'Hello there', extraStyle: {}, transitionEffect: 'none' },
            { height: 768 } as any,
            'top',
        );
        vi.useFakeTimers();
        const removing = cut.handleRemoving();
        await vi.advanceTimersByTimeAsync(0);
        await removing;
        vi.useRealTimers();
    });

    test('renders marquee bottom and quick text foreground DOM helpers', async () => {
        vi.useFakeTimers();

        const { genHtmlForegroundMarquee, genHtmlForegroundQuickText } =
            await import('./screenForegroundHelpers');
        const remove = vi.fn();
        const animData = {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };

        const marqueeBottom = genHtmlForegroundMarquee(
            { text: 'Hello there', extraStyle: {} },
            { height: 768 } as any,
            'bottom',
        );
        expect(marqueeBottom.element.textContent).toContain('Hello there');
        const removing = marqueeBottom.handleRemoving();
        await vi.advanceTimersByTimeAsync(Math.ceil((11 / 6) * 1000) + 500);
        await removing;
        expect(marqueeBottom.element.querySelector('p.out')).not.toBeNull();

        const marqueeTop = genHtmlForegroundMarquee(
            { text: 'Hello there', extraStyle: {} },
            { height: 768 } as any,
            'top',
        );
        expect(marqueeTop.element.style.top).toBe('0px');

        const quickText = genHtmlForegroundQuickText(
            {
                htmlText: '<b>Safe</b><script>alert(1)</script>',
                timeSecondDelay: 1,
                timeSecondToLive: 2,
                extraStyle: {},
            },
            animData,
            remove,
        );
        const parent = document.createElement('div');
        const adding = quickText.handleAdding(parent);
        await vi.advanceTimersByTimeAsync(3000);
        await adding;

        expect(animData.animIn).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledOnce();
        expect(parent.innerHTML).toContain('<b>Safe</b>');
        expect(parent.innerHTML).not.toContain('<script');

        vi.useRealTimers();
    });

    test('renders countdown, stopwatch, time, and web foreground helpers', async () => {
        const {
            genHtmlForegroundCountdown,
            genHtmlForegroundStopwatch,
            genHtmlForegroundTime,
            genHtmlForegroundWeb,
        } = await import('./screenForegroundHelpers');

        const animData = {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };
        const parent = document.createElement('div');

        const countdown = genHtmlForegroundCountdown(
            { dateTime: new Date(Date.now() + 60_000), extraStyle: {} },
            animData,
        );
        await countdown.handleAdding(parent);

        const stopwatch = genHtmlForegroundStopwatch(
            { dateTime: new Date(Date.now() - 60_000), extraStyle: {} },
            animData,
        );
        await stopwatch.handleAdding(parent);

        const timing = genHtmlForegroundTime(
            {
                id: 'tokyo',
                timezoneMinuteOffset: 9,
                title: 'Tokyo',
                extraStyle: {},
            },
            animData,
        );
        await timing.handleAdding(parent);
        expect(parent.querySelector('#ampm')?.textContent).toMatch(/AM|PM/);

        // The PROJECTED screen is the only place a web overlay is live.
        const web = genHtmlForegroundWeb(
            {
                filePath: '/tmp/web.html',
                widthScale: 0.5,
                heightScale: 0.5,
                extraStyle: { opacity: 0.5 },
            },
            animData,
            { width: 1920, height: 1080 },
            true,
        );
        await web.handleAdding(parent);

        expect(animData.animIn).toHaveBeenCalledTimes(4);
        expect(fileSourceGetInstance).toHaveBeenCalledWith('/tmp/web.html');
        expect(parent.querySelector('iframe')).not.toBeNull();
        expect(genWebScreenShotElementMock).not.toHaveBeenCalled();
        expect(parent.textContent).toContain('Tokyo');

        // clearing a layer pauses its ticker before animating the overlay out
        await countdown.handleRemoving();
        await stopwatch.handleRemoving();
        await timing.handleRemoving();
        await web.handleRemoving();
        expect(animData.animOut).toHaveBeenCalledTimes(4);
    });

    test('a web overlay is a still picture off the projected screen', async () => {
        const { genHtmlForegroundWeb } =
            await import('./screenForegroundHelpers');
        const animData = {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };
        const parent = document.createElement('div');

        const web = genHtmlForegroundWeb(
            {
                filePath: '/tmp/web.html',
                widthScale: 0.5,
                heightScale: 0.5,
                extraStyle: { opacity: 0.5 },
            },
            animData,
            { width: 1920, height: 1080 },
            false,
        );
        await web.handleAdding(parent);

        // The mini screen previews every overlay the operator puts up; a live
        // iframe there runs the page's scripts, timers and media for as long
        // as it is on screen.
        expect(parent.querySelector('iframe')).toBeNull();
        expect(
            parent
                .querySelector('[data-web-shot-url]')
                ?.getAttribute('data-web-shot-url'),
        ).toBe('file:///tmp/web.html');
        // Taken at the screen's OWN bounds, which is the cache entry the Webs
        // panel and the web background have already populated.
        expect(genWebScreenShotElementMock.mock.calls[0][1]()).toEqual({
            width: 1920,
            height: 1080,
        });
    });

    test('a foreground clip is muted, loops, and hands its player back', async () => {
        const { genHtmlForegroundVideo, genHtmlForegroundImage } =
            await import('./screenForegroundHelpers');
        playMediaElementMock.mockClear();
        releaseMediaElementMock.mockClear();
        const animData = {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };
        const parent = document.createElement('div');

        const video = genHtmlForegroundVideo(
            {
                filePath: '/tmp/snow.mp4',
                extraStyle: { mixBlendMode: 'screen', width: '100%' },
            },
            animData,
        );
        await video.handleAdding(parent);
        const videoElement = parent.querySelector('video');
        expect(videoElement).not.toBeNull();
        // Chromium refuses to autoplay a clip that is not muted, and React
        // does not write `muted` into static markup -- which is why this
        // element is built by hand rather than rendered to a string.
        expect(videoElement?.muted).toBe(true);
        expect(videoElement?.loop).toBe(true);
        expect(videoElement?.autoplay).toBe(true);
        expect(videoElement?.style.mixBlendMode).toBe('screen');
        expect(playMediaElementMock).toHaveBeenCalledOnce();

        const image = genHtmlForegroundImage(
            {
                filePath: '/tmp/logo.png',
                extraStyle: { mixBlendMode: 'multiply' },
            },
            animData,
        );
        await image.handleAdding(parent);
        expect(parent.querySelector('img')?.style.mixBlendMode).toBe(
            'multiply',
        );

        await video.handleRemoving();
        await image.handleRemoving();
        expect(animData.animOut).toHaveBeenCalledTimes(2);
        // Taking a media element out of the document does not free its player.
        expect(releaseMediaElementMock).toHaveBeenCalledOnce();
        expect(releaseMediaElementMock).toHaveBeenCalledWith(videoElement);
    });

    test('a marquee only scrolls while its text overflows', async () => {
        const { genHtmlForegroundMarquee, genHtmlForegroundQuickText } =
            await import('./screenForegroundHelpers');
        const observers: Array<{
            callback: () => void;
            element: Element | null;
        }> = [];
        class ResizeObserverMock {
            constructor(callback: () => void) {
                observers.push({ callback, element: null });
            }
            observe(element: Element) {
                observers[observers.length - 1].element = element;
            }
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        try {
            const animData = {
                duration: 0,
                styleText: '',
                animIn: vi.fn(async () => {}),
                animOut: vi.fn(async () => {}),
            };
            genHtmlForegroundMarquee(
                { text: 'a very long announcement', extraStyle: {} } as any,
                animData as any,
                'bottom' as any,
            );

            const observed = observers.at(-1);
            expect(observed?.element).not.toBeNull();
            const element = observed!.element as HTMLElement;

            Object.defineProperties(element, {
                offsetWidth: { configurable: true, value: 100 },
                scrollWidth: { configurable: true, value: 400 },
            });
            observed!.callback();
            expect(element.classList.contains('moving')).toBe(true);

            Object.defineProperties(element, {
                offsetWidth: { configurable: true, value: 400 },
                scrollWidth: { configurable: true, value: 100 },
            });
            observed!.callback();
            expect(element.classList.contains('moving')).toBe(false);

            // a quick-text overlay disappears again once its lifetime is up
            const quickText = genHtmlForegroundQuickText(
                {
                    htmlText: '<b>Welcome</b>',
                    timeSecondDelay: 0,
                    timeSecondToLive: 0,
                    extraStyle: {},
                },
                animData,
                vi.fn(),
            );
            await quickText.handleRemoving();
            expect(animData.animOut).toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    test('shows deterministic preview icon colors per screen id', async () => {
        const { default: ShowingScreenIconComp, genColorFromScreenId } =
            await import('./preview/ShowingScreenIcon');

        const color = genColorFromScreenId(3);
        expect(genColorFromScreenId(3)).toBe(color);

        const html = renderToStaticMarkup(
            <ShowingScreenIconComp screenId={3} />,
        );
        expect(html).toContain('Screen: 3');
        expect(html).toContain('data-screen-id="3"');
    });

    test('a message that does not rotate shows all its lines and starts no timer', async () => {
        vi.useFakeTimers();
        try {
            const { genHtmlForegroundMessage } =
                await import('./screenForegroundHelpers');
            const animData = {
                duration: 0,
                styleText: '',
                animIn: vi.fn(
                    async (element: HTMLElement, parent: HTMLElement) => {
                        parent.appendChild(element);
                    },
                ),
                animOut: vi.fn(async () => {}),
            };
            const parent = document.createElement('div');
            const message = genHtmlForegroundMessage(
                {
                    id: 'm1',
                    // A blank line the writer put inside one message stays.
                    textList: ['Welcome', '', 'to church'],
                    intervalSecond: null,
                    extraStyle: { color: 'red' },
                } as any,
                animData,
            );
            await message.handleAdding(parent);
            const element = parent.firstElementChild as HTMLElement;
            expect(element.textContent).toBe('Welcome\n\nto church');
            expect(element.style.whiteSpace).toBe('pre-wrap');
            expect(element.style.color).toBe('red');
            expect(element.style.transition).toBe('');
            expect(vi.getTimerCount()).toBe(0);

            // One real entry with an interval has nothing to rotate to.
            const single = genHtmlForegroundMessage(
                {
                    id: 'm2',
                    textList: ['Only one', '  '],
                    intervalSecond: 3,
                } as any,
                animData,
            );
            await single.handleAdding(parent);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    test('rotating messages fade across in turn and stop when taken down', async () => {
        vi.useFakeTimers();
        try {
            const { genHtmlForegroundMessage } =
                await import('./screenForegroundHelpers');
            const animData = {
                duration: 0,
                styleText: '',
                animIn: vi.fn(
                    async (element: HTMLElement, parent: HTMLElement) => {
                        parent.appendChild(element);
                    },
                ),
                animOut: vi.fn(async () => {}),
            };
            const parent = document.createElement('div');
            const message = genHtmlForegroundMessage(
                {
                    id: 'm3',
                    textList: ['First', '   ', 'Second'],
                    intervalSecond: 2,
                } as any,
                animData,
            );
            await message.handleAdding(parent);
            const element = parent.firstElementChild as HTMLElement;
            // Blank entries are not messages of their own.
            expect(element.textContent).toBe('First');
            expect(element.style.transition).toBe('opacity 400ms ease-in-out');

            await vi.advanceTimersByTimeAsync(2000);
            expect(element.style.opacity).toBe('0');
            expect(element.textContent).toBe('First');
            await vi.advanceTimersByTimeAsync(400);
            expect(element.textContent).toBe('Second');
            expect(element.style.opacity).toBe('1');

            // And round again to the first.
            await vi.advanceTimersByTimeAsync(2400);
            expect(element.textContent).toBe('First');

            // Taken down mid-fade: no timer is left behind.
            await vi.advanceTimersByTimeAsync(1400);
            expect(element.style.opacity).toBe('0');
            await message.handleRemoving();
            expect(animData.animOut).toHaveBeenCalledWith(element);
            expect(vi.getTimerCount()).toBe(0);
            await vi.advanceTimersByTimeAsync(5000);
            expect(element.textContent).toBe('First');
        } finally {
            vi.useRealTimers();
        }
    });

    test('a rotation interval below a second is held to one second', async () => {
        vi.useFakeTimers();
        try {
            const { genHtmlForegroundMessage } =
                await import('./screenForegroundHelpers');
            const animData = {
                duration: 0,
                styleText: '',
                animIn: vi.fn(
                    async (element: HTMLElement, parent: HTMLElement) => {
                        parent.appendChild(element);
                    },
                ),
                animOut: vi.fn(async () => {}),
            };
            const parent = document.createElement('div');
            const message = genHtmlForegroundMessage(
                { id: 'm4', textList: ['A', 'B'], intervalSecond: 0 } as any,
                animData,
            );
            await message.handleAdding(parent);
            const element = parent.firstElementChild as HTMLElement;
            await vi.advanceTimersByTimeAsync(999);
            expect(element.style.opacity).toBe('');
            await vi.advanceTimersByTimeAsync(1);
            expect(element.style.opacity).toBe('0');
            await message.handleRemoving();
        } finally {
            vi.useRealTimers();
        }
    });

    test('a timer start, pause or reset is taken in place; anything else is not', async () => {
        const { genHtmlForegroundCountdown, genHtmlForegroundStopwatch } =
            await import('./screenForegroundHelpers');
        const animData = {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };
        const parent = document.createElement('div');
        const countdownData = {
            dateTime: new Date(Date.now() + 60_000),
            extraStyle: { color: 'white' },
        };
        const countdown = genHtmlForegroundCountdown(countdownData, animData);
        await countdown.handleAdding(parent);
        // Paused: only the timing moved.
        expect(
            countdown.handleUpdating({
                ...countdownData,
                dateTime: new Date(Date.now() + 30_000),
                pausedMillisecond: 30_000,
            } as any),
        ).toBe(true);
        // Restyled: it has to be drawn again.
        expect(
            countdown.handleUpdating({
                ...countdownData,
                extraStyle: { color: 'yellow' },
            } as any),
        ).toBe(false);

        const stopwatchData = {
            dateTime: new Date(Date.now() - 60_000),
            extraStyle: {},
        };
        const stopwatch = genHtmlForegroundStopwatch(stopwatchData, animData);
        await stopwatch.handleAdding(parent);
        expect(
            stopwatch.handleUpdating({
                ...stopwatchData,
                dateTime: new Date(),
            } as any),
        ).toBe(true);
        expect(
            stopwatch.handleUpdating({
                ...stopwatchData,
                extraStyle: { fontSize: '40px' },
            } as any),
        ).toBe(false);

        await countdown.handleRemoving();
        await stopwatch.handleRemoving();
    });
});

describe('foreground messages and the timers already up', () => {
    function genAnimData() {
        return {
            duration: 0,
            styleText: '',
            animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            }),
            animOut: vi.fn(async () => {}),
        };
    }

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('one message stays put: every line shows and nothing ticks', async () => {
        const { genHtmlForegroundMessage } =
            await import('./screenForegroundHelpers');
        const { FOREGROUND_MESSAGE_CLASS } =
            await import('./foregroundMessageStackHelpers');
        const animData = genAnimData();
        const parent = document.createElement('div');
        const message = genHtmlForegroundMessage(
            {
                id: 'm1',
                // A blank line inside one message is the writer's, and stays.
                textList: ['Line one', '', 'Line <b>three</b>'],
                intervalSecond: null,
                extraStyle: { color: 'red' },
            } as any,
            animData,
        );
        await message.handleAdding(parent);
        const element = parent.firstElementChild as HTMLElement;
        expect(element.className).toBe(FOREGROUND_MESSAGE_CLASS);
        // Text, never markup.
        expect(element.textContent).toBe('Line one\n\nLine <b>three</b>');
        expect(element.querySelector('b')).toBeNull();
        expect(element.style.whiteSpace).toBe('pre-wrap');
        expect(element.style.color).toBe('red');
        expect(element.style.transition).toBe('');
        expect(vi.getTimerCount()).toBe(0);

        // One real entry has nothing to rotate to, interval or not.
        const single = genHtmlForegroundMessage(
            {
                id: 'm2',
                textList: ['  ', 'Only one'],
                intervalSecond: 3,
            } as any,
            animData,
        );
        await single.handleAdding(parent);
        expect(parent.lastElementChild!.textContent).toBe('  \nOnly one');
        expect(vi.getTimerCount()).toBe(0);

        await message.handleRemoving();
        expect(animData.animOut).toHaveBeenCalledWith(element);
    });

    test('several messages take turns, fading across, until taken down', async () => {
        const { genHtmlForegroundMessage } =
            await import('./screenForegroundHelpers');
        const animData = genAnimData();
        const parent = document.createElement('div');
        const message = genHtmlForegroundMessage(
            {
                id: 'm3',
                textList: ['First', '   ', 'Second', 'Third'],
                intervalSecond: 2,
            } as any,
            animData,
        );
        await message.handleAdding(parent);
        const element = parent.firstElementChild as HTMLElement;
        expect(element.textContent).toBe('First');
        expect(element.style.transition).toBe('opacity 400ms ease-in-out');

        await vi.advanceTimersByTimeAsync(2000);
        expect(element.style.opacity).toBe('0');
        expect(element.textContent).toBe('First');
        await vi.advanceTimersByTimeAsync(400);
        expect(element.textContent).toBe('Second');
        expect(element.style.opacity).toBe('1');
        await vi.advanceTimersByTimeAsync(2000);
        expect(element.textContent).toBe('Third');
        // ...and round again; the blank entry is never shown.
        await vi.advanceTimersByTimeAsync(2000);
        expect(element.textContent).toBe('First');

        // Taken down mid-fade: neither timer survives it.
        await vi.advanceTimersByTimeAsync(1700);
        expect(element.style.opacity).toBe('0');
        await message.handleRemoving();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(5000);
        expect(element.textContent).toBe('First');
        expect(animData.animOut).toHaveBeenCalledWith(element);
    });

    test('an interval under a second rotates once a second', async () => {
        const { genHtmlForegroundMessage } =
            await import('./screenForegroundHelpers');
        const parent = document.createElement('div');
        const message = genHtmlForegroundMessage(
            { id: 'm4', textList: ['A', 'B'], intervalSecond: 0 } as any,
            genAnimData(),
        );
        await message.handleAdding(parent);
        const element = parent.firstElementChild as HTMLElement;
        await vi.advanceTimersByTimeAsync(999);
        expect(element.style.opacity).toBe('');
        await vi.advanceTimersByTimeAsync(1 + 400);
        expect(element.textContent).toBe('B');
        await message.handleRemoving();
    });

    test('a countdown takes a start, pause or reset in place, but not a new look', async () => {
        const { genHtmlForegroundCountdown } =
            await import('./screenForegroundHelpers');
        const animData = genAnimData();
        const parent = document.createElement('div');
        const data = {
            dateTime: new Date(Date.now() + 60_000),
            durationMillisecond: 60_000,
            extraStyle: {},
        };
        const countdown = genHtmlForegroundCountdown(data as any, animData);
        await countdown.handleAdding(parent);
        const readClock = () => {
            return ['#hour', '#minute', '#second']
                .map((selector) => parent.querySelector(selector)!.textContent)
                .join(':');
        };

        const paused = { ...data, pausedMillisecond: 30_000 };
        expect(countdown.handleUpdating(paused as any)).toBe(true);
        expect(readClock()).toBe('00:00:30');
        // A different look is a different clock: left for a fresh one.
        expect(
            countdown.handleUpdating({
                ...paused,
                extraStyle: { color: 'red' },
            } as any),
        ).toBe(false);
        expect(readClock()).toBe('00:00:30');
        // Resumed from the PAUSED datum it now holds.
        expect(
            countdown.handleUpdating({
                ...data,
                dateTime: new Date(Date.now() + 45_000),
            } as any),
        ).toBe(true);
        expect(readClock()).toBe('00:00:45');
        await countdown.handleRemoving();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a stopwatch takes a pause in place, but not a different session', async () => {
        const { genHtmlForegroundStopwatch } =
            await import('./screenForegroundHelpers');
        const animData = genAnimData();
        const parent = document.createElement('div');
        const data = {
            id: 'a',
            dateTime: new Date(Date.now()),
            extraStyle: {},
        };
        const stopwatch = genHtmlForegroundStopwatch(data as any, animData);
        await stopwatch.handleAdding(parent);
        expect(
            stopwatch.handleUpdating({
                ...data,
                pausedMillisecond: 90_000,
            } as any),
        ).toBe(true);
        expect(parent.querySelector('#minute')!.textContent).toBe('01');
        expect(parent.querySelector('#second')!.textContent).toBe('30');
        expect(stopwatch.handleUpdating({ ...data, id: 'b' } as any)).toBe(
            false,
        );
        expect(parent.querySelector('#second')!.textContent).toBe('30');
        await stopwatch.handleRemoving();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('Bible and long text views at their edges', () => {
    test('no columns is an empty table, and a language with no data borrows the default one', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;
        const empty = await bibleScreenHelper.genHtmlFromLongTextColumns([], {
            isLineSync: false,
            isLongText: true,
        });
        expect(empty.tagName).toBe('TABLE');
        expect(empty.childElementCount).toBe(0);

        getLangDataAsyncMock.mockResolvedValueOnce(null as any);
        const view = await bibleScreenHelper.genHtmlFromLongTextColumns(
            [
                {
                    locale: 'xx-XX' as any,
                    code: 'XX',
                    title: 'Hymn',
                    sections: [{ num: '1', text: 'Line', key: 'lt-1' }],
                },
            ],
            { isLineSync: true, isLongText: true },
        );
        expect(
            getLangDataAsyncMock.mock.calls.map(([locale]) => locale),
        ).toEqual(['xx-XX', 'en-US']);
        const span = view.querySelector('span.highlight') as HTMLElement;
        expect(span.style.fontFamily).toContain('Font-en-US');
    });

    test('stacked, every language is in the same row under one header, each keeping its own look', async () => {
        const { LongTextTableComp } = await import('./bibleScreenComps');
        const genColumn = (
            locale: string,
            code: string,
            title: string,
            texts: string[],
            nums: string[],
        ) => {
            return {
                locale: locale as any,
                code,
                title,
                langData: {
                    genCss: () => '',
                    fontFamily: `Font-${code}`,
                } as any,
                sections: texts.map((text, i) => {
                    return { num: nums[i], text, key: `lt-${i + 1}` };
                }),
            };
        };
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[
                    genColumn(
                        'en-US',
                        'EN',
                        'Still',
                        ['Hide me', 'Cover me'],
                        ['1', '2'],
                    ),
                    {
                        ...genColumn('arc', 'AR', 'Psalm', ['shalom'], ['a']),
                        style: { fontSizeScale: 0.8 },
                    },
                ]}
                isLineSync
                isLongText
                isStacked
            />,
        );
        // One header for all: every code, every title.
        const headers = host.querySelectorAll('th');
        expect(headers).toHaveLength(1);
        expect(headers[0].querySelector('.bible-key')?.textContent).toBe(
            'EN | AR',
        );
        expect(headers[0].querySelector('.title')?.textContent).toBe(
            'Still | Psalm',
        );
        // A row is ONE cell: its numbers on a line, then each language.
        const rows = Array.from(host.querySelectorAll('tbody tr'));
        expect(rows).toHaveLength(2);
        const [firstRow, secondRow] = rows;
        expect(firstRow.querySelectorAll('td')).toHaveLength(1);
        expect(firstRow.querySelector('.verse-number')?.textContent).toBe(
            '1, a',
        );
        const lines = Array.from(
            firstRow.querySelectorAll<HTMLElement>('td > span[class]'),
        );
        expect(lines.map((line) => line.className)).toEqual([
            'screen-long-text-column-0',
            'screen-long-text-column-1',
        ]);
        expect(lines[1].getAttribute('dir')).toBe('rtl');
        expect(lines[1].style.textAlign).toBe('right');
        // Every line carries the row's key, and no number of its own.
        const spans = Array.from(
            firstRow.querySelectorAll<HTMLElement>('span.highlight'),
        );
        expect(spans.map((span) => span.dataset.kjvVerseKey)).toEqual([
            'lt-1',
            'lt-1',
        ]);
        expect(spans.map((span) => span.textContent)).toEqual([
            'Hide me',
            'shalom',
        ]);
        expect(spans[1].style.fontFamily).toContain('Font-AR');
        // A language that has ended draws nothing in the row.
        expect(secondRow.querySelectorAll('span.highlight')).toHaveLength(1);
        expect(secondRow.querySelector('.verse-number')?.textContent).toBe('2');
        // Its size still reaches its lines.
        expect(host.querySelector('style')?.textContent).toContain(
            '.screen-long-text-column-1 { font-size: 0.8em; }',
        );

        // Hide Number: no number line, and no number on any line.
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[
                    genColumn('en-US', 'EN', 'Still', ['Hide me'], ['1']),
                    genColumn('arc', 'AR', 'Psalm', ['shalom'], ['a']),
                ]}
                isLineSync
                isLongText
                isStacked
                isNumberHidden
            />,
        );
        expect(host.querySelector('.verse-number')).toBeNull();
        expect(host.querySelectorAll('span.highlight')).toHaveLength(2);
        // Side by side too.
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[
                    genColumn('en-US', 'EN', 'Still', ['Hide me'], ['1']),
                    genColumn('arc', 'AR', 'Psalm', ['shalom'], ['a']),
                ]}
                isLineSync
                isLongText
                isNumberHidden
            />,
        );
        expect(host.querySelectorAll('th')).toHaveLength(2);
        expect(host.querySelector('.verse-number')).toBeNull();
        expect(
            Array.from(host.querySelectorAll('span.highlight')).map(
                (span) => span.textContent,
            ),
        ).toEqual(['Hide me', 'shalom']);

        // One language is not stacked: there is nothing to stack.
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[genColumn('en-US', 'EN', 'Still', ['a'], ['1'])]}
                isLineSync
                isLongText
                isStacked
            />,
        );
        expect(host.querySelector('tbody td')?.className).toBe(
            'screen-long-text-column-0',
        );
    });

    test('a right-to-left column reads right to left; a language with no font sets none', async () => {
        const { LongTextTableComp } = await import('./bibleScreenComps');
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(
            <LongTextTableComp
                columns={[
                    {
                        locale: 'arc' as any,
                        code: 'AR',
                        title: 'Psalm',
                        langData: { genCss: () => '' } as any,
                        sections: [{ num: '1', text: 'shalom', key: 'lt-1' }],
                    },
                    {
                        locale: 'en-US' as any,
                        code: 'EN',
                        title: 'Psalm',
                        langData: { genCss: () => '' } as any,
                        sections: [{ num: '1', text: 'peace', key: 'lt-1' }],
                    },
                ]}
                isLineSync={false}
                isLongText
            />,
        );
        const [rtlHeader, ltrHeader] = Array.from(
            host.querySelectorAll<HTMLElement>('th'),
        );
        expect(rtlHeader.getAttribute('dir')).toBe('rtl');
        expect(rtlHeader.style.textAlign).toBe('right');
        expect(ltrHeader.hasAttribute('dir')).toBe(false);
        expect(ltrHeader.style.textAlign).toBe('');
        const [rtlCell, ltrCell] = Array.from(
            host.querySelectorAll<HTMLElement>('tbody td'),
        );
        expect(rtlCell.getAttribute('dir')).toBe('rtl');
        expect(ltrCell.hasAttribute('dir')).toBe(false);
        expect(rtlHeader.style.fontFamily).toBe('');
        expect(
            (rtlCell.querySelector('span.highlight') as HTMLElement).style
                .fontFamily,
        ).toBe('');
    });

    test('a Bible name lights on hover, and a double click on the next-chapter button selects nothing', async () => {
        const bibleScreenHelper = (await import('./bibleScreenHelpers'))
            .default;
        const bibleItem = {
            bibleKey: 'KJV',
            target: {
                bookKey: 'GEN',
                chapter: 1,
                verseStart: 1,
                verseEnd: 2,
                chapterEnd: 3,
            },
            toTitle: vi.fn(async () => 'Genesis 1:1-3:2'),
        } as any;
        const [rendered] = await bibleScreenHelper.genBibleItemRenderList([
            bibleItem,
        ]);
        const screenView =
            await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
                [rendered, { ...rendered, bibleKey: 'NIV' }],
                true,
                'Show the next chapter',
            );
        const onSelectKey = vi.fn();
        bibleScreenHelper.registerHighlight(screenView, {
            onSelectKey,
            onBibleSelect: vi.fn(),
        });
        const bibleName = screenView.querySelector(
            'div.bible-name[data-index="1"]',
        ) as HTMLElement;
        bibleName.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(bibleName.classList.contains('hover')).toBe(true);
        expect(
            screenView.querySelectorAll('div.bible-name.hover'),
        ).toHaveLength(1);
        bibleName.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        expect(bibleName.classList.contains('hover')).toBe(false);

        const onRootDoubleClick = vi.fn();
        screenView.addEventListener('dblclick', onRootDoubleClick);
        const moreButton = screenView.querySelector(
            '[data-bible-more-chapter]',
        ) as HTMLButtonElement;
        moreButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(onRootDoubleClick).not.toHaveBeenCalled();
        expect(onSelectKey).not.toHaveBeenCalled();
        // With no handler of its own, a click still selects no verse.
        moreButton.click();
        expect(onSelectKey).not.toHaveBeenCalled();
    });
});
