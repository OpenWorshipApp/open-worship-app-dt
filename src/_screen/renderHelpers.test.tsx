// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fileSourceGetInstance = vi.fn((filePath: string) => ({ filePath }));
const applyTextStyleMock = vi.fn();
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
    getBibleLocale: getBibleLocaleMock,
    toLocaleNumBible: toLocaleNumBibleMock,
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
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstance,
    },
}));

vi.mock('../background/RenderBackgroundWebIframeComp', () => ({
    default: ({ src, width, height, targetWidth, targetHeight }: any) => {
        return (
            <iframe
                data-file-path={src.filePath}
                width={width}
                height={height}
                data-target-width={targetWidth}
                data-target-height={targetHeight}
                title="background-web"
            />
        );
    },
}));

vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => {
        return html.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    },
}));

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
    useScreenBibleManagerEvents: vi.fn(),
}));

vi.mock('./managers/ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static readonly textStyleTextColor = '#123456';
        static readonly textStyleTextFontSize = 64;

        static applyTextStyle(style: unknown) {
            applyTextStyleMock(style);
        }
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
        const { BibleBibleTable } = await import('./bibleScreenComps');

        const html = renderToStaticMarkup(
            <BibleBibleTable
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
                versesCount={2}
            />,
        );

        expect(html).toContain('Genesis 1:1-2');
        expect(html).toContain('data-kjv-verse-key="GEN-1-1"');
        expect(html).toContain('data-kjv-verse-key="GEN-1-2"');
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

    test('renders marquee and quick text foreground DOM helpers', async () => {
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

        const marquee = genHtmlForegroundMarquee(
            { text: 'Hello there', extraStyle: {} },
            { height: 768 } as any,
        );
        expect(marquee.element.textContent).toContain('Hello there');
        const removing = marquee.handleRemoving();
        await vi.advanceTimersByTimeAsync(Math.ceil((11 / 6) * 1000) + 500);
        await removing;
        expect(marquee.element.querySelector('p.out')).not.toBeNull();

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

        const web = genHtmlForegroundWeb(
            {
                filePath: '/tmp/web.html',
                widthScale: 0.5,
                heightScale: 0.5,
                extraStyle: { opacity: 0.5 },
            },
            animData,
            { width: 1920, height: 1080 },
        );
        await web.handleAdding(parent);

        expect(animData.animIn).toHaveBeenCalledTimes(4);
        expect(fileSourceGetInstance).toHaveBeenCalledWith('/tmp/web.html');
        expect(parent.querySelector('iframe')).not.toBeNull();
        expect(parent.textContent).toContain('Tokyo');
    });

    test('styling helpers expose current Bible style and apply updates', async () => {
        const { useStylingColor, useStylingFontSize } =
            await import('./preview/stylingHelpers');

        let setColorToStyle: ((color: `#${string}`) => void) | undefined;
        let setFontSizeToStyle: ((size: number) => void) | undefined;

        function HookHost() {
            const [color, setColor] = useStylingColor();
            const [fontSize, setFontSize] = useStylingFontSize();
            setColorToStyle = setColor;
            setFontSizeToStyle = setFontSize;
            return (
                <div data-color={color} data-font-size={fontSize.toString()} />
            );
        }

        const html = renderToStaticMarkup(<HookHost />);
        expect(html).toContain('data-color="#123456"');
        expect(html).toContain('data-font-size="64"');

        setColorToStyle?.('#abcdef');
        setFontSizeToStyle?.(72);

        expect(applyTextStyleMock).toHaveBeenNthCalledWith(1, {
            color: '#abcdef',
        });
        expect(applyTextStyleMock).toHaveBeenNthCalledWith(2, {
            fontSize: 72,
        });
    });

    test('shows deterministic preview icon colors per screen id', async () => {
        const { default: ShowingScreenIcon, genColorFromScreenId } =
            await import('./preview/ShowingScreenIcon');

        const color = genColorFromScreenId(3);
        expect(genColorFromScreenId(3)).toBe(color);

        const html = renderToStaticMarkup(<ShowingScreenIcon screenId={3} />);
        expect(html).toContain('Screen: 3');
        expect(html).toContain('data-screen-id="3"');
    });
});
