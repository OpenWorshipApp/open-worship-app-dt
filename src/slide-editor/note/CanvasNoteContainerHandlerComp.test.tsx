// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    resizeActors: [] as any[],
}));

vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeActors.push(props);
        return (
            <div>
                {props.dataInput.map((item: any) => (
                    <section
                        key={item.key}
                        data-pane={item.key}
                        data-widget-name={item.widgetName}
                    >
                        {item.children.render() as ReactNode}
                    </section>
                ))}
            </div>
        );
    },
}));

vi.mock('../../resize-actor/flexSizeHelpers', () => ({
    appDocumentFlexSizeNames: { slideEditorNote: 'slide-editor-note' },
    toAppDocumentFlexSizeName: (name: string, filePath: string) =>
        `${name}@${filePath}`,
}));

vi.mock('./AppDocumentNoteEditorComp', () => ({
    default: ({ appDocument }: { appDocument: any }) => (
        <div data-document-note="">{appDocument.fileSource.filePath}</div>
    ),
}));

vi.mock('./VarySlideNoteEditorComp', () => ({
    default: ({ appDocument, slide }: { appDocument: any; slide: any }) => (
        <div data-slide-note="">
            {`${appDocument.fileSource.filePath}#${slide.id}`}
        </div>
    ),
}));

import CanvasNoteContainerHandlerComp from './CanvasNoteContainerHandlerComp';

let container: HTMLDivElement;
let root: Root;

const appDocument = {
    fileSource: { fullName: 'service.ows', filePath: '/docs/service.ows' },
} as any;

async function render(slide: any) {
    await act(async () => {
        root.render(
            <CanvasNoteContainerHandlerComp
                appDocument={appDocument}
                slide={slide}
            />,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.resizeActors = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('CanvasNoteContainerHandlerComp', () => {
    test("shows the document note beside the edited slide's note", async () => {
        await render({ id: 4, name: 'Welcome' });

        const actor = h.resizeActors.at(-1);
        expect(actor.flexSizeName).toBe('slide-editor-note@/docs/service.ows');
        expect(actor.isHorizontal).toBe(true);
        expect(actor.flexSizeDefault).toEqual({ h1: ['1'], h2: ['1'] });

        const documentPane = container.querySelector('[data-pane="h1"]')!;
        expect(documentPane.getAttribute('data-widget-name')).toBe(
            'service.ows',
        );
        expect(documentPane.textContent).toBe('/docs/service.ows');
        const slidePane = container.querySelector('[data-pane="h2"]')!;
        expect(slidePane.getAttribute('data-widget-name')).toBe('Welcome');
        expect(slidePane.textContent).toBe('/docs/service.ows#4');
    });

    test('names an unnamed slide pane by the slide id', async () => {
        await render({ id: 9, name: '' });

        expect(
            container
                .querySelector('[data-pane="h2"]')!
                .getAttribute('data-widget-name'),
        ).toBe('9');
    });
});
