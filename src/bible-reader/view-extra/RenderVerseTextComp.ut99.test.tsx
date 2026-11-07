// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        viewController: null as any,
        shortVerses: {} as Record<string, string[]>,
        readerHomePage: false,
        isPageReader: false,
        isAutoPlay: false,
        isAudioEnabled: false,
        isVisible: true,
        lookupLangCode: null as string | null,
        getVerseTextLookupLangCode: vi.fn(),
        revealBibleNoteRefs: vi.fn(),
        getSelectedText: vi.fn(),
        bibleTextToSpeech: vi.fn(),
        checkIsAIAudioAvailableForBible: vi.fn(),
        checkIsVerticalPartialInvisible: vi.fn(),
        playMediaElement: vi.fn(),
        showAppContextMenu: vi.fn(),
        reformCustomTitle: vi.fn(),
    };
});

vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    revealBibleNoteRefs: h.revealBibleNoteRefs,
    useShortBibleNoteVerses: () => h.shortVerses,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/textSelectionHelpers', () => ({
    getSelectedText: h.getSelectedText,
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({ src: `file://${filePath}` }),
    },
}));
vi.mock('../../helper/ai/openAIAudioHelpers', () => ({
    bibleTextToSpeech: h.bibleTextToSpeech,
    checkIsAIAudioAvailableForBible: h.checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled: () => ({
        isAudioEnabled: h.isAudioEnabled,
        isAvailable: true,
    }),
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        get readerHomePage() {
            return h.readerHomePage;
        },
        get isPageReader() {
            return h.isPageReader;
        },
    },
}));
vi.mock('../../helper/ai/aiHelpers', () => ({
    getAIIsAutoPlay: () => h.isAutoPlay,
}));
vi.mock('../../helper/helpers', () => ({
    checkIsVerticalPartialInvisible: h.checkIsVerticalPartialInvisible,
}));
vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: h.playMediaElement,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <span className="loading" />,
}));
vi.mock('../../helper/domHelpers', () => ({
    HoverMotionHandler: { lowVisibleClassname: 'app-low-hover-visible' },
}));
vi.mock('../../location-name-lookup/RenderVerseLookupTextComp', () => ({
    default: ({ text, kjvShortVerse, lookupLangCode }: any) => (
        <span
            className="lookup-text"
            data-kjv={kjvShortVerse}
            data-lang={lookupLangCode}
        >
            {text}
        </span>
    ),
}));
vi.mock('../../location-name-lookup/RenderCustomVerseLookupComp', () => ({
    default: ({ customHtml, kjvShortVerse, lookupLangCode }: any) => (
        <span
            className="lookup-custom"
            data-html={customHtml}
            data-kjv={kjvShortVerse}
            data-lang={lookupLangCode}
        />
    ),
}));
vi.mock('../../location-name-lookup/verseTextIndexHelpers', () => ({
    getVerseTextLookupLangCode: h.getVerseTextLookupLangCode,
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers3', () => ({
    reformCustomTitle: h.reformCustomTitle,
}));
vi.mock('../../helper/bibleViewHelpers', () => ({
    VERSE_TEXT_CLASS: 'verse-text',
}));

import RenderVerseTextComp from './RenderVerseTextComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = {
    id: 1,
    bibleKey: 'KJV',
    extraBibleKeys: [],
    target: { bookKey: 'GEN', chapter: 1, verseStart: 1, verseEnd: 3 },
} as any;

function genVerse(verse: number, overrides: Record<string, unknown> = {}) {
    return {
        verse,
        localeVerse: `${verse}`,
        text: `Verse ${verse} text`,
        customText: null,
        isNewLine: false,
        isModelNewLine: false,
        newLineTitlesHtmlText: null,
        bibleKey: 'KJV',
        bookKey: 'GEN',
        chapter: 1,
        kjvBibleVersesKey: `GEN 1:${verse}`,
        bibleVersesKey: `(KJV) GEN 1:${verse}`,
        isFirst: false,
        isLast: false,
        isChapterStart: false,
        localeChapter: '1',
        isRtl: false,
        style: {},
        locale: 'en-US',
        ...overrides,
    } as any;
}

let host: HTMLDivElement;
let root: Root;
let pauseSpy: ReturnType<typeof vi.spyOn>;

