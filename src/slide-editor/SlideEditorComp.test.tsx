// @vitest-environment jsdom

import { act, createContext, Suspense, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    contextData: null as any,
    resizeActors: [] as any[],
    probeContext: null as any,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./canvasEditingHelpers', () => ({
    useEditingCanvasContextValue: () => h.contextData,
}));

vi.mock('./canvas/SlideEditorCanvasComp', () => ({
    default: ({ contextData }: { contextData: any }) => (
        <div data-canvas="">{contextData.name}</div>
    ),
}));

vi.mock('./canvas/tools/SlideEditorToolsComp', () => ({
    default: () => {
        const value = use(h.probeContext) as string | null;
        return <div data-tools="">{value}</div>;
    },
}));

vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeActors.push(props);
        return (
            <div>
                {props.dataInput.map((item: any) => (
                    <section
                        key={item.key}
                        data-pane={item.key}
                        data-widget-key={item.widgetKey}
                    >
                        <Suspense fallback={<span data-loading="" />}>
                            {item.children.render() as ReactNode}
                        </Suspense>
                    </section>
                ))}
            </div>
        );
    },
}));

vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { slideEditor: 'slide-editor-main' },
}));

h.probeContext = createContext<string | null>(null);

import SlideEditorComp from './SlideEditorComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.resizeActors = [];
    h.contextData = {
        name: 'editing-context',
        contextValue: [{ context: h.probeContext, value: 'shared-context' }],
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorComp', () => {
    test('puts the canvas beside the lazily loaded tools, sharing one editing context', async () => {
        await act(async () => root.render(<SlideEditorComp />));

        const actor = h.resizeActors.at(-1);
        expect(actor.flexSizeName).toBe('slide-editor-main');
        expect(actor.isHorizontal).toBe(true);
        expect(actor.flexSizeDefault).toEqual({ h1: ['5'], h2: ['1'] });
        expect(
            Array.from(container.querySelectorAll('[data-pane]')).map((pane) =>
                pane.getAttribute('data-widget-key'),
            ),
        ).toEqual(['Slide Editor Canvas', 'Tools']);
        expect(container.querySelector('[data-canvas]')?.textContent).toBe(
            'editing-context',
        );

        // The tools see the same editing contexts the canvas works in.
        await act(async () => {
            await vi.waitFor(() => {
                expect(
                    container.querySelector('[data-tools]')?.textContent,
                ).toBe('shared-context');
            });
        });
    });
});
