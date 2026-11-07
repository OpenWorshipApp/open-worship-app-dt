// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type NoteStoreType = {
    defaultText: string;
    currentText: string;
    checkCanSave: () => boolean;
    save?: () => Promise<boolean>;
};
type NoteRenderType = { store: NoteStoreType; title: string; uuid?: string };
type FileListenerType = {
    events: string[];
    callback: () => Promise<void> | void;
    filePath?: string;
};

const h = vi.hoisted(() => ({
    noteRenders: [] as NoteRenderType[],
    fileListeners: [] as FileListenerType[],
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: (document: any) => document?.kind === 'app',
    },
}));
vi.mock('../../app-document-list/PptxAppDocument', () => ({
    default: {
        checkIsThisType: (document: any) => document?.kind === 'pptx',
    },
}));
vi.mock('../../others/NoteEditorRenderComp', () => ({
    default: function NoteEditorRenderMockComp(props: NoteRenderType) {
        h.noteRenders.push(props);
        return (
            <div
                className="note"
                data-title={props.title}
                data-uuid={props.uuid ?? ''}
            >
                {props.store.currentText}
            </div>
        );
    },
}));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => Promise<void>,
        _deps: unknown,
        filePath?: string,
    ) => {
        h.fileListeners.push({ events, callback, filePath });
    },
}));
vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: function ResizeActorMockComp({
        flexSizeName,
        dataInput,
    }: {
        flexSizeName: string;
        dataInput: {
            key: string;
            widgetName: string;
            widgetKey?: string;
            children: { render: () => ReactNode };
        }[];
    }) {
        return (
            <div className="resize" data-flex={flexSizeName}>
                {dataInput.map((item) => {
                    return (
                        <section
                            key={item.key}
                            data-key={item.key}
                            data-widget={item.widgetName}
                            data-widget-key={item.widgetKey ?? ''}
                        >
                            {item.children.render()}
                        </section>
                    );
                })}
            </div>
        );
    },
}));
vi.mock('../../resize-actor/flexSizeHelpers', () => ({
    appDocumentFlexSizeNames: {
        presenterNote: 'presenter-note',
        slideEditorNote: 'editor-note',
    },
    toAppDocumentFlexSizeName: (name: string, filePath: string, prefix = '') =>
        `${prefix}${name}@${filePath}`,
}));

import VarySlideNoteEditorComp from './VarySlideNoteEditorComp';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import CanvasNoteContainerHandlerComp from './CanvasNoteContainerHandlerComp';
import PptxSlideNoteEditorComp from './PptxSlideNoteEditorComp';
import PptxSlidesNoteEditorComp from './PptxSlidesNoteEditorComp';
import PresenterNoteContainerHandlerComp from './PresenterNoteContainerHandlerComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function genSlide(id: number, note: string | undefined, name = '') {
    return { id, uuid: `uuid-${id}`, note, name } as any;
}

function genAppDocument(
    filePath = '/docs/Sunday.slides',
    overrides: Record<string, unknown> = {},
) {
    return {
        kind: 'app',
        filePath,
        fileSource: { filePath, fullName: filePath.split('/').at(-1) },
        updateSlide: vi.fn(async () => {}),
        getItemById: vi.fn(async () => null),
        getNote: vi.fn(async () => ''),
        setNote: vi.fn(async () => {}),
        getSlides: vi.fn(async () => []),
        ...overrides,
    } as any;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    await flush();
}

async function unmount() {
    await act(async () => {
        root.unmount();
    });
}

function lastNote(title?: string) {
    const renders =
        title === undefined
            ? h.noteRenders
            : h.noteRenders.filter((item) => item.title === title);
    const found = renders.at(-1);
    if (found === undefined) {
        throw new Error(`no note rendered titled ${title}`);
    }
    return found;
}

function noteTexts() {
    return Array.from(container.querySelectorAll('.note')).map((element) => {
        return [element.getAttribute('data-title'), element.textContent];
    });
}

