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