async function flush() {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

async function renderVerses(verseList: any[], extraList: any[][] = []) {
    await act(async () => {
        root.render(
            <div className="verse-list">
                {verseList.map((verseInfo, i) => {
                    return (
                        <RenderVerseTextComp
                            key={verseInfo.kjvBibleVersesKey}
                            bibleItem={bibleItem}
                            verseInfo={verseInfo}
                            nextVerseInfo={verseList[i + 1] ?? null}
                            extraVerseInfoList={extraList[i]}
                            index={i}
                        />
                    );
                })}
            </div>,
        );
    });
}

async function dispatch(target: Element | null, event: Event) {
    if (target === null) {
        throw new Error('no target');
    }
    await act(async () => {
        target.dispatchEvent(event);
        await flush();
    });
}

function click(target: Element | null, init: MouseEventInit = {}) {
    return dispatch(
        target,
        new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
    );
}

function doubleClick(target: Element | null) {
    return dispatch(
        target,
        new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    );
}

function getVerseText(verse: number) {
    return host.querySelector<HTMLDivElement>(
        `.verse-text[data-kjv-verse-key="GEN 1:${verse}"]`,
    );
}

// The number spans, without the spacer a new line puts before them.
function getNumberSpans() {
    return Array.from(
        host.querySelectorAll<HTMLSpanElement>(
            '.verse-number .verse-number-text',
        ),
    ).filter((span) => {
        return span.textContent !== '  ';
    });
}

function getAudio(verse: number) {
    return getVerseText(verse)!.querySelector<HTMLAudioElement>('audio');
}

beforeEach(() => {
    vi.useFakeTimers();
    h.viewController = {
        shouldNewLine: true,
        shouldModelNewLine: false,
        shouldSelectFirstItem: false,
        isLookup: false,
        handleVersesSelecting: vi.fn(),
        applyTargetOrBibleKey: vi.fn(),
        tryJumpingChapter: vi.fn(),
    };
    h.shortVerses = {};
    h.readerHomePage = false;
    h.isPageReader = false;
    h.isAutoPlay = false;
    h.isAudioEnabled = false;
    h.isVisible = true;
    h.lookupLangCode = null;
    h.getVerseTextLookupLangCode.mockImplementation(() => h.lookupLangCode);
    h.getSelectedText.mockReturnValue(null);
    h.checkIsAIAudioAvailableForBible.mockResolvedValue(false);
    h.bibleTextToSpeech.mockResolvedValue(null);
    h.checkIsVerticalPartialInvisible.mockReturnValue(false);
    h.playMediaElement.mockResolvedValue(undefined);
    // jsdom draws nothing, so it has no visibility to check, and its media
    // elements cannot pause.
    (HTMLElement.prototype as any).checkVisibility = () => h.isVisible;
    pauseSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {});
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    globalThis.getSelection()?.removeAllRanges();
    delete (HTMLElement.prototype as any).checkVisibility;
    pauseSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('the verse number', () => {
    test('shows the number as the bible writes it, with what a press does', async () => {
        await renderVerses([genVerse(3, { localeVerse: '３' })]);
        const number = host.querySelector('.verse-number')!;
        expect(number.className).toBe('verse-number app-caught-hover-pointer');
        expect(number.getAttribute('title')).toBe(
            'Click to reveal the bible notes of this verse, ' +
                'double click to select verse ３',
        );
        expect(getNumberSpans().map((span) => span.textContent)).toEqual([
            '３',
        ]);
    });

    test('one click on a noted verse reveals its notes, after the double-click window', async () => {
        h.shortVerses = { 'GEN 1:3': ['/notes/a.own@1', '/notes/b.own@2'] };
        await renderVerses([genVerse(3)]);
        const [numberSpan] = getNumberSpans();
        expect(numberSpan.getAttribute('data-bible-id')).toBe(
            '/notes/a.own@1,/notes/b.own@2',
        );
        await click(numberSpan);
        await advance(399);
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
        await advance(1);
        expect(h.revealBibleNoteRefs).toHaveBeenCalledWith([
            '/notes/a.own@1',
            '/notes/b.own@2',
        ]);
    });

    test('a verse no note mentions reveals nothing', async () => {
        await renderVerses([genVerse(3)]);
        const [numberSpan] = getNumberSpans();
        expect(numberSpan.hasAttribute('data-bible-id')).toBe(false);
        await click(numberSpan);
        await advance(1000);
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
    });

    test('a double click selects the verse in its own chapter, and reveals nothing', async () => {
        h.shortVerses = { 'GEN 2:5': ['/notes/a.own@1'] };
        await renderVerses([
            genVerse(5, { chapter: 2, kjvBibleVersesKey: 'GEN 2:5' }),
        ]);
        const [numberSpan] = getNumberSpans();
        // The browser's own order: two clicks, then the dblclick.
        await click(numberSpan);
        await click(numberSpan);
        await doubleClick(numberSpan);
        await advance(1000);
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 2,
                    verseStart: 5,
                    verseEnd: 5,
                },
            },
        );
        // The verse number is not the verse text: nothing was toggled.
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
    });

    test('a verse that goes away takes its pending reveal with it', async () => {
        h.shortVerses = { 'GEN 1:3': ['/notes/a.own@1'] };
        await renderVerses([genVerse(3)]);
        await click(getNumberSpans()[0]);
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        await advance(1000);
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
    });

    test('the press sweeps away a leftover caret, not a selection made since', async () => {
        await renderVerses([genVerse(3)]);
        const selection = globalThis.getSelection()!;
        const textNode = getVerseText(3)!.querySelector(
            '[data-bible-verse-key]',
        )!.firstChild!;

        selection.collapse(textNode, 2);
        await click(getNumberSpans()[0]);
        await advance(1999);
        expect(selection.rangeCount).toBe(1);
        await advance(1);
        expect(selection.rangeCount).toBe(0);

        await click(getNumberSpans()[0]);
        selection.setBaseAndExtent(textNode, 0, textNode, 5);
        await advance(2000);
        expect(selection.toString()).toBe('Verse');
    });

    test('with nothing left selected the sweep has nothing to clear', async () => {
        await renderVerses([genVerse(3)]);
        const selection = globalThis.getSelection()!;
        await click(getNumberSpans()[0]);
        selection.removeAllRanges();
        const removeAllRanges = vi.spyOn(selection, 'removeAllRanges');
        await advance(2000);
        expect(removeAllRanges).not.toHaveBeenCalled();
    });
});

