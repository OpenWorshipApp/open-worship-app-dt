// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    appProvider: {
        messageUtils: {
            sendData: vi.fn(),
            sendDataSync: vi.fn(),
            listenForData: vi.fn(),
            removeListener: vi.fn(),
        },
    },
    isMainWindow: true,
    checkPackageUpdates: vi.fn(async () => ({})),
}));

vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('./appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});
vi.mock('../server/mainWindowHelpers', () => ({
    checkIsMainWindow: () => h.isMainWindow,
}));
vi.mock('./packageUpdateCheckHelpers', () => ({
    checkPackageUpdates: h.checkPackageUpdates,
}));

type HelpersType = typeof import('./packageUpdateHelpers');
let helpers: HelpersType;

function RenderDotComp({
    isCheckingAtLaunch = false,
}: Readonly<{ isCheckingAtLaunch?: boolean }>) {
    const packageUpdates = helpers.usePackageUpdates(isCheckingAtLaunch);
    if (packageUpdates === null) {
        return <span>unknown</span>;
    }
    return (
        <span>
            {helpers.checkHasPackageUpdate(packageUpdates) ? 'dot' : 'none'}
        </span>
    );
}

function getListener() {
    const [channel, listener] =
        h.appProvider.messageUtils.listenForData.mock.calls[0];
    expect(channel).toBe('main:app:package-updates');
    return listener as (event: unknown, data: unknown) => void;
}

describe('packageUpdateHelpers', () => {
    let container: HTMLDivElement;
    let root: Root | null = null;

    async function render(node: React.ReactNode) {
        await act(async () => {
            root = createRoot(container);
            root.render(node);
        });
    }

    beforeEach(async () => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useFakeTimers();
        h.isMainWindow = true;
        // A fresh module: the "already scheduled" flag is per window life.
        vi.resetModules();
        helpers = await import('./packageUpdateHelpers');
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
        vi.useRealTimers();
    });

    test('a window tells main what it learned, each half on its own', () => {
        helpers.reportPackageUpdates({ isExtraBinOutdated: false });
        expect(h.appProvider.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:package-updates',
            { isExtraBinOutdated: false },
        );
    });

    test('a window listens, then asks, and draws what main says', async () => {
        await render(<RenderDotComp />);
        const { listenForData, sendData, sendDataSync } =
            h.appProvider.messageUtils;
        expect(listenForData.mock.invocationCallOrder[0]).toBeLessThan(
            sendData.mock.invocationCallOrder[0],
        );
        expect(sendData).toHaveBeenCalledWith('all:app:get-package-updates');
        // Never a synchronous ask for a point of colour.
        expect(sendDataSync).not.toHaveBeenCalled();
        expect(container.textContent).toBe('unknown');

        const listener = getListener();
        await act(async () => {
            listener(null, { langCodes: ['xx'], isExtraBinOutdated: false });
        });
        expect(container.textContent).toBe('dot');
        await act(async () => {
            listener(null, { langCodes: [], isExtraBinOutdated: false });
        });
        expect(container.textContent).toBe('none');

        await act(async () => root?.unmount());
        root = null;
        expect(h.appProvider.messageUtils.removeListener).toHaveBeenCalledWith(
            'main:app:package-updates',
            listener,
        );
    });

    test('the gear in the main window looks once, after start-up, when nobody has', async () => {
        await render(
            <>
                <RenderDotComp isCheckingAtLaunch />
                <RenderDotComp isCheckingAtLaunch />
            </>,
        );
        const calls = h.appProvider.messageUtils.listenForData.mock.calls;
        expect(calls).toHaveLength(2);
        // Main has no answer for this launch yet: both gears hear `null`.
        await act(async () => {
            for (const [, listener] of calls) {
                listener(null, null);
            }
        });
        expect(h.checkPackageUpdates).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                helpers.PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS,
            );
        });
        // Two gears, one look.
        expect(h.checkPackageUpdates).toHaveBeenCalledTimes(1);
        expect(container.textContent).toBe('unknownunknown');
    });

    test('an answer already kept for the launch, or a window not the main one, does not look', async () => {
        await render(<RenderDotComp isCheckingAtLaunch />);
        const listener = getListener();
        await act(async () => {
            listener(null, { langCodes: [], isExtraBinOutdated: true });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                helpers.PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS * 2,
            );
        });
        expect(h.checkPackageUpdates).not.toHaveBeenCalled();
        expect(container.textContent).toBe('dot');

        // A Settings window, say: it draws, it never looks.
        h.isMainWindow = false;
        await act(async () => {
            listener(null, null);
            await vi.advanceTimersByTimeAsync(
                helpers.PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS * 2,
            );
        });
        expect(h.checkPackageUpdates).not.toHaveBeenCalled();
    });

    test('a dot that does not ask to look never looks, even with no answer', async () => {
        await render(<RenderDotComp />);
        await act(async () => {
            getListener()(null, null);
            await vi.advanceTimersByTimeAsync(
                helpers.PACKAGE_UPDATE_CHECK_DELAY_MILLISECONDS * 2,
            );
        });
        expect(h.checkPackageUpdates).not.toHaveBeenCalled();
    });
});
