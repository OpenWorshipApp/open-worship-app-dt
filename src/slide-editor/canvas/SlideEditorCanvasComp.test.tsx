// @vitest-environment jsdom

import { act, createContext, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    scale: 1,
    zooming: [] as { ref: { current: unknown }; options: any }[],
    resizeActors: [] as any[],
    onCanvasKeyboardEvent: vi.fn(),
    // Stand-ins for the contexts the footer is wrapped in.
    appDocumentContext: null as any,
    probeContext: null as any,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
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

vi.mock('./CanvasController', () => ({
    defaultRangeSize: { size: 10, min: 1, max: 20, step: 1 },
}));

vi.mock('./canvasEventHelpers', () => ({
    useSlideCanvasScale: () => h.scale,
}));

vi.mock('../../others/AppRangeComp', () => ({
    useZoomingRegistering: (ref: { current: unknown }, options: any) => {
        h.zooming.push({ ref, options });
    },
}));

vi.mock('../slideEditingKeyboardEventHelpers', () => ({
    onCanvasKeyboardEvent: h.onCanvasKeyboardEvent,
}));

vi.mock('../../app-document-list/appDocumentHelpers', async () => {
    const react = await import('react');
    h.appDocumentContext = react.createContext(null);
    return { VaryAppDocumentContext: h.appDocumentContext };
});

vi.mock('../../app-document-presenter/items/SlidesMenuComp', () => ({
    default: () => {
        const appDocument = use(h.appDocumentContext) as any;
        return <div data-slides-menu="">{appDocument?.filePath}</div>;
    },
}));

vi.mock('./tools/SlideEditorCanvasScalingComp', () => ({
    default: () => {
        const value = use(h.probeContext) as string | null;
        return <div data-scaling="">{value}</div>;
    },
}));

vi.mock('./tools/SlideEditorInsertToolbarComp', () => ({
    default: ({ canvasController }: { canvasController: any }) => (
        <div data-insert-toolbar="">{canvasController.name}</div>
    ),
}));

vi.mock('./canvas-container/CanvasContainerComp', () => ({
    default: ({ contextData }: { contextData: any }) => (
        <div data-canvas-container="">{contextData.name}</div>
    ),
}));

vi.mock('../note/CanvasNoteContainerHandlerComp', () => ({
    default: ({ appDocument, slide }: { appDocument: any; slide: any }) => (
        <div data-note-container="">{`${appDocument.filePath}#${slide.id}`}</div>
    ),
}));

vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeActors.push(props);
        return (
            <div data-resize-actor={props.flexSizeName}>
                {props.dataInput.map((item: any) => (
                    <section
                        key={item.key}
                        data-pane={item.key}
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
    appDocumentFlexSizeNames: { slideEditorCanvas: 'slide-editor-canvas' },
    toAppDocumentFlexSizeName: (name: string, filePath: string) =>
        `${name}@${filePath}`,
}));

h.probeContext = createContext<string | null>(null);

import SlideEditorCanvasComp from './SlideEditorCanvasComp';

let container: HTMLDivElement;
let root: Root;

function genContextData() {
    const appDocument = {
        filePath: '/docs/service.slides',
        fileSource: { filePath: '/docs/service.slides' },
    };
    const canvasController = {
        name: 'controller-1',
        appDocument,
        canvas: { slide: { id: 5 } },
        scale: 1,
        focusEditor: () => {},
    } as any;
    return {
        name: 'context-data',
        canvasController,
        contextValue: [{ context: h.probeContext, value: 'probe-value' }],
        selectedCanvasItems: [{ id: 1 }],
        setSelectedCanvasItems: vi.fn(),
        stopAllModes: vi.fn(),
    } as any;
}

async function render(contextData: any) {
    await act(async () => {
        root.render(<SlideEditorCanvasComp contextData={contextData} />);
    });
    return container.querySelector<HTMLDivElement>('.editor-container')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.scale = 1;
    h.zooming = [];
    h.resizeActors = [];
    h.onCanvasKeyboardEvent.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorCanvasComp', () => {
    test('lays out the toolbar, the canvas over the note, and the footer', async () => {
        const contextData = genContextData();
        await render(contextData);

        expect(
            container.querySelector('[data-insert-toolbar]')?.textContent,
        ).toBe('controller-1');
        const actor = h.resizeActors.at(-1);
        // One remembered split per document, stacked vertically.
        expect(actor.flexSizeName).toBe(
            'slide-editor-canvas@/docs/service.slides',
        );
        expect(actor.isHorizontal).toBe(false);
        expect(actor.flexSizeDefault).toEqual({ v1: ['6'], v2: ['1'] });
        expect(
            container
                .querySelector('[data-pane="v1"]')
                ?.getAttribute('data-widget-key'),
        ).toBe('Canvas');
        expect(
            container.querySelector('[data-canvas-container]')?.textContent,
        ).toBe('context-data');
        expect(
            container
                .querySelector('[data-pane="v2"]')
                ?.getAttribute('data-widget-key'),
        ).toBe('Note');
        expect(
            container.querySelector('[data-note-container]')?.textContent,
        ).toBe('/docs/service.slides#5');
        // The footer's slide menu works on the edited document, and the zoom
        // control sees every editing context.
        expect(container.querySelector('[data-slides-menu]')?.textContent).toBe(
            '/docs/service.slides',
        );
        expect(container.querySelector('[data-scaling]')?.textContent).toBe(
            'probe-value',
        );
    });

    test('hands keys pressed on the focused canvas to the keyboard handler', async () => {
        const contextData = genContextData();
        const editor = await render(contextData);
        expect(editor.tabIndex).toBe(0);

        await act(async () => editor.focus());
        await act(async () => {
            editor.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
            );
        });

        expect(h.onCanvasKeyboardEvent).toHaveBeenCalledOnce();
        const [data, event] = h.onCanvasKeyboardEvent.mock.calls[0];
        expect(data).toEqual({
            stopAllModes: contextData.stopAllModes,
            canvasController: contextData.canvasController,
            selectedCanvasItems: contextData.selectedCanvasItems,
            setSelectedCanvasItems: contextData.setSelectedCanvasItems,
        });
        expect(event.key).toBe('Delete');
    });

    test('ignores keys typed into something inside the canvas', async () => {
        const editor = await render(genContextData());
        const input = document.createElement('input');
        editor.appendChild(input);
        input.focus();

        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
            );
        });

        expect(h.onCanvasKeyboardEvent).not.toHaveBeenCalled();
        input.remove();
    });

    test('registers Ctrl+wheel zoom on the canvas from the live scale', async () => {
        const contextData = genContextData();
        h.scale = 0.5;
        const editor = await render(contextData);

        let zooming = h.zooming.at(-1)!;
        expect(zooming.ref.current).toBe(editor);
        expect(zooming.options.value).toBe(5);
        expect(zooming.options.defaultSize).toEqual({
            size: 10,
            min: 1,
            max: 20,
            step: 1,
        });

        zooming.options.setValue(15);
        expect(contextData.canvasController.scale).toBe(1.5);

        // A scale change re-renders with the new base value, so the next
        // Ctrl+wheel step starts from it rather than from a stale one.
        h.scale = 1.5;
        await render(contextData);
        zooming = h.zooming.at(-1)!;
        expect(zooming.options.value).toBe(15);
    });

    test('lets the controller focus the canvas while it is mounted', async () => {
        const contextData = genContextData();
        const { canvasController } = contextData;
        const editor = await render(contextData);

        expect(document.activeElement).not.toBe(editor);
        canvasController.focusEditor();
        expect(document.activeElement).toBe(editor);

        editor.blur();
        await act(async () => root.unmount());
        root = createRoot(container);

        // After unmounting it is a harmless no-op again.
        expect(() => canvasController.focusEditor()).not.toThrow();
        expect(document.activeElement).not.toBe(editor);
    });
});
