import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A screen page shown here for a Screen Mirror host: its context comes from
// the host, its paths are the host's kind, and its files are the host's.

const ipc = vi.hoisted(() => ({
    sendSync: vi.fn(),
    on: vi.fn(),
}));
vi.mock('electron', () => ({ ipcRenderer: ipc }));

import { withScreenProvider } from './screenProvider';

function genProvider() {
    return {
        browserUtils: { openExternal: () => 'kept' },
        pathUtils: { sep: 'own' },
    };
}

// The `mirror:context` listener the provider registered.
function contextListener() {
    const listener = ipc.on.mock.calls.find(([channel]) => {
        return channel === 'mirror:context';
    })?.[1];
    return listener as (event: unknown, update: unknown) => void;
}

beforeEach(() => {
    vi.stubGlobal('location', {
        pathname: '/screen.html',
        search: '?screenId=3',
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('withScreenProvider', () => {
    test('any other page keeps the provider as it is', () => {
        vi.stubGlobal('location', { pathname: '/index.html', search: '' });
        const provider = genProvider();

        expect(withScreenProvider(provider)).toBe(provider);
        expect(ipc.sendSync).not.toHaveBeenCalled();
    });

    test('the host’s context is kept up to date, and its files are asked of it', () => {
        ipc.sendSync.mockImplementation((channel: string, data: any) => {
            return channel === 'mirror:screen-context'
                ? { screenId: 3, isWindows: false, resources: {} }
                : `http://192.168.1.2:39240/content/${data.filePath}`;
        });
        const provider = genProvider();
        const result: any = withScreenProvider(provider);

        expect(result.screenUtils.getContext()).toEqual({
            screenId: 3,
            isWindows: false,
            resources: {},
        });
        contextListener()({}, { resources: { a: 'b' } });
        expect(result.screenUtils.getContext()).toEqual({
            screenId: 3,
            isWindows: false,
            resources: { a: 'b' },
        });
        // A posix host's paths.
        expect(result.pathUtils.join('/srv/media', 'a.png')).toBe(
            '/srv/media/a.png',
        );
        expect(result.pathUtils.sep).toBe('/');
        expect(result.browserUtils.pathToFileURL('/srv/media/a.png')).toBe(
            'http://192.168.1.2:39240/content//srv/media/a.png',
        );
        expect(ipc.sendSync).toHaveBeenLastCalledWith('mirror:resource', {
            screenId: 3,
            filePath: '/srv/media/a.png',
        });
        expect(result.browserUtils.openExternal()).toBe('kept');
    });

    test('with no context from the host, updates are ignored and its own paths stay', () => {
        ipc.sendSync.mockReturnValue(null);
        const provider = genProvider();
        const result: any = withScreenProvider(provider);

        contextListener()({}, { resources: { a: 'b' } });

        expect(result.screenUtils.getContext()).toBeNull();
        expect(result.pathUtils).toBe(provider.pathUtils);
    });
});
