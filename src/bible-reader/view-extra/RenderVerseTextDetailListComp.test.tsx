// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type ViewPropsType = {
    verseInfo: { bibleKey: string };
    isAudioEnabled: boolean;
    isExtraVerses: boolean;
    audioSrcMap: object;
    refreshAudio: () => void;
    handleAudioStarting: () => void;
    handleAudioEnding: () => void;
};

const h = vi.hoisted(() => ({
    viewController: {
        isLookup: false,
        shouldSelectFirstItem: false,
        tryJumpingChapter: vi.fn(),
    },
    appProvider: { isPageReader: true },
    isAudioEnabled: false,
    bibleTextToSpeech: vi.fn(),
    getAIIsAutoPlay: vi.fn(),
    checkIsVerticalPartialInvisible: vi.fn(),
    useIsAudioAIEnabled: vi.fn(),
    viewPropsList: [] as ViewPropsType[],
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
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
vi.mock('../../helper/ai/openAIAudioHelpers', () => ({
    bibleTextToSpeech: h.bibleTextToSpeech,
    useIsAudioAIEnabled: h.useIsAudioAIEnabled,
}));
vi.mock('../../helper/ai/aiHelpers', () => ({
    getAIIsAutoPlay: h.getAIIsAutoPlay,
}));
vi.mock('../../helper/helpers', () => ({
    checkIsVerticalPartialInvisible: h.checkIsVerticalPartialInvisible,
}));
vi.mock('../../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('./RenderVerseTextViewComp', () => ({
    default: (props: ViewPropsType) => {
        h.viewPropsList.push(props);
        return (
            <span
                className="test-view"
                data-bible-key={props.verseInfo.bibleKey}
            />
        );
    },
}));

import RenderVerseTextDetailListComp from './RenderVerseTextDetailListComp';

const BIBLE_ITEM = { id: 3, bibleKey: 'KJV' } as any;

function genVerseInfo(overrides: Record<string, unknown> = {}) {
    return {
        bibleKey: 'KJV',
        kjvBibleVersesKey: 'GEN 1:1',
        bibleVersesKey: '(KJV) GEN 1:1',
        isLast: false,
        ...overrides,
    } as any;
}

const NEXT_VERSE_INFO = genVerseInfo({
    kjvBibleVersesKey: 'GEN 1:2',
    bibleVersesKey: '(KJV) GEN 1:2',
});

let host: HTMLDivElement;
let root: Root;
// The page the verses sit in: grandparent > parent > one div per verse.
let scroller: HTMLDivElement;
let verseElement: HTMLDivElement;
let nextVerseElement: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.viewController.isLookup = false;
    h.viewController.shouldSelectFirstItem = false;
    h.appProvider.isPageReader = true;
    h.isAudioEnabled = false;
    h.viewPropsList = [];
    h.useIsAudioAIEnabled.mockImplementation(() => ({
        isAudioEnabled: h.isAudioEnabled,
    }));
    h.getAIIsAutoPlay.mockReturnValue(true);
    h.checkIsVerticalPartialInvisible.mockReturnValue(false);
    h.bibleTextToSpeech.mockResolvedValue(null);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    scroller = document.createElement('div');
    const parent = document.createElement('div');
    verseElement = document.createElement('div');
    verseElement.dataset.kjvVerseKey = 'GEN 1:1';
    nextVerseElement = document.createElement('div');
    nextVerseElement.dataset.kjvVerseKey = 'GEN 1:2';
    parent.append(verseElement, nextVerseElement);
    scroller.append(parent);
    document.body.append(scroller);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    scroller.remove();
    vi.unstubAllGlobals();
});

async function render({
    verseInfo = genVerseInfo(),
    nextVerseInfo = NEXT_VERSE_INFO as any,
    extraVerseInfoList = undefined as any[] | undefined,
    element = verseElement as HTMLDivElement | null,
} = {}) {
    const verseTextRef = createRef<HTMLDivElement>() as {
        current: HTMLDivElement | null;
    };
    verseTextRef.current = element;
    const refreshAudio = vi.fn();
    await act(async () => {
        root.render(
            <RenderVerseTextDetailListComp
                bibleItem={BIBLE_ITEM}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                verseTextRef={verseTextRef}
                audioSrcMap={{ '(KJV) GEN 1:1': 'src://a.mp3' }}
                refreshAudio={refreshAudio}
                isExtraVerses={extraVerseInfoList !== undefined}
            />,
        );
    });
    return { props: h.viewPropsList.at(-1)!, refreshAudio };
}

function listenFor(element: HTMLElement, type: string) {
    const listener = vi.fn();
    element.addEventListener(type, listener);
    return listener;
}

