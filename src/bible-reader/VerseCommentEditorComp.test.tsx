// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type WidgetPropsType = {
    title: ReactNode;
    onClose: () => void;
    widgetName: string;
    persistKey: string;
    options: object;
    children: ReactNode;
};

const h = vi.hoisted(() => ({
    updateVerseComment: vi.fn(),
    fontKeys: [] as string[],
    widgetProps: null as null | WidgetPropsType,
}));

vi.mock('../helper/appHooks', async () => {
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/note/verseAnnotationHelpers', () => ({
    updateVerseComment: h.updateVerseComment,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => {
        h.fontKeys.push(bibleKey);
        return bibleKey ? `${bibleKey} Font` : undefined;
    },
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: WidgetPropsType) => {
        h.widgetProps = props;
        return (
            <div className="test-widget">
                <div className="test-title">{props.title}</div>
                <button
                    type="button"
                    className="test-close"
                    onClick={props.onClose}
                />
                {props.children}
            </div>
        );
    },
}));

import VerseCommentEditorComp from './VerseCommentEditorComp';

const TARGET = {
    filePath: '/notes/Default.own',
    noteItemId: 5,
    commentId: 'comment-1',
    comment: 'A first thought',
    title: '(KJV) Genesis 1:1',
    verseKey: '(KJV) GEN 1:1',
};

let host: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.fontKeys = [];
    h.widgetProps = null;
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

async function render(target = TARGET) {
    await act(async () => {
        root.render(
            <VerseCommentEditorComp target={target} onClose={onClose} />,
        );
    });
    return host.querySelector('textarea')!;
}

async function type(textarea: HTMLTextAreaElement, text: string) {
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setValue.call(textarea, text);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('VerseCommentEditorComp', () => {
    test('opens on the comment, in the face of the verse it is about', async () => {
        const textarea = await render();
        expect(textarea.value).toBe('A first thought');
        expect(textarea.placeholder).toBe('Write a comment');
        expect(textarea.style.fontFamily).toBe('KJV Font');
        const title = host.querySelector<HTMLSpanElement>('.test-title span')!;
        expect(title.textContent).toBe('(KJV) Genesis 1:1');
        expect(title.title).toBe('(KJV) Genesis 1:1');
        expect(title.style.fontFamily).toBe('KJV Font');
        expect(h.fontKeys).toContain('KJV');
        expect(h.widgetProps).toMatchObject({
            widgetName: 'Verse Comment',
            persistKey: 'verse-comment-editor',
            options: {
                width: 360,
                height: 220,
                minWidth: 240,
                minHeight: 150,
            },
        });
    });

    test('a key with no bible part falls back to the UI face', async () => {
        const textarea = await render({ ...TARGET, verseKey: 'GEN 1:1' });
        expect(h.fontKeys.at(-1)).toBe('');
        expect(textarea.style.fontFamily).toBe('');
    });

    test('typing saves once the typing pauses, with the last text', async () => {
        const textarea = await render();
        await type(textarea, 'A second');
        await type(textarea, 'A second thought');
        expect(textarea.value).toBe('A second thought');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(h.updateVerseComment).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(h.updateVerseComment).toHaveBeenCalledOnce();
        expect(h.updateVerseComment).toHaveBeenCalledWith(
            '/notes/Default.own',
            5,
            'comment-1',
            'A second thought',
        );
    });

    test('closing mid-typing still saves the last keystroke', async () => {
        const textarea = await render();
        await type(textarea, 'Typed then closed');
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(h.updateVerseComment).toHaveBeenCalledWith(
            '/notes/Default.own',
            5,
            'comment-1',
            'Typed then closed',
        );
    });

    test('the close button is handed to the caller', async () => {
        await render();
        await act(async () => {
            host.querySelector<HTMLButtonElement>('.test-close')!.click();
        });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
