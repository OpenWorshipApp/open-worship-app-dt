// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    setProps: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));

// `boxEditorHelpers` stays real for its degree normalising; its theme import
// would reach the colour and drag helpers.
vi.mock('../../../others/themeHelpers', () => ({
    checkIsDarkMode: () => false,
}));

import BoxPositionSizeComp from './BoxPositionSizeComp';

let container: HTMLDivElement;
let root: Root;

function field(label: string) {
    return container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    )!;
}

async function type(label: string, value: string) {
    const input = field(label);
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.props = { left: 10.4, top: 20.6, width: 300, height: 150, rotate: 45 };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<BoxPositionSizeComp />));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxPositionSizeComp', () => {
    test('shows the box geometry as whole numbers with their units', () => {
        expect(
            ['Left', 'Top', 'Width', 'Height', 'Rotate:'].map(
                (label) => field(label).value,
            ),
        ).toEqual(['10', '21', '300', '150', '45']);
        const units = Array.from(
            container.querySelectorAll('.input-group-text'),
        ).map((element) => element.textContent);
        expect(units).toEqual([
            'X:',
            'px',
            'Y:',
            'px',
            'W:',
            'px',
            'H:',
            'px',
            'Rotate:',
            'deg',
        ]);
    });

    test('typed positions are stored as they are', async () => {
        await type('Left', '-25');
        expect(h.setProps).toHaveBeenLastCalledWith({ left: -25 });
        await type('Top', '12.5');
        expect(h.setProps).toHaveBeenLastCalledWith({ top: 12.5 });
    });

    test('a box can never be typed smaller than one pixel', async () => {
        await type('Width', '0');
        expect(h.setProps).toHaveBeenLastCalledWith({ width: 1 });
        await type('Height', '-40');
        expect(h.setProps).toHaveBeenLastCalledWith({ height: 1 });
        await type('Height', '90');
        expect(h.setProps).toHaveBeenLastCalledWith({ height: 90 });
    });

    test('a typed rotation is normalised like a dragged one', async () => {
        await type('Rotate:', '370');
        expect(h.setProps).toHaveBeenLastCalledWith({ rotate: 10 });
        await type('Rotate:', '-90');
        expect(h.setProps).toHaveBeenLastCalledWith({ rotate: 270 });
    });

    test('an emptied field stores nothing', async () => {
        await type('Left', '');
        expect(h.setProps).not.toHaveBeenCalled();
    });

    test('Reset Rotate puts the box upright', async () => {
        const reset = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Reset Rotate"]',
        )!;
        await act(async () => reset.click());
        expect(h.setProps).toHaveBeenCalledWith({ rotate: 0 });
    });
});
