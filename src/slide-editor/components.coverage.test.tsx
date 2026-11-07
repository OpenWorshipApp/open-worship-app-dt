// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    contextData: null as any,
    scale: 1,
    zooming: [] as { ref: { current: HTMLElement | null }; options: any }[],
    keyboardEvents: [] as { data: any; event: any }[],
    insertToolbarControllers: [] as unknown[],
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedEditingSlideContext: createContext(null),
        SelectedVaryAppDocumentContext: createContext(null),
        VaryAppDocumentContext: createContext(null),
    };
});
vi.mock('../app-document-presenter/items/SlidesMenuComp', async () => {
    const { use } = await import('react');
    const { VaryAppDocumentContext } =
        await import('../app-document-list/appDocumentHelpers');
    return {
        default: function SlidesMenuMockComp() {
            const appDocument = use(VaryAppDocumentContext as any) as any;
            return (
                <i className="slides-menu" data-doc={appDocument?.filePath} />
            );
        },
    };
});
vi.mock('../others/AppErrorBoundaryComp', () => ({
    default: function AppErrorBoundaryMockComp({
        children,
    }: {
        children: ReactNode;
    }) {
        return <div className="boundary">{children}</div>;
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        mimetypeName: 'appDocument',
        checkIsThisType: (document: any) => document?.kind === 'app',
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            extension: filePath.split('.').at(-1),
        }),
    },
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) =>
        mimetypeName === 'appDocument' ? ['slides'] : [],
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { slideEditor: 'slide-editor' },
    appDocumentFlexSizeNames: { slideEditorCanvas: 'editor-canvas' },
    toAppDocumentFlexSizeName: (name: string, filePath: string) =>
        `${name}@${filePath}`,
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: function ResizeActorMockComp({
        flexSizeName,
        isHorizontal,
        dataInput,
    }: {
        flexSizeName: string;
        isHorizontal: boolean;
        dataInput: {
            key: string;
            widgetName: string;
            children: { render: () => ReactNode };
        }[];
    }) {
        return (
            <div
                className="resize"
                data-flex={flexSizeName}
                data-horizontal={String(isHorizontal)}
            >
                {dataInput.map((item) => (
                    <section
                        key={item.key}
                        data-key={item.key}
                        data-widget={item.widgetName}
                    >
                        {item.children.render()}
                    </section>
                ))}
            </div>
        );
    },
}));
vi.mock('../helper/MultiContextRenderComp', () => ({
    MultiContextRenderComp: function MultiContextRenderMockComp({
        contexts,
        children,
    }: {
        contexts: unknown[];
        children: ReactNode;
    }) {
        return (
            <div className="multi" data-count={contexts.length}>
                {children}
            </div>
        );
    },
}));
vi.mock('./canvasEditingHelpers', () => ({
    useEditingCanvasContextValue: () => h.contextData,
}));
vi.mock('./canvas/tools/SlideEditorToolsComp', () => ({
    default: function SlideEditorToolsMockComp() {
        return <i className="tools" />;
    },
}));
vi.mock('./canvas/CanvasController', () => ({
    defaultRangeSize: { size: 10, min: 1, max: 20, step: 1 },
}));
vi.mock('./canvas/canvasEventHelpers', () => ({
    useSlideCanvasScale: () => h.scale,
}));
vi.mock('./canvas/tools/SlideEditorCanvasScalingComp', () => ({
    default: function SlideEditorCanvasScalingMockComp() {
        return <i className="scaling" />;
    },
}));
vi.mock('../others/AppRangeComp', () => ({
    useZoomingRegistering: (
        ref: { current: HTMLElement | null },
        options: unknown,
    ) => {
        h.zooming.push({ ref, options });
    },
}));
vi.mock('./slideEditingKeyboardEventHelpers', () => ({
    onCanvasKeyboardEvent: (data: unknown, event: unknown) => {
        h.keyboardEvents.push({ data, event });
    },
}));
vi.mock('./note/CanvasNoteContainerHandlerComp', () => ({
    default: function CanvasNoteContainerMockComp({
        slide,
    }: {
        slide: { id: number };
    }) {
        return <i className="notes" data-slide={slide.id} />;
    },
}));
vi.mock('./canvas/canvas-container/CanvasContainerComp', () => ({
    default: function CanvasContainerMockComp() {
        return <input className="canvas-container" />;
    },
}));
vi.mock('./canvas/tools/SlideEditorInsertToolbarComp', () => ({
    default: function SlideEditorInsertToolbarMockComp({
        canvasController,
    }: {
        canvasController: unknown;
    }) {
        h.insertToolbarControllers.push(canvasController);
        return <i className="insert-toolbar" />;
    },
}));