describe('dividers and new lines', () => {
    test('a chapter start of a passage across chapters carries the divider', async () => {
        await renderVerses([
            genVerse(1, {
                chapter: 2,
                kjvBibleVersesKey: 'GEN 2:1',
                isChapterStart: true,
                localeChapter: '２',
                style: { fontFamily: 'Script Face' },
                // The divider is the line break: no `<br>` above it.
                isNewLine: true,
            }),
        ]);
        const divider = host.querySelector('.bible-chapter-divider')!;
        expect(divider.getAttribute('role')).toBe('separator');
        expect(divider.getAttribute('aria-label')).toBe('Chapter ２');
        const label = divider.querySelector<HTMLElement>(
            '.bible-chapter-divider-label',
        )!;
        expect(label.textContent).toBe('２');
        expect(label.style.fontFamily).toBe('Script Face');
        expect(host.querySelectorAll('br')).toHaveLength(0);
    });

    test('new lines follow the bible, with its titles above the verse', async () => {
        await renderVerses([
            genVerse(1, {
                isNewLine: true,
                newLineTitlesHtmlText: '<b>The Creation</b>',
            }),
            genVerse(2),
            genVerse(3, {
                isNewLine: true,
                newLineTitlesHtmlText: '<b>The Fall</b>',
            }),
            genVerse(4, { isNewLine: true }),
        ]);
        const titleList = Array.from(host.querySelectorAll('.mt-2'));
        expect(titleList.map((title) => title.innerHTML)).toEqual([
            '<span><b>The Creation</b></span>',
            '<span><b>The Fall</b></span>',
        ]);
        // The first verse's title starts the view; the others break a line.
        expect(titleList[0].previousElementSibling?.tagName).not.toBe('BR');
        expect(titleList[1].previousElementSibling?.tagName).toBe('BR');
        expect(host.querySelectorAll('br')).toHaveLength(2);
        expect(h.reformCustomTitle).toHaveBeenCalledWith(
            h.viewController,
            bibleItem,
            titleList[0].firstElementChild,
        );
        // A verse that starts a line is indented by a spacer.
        expect(
            Array.from(
                host.querySelectorAll('.verse-number .verse-number-text'),
            ).filter((span) => span.textContent === '  '),
        ).toHaveLength(3);
    });

    test('with new lines off, nothing breaks', async () => {
        h.viewController.shouldNewLine = false;
        await renderVerses([
            genVerse(1),
            genVerse(2, {
                isNewLine: true,
                newLineTitlesHtmlText: '<b>Title</b>',
            }),
            genVerse(3, { isNewLine: true }),
        ]);
        expect(host.querySelectorAll('br')).toHaveLength(0);
        expect(host.querySelector('.mt-2')).toBeNull();
    });

    test("the model's own line breaks only when asked for", async () => {
        await renderVerses([
            genVerse(1),
            genVerse(2, { isModelNewLine: true }),
        ]);
        expect(host.querySelectorAll('br')).toHaveLength(0);

        h.viewController.shouldModelNewLine = true;
        await renderVerses([
            genVerse(1),
            genVerse(2, { isModelNewLine: true, text: 'again' }),
        ]);
        expect(host.querySelectorAll('br')).toHaveLength(1);
    });
});

