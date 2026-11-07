// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    menu: vi.fn(),
    copy: vi.fn(),
    drag: vi.fn(),
    background: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
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
vi.mock('../../helper/helpers', () => ({
    freezeObject: (value: unknown) => value,
    HIGHLIGHT_SELECTED_CLASSNAME: 'app-highlight-selected',
    pressElementLikeButton: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            (event.currentTarget as HTMLElement).click();
        }
    },
}));
vi.mock('../../helper/dragHelpers', () => ({ handleDragStart: h.drag }));
vi.mock('../../server/appHelpers', () => ({
    copyToClipboard: h.copy,
    removeOpacityFromHexColor: (color: string) => color.slice(0, 7),
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: (x: number, y: number) =>
        new MouseEvent('click', { clientX: x, clientY: y }),
    showAppContextMenu: h.menu,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: MouseEvent) => void }) =>
        createElement('button', {
            type: 'button',
            'aria-label': 'Swatch menu',
            onClick: onOpening,
        }),
}));
vi.mock('../FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onSelect: (event: MouseEvent) => void) => [
        { menuElement: 'Show on screen', onSelect },
    ],
}));
vi.mock('../../_screen/managers/ScreenBackgroundManager', () => ({
    default: { handleBackgroundSelecting: h.background },
}));
vi.mock('../AppRangeComp', () => ({
    default: ({
        value,
        title,
        setValue,
    }: {
        value: number;
        title: string;
        setValue: (value: number) => void;
    }) =>
        createElement('input', {
            type: 'range',
            title,
            value,
            min: 1,
            max: 255,
            onChange: (event: { currentTarget: HTMLInputElement }) =>
                setValue(Number(event.currentTarget.value)),
        }),
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import ColorPickerComp from './ColorPicker';
import RenderColorsComp from './RenderColorsComp';
import RenderColorComp from './RenderColorComp';
import { ColorSwatchExtraMenuContext } from './colorSwatchMenuHelpers';
import OpacitySliderComp from './OpacitySliderComp';

let root: Root;
let container: HTMLDivElement;
let onColorChange: Mock<(color: `#${string}`, event: MouseEvent) => void>;
let onNoColor: Mock<(color: `#${string}`, event: MouseEvent) => void>;

async function renderPicker(
    options: {
        color?: `#${string}` | null;
        isCollapsable?: boolean;
        isNoImmediate?: boolean;
        colorInputLabel?: string;
        canClear?: boolean;
    } = {},
) {
    await act(async () =>
        root.render(
            createElement(ColorPickerComp, {
                defaultColor: '#112233',
                color: options.color === undefined ? '#FFFFFF' : options.color,
                onColorChange,
                onNoColor: options.canClear === false ? undefined : onNoColor,
                isCollapsable: options.isCollapsable,
                isNoImmediate: options.isNoImmediate,
                colorInputLabel: options.colorInputLabel,
            }),
        ),
    );
}

function getButton(name: string) {
    const element = container.querySelector<HTMLElement>(
        `[aria-label="${name}"]`,
    );
    expect(element).not.toBeNull();
    return element!;
}

function changeInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!;
    descriptor.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.menu.mockClear();
    h.copy.mockClear();
    h.drag.mockClear();
    h.background.mockClear();
    onColorChange = vi.fn<(color: `#${string}`, event: MouseEvent) => void>();
    onNoColor = vi.fn<(color: `#${string}`, event: MouseEvent) => void>();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('color picker controls', () => {
    it('normalizes a short hex draft and rejects invalid input', async () => {
        await renderPicker({
            isCollapsable: true,
            colorInputLabel: 'Fill hex',
        });
        expect(
            getButton('Choose Color: #FFFFFF').getAttribute('aria-expanded'),
        ).toBe('false');
        const input = container.querySelector<HTMLInputElement>(
            'input[aria-label="Fill hex"]',
        )!;
        await act(async () => {
            input.focus();
            changeInputValue(input, 'abc');
        });
        await act(async () =>
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
        );
        expect(onColorChange).toHaveBeenCalledWith(
            '#AABBCC',
            expect.any(MouseEvent),
        );
        await renderPicker({
            color: '#AABBCC',
            isCollapsable: true,
            colorInputLabel: 'Fill hex',
        });
        await act(async () => {
            changeInputValue(input, 'bad color');
        });
        await act(async () =>
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
        );
        expect(input.value).toBe('#AABBCC');
        expect(onColorChange).toHaveBeenCalledTimes(1);
    });

    it('opens swatches, preserves visible opacity and clears to the default', async () => {
        await renderPicker({ color: '#11223300', isCollapsable: true });
        await act(async () => getButton('Choose Color: #11223300').click());
        expect(getButton('Collapse').getAttribute('aria-expanded')).toBe(
            'true',
        );
        await act(async () => getButton('fuchsia').click());
        expect(onColorChange.mock.calls[0][0]).toBe('#FF00FFFF');
        expect(
            (onColorChange.mock.calls[0][1] as any).nativeEvent,
        ).toBeInstanceOf(MouseEvent);
        await act(async () => getButton('No Color').click());
        expect(onNoColor.mock.calls[0][0]).toBe('#112233');
        await act(async () => getButton('Collapse').click());
        expect(
            container.querySelector('[aria-expanded="false"]'),
        ).not.toBeNull();
    });

    it('offers no-color only when supported and makes swatches keyboard accessible', async () => {
        const onSelection = vi.fn();
        await act(async () =>
            root.render(
                createElement(RenderColorsComp, {
                    colors: { ruby: '#AA0000', leaf: '#00AA00' },
                    selectedColor: '#AA000099',
                    onColorChange: onSelection,
                    canNoColor: false,
                }),
            ),
        );
        expect(container.querySelector('[aria-label="No Color"]')).toBeNull();
        expect(getButton('ruby').getAttribute('aria-pressed')).toBe('true');
        const leaf = getButton('leaf');
        await act(async () =>
            leaf.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                }),
            ),
        );
        expect(leaf.getAttribute('role')).toBe('button');
        expect(onSelection.mock.calls[0][0]).toBe('#00AA00');
        expect(container.querySelector('input[type="color"]')).not.toBeNull();
    });

    it('copies or presents a swatch and carries its color while dragging', async () => {
        const extra = vi.fn(() => [{ menuElement: 'Extra action' }]);
        await act(async () =>
            root.render(
                createElement(
                    ColorSwatchExtraMenuContext,
                    { value: extra },
                    createElement(RenderColorComp, {
                        name: 'Signal red',
                        color: '#EE0000',
                        isSelected: true,
                        onClick: onColorChange as any,
                    }),
                ),
            ),
        );
        const swatch = getButton('Signal red');
        await act(async () =>
            swatch.dispatchEvent(new Event('dragstart', { bubbles: true })),
        );
        expect(h.drag).toHaveBeenCalledTimes(1);
        expect(h.drag.mock.calls[0][1].dragSerialize()).toMatchObject({
            data: '#EE0000',
        });
        await act(async () =>
            swatch.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        const menuItems = h.menu.mock.calls.at(-1)![1];
        expect(
            menuItems.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual([
            "Copy '#EE0000' to clipboard",
            'Show on screen',
            'Extra action',
        ]);
        await act(async () => menuItems[0].onSelect());
        expect(h.copy).toHaveBeenCalledWith('#EE0000');
        await act(async () => menuItems[1].onSelect(new MouseEvent('click')));
        expect(h.background).toHaveBeenCalledWith(
            expect.any(MouseEvent),
            'color',
            { src: '#EE0000' },
            true,
        );
    });

    it('delays the last opacity change and follows an external value', async () => {
        const changed = vi.fn();
        await act(async () =>
            root.render(
                createElement(OpacitySliderComp, {
                    value: 255,
                    onOpacityChanged: changed,
                }),
            ),
        );
        const slider = container.querySelector<HTMLInputElement>(
            'input[type="range"]',
        )!;
        await act(async () => {
            changeInputValue(slider, '80');
            changeInputValue(slider, '40');
        });
        await act(async () => vi.advanceTimersByTime(499));
        expect(changed).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(changed).toHaveBeenCalledTimes(1);
        expect(changed).toHaveBeenCalledWith(40, expect.anything());
        await act(async () =>
            root.render(
                createElement(OpacitySliderComp, {
                    value: 120,
                    onOpacityChanged: changed,
                }),
            ),
        );
        expect(slider.value).toBe('120');
    });
});

describe('color picker value box, opacity and menu', () => {
    function pressKeyOn(element: HTMLElement, key: string) {
        const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
        });
        element.dispatchEvent(event);
        return event;
    }

    it('applies the typed hex on Enter and puts the held one back on Escape', async () => {
        await renderPicker({
            color: '#112233',
            isCollapsable: true,
            colorInputLabel: 'Fill hex',
        });
        const input = container.querySelector<HTMLInputElement>(
            'input[aria-label="Fill hex"]',
        )!;
        const documentKeyDown = vi.fn();
        document.addEventListener('keydown', documentKeyDown);
        try {
            await act(async () => changeInputValue(input, '#a1b2c3'));
            let event: KeyboardEvent | null = null;
            await act(async () => {
                event = pressKeyOn(input, 'Enter');
            });
            expect(event!.defaultPrevented).toBe(true);
            expect(onColorChange).toHaveBeenCalledTimes(1);
            expect(onColorChange).toHaveBeenCalledWith(
                '#A1B2C3',
                expect.any(MouseEvent),
            );
            expect(input.value).toBe('#A1B2C3');

            await act(async () => changeInputValue(input, 'ffffff'));
            await act(async () => {
                event = pressKeyOn(input, 'Escape');
            });
            expect(event!.defaultPrevented).toBe(true);
            expect(input.value).toBe('#A1B2C3');
            expect(onColorChange).toHaveBeenCalledTimes(1);
            // Both keys stay inside the box, e.g. away from a popup's Enter/Esc.
            expect(documentKeyDown).not.toHaveBeenCalled();

            await act(async () => {
                event = pressKeyOn(input, 'Tab');
            });
            expect(event!.defaultPrevented).toBe(false);
            expect(documentKeyDown).toHaveBeenCalledTimes(1);
        } finally {
            document.removeEventListener('keydown', documentKeyDown);
        }
    });

    it('keeps the held color when nobody listens for a change', async () => {
        await act(async () =>
            root.render(
                createElement(ColorPickerComp, {
                    defaultColor: '#112233',
                    color: '#FFFFFF',
                }),
            ),
        );
        expect(getButton('white').getAttribute('aria-pressed')).toBe('true');
        await act(async () => getButton('fuchsia').click());
        expect(getButton('white').getAttribute('aria-pressed')).toBe('true');
        expect(getButton('fuchsia').getAttribute('aria-pressed')).toBe('false');
        // Nothing to clear with either.
        expect(container.querySelector('[aria-label="No Color"]')).toBeNull();
    });

    it('changes the opacity of the held color, and of none when none is held', async () => {
        await renderPicker({ color: '#FF0000FF' });
        const slider = container.querySelector<HTMLInputElement>(
            'input[type="range"]',
        )!;
        await act(async () => changeInputValue(slider, '128'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(onColorChange).toHaveBeenCalledTimes(1);
        expect(onColorChange.mock.calls[0][0]).toBe('#FF000080');

        await act(async () =>
            root.render(
                createElement(ColorPickerComp, {
                    defaultColor: '#112233',
                    color: undefined,
                    onColorChange,
                }),
            ),
        );
        const emptySlider = container.querySelector<HTMLInputElement>(
            'input[type="range"]',
        )!;
        expect(emptySlider.value).toBe('255');
        await act(async () => changeInputValue(emptySlider, '40'));
        await act(async () => vi.advanceTimersByTime(500));
        expect(onColorChange).toHaveBeenCalledTimes(1);
    });

    it('offers to copy the held color, from its dots and a right-click', async () => {
        await renderPicker({ color: '#ABCDEF' });
        await act(async () => getButton('Swatch menu').click());
        expect(h.menu).toHaveBeenCalledTimes(1);
        const menuItems = h.menu.mock.calls[0][1];
        expect(
            menuItems.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['Copy Color']);
        await act(async () => menuItems[0].onSelect());
        expect(h.copy).toHaveBeenCalledWith('#ABCDEF');
        await act(async () =>
            container
                .querySelector('.color-picker')!
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
        );
        expect(h.menu).toHaveBeenCalledTimes(2);

        await renderPicker({ color: null });
        await act(async () => getButton('Swatch menu').click());
        expect(h.menu).toHaveBeenCalledTimes(2);
    });

    it('writes out the held color code and copies it when pressed', async () => {
        await renderPicker({ color: '#ABCDEF80' });
        const codeButton = getButton('Copy Color: #ABCDEF80');
        expect(codeButton.textContent).toBe('#ABCDEF80');
        await act(async () => codeButton.click());
        expect(h.copy).toHaveBeenCalledWith('#ABCDEF80', 'Copy Color');

        await renderPicker({ color: null });
        expect(container.querySelector('.color-picker-code')).toBeNull();
    });

    it('passes a mixed color on after its pause, and No Color on Enter', async () => {
        const onSelection = vi.fn();
        await act(async () =>
            root.render(
                createElement(RenderColorsComp, {
                    colors: { ruby: '#AA0000' },
                    selectedColor: '#AA0000',
                    onColorChange: onSelection,
                }),
            ),
        );
        const mixInput = container.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        // One `input`, the way a picked color arrives.
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(mixInput, '#123456');
            mixInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => vi.advanceTimersByTime(499));
        expect(onSelection).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(onSelection).toHaveBeenCalledTimes(1);
        expect(onSelection.mock.calls[0][0]).toBe('#123456');
        expect(onSelection.mock.calls[0][1]).toBeInstanceOf(MouseEvent);

        await act(async () => {
            pressKeyOn(getButton('No Color'), 'Enter');
        });
        expect(onSelection).toHaveBeenCalledTimes(2);
        expect(onSelection.mock.calls[1][0]).toBeNull();
    });
});
