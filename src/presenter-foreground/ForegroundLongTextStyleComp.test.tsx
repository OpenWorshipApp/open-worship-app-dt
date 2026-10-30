// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';

// ONE language's own look in Long Text Show: whatever it leaves alone is the
// screen's Bible text style, so every change leaves through the same reader
// the screen uses and a key at its default is dropped.

const { state } = vi.hoisted(() => ({
    state: {
        fontProps: null as any,
        pickerProps: null as any,
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/FontFamilyControlComp', () => ({
    default: (props: any) => {
        state.fontProps = props;
        return <span data-font={props.fontFamily} />;
    },
}));
vi.mock('../others/color/ColorPicker', () => ({
    default: (props: any) => {
        state.pickerProps = props;
        return <span data-picker={props.color} />;
    },
}));

import ForegroundLongTextStyleComp from './ForegroundLongTextStyleComp';

let container: HTMLDivElement;
let root: Root;
const onChange = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.fontProps = null;
    state.pickerProps = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render(style: LongTextColumnStyleType | undefined) {
    await act(async () => {
        root.render(
            <ForegroundLongTextStyleComp
                style={style}
                screenColor="#FFFFFF"
                onChange={onChange}
            />,
        );
    });
}
function query<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector(selector) as T | null;
}
function getRow(label: string) {
    const row = Array.from(container.querySelectorAll('.fg-prop')).find(
        (item) =>
            item.querySelector('.fg-prop-name')?.textContent?.trim() === label,
    );
    expect(row, `row ${label}`).toBeDefined();
    return row as HTMLElement;
}
async function typeSize(value: string) {
    const input = query<HTMLInputElement>('input[aria-label="Text Size (%)"]')!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return input;
}

describe('a language column’s own look', () => {
    test('untouched, it shows the screen’s look and lights nothing', async () => {
        await render(undefined);
        expect(container.querySelectorAll('.fg-prop-engaged')).toHaveLength(0);
        expect(state.fontProps).toMatchObject({
            fontFamily: '',
            fontWeight: '',
            isShowingLabel: false,
        });
        expect(getRow('Font').title).toBe('Font Family');
        // The swatch shows the screen's own colour while the column has none.
        const swatchGlyph = query('button[aria-label="Text Color"] i')!;
        expect(swatchGlyph.style.color).toBe('rgb(255, 255, 255)');
        expect(
            query<HTMLInputElement>('input[aria-label="Text Size (%)"]')!.value,
        ).toBe('100');
        expect(
            query('button[title="Text Size (%): 100"]')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
        expect(
            query('button[aria-label="Default"]')!.getAttribute('aria-pressed'),
        ).toBe('true');
    });

    test('a style that is set lights its rows', async () => {
        await render({
            fontFamily: 'Khmer OS',
            fontWeight: '700',
            color: '#FF0000',
            fontSizeScale: 1.5,
            textAlign: 'right',
        });
        expect(
            ['Font', 'Text Color', 'Text Size (%)', 'Text Align'].map((label) =>
                getRow(label).className.includes('fg-prop-engaged'),
            ),
        ).toEqual([true, true, true, true]);
        expect(state.fontProps).toMatchObject({
            fontFamily: 'Khmer OS',
            fontWeight: '700',
        });
        expect(
            query('button[title="Text Size (%): 150"]')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
        expect(
            query('button[aria-label="Align right"]')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
    });

    test('a new font family drops the old family’s weight', async () => {
        await render({ fontFamily: 'Khmer OS', fontWeight: '700' });
        await act(async () => state.fontProps.setFontFamily('Battambang'));
        expect(onChange).toHaveBeenLastCalledWith({ fontFamily: 'Battambang' });
        await act(async () => state.fontProps.setFontWeight('300'));
        expect(onChange).toHaveBeenLastCalledWith({
            fontFamily: 'Khmer OS',
            fontWeight: '300',
        });
    });

    test('the colour picker opens from the swatch; "no colour" is the screen’s again', async () => {
        await render({ color: '#00FF00', textAlign: 'center' });
        expect(query('[data-picker]')).toBeNull();
        await act(async () =>
            query('button[aria-label="Text Color"]')!.click(),
        );
        expect(query('.fg-prop-expand')!.getAttribute('aria-label')).toBe(
            'Text Color',
        );
        expect(state.pickerProps).toMatchObject({
            color: '#00FF00',
            defaultColor: '#FFFFFF',
        });
        await act(async () => state.pickerProps.onColorChange('#123456'));
        expect(onChange).toHaveBeenLastCalledWith({
            color: '#123456',
            textAlign: 'center',
        });
        await act(async () => state.pickerProps.onNoColor());
        // The colour key is gone, not stored empty.
        expect(onChange).toHaveBeenLastCalledWith({ textAlign: 'center' });
        await act(async () =>
            query('button[aria-label="Text Color"]')!.click(),
        );
        expect(query('[data-picker]')).toBeNull();
    });

    test('a size preset sets the scale, and 100% is no scale at all', async () => {
        await render({ textAlign: 'left' });
        await act(async () =>
            query('button[title="Text Size (%): 60"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith({
            fontSizeScale: 0.6,
            textAlign: 'left',
        });
        await act(async () =>
            query('button[title="Text Size (%): 100"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith({ textAlign: 'left' });
        // Everything back at its default is no style at all.
        await render({ fontSizeScale: 1.2 });
        await act(async () =>
            query('button[title="Text Size (%): 100"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith(undefined);
    });

    test('a typed size applies only once it is a size, and shows the stored one after leaving the box', async () => {
        await render(undefined);
        onChange.mockClear();
        // `8` on the way to `80` is below the smallest: kept, not applied.
        const input = await typeSize('8');
        expect(input.value).toBe('8');
        expect(onChange).not.toHaveBeenCalled();
        await typeSize('80');
        expect(onChange).toHaveBeenLastCalledWith({ fontSizeScale: 0.8 });
        await typeSize('250');
        expect(onChange).toHaveBeenCalledTimes(1);
        await act(async () => {
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        // The box shows the column's size again (the parent still says 100).
        expect(input.value).toBe('100');
    });

    test('alignment: a side is stored, Default removes it', async () => {
        await render({ fontWeight: '600' });
        await act(async () =>
            query('button[aria-label="Align center"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith({
            fontWeight: '600',
            textAlign: 'center',
        });
        await render({ fontWeight: '600', textAlign: 'center' });
        await act(async () => query('button[aria-label="Default"]')!.click());
        expect(onChange).toHaveBeenLastCalledWith({ fontWeight: '600' });
    });
});
