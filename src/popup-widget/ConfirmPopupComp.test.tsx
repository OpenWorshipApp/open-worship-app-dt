// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('../app-modal/PrimitiveModalComp', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    POPUP_KEYBOARD_LAYER: 'popup',
}));

vi.mock('./HeaderAlertPopupComp', () => ({
    default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `t:${text}`,
}));

vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (text: string) => text,
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

import ConfirmPopupComp from './ConfirmPopupComp';
import { popupWidgetManager, type ConfirmDataType } from './popupWidgetHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(confirmData: ConfirmDataType) {
    await act(async () => {
        root = createRoot(container);
        root.render(<ConfirmPopupComp confirmData={confirmData} />);
    });
}

function listButtonTexts() {
    return Array.from(container.querySelectorAll('button')).map((button) => {
        return button.textContent;
    });
}

function findButton(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (one) => {
            return one.textContent === text;
        },
    );
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
}

describe('ConfirmPopupComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        popupWidgetManager.openConfirm = vi.fn();
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => root?.unmount());
            root = null;
        }
        popupWidgetManager.openConfirm = null;
        container.remove();
    });

    test('shows only Cancel and Ok when no third answer is given', async () => {
        await render({ title: 'Question', body: 'Body', onConfirm: vi.fn() });
        expect(listButtonTexts()).toEqual(['t:Cancel', 't:Ok']);
    });

    test('a third answer closes the dialog as a no, after its own handler', async () => {
        const calls: string[] = [];
        const onConfirm = vi.fn((isOk: boolean) => {
            calls.push(`confirm:${isOk}`);
        });
        await render({
            title: 'Question',
            body: 'Body',
            onConfirm,
            cancelButtonLabel: 'Not Now',
            confirmButtonLabel: 'Move Now',
            extraButtonLabel: 'Hide for 30 days',
            onExtraButtonClick: () => {
                calls.push('extra');
            },
        });
        // Translated by the dialog itself, left of the other two.
        expect(listButtonTexts()).toEqual([
            't:Hide for 30 days',
            't:Not Now',
            't:Move Now',
        ]);

        await act(async () => {
            findButton('t:Hide for 30 days').click();
        });
        expect(popupWidgetManager.openConfirm).toHaveBeenCalledWith(null);
        expect(calls).toEqual(['extra', 'confirm:false']);
    });

    test('Cancel and Ok never run the third answer', async () => {
        const onExtraButtonClick = vi.fn();
        const onConfirm = vi.fn();
        await render({
            title: 'Question',
            body: 'Body',
            onConfirm,
            extraButtonLabel: 'Hide for 30 days',
            onExtraButtonClick,
        });
        await act(async () => {
            findButton('t:Cancel').click();
        });
        await act(async () => {
            findButton('t:Ok').click();
        });
        expect(onConfirm.mock.calls).toEqual([[false], [true]]);
        expect(onExtraButtonClick).not.toHaveBeenCalled();
    });
});