describe('the verse text', () => {
    test('one bible: the text is the mark anchor, in the bible locale', async () => {
        await renderVerses([genVerse(3, { style: { color: 'red' } })]);
        const verseText = getVerseText(3)!;
        expect(verseText.className).toBe('verse-text');
        expect(verseText.dataset).toMatchObject({
            kjvVerseKey: 'GEN 1:3',
            verseKey: '(KJV) GEN 1:3',
            isFirst: '0',
            isLast: '0',
        });
        const anchor = verseText.querySelector<HTMLElement>(
            '[data-bible-verse-key]',
        )!;
        expect(anchor.getAttribute('data-bible-verse-key')).toBe(
            '(KJV) GEN 1:3',
        );
        expect(anchor.getAttribute('data-dict-locale')).toBe('en-US');
        expect(anchor.style.color).toBe('red');
        expect(anchor.textContent).toBe('Verse 3 text');
        expect(h.getVerseTextLookupLangCode).toHaveBeenCalledWith(
            'KJV',
            'en-US',
        );
        // Only the Reader's verses carry their own ⋮.
        expect(verseText.querySelector('.app-context-menu-dots')).toBeNull();
    });

    test('compared bibles: one numbered row of each, the keys muted after', async () => {
        await renderVerses(
            [genVerse(3, { isNewLine: true })],
            [
                [
                    genVerse(3, {
                        bibleKey: 'XXB',
                        localeVerse: '３',
                        bibleVersesKey: '(XXB) GEN 1:3',
                        text: 'Other text',
                        locale: 'xx',
                        isRtl: true,
                    }),
                ],
            ],
        );
        const number = host.querySelector('.verse-number')!;
        expect(number.className).toContain('extra-verses');
        expect(getNumberSpans().map((span) => span.textContent)).toEqual([
            '3',
            '３',
        ]);
        expect(number.textContent).toBe('  3, ３');
        // Compared bibles never break lines.
        expect(host.querySelectorAll('br')).toHaveLength(0);
        const verseText = getVerseText(3)!;
        expect(verseText.className).toBe('verse-text extra-verses');
        const rowList = Array.from(verseText.querySelectorAll('.text.d-flex'));
        expect(
            rowList.map((row) => {
                return [
                    row.getAttribute('data-dict-locale'),
                    row.querySelector('[data-bible-verse-key]')!.textContent,
                    row.querySelector('.text-muted')!.textContent,
                    row.firstElementChild!.className,
                ];
            }),
        ).toEqual([
            [
                'en-US',
                'Verse 3 text',
                'KJV',
                'app-top-hover-motion-10 flex-fill',
            ],
            [
                'xx',
                'Other text',
                'XXB',
                'app-top-hover-motion-10 flex-fill rtl',
            ],
        ]);
        expect(
            rowList[1]
                .querySelector('[data-bible-verse-key]')!
                .getAttribute('data-bible-verse-key'),
        ).toBe('(XXB) GEN 1:3');
    });

    test('text the lookup can decorate goes through the lookup', async () => {
        h.lookupLangCode = 'en';
        await renderVerses([genVerse(3)]);
        const lookupText = getVerseText(3)!.querySelector('.lookup-text')!;
        expect(lookupText.textContent).toBe('Verse 3 text');
        expect(lookupText.getAttribute('data-kjv')).toBe('GEN 1:3');
        expect(lookupText.getAttribute('data-lang')).toBe('en');
    });

    test('custom verse html: sanitized, and decorated when the lookup can', async () => {
        await renderVerses([
            genVerse(3, {
                customText:
                    '<i class="woc">Jesus wept</i><script>alert(1)</script>',
            }),
        ]);
        const anchor = getVerseText(3)!.querySelector(
            '[data-bible-verse-key]',
        )!;
        expect(anchor.innerHTML).toBe(
            '<span><i class="woc">Jesus wept</i></span>',
        );
        expect(h.reformCustomTitle).toHaveBeenCalledWith(
            h.viewController,
            bibleItem,
            anchor.firstElementChild,
        );

        h.lookupLangCode = 'en';
        await renderVerses([genVerse(4, { customText: '<i>Lazarus</i>' })]);
        const lookupCustom = getVerseText(4)!.querySelector('.lookup-custom')!;
        expect(lookupCustom.getAttribute('data-html')).toBe('<i>Lazarus</i>');
        expect(lookupCustom.getAttribute('data-kjv')).toBe('GEN 1:4');
        expect(lookupCustom.getAttribute('data-lang')).toBe('en');
    });

    // Pressing it is `ContextMenuDotsButtonComp`'s own business (and its
    // `view: window` event is refused by this jsdom); what the verse owes is
    // the button, FIRST, so it sits on the verse's own line.
    test('in the Reader each verse carries its ⋮, first', async () => {
        h.readerHomePage = true;
        await renderVerses([genVerse(3)]);
        const dots = getVerseText(3)!.firstElementChild!;
        expect(dots.tagName).toBe('BUTTON');
        expect(dots.className).toContain('app-context-menu-dots');
        expect(dots.getAttribute('aria-label')).toBe('More Options');
        expect(dots.nextElementSibling!.textContent).toBe('Verse 3 text');
    });
});

