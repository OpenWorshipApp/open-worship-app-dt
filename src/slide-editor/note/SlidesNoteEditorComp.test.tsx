// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./VarySlideNoteEditorComp', () => ({
    default: ({
        appDocument,
        slide,
        title,
    }: {
        appDocument: any;
        slide: any;
        title: string;
    }) => (
        <div data-note={slide.id} data-document={appDocument.filePath}>
            {title}
        </div>
    ),
}));

import SlidesNoteEditorComp from './SlidesNoteEditorComp';

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

describe('SlidesNoteEditorComp', () => {
    test('gives every slide its own note editor, titled by name or position', async () => {
        const appDocument = { filePath: '/docs/service.ows' } as any;
        const slides = [
            { id: 11, name: 'Welcome' },
            { id: 12, name: '' },
        ] as any[];
        await act(async () => {
            root.render(
                <SlidesNoteEditorComp
                    appDocument={appDocument}
                    slides={slides}
                />,
            );
        });

        const notes = Array.from(
            container.querySelectorAll<HTMLElement>('[data-note]'),
        );
        expect(notes.map((note) => note.dataset.note)).toEqual(['11', '12']);
        expect(notes.map((note) => note.textContent)).toEqual([
            'Slide Note: Welcome',
            'Slide Note: 2',
        ]);
        expect(notes.map((note) => note.dataset.document)).toEqual([
            '/docs/service.ows',
            '/docs/service.ows',
        ]);
    });

    test('renders no editor for a document without slides', async () => {
        await act(async () => {
            root.render(
                <SlidesNoteEditorComp appDocument={{} as any} slides={[]} />,
            );
        });
        expect(container.querySelectorAll('[data-note]')).toHaveLength(0);
    });
});
