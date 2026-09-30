// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('../app-modal/PrimitiveModalComp', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    // The popup registers its Enter/Escape under this layer explicitly — it
    // renders the wrapper that claims it, so it sits above the provider.
    POPUP_KEYBOARD_LAYER: 'popup',
}));

vi.mock('./HeaderAlertPopupComp', () => ({
    default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import InputPopupComp from './InputPopupComp';
import { popupWidgetManager, type InputDataType } from './popupWidgetHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(inputData: InputDataType) {
    await act(async () => {
        root = createRoot(container);
        root.render(<InputPopupComp inputData={inputData} />);
    });
}

describe('InputPopupComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        popupWidgetManager.openInput = vi.fn();
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => root?.unmount());
            root = null;
        }
        popupWidgetManager.openInput = null;
        container.remove();
    });

    test('keeps the popup open when its current value cannot be confirmed', async () => {
        const onConfirm = vi.fn();
        await render({
            title: 'Input',
            body: <input />,
            onConfirm,
            canConfirm: () => false,
        });

        await act(async () => {
            (container.querySelector('.btn-info') as HTMLButtonElement).click();
        });

        expect(popupWidgetManager.openInput).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('closes and confirms when validation succeeds', async () => {
        const onConfirm = vi.fn();
        await render({
            title: 'Input',
            body: <input />,
            onConfirm,
            canConfirm: () => true,
        });

        await act(async () => {
            (container.querySelector('.btn-info') as HTMLButtonElement).click();
        });

        expect(popupWidgetManager.openInput).toHaveBeenCalledWith(null);
        expect(onConfirm).toHaveBeenCalledWith(true);
    });
});
