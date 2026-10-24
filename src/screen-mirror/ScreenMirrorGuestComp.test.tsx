// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
    MirrorDiscovery,
    MirrorState,
} from '../../electron/screenMirrorProtocol';

const h = vi.hoisted(() => ({
    state: null as any,
    found: [] as any[],
    command: vi.fn(),
    cameraDevices: vi.fn(async () => []),
    readQr: vi.fn(),
    goToPath: vi.fn(),
    layout: vi.fn(() => ({
        width: 170,
        height: 66,
        boxes: [
            {
                id: 1,
                isPrimary: true,
                resolution: '1920x1080',
                left: 0,
                top: 0,
                width: 80,
                height: 45,
            },
        ],
    })),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appProvider', () => ({
    default: { presenterHomePage: '/presenter.html' },
}));
vi.mock('../router/routeHelpers', () => ({ goToPath: h.goToPath }));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/cameraHelpers', () => ({
    getAllCameraDevices: h.cameraDevices,
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getAllDisplays: () => ({
        primaryDisplay: { id: 1 },
        displays: [{ id: 1 }, { id: 2, guestId: 'remote' }, { id: -10 }],
    }),
}));
vi.mock('./mirrorConnectionHelpers', () => ({
    useMirrorState: () => h.state,
    mirrorCommand: h.command,
    toMirrorErrorText: (error: string) => `Error: ${error}`,
}));
vi.mock('./mirrorQrHelpers', () => ({
    findImageFile: () => null,
    readQrTextFromImage: h.readQr,
}));
vi.mock('./mirrorMonitorLayout', () => ({ layoutMirrorMonitors: h.layout }));
vi.mock('./MirrorIntercomComp', () => ({
    default: ({ onChange, camera, busy }: any) =>
        createElement(
            'div',
            {},
            createElement(
                'button',
                { onClick: () => onChange({ mic: true }) },
                'Talk',
            ),
            createElement(
                'button',
                { onClick: camera.onToggle },
                camera.isShared ? 'Stop camera' : 'Share camera',
            ),
            createElement(
                'span',
                {},
                busy ? 'Intercom busy' : 'Intercom ready',
            ),
        ),
}));
vi.mock('../others/StayAwakeButtonComp', () => ({
    default: () => createElement('span', {}, 'Stay awake'),
}));
vi.mock('../../electron/virtualDisplayProtocol', () => ({
    isVirtualDisplayId: (id: number) => id < 0,
}));

import ScreenMirrorGuestComp from './ScreenMirrorGuestComp';

const host: MirrorDiscovery = {
    service: 'owa-screen-mirror',
    protocol: 1,
    id: 'host-1',
    name: 'Church hall',
    version: '1',
    port: 39240,
    host: '192.168.1.8',
};
function state(connections: MirrorState['connections'] = []): MirrorState {
    return {
        id: 'guest',
        port: 39240,
        hostEnabled: false,
        internetEnabled: false,
        displayRevision: 0,
        addresses: [],
        publicAddress: '',
        router: 'off',
        error: null,
        approvalMode: 'approve',
        hasCode: false,
        customPort: null,
        publicPort: null,
        tunnelEnabled: false,
        tunnel: { status: 'off', url: '', error: '' },
        guests: [],
        pending: [],
        connections,
    };
}
function connection(
    overrides: Partial<MirrorState['connections'][number]> = {},
): MirrorState['connections'][number] {
    return {
        id: 'link-1',
        hostId: host.id,
        status: 'connected',
        host: host.host!,
        port: host.port,
        name: host.name,
        prefix: 'A',
        error: null,
        intercom: { mic: false, speaker: false, volume: 1, remoteMic: false },
        shareCameras: false,
        ...overrides,
    };
}

