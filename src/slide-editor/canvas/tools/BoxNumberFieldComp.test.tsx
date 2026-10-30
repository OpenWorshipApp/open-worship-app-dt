// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    type Mock,
    test,
    vi,
} from 'vitest';

import BoxNumberFieldComp from './BoxNumberFieldComp';

let container: HTMLDivElement;
let root: Root;
let onChange: Mock<(value: number) => void>;

async function type(value: string) {
    const input = container.querySelector('input')!;
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onChange = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxNumberFieldComp', () => {
    test('names the input by its title and rounds the shown value', async () => {
        await act(async () => {
            root.render(
                <BoxNumberFieldComp
                    name="X:"
                    title="Offset X"
                    value={12.6}
                    min={-50}
                    max={50}
                    onChange={onChange}
                />,
            );
        });

        const group = container.firstElementChild as HTMLElement;
        expect(group.title).toBe('Offset X');
        const input = container.querySelector('input')!;
        expect(input.getAttribute('aria-label')).toBe('Offset X');
        expect(input.value).toBe('13');
        expect(input.min).toBe('-50');
        expect(input.max).toBe('50');
        // `px` unless told otherwise.
        expect(
            Array.from(container.querySelectorAll('.input-group-text')).map(
                (element) => element.textContent,
            ),
        ).toEqual(['X:', 'px']);
    });

    test('without a title the input is named by its label, in its own unit', async () => {
        await act(async () => {
            root.render(
                <BoxNumberFieldComp
                    name="Blur:"
                    value={4}
                    unit="%"
                    onChange={onChange}
                />,
            );
        });

        expect(
            container.querySelector('input')!.getAttribute('aria-label'),
        ).toBe('Blur:');
        expect(
            container.querySelectorAll('.input-group-text')[1].textContent,
        ).toBe('%');
    });

    test('reports typed numbers and ignores anything that is not one', async () => {
        await act(async () => {
            root.render(
                <BoxNumberFieldComp name="W:" value={10} onChange={onChange} />,
            );
        });

        await type('42.5');
        expect(onChange).toHaveBeenCalledExactlyOnceWith(42.5);
        await type('');
        expect(onChange).toHaveBeenCalledOnce();
    });
});