beforeEach(() => {
    h.noteRenders.length = 0;
    h.fileListeners.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await unmount();
    container.remove();
});

describe('VarySlideNoteEditorComp', () => {
    it('edits the slide note of an app document and saves only a change', async () => {
        const appDocument = genAppDocument();
        const slide = genSlide(3, 'first note');
        await render(
            <VarySlideNoteEditorComp appDocument={appDocument} slide={slide} />,
        );
        const { store, title, uuid } = lastNote();
        expect(title).toBe('Slide Note');
        expect(uuid).toBe('slide-note-editor-uuid-3');
        expect(store.defaultText).toBe('first note');
        expect(store.checkCanSave()).toBe(false);
        expect(await store.save!()).toBe(true);
        expect(appDocument.updateSlide).not.toHaveBeenCalled();

        store.currentText = 'second note';
        expect(store.checkCanSave()).toBe(true);
        expect(await store.save!()).toBe(true);
        expect(slide.note).toBe('second note');
        expect(appDocument.updateSlide).toHaveBeenCalledWith(slide);
    });

    it('saves a pending note when the editor goes away', async () => {
        const appDocument = genAppDocument();
        const slide = genSlide(3, undefined);
        await render(
            <VarySlideNoteEditorComp
                appDocument={appDocument}
                slide={slide}
                title="Custom"
            />,
        );
        const { store, title } = lastNote();
        expect(title).toBe('Custom');
        expect(store.currentText).toBe('');
        store.currentText = 'typed before closing';
        await unmount();
        await flush();
        expect(appDocument.updateSlide).toHaveBeenCalledTimes(1);
        expect(slide.note).toBe('typed before closing');
        root = createRoot(container);
    });

    it('never writes into a document that is not an app document', async () => {
        const pptxDocument = genAppDocument('/docs/deck.pptx', {
            kind: 'pptx',
        });
        const slide = genSlide(1, 'deck note');
        await render(
            <VarySlideNoteEditorComp
                appDocument={pptxDocument}
                slide={slide}
            />,
        );
        const { store } = lastNote();
        store.currentText = 'changed';
        expect(await store.save!()).toBe(true);
        expect(pptxDocument.updateSlide).not.toHaveBeenCalled();
        expect(slide.note).toBe('deck note');
    });

    it('takes a note changed on disk, and ignores a read with nothing new', async () => {
        const appDocument = genAppDocument();
        const slide = genSlide(5, 'old');
        await render(
            <VarySlideNoteEditorComp appDocument={appDocument} slide={slide} />,
        );
        const listener = h.fileListeners.at(-1)!;
        expect(listener.events).toEqual(['update']);
        expect(listener.filePath).toBe('/docs/Sunday.slides');
        const storeBefore = lastNote().store;

        appDocument.getItemById.mockImplementation(async () => null);
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        expect(lastNote().store).toBe(storeBefore);

        appDocument.getItemById.mockImplementation(async () =>
            genSlide(5, 'old'),
        );
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        expect(lastNote().store).toBe(storeBefore);

        appDocument.getItemById.mockImplementation(async () =>
            genSlide(5, 'from another window'),
        );
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        expect(appDocument.getItemById).toHaveBeenLastCalledWith(5);
        expect(lastNote().store).not.toBe(storeBefore);
        expect(noteTexts()).toEqual([['Slide Note', 'from another window']]);
    });

    it('drops a read that resolves after the editor moved to another slide', async () => {
        const appDocument = genAppDocument();
        const firstSlide = genSlide(1, 'first');
        const secondSlide = genSlide(2, 'second');
        await render(
            <VarySlideNoteEditorComp
                appDocument={appDocument}
                slide={firstSlide}
            />,
        );
        const staleListener = h.fileListeners.at(-1)!;
        await render(
            <VarySlideNoteEditorComp
                appDocument={appDocument}
                slide={secondSlide}
            />,
        );
        expect(noteTexts()).toEqual([['Slide Note', 'second']]);
        appDocument.getItemById.mockImplementation(async () =>
            genSlide(1, 'first, edited elsewhere'),
        );
        await act(async () => {
            await staleListener.callback();
        });
        expect(noteTexts()).toEqual([['Slide Note', 'second']]);
        expect(lastNote().uuid).toBe('slide-note-editor-uuid-2');
    });
});

