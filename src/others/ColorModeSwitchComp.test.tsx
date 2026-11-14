// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import ColorModeSwitchComp from './ColorModeSwitchComp';
import type { ColorModeType } from './color/colorContrastHelpers';

let container: HTMLDivElement;
let root: Root;

function getButtons() {
    const [darkButton, lightButton] = [
        ...container.querySelectorAll<HTMLButtonElement>(
            '.app-presets-mode > button',
        ),
    ];
    return { darkButton, lightButton };
}

async function render(
    mode: ColorModeType,
    onChange = vi.fn(),
    onButtonMouseDown?: (event: { preventDefault(): void }) => void,
) {
    await act(async () => {
        root.render(
            <ColorModeSwitchComp
                mode={mode}
                onChange={onChange}
                onButtonMouseDown={onButtonMouseDown}
            />,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('Dark / Light beside a Presets row', () => {
    test('says which side the box is on', async () => {
        await render('dark');
        const group = container.querySelector('.app-presets-mode')!;
        expect(group.getAttribute('role')).toBe('group');
        expect(group.getAttribute('aria-label')).toBe('Background');
        let { darkButton, lightButton } = getButtons();
        expect(darkButton.textContent).toBe('Dark');
        expect(darkButton.title).toBe('Light words for a dark background');
        expect(darkButton.querySelector('i')!.className).toBe(
            'bi bi-moon-stars-fill',
        );
        expect(lightButton.textContent).toBe('Light');
        expect(lightButton.title).toBe('Dark words for a light background');
        expect(lightButton.querySelector('i')!.className).toBe(
            'bi bi-sun-fill',
        );
        expect(darkButton.getAttribute('aria-pressed')).toBe('true');
        expect(darkButton.className).toBe('app-presets-mode-on');
        expect(lightButton.getAttribute('aria-pressed')).toBe('false');
        expect(lightButton.className).toBe('');

        await render('light');
        ({ darkButton, lightButton } = getButtons());
        expect(darkButton.getAttribute('aria-pressed')).toBe('false');
        expect(darkButton.className).toBe('');
        expect(lightButton.getAttribute('aria-pressed')).toBe('true');
        expect(lightButton.className).toBe('app-presets-mode-on');
    });

    test('a press asks the panel for that side', async () => {
        const onChange = vi.fn();
        await render('dark', onChange);
        const { darkButton, lightButton } = getButtons();
        await act(async () => {
            lightButton.click();
        });
        expect(onChange).toHaveBeenLastCalledWith('light');
        await act(async () => {
            darkButton.click();
        });
        expect(onChange).toHaveBeenLastCalledWith('dark');
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    test("a strip's focus keeper is handed to both buttons", async () => {
        const onButtonMouseDown = vi.fn((event: { preventDefault(): void }) => {
            event.preventDefault();
        });
        await render('light', vi.fn(), onButtonMouseDown);
        for (const button of Object.values(getButtons())) {
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
            });
            button.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        expect(onButtonMouseDown).toHaveBeenCalledTimes(2);
    });
});