let root: Root;
let container: HTMLDivElement;
async function render() {
    await act(async () => {
        root.render(createElement(ScreenMirrorGuestComp));
    });
}
function button(label: string) {
    const found = [...container.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === label,
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
function input(label: string) {
    const found = container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    );
    if (!found) throw new Error(`Input not found: ${label}`);
    return found;
}
async function click(label: string) {
    await act(async () => {
        button(label).click();
    });
}
async function type(label: string, value: string) {
    const element = input(label);
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.state = state();
    h.found = [];
    h.command
        .mockReset()
        .mockImplementation(async (action: string) =>
            action === 'scan' ? h.found : undefined,
        );
    h.cameraDevices.mockClear();
    h.readQr.mockReset();
    h.goToPath.mockClear();
    h.layout.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('Screen Mirror guest page', () => {
    test('shows server failure when state is unavailable and returns to Presenter', async () => {
        h.state = null;
        await render();
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'Screen mirror server is unavailable',
        );
        await click('Presenter');
        expect(h.goToPath).toHaveBeenCalledWith('/presenter.html');
    });

    test('scans on open, fills the best unlinked host, and connects with the code', async () => {
        h.found = [host];
        await render();
        expect(h.command).toHaveBeenCalledWith('scan');
        expect(input('Host address').value).toBe(host.host);
        expect(input('Port').value).toBe(String(host.port));
        expect(container.querySelector('[data-tone="idle"]')).not.toBeNull();
        expect(h.layout).toHaveBeenCalledWith([{ id: 1 }], 1, 168, 64);
        await type('Connection code', 'secret');
        await act(async () => {
            button('Connect').closest('form')!.requestSubmit();
        });
        expect(h.cameraDevices).toHaveBeenCalled();
        expect(h.command).toHaveBeenCalledWith('connect', {
            host: host.host,
            port: host.port,
            code: 'secret',
        });
    });

    test('keeps a manually typed address across rescans and accepts a full link', async () => {
        h.found = [host];
        await render();
        await type('Host address', 'https://example.org:443/join');
        await click('Rescan');
        expect(input('Host address').value).toContain('example.org');
        await act(async () => {
            button('Connect').closest('form')!.requestSubmit();
        });
        expect(h.command).toHaveBeenCalledWith('connect', {
            host: 'example.org',
            port: 443,
            code: '',
        });
    });

    test('a linked host is unavailable to pick, but an errored link can be retried', async () => {
        h.found = [host];
        h.state = state([connection()]);
        await render();
        expect(button('Church hall, Connected').disabled).toBe(true);
        expect(input('Host address').value).toBe('');
        expect(container.querySelector('[data-tone="linked"]')).not.toBeNull();
        h.state = state([
            connection({
                status: 'error',
                error: 'Connection code is incorrect',
            }),
        ]);
        await render();
        expect(button(`Church hall, ${host.host}:${host.port}`).disabled).toBe(
            false,
        );
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'Error: Connection code is incorrect',
        );
        expect(container.querySelector('[data-tone="failed"]')).not.toBeNull();
    });

    test('disconnects one link and sends intercom and camera actions to that link', async () => {
        h.state = state([connection()]);
        await render();
        await click('Talk');
        expect(h.command).toHaveBeenCalledWith('intercom', {
            key: 'link:link-1',
            mic: true,
        });
        await click('Share camera');
        expect(h.command).toHaveBeenCalledWith('share-cameras', {
            id: 'link-1',
            enabled: true,
        });
        await click('Disconnect');
        expect(h.command).toHaveBeenCalledWith('disconnect', { id: 'link-1' });
    });

    test('invalid port disables connection and a failed scan shows the empty state', async () => {
        h.command.mockImplementation(async (action: string) => {
            if (action === 'scan') throw new Error('offline');
        });
        await render();
        expect(container.textContent).toContain('No host found.');
        await type('Host address', 'example.org');
        await type('Port', '70000');
        expect(button('Connect').disabled).toBe(true);
        await type('Port', '443');
        expect(button('Connect').disabled).toBe(false);
    });

    test('pastes an address from the clipboard and reports unusable clipboard data', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                read: vi.fn(async () => []),
                readText: vi.fn(async () => 'example.org:40123'),
            },
        });
        await render();
        await click('Paste address');
        expect(input('Host address').value).toBe('example.org');
        expect(input('Port').value).toBe('40123');

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                read: vi.fn(async () => []),
                readText: vi.fn(async () => 'not an address !!'),
            },
        });
        await click('Paste address');
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'No host address found in the clipboard.',
        );
    });

    test('reads a QR picture into the address form and reports a picture without an address', async () => {
        h.readQr
            .mockResolvedValueOnce('example.org:40500')
            .mockResolvedValueOnce(null);
        await render();
        const fileInput =
            container.querySelector<HTMLInputElement>('input[type="file"]')!;
        const file = new File(['image'], 'host.png', { type: 'image/png' });
        Object.defineProperty(fileInput, 'files', {
            configurable: true,
            value: [file],
        });
        await act(async () => {
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(h.readQr).toHaveBeenCalledWith(file);
        expect(input('Host address').value).toBe('example.org');
        expect(input('Port').value).toBe('40500');
        await act(async () => {
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'No host address found in this image.',
        );
    });

    test('shows pending, reconnecting and connected link guidance', async () => {
        h.state = state([connection({ status: 'pending' })]);
        await render();
        expect(container.querySelector('[role="status"]')?.textContent).toBe(
            'Waiting for host approval',
        );
        expect(container.textContent).toContain(
            'On the host, click Allow connection.',
        );
        h.state = state([connection({ status: 'reconnecting' })]);
        await render();
        expect(container.querySelector('[role="status"]')?.textContent).toBe(
            'Connecting',
        );
        h.state = state([connection()]);
        await render();
        expect(container.textContent).toContain(
            'The host can now show its screens on these monitors.',
        );
    });
});
