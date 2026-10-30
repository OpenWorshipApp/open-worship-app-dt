// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    canvasItemContext: null as any,
    boxRenders: [] as number[],
}));

vi.mock('../CanvasItem', async () => {
    const react = await import('react');
    h.canvasItemContext = react.createContext(null);
    return { CanvasItemContext: h.canvasItemContext };
});

vi.mock('../box/BoxEditorComp', () => ({
    BoxEditorComp: () => {
        const canvasItem = use(h.canvasItemContext) as any;
        h.boxRenders.push(canvasItem.id);
        return <div data-box={canvasItem.id} />;
    },
}));

import { CanvasItemsListComp } from './CanvasItemsListComp';

let container: HTMLDivElement;
let root: Root;

async function render(canvasItems: any[]) {
    await act(async () => {
        root.render(<CanvasItemsListComp canvasItems={canvasItems} />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.boxRenders = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('CanvasItemsListComp', () => {
    test('gives every item its own box editor, in order', async () => {
        await render([{ id: 4 }, { id: 2 }, { id: 9 }]);

        expect(
            Array.from(container.querySelectorAll('[data-box]')).map((box) =>
                box.getAttribute('data-box'),
            ),
        ).toEqual(['4', '2', '9']);
    });

    test('a parent re-render with the same items repaints no box', async () => {
        const canvasItems = [{ id: 1 }, { id: 2 }];
        await render(canvasItems);
        expect(h.boxRenders).toEqual([1, 2]);

        await render(canvasItems);
        expect(h.boxRenders).toEqual([1, 2]);

        await render([...canvasItems]);
        expect(h.boxRenders).toEqual([1, 2, 1, 2]);
    });
});
