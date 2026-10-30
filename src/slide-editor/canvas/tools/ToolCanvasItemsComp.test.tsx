// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    items: [] as any[],
    selected: [] as any[],
    setSelected: vi.fn(),
    setEditing: vi.fn(),
    genHandleContextMenuOpening: vi.fn(),
    contextMenuHandlers: new Map<number, ReturnType<typeof vi.fn>>(),
    showBibleLookupPopup: () => {},
    canvasItemContext: null as any,
}));

vi.mock('../CanvasItem', async () => {
    const react = await import('react');
    h.canvasItemContext = react.createContext(null);
    return {
        CanvasItemContext: h.canvasItemContext,
        checkCanvasItemsIncludes: (items: any[], target: any) =>
            items.some((item) => item.id === target.id),
        useCanvasItemsContext: () => h.items,
        useSelectedCanvasItemsAndSetterContext: () => ({
            canvasItems: h.selected,
        }),
        useSetEditingCanvasItem: () => h.setEditing,
        useSetSelectedCanvasItems: () => h.setSelected,
    };
});

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => ({
        genHandleContextMenuOpening: h.genHandleContextMenuOpening,
    }),
}));

vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.showBibleLookupPopup,
}));

vi.mock('../../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button data-dots="">...</button>,
}));

vi.mock('../../CanvasItemRendererComp', async () => {
    const { SlideThumbnailContext } =
        await import('../box/slideThumbnailContext');
    return {
        default: () => {
            const canvasItem = use(h.canvasItemContext) as any;
            const isThumbnail = use(SlideThumbnailContext);
            return (
                <div data-rendered={canvasItem.id}>
                    {isThumbnail ? 'thumbnail' : 'live'}
                </div>
            );
        },
    };
});

import ToolCanvasItemsComp from './ToolCanvasItemsComp';

let container: HTMLDivElement;
let root: Root;

function genItem(id: number, width: number, height: number) {
    return { id, props: { id, width, height } };
}

function cards() {
    return Array.from(container.querySelectorAll<HTMLDivElement>('.card'));
}

async function render() {
    await act(async () => root.render(<ToolCanvasItemsComp />));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setSelected.mockReset();
    h.setEditing.mockReset();
    h.genHandleContextMenuOpening.mockReset();
    h.contextMenuHandlers = new Map();
    h.genHandleContextMenuOpening.mockImplementation((canvasItem: any) => {
        const handler = vi.fn();
        h.contextMenuHandlers.set(canvasItem.id, handler);
        return handler;
    });
    h.items = [genItem(1, 560, 150), genItem(2, 100, 300)];
    h.selected = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('ToolCanvasItemsComp', () => {
    test('draws one card per item with its size and a scaled thumbnail', async () => {
        await render();

        expect(cards()).toHaveLength(2);
        expect(
            cards().map(
                (card) => card.querySelector('.card-header span')!.textContent,
            ),
        ).toEqual(['1:560x150', '2:100x300']);
        // Each card renders its own item, as a thumbnail.
        expect(
            Array.from(container.querySelectorAll('[data-rendered]')).map(
                (element) =>
                    `${element.getAttribute('data-rendered')}:${element.textContent}`,
            ),
        ).toEqual(['1:thumbnail', '2:thumbnail']);
        // Scaled to fit 280x150 by whichever side is tighter.
        const previews = cards().map((card) =>
            card.querySelector<HTMLDivElement>('.card-body > div')!,
        );
        expect(previews[0].style.transform).toBe('scale(0.5)');
        expect(previews[0].style.width).toBe('560px');
        expect(previews[1].style.transform).toBe('scale(0.5)');
        expect(previews[1].style.height).toBe('300px');
        expect(container.querySelectorAll('[data-dots]')).toHaveLength(2);
    });

    test('outlines the selected items only', async () => {
        h.selected = [{ id: 2 }];
        await render();

        expect(cards().map((card) => card.style.border)).toEqual([
            '',
            '2px dashed green',
        ]);
    });

    test('a click selects the item, a modifier click adds it to the selection', async () => {
        await render();

        await act(async () => cards()[0].click());
        expect(h.setSelected).toHaveBeenLastCalledWith(h.items[0], {
            isAppend: false,
        });

        await act(async () => {
            cards()[1].dispatchEvent(
                new MouseEvent('click', { bubbles: true, ctrlKey: true }),
            );
        });
        expect(h.setSelected).toHaveBeenLastCalledWith(h.items[1], {
            isAppend: true,
        });
    });

    test("opens each item's own context menu, whose Edit starts editing it", async () => {
        await render();

        expect(h.genHandleContextMenuOpening).toHaveBeenCalledWith(
            h.items[1],
            expect.any(Function),
            false,
            h.showBibleLookupPopup,
        );
        await act(async () => {
            cards()[1].dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(h.contextMenuHandlers.get(2)).toHaveBeenCalledOnce();
        expect(h.contextMenuHandlers.get(1)).not.toHaveBeenCalled();

        const startEditing = h.genHandleContextMenuOpening.mock.calls.find(
            ([canvasItem]) => canvasItem.id === 2,
        )![1];
        startEditing();
        expect(h.setEditing).toHaveBeenCalledWith(h.items[1]);
    });
});