import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';
import SlideEditorGroundComp from './SlideEditorGroundComp';
import SlideEditorCanvasComp from './canvas/SlideEditorCanvasComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function genContextData() {
    const appDocument = {
        kind: 'app',
        filePath: '/docs/Sunday.slides',
        fileSource: { filePath: '/docs/Sunday.slides' },
    };
    return {
        contextValue: [{ id: 'a' }, { id: 'b' }],
        selectedCanvasItems: [{ id: 1 }],
        setSelectedCanvasItems: vi.fn(),
        stopAllModes: vi.fn(),
        canvasController: {
            appDocument,
            canvas: { slide: { id: 3, filePath: '/docs/Sunday.slides' } },
            scale: 0.5,
            focusEditor: () => {},
        } as any,
    };
}

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function renderGround(
    slide: { filePath: string } | null,
    selectedVaryAppDocument: unknown = null,
) {
    return render(
        <SelectedVaryAppDocumentContext
            value={{ selectedVaryAppDocument } as any}
        >
            <SelectedEditingSlideContext
                value={
                    slide === null
                        ? null
                        : ({ selectedSlideEditing: slide } as any)
                }
            >
                <SlideEditorGroundComp />
            </SelectedEditingSlideContext>
        </SelectedVaryAppDocumentContext>,
    );
}

function sections(selector = 'section') {
    return Array.from(container.querySelectorAll(selector)).map((section) => [
        section.getAttribute('data-key'),
        section.getAttribute('data-widget'),
    ]);
}

