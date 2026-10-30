// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The sibling `ArchivePasswordComp.test.tsx` covers the fields; this file
// covers the two ask-flows built on them, with the popup host driven here.

const state = vi.hoisted(() => ({
    showAppInput: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => `t:${key}` }));
vi.mock('./popupWidgetHelpers', () => ({ showAppInput: state.showAppInput }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

import {
    askForArchivePassword,
    askForNewArchivePassword,
    MAX_PASSWORD_ATTEMPTS,
} from './ArchivePasswordComp';

let host: HTMLDivElement;
let root: Root;
let pending: { body: ReactElement; answer: (isOk: boolean) => void }[];

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    pending = [];
    state.showAppInput.mockImplementation(
        (_title: string, body: ReactElement) =>
            new Promise<boolean>((resolve) => {
                pending.push({ body, answer: resolve });
            }),
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

// Each re-ask renders its new body into the SAME root, as the popup host
// does: React keeps the mounted fields and what was typed in them.
async function showLatestDialog() {
    await flush();
    await act(async () => root.render(pending.at(-1)!.body));
}

async function typeInto(index: number, value: string) {
    const input = host.querySelectorAll('input')[index];
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function answer(isOk: boolean) {
    await act(async () => pending.at(-1)!.answer(isOk));
    await flush();
}

function getWarning() {
    return host.querySelector<HTMLElement>('.mt-1[style]')?.textContent;
}

describe('askForNewArchivePassword', () => {
    test('returns the password once both fields agree', async () => {
        const result = askForNewArchivePassword('Export Data');
        await showLatestDialog();
        expect(state.showAppInput).toHaveBeenCalledWith(
            't:Export Data',
            expect.anything(),
            { escToCancel: true },
        );
        expect(host.querySelectorAll('input')).toHaveLength(2);
        await typeInto(0, 'grace');
        await typeInto(1, 'grace');
        await answer(true);
        await expect(result).resolves.toBe('grace');
        expect(state.showAppInput).toHaveBeenCalledOnce();
    });

    test('two empty fields mean no password at all', async () => {
        const result = askForNewArchivePassword('Export Data');
        await showLatestDialog();
        await answer(true);
        await expect(result).resolves.toBe('');
    });

    test('a mismatch asks again, saying why, and the fix is accepted', async () => {
        const result = askForNewArchivePassword('Export Data');
        await showLatestDialog();
        await typeInto(0, 'grace');
        await typeInto(1, 'graec');
        await answer(true);
        expect(state.showAppInput).toHaveBeenCalledTimes(2);
        await showLatestDialog();
        expect(getWarning()).toBe('t:Passwords do not match');
        await typeInto(1, 'grace');
        await answer(true);
        await expect(result).resolves.toBe('grace');
    });

    test('a second Ok with the mismatch left in place is NOT an unprotected export', async () => {
        const result = askForNewArchivePassword('Export Data');
        await showLatestDialog();
        await typeInto(0, 'grace');
        await typeInto(1, 'other');
        await answer(true);
        // The re-asked dialog keeps the typed values and must tell its new
        // listener about them, or Ok would read two empty fields.
        await showLatestDialog();
        await answer(true);
        expect(state.showAppInput).toHaveBeenCalledTimes(3);
        await showLatestDialog();
        await answer(true);
        // Out of attempts: nothing is exported rather than exported bare.
        await expect(result).resolves.toBeNull();
        expect(state.showAppInput).toHaveBeenCalledTimes(MAX_PASSWORD_ATTEMPTS);
    });

    test('Cancel stops the whole export', async () => {
        const result = askForNewArchivePassword('Export Data');
        await showLatestDialog();
        await typeInto(0, 'grace');
        await answer(false);
        await expect(result).resolves.toBeNull();
    });
});

describe('askForArchivePassword', () => {
    test('asks once, explains why, and returns what was typed', async () => {
        const result = askForArchivePassword('Import Data');
        await showLatestDialog();
        expect(state.showAppInput.mock.calls[0][0]).toBe('t:Import Data');
        expect(host.querySelectorAll('input')).toHaveLength(1);
        expect(getWarning()).toBe('t:This archive is password protected');
        await typeInto(0, 'grace');
        await answer(true);
        await expect(result).resolves.toBe('grace');
    });

    test('a wrong-password retry says so', async () => {
        const result = askForArchivePassword(
            'Import Data',
            'Wrong password, try again',
        );
        await showLatestDialog();
        expect(getWarning()).toBe('t:Wrong password, try again');
        await answer(false);
        await expect(result).resolves.toBeNull();
    });

    test('an empty answer is a cancel', async () => {
        const result = askForArchivePassword('Import Data');
        await showLatestDialog();
        await answer(true);
        await expect(result).resolves.toBeNull();
    });
});
