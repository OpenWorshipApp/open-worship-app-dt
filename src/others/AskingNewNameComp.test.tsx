// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { showSimpleToastMock } = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

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

vi.mock('../server/fileHelpers', async () => {
    // The real rule: what the box refuses is the point of these tests.
    const { getPortableFileNameProblem } = await vi.importActual<
        typeof import('../server/fileHelpers')
    >('../server/fileHelpers');
    return {
        getPortableFileNameProblem,
        describePortableFileNameProblem: (problem: string) => {
            return `refused: ${problem}`;
        },
    };
});

vi.mock('../server/appProvider', async () => {
    const { win32 } = await import('node:path');
    return {
        default: {
            isPageScreen: false,
            isPageReader: false,
            systemUtils: { isDev: false },
            sessionData: { defaultStorageDirPath: null },
            pathUtils: win32,
            messageUtils: { sendData: () => {}, sendDataSync: () => null },
        },
    };
});

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

const { default: AskingNewNameComp } = await import('./AskingNewNameComp');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

async function renderBox(applyName: (name: string | null) => void) {
    await act(async () => {
        root.render(<AskingNewNameComp applyName={applyName} />);
    });
    return container.querySelector('input') as HTMLInputElement;
}

async function typeName(input: HTMLInputElement, name: string) {
    await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )?.set;
        setValue?.call(input, name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressEnter(input: HTMLInputElement) {
    await act(async () => {
        input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
    });
}

describe('AskingNewNameComp', () => {
    test('Enter refuses a name another computer would refuse', async () => {
        const applyName = vi.fn();
        const input = await renderBox(applyName);

        await typeName(input, 'Service 10:30');
        await pressEnter(input);

        // Enter used to apply the name unchecked.
        expect(applyName).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Invalid file name',
            'refused: characters',
        );
    });

    test('Enter refuses a Windows device name too', async () => {
        const applyName = vi.fn();
        const input = await renderBox(applyName);

        await typeName(input, 'nul.old');
        await pressEnter(input);

        expect(applyName).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Invalid file name',
            'refused: reserved',
        );
    });

    test('Enter applies a good name, the button shows why a bad one is bad', async () => {
        const applyName = vi.fn();
        const input = await renderBox(applyName);

        await typeName(input, 'Sunday Service');
        await pressEnter(input);
        expect(applyName).toHaveBeenCalledWith('Sunday Service');

        await typeName(input, '.hidden');
        await act(async () => {
            container.querySelector('button')?.click();
        });
        expect(applyName).toHaveBeenCalledTimes(1);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Invalid file name',
            'refused: leading-dot',
        );
    });
});
