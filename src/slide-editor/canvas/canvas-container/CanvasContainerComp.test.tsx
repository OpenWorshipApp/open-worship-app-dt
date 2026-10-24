// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    scale: 2,
    theme: 'dark',
    keyboard: null as null | (() => void),
    bodyProps: null as null | Record<string, any>,
    center: vi.fn(),
}));

vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => state.scale,
}));
vi.mock('../../../helper/MultiContextRenderComp', () => ({
    MultiContextRenderComp: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));
vi.mock('../../../others/ShadowingFillParentWidthComp', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../app-document-presenter/items/slideItemRenderHelpers', () => ({
    getSlideItemShadowingStyle: () => null,
}));
vi.mock('../box/boxEditorHelpers', () => ({
    genBoxEditorStyle: () => null,
}));
vi.mock('../../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: state.theme }),
}));
vi.mock('../../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (_shortcuts: object[], callback: () => void) => {
        state.keyboard = callback;
    },
}));
vi.mock('../CanvasRulerComp', () => ({
    RULER_THICKNESS: 18,
    CanvasRulerCornerComp: () => <span>Corner</span>,
    CanvasRulerComp: ({
        isHorizontal,
        onCreateGuide,
    }: {
        isHorizontal: boolean;
        onCreateGuide: (x: number, y: number) => void;
    }) => (
        <button
            type="button"
            onClick={() => onCreateGuide(30, 40)}
        >{`Ruler ${isHorizontal ? 'horizontal' : 'vertical'}`}</button>
    ),
}));
vi.mock('./canvasContainerHelpers', () => ({
    clampToCanvasPoint: (
        clientX: number,
        clientY: number,
        rect: { left: number; top: number },
        scale: number,
        width: number,
        height: number,
    ) => ({
        x: Math.max(0, Math.min(width, (clientX - rect.left) / scale)),
        y: Math.max(0, Math.min(height, (clientY - rect.top) / scale)),
    }),
    scrollToCenter: state.center,
}));
vi.mock('./BodyRendererComp', () => ({
    BodyRendererComp: (props: Record<string, any>) => {
        state.bodyProps = props;
        return (
            <div>
                {props.guides.map(
                    (guide: { id: number; axis: string; pos: number }) => (
                        <span
                            key={guide.id}
                        >{`${guide.axis}:${guide.pos}`}</span>
                    ),
                )}
            </div>
        );
    },
}));

import CanvasContainerComp from './CanvasContainerComp';

let host: HTMLDivElement;
let root: Root;
let getRect: ReturnType<typeof vi.spyOn>;
let controller: {
    canvas: { width: number; height: number };
    toCenterView: () => void;
};

function render() {
    return act(async () =>
        root.render(
            <CanvasContainerComp
                contextData={
                    {
                        contextValue: [],
                        canvasController: controller,
                        stopAllModes: vi.fn(),
                    } as never
                }
            />,
        ),
    );
}

function button(label: string) {
    return [...host.querySelectorAll('button')].find(
        (element) => element.textContent === label,
    )!;
}

function pointer(type: string, x: number, y: number) {
    const event = new Event(type);
    Object.defineProperties(event, {
        clientX: { value: x },
        clientY: { value: y },
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.scale = 2;
    state.theme = 'dark';
    state.keyboard = null;
    state.bodyProps = null;
    state.center.mockReset();
    controller = {
        canvas: { width: 100, height: 80 },
        toCenterView: () => {},
    };
    getRect = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({
            left: 0,
            top: 0,
            width: 200,
            height: 160,
        } as DOMRect);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    getRect.mockRestore();
    vi.unstubAllGlobals();
});

describe('slide canvas container', () => {
    it('sizes and centers the canvas, then exposes its center action to the controller', async () => {
        await render();
        const inner = host.querySelector<HTMLDivElement>(
            '[style*="isolation"]',
        )!;
        expect(inner.style.width).toBe('200px');
        expect(inner.style.height).toBe('160px');
        expect(host.textContent).toContain('Ruler horizontal');
        expect(host.textContent).toContain('Ruler vertical');
        expect(state.center).toHaveBeenCalledWith(
            expect.any(HTMLDivElement),
            0,
            0,
        );
        state.center.mockClear();
        controller.toCenterView();
        expect(state.center).toHaveBeenCalledOnce();

        state.scale = 1;
        await render();
        expect(inner.style.width).toBe('100px');
        expect(state.center).toHaveBeenCalled();
        await act(async () => root.unmount());
        state.center.mockClear();
        controller.toCenterView();
        expect(state.center).not.toHaveBeenCalled();
        root = createRoot(host);
    });

    it('creates, moves, and removes guides when released outside the canvas', async () => {
        await render();
        await act(async () => button('Ruler horizontal').click());
        expect(host.textContent).toContain('h:20');
        await act(async () =>
            window.dispatchEvent(pointer('pointermove', 50, 60)),
        );
        expect(host.textContent).toContain('h:30');
        await act(async () =>
            window.dispatchEvent(pointer('pointerup', 50, 200)),
        );
        expect(host.textContent).not.toContain('h:30');

        await act(async () => button('Ruler vertical').click());
        expect(host.textContent).toContain('v:15');
        await act(async () =>
            window.dispatchEvent(pointer('pointerup', 30, 40)),
        );
        expect(host.textContent).toContain('v:15');
        const id = state.bodyProps!.guides[0].id as number;
        await act(async () => state.bodyProps!.onGuideRemove(id));
        expect(state.bodyProps!.guides).toEqual([]);
    });

    it('focuses the canvas viewport when the registered shortcut runs from the page body', async () => {
        await render();
        const parent = host.querySelector<HTMLDivElement>('.w-100.h-100')!;
        const focus = vi.spyOn(parent, 'focus');
        state.keyboard!();
        expect(focus).toHaveBeenCalledOnce();
    });
});
