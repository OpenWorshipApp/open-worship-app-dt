// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    renders: [] as { store: any; title: string; uuid?: string }[],
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../others/NoteEditorRenderComp', () => ({
    default: (props: { store: any; title: string; uuid?: string }) => {
        h.renders.push(props);
        return (
            <div data-uuid={props.uuid} data-title={props.title}>
                {props.store.currentText}
            </div>
        );
    },
}));

import PptxSlideNoteEditorComp from './PptxSlideNoteEditorComp';

let container: HTMLDivElement;
let root: Root;

async function render(pptxSlide: any, title = 'Deck note') {
    await act(async () => {
        root.render(
            <PptxSlideNoteEditorComp pptxSlide={pptxSlide} title={title} />,
        );
    });
    return h.renders.at(-1)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.renders = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('PptxSlideNoteEditorComp', () => {
    test("shows the slide's speaker note as a read-only store", async () => {
        const { store, title, uuid } = await render({
            uuid: 'pptx-1',
            note: 'Speaker words',
        });

        expect(title).toBe('Deck note');
        expect(uuid).toBe('slide-note-editor-pptx-1');
        expect(container.textContent).toBe('Speaker words');
        expect(store.defaultText).toBe('Speaker words');
        // No `save`: the note editor will not offer to write a PowerPoint.
        expect(store.save).toBeUndefined();
        expect(store.checkCanSave()).toBe(false);
        store.currentText = 'Changed';
        expect(store.checkCanSave()).toBe(true);
    });

    test('a slide without a note starts empty', async () => {
        const { store } = await render({ uuid: 'pptx-2' });
        expect(store.defaultText).toBe('');
        expect(store.currentText).toBe('');
    });

    test('keeps one store per slide across re-renders', async () => {
        const slide = { uuid: 'pptx-3', note: 'First' };
        const first = await render(slide);
        const again = await render(slide, 'Renamed');
        expect(again.store).toBe(first.store);
        expect(again.title).toBe('Renamed');

        const next = await render({ uuid: 'pptx-4', note: 'Second' });
        expect(next.store).not.toBe(first.store);
        expect(next.store.defaultText).toBe('Second');
    });
});
