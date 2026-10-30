// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    const defaults = {
        size: 300,
        dimColor: '#000000',
        dimOpacity: 70,
        edgeBlur: 20,
        isContrast: false,
    };
    const manager = {
        ...defaults,
        isShortcutTarget: true,
        isSpotlighting: false,
        setSize: vi.fn(),
        setDimColor: vi.fn(),
        setDimOpacity: vi.fn(),
        setEdgeBlur: vi.fn(),
        setIsContrast: vi.fn(),
        setIsArmed: vi.fn(),
        resetSettings: vi.fn(),
    };
    return {
        defaults,
        manager,
        shortcuts: new Map<string, (event?: any) => void>(),
        focusEventNames: [] as string[][],
    };
});

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        eventMappers: { key: string }[],
        listener: (event?: any) => void,
    ) => {
        h.shortcuts.set(eventMappers[0].key, listener);
    },
}));
vi.mock('../managers/screenDrawShortcutHelpers', () => ({
    drawShortcutMap: new Proxy(
        {},
        {
            get: (_target, shortcutId: string) => [{ key: shortcutId }],
        },
    ),
    toShortcutTitle: (title: string, ...shortcutIds: string[]) => {
        return `${title} [${shortcutIds.join(', ')}]`;
    },
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => ({ screenFocusManager: h.manager }),
}));
vi.mock('../managers/screenEventHelpers', () => ({
    useScreenFocusManagerEvents: (eventNames: string[]) => {
        h.focusEventNames.push(eventNames);
    },
}));
vi.mock('../managers/ScreenFocusManager', () => ({
    FOCUS_SIZE_MIN: 40,
    FOCUS_SIZE_MAX: 1200,
    FOCUS_DIM_MIN: 10,
    FOCUS_DIM_MAX: 100,
    FOCUS_BLUR_MIN: 0,
    FOCUS_BLUR_MAX: 100,
}));

import MiniScreenFocusHandlersComp from './MiniScreenFocusHandlersComp';

let container: HTMLDivElement;
let root: Root;

function getButton(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) => {
        return item.getAttribute('aria-label')?.startsWith(label);
    });
    if (button === undefined) {
        throw new Error(`Missing button: ${label}`);
    }
    return button;
}

function getInput(label: string) {
    return container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    )!;
}

function changeInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderComp() {
    await act(async () => {
        root.render(<MiniScreenFocusHandlersComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.shortcuts.clear();
    h.focusEventNames.length = 0;
    Object.assign(h.manager, h.defaults, {
        isShortcutTarget: true,
        isSpotlighting: false,
    });
    h.manager.resetSettings.mockImplementation(() => {
        Object.assign(h.manager, h.defaults);
    });
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

describe('MiniScreenFocusHandlersComp', () => {
    test('arms the spotlight while open and disarms it on close', async () => {
        await renderComp();
        expect(h.manager.setIsArmed).toHaveBeenCalledTimes(1);
        expect(h.manager.setIsArmed).toHaveBeenLastCalledWith(true);
        expect(h.focusEventNames).toContainEqual(['update']);

        await act(async () => {
            root.render(<></>);
        });
        expect(h.manager.setIsArmed).toHaveBeenLastCalledWith(false);
    });

    test('seeds every control from the manager', async () => {
        h.manager.size = 420;
        h.manager.dimOpacity = 55;
        h.manager.edgeBlur = 35;
        h.manager.dimColor = '#112233';
        await renderComp();

        expect(getInput('Spotlight size').value).toBe('420');
        expect(getInput('Dim the rest of the screen').value).toBe('55');
        expect(getInput('Spotlight edge blur (0 = hard edge)').value).toBe(
            '35',
        );
        expect(getInput('Dim color').value).toBe('#112233');
        // The swatch previews how much the dim will cover.
        expect(getInput('Dim color').style.opacity).toBe('0.55');
        expect(container.textContent).toContain('420px');
    });

    test('every slider writes both its own state and the manager', async () => {
        await renderComp();

        await act(async () => {
            getButton('Spotlight size +10').click();
        });
        expect(h.manager.setSize).toHaveBeenLastCalledWith(310);
        expect(getInput('Spotlight size').value).toBe('310');

        await act(async () => {
            changeInput(getInput('Dim the rest of the screen'), '40');
        });
        expect(h.manager.setDimOpacity).toHaveBeenLastCalledWith(40);
        expect(getInput('Dim color').style.opacity).toBe('0.4');

        await act(async () => {
            getButton('Spotlight edge blur (0 = hard edge) -5').click();
        });
        expect(h.manager.setEdgeBlur).toHaveBeenLastCalledWith(15);

        await act(async () => {
            changeInput(getInput('Dim color'), '#ff0000');
        });
        expect(h.manager.setDimColor).toHaveBeenLastCalledWith('#ff0000');
        expect(getInput('Dim color').value).toBe('#ff0000');
    });

    test('the size keys step by 10 and 50 within the 40..1200 range', async () => {
        h.manager.size = 60;
        await renderComp();

        await act(async () => {
            h.shortcuts.get('sizeDownBig')!({ repeat: false });
        });
        expect(h.manager.setSize).toHaveBeenLastCalledWith(40);
        await act(async () => {
            h.shortcuts.get('sizeUpBig')!({ repeat: true });
        });
        expect(h.manager.setSize).toHaveBeenLastCalledWith(90);
        await act(async () => {
            h.shortcuts.get('opacityUpBig')!({ repeat: false });
        });
        expect(h.manager.setDimOpacity).toHaveBeenLastCalledWith(90);
        await act(async () => {
            h.shortcuts.get('blurUp')!({ repeat: false });
        });
        expect(h.manager.setEdgeBlur).toHaveBeenLastCalledWith(25);
    });

    test('contrast toggles by button and by key, and flips its hint', async () => {
        await renderComp();
        const button = getButton('Contrast');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.title).toBe(
            'Spotlight: the circle reveals what the pointer is over' +
                ' [toggleContrast]',
        );

        await act(async () => {
            button.click();
        });
        expect(h.manager.setIsContrast).toHaveBeenLastCalledWith(true);
        expect(getButton('Contrast').getAttribute('aria-pressed')).toBe('true');
        expect(getButton('Contrast').className).toContain('btn-primary');
        expect(getButton('Contrast').title).toBe(
            'Contrast: the circle blocks what the pointer is over' +
                ' [toggleContrast]',
        );

        await act(async () => {
            h.shortcuts.get('toggleContrast')!({ repeat: false });
        });
        expect(h.manager.setIsContrast).toHaveBeenLastCalledWith(false);
        expect(getButton('Contrast').getAttribute('aria-pressed')).toBe(
            'false',
        );

        // A held key does not flap the toggle.
        await act(async () => {
            h.shortcuts.get('toggleContrast')!({ repeat: true });
        });
        expect(h.manager.setIsContrast).toHaveBeenCalledTimes(2);
    });

    test('keys are ignored while another preview owns the keyboard', async () => {
        await renderComp();
        h.manager.isShortcutTarget = false;

        await act(async () => {
            h.shortcuts.get('toggleContrast')!({ repeat: false });
            h.shortcuts.get('resetSettings')!({ repeat: false });
            h.shortcuts.get('sizeUp')!({ repeat: false });
        });
        expect(h.manager.setIsContrast).not.toHaveBeenCalled();
        expect(h.manager.resetSettings).not.toHaveBeenCalled();
        expect(h.manager.setSize).not.toHaveBeenCalled();
    });

    test('reset puts every control back to what the manager now holds', async () => {
        await renderComp();
        await act(async () => {
            getButton('Spotlight size +10').click();
            changeInput(getInput('Dim color'), '#00ff00');
        });
        await act(async () => {
            getButton('Contrast').click();
        });
        expect(getInput('Spotlight size').value).toBe('310');

        await act(async () => {
            getButton('Reset settings').click();
        });
        expect(h.manager.resetSettings).toHaveBeenCalledTimes(1);
        expect(getInput('Spotlight size').value).toBe('300');
        expect(getInput('Dim color').value).toBe('#000000');
        expect(getButton('Contrast').getAttribute('aria-pressed')).toBe(
            'false',
        );

        await act(async () => {
            h.shortcuts.get('resetSettings')!({ repeat: false });
        });
        expect(h.manager.resetSettings).toHaveBeenCalledTimes(2);
    });

    test('the hint follows whether the spotlight is held', async () => {
        await renderComp();
        expect(container.textContent).toContain(
            'Press and hold on the screen to spotlight',
        );
        expect(
            container.querySelector('.bi-record-circle.text-muted'),
        ).not.toBe(null);

        h.manager.isSpotlighting = true;
        await renderComp();
        expect(container.textContent).toContain('Release to stop');
        expect(container.querySelector('.text-primary')).not.toBe(null);
    });

    test('the panel buttons keep the overlay focused on mousedown', async () => {
        await renderComp();
        for (const label of ['Contrast', 'Reset settings']) {
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
            });
            getButton(label).dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
    });
});
