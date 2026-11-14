// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `[${text}]`,
}));

import LyricNotesComp from './LyricNotesComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('LyricNotesComp', () => {
    test('one read-only box, each note its own division', () => {
        act(() => {
            root.render(
                createElement(LyricNotesComp, {
                    noteList: [
                        { partName: 'Note', text: 'play verse 3\nand 4 again' },
                        { partName: 'Note 2', text: 'key change' },
                    ],
                }),
            );
        });
        // The title says what the box is, in the app's language.
        expect(container.textContent).toContain('[Document Note]');
        const sections = Array.from(container.querySelectorAll('section'));
        expect(
            sections.map((section) => {
                return [
                    section.querySelector('.lyric-note-title')!.textContent,
                    section.querySelector('.lyric-note-text')!.textContent,
                ];
            }),
        ).toEqual([
            ['Note', 'play verse 3\nand 4 again'],
            ['Note 2', 'key change'],
        ]);
        // The division: a rule above every note but the first.
        expect(sections[0].style.borderTop).toBe('');
        expect(sections[1].style.borderTop).not.toBe('');
        // The line breaks the song wrote are kept.
        const text =
            sections[0].querySelector<HTMLElement>('.lyric-note-text')!;
        expect(text.style.whiteSpace).toBe('pre-wrap');
        // Nothing to type into: the note lives in the song's text.
        expect(container.querySelector('textarea, input')).toBeNull();
        expect(container.querySelector('[contenteditable]')).toBeNull();
    });
});
