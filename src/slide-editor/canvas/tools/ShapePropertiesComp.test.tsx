// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: {} as any,
    setProps: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../../others/AppRangeComp', () => ({
    default: ({
        value,
        setValue,
    }: {
        value: number;
        setValue: (value: number) => void;
    }) =>
        createElement(
            'button',
            { onClick: () => setValue(40) },
            `Round range ${value}`,
        ),
}));
vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
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
vi.mock('../../../others/BlendModeSelectComp', () => ({
    default: ({
        blendMode,
        setBlendMode,
    }: {
        blendMode: string;
        setBlendMode: (value: string) => void;
    }) =>
        createElement(
            'button',
            { onClick: () => setBlendMode('multiply') },
            `Blend ${blendMode}`,
        ),
}));
vi.mock('../../../others/color/ColorPicker', () => ({
    default: ({ onColorChange }: { onColorChange: (value: string) => void }) =>
        createElement(
            'button',
            { onClick: () => onColorChange('#ff0000') },
            'Shadow color',
        ),
}));
vi.mock('./BoxNumberFieldComp', () => ({
    default: ({
        name,
        onChange,
    }: {
        name: string;
        onChange: (value: number) => void;
    }) => createElement('button', { onClick: () => onChange(9) }, name),
}));

import ShapePropertiesComp from './ShapePropertiesComp';

let root: Root;
let container: HTMLDivElement;

async function renderShape() {
    await act(async () => root.render(createElement(ShapePropertiesComp)));
}

async function changeValue(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.props = {
        backdropFilter: 0,
        roundSizePixel: 0,
        roundSizePercentage: 15,
        shadow: null,
        blendMode: 'normal',
    };
    h.setProps
        .mockReset()
        .mockImplementation((patch: any) => Object.assign(h.props, patch));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('canvas shape properties', () => {
    it('sets glass, percentage rounding, pixel rounding and blend mode', async () => {
        await renderShape();
        await changeValue('[aria-label="Glass Effect"]', '12');
        expect(h.setProps).toHaveBeenCalledWith({ backdropFilter: 12 });
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(h.setProps).toHaveBeenCalledWith({ roundSizePercentage: 40 });
        await changeValue('[aria-label="Round Size Pixel"]', '8');
        expect(h.setProps).toHaveBeenCalledWith({
            roundSizePixel: 8,
            roundSizePercentage: 0,
        });
        await act(async () =>
            Array.from(container.querySelectorAll('button'))
                .find((button) => button.textContent?.startsWith('Blend'))!
                .click(),
        );
        expect(h.setProps).toHaveBeenCalledWith({ blendMode: 'multiply' });
        await renderShape();
        expect(container.textContent).toContain('Blend multiply');
        expect(
            container.querySelector<HTMLElement>(
                '[title="Round Size %:"] .flex-grow-1',
            )?.style.pointerEvents,
        ).toBe('none');
    });

    it('starts with no shadow, then creates a visible default shadow', async () => {
        await renderShape();
        expect(container.querySelector('[title="Shadow Color"]')).toBeNull();
        const select = container.querySelector<HTMLSelectElement>(
            'select[aria-label="Shadow"]',
        )!;
        await act(async () => {
            select.value = 'box';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(h.setProps).toHaveBeenCalledWith({
            shadow: {
                kind: 'box',
                offsetX: 0,
                offsetY: 8,
                blur: 24,
                color: '#000000A6',
            },
        });
        await renderShape();
        expect(
            container.querySelector('[title="Shadow Color"]'),
        ).not.toBeNull();
        expect(container.textContent).toContain('X:');
        expect(container.textContent).toContain('Y:');
        expect(container.textContent).toContain('Blur:');
    });

    it('edits the shadow offset, blur and color, then clears it', async () => {
        h.props.shadow = {
            kind: 'drop',
            offsetX: 1,
            offsetY: 2,
            blur: 3,
            color: '#000000',
        };
        await renderShape();
        for (const label of ['X:', 'Y:', 'Blur:']) {
            await act(async () =>
                Array.from(container.querySelectorAll('button'))
                    .find((button) => button.textContent === label)!
                    .click(),
            );
            expect(h.setProps).toHaveBeenCalledWith(
                expect.objectContaining({
                    shadow: expect.objectContaining({
                        [label === 'X:'
                            ? 'offsetX'
                            : label === 'Y:'
                              ? 'offsetY'
                              : 'blur']: 9,
                    }),
                }),
            );
            await renderShape();
        }
        await act(async () =>
            Array.from(container.querySelectorAll('button'))
                .find((button) => button.textContent === 'Shadow color')!
                .click(),
        );
        expect(h.setProps).toHaveBeenCalledWith(
            expect.objectContaining({
                shadow: expect.objectContaining({ color: '#ff0000' }),
            }),
        );
        const select = container.querySelector<HTMLSelectElement>(
            'select[aria-label="Shadow"]',
        )!;
        await act(async () => {
            select.value = 'none';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(h.setProps).toHaveBeenCalledWith({ shadow: null });
    });
});
