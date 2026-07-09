// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appWarningMock, providerMock } = vi.hoisted(() => ({
    appWarningMock: vi.fn(),
    providerMock: {
        systemUtils: {
            isDev: false,
        },
        envUtils: {
            isFEUseEffectWarning: true,
        },
    },
}));

vi.mock('./loggerHelpers', () => ({
    appWarning: appWarningMock,
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

async function loadModule(isDev: boolean) {
    providerMock.systemUtils.isDev = isDev;
    vi.resetModules();
    return await import('./appHooks');
}

describe('debuggerHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useFakeTimers();
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
        vi.useRealTimers();
    });

    test('resolves useAppStateAsync values in non-dev mode', async () => {
        const module = await loadModule(false);
        const observedValues: Array<string | null | undefined> = [];

        function Probe() {
            const [value] = module.useAppStateAsync(
                async () => 'ready',
                [],
                'loading',
            );
            observedValues.push(value);
            return <div>{value}</div>;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(observedValues).toContain('loading');
        expect(observedValues).toContain('ready');
        expect(appWarningMock).not.toHaveBeenCalled();
    });

    test('supports useAppEffectAsync without deps or methods and runs cleanup', async () => {
        const module = await loadModule(false);
        const effectMock = vi.fn();
        const cleanupMock = vi.fn();

        function Probe() {
            module.useAppEffectAsync(
                async () => {
                    effectMock();
                    return cleanupMock;
                },
                undefined as any,
                undefined as any,
                'async-without-deps',
            );
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            root?.unmount();
            await Promise.resolve();
        });
        root = null;

        expect(effectMock).toHaveBeenCalledTimes(1);
        expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    test('warns about array dependencies and repeated dev-mode effects', async () => {
        const module = await loadModule(true);

        function Probe({ dep }: { dep: number[] }) {
            module.useAppEffect(() => undefined, [dep], 'repeat-key');
            return null;
        }

        if (!container) {
            throw new Error('Missing test container');
        }
        root = createRoot(container);
        for (let index = 0; index < 12; index++) {
            await act(async () => {
                root?.render(<Probe dep={[index]} />);
            });
        }

        const warningMessages = appWarningMock.mock.calls.map(
            (call) => call[0],
        );
        expect(
            warningMessages.some((message) =>
                String(message).includes('Detected object in dependency list'),
            ),
        ).toBe(true);
        expect(
            warningMessages.some((message) =>
                String(message).includes(
                    'repeat-key is called more than 10 times',
                ),
            ),
        ).toBe(true);
    });

    test('replaces async context methods after unmount and cleans up TestInfinite', async () => {
        const module = await loadModule(true);
        const cleanupMock = vi.fn();
        let capturedContext: Record<string, unknown> = {};

        function Probe() {
            module.useAppEffectAsync(
                async (methodContext) => {
                    capturedContext = methodContext;
                    return cleanupMock;
                },
                [],
                { setValue: vi.fn() },
                'async-key',
            );
            return <module.TestInfinite />;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            vi.advanceTimersByTime(25);
        });

        const button = container?.querySelector(
            'button',
        ) as HTMLButtonElement | null;
        expect(button?.textContent).toBe('Stop');

        await act(async () => {
            button?.click();
            await Promise.resolve();
        });

        expect(button?.disabled).toBe(true);
        expect(button?.textContent).toBe('Stopped');

        await act(async () => {
            root?.unmount();
            await Promise.resolve();
        });
        root = null;

        expect(cleanupMock).toHaveBeenCalledTimes(1);
        (capturedContext.setValue as (value: string) => void)('late');
        expect(appWarningMock).toHaveBeenCalledWith(
            '[useAppEffect] setValue is called after unmounting',
        );
    });
});
