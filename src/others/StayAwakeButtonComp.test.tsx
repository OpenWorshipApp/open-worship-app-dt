// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The real `appHomeStorage` runs over this, so what is asserted is the message
// the main process actually receives -- it acts on that write and on nothing
// else.
const h = vi.hoisted(() => ({
    stored: null as string | null,
    appProvider: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: {
            sendDataSync: vi.fn(),
            sendData: vi.fn(),
        },
    },
}));

vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import StayAwakeButtonComp from './StayAwakeButtonComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

function getButton() {
    return container.querySelector('button')!;
}

function clickButton() {
    act(() => {
        getButton().dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
}

describe('StayAwakeButtonComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.stored = null;
        h.appProvider.messageUtils.sendDataSync.mockImplementation(
            (channel: string, data: { type: string; key: string }) => {
                return channel === 'main:app:client-setting' &&
                    data.type === 'get' &&
                    data.key === 'stay-awake'
                    ? h.stored
                    : null;
            },
        );
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('is on when nothing was ever written', async () => {
        await render(<StayAwakeButtonComp />);

        const button = getButton();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.getAttribute('aria-label')).toBe('Stay Awake');
        expect(button.title).toBe(
            'Stay Awake — this computer will not sleep while this page is open',
        );
        expect(button.className).toBe('btn btn-outline-info');
        expect(button.querySelector('i')!.className).toBe('bi bi-cup-hot-fill');
        // Drawing it writes nothing: the default is not a stored value.
        expect(h.appProvider.messageUtils.sendData).not.toHaveBeenCalled();
    });

    test('opens switched off when it was left off', async () => {
        h.stored = 'false';
        await render(<StayAwakeButtonComp className="btn-sm ms-auto" />);

        const button = getButton();
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.title).toBe(
            'Stay Awake — turned off, this computer may sleep when no screen' +
                ' is showing',
        );
        expect(button.className).toBe(
            'btn btn-outline-secondary btn-sm ms-auto',
        );
        expect(button.querySelector('i')!.className).toBe('bi bi-cup');
    });

    test('a press writes the setting the main process acts on', async () => {
        await render(<StayAwakeButtonComp />);

        clickButton();
        expect(h.appProvider.messageUtils.sendData).toHaveBeenCalledTimes(1);
        expect(h.appProvider.messageUtils.sendData).toHaveBeenLastCalledWith(
            'main:app:client-setting',
            { type: 'set', key: 'stay-awake', value: 'false' },
        );
        expect(getButton().getAttribute('aria-pressed')).toBe('false');

        clickButton();
        expect(h.appProvider.messageUtils.sendData).toHaveBeenCalledTimes(2);
        expect(h.appProvider.messageUtils.sendData).toHaveBeenLastCalledWith(
            'main:app:client-setting',
            { type: 'set', key: 'stay-awake', value: 'true' },
        );
        expect(getButton().getAttribute('aria-pressed')).toBe('true');
    });
});
