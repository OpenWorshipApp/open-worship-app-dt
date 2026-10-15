// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Item = {
        id: number;
        isLocked?: boolean;
        checkIsSame: (other: Item) => boolean;
    };
    type Slide = { id: number; filePath: string; items: Item[] };
    const documents = new Map<string, object>();
    const controllers: FakeController[] = [];
    const toast = vi.fn();
    const menu = vi.fn();
    const unregisterBible = vi.fn();
    let slide: Slide;
    let insertBible: ((item: unknown) => Promise<void>) | null = null;
    class FakeCanvas {
        canvasItems: Item[];
        constructor(public slide: Slide) {
            this.canvasItems = slide.items;
        }
    }
    class FakeController {
        updates = 0;
        reloads = 0;
        moveCanvasItem = vi.fn();
        editCanvasItemsByIds = vi.fn(
            (ids: number[], callback: (item: Item) => void) => {
                this.canvas.canvasItems
                    .filter((item) => ids.includes(item.id))
                    .forEach(callback);
            },
        );
        addNewBibleItem = vi.fn(async () => {});
        onArrowing: (event: {
            key: string;
            ctrlKey: boolean;
            shiftKey: boolean;
        }) => void = () => {};
        MOVING_OFFSET = 4;
        events = new Map<
            number,
            { type: string; callback: (data?: { canvasItems: Item[] }) => void }
        >();
        nextEventId = 1;
        constructor(
            public appDocument: object,
            public canvas: FakeCanvas,
        ) {
            controllers.push(this);
        }
        itemRegisterEventListener(
            types: string[],
            callback: (data?: { canvasItems: Item[] }) => void,
        ) {
            const id = this.nextEventId++;
            this.events.set(id, { type: types[0], callback });
            return id;
        }
        unregisterEventListener(id: number) {
            this.events.delete(id);
        }
        emit(type: string, data?: { canvasItems: Item[] }) {
            for (const event of this.events.values()) {
                if (event.type === type) event.callback(data);
            }
        }
        fireUpdateEvent() {
            this.updates++;
            this.emit('update');
        }
        fireReloadEvent() {
            this.reloads++;
            this.emit('reload');
        }
    }
    return {
        documents,
        controllers,
        toast,
        menu,
        unregisterBible,
        FakeCanvas,
        FakeController,
        setSlide: (value: Slide) => {
            slide = value;
        },
        getSlide: () => slide,
        setInsertBible: (value: ((item: unknown) => Promise<void>) | null) => {
            insertBible = value;
        },
        getInsertBible: () => insertBible,
    };
});

