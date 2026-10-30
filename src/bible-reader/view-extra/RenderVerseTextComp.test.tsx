// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: {
        shouldNewLine: true,
        shouldModelNewLine: false,
        applyTargetOrBibleKey: vi.fn(),
    },
    shortVerses: {} as Record<string, string[]>,
    revealBibleNoteRefs: vi.fn(),
    detailProps: null as null | Record<string, unknown>,
}));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
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
vi.mock('../RenderCustomVerseComp', () => ({
    default: ({ customHtml }: { customHtml: string }) => (
        <span className="test-custom">{customHtml}</span>
    ),
}));
vi.mock('./RenderVerseTextDetailComp', () => ({
    default: (props: Record<string, unknown>) => {
        h.detailProps = props;
        return <div className="test-detail" />;
    },
}));

import RenderVerseTextComp from './RenderVerseTextComp';

const BIBLE_ITEM = { id: 3, bibleKey: 'KJV' } as any;

function genVerseInfo(overrides: Record<string, unknown> = {}) {
    return {
        verse: 3,
        localeVerse: '3',
        text: 'And God said',
        customText: null,
        isNewLine: false,
        isModelNewLine: false,
        newLineTitlesHtmlText: null,
        bibleKey: 'KJV',
        bookKey: 'GEN',
        chapter: 2,
        kjvBibleVersesKey: 'GEN 2:3',
        bibleVersesKey: '(KJV) GEN 2:3',
        isFirst: false,
        isLast: false,
        isChapterStart: false,
        localeChapter: '2',
        isRtl: false,
        style: { fontSize: '20px' },
        locale: 'en',
        ...overrides,
    } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.viewController.shouldNewLine = true;
    h.viewController.shouldModelNewLine = false;
    h.shortVerses = {};
    h.detailProps = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function render({
    verseInfo = genVerseInfo(),
    extraVerseInfoList = undefined as any[] | undefined,
    index = 1,
    nextVerseInfo = null as any,
} = {}) {
    await act(async () => {
        root.render(
            <RenderVerseTextComp
                bibleItem={BIBLE_ITEM}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                index={index}
            />,
        );
    });
}

// The clickable numbers, without the indent a new-line verse starts with.
function getNumberSpans() {
    return Array.from(
        host.querySelectorAll<HTMLSpanElement>(
            '.verse-number .verse-number-text',
        ),
    ).filter((span) => span.textContent !== '  ');
}

async function fire(element: HTMLElement, type: string) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent(type, { bubbles: true, cancelable: true }),
        );
    });
}

describe('the verse number', () => {
    test('names both gestures and hands the verse to its text', async () => {
        const verseInfo = genVerseInfo();
        const nextVerseInfo = genVerseInfo({ verse: 4 });
        await render({ verseInfo, nextVerseInfo, index: 2 });
        const verseNumber = host.querySelector('.verse-number')!;
        expect(verseNumber.getAttribute('title')).toBe(
            'Click to reveal the bible notes of this verse, double click ' +
                'to select verse 3',
        );
        expect(verseNumber.classList.contains('extra-verses')).toBe(false);
        expect(getNumberSpans().map((span) => span.textContent)).toEqual(['3']);
        expect(h.detailProps).toMatchObject({
            bibleItem: BIBLE_ITEM,
            verseInfo,
            nextVerseInfo,
            extraVerseInfoList: [],
            index: 2,
        });
    });

    test('a verse in compared bibles lists each bible its number', async () => {
        h.shortVerses = { 'GEN 2:3': ['/notes/a.own@1', '/notes/b.own@4'] };
        await render({
            extraVerseInfoList: [
                genVerseInfo({
                    bibleKey: 'KHM',
                    localeVerse: '៣',
                    kjvBibleVersesKey: 'GEN 2:4',
                }),
            ],
        });
        const verseNumber = host.querySelector('.verse-number')!;
        expect(verseNumber.classList.contains('extra-verses')).toBe(true);
        expect(verseNumber.textContent).toBe('3, ៣');
        const spans = getNumberSpans();
        // The notes are per verse key: only the KJV verse has any.
        expect(spans[0].dataset.bibleId).toBe('/notes/a.own@1,/notes/b.own@4');
        expect(spans[1].dataset.bibleId).toBeUndefined();
    });
});

