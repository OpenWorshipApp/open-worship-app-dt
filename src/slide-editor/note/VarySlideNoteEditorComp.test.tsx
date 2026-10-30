// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type StoreType = {
    defaultText: string;
    currentText: string;
    checkCanSave: () => boolean;
    save: () => Promise<boolean>;
};

const h = vi.hoisted(() => ({
    renders: [] as { store: any; title: string; uuid?: string }[],
    fileEvent: null as null | {
        events: string[];
        callback: () => Promise<void>;
        filePath?: string;
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

// Only `checkIsThisType` is read: an editable slide document saves its notes,
// any other kind (PDF, Word) has nothing to write them into.
vi.mock('../../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: (item: any) => item?.kind === 'app-document',
    },
}));

vi.mock('../../others/NoteEditorRenderComp', () => ({
    default: ({
        store,
        title,
        uuid,
    }: {
        store: StoreType;
        title: string;
        uuid?: string;
    }) => {
        h.renders.push({ store, title, uuid });
        return (
            <div data-note-uuid={uuid} data-note-title={title}>
                {store.currentText}
            </div>
        );
    },
}));

vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => Promise<void>,
        _deps: unknown[],
        filePath?: string,
    ) => {
        // Like the real hook, only the newest callback is ever called.
        h.fileEvent = { events, callback, filePath };
    },
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import VarySlideNoteEditorComp from './VarySlideNoteEditorComp';

let container: HTMLDivElement;
let root: Root;

function genDocument(kind = 'app-document') {
    return {
        kind,
        filePath: '/docs/service.slides',
        updateSlide: vi.fn(async () => {}),
        getItemById: vi.fn(),
    } as any;
}

function genSlide(id: number, note?: string, name = '') {
    return { id, uuid: `slide-uuid-${id}`, note, name } as any;
}

function latestStore(): StoreType {
    return h.renders.at(-1)!.store;
}

async function render(appDocument: any, slide: any, title?: string) {
    await act(async () => {
        root.render(
            <VarySlideNoteEditorComp
                appDocument={appDocument}
                slide={slide}
                title={title}
            />,
        );
    });
}

async function fireFileUpdate() {
    await act(async () => {
        await h.fileEvent!.callback();
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.renders = [];
    h.fileEvent = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('VarySlideNoteEditorComp', () => {
    test('shows the slide note under its default title and a per-slide id', async () => {
        await render(genDocument(), genSlide(3, 'Pray first'));

        const editor = container.querySelector('[data-note-uuid]');
        expect(editor?.textContent).toBe('Pray first');
        expect(editor?.getAttribute('data-note-title')).toBe('Slide Note');
        expect(editor?.getAttribute('data-note-uuid')).toBe(
            'slide-note-editor-slide-uuid-3',
        );
        expect(latestStore().defaultText).toBe('Pray first');
        expect(latestStore().checkCanSave()).toBe(false);
    });

    test('a slide without a note starts empty, and takes a custom title', async () => {
        await render(genDocument(), genSlide(4), 'Speaker note');

        const editor = container.querySelector('[data-note-uuid]');
        expect(editor?.textContent).toBe('');
        expect(editor?.getAttribute('data-note-title')).toBe('Speaker note');
    });

    test('writes an edited note into the slide when the editor goes away', async () => {
        const appDocument = genDocument();
        const slide = genSlide(5, 'Before');
        await render(appDocument, slide);
        // Mounting builds the store twice (state, then the effect); the first
        // one had nothing to save.
        expect(appDocument.updateSlide).not.toHaveBeenCalled();

        const store = latestStore();
        store.currentText = 'After';
        expect(store.checkCanSave()).toBe(true);

        await act(async () => root.unmount());
        root = createRoot(container);

        expect(appDocument.updateSlide).toHaveBeenCalledOnce();
        const [savedSlide] = appDocument.updateSlide.mock.calls[0];
        expect(savedSlide).toBe(slide);
        expect(savedSlide.note).toBe('After');
    });

    test('an untouched note is not written back', async () => {
        const appDocument = genDocument();
        await render(appDocument, genSlide(6, 'Same'));

        await expect(latestStore().save()).resolves.toBe(true);
        await act(async () => root.unmount());
        root = createRoot(container);

        expect(appDocument.updateSlide).not.toHaveBeenCalled();
    });

    test('a document that cannot hold notes never writes one', async () => {
        const appDocument = genDocument('pdf');
        const slide = genSlide(7, 'Read only');
        await render(appDocument, slide);

        const store = latestStore();
        store.currentText = 'Changed anyway';
        await expect(store.save()).resolves.toBe(true);

        expect(appDocument.updateSlide).not.toHaveBeenCalled();
        expect(slide.note).toBe('Read only');
    });

    test('listens for updates of its own document file', async () => {
        const appDocument = genDocument();
        await render(appDocument, genSlide(8, 'Note'));

        expect(h.fileEvent?.events).toEqual(['update']);
        expect(h.fileEvent?.filePath).toBe('/docs/service.slides');
    });

    test('an outside change to the note replaces what is shown', async () => {
        const appDocument = genDocument();
        await render(appDocument, genSlide(9, 'Mine'));
        appDocument.getItemById.mockResolvedValue(genSlide(9, 'Theirs'));

        await fireFileUpdate();

        expect(appDocument.getItemById).toHaveBeenCalledWith(9);
        expect(container.textContent).toBe('Theirs');
        expect(latestStore().defaultText).toBe('Theirs');
    });

    test('an update with the same note, or a slide that is gone, keeps the store', async () => {
        const appDocument = genDocument();
        await render(appDocument, genSlide(10, 'Steady'));
        const store = latestStore();

        appDocument.getItemById.mockResolvedValueOnce(genSlide(10, 'Steady'));
        await fireFileUpdate();
        appDocument.getItemById.mockResolvedValueOnce(null);
        await fireFileUpdate();

        expect(latestStore()).toBe(store);
        expect(container.textContent).toBe('Steady');
    });

    test('a read that resolves after the editor moved to another slide is dropped', async () => {
        const appDocument = genDocument();
        await render(appDocument, genSlide(11, 'First slide'));
        let resolveRead!: (slide: unknown) => void;
        appDocument.getItemById.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveRead = resolve;
            }),
        );
        const staleCallback = h.fileEvent!.callback;
        let pending!: Promise<void>;
        await act(async () => {
            pending = staleCallback();
        });

        // The widget key is static, so the same editor is re-fed a new slide.
        await render(appDocument, genSlide(12, 'Second slide'));
        expect(container.textContent).toBe('Second slide');

        await act(async () => {
            resolveRead(genSlide(11, 'Old slide changed'));
            await pending;
        });

        expect(container.textContent).toBe('Second slide');
        expect(latestStore().defaultText).toBe('Second slide');
    });
});
