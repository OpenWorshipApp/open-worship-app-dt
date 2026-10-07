// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import SimpleToastComp from '../../toast/SimpleToastComp';
import ScreenLockedToastMessageComp from './ScreenLockedToastMessageComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

function findUnlockButton() {
    return [...container.querySelectorAll('button')].find((button) => {
        return button.textContent === 'Unlock';
    }) as HTMLButtonElement;
}

// The refusal's own Unlock: after it is pressed the toast goes too. Left up,
// it went on saying "Screen Manager is locked" over the controls it covers,
// held open by the hover of the pointer that pressed it (2026-10-06).
describe('ScreenLockedToastMessageComp', () => {
    test('unlocks and closes the toast it is drawn in', () => {
        const onUnlock = vi.fn();
        const onClose = vi.fn();
        act(() => {
            root.render(
                <SimpleToastComp
                    onClose={onClose}
                    toast={{
                        title: 'Screen Manager is locked',
                        message: (
                            <ScreenLockedToastMessageComp onUnlock={onUnlock} />
                        ),
                    }}
                />,
            );
        });
        act(() => {
            findUnlockButton().click();
        });
        expect(onUnlock).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('still unlocks when drawn outside a toast', () => {
        const onUnlock = vi.fn();
        act(() => {
            root.render(<ScreenLockedToastMessageComp onUnlock={onUnlock} />);
        });
        act(() => {
            findUnlockButton().click();
        });
        expect(onUnlock).toHaveBeenCalledTimes(1);
        expect(findUnlockButton().disabled).toBe(true);
    });
});
