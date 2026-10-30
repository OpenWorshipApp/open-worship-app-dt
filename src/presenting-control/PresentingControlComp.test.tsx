// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    provider: {
        isFocused: true,
        systemUtils: { isMac: false, isDev: false },
        getIsWindowFocused: () => h.provider.isFocused,
    },
    menuHandler: null as null | ((event: any, data: any) => void),
    unregisterMenu: vi.fn(),
    setAppMenuItems: vi.fn(),
    keyListener: null as null | (() => void),
    keyMappers: null as any,
    eventMappers: [{ key: 'P', wControlKey: ['Ctrl', 'Shift'] }],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../server/appProvider', () => ({ default: h.provider }));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    registerAppMenuClicked: (handler: any) => {
        h.menuHandler = handler;
        return h.unregisterMenu;
    },
    setAppMenuItems: h.setAppMenuItems,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (mappers: any, listener: () => void) => {
        h.keyMappers = mappers;
        h.keyListener = listener;
    },
}));
vi.mock('../keyboard-shortcut/appShortcutMappers', () => ({
    presentingControlEventMappers: h.eventMappers,
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense, createElement } = await import('react');
    return {
        default: ({ children }: any) =>
            createElement(Suspense, { fallback: null }, children),
    };
});
vi.mock('./ControllerComp', () => ({
    default: ({ onClose }: { onClose: () => void }) =>
        createElement(
            'button',
            { id: 'controller', onClick: onClose },
            'controller',
        ),
}));

import PresentingControlComp from './PresentingControlComp';

let container: HTMLDivElement;
let root: Root;

async function renderGate() {
    await act(async () => {
        root.render(createElement(PresentingControlComp));
    });
}

async function settle(callback: () => void) {
    await act(async () => {
        callback();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

function getController() {
    return container.querySelector<HTMLButtonElement>('#controller');
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.provider.isFocused = true;
    h.provider.systemUtils.isMac = false;
    h.menuHandler = null;
    h.keyListener = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('PresentingControlComp', () => {
    test('costs nothing but its menu entry until it is asked for', async () => {
        await renderGate();
        expect(container.innerHTML).toBe('');
        expect(h.setAppMenuItems).toHaveBeenCalledExactlyOnceWith(
            'presenting-control',
            {
                tools: [
                    {
                        label: 'Start Controlling',
                        accelerator: 'Ctrl+Shift+P',
                        clickData: { isTogglePresentingControl: true },
                    },
                ],
            },
            { isRoutedToFocusedWindow: true },
        );
        expect(h.keyMappers).toBe(h.eventMappers);
    });

    test('the mac menu names the Command chord', async () => {
        h.provider.systemUtils.isMac = true;
        await renderGate();
        const [, menusData] = h.setAppMenuItems.mock.calls[0];
        expect(menusData.tools[0].accelerator).toBe('Command+Shift+P');
    });

    test('the shortcut TOGGLES the controller', async () => {
        await renderGate();
        await settle(() => {
            h.keyListener!();
        });
        expect(getController()).not.toBeNull();
        await settle(() => {
            h.keyListener!();
        });
        expect(getController()).toBeNull();
    });

    test('the menu toggles it only in the window being looked at', async () => {
        await renderGate();
        const toggleData = { isTogglePresentingControl: true };

        h.provider.isFocused = false;
        await settle(() => {
            h.menuHandler!({}, toggleData);
        });
        expect(getController()).toBeNull();

        h.provider.isFocused = true;
        await settle(() => {
            h.menuHandler!({}, toggleData);
        });
        expect(getController()).not.toBeNull();
        await settle(() => {
            h.menuHandler!({}, toggleData);
        });
        expect(getController()).toBeNull();
    });

    test('other menu items are not this one', async () => {
        await renderGate();
        await settle(() => {
            h.menuHandler!({}, { isSomethingElse: true });
            h.menuHandler!({}, null);
        });
        expect(getController()).toBeNull();
    });

    test('the controller close puts it away, and unmount drops the menu listener', async () => {
        await renderGate();
        await settle(() => {
            h.keyListener!();
        });
        await settle(() => {
            getController()!.click();
        });
        expect(getController()).toBeNull();

        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(h.unregisterMenu).toHaveBeenCalledTimes(1);
    });
});
