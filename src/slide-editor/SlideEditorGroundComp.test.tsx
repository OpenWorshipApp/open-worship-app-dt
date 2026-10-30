// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    contexts: null as any,
    editorShouldThrow: false,
    handleError: vi.fn(),
    mimetypeRequests: [] as string[],
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));

vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const react = await import('react');
    h.contexts = {
        SelectedEditingSlideContext: react.createContext(null),
        SelectedVaryAppDocumentContext: react.createContext(null),
        VaryAppDocumentContext: react.createContext(null),
    };
    return h.contexts;
});

vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        mimetypeName: 'appDocument',
        checkIsThisType: (item: any) => item?.kind === 'app-document',
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            extension: filePath.slice(filePath.lastIndexOf('.') + 1),
        }),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) => {
        h.mimetypeRequests.push(mimetypeName);
        return ['ows', 'preview'];
    },
}));

vi.mock('../app-document-presenter/items/SlidesMenuComp', () => ({
    default: () => {
        const appDocument = use(h.contexts.VaryAppDocumentContext) as any;
        return <div data-slides-menu="">{appDocument.filePath}</div>;
    },
}));

vi.mock('./SlideEditorComp', () => ({
    default: () => {
        if (h.editorShouldThrow) {
            throw new Error('cannot open this document');
        }
        return <div data-slide-editor="">editor</div>;
    },
}));

import SlideEditorGroundComp from './SlideEditorGroundComp';

let container: HTMLDivElement;
let root: Root;

async function render({
    slide = null as any,
    selectedDocument = null as any,
} = {}) {
    const { SelectedEditingSlideContext, SelectedVaryAppDocumentContext } =
        h.contexts;
    await act(async () => {
        root.render(
            <SelectedVaryAppDocumentContext
                value={{ selectedVaryAppDocument: selectedDocument }}
            >
                <SelectedEditingSlideContext
                    value={{ selectedSlideEditing: slide }}
                >
                    <SlideEditorGroundComp />
                </SelectedEditingSlideContext>
            </SelectedVaryAppDocumentContext>,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.editorShouldThrow = false;
    h.handleError.mockReset();
    h.mimetypeRequests = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorGroundComp', () => {
    test('with no slide to edit it says so and offers no document actions', async () => {
        await render();

        expect(container.textContent).toBe('No slide selected');
        expect(container.querySelector('.card-footer')).toBeNull();
        expect(container.querySelector('[data-slide-editor]')).toBeNull();
    });

    test("keeps the editable document's Undo/Save row when its last slide is gone", async () => {
        await render({
            selectedDocument: {
                kind: 'app-document',
                isEditable: true,
                filePath: '/docs/service.ows',
            },
        });

        expect(container.textContent).toContain('No slide selected');
        expect(
            container.querySelector('.card-footer [data-slides-menu]')
                ?.textContent,
        ).toBe('/docs/service.ows');
    });

    test.each([
        ['a read-only document', { kind: 'app-document', isEditable: false }],
        ['a document of another kind', { kind: 'pdf', isEditable: true }],
    ])('offers no document actions for %s', async (_label, document) => {
        await render({ selectedDocument: { ...document, filePath: '/x' } });

        expect(container.querySelector('[data-slides-menu]')).toBeNull();
    });

    test('opens the editor for a slide of a slide document', async () => {
        await render({ slide: { filePath: '/docs/service.ows' } });

        expect(h.mimetypeRequests).toEqual(['appDocument']);
        expect(container.querySelector('[data-slide-editor]')).not.toBeNull();
        expect(container.textContent).not.toContain('No slide selected');
    });

    test('never opens the editor on a slide it cannot edit', async () => {
        // A song's slide left behind as the editing slide.
        await render({ slide: { filePath: '/songs/amazing-grace.owl' } });

        expect(container.querySelector('[data-slide-editor]')).toBeNull();
        expect(container.textContent).toBe('No slide selected');
    });

    test('a throw inside the editor stays inside its own boundary', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        h.editorShouldThrow = true;
        await render({ slide: { filePath: '/docs/service.ows' } });

        expect(container.textContent).toContain('Something went wrong here');
        expect(container.textContent).toContain('cannot open this document');
        expect(h.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'cannot open this document' }),
        );
    });
});