describe('selecting a verse', () => {
    test('a click selects the verse, unless it ended a text selection', async () => {
        await renderVerses([genVerse(3)]);
        h.getSelectedText.mockReturnValue('Verse 3');
        await click(getVerseText(3));
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();

        h.getSelectedText.mockReturnValue('');
        await click(getVerseText(3), { altKey: true });
        expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
            getVerseText(3),
            true,
            false,
            bibleItem,
        );
    });

    test('a double click on a word leaves the verse selected, and goes no further', async () => {
        await renderVerses([genVerse(3)]);
        const seenDoubleClicks: Event[] = [];
        const handleDoubleClick = (event: Event) => {
            seenDoubleClicks.push(event);
        };
        document.body.addEventListener('dblclick', handleDoubleClick);
        try {
            await doubleClick(getVerseText(3));
            expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
                getVerseText(3),
                false,
                true,
                bibleItem,
            );

            h.viewController.handleVersesSelecting.mockClear();
            getVerseText(3)!.classList.add('selected');
            await doubleClick(getVerseText(3));
            expect(
                h.viewController.handleVersesSelecting,
            ).not.toHaveBeenCalled();
        } finally {
            document.body.removeEventListener('dblclick', handleDoubleClick);
        }
        expect(seenDoubleClicks).toHaveLength(0);
    });

    test('a passage asked to select its first verse selects it, once', async () => {
        h.viewController.shouldSelectFirstItem = true;
        await renderVerses([genVerse(1, { isFirst: true }), genVerse(2)]);
        expect(h.viewController.shouldSelectFirstItem).toBe(false);
        expect(h.viewController.handleVersesSelecting).toHaveBeenCalledTimes(1);
        expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
            getVerseText(1),
            false,
            false,
            bibleItem,
        );
        expect(getVerseText(1)!.dataset.isFirst).toBe('1');
    });

    test('nothing is selected for a first verse nobody asked for', async () => {
        await renderVerses([genVerse(1, { isFirst: true, isLast: true })]);
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
        expect(getVerseText(1)!.dataset.isLast).toBe('1');
    });
});

