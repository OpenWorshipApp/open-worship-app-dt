// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The tab's view of the main process: one `vd:state` read, then pushes. The
// module keeps that in module state, so every test loads it fresh.
const { listeners, sendDataSyncMock, electronSendAsyncMock } = vi.hoisted(
    () => ({
        listeners: [] as Array<{
            channel: string;
            callback: (_event: unknown, value: unknown) => void;
        }>,
        sendDataSyncMock: vi.fn(),
        electronSendAsyncMock: vi.fn(),
    }),
);

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            listenForData: (
                channel: string,
                callback: (_event: unknown, value: unknown) => void,
            ) => {
                listeners.push({ channel, callback });
            },
            sendDataSync: sendDataSyncMock,
        },
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `T(${key})`,
}));

async function loadHelpers() {
    vi.resetModules();
    return import('./virtualDisplayHelpers');
}

function push(value: unknown) {
    const found = listeners.filter(({ channel }) => channel === 'vd:state');
    expect(found).toHaveLength(1);
    found[0].callback(null, value);
}

const FIRST = { available: true, displays: [], port: 40000 };
const SECOND = { available: true, displays: [{ number: 2 }], port: 40001 };

beforeEach(() => {
    listeners.length = 0;
    sendDataSyncMock.mockReturnValue(FIRST);
});

describe('getVirtualDisplayState', () => {
    test('the first read listens for pushes and reads the state once', async () => {
        const { getVirtualDisplayState } = await loadHelpers();
        expect(listeners).toHaveLength(0);
        expect(getVirtualDisplayState()).toBe(FIRST);
        expect(sendDataSyncMock).toHaveBeenCalledExactlyOnceWith('vd:state');
        expect(listeners.map(({ channel }) => channel)).toEqual(['vd:state']);

        // Read again: no second listener, no second synchronous read.
        expect(getVirtualDisplayState()).toBe(FIRST);
        expect(sendDataSyncMock).toHaveBeenCalledTimes(1);
        expect(listeners).toHaveLength(1);
    });

    test('a main process with nothing to say reads as null', async () => {
        sendDataSyncMock.mockReturnValue(undefined);
        const { getVirtualDisplayState } = await loadHelpers();
        expect(getVirtualDisplayState()).toBeNull();
    });

    test('a push replaces the state without asking again', async () => {
        const { getVirtualDisplayState } = await loadHelpers();
        getVirtualDisplayState();
        push(SECOND);
        expect(getVirtualDisplayState()).toBe(SECOND);
        expect(sendDataSyncMock).toHaveBeenCalledTimes(1);
    });
});

describe('useVirtualDisplayState', () => {
    let container: HTMLDivElement;
    let roots: Root[];

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        roots = [];
    });

    afterEach(() => {
        act(() => {
            for (const root of roots) {
                root.unmount();
            }
        });
        container.remove();
    });

    async function mountProbe(
        useHook: () => { port: number } | null,
        id: string,
    ) {
        const host = document.createElement('div');
        host.id = id;
        container.appendChild(host);
        const root = createRoot(host);
        roots.push(root);
        function ProbeComp() {
            const value = useHook();
            return (
                <span>{value === null ? 'none' : `port ${value.port}`}</span>
            );
        }
        await act(async () => {
            root.render(<ProbeComp />);
        });
        return { host, root };
    }

    test('every mounted reader follows pushes, and one unmounted stops listening', async () => {
        const { useVirtualDisplayState } = await loadHelpers();
        const first = await mountProbe(useVirtualDisplayState as any, 'a');
        const second = await mountProbe(useVirtualDisplayState as any, 'b');
        expect(first.host.textContent).toBe('port 40000');
        expect(second.host.textContent).toBe('port 40000');

        await act(async () => {
            push(SECOND);
        });
        expect(first.host.textContent).toBe('port 40001');
        expect(second.host.textContent).toBe('port 40001');

        act(() => {
            first.root.unmount();
        });
        roots.splice(roots.indexOf(first.root), 1);
        expect(first.host.textContent).toBe('');
        await act(async () => {
            push({ ...SECOND, port: 40002 });
        });
        expect(second.host.textContent).toBe('port 40002');
        expect(first.host.textContent).toBe('');
    });

    test('a command result is what every reader shows next', async () => {
        const { useVirtualDisplayState, virtualDisplayCommand } =
            await loadHelpers();
        const probe = await mountProbe(useVirtualDisplayState as any, 'c');
        const next = { ...SECOND, port: 40100 };
        electronSendAsyncMock.mockResolvedValue(next);
        let result: unknown;
        await act(async () => {
            result = await virtualDisplayCommand('create', {
                name: 'Lobby',
                width: 1920,
            });
        });
        expect(electronSendAsyncMock).toHaveBeenCalledExactlyOnceWith(
            'vd:command',
            { action: 'create', name: 'Lobby', width: 1920 },
        );
        expect(result).toBe(next);
        expect(probe.host.textContent).toBe('port 40100');
    });
});

describe('virtualDisplayCommand', () => {
    test('with no options it sends the action alone and keeps the answer', async () => {
        const { getVirtualDisplayState, virtualDisplayCommand } =
            await loadHelpers();
        electronSendAsyncMock.mockResolvedValue(SECOND);
        await expect(virtualDisplayCommand('cast-search')).resolves.toBe(
            SECOND,
        );
        expect(electronSendAsyncMock).toHaveBeenCalledWith('vd:command', {
            action: 'cast-search',
        });
        // Holding an answer is not listening: the first read still subscribes
        // and asks the main process, whose state is the truth.
        expect(getVirtualDisplayState()).toBe(FIRST);
        expect(listeners).toHaveLength(1);
    });

    test('a rejected command rejects and leaves the state alone', async () => {
        const { getVirtualDisplayState, virtualDisplayCommand } =
            await loadHelpers();
        expect(getVirtualDisplayState()).toBe(FIRST);
        electronSendAsyncMock.mockRejectedValue(new Error('TV not found'));
        await expect(
            virtualDisplayCommand('cast-start', { number: 1 }),
        ).rejects.toThrow('TV not found');
        expect(getVirtualDisplayState()).toBe(FIRST);
    });
});

describe('toVirtualDisplayErrorText', () => {
    test.each([
        ['Too many virtual displays', 'Too many virtual displays'],
        ['Virtual display not found', 'Virtual display not found'],
        ['TV not found', 'That TV was not found. Search again.'],
        [
            'Let other devices watch is off',
            'Turn on “Let other devices watch” to cast to a TV.',
        ],
        [
            'This computer cannot make MP4 video',
            'This computer cannot make MP4 video',
        ],
        [
            'The virtual display stopped recording',
            'The virtual display stopped recording',
        ],
        ['Unable to turn on HTTPS', 'Unable to turn on HTTPS'],
        ['EADDRINUSE: port taken', 'The virtual display stopped'],
        ['', 'The virtual display stopped'],
    ])('%j reads as %j', async (message, key) => {
        const { toVirtualDisplayErrorText } = await loadHelpers();
        expect(toVirtualDisplayErrorText(message)).toBe(`T(${key})`);
    });
});
