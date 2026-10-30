// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type ListPropsType = {
    audioSrcMap: { [key: string]: string | undefined | null };
    refreshAudio: () => void;
    isExtraVerses: boolean;
    verseTextRef: { current: HTMLDivElement | null };
};

const h = vi.hoisted(() => ({
    viewController: {
        shouldSelectFirstItem: false,
        handleVersesSelecting: vi.fn(),
    },
    appProvider: { readerHomePage: '' as string | undefined },
    getSelectedText: vi.fn(),
    checkIsAIAudioAvailableForBible: vi.fn(),
    bibleTextToSpeech: vi.fn(),
    listProps: null as null | ListPropsType,
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
vi.mock('../../helper/bibleViewHelpers', () => ({
    VERSE_TEXT_CLASS: 'verse-text',
}));
vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../helper/textSelectionHelpers', () => ({
    getSelectedText: h.getSelectedText,
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({ src: `src://${filePath}` }),
    },
}));
vi.mock('../../helper/ai/openAIAudioHelpers', () => ({
    bibleTextToSpeech: h.bibleTextToSpeech,
    checkIsAIAudioAvailableForBible: h.checkIsAIAudioAvailableForBible,
}));
vi.mock('../../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./RenderVerseTextDetailListComp', () => ({
    default: (props: ListPropsType) => {
        h.listProps = props;
        return <span className="test-list" />;
    },
}));

import RenderVerseTextDetailComp from './RenderVerseTextDetailComp';

const BIBLE_ITEM = { id: 3, bibleKey: 'KJV' } as any;

function genVerseInfo(overrides: Record<string, unknown> = {}) {
    return {
        verse: 1,
        localeVerse: '1',
        text: 'In the beginning',
        customText: null,
        isNewLine: false,
        isModelNewLine: false,
        newLineTitlesHtmlText: null,
        bibleKey: 'KJV',
        bookKey: 'GEN',
        chapter: 1,
        kjvBibleVersesKey: 'GEN 1:1',
        bibleVersesKey: '(KJV) GEN 1:1',
        isFirst: false,
        isLast: false,
        isChapterStart: false,
        localeChapter: '1',
        isRtl: false,
        style: {},
        locale: 'en',
        ...overrides,
    } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.viewController.shouldSelectFirstItem = false;
    h.appProvider.readerHomePage = '';
    h.listProps = null;
    h.getSelectedText.mockReturnValue('');
    h.checkIsAIAudioAvailableForBible.mockResolvedValue(false);
    h.bibleTextToSpeech.mockResolvedValue(null);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(
    verseInfo = genVerseInfo(),
    extraVerseInfoList: any[] | undefined = undefined,
) {
    await act(async () => {
        root.render(
            <RenderVerseTextDetailComp
                bibleItem={BIBLE_ITEM}
                verseInfo={verseInfo}
                nextVerseInfo={null}
                extraVerseInfoList={extraVerseInfoList}
                index={0}
            />,
        );
    });
    return host.querySelector<HTMLDivElement>('.verse-text')!;
}

async function fire(element: HTMLElement, type: string, altKey = false) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent(type, { bubbles: true, cancelable: true, altKey }),
        );
    });
}

describe('the verse element', () => {
    test('carries the keys the controller selects verses by', async () => {
        const element = await render(
            genVerseInfo({ isFirst: true, isLast: false }),
        );
        expect(element.className).toBe('verse-text');
        expect(element.dataset.kjvVerseKey).toBe('GEN 1:1');
        expect(element.dataset.verseKey).toBe('(KJV) GEN 1:1');
        expect(element.dataset.isFirst).toBe('1');
        expect(element.dataset.isLast).toBe('0');
        expect(h.listProps!.isExtraVerses).toBe(false);
        expect(h.listProps!.verseTextRef.current).toBe(element);
    });

    test('compared bibles mark the verse as extra verses', async () => {
        const element = await render(genVerseInfo({ isLast: true }), [
            genVerseInfo({ bibleKey: 'KHM' }),
        ]);
        expect(element.className).toBe('verse-text extra-verses');
        expect(element.dataset.isLast).toBe('1');
        expect(h.listProps!.isExtraVerses).toBe(true);
    });

    test('only the reader gives the verse its own menu button', async () => {
        let element = await render();
        expect(element.querySelector('.app-context-menu-dots')).toBeNull();
        h.appProvider.readerHomePage = 'reader.html';
        element = await render(genVerseInfo({ verse: 2 }));
        const dots = element.querySelector('.app-context-menu-dots');
        expect(dots).not.toBeNull();
        // FIRST child: that is what puts it on the verse's own line.
        expect(element.firstElementChild).toBe(dots);
    });
});

