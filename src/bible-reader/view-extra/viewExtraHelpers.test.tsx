// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    BibleViewTitleMaterialContext,
    cleanupVerseNumberClicked,
    useBibleViewTitleMaterialContext,
} from './viewExtraHelpers';

let words: HTMLSpanElement;

beforeEach(() => {
    vi.useFakeTimers();
    words = document.createElement('span');
    words.textContent = 'In the beginning';
    document.body.appendChild(words);
});

afterEach(() => {
    globalThis.getSelection()?.removeAllRanges();
    words.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

function press() {
    const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
    cleanupVerseNumberClicked(event as any);
    return event;
}

describe('cleanupVerseNumberClicked', () => {
    test('keeps the press on the verse number', () => {
        const event = press();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });

    test('sweeps away the caret a click leaves behind, two seconds on', () => {
        const selection = globalThis.getSelection()!;
        selection.collapse(words.firstChild!, 3);
        press();
        vi.advanceTimersByTime(1999);
        expect(selection.rangeCount).toBe(1);
        vi.advanceTimersByTime(1);
        expect(selection.rangeCount).toBe(0);
    });

    test('leaves alone a selection made since the click', () => {
        press();
        const selection = globalThis.getSelection()!;
        // The user starts marking words right after the click.
        selection.selectAllChildren(words);
        vi.advanceTimersByTime(2000);
        expect(selection.rangeCount).toBe(1);
        expect(selection.toString()).toBe('In the beginning');
    });

    test('nothing selected is nothing to sweep', () => {
        press();
        expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
        expect(globalThis.getSelection()!.rangeCount).toBe(0);
    });
});

describe('useBibleViewTitleMaterialContext', () => {
    function ProbeComp() {
        const { titleElement } = useBibleViewTitleMaterialContext();
        return <div className="probe">{titleElement}</div>;
    }

    test('reads the title its view provides', () => {
        expect(
            renderToStaticMarkup(
                <BibleViewTitleMaterialContext
                    value={{ titleElement: <b>John 3:16</b> }}
                >
                    <ProbeComp />
                </BibleViewTitleMaterialContext>,
            ),
        ).toBe('<div class="probe"><b>John 3:16</b></div>');
    });

    test('refuses to render outside a bible view', () => {
        expect(() => renderToStaticMarkup(<ProbeComp />)).toThrow(
            'useBibleViewTitleMaterialContext must be used within a ' +
                'BibleViewTitleMaterialContext',
        );
    });
});
