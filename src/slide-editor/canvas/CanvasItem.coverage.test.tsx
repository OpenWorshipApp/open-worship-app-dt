// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./canvasHelpers', () => ({
    tooling2BoxProps: () => ({}),
    canvasItemList: ['text', 'error'],
    genTextDefaultBoxStyle: () => ({ id: -1, type: 'text' }),
    cleanupProps: () => {},
}));
vi.mock('../../helper/helpers', () => ({ cloneJson: structuredClone }));
vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));
vi.mock('../../server/appProvider', () => ({
    default: { pathUtils: { sep: '/' }, systemUtils: { isDev: false } },
}));
vi.mock('../../helper/appHooks', () => ({ useAppEffect: useEffect }));

import CanvasItem, {
    CanvasItemContext,
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useCanvasItemPropsSetterContext,
    useCanvasItemsContext,
    useEditingCanvasItemAndSetterContext,
    useSelectedCanvasItemsAndSetterContext,
    type CanvasItemPropsType,
} from './CanvasItem';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class TestCanvasItem extends CanvasItem<CanvasItemPropsType> {
    getStyle() {
        return {};
    }
}

function genItem(id = 1, width = 100) {
    return new TestCanvasItem({
        id,
        type: 'text',
        top: 0,
        left: 0,
        rotate: 0,
        width,
        height: 50,
    } as CanvasItemPropsType);
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

describe('CanvasItem contexts used outside their providers', () => {
    const cases: [string, () => unknown, string][] = [
        ['canvas items', useCanvasItemsContext, 'CanvasItemsContext not found'],
        [
            'selection',
            useSelectedCanvasItemsAndSetterContext,
            'SelectedCanvasItemsAndSetterContext not found',
        ],
        [
            'editing item',
            useEditingCanvasItemAndSetterContext,
            'EditingCanvasItemAndSetterContext not found',
        ],
        [
            'canvas item',
            useCanvasItemContext,
            'CanvasItem not provided in context',
        ],
        [
            'props setter',
            useCanvasItemPropsSetterContext,
            'CanvasItem not provided in context',
        ],
    ];
    for (const [name, useHook, message] of cases) {
        it(`throws for the ${name} hook`, () => {
            function ProbeComp() {
                useHook();
                return null;
            }
            expect(() => renderToStaticMarkup(<ProbeComp />)).toThrow(message);
        });
    }
});

describe('useCanvasItemPropsContext', () => {
    function WidthComp() {
        const props = useCanvasItemPropsContext();
        return <output>{`${props.id}:${props.width}`}</output>;
    }

    it('reads a copy of the props and refreshes on every edit event', async () => {
        const item = genItem(1, 100);
        expect(item.type).toBe('text');
        await act(async () => {
            root.render(
                <CanvasItemContext value={item}>
                    <WidthComp />
                </CanvasItemContext>,
            );
        });
        expect(container.textContent).toBe('1:100');
        item.props.width = 300;
        // a plain mutation is not seen until the item says it was edited
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toBe('1:100');
        await act(async () => {
            item.fireEditEvent();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toBe('1:300');
    });

    it('listens to the item it is given and lets go of it on unmount', async () => {
        const first = genItem(1, 100);
        const second = genItem(2, 200);
        const firstUnregister = vi.spyOn(first, 'unregisterEventListener');
        const secondUnregister = vi.spyOn(second, 'unregisterEventListener');
        await act(async () => {
            root.render(
                <CanvasItemContext value={first}>
                    <WidthComp />
                </CanvasItemContext>,
            );
        });
        await act(async () => {
            root.render(
                <CanvasItemContext value={second}>
                    <WidthComp />
                </CanvasItemContext>,
            );
        });
        expect(firstUnregister).toHaveBeenCalledTimes(1);
        expect(container.textContent).toBe('2:200');
        second.props.width = 250;
        await act(async () => {
            second.fireEditEvent();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(container.textContent).toBe('2:250');
        await act(async () => {
            root.unmount();
        });
        expect(secondUnregister).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });
});