describe('revealing the notes of a verse', () => {
    test('one click reveals the notes once the double-click window passes', async () => {
        h.shortVerses = { 'GEN 2:3': ['/notes/a.own@1', '/notes/b.own@4'] };
        await render();
        await fire(getNumberSpans()[0], 'click');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(399);
        });
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(h.revealBibleNoteRefs).toHaveBeenCalledWith([
            '/notes/a.own@1',
            '/notes/b.own@4',
        ]);
    });

    test('a verse no note mentions has nothing to reveal', async () => {
        await render();
        await fire(getNumberSpans()[0], 'click');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
    });

    test('a second click restarts the wait instead of revealing twice', async () => {
        h.shortVerses = { 'GEN 2:3': ['/notes/a.own@1'] };
        await render();
        const span = getNumberSpans()[0];
        await fire(span, 'click');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        await fire(span, 'click');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(h.revealBibleNoteRefs).toHaveBeenCalledOnce();
    });

    test('a double-click selects the verse and cancels the reveal', async () => {
        h.shortVerses = { 'GEN 2:3': ['/notes/a.own@1'] };
        await render({ verseInfo: genVerseInfo({ chapter: 5, verse: 7 }) });
        const span = getNumberSpans()[0];
        await fire(span, 'click');
        await fire(span, 'dblclick');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
        // The verse's OWN chapter, as a one-verse target.
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            BIBLE_ITEM,
            {
                target: {
                    bookKey: 'GEN',
                    chapter: 5,
                    verseStart: 7,
                    verseEnd: 7,
                },
            },
        );
    });

    test('a verse that is gone reveals nothing', async () => {
        h.shortVerses = { 'GEN 2:3': ['/notes/a.own@1'] };
        await render();
        await fire(getNumberSpans()[0], 'click');
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        expect(h.revealBibleNoteRefs).not.toHaveBeenCalled();
    });
});

describe('chapter dividers and new lines', () => {
    test('the first verse of a chapter starts under a divider, without a break', async () => {
        await render({
            verseInfo: genVerseInfo({
                isChapterStart: true,
                isNewLine: true,
                localeChapter: '2',
            }),
        });
        const divider = host.querySelector('[role="separator"]')!;
        expect(divider.getAttribute('aria-label')).toBe('Chapter 2');
        expect(divider.textContent).toBe('2');
        expect(host.querySelector('br')).toBeNull();
    });

    test('a new-line verse starts on its own line', async () => {
        await render({ verseInfo: genVerseInfo({ isNewLine: true }) });
        expect(host.querySelectorAll('br')).toHaveLength(1);
        expect(host.querySelector('[role="separator"]')).toBeNull();
        // The new line is also indented.
        expect(host.querySelector('.verse-number-text')!.textContent).toBe(
            '  ',
        );
    });

    test('a heading above a new-line verse is drawn above it', async () => {
        await render({
            verseInfo: genVerseInfo({
                isNewLine: true,
                newLineTitlesHtmlText: '<b>The Creation</b>',
            }),
            index: 3,
        });
        const heading = host.querySelector('.mt-2 .test-custom')!;
        expect(heading.textContent).toBe('<b>The Creation</b>');
        // One break before the heading, none after it.
        expect(host.querySelectorAll('br')).toHaveLength(1);
    });

    test('the heading of the passage itself needs no break above it', async () => {
        await render({
            verseInfo: genVerseInfo({
                isNewLine: true,
                newLineTitlesHtmlText: 'The Creation',
            }),
            index: 0,
        });
        expect(host.querySelector('.mt-2 .test-custom')).not.toBeNull();
        expect(host.querySelector('br')).toBeNull();
    });

    test("the model's own line breaks count only when asked for", async () => {
        const verseInfo = genVerseInfo({ isModelNewLine: true });
        await render({ verseInfo });
        expect(host.querySelector('br')).toBeNull();
        h.viewController.shouldModelNewLine = true;
        await render({ verseInfo: { ...verseInfo } });
        expect(host.querySelectorAll('br')).toHaveLength(1);
    });

    test('new lines are off when the setting is off, and between compared bibles', async () => {
        h.viewController.shouldNewLine = false;
        await render({ verseInfo: genVerseInfo({ isNewLine: true }) });
        expect(host.querySelector('br')).toBeNull();
        h.viewController.shouldNewLine = true;
        await render({
            verseInfo: genVerseInfo({ isNewLine: true }),
            extraVerseInfoList: [genVerseInfo({ bibleKey: 'KHM' })],
        });
        expect(host.querySelector('br')).toBeNull();
    });
});