vi.mock('../app-document-list/appDocumentHelpers', () => ({
    useSelectedEditingSlideContext: h.getSlide,
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        getInstance: (path: string) => {
            if (!h.documents.has(path)) h.documents.set(path, { path });
            return h.documents.get(path);
        },
    },
}));
vi.mock('./canvas/Canvas', () => ({ default: h.FakeCanvas }));
vi.mock('./canvas/CanvasController', async () => {
    const { createContext } = await import('react');
    return {
        default: h.FakeController,
        CanvasControllerContext: createContext(null),
    };
});
vi.mock('./canvas/CanvasItem', async () => {
    const { createContext } = await import('react');
    return {
        CanvasItemsContext: createContext(null),
        SelectedCanvasItemsAndSetterContext: createContext(null),
        EditingCanvasItemAndSetterContext: createContext(null),
        checkCanvasItemsIncludes: (
            items: Array<{ id: number }>,
            target: { id: number },
        ) => items.some((item) => item.id === target.id),
    };
});
vi.mock('../others/commonButtons', async () => {
    const { createContext } = await import('react');
    return { BibleLookupTogglePopupContext: createContext(() => {}) };
});
vi.mock('./canvas/canvasBibleItemHelpers', () => ({
    CanvasBibleItemEventListener: {
        registerEventListener: (
            _types: string[],
            callback: (item: unknown) => Promise<void>,
        ) => {
            h.setInsertBible(callback);
            return 7;
        },
        unregisterEventListener: h.unregisterBible,
    },
}));
vi.mock('./canvas/canvasInsertAppMenuHelpers', () => ({
    useCanvasInsertAppMenu: h.menu,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

import { useEditingCanvasContextValue } from './canvasEditingHelpers';

type Value = ReturnType<typeof useEditingCanvasContextValue>;
function item(id: number, isLocked = false) {
    return {
        id,
        isLocked,
        checkIsSame(other: { id: number }) {
            return id === other.id;
        },
    };
}
function slide(
    id: number,
    filePath = '/slides/one',
    items = [item(1), item(2)],
) {
    return { id, filePath, items };
}

let root: Root;
let container: HTMLDivElement;
let value: Value;
function ProbeComp(): ReactNode {
    value = useEditingCanvasContextValue();
    return createElement('span', {}, String(value.canvasItems.length));
}
async function render() {
    await act(async () => {
        root.render(createElement(ProbeComp));
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.documents.clear();
    h.controllers.length = 0;
    h.toast.mockClear();
    h.menu.mockClear();
    h.unregisterBible.mockClear();
    h.setSlide(slide(1));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await render();
});
afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('editing canvas context', () => {
    test('constructs the controller once and exposes the slide items', async () => {
        expect(h.controllers).toHaveLength(1);
        expect(value.canvasItems.map((entry) => entry.id)).toEqual([1, 2]);
        expect(value.contextValue).toHaveLength(5);
        expect(h.menu).toHaveBeenCalledWith(value.canvasController);
        await render();
        expect(h.controllers).toHaveLength(1);
    });

    test('keeps the controller for the same document and reloads on a new slide id', async () => {
        const controller = h.controllers[0];
        h.setSlide(slide(2, '/slides/one', [item(3)]));
        await render();
        expect(value.canvasController).toBe(controller);
        expect(controller.canvas.slide.id).toBe(2);
        expect(controller.updates).toBe(1);
        expect(controller.reloads).toBe(1);
        h.setSlide(slide(2, '/slides/other'));
        await render();
        expect(value.canvasController).not.toBe(controller);
        expect(h.controllers).toHaveLength(2);
    });

    test('refreshes selection by identity and clears it on reload', async () => {
        const controller = h.controllers[0];
        await act(async () => {
            value.setSelectedCanvasItems([value.canvasItems[0]]);
        });
        controller.canvas.canvasItems = [item(1), item(3)];
        await act(async () => {
            controller.emit('update');
        });
        expect(value.canvasItems.map((entry) => entry.id)).toEqual([1, 3]);
        expect(value.selectedCanvasItems).toEqual([
            controller.canvas.canvasItems[0],
        ]);
        await act(async () => {
            controller.emit('reload');
        });
        expect(value.selectedCanvasItems).toEqual([]);
    });

    test('keeps editing state on update and makes editing and selection exclusive', async () => {
        const controller = h.controllers[0];
        await act(async () => {
            value.setEditingCanvasItem(value.canvasItems[0]);
        });
        controller.canvas.canvasItems = [item(1), item(2)];
        await act(async () => {
            controller.emit('update');
        });
        expect(value.editingCanvasItem).toBe(controller.canvas.canvasItems[0]);
        await act(async () => {
            value.setSelectedCanvasItems([value.canvasItems[1]]);
        });
        expect(value.editingCanvasItem).toBeNull();
        await act(async () => {
            value.setEditingCanvasItem(value.canvasItems[0]);
        });
        expect(value.selectedCanvasItems).toEqual([]);
        await act(async () => {
            value.stopAllModes();
        });
        expect(value.editingCanvasItem).toBeNull();
        expect(value.selectedCanvasItems).toEqual([]);
    });

    test('arrow movement excludes locked items and keeps modifier keys', async () => {
        const controller = h.controllers[0];
        controller.canvas.canvasItems = [item(1), item(2, true)];
        await act(async () => {
            controller.emit('update');
        });
        await act(async () => {
            value.setSelectedCanvasItems(value.canvasItems);
        });
        controller.onArrowing({
            key: 'ArrowRight',
            ctrlKey: true,
            shiftKey: false,
        });
        expect(controller.editCanvasItemsByIds).toHaveBeenCalledWith(
            [1],
            expect.any(Function),
            { showNotFoundToast: false },
        );
        expect(controller.moveCanvasItem).toHaveBeenCalledWith(
            controller.canvas.canvasItems[0],
            4,
            4,
            {
                arrowing: 'ArrowRight',
                isCtrlKey: true,
                isShiftKey: false,
            },
        );
        await act(async () => {
            value.setSelectedCanvasItems([]);
        });
        controller.editCanvasItemsByIds.mockClear();
        controller.onArrowing({
            key: 'ArrowLeft',
            ctrlKey: false,
            shiftKey: false,
        });
        expect(controller.editCanvasItemsByIds).not.toHaveBeenCalled();
    });

    test('inserts Bible items through the active controller and unregisters on unmount', async () => {
        const controller = h.controllers[0];
        const bibleItem = { title: 'Genesis 1:1' };
        await act(async () => {
            await h.getInsertBible()?.(bibleItem);
        });
        expect(controller.addNewBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(h.toast).toHaveBeenCalledWith(
            'Insert Bible Item',
            'Bible item is inserted into the editing slide',
        );
        await act(async () => {
            root.unmount();
        });
        expect(h.unregisterBible).toHaveBeenCalledWith(7);
        root = createRoot(container);
    });
});
