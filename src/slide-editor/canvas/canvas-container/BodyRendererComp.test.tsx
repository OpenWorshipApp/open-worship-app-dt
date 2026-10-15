// @vitest-environment jsdom

import { act, createElement, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    width: 400,
    canvasItems: [] as any[],
    selected: [] as any[],
    snap: null as any,
    hits: [] as any[],
    setSelected: vi.fn(),
    stopModes: vi.fn(),
    guideDown: vi.fn(),
    guideRemove: vi.fn(),
    drop: vi.fn(),
    contextMenu: vi.fn(),
    getHits: vi.fn(),
    merge: vi.fn(),
    clamp: vi.fn(),
    dragOver: vi.fn(),
}));

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => ({ canvas: { width: 800, height: 600 } }),
}));
vi.mock('../CanvasItem', () => ({
    useCanvasItemsContext: () => h.canvasItems,
    useSelectedCanvasItemsAndSetterContext: () => ({
        canvasItems: h.selected,
        setCanvasItems: h.setSelected,
    }),
}));
vi.mock('../../../others/ShadowingFillParentWidthComp', () => ({
    useShadowingParentWidth: () => h.width,
}));
vi.mock('../../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../../../helper/appHooks', async () => {
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
vi.mock('../CanvasGuideLineComp', () => ({
    CanvasGuideLineComp: ({ guide, onPointerDown, onRemove }: any) =>
        createElement(
            'button',
            {
                type: 'button',
                'data-guide': guide.id,
                onPointerDown,
                onClick: onRemove,
            },
            `Guide ${guide.id}`,
        ),
    CanvasSnapLinesComp: ({ vertical, horizontal }: any) =>
        createElement(
            'span',
            {},
            `Snap ${vertical.length}/${horizontal.length}`,
        ),
}));
vi.mock('../canvasSelectionHelpers', () => ({
    checkIsAppendSelectionModifier: (event: { shiftKey?: boolean }) =>
        Boolean(event.shiftKey),
    getCanvasItemsInRect: h.getHits,
    mergeCanvasItemSelection: h.merge,
}));
vi.mock('./canvasContainerHelpers', () => ({
    clampToCanvasPoint: h.clamp,
    dragOverHandling: h.dragOver,
    handleDropping: h.drop,
    openCanvasContextMenu: h.contextMenu,
}));
vi.mock('./CanvasItemsListComp', async () => {
    const { CanvasSnapContext } = await import('../canvasSnapGuideHelpers');
    return {
        CanvasItemsListComp: ({ canvasItems }: { canvasItems: any[] }) => {
            h.snap = use(CanvasSnapContext);
            return createElement(
                'span',
                {},
                `${canvasItems.length} canvas items`,
            );
        },
    };
});

import { BodyRendererComp } from './BodyRendererComp';

let root: Root;
let container: HTMLDivElement;

function canvas() {
    return container.querySelector<HTMLElement>('.slide-canvas-editor')!;
}

async function renderBody(guides: any[] = []) {
    await act(async () =>
        root.render(
            createElement(BodyRendererComp, {
                stopAllModes: h.stopModes,
                guides,
                onGuidePointerDown: h.guideDown,
                onGuideRemove: h.guideRemove,
            }),
        ),
    );
}

function pointer(
    type: string,
    x: number,
    y: number,
    options: { shiftKey?: boolean; button?: number } = {},
) {
    return new MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        button: options.button ?? 0,
        shiftKey: options.shiftKey ?? false,
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.width = 400;
    h.canvasItems = [
        { id: 1, props: { left: 100, top: 50, width: 80, height: 40 } },
        { id: 2, props: { left: 300, top: 200, width: 100, height: 60 } },
    ];
    h.selected = [h.canvasItems[0]];
    h.hits = [h.canvasItems[1]];
    h.getHits.mockImplementation(() => h.hits);
    h.merge.mockImplementation((old: any[], hits: any[]) => [...old, ...hits]);
    h.clamp.mockImplementation(
        (x: number, y: number, _rect: unknown, scale: number) => ({
            x: x / scale,
            y: y / scale,
        }),
    );
    h.snap = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('slide canvas body', () => {
    it('scales the canvas, includes guides in snap targets, and renders item count', async () => {
        await renderBody([
            { id: 7, axis: 'v', pos: 275 },
            { id: 8, axis: 'h', pos: 180 },
        ]);
        expect(
            container.querySelector<HTMLElement>('.shadow-blank-bg')!.style
                .width,
        ).toBe('400px');
        expect(canvas().style.transform).toBe('scale(0.5)');
        expect(canvas().style.touchAction).toBe('none');
        expect(container.textContent).toContain('2 canvas items');
        const targets = h.snap.getSnapTargets([1]);
        expect(targets.vertical).toEqual([0, 400, 800, 300, 350, 400, 275]);
        expect(targets.horizontal).toEqual([0, 300, 600, 200, 230, 260, 180]);
        expect(container.textContent).toContain('Guide 7');
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[data-guide="7"]')!
                .dispatchEvent(pointer('pointerdown', 2, 3)),
        );
        expect(h.guideDown).toHaveBeenCalledWith(
            'v',
            7,
            expect.objectContaining({ type: 'pointerdown' }),
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[data-guide="8"]')!
                .click(),
        );
        expect(h.guideRemove).toHaveBeenCalledWith(8);
    });

    it('rubber-band selects items using the release position', async () => {
        await renderBody();
        await act(async () =>
            canvas().dispatchEvent(pointer('pointerdown', 10, 20)),
        );
        await act(async () =>
            document.dispatchEvent(pointer('pointermove', 20, 30)),
        );
        await act(async () =>
            document.dispatchEvent(pointer('pointerup', 50, 60)),
        );
        expect(h.getHits).toHaveBeenCalledWith(h.canvasItems, {
            minX: 20,
            maxX: 100,
            minY: 40,
            maxY: 120,
        });
        expect(h.setSelected).toHaveBeenCalledWith([h.canvasItems[1]]);
        expect(h.stopModes).not.toHaveBeenCalled();
    });

    it('appends marquee hits when Shift was held at drag start', async () => {
        await renderBody();
        await act(async () =>
            canvas().dispatchEvent(
                pointer('pointerdown', 10, 20, { shiftKey: true }),
            ),
        );
        await act(async () =>
            document.dispatchEvent(pointer('pointerup', 50, 60)),
        );
        expect(h.merge).toHaveBeenCalledWith(h.selected, h.hits);
        expect(h.setSelected).toHaveBeenCalledWith([
            h.canvasItems[0],
            h.canvasItems[1],
        ]);
    });

    it('stops editor modes on a short plain click, but preserves right-click selection', async () => {
        await renderBody();
        await act(async () =>
            canvas().dispatchEvent(pointer('pointerdown', 10, 20)),
        );
        await act(async () =>
            canvas().dispatchEvent(pointer('pointerup', 11, 21)),
        );
        expect(h.stopModes).toHaveBeenCalledTimes(1);
        await act(async () =>
            canvas().dispatchEvent(
                pointer('pointerdown', 10, 20, { button: 2 }),
            ),
        );
        await act(async () =>
            canvas().dispatchEvent(pointer('pointerup', 10, 20, { button: 2 })),
        );
        expect(h.stopModes).toHaveBeenCalledTimes(1);
    });

    it('delegates drop and context-menu actions to the canvas controller', async () => {
        await renderBody();
        await act(async () =>
            canvas().dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            ),
        );
        expect(h.drop).toHaveBeenCalledWith(
            expect.objectContaining({ canvas: { width: 800, height: 600 } }),
            expect.objectContaining({ type: 'drop' }),
        );
        await act(async () =>
            canvas().dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(h.contextMenu).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ type: 'contextmenu' }),
            h.stopModes,
        );
        await act(async () =>
            canvas().dispatchEvent(
                new Event('dragleave', { bubbles: true, cancelable: true }),
            ),
        );
        expect(canvas().style.opacity).toBe('1');
    });
});