describe('AppDocumentNoteEditorComp', () => {
    it('loads the document note and writes only a changed note', async () => {
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'Service plan');
        await render(<AppDocumentNoteEditorComp appDocument={appDocument} />);
        expect(noteTexts()).toEqual([['Document Note', 'Service plan']]);
        const { store, uuid } = lastNote();
        expect(uuid).toBeUndefined();
        expect(await store.save!()).toBe(true);
        expect(appDocument.setNote).not.toHaveBeenCalled();
        store.currentText = 'Service plan, revised';
        expect(await store.save!()).toBe(true);
        expect(appDocument.setNote).toHaveBeenCalledWith(
            'Service plan, revised',
        );
    });

    it('saves the typed note when the editor is closed', async () => {
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'before');
        await render(<AppDocumentNoteEditorComp appDocument={appDocument} />);
        lastNote().store.currentText = 'after';
        await unmount();
        await flush();
        expect(appDocument.setNote).toHaveBeenCalledWith('after');
        root = createRoot(container);
    });

    it('shows a note changed on disk and ignores an unchanged one', async () => {
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'same');
        await render(<AppDocumentNoteEditorComp appDocument={appDocument} />);
        const listener = h.fileListeners.at(-1)!;
        expect(listener.filePath).toBe('/docs/Sunday.slides');
        const storeBefore = lastNote().store;
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        expect(lastNote().store).toBe(storeBefore);

        appDocument.getNote.mockImplementation(async () => 'edited elsewhere');
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        expect(noteTexts()).toEqual([['Document Note', 'edited elsewhere']]);
        expect(lastNote().store.defaultText).toBe('edited elsewhere');
    });

    it('still saves what is typed after a note changed on disk', async () => {
        // Found by UT-92 (2026-11-03): the store rebuilt for the outside
        // change kept the placeholder's do-nothing save, so a note typed
        // after it was never written -- by Save or on close -- while Save
        // said it had worked.
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'v1');
        await render(<AppDocumentNoteEditorComp appDocument={appDocument} />);
        appDocument.getNote.mockImplementation(async () => 'v2');
        await act(async () => {
            await h.fileListeners.at(-1)!.callback();
        });
        const { store } = lastNote();
        expect(store.defaultText).toBe('v2');
        store.currentText = 'v3';
        expect(await store.save!()).toBe(true);
        expect(appDocument.setNote).toHaveBeenCalledExactlyOnceWith('v3');

        appDocument.setNote.mockClear();
        lastNote().store.currentText = 'v4, typed before closing';
        await unmount();
        await flush();
        expect(appDocument.setNote).toHaveBeenCalledWith(
            'v4, typed before closing',
        );
        root = createRoot(container);
    });

    it('drops a read that resolves after the editor moved to another document', async () => {
        const firstDocument = genAppDocument('/docs/first.slides');
        firstDocument.getNote.mockImplementation(async () => 'first');
        const secondDocument = genAppDocument('/docs/second.slides');
        secondDocument.getNote.mockImplementation(async () => 'second');
        await render(<AppDocumentNoteEditorComp appDocument={firstDocument} />);
        const staleListener = h.fileListeners.at(-1)!;
        await render(
            <AppDocumentNoteEditorComp appDocument={secondDocument} />,
        );
        expect(noteTexts()).toEqual([['Document Note', 'second']]);
        firstDocument.getNote.mockImplementation(async () => 'first, edited');
        await act(async () => {
            await staleListener.callback();
        });
        expect(noteTexts()).toEqual([['Document Note', 'second']]);
    });
});

