import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fork = vi.fn();

vi.mock('node:child_process', () => ({ fork }));
vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

describe('processHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        fork.mockReset();
    });

    test('forks the worker script and resolves on message', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: true }));
        const handlers: Record<string, (value: any) => void> = {};
        const processMock = {
            on: vi.fn((event: string, handler: (value: any) => void) => {
                handlers[event] = handler;
            }),
            kill: vi.fn(),
            send: vi.fn(),
        };
        fork.mockReturnValue(processMock);

        const { execute } = await import('./processHelpers');
        const promise = execute('worker.js', { ok: true });
        handlers.message({ done: true });

        await expect(promise).resolves.toEqual({ done: true });
        expect(fork).toHaveBeenCalledWith(
            path.resolve('/mock-app', 'public', 'js', 'worker.js'),
        );
        expect(processMock.send).toHaveBeenCalledWith({ ok: true });
        expect(processMock.kill).toHaveBeenCalledTimes(1);
    });

    test('rejects when child process exits with a non-zero code', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: false }));
        const handlers: Record<string, (value: any) => void> = {};
        fork.mockReturnValue({
            on: vi.fn((event: string, handler: (value: any) => void) => {
                handlers[event] = handler;
            }),
            kill: vi.fn(),
            send: vi.fn(),
        });

        const { execute } = await import('./processHelpers');
        const promise = execute('worker.js', {});
        handlers.exit(2);

        await expect(promise).rejects.toThrow('Process exited with code 2');
        expect(fork).toHaveBeenCalledWith(
            path.resolve('/mock-app', 'dist', 'js', 'worker.js'),
        );
    });

    test('rejects when child exits with code 0 without a message', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: true }));
        const handlers: Record<string, (value: any) => void> = {};
        const processMock = {
            on: vi.fn((event: string, handler: (value: any) => void) => {
                handlers[event] = handler;
            }),
            kill: vi.fn(),
            send: vi.fn(),
        };
        fork.mockReturnValue(processMock);

        const { execute } = await import('./processHelpers');
        const promise = execute('worker.js', {});
        handlers.exit(0);

        await expect(promise).rejects.toThrow('Process exited with code 0');
        expect(processMock.kill).toHaveBeenCalledTimes(1);
    });

    test('kills and rejects a child that never responds', async () => {
        vi.useFakeTimers();
        try {
            vi.doMock('./electronHelpers', () => ({ isDev: true }));
            const handlers: Record<string, (value: any) => void> = {};
            const processMock = {
                on: vi.fn((event: string, handler: (value: any) => void) => {
                    handlers[event] = handler;
                }),
                kill: vi.fn(),
                send: vi.fn(),
            };
            fork.mockReturnValue(processMock);

            const { execute } = await import('./processHelpers');
            const promise = execute('worker.js', {});
            const expectation = expect(promise).rejects.toThrow(
                'Process timed out: worker.js',
            );
            vi.advanceTimersByTime(1000 * 60 * 10);
            await expectation;
            expect(processMock.kill).toHaveBeenCalledTimes(1);

            // Later events must not settle the promise a second time.
            handlers.exit(0);
        } finally {
            vi.useRealTimers();
        }
    });

    test('settles only once when exit follows the message', async () => {
        vi.doMock('./electronHelpers', () => ({ isDev: true }));
        const handlers: Record<string, (value: any) => void> = {};
        const processMock = {
            on: vi.fn((event: string, handler: (value: any) => void) => {
                handlers[event] = handler;
            }),
            kill: vi.fn(),
            send: vi.fn(),
        };
        fork.mockReturnValue(processMock);

        const { execute } = await import('./processHelpers');
        const promise = execute('worker.js', {});
        handlers.message({ done: true });
        handlers.exit(0);

        await expect(promise).resolves.toEqual({ done: true });
        expect(processMock.kill).toHaveBeenCalledTimes(1);
    });
});
