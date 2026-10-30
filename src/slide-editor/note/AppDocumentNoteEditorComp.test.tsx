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
    renders: [] as { store: any; title: string }[],
    fileEvent: null as null | {
        events: string[];
        callback: () => Promise<void>;
        filePath?: string;
    },
    handleError: vi.fn(),
}));

// The real `appHooks` runs here, so a document swap mid-read really neuters
// the stale `setData`; it only needs these provider fields.
vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: h.handleError },
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../others/NoteEditorRenderComp', () => ({
    default: ({ store, title }: { store: StoreType; title: string }) => {
        h.renders.push({ store, title });
        return <div data-note-title={title}>{store.currentText}</div>;
    },
}));

vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => Promise<void>,
        _deps: unknown[],
        filePath?: string,
    ) => {
        h.fileEvent = { events, callback, filePath };
    },
}));

import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';

let container: HTMLDivElement;
let root: Root;

function genDocument(note: string, filePath = '/docs/service.slides') {
    return {
        filePath,
        getNote: vi.fn(async () => note),
        setNote: vi.fn(async () => {}),
    } as any;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function latestStore(): StoreType {
    return h.renders.at(-1)!.store;
}

async function render(appDocument: any) {
    await act(async () => {
        root.render(<AppDocumentNoteEditorComp appDocument={appDocument} />);
    });
}

async function remount() {
    await act(async () => root.unmount());
    root = createRoot(container);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.renders = [];
    h.fileEvent = null;
    h.handleError.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('AppDocumentNoteEditorComp', () => {
    test('loads the document note under the Document Note title', async () => {
        const appDocument = genDocument('Welcome everyone');
        await render(appDocument);

        expect(appDocument.getNote).toHaveBeenCalled();
        const editor = container.querySelector('[data-note-title]');
        expect(editor?.getAttribute('data-note-title')).toBe('Document Note');
        expect(editor?.textContent).toBe('Welcome everyone');
        expect(latestStore().checkCanSave()).toBe(false);
    });

    test('saves an edited note into the document when the editor goes away', async () => {
        const appDocument = genDocument('Draft');
        await render(appDocument);

        latestStore().currentText = 'Final words';
        await remount();

        expect(appDocument.setNote).toHaveBeenCalledExactlyOnceWith(
            'Final words',
        );
    });

    test('an untouched note is not written back', async () => {
        const appDocument = genDocument('Unchanged');
        await render(appDocument);

        await expect(latestStore().save()).resolves.toBe(true);
        await remount();

        expect(appDocument.setNote).not.toHaveBeenCalled();
    });

    test('the empty placeholder shown while loading never writes', async () => {
        const read = deferred<string>();
        const appDocument = genDocument('');
        appDocument.getNote.mockReturnValueOnce(read.promise);
        await render(appDocument);

        expect(container.textContent).toBe('');
        latestStore().currentText = 'typed too early';
        await expect(latestStore().save()).resolves.toBe(true);
        await remount();
        // The read lands after the unmount and must not revive anything.
        await act(async () => {
            read.resolve('late note');
            await read.promise;
        });

        expect(appDocument.setNote).not.toHaveBeenCalled();
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a document swap mid-read keeps the old note out of the new editor', async () => {
        const oldRead = deferred<string>();
        const oldDocument = genDocument('', '/docs/old.slides');
        oldDocument.getNote.mockReturnValueOnce(oldRead.promise);
        await render(oldDocument);

        const newDocument = genDocument(
            'New document note',
            '/docs/new.slides',
        );
        await render(newDocument);
        expect(container.textContent).toBe('New document note');

        await act(async () => {
            oldRead.resolve('Old document note');
            await oldRead.promise;
        });

        expect(container.textContent).toBe('New document note');
        expect(h.fileEvent?.filePath).toBe('/docs/new.slides');
    });

    test('an outside change to the note replaces what is shown', async () => {
        const appDocument = genDocument('Mine');
        await render(appDocument);
        expect(h.fileEvent?.events).toEqual(['update']);
        expect(h.fileEvent?.filePath).toBe('/docs/service.slides');

        appDocument.getNote.mockResolvedValueOnce('Theirs');
        await act(async () => {
            await h.fileEvent!.callback();
        });

        expect(container.textContent).toBe('Theirs');
        expect(latestStore().defaultText).toBe('Theirs');
    });

    test('an update carrying the same note keeps the current store', async () => {
        const appDocument = genDocument('Steady');
        await render(appDocument);
        const store = latestStore();

        await act(async () => {
            await h.fileEvent!.callback();
        });

        expect(latestStore()).toBe(store);
    });

    test('an update that resolves after a document swap is dropped', async () => {
        const firstDocument = genDocument('First', '/docs/first.slides');
        await render(firstDocument);
        const staleCallback = h.fileEvent!.callback;
        const read = deferred<string>();
        firstDocument.getNote.mockReturnValueOnce(read.promise);
        let pending!: Promise<void>;
        await act(async () => {
            pending = staleCallback();
        });

        await render(genDocument('Second', '/docs/second.slides'));
        await act(async () => {
            read.resolve('First, edited elsewhere');
            await pending;
        });

        expect(container.textContent).toBe('Second');
    });
});
