// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    keyboard: [] as {
        eventMappers: unknown;
        listener: (event: { preventDefault: () => void }) => void;
        deps: unknown[];
        layer: unknown;
    }[],
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../app-modal/PrimitiveModalComp', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    POPUP_KEYBOARD_LAYER: 'popup',
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        eventMappers: unknown,
        listener: (event: { preventDefault: () => void }) => void,
        deps: unknown[],
        layer: unknown,
    ) => {
        state.keyboard.push({ eventMappers, listener, deps, layer });
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
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

import AlertPopupComp from './AlertPopupComp';
import { popupWidgetManager } from './popupWidgetHelpers';

let host: HTMLDivElement;
let root: Root;
let calls: string[];

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.keyboard = [];
    calls = [];
    popupWidgetManager.openAlert = (data) => {
        calls.push(data === null ? 'close-popup' : 'open-popup');
    };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    popupWidgetManager.openAlert = null;
    vi.unstubAllGlobals();
});

function genAlert(message = 'Saved <b>3</b> songs') {
    return {
        title: 'Import done',
        message,
        onClose: vi.fn(() => {
            calls.push('on-close');
        }),
    };
}

describe('AlertPopupComp', () => {
    test('shows the title and the message as sanitized HTML', async () => {
        await act(async () =>
            root.render(
                <AlertPopupComp
                    alertData={genAlert(
                        'Saved <b>3</b> songs<img src="x" onerror="alert(1)"><script>alert(2)</script>',
                    )}
                />,
            ),
        );
        const dialog = host.querySelector('[role="alertdialog"]')!;
        expect(dialog.getAttribute('aria-labelledby')).toBe(
            'app-alert-popup-title',
        );
        const title = host.querySelector('#app-alert-popup-title')!;
        expect(title.textContent).toBe('Import done');
        expect(title.getAttribute('title')).toBe('Import done');
        expect(title.querySelector('.bi-info-circle-fill')).not.toBeNull();
        const body = host.querySelector('#app-alert-popup-body')!;
        expect(body.querySelector('b')!.textContent).toBe('3');
        expect(body.querySelector('script')).toBeNull();
        expect(body.innerHTML).not.toContain('onerror');
    });

    test('Ok closes the popup before running the callback', async () => {
        const alertData = genAlert();
        await act(async () =>
            root.render(<AlertPopupComp alertData={alertData} />),
        );
        const ok = Array.from(host.querySelectorAll('button')).find(
            (button) => button.textContent === 'Ok',
        )!;
        await act(async () => ok.click());
        // The callback may open the next popup: it must win the slot.
        expect(calls).toEqual(['close-popup', 'on-close']);
    });

    test('the header close button closes it the same way', async () => {
        const alertData = genAlert();
        await act(async () =>
            root.render(<AlertPopupComp alertData={alertData} />),
        );
        const close = host.querySelector<HTMLButtonElement>(
            'button[aria-label="Close"]',
        )!;
        await act(async () => close.click());
        expect(calls).toEqual(['close-popup', 'on-close']);
        expect(alertData.onClose).toHaveBeenCalledOnce();
    });

    test('Escape and Enter close it, on the popup keyboard layer', async () => {
        const alertData = genAlert();
        await act(async () =>
            root.render(<AlertPopupComp alertData={alertData} />),
        );
        const registration = state.keyboard.at(-1)!;
        expect(registration.eventMappers).toEqual([
            { key: 'Escape' },
            { key: 'Enter' },
        ]);
        expect(registration.deps).toEqual([alertData]);
        expect(registration.layer).toBe('popup');
        const preventDefault = vi.fn();
        await act(async () => registration.listener({ preventDefault }));
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(calls).toEqual(['close-popup', 'on-close']);
    });

    test('with no popup host the callback still runs', async () => {
        popupWidgetManager.openAlert = null;
        const alertData = genAlert();
        await act(async () =>
            root.render(<AlertPopupComp alertData={alertData} />),
        );
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('.app-popup-footer button')!
                .click(),
        );
        expect(alertData.onClose).toHaveBeenCalledOnce();
    });
});
