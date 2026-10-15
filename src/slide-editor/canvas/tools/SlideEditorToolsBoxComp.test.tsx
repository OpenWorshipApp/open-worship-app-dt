// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    item: { id: 3, type: 'text' },
    props: { backgroundColor: '#ffffff' },
    controller: null as any,
    setProps: vi.fn(),
    edit: vi.fn(),
    full: vi.fn(),
    original: vi.fn(),
    strip: vi.fn(),
    order: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./SlideEditorToolTitleComp', () => ({
    default: ({ title, children }: { title: string; children: ReactNode }) =>
        createElement('section', {}, createElement('h3', {}, title), children),
}));
vi.mock('./SlideEditorToolAlignComp', () => ({
    default: ({ onData }: { onData: (patch: unknown) => void }) =>
        createElement(
            'button',
            { onClick: () => onData({ align: 'left' }) },
            'Align left',
        ),
}));
vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => h.controller,
}));
vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => h.item,
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));
vi.mock('./SlideEditorToolsColorComp', () => ({
    default: ({
        handleNoColoring,
        handleColorChanging,
    }: {
        handleNoColoring: () => void;
        handleColorChanging: (color: string) => void;
    }) =>
        createElement(
            'div',
            {},
            createElement(
                'button',
                { onClick: handleNoColoring },
                'Clear color',
            ),
            createElement(
                'button',
                { onClick: () => handleColorChanging('#aabbcc') },
                'Pick color',
            ),
        ),
}));
vi.mock('./ShapePropertiesComp', () => ({
    default: () => createElement('span', {}, 'Shape controls'),
}));
vi.mock('./BoxPositionSizeComp', () => ({
    default: () => createElement('span', {}, 'Position controls'),
}));
vi.mock('../../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));
vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../canvasHelpers', () => ({
    checkIsMediaCanvasItemType: (type: string) =>
        ['image', 'video'].includes(type),
}));

import SlideEditorToolsBoxComp from './SlideEditorToolsBoxComp';

let root: Root;
let container: HTMLDivElement;

async function renderBox() {
    await act(async () => root.render(createElement(SlideEditorToolsBoxComp)));
}

async function click(label: string) {
    const button = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((element) => element.textContent === label)!;
    await act(async () => button.click());
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.item = { id: 3, type: 'text' };
    h.props = { backgroundColor: '#ffffff' };
    h.edit.mockImplementation((_id, edit: (item: unknown) => void) =>
        edit(h.item),
    );
    h.controller = {
        editCanvasItemById: h.edit,
        applyCanvasItemFully: h.full,
        applyCanvasItemOriginal: h.original,
        applyCanvasItemMediaStrip: h.strip,
        applyOrderingData: h.order,
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

describe('slide editor box controls', () => {
    it('changes and clears a non-media box background', async () => {
        await renderBox();
        expect(container.textContent).toContain('Background Color');
        expect(container.textContent).toContain('Shape controls');
        expect(container.textContent).toContain('Position controls');
        await click('Pick color');
        expect(h.setProps).toHaveBeenCalledWith({ backgroundColor: '#aabbcc' });
        await click('Clear color');
        expect(h.setProps).toHaveBeenCalledWith({
            backgroundColor: '#00000000',
        });
        await click('Align left');
        expect(h.setProps).toHaveBeenCalledWith({ align: 'left' });
    });

    it('changes the current item layer and fits it to the canvas', async () => {
        await renderBox();
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Send backward"]',
                )!
                .click(),
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Bring forward"]',
                )!
                .click(),
        );
        expect(h.order.mock.calls).toEqual([
            [h.item, true],
            [h.item, false],
        ]);
        await click('Full');
        expect(h.edit).toHaveBeenCalledWith(3, expect.any(Function));
        expect(h.full).toHaveBeenCalledWith(h.item);
        expect(container.textContent).not.toContain('Original Size');
    });

    it('shows original and strip sizing only for media items', async () => {
        h.item = { id: 3, type: 'image' };
        await renderBox();
        expect(container.textContent).not.toContain('Background Color');
        await click('Original Size');
        await click('Strip');
        expect(h.original).toHaveBeenCalledWith(h.item);
        expect(h.strip).toHaveBeenCalledWith(h.item);
    });
});
