// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        floatingProps: null as any,
        toVerseBibleKey: vi.fn(),
        useBibleFontFamily: vi.fn(),
        updateVerseComment: vi.fn(),
    };
});

vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        h.floatingProps = props;
        return (
            <div className="floating">
                <div className="floating-title">{props.title}</div>
                <button
                    type="button"
                    className="floating-close"
                    onClick={props.onClose}
                />
                {props.children}
            </div>
        );
    },
}));
vi.mock('../helper/appHooks', async () => {
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/note/noteItemHelpers', () => ({
    toVerseBibleKey: h.toVerseBibleKey,
}));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    updateVerseComment: h.updateVerseComment,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: h.useBibleFontFamily,
}));

import VerseCommentEditorComp from './VerseCommentEditorComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const TARGET = {
    filePath: '/notes/Default.own',
    noteItemId: 4,
    commentId: 'c-1',
    comment: 'First thought',
    title: '(XXB) ☀☾ 1:1',
    verseKey: '(XXB) GEN 1:1',
};

let host: HTMLDivElement;
let root: Root;

async function renderEditor(target = TARGET, onClose: () => void = () => {}) {
    await act(async () => {
        root.render(
            <VerseCommentEditorComp target={target} onClose={onClose} />,
        );
    });
}

function getTextarea() {
    return host.querySelector('textarea')!;
}

async function type(value: string) {
    const textarea = getTextarea();
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setValue.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    h.floatingProps = null;
    h.toVerseBibleKey.mockReturnValue('XXB');
    h.useBibleFontFamily.mockImplementation((bibleKey: string) => {
        return bibleKey === 'XXB' ? 'Script Face' : undefined;
    });
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
});

describe('VerseCommentEditorComp', () => {
    test('opens on the comment, in the face of the bible it was written for', async () => {
        await renderEditor();
        expect(h.toVerseBibleKey).toHaveBeenCalledWith('(XXB) GEN 1:1');
        expect(h.useBibleFontFamily).toHaveBeenCalledWith('XXB');
        const textarea = getTextarea();
        expect(textarea.value).toBe('First thought');
        expect(textarea.placeholder).toBe('Write a comment');
        expect(textarea.style.fontFamily).toBe('Script Face');
        const title = host.querySelector<HTMLElement>(
            '.floating-title .app-ellipsis',
        )!;
        expect(title.textContent).toBe(TARGET.title);
        expect(title.getAttribute('title')).toBe(TARGET.title);
        expect(title.style.fontFamily).toBe('Script Face');
        expect(h.floatingProps).toMatchObject({
            widgetName: 'Verse Comment',
            persistKey: 'verse-comment-editor',
            options: { width: 360, height: 220, minWidth: 240, minHeight: 150 },
        });
        expect(h.updateVerseComment).not.toHaveBeenCalled();
    });

    test('a key that names no bible falls back to the UI face', async () => {
        h.toVerseBibleKey.mockReturnValue(null);
        await renderEditor();
        expect(h.useBibleFontFamily).toHaveBeenCalledWith('');
        expect(getTextarea().style.fontFamily).toBe('');
    });

    test('typing is saved once it pauses, with the last words typed', async () => {
        await renderEditor();
        await type('First thought, again');
        await advance(300);
        await type('First thought, and again');
        expect(getTextarea().value).toBe('First thought, and again');
        await advance(499);
        expect(h.updateVerseComment).not.toHaveBeenCalled();
        await advance(1);
        expect(h.updateVerseComment.mock.calls).toEqual([
            ['/notes/Default.own', 4, 'c-1', 'First thought, and again'],
        ]);
    });

    test('closing is left to the host, and the last words are written as it goes', async () => {
        const onClose = vi.fn();
        await renderEditor(TARGET, onClose);
        await act(async () => {
            host.querySelector<HTMLElement>('.floating-close')!.click();
        });
        expect(onClose).toHaveBeenCalledTimes(1);

        await type('Written just before closing');
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        // At once, not after the pause: the editor is gone.
        expect(h.updateVerseComment).toHaveBeenCalledWith(
            '/notes/Default.own',
            4,
            'c-1',
            'Written just before closing',
        );
    });

    // Found by UT-79 (2026-11-03): the closing write left the save of the last
    // keystroke pending, so the same words went to disk twice -- and a comment
    // reopened and changed inside that half second had its newer words written
    // over by the older ones when the stale save went off.
    test('closing cancels the save still pending: nothing written twice, nothing out of order', async () => {
        await renderEditor();
        await type('Typed, then closed at once');
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(h.updateVerseComment.mock.calls).toEqual([
            ['/notes/Default.own', 4, 'c-1', 'Typed, then closed at once'],
        ]);

        await renderEditor({
            ...TARGET,
            comment: 'Typed, then closed at once',
        });
        await type('Reopened and changed');
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        await advance(1000);
        expect(h.updateVerseComment.mock.calls).toEqual([
            ['/notes/Default.own', 4, 'c-1', 'Typed, then closed at once'],
            ['/notes/Default.own', 4, 'c-1', 'Reopened and changed'],
        ]);
    });
});
