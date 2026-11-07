// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';

// ONE language's own font and size in Long Text Show: both unset until chosen,
// and everything else is Bible/LongText Properties', so every change leaves
// through the same reader the screen uses and a key at its default is dropped.

const { state } = vi.hoisted(() => ({
    state: {
        fontProps: null as any,
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/FontFamilyControlComp', () => ({
    default: (props: any) => {
        state.fontProps = props;
        return <span data-font={props.fontFamily} />;
    },
}));

import ForegroundLongTextStyleComp from './ForegroundLongTextStyleComp';

let container: HTMLDivElement;
let root: Root;
const onChange = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.fontProps = null;
    onChange.mockClear();
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
            <ForegroundLongTextStyleComp style={style} onChange={onChange} />,
        );
    });
}
function query<T extends Element = HTMLElement>(selector: string) {
    return container.querySelector(selector) as T | null;
}
function listRowLabels() {
    return Array.from(container.querySelectorAll('.fg-prop-name')).map((item) =>
        item.textContent?.trim(),
    );
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

describe('a language column’s own font and size', () => {
    test('holds the font and the size alone: colour, weight and alignment are the Bible’s look', async () => {
        await render(undefined);
        expect(listRowLabels()).toEqual(['Font', 'Text Size (%)']);
        expect(query('button[aria-label="Text Color"]')).toBeNull();
        expect(query('button[aria-label="Align center"]')).toBeNull();
        // No weight picker: it would stand against Bold.
        expect(state.fontProps.setFontWeight).toBeUndefined();
    });

    test('untouched, both are unset and nothing is lit', async () => {
        await render(undefined);
        expect(container.querySelectorAll('.fg-prop-engaged')).toHaveLength(0);
        expect(state.fontProps).toMatchObject({
            fontFamily: '',
            isShowingLabel: false,
        });
        expect(getRow('Font').title).toBe('Font Family');
        expect(
            query<HTMLInputElement>('input[aria-label="Text Size (%)"]')!.value,
        ).toBe('100');
        expect(
            query('button[title="Text Size (%): 100"]')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
    });

    test('a font or a size that is set lights its row', async () => {
        await render({ fontFamily: 'Khmer OS', fontSizeScale: 1.5 });
        expect(
            ['Font', 'Text Size (%)'].map((label) =>
                getRow(label).className.includes('fg-prop-engaged'),
            ),
        ).toEqual([true, true]);
        expect(state.fontProps).toMatchObject({ fontFamily: 'Khmer OS' });
        expect(
            query('button[title="Text Size (%): 150"]')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
    });

    test('a family is stored, and `--` gives the screen’s back', async () => {
        await render({ fontSizeScale: 0.8 });
        await act(async () => state.fontProps.setFontFamily('Battambang'));
        expect(onChange).toHaveBeenLastCalledWith({
            fontFamily: 'Battambang',
            fontSizeScale: 0.8,
        });
        await render({ fontFamily: 'Battambang' });
        await act(async () => state.fontProps.setFontFamily(''));
        // The family key is gone, not stored empty: no style at all.
        expect(onChange).toHaveBeenLastCalledWith(undefined);
    });

    test('a size preset sets the scale, and 100% is no scale at all', async () => {
        await render({ fontFamily: 'Georgia' });
        await act(async () =>
            query('button[title="Text Size (%): 60"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith({
            fontFamily: 'Georgia',
            fontSizeScale: 0.6,
        });
        await act(async () =>
            query('button[title="Text Size (%): 100"]')!.click(),
        );
        expect(onChange).toHaveBeenLastCalledWith({ fontFamily: 'Georgia' });
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
});
