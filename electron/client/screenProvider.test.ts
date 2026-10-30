import { afterEach, expect, test, vi } from 'vitest';
const ipc = vi.hoisted(() => ({ sendSync: vi.fn(), on: vi.fn() }));
vi.mock('electron', () => ({ ipcRenderer: ipc }));
import { withScreenProvider } from './screenProvider';
afterEach(() => vi.unstubAllGlobals());
test('screen preload exposes host path helpers without circular Node module objects', () => {
    vi.stubGlobal('location', {
        pathname: '/screen.html',
        search: '?screenId=2',
    });
    ipc.sendSync.mockReturnValue({ screenId: 2, isWindows: true });
    const result = withScreenProvider({ browserUtils: {}, pathUtils: {} });
    expect(result.pathUtils.dirname('C:\\host\\media\\image.png')).toBe(
        'C:\\host\\media',
    );
    // initProvider recursively freezes its object graph before exposing it.
    const freeze = (value: any) => {
        if (!value || typeof value !== 'object') return;
        Object.freeze(value);
        for (const item of Object.values(value)) freeze(item);
    };
    expect(() => freeze(result)).not.toThrow();
    expect(ipc.sendSync).toHaveBeenCalledWith('mirror:screen-context', 2);
});

test('a page other than the screen keeps the provider it was given', () => {
    vi.stubGlobal('location', { pathname: '/presenter.html', search: '' });
    const provider = { browserUtils: {}, pathUtils: {} };
    expect(withScreenProvider(provider)).toBe(provider);
    expect(ipc.sendSync).not.toHaveBeenCalled();
});

test('a screen follows its host context updates and asks the host for files', () => {
    vi.stubGlobal('location', {
        pathname: '/screen.html',
        search: '?screenId=5',
    });
    ipc.sendSync.mockReturnValueOnce({
        screenId: 5,
        stage: 0,
        isWindows: false,
    });
    const ownPathUtils = { sep: '?' };
    const result = withScreenProvider({
        browserUtils: { copyToClipboard: 'kept' },
        pathUtils: ownPathUtils,
    });
    expect(result.screenUtils.getContext()).toEqual({
        screenId: 5,
        stage: 0,
        isWindows: false,
    });
    expect(result.pathUtils.join('/host', 'media', 'a.png')).toBe(
        '/host/media/a.png',
    );

    // The host's later word is merged into what the screen reads.
    const [channel, onContext] = ipc.on.mock.calls[0];
    expect(channel).toBe('mirror:context');
    onContext({}, { stage: 3 });
    expect(result.screenUtils.getContext()).toEqual({
        screenId: 5,
        stage: 3,
        isWindows: false,
    });

    // A file of the host is reached through the host, by this screen's id.
    ipc.sendSync.mockReturnValueOnce('http://127.0.0.1:39240/r/abc');
    expect(result.browserUtils.pathToFileURL('/host/media/a.png')).toBe(
        'http://127.0.0.1:39240/r/abc',
    );
    expect(ipc.sendSync).toHaveBeenLastCalledWith('mirror:resource', {
        screenId: 5,
        filePath: '/host/media/a.png',
    });
    expect(result.browserUtils.copyToClipboard).toBe('kept');
});

test('a screen with no host context keeps its own paths and ignores updates', () => {
    vi.stubGlobal('location', {
        pathname: '/screen.html',
        search: '?screenId=1',
    });
    ipc.sendSync.mockReturnValueOnce(null);
    const ownPathUtils = { sep: '/' };
    const result = withScreenProvider({
        browserUtils: {},
        pathUtils: ownPathUtils,
    });
    expect(result.pathUtils).toBe(ownPathUtils);
    const [, onContext] = ipc.on.mock.calls[0];
    onContext({}, { stage: 2 });
    expect(result.screenUtils.getContext()).toBeNull();
});
