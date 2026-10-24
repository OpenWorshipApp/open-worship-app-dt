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
