// @vitest-environment jsdom

import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import RenderVerseNumOptionComp, { mouseUp } from './RenderVerseNumOptionComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
type VerseCallbackType = (verseStart: number, verseEnd?: number) => void;

let onVerseChange: Mock<VerseCallbackType>;
let onApply: Mock<VerseCallbackType>;

async function renderVerses(
    verseStart: number,
    verseEnd: number,
    numerals = ['1', '2', '3', '4', '5'],
) {
    await act(async () => {
        root.render(
            <>
                {numerals.map((numeral, index) => {
                    return (
                        <RenderVerseNumOptionComp
                            key={numeral}
                            index={index}
                            verseNum={index + 1}
                            verseNumText={numeral}
                            verseStart={verseStart}
                            verseEnd={verseEnd}
                            onVerseChange={onVerseChange}
                            onApply={onApply}
                        />
                    );
                })}
            </>,
        );
    });
}

function verse(index: number) {
    return container.querySelector<HTMLElement>(
        `[data-verse-index="${index}"]`,
    )!;
}

async function dispatch(element: HTMLElement, event: Event) {
    await act(async () => {
        element.dispatchEvent(event);
    });
    return event;
}

function hover(element: HTMLElement) {
    return dispatch(
        element,
        new MouseEvent('mouseover', {
            bubbles: true,
            relatedTarget: document.body,
        }),
    );
}

beforeEach(() => {
    onVerseChange = vi.fn<VerseCallbackType>();
    onApply = vi.fn<VerseCallbackType>();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    // A drag left open would carry into the next test: the module keeps it.
    mouseUp();
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('RenderVerseNumOptionComp', () => {
    it('does nothing on hover until a press starts a drag, then follows it', async () => {
        await renderVerses(1, 1);
        await hover(verse(3));
        expect(onVerseChange).not.toHaveBeenCalled();

        await dispatch(
            verse(2),
            new MouseEvent('mousedown', { bubbles: true }),
        );
        expect(onVerseChange).toHaveBeenLastCalledWith(2);
        await hover(verse(4));
        expect(onVerseChange).toHaveBeenLastCalledWith(2, 4);
        mouseUp();
        expect(onApply).toHaveBeenCalledExactlyOnceWith(2, 4);

        // The drag is over: hovering again changes nothing.
        await hover(verse(5));
        expect(onVerseChange).toHaveBeenCalledTimes(2);
    });

    it('extends the selection with Shift to the farthest of the three', async () => {
        await renderVerses(2, 3);
        await dispatch(
            verse(5),
            new MouseEvent('mousedown', { bubbles: true, shiftKey: true }),
        );
        expect(onApply).toHaveBeenCalledExactlyOnceWith(2, 5);
        expect(onVerseChange).not.toHaveBeenCalled();
    });

    it('picks a verse on Enter or Space and ignores any other key', async () => {
        await renderVerses(1, 1);
        const other = await dispatch(
            verse(3),
            new KeyboardEvent('keydown', {
                key: 'a',
                bubbles: true,
                cancelable: true,
            }),
        );
        expect(other.defaultPrevented).toBe(false);
        expect(onApply).not.toHaveBeenCalled();
        for (const key of ['Enter', ' ']) {
            const event = await dispatch(
                verse(3),
                new KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                }),
            );
            expect(event.defaultPrevented).toBe(true);
            expect(onApply).toHaveBeenLastCalledWith(3, 3);
        }
        expect(onApply).toHaveBeenCalledTimes(2);
    });

    it('marks its place in the selection and names a verse whose numeral is not its number', async () => {
        await renderVerses(2, 4, ['１', '２', '３', '4', '5']);
        expect(verse(2).className).toContain('selected-start');
        expect(verse(3).className).toContain(' selected ');
        expect(verse(3).className).not.toContain('selected-start');
        expect(verse(4).className).toContain('selected-end');
        expect(verse(5).className).not.toContain('selected');
        expect(verse(2).getAttribute('title')).toBe('Verse 2');
        expect(verse(2).getAttribute('aria-label')).toBe('Verse 2');
        expect(verse(4).hasAttribute('title')).toBe(false);
        expect(verse(2).getAttribute('role')).toBe('button');
    });
});
