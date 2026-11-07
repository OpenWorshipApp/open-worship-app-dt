// @vitest-environment jsdom

// The Bible Lookup's modal over the REAL keyboard stack: while it is open the
// app underneath stops answering keys, its own close button answers both a
// click and Ctrl+Q, and whatever it holds knows it is inside a modal.

import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    lookup: { isShowing: false },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../bible-lookup/BibleLookupPopupComp', () => ({
    default: () => <div id="bible-lookup-popup">Bible Lookup</div>,
}));
vi.mock('../others/commonButtons', () => ({
    useIsBibleLookupShowingContext: () => mocks.lookup,
}));

import { ModalCloseButtonComp, ModalComp } from './ModalComp';
import { useIsInModalLayer } from './modalLayerContext';
import AppPopupBibleLookupComp from './AppPopupBibleLookupComp';
import KeyboardEventListener, {
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { checkIsKeyboardLayerClaimed } from '../event/keyboardLayerHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const rootShortcut = vi.fn();

function RootShortcutComp() {
    useKeyboardRegistering(
        [{ key: 'F6' }],
        () => {
            rootShortcut();
        },
        [],
    );
    return null;
}

function LayerProbeComp({ id }: Readonly<{ id: string }>) {
    return <span id={id}>{useIsInModalLayer() ? 'in modal' : 'outside'}</span>;
}

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
    act(() => {
        root.render(
            <>
                <RootShortcutComp />
                {node}
            </>,
        );
    });
}

async function press(init: KeyboardEventInit) {
    await act(async () => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    mocks.lookup.isShowing = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // The app shortcut registers first, on the layer on top before any modal.
    render(null);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('ModalComp', () => {
    test('holds the keyboard while open and tells its contents they are in a modal', async () => {
        render(
            <>
                <LayerProbeComp id="outside" />
                <ModalComp>
                    <LayerProbeComp id="inside" />
                </ModalComp>
            </>,
        );
        const modal = container.querySelector('#modal-container')!;
        expect(modal.querySelector('#inside')?.textContent).toBe('in modal');
        expect(container.querySelector('#outside')?.textContent).toBe(
            'outside',
        );
        expect(checkIsKeyboardLayerClaimed('bible-lookup')).toBe(true);
        expect(KeyboardEventListener.getLastLayer()).toBe('bible-lookup');
        await press({ key: 'F6', code: 'F6' });
        expect(rootShortcut).not.toHaveBeenCalled();

        render(<LayerProbeComp id="outside" />);
        expect(checkIsKeyboardLayerClaimed('bible-lookup')).toBe(false);
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        await press({ key: 'F6', code: 'F6' });
        expect(rootShortcut).toHaveBeenCalledOnce();
    });

    test('one modal closing inside another leaves the keyboard with the outer one', async () => {
        render(
            <ModalComp>
                <ModalComp>
                    <span>Info</span>
                </ModalComp>
            </ModalComp>,
        );
        expect(container.querySelectorAll('#modal-container')).toHaveLength(2);
        render(
            <ModalComp>
                <span>Lookup</span>
            </ModalComp>,
        );
        expect(checkIsKeyboardLayerClaimed('bible-lookup')).toBe(true);
        await press({ key: 'F6', code: 'F6' });
        expect(rootShortcut).not.toHaveBeenCalled();
        render(null);
        expect(checkIsKeyboardLayerClaimed('bible-lookup')).toBe(false);
    });

    test('its close button answers a click and Ctrl+Q, under the modal layer', async () => {
        const close = vi.fn();
        render(
            <ModalComp>
                <ModalCloseButtonComp close={close} />
            </ModalComp>,
        );
        const button = container.querySelector<HTMLButtonElement>(
            '#modal-container button[aria-label="Close"]',
        )!;
        expect(button.title).toBe('Close [Ctrl+Q]');
        act(() => {
            button.click();
        });
        expect(close).toHaveBeenCalledOnce();
        await press({ key: 'q', code: 'KeyQ', ctrlKey: true });
        expect(close).toHaveBeenCalledTimes(2);
        // A bare Q is no close.
        await press({ key: 'q', code: 'KeyQ' });
        expect(close).toHaveBeenCalledTimes(2);

        render(null);
        await press({ key: 'q', code: 'KeyQ', ctrlKey: true });
        expect(close).toHaveBeenCalledTimes(2);
    });
});

describe('AppPopupBibleLookupComp', () => {
    test('shows the Bible Lookup only while it is asked to', () => {
        render(<AppPopupBibleLookupComp />);
        expect(container.querySelector('#bible-lookup-popup')).toBeNull();
        mocks.lookup.isShowing = true;
        render(<AppPopupBibleLookupComp />);
        expect(
            container.querySelector('#bible-lookup-popup')?.textContent,
        ).toBe('Bible Lookup');
        mocks.lookup.isShowing = false;
        render(<AppPopupBibleLookupComp />);
        expect(container.querySelector('#bible-lookup-popup')).toBeNull();
    });
});