describe('one view per compared bible', () => {
    test('the verse and each extra bible get their own view', async () => {
        h.isAudioEnabled = true;
        const { refreshAudio } = await render({
            extraVerseInfoList: [
                genVerseInfo({ bibleKey: 'KHM' }),
                genVerseInfo({ bibleKey: 'FRE' }),
            ],
        });
        expect(
            Array.from(host.querySelectorAll('.test-view')).map((element) => {
                return element.getAttribute('data-bible-key');
            }),
        ).toEqual(['KJV', 'KHM', 'FRE']);
        expect(h.useIsAudioAIEnabled).toHaveBeenCalledWith(BIBLE_ITEM);
        for (const props of h.viewPropsList.slice(-3)) {
            expect(props.isAudioEnabled).toBe(true);
            expect(props.isExtraVerses).toBe(true);
            expect(props.audioSrcMap).toEqual({
                '(KJV) GEN 1:1': 'src://a.mp3',
            });
            expect(props.refreshAudio).toBe(refreshAudio);
        }
    });
});

describe('when a verse starts playing', () => {
    test("the next verse's speech is made ahead of time", async () => {
        const { props } = await render();
        props.handleAudioStarting();
        expect(h.bibleTextToSpeech).toHaveBeenCalledWith(NEXT_VERSE_INFO);
    });

    test('the last verse has nothing to prepare', async () => {
        const { props } = await render({ nextVerseInfo: null });
        props.handleAudioStarting();
        expect(h.bibleTextToSpeech).not.toHaveBeenCalled();
    });
});

describe('when a verse finishes playing', () => {
    test('the next verse is selected, which plays it', async () => {
        const nextClick = listenFor(nextVerseElement, 'click');
        const nextDoubleClick = listenFor(nextVerseElement, 'dblclick');
        const { props } = await render();
        props.handleAudioEnding();
        expect(h.checkIsVerticalPartialInvisible).toHaveBeenCalledWith(
            scroller,
            nextVerseElement,
        );
        expect(nextClick).toHaveBeenCalledOnce();
        expect(nextDoubleClick).not.toHaveBeenCalled();
        // Not the end of a lookup chapter: no chapter jump.
        expect(h.viewController.tryJumpingChapter).not.toHaveBeenCalled();
    });

    test('a next verse scrolled out of view is double-clicked into view', async () => {
        h.checkIsVerticalPartialInvisible.mockReturnValue(true);
        const nextClick = listenFor(nextVerseElement, 'click');
        const nextDoubleClick = listenFor(nextVerseElement, 'dblclick');
        const { props } = await render();
        props.handleAudioEnding();
        expect(nextDoubleClick).toHaveBeenCalledOnce();
        expect(nextDoubleClick.mock.calls[0][0].bubbles).toBe(true);
        expect(nextClick).not.toHaveBeenCalled();
    });

    test('without auto play nothing moves on', async () => {
        h.getAIIsAutoPlay.mockReturnValue(false);
        const nextClick = listenFor(nextVerseElement, 'click');
        const { props } = await render();
        props.handleAudioEnding();
        expect(nextClick).not.toHaveBeenCalled();
    });

    test('outside the reader nothing moves on', async () => {
        h.appProvider.isPageReader = false;
        const nextClick = listenFor(nextVerseElement, 'click');
        const { props } = await render();
        props.handleAudioEnding();
        expect(nextClick).not.toHaveBeenCalled();
    });

    test('a next verse that is not on the page is skipped quietly', async () => {
        nextVerseElement.dataset.kjvVerseKey = 'GEN 9:9';
        const nextClick = listenFor(nextVerseElement, 'click');
        const { props } = await render();
        expect(() => props.handleAudioEnding()).not.toThrow();
        expect(nextClick).not.toHaveBeenCalled();
    });

    test('a verse not on any page moves nothing', async () => {
        const nextClick = listenFor(nextVerseElement, 'click');
        const { props } = await render({
            element: document.createElement('div'),
        });
        expect(() => props.handleAudioEnding()).not.toThrow();
        expect(nextClick).not.toHaveBeenCalled();
    });

    test('a verse that is gone moves nothing', async () => {
        const nextClick = listenFor(nextVerseElement, 'click');
        const { props } = await render({ element: null });
        props.handleAudioEnding();
        expect(nextClick).not.toHaveBeenCalled();
        expect(h.viewController.tryJumpingChapter).not.toHaveBeenCalled();
    });

    test("the lookup's last verse jumps to the next chapter", async () => {
        h.viewController.isLookup = true;
        const verseClick = listenFor(verseElement, 'click');
        const { props } = await render({
            verseInfo: genVerseInfo({ isLast: true }),
            nextVerseInfo: null,
        });
        props.handleAudioEnding();
        expect(verseClick).toHaveBeenCalledOnce();
        expect(h.viewController.shouldSelectFirstItem).toBe(true);
        expect(h.viewController.tryJumpingChapter).toHaveBeenCalledWith(true);
    });

    test('the last verse outside a lookup does not jump chapters', async () => {
        const { props } = await render({
            verseInfo: genVerseInfo({ isLast: true }),
            nextVerseInfo: null,
        });
        props.handleAudioEnding();
        expect(h.viewController.tryJumpingChapter).not.toHaveBeenCalled();
        expect(h.viewController.shouldSelectFirstItem).toBe(false);
    });
});
