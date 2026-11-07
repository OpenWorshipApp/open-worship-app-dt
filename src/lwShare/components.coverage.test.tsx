// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

// The Local Web Share window talks to the main process through the bridge its
// preload puts on `globalThis.lwShareController`, read ONCE when
// `lwShareHelpers` loads — so the fake bridge has to exist before any import.
// `initServer` hands out ONE server object per port, as the real one does:
// lw-share keeps a single `httpServer`, so every `initServer` for a port drives
// the same server.
const { mocks, state } = vi.hoisted(() => {
    const hoistedMocks = {
        initServer: vi.fn(),
        ensureDataDirectory: vi.fn(),
        openExternalURL: vi.fn(),
        showFileOrDirExplorer: vi.fn(),
    };
    (globalThis as any).lwShareController = {
        info: {
            lwShareInfo: {
                lwSharePackage: {
                    version: '0.0.7',
                    homepage: 'https://github.com/raksa/lw-share#readme',
                },
            },
        },
        initServer: (params: any) => {
            return hoistedMocks.initServer(params);
        },
    };
    return {
        mocks: hoistedMocks,
        state: {
            servers: new Map<number, any>(),
            onStatusList: [] as ((statusData: any) => void)[],
        },
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: {},
        browserUtils: { openExternalURL: mocks.openExternalURL },
    },
}));
vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    ensureDataDirectory: mocks.ensureDataDirectory,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.showFileOrDirExplorer,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div>Loading server</div>,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));

import LWShareAppComp from './LWShareAppComp';
import ServerControllerComp from './ServerControllerComp';
import {
    controller,
    handleForkingOnGithub,
    lwSharePackage,
} from './lwShareHelpers';

const TARGET_DIR = '/data/open-worship/lw-share-data';

let host: HTMLDivElement;
let root: Root;

function genServer(port: number) {
    return {
        port,
        targetDir: TARGET_DIR,
        stop: vi.fn(),
        restart: vi.fn(),
        getIsRunning: vi.fn(),
        getAddressesWithQRList: vi.fn(),
    };
}

function getServer(port: number) {
    const server = state.servers.get(port);
    expect(server, `server on port ${port}`).toBeDefined();
    return server;
}

// Every `initServer` registered its own status callback; lw-share calls each
// of them, so a status is reported through all of them.
async function reportStatus(statusData: any) {
    await act(async () => {
        for (const onStatus of state.onStatusList) {
            onStatus(statusData);
        }
    });
}

function findButton(text: string) {
    const button = [...host.querySelectorAll('button')].find((element) => {
        return element.textContent?.includes(text);
    });
    expect(button, `button "${text}"`).toBeDefined();
    return button!;
}

function getPortInput() {
    return host.querySelector<HTMLInputElement>('#port-input')!;
}

