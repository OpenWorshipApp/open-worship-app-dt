// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';

import {
    PICKER_RUNTIME,
    genPickerReadExpression,
    genPickerStartExpression,
    genPickerStopExpression,
} from './picker.mjs';

// The runtime is a string evaluated in the app page, so it is exercised the
// way the app gets it. Importing this file at all is half the test: the runtime
// lives inside a template literal, and a stray backtick in a COMMENT inside it
// ends the literal and turns the whole module into a syntax error. That
// happened once, and the only symptom was the MCP host answering 500 to every
// request -- which is a long way from the comment that caused it.
function install() {
    return new Function(`return (${PICKER_RUNTIME})`)();
}

beforeEach(() => {
    delete window.__owaPicker;
    delete window.__owaDomMatch;
    document.body.innerHTML = '';
    Element.prototype.getBoundingClientRect = function () {
        return { x: 10, y: 10, width: 40, height: 20, top: 10, left: 10 };
    };
    Element.prototype.checkVisibility = function () {
        return true;
    };
});

describe('the picker runtime', () => {
    it('installs, and installing twice is the same picker', () => {
        const picker = install();
        expect(typeof picker.start).toBe('function');
        expect(install()).toBe(picker);
    });

    it('puts an overlay up and takes it down again', () => {
        const picker = install();
        expect(picker.start().phase).toBe('picking');
        expect(document.querySelectorAll('#owa-picker-host')).toHaveLength(1);
        picker.stop();
        expect(picker.read().phase).toBe('cancelled');
        // Nothing left on the operator's window: an outline stuck over the app
        // is worse than no picker at all.
        expect(document.querySelectorAll('#owa-picker-host')).toHaveLength(0);
    });

    it('swallows the choosing click instead of letting the app act', () => {
        document.body.innerHTML = '<button id="go">Go</button>';
        const target = document.getElementById('go');
        document.elementFromPoint = () => {
            return target;
        };
        let appHits = 0;
        target.addEventListener('click', () => {
            appHits += 1;
        });
        const picker = install();
        picker.start();
        target.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 20,
                clientY: 20,
            }),
        );
        // The whole safety property: pointing at "Clear Bible" to ask what it
        // does must not clear the bible.
        expect(appHits).toBe(0);
        expect(picker.read().phase).toBe('picked');
    });

    it('answers with the ways it is named kept apart', () => {
        document.body.innerHTML =
            '<button id="go" aria-label="Setting">Setting</button>';
        const target = document.getElementById('go');
        document.elementFromPoint = () => {
            return target;
        };
        const picker = install();
        picker.start();
        target.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 20,
                clientY: 20,
            }),
        );
        const { result } = picker.read();
        // Its text and its aria-label are the same word, and a name is said
        // once: joined, this used to read "Setting Setting" -- which is what
        // the chip in the help window used to say -- and since 2026-09-09
        // the matcher itself keeps each distinct name once.
        expect(result.labelParts).toEqual(['Setting']);
        expect(result.selector).toContain('#go');
    });

    it('escape cancels without picking anything', () => {
        const picker = install();
        picker.start();
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        expect(picker.read()).toEqual({ phase: 'cancelled', result: null });
    });
});

describe('the expressions the tool sends', () => {
    it('are single expressions, and read safely before a start', () => {
        for (const expression of [
            genPickerStartExpression(),
            genPickerReadExpression(),
            genPickerStopExpression(),
        ]) {
            expect(() => {
                return new Function(`return (${expression})`);
            }).not.toThrow();
        }
        // Read and stop must answer even when nothing was ever started -- the
        // caller polls, and a reload wipes the runtime under it.
        expect(
            new Function(`return (${genPickerReadExpression()})`)(),
        ).toEqual({ phase: 'idle', result: null });
        expect(
            new Function(`return (${genPickerStopExpression()})`)(),
        ).toEqual({ phase: 'idle' });
    });
});
