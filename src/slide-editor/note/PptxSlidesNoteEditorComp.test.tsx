// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./PptxSlideNoteEditorComp', () => ({
    default: ({ pptxSlide, title }: { pptxSlide: any; title: string }) => (
        <div data-note={pptxSlide.id}>{title}</div>
    ),
}));

import PptxSlidesNoteEditorComp from './PptxSlidesNoteEditorComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('PptxSlidesNoteEditorComp', () => {
    test('numbers a note editor per PowerPoint slide', async () => {
        const pptxSlides = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any[];
        await act(async () => {
            root.render(<PptxSlidesNoteEditorComp pptxSlides={pptxSlides} />);
        });

        const notes = Array.from(
            container.querySelectorAll<HTMLElement>('[data-note]'),
        );
        expect(notes.map((note) => note.dataset.note)).toEqual(['a', 'b', 'c']);
        expect(notes.map((note) => note.textContent)).toEqual([
            'PowerPoint Slide Note: 1',
            'PowerPoint Slide Note: 2',
            'PowerPoint Slide Note: 3',
        ]);
    });
});