beforeEach(() => {
    h.contextData = genContextData();
    h.scale = 0.5;
    h.zooming.length = 0;
    h.keyboardEvents.length = 0;
    h.insertToolbarControllers.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('SlideEditorGroundComp', () => {
    it('says no slide is selected and offers no menu without an editable document', async () => {
        await render(<SlideEditorGroundComp />);
        expect(container.querySelector('.text-muted')?.textContent).toBe(
            'No slide selected',
        );
        expect(container.querySelector('.card-footer')).toBe(null);
        await renderGround(null, {
            kind: 'app',
            isEditable: false,
            filePath: '/docs/locked.slides',
        });
        expect(container.querySelector('.slides-menu')).toBe(null);
        await renderGround(null, { kind: 'pptx', isEditable: true });
        expect(container.querySelector('.slides-menu')).toBe(null);
    });

    it('keeps the save menu of an editable document that lost every slide', async () => {
        await renderGround(null, {
            kind: 'app',
            isEditable: true,
            filePath: '/docs/empty.slides',
        });
        expect(container.textContent).toBe('No slide selected');
        expect(
            container.querySelector('.slides-menu')?.getAttribute('data-doc'),
        ).toBe('/docs/empty.slides');
    });

    it('does not open a slide of a file this editor cannot edit', async () => {
        await renderGround({ filePath: '/songs/Amazing Grace.lyric' });
        expect(container.textContent).toBe('No slide selected');
        expect(container.querySelector('.boundary')).toBe(null);
    });

    it('opens the editor inside an error boundary with the canvas and tools side by side', async () => {
        await renderGround({ filePath: '/docs/Sunday.slides' });
        await flush();
        await flush();
        const boundary = container.querySelector('.boundary');
        expect(boundary).not.toBe(null);
        const editorResize = boundary!.querySelector('.slide-editor > .resize');
        expect(editorResize?.getAttribute('data-flex')).toBe('slide-editor');
        expect(editorResize?.getAttribute('data-horizontal')).toBe('true');
        expect(sections('.slide-editor > .resize > section')).toEqual([
            ['h1', 'Slide Editor Canvas'],
            ['h2', 'Tools'],
        ]);
        const toolsPane = container.querySelector('section[data-key="h2"]')!;
        expect(
            toolsPane.querySelector('.multi')?.getAttribute('data-count'),
        ).toBe('2');
        expect(toolsPane.querySelector('.multi .tools')).not.toBe(null);

        const canvasResize = container.querySelector(
            '.editor-container > .resize',
        );
        expect(canvasResize?.getAttribute('data-flex')).toBe(
            'editor-canvas@/docs/Sunday.slides',
        );
        expect(canvasResize?.getAttribute('data-horizontal')).toBe('false');
        expect(sections('.editor-container > .resize > section')).toEqual([
            ['v1', 'Canvas'],
            ['v2', 'Note'],
        ]);
        expect(
            container.querySelector('.notes')?.getAttribute('data-slide'),
        ).toBe('3');
        expect(container.querySelector('.canvas-container')).not.toBe(null);
        expect(h.insertToolbarControllers.at(-1)).toBe(
            h.contextData.canvasController,
        );
        const footer = container.querySelector('.slide-editor-canvas-footer')!;
        expect(
            footer.querySelector('.slides-menu')?.getAttribute('data-doc'),
        ).toBe('/docs/Sunday.slides');
        expect(footer.querySelector('.multi .scaling')).not.toBe(null);
    });
});

describe('SlideEditorCanvasComp', () => {
    it('handles keys only while the canvas itself has the focus', async () => {
        await render(<SlideEditorCanvasComp contextData={h.contextData} />);
        const editor =
            container.querySelector<HTMLElement>('.editor-container')!;
        expect(editor.tabIndex).toBe(0);
        // a key typed into a field inside the canvas is that field's
        const field =
            container.querySelector<HTMLInputElement>('.canvas-container')!;
        field.focus();
        await act(async () => {
            field.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
            );
        });
        expect(h.keyboardEvents).toHaveLength(0);

        editor.focus();
        await act(async () => {
            editor.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
            );
        });
        expect(h.keyboardEvents).toHaveLength(1);
        const { data, event } = h.keyboardEvents[0];
        expect(data).toEqual({
            stopAllModes: h.contextData.stopAllModes,
            canvasController: h.contextData.canvasController,
            selectedCanvasItems: h.contextData.selectedCanvasItems,
            setSelectedCanvasItems: h.contextData.setSelectedCanvasItems,
        });
        expect(event.key).toBe('Delete');
    });

    it('lets the controller focus the canvas until it unmounts', async () => {
        const { canvasController } = h.contextData;
        await render(<SlideEditorCanvasComp contextData={h.contextData} />);
        const editor =
            container.querySelector<HTMLElement>('.editor-container')!;
        expect(document.activeElement).not.toBe(editor);
        canvasController.focusEditor();
        expect(document.activeElement).toBe(editor);
        editor.blur();
        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        canvasController.focusEditor();
        expect(document.activeElement).toBe(document.body);
    });

    it('zooms the canvas with the current scale as the base', async () => {
        await render(<SlideEditorCanvasComp contextData={h.contextData} />);
        const { ref, options } = h.zooming.at(-1)!;
        expect(ref.current).toBe(container.querySelector('.editor-container'));
        expect(options.value).toBe(5);
        expect(options.defaultSize).toEqual({
            size: 10,
            min: 1,
            max: 20,
            step: 1,
        });
        options.setValue(20);
        expect(h.contextData.canvasController.scale).toBe(2);
        h.scale = 1.2;
        await render(<SlideEditorCanvasComp contextData={h.contextData} />);
        expect(h.zooming.at(-1)!.options.value).toBe(12);
    });
});