describe('note containers', () => {
    it('puts the document note beside the slide note in the slide editor', async () => {
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'doc');
        await render(
            <CanvasNoteContainerHandlerComp
                appDocument={appDocument}
                slide={genSlide(7, 'slide', 'Welcome')}
            />,
        );
        expect(
            container.querySelector('.resize')?.getAttribute('data-flex'),
        ).toBe('editor-note@/docs/Sunday.slides');
        expect(
            Array.from(container.querySelectorAll('section')).map((section) =>
                section.getAttribute('data-widget'),
            ),
        ).toEqual(['Sunday.slides', 'Welcome']);
        expect(noteTexts()).toEqual([
            ['Document Note', 'doc'],
            ['Slide Note', 'slide'],
        ]);
    });

    it('names an unnamed slide pane by its id', async () => {
        await render(
            <CanvasNoteContainerHandlerComp
                appDocument={genAppDocument()}
                slide={genSlide(42, '')}
            />,
        );
        expect(
            container
                .querySelectorAll('section')[1]
                .getAttribute('data-widget'),
        ).toBe('42');
    });

    it('lists every slide note under the document note in the presenter', async () => {
        const appDocument = genAppDocument();
        appDocument.getNote.mockImplementation(async () => 'doc');
        appDocument.getSlides.mockImplementation(async () => [
            genSlide(1, 'one', 'Opening'),
            genSlide(2, 'two'),
        ]);
        await render(
            <PresenterNoteContainerHandlerComp
                varyAppDocumentWithNote={appDocument}
                flexSizeNamePrefix="float-"
            />,
        );
        expect(
            container.querySelector('.resize')?.getAttribute('data-flex'),
        ).toBe('float-presenter-note@/docs/Sunday.slides');
        const sections = container.querySelectorAll('section');
        expect(sections[0].getAttribute('data-widget')).toBe('Sunday.slides');
        expect(sections[1].getAttribute('data-widget')).toBe('Slide Notes');
        expect(sections[1].getAttribute('data-widget-key')).toBe('Slide Notes');
        expect(noteTexts()).toEqual([
            ['Document Note', 'doc'],
            ['Slide Note: Opening', 'one'],
            ['Slide Note: 2', 'two'],
        ]);
        expect(
            Array.from(container.querySelectorAll('.note')).map((note) =>
                note.getAttribute('data-uuid'),
            ),
        ).toEqual(['', 'slide-note-editor-uuid-1', 'slide-note-editor-uuid-2']);
    });

    it('shows read-only notes for each PowerPoint slide', async () => {
        const pptxDocument = genAppDocument('/docs/deck.pptx', {
            kind: 'pptx',
        });
        pptxDocument.getSlides.mockImplementation(async () => [
            genSlide(10, 'speaker one'),
            genSlide(11, undefined),
        ]);
        await render(
            <PresenterNoteContainerHandlerComp
                varyAppDocumentWithNote={pptxDocument}
            />,
        );
        expect(container.querySelector('.resize')).toBe(null);
        expect(noteTexts()).toEqual([
            ['PowerPoint Slide Note: 1', 'speaker one'],
            ['PowerPoint Slide Note: 2', ''],
        ]);
        const { store, uuid } = lastNote('PowerPoint Slide Note: 2');
        expect(uuid).toBe('slide-note-editor-uuid-11');
        // nothing to save a PowerPoint note into
        expect(store.save).toBeUndefined();
        store.currentText = 'typed';
        expect(store.checkCanSave()).toBe(true);
    });

    it('shows a single PowerPoint slide note under its default title', async () => {
        await render(
            <PptxSlideNoteEditorComp
                pptxSlide={genSlide(4, 'only')}
                title={undefined as unknown as string}
            />,
        );
        expect(noteTexts()).toEqual([['Slide Note', 'only']]);
        expect(lastNote().store.checkCanSave()).toBe(false);
    });

    it('renders no slide notes while the PowerPoint slides are loading', async () => {
        await render(<PptxSlidesNoteEditorComp pptxSlides={[]} />);
        expect(container.querySelectorAll('.note')).toHaveLength(0);
        expect(container.querySelector('.app-inner-shadow')).not.toBe(null);
    });
});
