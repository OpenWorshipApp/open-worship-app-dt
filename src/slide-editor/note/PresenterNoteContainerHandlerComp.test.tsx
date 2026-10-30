// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    resizeActors: [] as any[],
    handleError: vi.fn(),
}));

// The real `appHooks` loads the slides here; it only needs these fields.
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

vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeActors.push(props);
        return (
            <div data-resize-actor="">
                {props.dataInput.map((item: any) => (
                    <section
                        key={item.key}
                        data-pane={item.key}
                        data-widget-name={item.widgetName}
                        data-widget-key={item.widgetKey}
                    >
                        {item.children.render() as ReactNode}
                    </section>
                ))}
            </div>
        );
    },
}));

vi.mock('../../resize-actor/flexSizeHelpers', () => ({
    appDocumentFlexSizeNames: { presenterNote: 'app-document-presenter-note' },
    toAppDocumentFlexSizeName: (name: string, filePath: string, prefix = '') =>
        `${prefix}${name}@${filePath}`,
}));

vi.mock('../../app-document-list/PptxAppDocument', () => ({
    default: { checkIsThisType: (item: any) => item?.kind === 'pptx' },
}));

vi.mock('./AppDocumentNoteEditorComp', () => ({
    default: ({ appDocument }: { appDocument: any }) => (
        <div data-document-note="">{appDocument.fileSource.filePath}</div>
    ),
}));

vi.mock('./SlidesNoteEditorComp', () => ({
    default: ({ appDocument, slides }: { appDocument: any; slides: any[] }) => (
        <div data-slide-notes={appDocument.fileSource.filePath}>
            {slides.map((slide) => slide.id).join(',') || 'no slides'}
        </div>
    ),
}));

vi.mock('./PptxSlidesNoteEditorComp', () => ({
    default: ({ pptxSlides }: { pptxSlides: any[] }) => (
        <div data-pptx-notes="">
            {pptxSlides.map((slide) => slide.id).join(',') || 'no slides'}
        </div>
    ),
}));

import PresenterNoteContainerHandlerComp from './PresenterNoteContainerHandlerComp';

let container: HTMLDivElement;
let root: Root;

function genDocument(kind: string, slides: unknown) {
    return {
        kind,
        fileSource: { fullName: 'service.ows', filePath: '/docs/service.ows' },
        getSlides: vi.fn(() => slides),
    } as any;
}

function deferredSlides() {
    let resolve!: (slides: unknown[]) => void;
    const promise = new Promise<unknown[]>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

async function render(document: any, flexSizeNamePrefix?: string) {
    await act(async () => {
        root.render(
            <PresenterNoteContainerHandlerComp
                varyAppDocumentWithNote={document}
                flexSizeNamePrefix={flexSizeNamePrefix}
            />,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.resizeActors = [];
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

describe('PresenterNoteContainerHandlerComp', () => {
    test('puts the document note beside the slide notes, per document', async () => {
        const document = genDocument(
            'app-document',
            Promise.resolve([{ id: 1 }, { id: 2 }]),
        );
        await render(document);

        const actor = h.resizeActors.at(-1);
        expect(actor.flexSizeName).toBe(
            'app-document-presenter-note@/docs/service.ows',
        );
        expect(actor.isHorizontal).toBe(true);
        expect(actor.flexSizeDefault).toEqual({ h1: ['1'], h2: ['1'] });

        const documentPane = container.querySelector('[data-pane="h1"]')!;
        expect(documentPane.getAttribute('data-widget-name')).toBe(
            'service.ows',
        );
        expect(documentPane.textContent).toBe('/docs/service.ows');
        const slidesPane = container.querySelector('[data-pane="h2"]')!;
        expect(slidesPane.getAttribute('data-widget-key')).toBe('Slide Notes');
        expect(slidesPane.textContent).toBe('1,2');
        expect(document.getSlides).toHaveBeenCalled();
    });

    test('a second copy of the pane keeps its own layout key', async () => {
        await render(
            genDocument('app-document', Promise.resolve([])),
            'float-',
        );

        expect(h.resizeActors.at(-1).flexSizeName).toBe(
            'float-app-document-presenter-note@/docs/service.ows',
        );
    });

    test('shows no slide notes until the slides are read', async () => {
        const slides = deferredSlides();
        await render(genDocument('app-document', slides.promise));
        expect(container.querySelector('[data-slide-notes]')?.textContent).toBe(
            'no slides',
        );

        await act(async () => slides.resolve([{ id: 7 }]));
        expect(container.querySelector('[data-slide-notes]')?.textContent).toBe(
            '7',
        );
    });

    test('a PowerPoint shows only its own read-only slide notes', async () => {
        const slides = deferredSlides();
        await render(genDocument('pptx', slides.promise));

        expect(h.resizeActors).toHaveLength(0);
        expect(container.querySelector('[data-document-note]')).toBeNull();
        expect(container.querySelector('[data-pptx-notes]')?.textContent).toBe(
            'no slides',
        );

        await act(async () => slides.resolve([{ id: 3 }, { id: 4 }]));
        expect(container.querySelector('[data-pptx-notes]')?.textContent).toBe(
            '3,4',
        );
    });
});