describe('selecting the first verse on arrival', () => {
    test('the first verse clicks itself when the controller asks', async () => {
        h.viewController.shouldSelectFirstItem = true;
        const element = await render(genVerseInfo({ isFirst: true }));
        expect(h.viewController.shouldSelectFirstItem).toBe(false);
        expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
            element,
            false,
            false,
            BIBLE_ITEM,
        );
    });

    test('any other verse leaves the request for the first one', async () => {
        h.viewController.shouldSelectFirstItem = true;
        await render(genVerseInfo({ isFirst: false }));
        expect(h.viewController.shouldSelectFirstItem).toBe(true);
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
    });
});

describe('clicking a verse', () => {
    test('selects it, passing on the alt key', async () => {
        const element = await render();
        await fire(element, 'click', true);
        expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
            element,
            true,
            false,
            BIBLE_ITEM,
        );
        expect(h.checkIsAIAudioAvailableForBible).toHaveBeenCalledWith(
            BIBLE_ITEM,
        );
        // No audio for this bible: nothing is read aloud.
        expect(h.bibleTextToSpeech).not.toHaveBeenCalled();
        expect(h.listProps!.audioSrcMap).toStrictEqual({});
    });

    test('a click that ends a text selection selects no verse', async () => {
        h.getSelectedText.mockReturnValue('beginning');
        const element = await render();
        await fire(element, 'click');
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
        expect(h.checkIsAIAudioAvailableForBible).not.toHaveBeenCalled();
    });

    test('with audio on, the verse loads, then plays its speech file', async () => {
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
        let resolveSpeech: (value: string | null) => void = () => {};
        h.bibleTextToSpeech.mockReturnValue(
            new Promise((resolve) => {
                resolveSpeech = resolve;
            }),
        );
        const verseInfo = genVerseInfo();
        const element = await render(verseInfo);
        await fire(element, 'click');
        // Loading: the key is present with no source yet.
        expect(h.listProps!.audioSrcMap).toStrictEqual({
            '(KJV) GEN 1:1': undefined,
        });
        expect(h.bibleTextToSpeech).toHaveBeenCalledWith(verseInfo, undefined);
        await act(async () => {
            resolveSpeech('audio/GEN-1-1.mp3');
        });
        expect(h.listProps!.audioSrcMap).toStrictEqual({
            '(KJV) GEN 1:1': 'src://audio/GEN-1-1.mp3',
        });
    });

    test('speech that cannot be made leaves the verse silent', async () => {
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
        const element = await render();
        await fire(element, 'click');
        expect(h.listProps!.audioSrcMap).toStrictEqual({
            '(KJV) GEN 1:1': null,
        });
    });

    test('refreshing the audio forces a new speech file', async () => {
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
        h.bibleTextToSpeech.mockResolvedValue('audio/new.mp3');
        const verseInfo = genVerseInfo();
        await render(verseInfo);
        await act(async () => {
            h.listProps!.refreshAudio();
        });
        expect(h.bibleTextToSpeech).toHaveBeenCalledWith(verseInfo, true);
        expect(h.listProps!.audioSrcMap['(KJV) GEN 1:1']).toBe(
            'src://audio/new.mp3',
        );
    });
});

describe('double-clicking a verse', () => {
    test('makes sure the verse ends up selected, and goes no further', async () => {
        const outerListener = vi.fn();
        document.addEventListener('dblclick', outerListener);
        try {
            const element = await render();
            await fire(element, 'dblclick', true);
            expect(h.viewController.handleVersesSelecting).toHaveBeenCalledWith(
                element,
                true,
                true,
                BIBLE_ITEM,
            );
            expect(h.checkIsAIAudioAvailableForBible).toHaveBeenCalledOnce();
            expect(outerListener).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener('dblclick', outerListener);
        }
    });

    test('an already selected verse is left selected', async () => {
        const element = await render();
        element.classList.add('selected');
        await fire(element, 'dblclick');
        expect(h.viewController.handleVersesSelecting).not.toHaveBeenCalled();
        expect(h.checkIsAIAudioAvailableForBible).not.toHaveBeenCalled();
    });
});
