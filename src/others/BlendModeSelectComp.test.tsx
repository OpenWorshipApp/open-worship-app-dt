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

import BlendModeSelectComp from './BlendModeSelectComp';
import { BLEND_MODE_GROUP_LIST } from '../helper/blendModeHelpers';

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

describe('BlendModeSelectComp', () => {
    test('offers Normal and every group of modes, in words', async () => {
        await act(async () =>
            root.render(
                <BlendModeSelectComp
                    className="form-select"
                    blendMode="screen"
                    setBlendMode={vi.fn()}
                />,
            ),
        );
        const select = host.querySelector('select')!;
        expect(select.className).toBe('form-select');
        expect(select.getAttribute('aria-label')).toBe('t:Blend Mode');
        expect(select.value).toBe('screen');
        expect(select.options[0].value).toBe('normal');
        expect(select.options[0].textContent).toBe('t:Normal');
        const groups = Array.from(select.querySelectorAll('optgroup'));
        expect(groups.map((group) => group.label)).toEqual(
            BLEND_MODE_GROUP_LIST.map((group) => `t:${group.labelKey}`),
        );
        const screen = select.querySelector<HTMLOptionElement>(
            'option[value="screen"]',
        )!;
        expect(screen.textContent).toBe('t:Screen Blend');
        const modeCount = BLEND_MODE_GROUP_LIST.reduce(
            (count, group) => count + group.modes.length,
            0,
        );
        expect(select.options).toHaveLength(modeCount + 1);
    });

    test('choosing a mode hands its value over', async () => {
        const setBlendMode = vi.fn();
        await act(async () =>
            root.render(
                <BlendModeSelectComp
                    className=""
                    blendMode="normal"
                    setBlendMode={setBlendMode}
                />,
            ),
        );
        const select = host.querySelector('select')!;
        await act(async () => {
            select.value = 'multiply';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(setBlendMode).toHaveBeenCalledExactlyOnceWith('multiply');
    });
});