describe('verse audio', () => {
    function enableAudio() {
        h.isAudioEnabled = true;
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
    }

    test('with audio off for this bible, a selected verse fetches none', async () => {
        await renderVerses([genVerse(3)]);
        await click(getVerseText(3));
        expect(h.checkIsAIAudioAvailableForBible).toHaveBeenCalledWith(
            bibleItem,
        );
        expect(h.bibleTextToSpeech).not.toHaveBeenCalled();
        expect(host.querySelector('.verse-audio')).toBeNull();
    });

    test('a selected verse shows a wait, then its player', async () => {
        enableAudio();
        let resolveSpeech: (filePath: string | null) => void = () => {};
        h.bibleTextToSpeech.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveSpeech = resolve;
            }),
        );
        const verse = genVerse(3);
        await renderVerses([verse]);
        await click(getVerseText(3));
        expect(h.bibleTextToSpeech).toHaveBeenCalledWith(verse, undefined);
        const waiting = getVerseText(3)!.querySelector('div.verse-audio')!;
        expect(waiting.querySelector('.loading')).not.toBeNull();

        await act(async () => {
            resolveSpeech('/data/bible-audio/KJV/GEN/1/3.mp3');
            await flush();
        });
        const audio = getAudio(3)!;
        expect(audio.querySelector('source')!.getAttribute('src')).toBe(
            'file:///data/bible-audio/KJV/GEN/1/3.mp3',
        );
        expect(audio.hasAttribute('controls')).toBe(true);
        expect(audio.textContent).toBe('Browser does not support audio.');
        expect(getVerseText(3)!.querySelector('div.verse-audio')).toBeNull();
        // Not the Reader: nothing plays by itself.
        expect(h.playMediaElement).not.toHaveBeenCalled();
    });

    test('speech that could not be made leaves no player', async () => {
        enableAudio();
        await renderVerses([genVerse(3)]);
        await click(getVerseText(3));
        expect(h.bibleTextToSpeech).toHaveBeenCalledTimes(1);
        expect(host.querySelector('.verse-audio')).toBeNull();
    });

    test("the player's menu, or its ⋮, offers Refresh, which makes the audio again", async () => {
        enableAudio();
        h.bibleTextToSpeech.mockResolvedValue('/a/3.mp3');
        const verse = genVerse(3);
        await renderVerses([verse]);
        await click(getVerseText(3));
        await dispatch(
            getAudio(3),
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [, itemList] = h.showAppContextMenu.mock.calls[0];
        expect(itemList).toHaveLength(1);
        expect(itemList[0].menuElement).toBe('Refresh');
        expect(itemList[0].childBefore.props.className).toBe(
            'bi bi-arrow-clockwise',
        );

        await click(
            getAudio(3)!.parentElement!.querySelector('.app-context-menu-dots'),
        );
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(2);

        await act(async () => {
            itemList[0].onSelect();
            await flush();
        });
        expect(h.bibleTextToSpeech).toHaveBeenLastCalledWith(verse, true);
    });

    test('playing one verse pauses every other', async () => {
        enableAudio();
        h.bibleTextToSpeech.mockResolvedValue('/a/verse.mp3');
        await renderVerses([genVerse(1), genVerse(2)]);
        await click(getVerseText(1));
        await click(getVerseText(2));
        await dispatch(getAudio(1), new Event('play'));
        expect(pauseSpy.mock.contexts).toEqual([getAudio(2)]);
    });

    describe('in the Reader with auto play', () => {
        beforeEach(() => {
            enableAudio();
            h.isPageReader = true;
            h.isAutoPlay = true;
            h.bibleTextToSpeech.mockResolvedValue('/a/verse.mp3');
        });

        test('a verse plays by itself and reads the next one ahead', async () => {
            const verseList = [genVerse(1), genVerse(2)];
            await renderVerses(verseList);
            await click(getVerseText(1));
            const audio = getAudio(1)!;
            expect(h.playMediaElement).toHaveBeenCalledWith(audio);
            expect(h.bibleTextToSpeech.mock.calls).toEqual([
                [verseList[0], undefined],
                [verseList[1]],
            ]);
        });

        test('the last verse reads nothing ahead', async () => {
            await renderVerses([genVerse(1)]);
            await click(getVerseText(1));
            expect(h.playMediaElement).toHaveBeenCalledTimes(1);
            expect(h.bibleTextToSpeech).toHaveBeenCalledTimes(1);
        });

        test('a player that cannot be seen does not start', async () => {
            h.isVisible = false;
            await renderVerses([genVerse(1), genVerse(2)]);
            await click(getVerseText(1));
            expect(getAudio(1)).not.toBeNull();
            expect(h.playMediaElement).not.toHaveBeenCalled();
            expect(h.bibleTextToSpeech).toHaveBeenCalledTimes(1);
        });

        test('a verse that ends selects the next one', async () => {
            await renderVerses([genVerse(1), genVerse(2)]);
            await click(getVerseText(1));
            h.viewController.handleVersesSelecting.mockClear();
            await dispatch(getAudio(1), new Event('ended'));
            expect(h.checkIsVerticalPartialInvisible).toHaveBeenCalledWith(
                host,
                getVerseText(2),
            );
            expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
                getVerseText(2),
                false,
                false,
                bibleItem,
            );
        });

        test('a next verse partly out of view is brought in with a double click', async () => {
            h.checkIsVerticalPartialInvisible.mockReturnValue(true);
            await renderVerses([genVerse(1), genVerse(2)]);
            await click(getVerseText(1));
            h.viewController.handleVersesSelecting.mockClear();
            await dispatch(getAudio(1), new Event('ended'));
            expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
                getVerseText(2),
                false,
                true,
                bibleItem,
            );
        });

        test('an end nobody can see moves nothing', async () => {
            await renderVerses([genVerse(1), genVerse(2)]);
            await click(getVerseText(1));
            h.viewController.handleVersesSelecting.mockClear();
            h.isVisible = false;
            await dispatch(getAudio(1), new Event('ended'));
            expect(
                h.viewController.handleVersesSelecting,
            ).not.toHaveBeenCalled();
        });

        test('a next verse that is not drawn here moves nothing', async () => {
            const verse = genVerse(1);
            await act(async () => {
                root.render(
                    <div>
                        <RenderVerseTextComp
                            bibleItem={bibleItem}
                            verseInfo={verse}
                            nextVerseInfo={genVerse(9)}
                            index={0}
                        />
                    </div>,
                );
            });
            await click(getVerseText(1));
            h.viewController.handleVersesSelecting.mockClear();
            await dispatch(getAudio(1), new Event('ended'));
            expect(h.checkIsVerticalPartialInvisible).not.toHaveBeenCalled();
            expect(
                h.viewController.handleVersesSelecting,
            ).not.toHaveBeenCalled();
        });

        test("the lookup's last verse turns to the next chapter", async () => {
            h.viewController.isLookup = true;
            await renderVerses([genVerse(1), genVerse(2, { isLast: true })]);
            await click(getVerseText(2));
            h.viewController.handleVersesSelecting.mockClear();
            await dispatch(getAudio(2), new Event('ended'));
            expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
                getVerseText(2),
                false,
                false,
                bibleItem,
            );
            expect(h.viewController.shouldSelectFirstItem).toBe(true);
            expect(h.viewController.tryJumpingChapter).toHaveBeenCalledWith(
                true,
            );
        });

        test('a last verse outside the lookup stays where it is', async () => {
            await renderVerses([genVerse(1, { isLast: true })]);
            await click(getVerseText(1));
            await dispatch(getAudio(1), new Event('ended'));
            expect(h.viewController.tryJumpingChapter).not.toHaveBeenCalled();
            expect(h.viewController.shouldSelectFirstItem).toBe(false);
        });
    });

    test('without auto play an ending moves nothing, even in the Reader', async () => {
        enableAudio();
        h.isPageReader = true;
        h.bibleTextToSpeech.mockResolvedValue('/a/verse.mp3');
        await renderVerses([genVerse(1), genVerse(2)]);
        await click(getVerseText(1));
        expect(h.playMediaElement).not.toHaveBeenCalled();
        h.viewController.handleVersesSelecting.mockClear();
        await dispatch(getAudio(1), new Event('ended'));
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
    });
});
