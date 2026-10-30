// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));

import FontSizeControlComp from './FontSizeControlComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('FontSizeControlComp', () => {
    test('shows the size in both the field and the list, each labelled', async () => {
        await act(async () =>
            root.render(
                <FontSizeControlComp fontSize={60} setFontSize={vi.fn()} />,
            ),
        );
        const input = host.querySelector('input')!;
        const select = host.querySelector('select')!;
        expect(input.value).toBe('60');
        expect(select.value).toBe('60');
        expect(input.getAttribute('aria-label')).toBe('t:Font Size');
        expect(select.getAttribute('aria-label')).toBe('t:Font Size');
        // "--" then 300px down to 15px, in steps of 15.
        const optionTexts = Array.from(select.options).map(
            (option) => option.textContent,
        );
        expect(optionTexts).toHaveLength(21);
        expect(optionTexts[0]).toBe('--');
        expect(optionTexts[1]).toBe('300px');
        expect(optionTexts[20]).toBe('15px');
    });

    test('a picked size and a typed size both reach the setter as numbers', async () => {
        const setFontSize = vi.fn();
        await act(async () =>
            root.render(
                <FontSizeControlComp fontSize={60} setFontSize={setFontSize} />,
            ),
        );
        const select = host.querySelector('select')!;
        await act(async () => {
            select.value = '120';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(setFontSize).toHaveBeenLastCalledWith(120);
        const input = host.querySelector('input')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(input, '42');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(setFontSize).toHaveBeenLastCalledWith(42);
        expect(setFontSize).toHaveBeenCalledTimes(2);
    });
});