async function typePort(value: string) {
    const input = getPortInput();
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function renderServerController() {
    await act(async () => root.render(<ServerControllerComp />));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.servers.clear();
    state.onStatusList.length = 0;
    mocks.ensureDataDirectory.mockResolvedValue(TARGET_DIR);
    mocks.initServer.mockImplementation(async (params: any) => {
        state.onStatusList.push(params.onStatus);
        if (!state.servers.has(params.port)) {
            state.servers.set(params.port, genServer(params.port));
        }
        return state.servers.get(params.port);
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

afterAll(() => {
    delete (globalThis as any).lwShareController;
});

describe('lwShareHelpers', () => {
    test('reads the preload bridge and forks the project page externally', () => {
        expect(controller).toBe((globalThis as any).lwShareController);
        expect(lwSharePackage.version).toBe('0.0.7');
        handleForkingOnGithub();
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            'https://github.com/raksa/lw-share#readme',
        );
    });
});

describe('ServerControllerComp', () => {
    test('waits for the data directory, then serves it on the default port', async () => {
        let resolveDirectory!: (dir: string | null) => void;
        mocks.ensureDataDirectory.mockReturnValue(
            new Promise((resolve) => {
                resolveDirectory = resolve;
            }),
        );
        await renderServerController();
        expect(host.textContent).toBe('Loading server');
        expect(mocks.initServer).not.toHaveBeenCalled();

        await act(async () => resolveDirectory(TARGET_DIR));
        expect(mocks.ensureDataDirectory).toHaveBeenCalledWith('lw-share-data');
        expect(mocks.initServer).toHaveBeenCalledWith({
            port: 8080,
            targetDir: TARGET_DIR,
            onStatus: expect.any(Function),
        });
        expect(getPortInput().value).toBe('8080');
        expect(host.textContent).toContain('Port: 8080');
        expect(host.textContent).toContain(`Storage Dir:${TARGET_DIR}`);
        expect(host.textContent).toContain('Server is stopped.');
        const button = findButton('Start Server');
        expect(button.className).toContain('btn-warning');
    });

    test('opening the window sets the server up once, and a new port once more', async () => {
        // Found by UT-85 (2026-11-03): the first-render state AND the port
        // effect each called `initServer` on mount, and every call re-inits
        // lw-share (its routes, another chat socket server on the same
        // http server) and adds three more status listeners.
        await renderServerController();
        expect(mocks.initServer).toHaveBeenCalledTimes(1);
        expect(state.onStatusList).toHaveLength(1);

        await typePort('9090');
        expect(mocks.initServer).toHaveBeenCalledTimes(2);
        expect(mocks.initServer).toHaveBeenLastCalledWith(
            expect.objectContaining({ port: 9090 }),
        );
    });

    test('says so when no data directory can be had', async () => {
        mocks.ensureDataDirectory.mockResolvedValue(null);
        await renderServerController();
        expect(host.textContent).toBe('Fail to start server.');
        expect(mocks.initServer).not.toHaveBeenCalled();
    });

    test('each status drives the button, and the button drives the server', async () => {
        await renderServerController();
        const server = getServer(8080);

        // Stopped: the button starts it.
        await act(async () => findButton('Start Server').click());
        expect(server.restart).toHaveBeenCalledTimes(1);
        expect(server.stop).not.toHaveBeenCalled();

        // Starting: a spinner, and a press does nothing.
        await reportStatus({ status: 'starting' });
        expect(host.textContent).toContain('Server is starting...');
        const startingButton = findButton('Starting Server...');
        expect(startingButton.className).toContain('btn-info');
        expect(
            startingButton.querySelector('.spinner-border[role="status"]'),
        ).not.toBeNull();
        await act(async () => startingButton.click());
        expect(server.restart).toHaveBeenCalledTimes(1);
        expect(server.stop).not.toHaveBeenCalled();

        // Running: one QR card per address, and the button stops it.
        await reportStatus({
            status: 'running',
            data: {
                addressesWithQRList: [
                    {
                        address: 'http://192.168.1.20:8080',
                        qrCode: 'data:image/png;base64,QR1',
                    },
                    {
                        address: 'http://10.0.0.5:8080',
                        qrCode: 'data:image/png;base64,QR2',
                    },
                ],
            },
        });
        const images = [...host.querySelectorAll('img')];
        expect(images.map((image) => image.getAttribute('alt'))).toEqual([
            'QRCode for http://192.168.1.20:8080',
            'QRCode for http://10.0.0.5:8080',
        ]);
        expect(images[0].getAttribute('src')).toBe('data:image/png;base64,QR1');
        const runningButton = findButton('Stop Server');
        expect(runningButton.className).toContain('btn-success');
        await act(async () => runningButton.click());
        expect(server.stop).toHaveBeenCalledTimes(1);

        // Error: its message, and the button restarts it.
        await reportStatus({ status: 'error', message: 'Port in use' });
        expect(host.textContent).toContain('Port in use');
        await act(async () => findButton('Restart Server').click());
        expect(server.restart).toHaveBeenCalledTimes(2);

        await reportStatus({ status: 'error' });
        expect(host.textContent).toContain('Error starting server.');
    });

    test('an address opens in the system browser, not in the app window', async () => {
        await renderServerController();
        await reportStatus({
            status: 'running',
            data: {
                addressesWithQRList: [
                    {
                        address: 'http://192.168.1.20:8080',
                        qrCode: 'data:image/png;base64,QR1',
                    },
                ],
            },
        });
        const link = host.querySelector('a')!;
        expect(link.textContent).toBe('http://192.168.1.20:8080');
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => link.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            'http://192.168.1.20:8080',
        );
    });

    test('the storage row opens the shared folder', async () => {
        await renderServerController();
        const row = host.querySelector<HTMLElement>(`[title="${TARGET_DIR}"]`)!;
        await act(async () => row.click());
        expect(mocks.showFileOrDirExplorer).toHaveBeenCalledWith(TARGET_DIR);
    });

    test('a new port stops the old server and serves on the new one', async () => {
        await renderServerController();
        const firstServer = getServer(8080);

        await typePort('9090');
        expect(getPortInput().value).toBe('9090');
        expect(firstServer.stop).toHaveBeenCalledTimes(1);
        expect(mocks.initServer).toHaveBeenLastCalledWith(
            expect.objectContaining({ port: 9090, targetDir: TARGET_DIR }),
        );
        expect(host.textContent).toContain('Port: 9090');

        // A press now reaches the server on the NEW port.
        await act(async () => findButton('Start Server').click());
        expect(getServer(9090).restart).toHaveBeenCalledTimes(1);
        expect(firstServer.restart).not.toHaveBeenCalled();

        await act(async () => findButton('Use 8080').click());
        expect(getPortInput().value).toBe('8080');
        expect(getServer(9090).stop).toHaveBeenCalledTimes(1);
        expect(host.textContent).toContain('Port: 8080');
    });

    test('a random port is drawn from the unprivileged range', async () => {
        await renderServerController();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        await act(async () => findButton('Gen Randomly').click());
        expect(getPortInput().value).toBe('1024');

        vi.spyOn(Math, 'random').mockReturnValue(0.999999999);
        await act(async () => findButton('Gen Randomly').click());
        expect(getPortInput().value).toBe('65535');
        expect(mocks.initServer).toHaveBeenLastCalledWith(
            expect.objectContaining({ port: 65535 }),
        );
    });
});

describe('LWShareAppComp', () => {
    test('heads the window with the package version and its fork link', async () => {
        await act(async () => root.render(<LWShareAppComp />));
        const app = host.querySelector<HTMLElement>('#app')!;
        expect(app.dataset.bsTheme).toBe('dark');
        expect(host.querySelector('.card-header')!.textContent).toBe(
            'Local Web Share (0.0.7)',
        );
        const forkButton = findButton('Fork me on GitHub');
        expect(forkButton.title).toBe(
            'https://github.com/raksa/lw-share#readme',
        );
        await act(async () => forkButton.click());
        expect(mocks.openExternalURL).toHaveBeenCalledWith(
            'https://github.com/raksa/lw-share#readme',
        );
        // The server controls live in the same card.
        expect(host.textContent).toContain('Port: 8080');
    });
});
