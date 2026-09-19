// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isDev: false,
            isWindows: true,
            isMac: false,
            isLinux: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

import {
    appendKeystroke,
    toKeystrokeLabel,
    MAX_VISIBLE_KEYSTROKES,
} from './keyboardScreencastHelpers';

function setPlatform(platform: 'windows' | 'mac' | 'linux') {
    providerMock.systemUtils.isWindows = platform === 'windows';
    providerMock.systemUtils.isMac = platform === 'mac';
    providerMock.systemUtils.isLinux = platform === 'linux';
}

// `event.target` is only set by a real dispatch, and the password guard reads
// it — so every case goes through one, off whatever element it should look like
// it was typed into.
function toLabel(eventInit: KeyboardEventInit, element?: HTMLElement) {
    const targetElement = element ?? document.createElement('div');
    document.body.appendChild(targetElement);
    let label: string | null = null;
    const handleKeyDown = (event: Event) => {
        label = toKeystrokeLabel(event as KeyboardEvent);
    };
    targetElement.addEventListener('keydown', handleKeyDown);
    targetElement.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    targetElement.removeEventListener('keydown', handleKeyDown);
    targetElement.remove();
    return label;
}

describe('toKeystrokeLabel', () => {
    beforeEach(() => {
        setPlatform('windows');
    });

    test('shows a typed character as the layout produced it', () => {
        expect(toLabel({ key: 'a', code: 'KeyA' })).toBe('a');
        expect(toLabel({ key: 'A', code: 'KeyA', shiftKey: true })).toBe(
            'Shift+A',
        );
    });

    test('shows a shortcut on the en-US physical key', () => {
        // A German layout has `z` where en-US has `y`: the app undoes on the
        // PHYSICAL key, so that is what the audience has to be told.
        expect(toLabel({ key: 'z', code: 'KeyY', ctrlKey: true })).toBe(
            'Ctrl+Y',
        );
        expect(
            toLabel({
                key: 'P',
                code: 'KeyP',
                ctrlKey: true,
                shiftKey: true,
            }),
        ).toBe('Ctrl+Shift+P');
    });

    test('names the keys that have no printable label', () => {
        expect(toLabel({ key: ' ', code: 'Space' })).toBe('Space');
        expect(toLabel({ key: 'ArrowUp', code: 'ArrowUp' })).toBe('↑');
        expect(toLabel({ key: 'Escape', code: 'Escape' })).toBe('Esc');
        expect(toLabel({ key: 'PageDown', code: 'PageDown' })).toBe(
            'Page Down',
        );
        expect(toLabel({ key: 'F5', code: 'F5' })).toBe('F5');
    });

    test('shows a modifier pressed on its own', () => {
        expect(
            toLabel({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }),
        ).toBe('Shift');
        expect(
            toLabel({
                key: 'Meta',
                code: 'MetaLeft',
                shiftKey: true,
                metaKey: true,
            }),
        ).toBe('Shift+Win');
    });

    test('writes a mac chord as run-together glyphs', () => {
        setPlatform('mac');
        expect(
            toLabel({
                key: 'P',
                code: 'KeyP',
                metaKey: true,
                shiftKey: true,
            }),
        ).toBe('⇧⌘P');
    });

    test('masks what is typed into a password field', () => {
        const inputElement = document.createElement('input');
        inputElement.type = 'password';
        expect(toLabel({ key: 's', code: 'KeyS' }, inputElement)).toBe('•');
        // The bullet stands alone: a `Shift+•` would put the password's
        // capitalisation on the projector one character at a time.
        expect(
            toLabel({ key: 'S', code: 'KeyS', shiftKey: true }, inputElement),
        ).toBe('•');
        // A shortcut is not a secret, and hiding it would hide the one thing
        // worth screencasting about that field.
        expect(
            toLabel({ key: 'A', code: 'KeyA', ctrlKey: true }, inputElement),
        ).toBe('Ctrl+A');
        // Nor is a named key — nothing about `Enter` says what was typed.
        expect(toLabel({ key: 'Enter', code: 'Enter' }, inputElement)).toBe(
            'Enter',
        );
    });

    test('drops a press with nothing to show', () => {
        // Mid-IME-composition, and a key the layout does not resolve.
        expect(toLabel({ key: 'Process', code: 'KeyA' })).toBeNull();
        expect(toLabel({ key: 'Unidentified', code: '' })).toBeNull();
    });
});

function buildStrip(labels: string[]) {
    let keystrokes = appendKeystroke([], labels[0]);
    for (const label of labels.slice(1)) {
        keystrokes = appendKeystroke(keystrokes, label);
    }
    return keystrokes;
}

describe('appendKeystroke', () => {
    test('collapses a repeat into a count', () => {
        const first = appendKeystroke([], '↓');
        expect(first).toEqual([{ label: '↓', count: 1 }]);
        const second = appendKeystroke(first, '↓');
        expect(second).toEqual([{ label: '↓', count: 2 }]);
        // A new array every time, or React would not re-render the strip.
        expect(second).not.toBe(first);
    });

    test('keeps distinct keys in press order', () => {
        const keystrokes = buildStrip(['Ctrl+B', '↓', '↓', 'Esc']);
        expect(keystrokes).toEqual([
            { label: 'Ctrl+B', count: 1 },
            { label: '↓', count: 2 },
            { label: 'Esc', count: 1 },
        ]);
    });

    test('drops the oldest keys past the visible limit', () => {
        const labels = Array.from(
            { length: MAX_VISIBLE_KEYSTROKES + 3 },
            (_value, index) => {
                return `F${index + 1}`;
            },
        );
        const keystrokes = buildStrip(labels);
        expect(keystrokes).toHaveLength(MAX_VISIBLE_KEYSTROKES);
        expect(keystrokes[0].label).toBe('F4');
        expect(keystrokes.at(-1)?.label).toBe(`F${MAX_VISIBLE_KEYSTROKES + 3}`);
    });
});
