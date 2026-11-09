// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        // Stable, as the real hooks' are.
        annotationsMap: {},
        hoveredComment: null as object | null,
        selection: {
            verseKey: 'KJV GEN 1:1',
            offsets: { start: 0, end: 2 },
            rect: { left: 100, top: 200, width: 40, height: 16, bottom: 216 },
        },
        isAIEnabled: false,
        openChatbotWithVerseKey: vi.fn(async () => true),
    };
});

vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (current: unknown) => ({ current }),
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => {
        callback();
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../app-modal/modalLayerContext', () => ({
    useIsInModalLayer: () => false,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: () => {} }));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => mocks.isAIEnabled,
}));
vi.mock('../helper/ai/bibleItemAskHelpers', () => ({
    openChatbotWithVerseKey: mocks.openChatbotWithVerseKey,
}));
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    VERSE_HIGHLIGHT_COLOR_KEYS: ['yellow', 'green'],
    toVerseBibleKey: () => 'KJV',
}));
vi.mock('../bible-list/note/bibleNoteShortVerseHelpers', () => ({
    useBibleVerseAnnotations: () => mocks.annotationsMap,
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    addVerseComment: async () => null,
    addVerseHighlight: async () => {},
    removeVerseAnnotation: async () => {},
}));
vi.mock('./verseAnnotationActionHelpers', () => ({
    readVerseSelection: () => mocks.selection,
    readVerseSelectionMention: () => ({
        verseKey: '(KJV) JHN 3:16',
        mention: {
            text: 'so loved',
            before: 'For God ',
            after: ' the world',
            start: 9,
            end: 16,
        },
    }),
    removeAnnotationRefs: async () => {},
    toOverlappingAnnotationRefs: () => [],
    toVerseAnchor: async () => null,
}));
vi.mock('./VerseCommentEditorComp', () => ({ default: () => null }));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('./verseCommentHoverHelpers', () => ({
    cancelHoveredCommentClearing: () => {},
    clearHoveredComment: () => {},
    scheduleHoveredCommentClearing: () => {},
    useHoveredVerseComment: () => mocks.hoveredComment,
}));

import BibleSelectionToolbarComp from './BibleSelectionToolbarComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    mocks.hoveredComment = null;
    mocks.isAIEnabled = false;
    mocks.openChatbotWithVerseKey.mockClear();
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
});

// What a button is announced as. Every one of these is an icon button, and an
// icon font's glyph is CSS content -- a button takes its name from content
// before it reads a `title`, so without a label it was announced as a
// private-use character.
function readNames(selector: string) {
    return Array.from(document.body.querySelectorAll(selector)).map(
        (button) => {
            const icon = button.querySelector('i');
            return {
                name: button.getAttribute('aria-label'),
                isIconHidden: icon?.getAttribute('aria-hidden') === 'true',
            };
        },
    );
}

describe('verse mark buttons are named', () => {
    test('the selection toolbar names Add Comment and Remove Marks', () => {
        act(() => {
            root.render(<BibleSelectionToolbarComp />);
        });
        const words = document.createElement('span');
        words.textContent = 'In the beginning';
        host.appendChild(words);
        act(() => {
            globalThis.getSelection()!.selectAllChildren(words);
            document.dispatchEvent(new Event('selectionchange'));
        });

        expect(readNames('.app-verse-selection-toolbar__button')).toEqual([
            { name: 'Add Comment', isIconHidden: true },
            { name: 'Remove Marks', isIconHidden: true },
        ]);
    });

    // 2026-11-08, the user: _add the agent button for bible selected text as
    // well_ -- and only while AI is on, like every way into the assistant.
    test('with AI on, the toolbar asks the assistant about the words', async () => {
        mocks.isAIEnabled = true;
        act(() => {
            root.render(<BibleSelectionToolbarComp />);
        });
        const words = document.createElement('span');
        words.textContent = 'For God so loved the world';
        host.appendChild(words);
        act(() => {
            globalThis.getSelection()!.selectAllChildren(words);
            document.dispatchEvent(new Event('selectionchange'));
        });

        expect(readNames('.app-verse-selection-toolbar__button')).toEqual([
            { name: 'Add Comment', isIconHidden: true },
            { name: 'Remove Marks', isIconHidden: true },
            { name: 'Ask the assistant about this', isIconHidden: true },
        ]);
        const askButton = document.body.querySelector<HTMLButtonElement>(
            '[aria-label="Ask the assistant about this"]',
        )!;
        await act(async () => {
            askButton.click();
            await new Promise((resolve) => {
                setTimeout(resolve, 25);
            });
        });
        expect(mocks.openChatbotWithVerseKey).toHaveBeenCalledWith(
            '(KJV) JHN 3:16',
            {
                text: 'so loved',
                before: 'For God ',
                after: ' the world',
                start: 9,
                end: 16,
            },
        );
        // The selection it asked about is let go of.
        expect(globalThis.getSelection()?.rangeCount).toBe(0);
    });

    test('the comment hover tool names Close, Edit and Delete', () => {
        mocks.hoveredComment = {
            filePath: '/notes/Default.own',
            noteItemId: 1,
            commentId: 'c1',
            comment: 'A word on this',
            verseKey: 'KJV GEN 1:1',
            rect: { left: 100, top: 200, width: 40, height: 16, bottom: 216 },
            containerElement: host,
        };
        act(() => {
            root.render(<BibleSelectionToolbarComp />);
        });

        expect(
            readNames(
                '.app-verse-comment-hover__close, ' +
                    '.app-verse-comment-hover__button',
            ),
        ).toEqual([
            { name: 'Close', isIconHidden: true },
            { name: 'Edit Comment', isIconHidden: true },
            { name: 'Delete Comment', isIconHidden: true },
        ]);
    });
});
