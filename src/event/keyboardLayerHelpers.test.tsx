// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));

import KeyboardEventListener from './KeyboardEventListener';
import {
    getKeyboardLayerClaims,
    useKeyboardLayerClaim,
} from './keyboardLayerHelpers';

function ClaimComp() {
    useKeyboardLayerClaim('bible-lookup');
    return null;
}

describe('useKeyboardLayerClaim', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('holds the layer while mounted and hands it back on unmount', async () => {
        await act(async () => {
            root = createRoot(container!);
            root.render(<ClaimComp />);
        });
        expect(KeyboardEventListener.getLastLayer()).toBe('bible-lookup');

        await act(async () => {
            root?.render(<div />);
        });
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        expect(getKeyboardLayerClaims()).toEqual({});
    });

    test('two holders of one layer: the inner one closing must not release it', async () => {
        // The Bible Lookup's Info popup is a modal inside a modal, and a
        // confirm can be opened from another. Without the count the inner one
        // closing handed the keyboard back with the outer still on screen.
        await act(async () => {
            root = createRoot(container!);
            root.render(
                <>
                    <ClaimComp />
                    <ClaimComp />
                </>,
            );
        });
        expect(getKeyboardLayerClaims()).toEqual({ 'bible-lookup': 2 });
        expect(KeyboardEventListener.getLastLayer()).toBe('bible-lookup');

        await act(async () => {
            root?.render(<ClaimComp />);
        });
        expect(getKeyboardLayerClaims()).toEqual({ 'bible-lookup': 1 });
        expect(KeyboardEventListener.getLastLayer()).toBe('bible-lookup');

        await act(async () => {
            root?.render(<div />);
        });
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });
});
