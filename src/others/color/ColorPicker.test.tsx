// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `ColorPickerComp.test.tsx` drives the real swatches and slider. Here they are
// stand-ins, so what is left of the picker itself is reachable: the hex field's
// keys, a picker nobody listens to, its own opacity change and Copy Color.

const state = vi.hoisted(() => ({
    showAppContextMenu: vi.fn(),
    copyToClipboard: vi.fn(),
    swatchProps: null as any,
}));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/helpers', () => ({
    freezeObject: (value: unknown) => value,
}));
vi.mock('../../helper/dragHelpers', () => ({ handleDragStart: vi.fn() }));
vi.mock('../../server/appHelpers', () => ({
    copyToClipboard: state.copyToClipboard,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: (x: number, y: number) =>
        new MouseEvent('click', { clientX: x, clientY: y }),
    showAppContextMenu: state.showAppContextMenu,
}));
vi.mock('./RenderColorsComp', () => ({
    default: (props: any) => {
        state.swatchProps = props;
        return (
            <button
                type="button"
                className="swatch-red"
                onClick={(event) => props.onColorChange('#ff0000', event)}
            >
                {props.selectedColor ?? 'none'}
            </button>
        );
    },
}));
vi.mock('./OpacitySliderComp', () => ({
    default: ({
        value,
        onOpacityChanged,
    }: {
        value: number;
        onOpacityChanged: (value: number, event: unknown) => void;
    }) => (
        <button
            type="button"
            className="opacity-half"
            data-value={value}
            onClick={(event) => onOpacityChanged(128, event)}
        >
            half
        </button>
    ),
}));

import ColorPickerComp from './ColorPicker';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.swatchProps = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function typeInto(input: HTMLInputElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressKey(input: HTMLInputElement, key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        input.dispatchEvent(event);
    });
    return event;
}

describe('the hex field of a collapsed picker', () => {
    test('Enter applies the typed color without the key reaching the page', async () => {
        const onColorChange = vi.fn();
        const onPageKeyDown = vi.fn();
        await act(async () =>
            root.render(
                <div onKeyDown={onPageKeyDown}>
                    <ColorPickerComp
                        defaultColor="#000000"
                        color="#FFFFFF"
                        onColorChange={onColorChange}
                        isCollapsable
                        colorInputLabel="Fill hex"
                    />
                </div>,
            ),
        );
        const input = host.querySelector<HTMLInputElement>(
            'input[aria-label="Fill hex"]',
        )!;
        await typeInto(input, '#ff8800');
        const event = await pressKey(input, 'Enter');
        expect(event.defaultPrevented).toBe(true);
        expect(onPageKeyDown).not.toHaveBeenCalled();
        expect(onColorChange).toHaveBeenCalledExactlyOnceWith(
            '#FF8800',
            expect.any(MouseEvent),
        );
        expect(input.value).toBe('#FF8800');
    });

    test('Escape throws the draft away', async () => {
        const onColorChange = vi.fn();
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color="#FFFFFF"
                    onColorChange={onColorChange}
                    isCollapsable
                    colorInputLabel="Fill hex"
                />,
            ),
        );
        const input = host.querySelector<HTMLInputElement>('input')!;
        await typeInto(input, '#123456');
        const event = await pressKey(input, 'Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(input.value).toBe('#FFFFFF');
        expect(onColorChange).not.toHaveBeenCalled();
    });

    test('other keys just type', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color="#FFFFFF"
                    onColorChange={vi.fn()}
                    isCollapsable
                    colorInputLabel="Fill hex"
                />,
            ),
        );
        const input = host.querySelector<HTMLInputElement>('input')!;
        const event = await pressKey(input, 'a');
        expect(event.defaultPrevented).toBe(false);
    });

    test('a color the chip is painted in keeps its own hex readable', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color="#000000"
                    isCollapsable
                />,
            ),
        );
        const chip = host.querySelector<HTMLElement>('.text-color-preview')!;
        expect(chip.textContent).toBe('#000000');
        // White text on the black chip.
        expect(chip.style.color).toBe('rgb(255, 255, 255)');
    });
});

describe('the open picker', () => {
    test('with no listener, picking a swatch changes nothing', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp defaultColor="#000000" color="#00FF00" />,
            ),
        );
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.swatch-red')!.click(),
        );
        expect(state.swatchProps.selectedColor).toBe('#00FF00');
    });

    test('the opacity slider re-applies the color with the new alpha', async () => {
        const onColorChange = vi.fn();
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color="#ff0000"
                    onColorChange={onColorChange}
                />,
            ),
        );
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.opacity-half')!.click(),
        );
        expect(onColorChange).toHaveBeenCalledExactlyOnceWith(
            '#FF000080',
            expect.anything(),
        );
        // The picker now holds the half-transparent color itself.
        expect(state.swatchProps.selectedColor).toBe('#FF000080');
        expect(
            host.querySelector('.opacity-half')!.getAttribute('data-value'),
        ).toBe('128');
    });

    test('with no color yet, the opacity slider has nothing to change', async () => {
        const onColorChange = vi.fn();
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color={undefined}
                    onColorChange={onColorChange}
                />,
            ),
        );
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.opacity-half')!.click(),
        );
        expect(onColorChange).not.toHaveBeenCalled();
    });

    test('a cleared color hides the opacity slider', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp defaultColor="#000000" color={null} />,
            ),
        );
        expect(host.querySelector('.opacity-half')).toBeNull();
    });
});

describe('Copy Color', () => {
    test('a right-click offers to copy the current color', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp defaultColor="#000000" color="#ABCDEF" />,
            ),
        );
        await act(async () => {
            host.querySelector('.color-picker')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(state.showAppContextMenu).toHaveBeenCalledOnce();
        const [, items] = state.showAppContextMenu.mock.calls[0];
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe('Copy Color');
        items[0].onSelect();
        expect(state.copyToClipboard).toHaveBeenCalledExactlyOnceWith(
            '#ABCDEF',
        );
    });

    test('the dots of a collapsed picker open the same menu', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp
                    defaultColor="#000000"
                    color="#ABCDEF"
                    isCollapsable
                />,
            ),
        );
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>(
                    'button[aria-label="More Options"]',
                )!
                .click(),
        );
        expect(state.showAppContextMenu).toHaveBeenCalledOnce();
    });

    test('with no color there is nothing to copy', async () => {
        await act(async () =>
            root.render(
                <ColorPickerComp defaultColor="#000000" color={null} />,
            ),
        );
        await act(async () => {
            host.querySelector('.color-picker')!.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(state.showAppContextMenu).not.toHaveBeenCalled();
    });
});
