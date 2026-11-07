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
    findImage: vi.fn(),
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
    findImageFile: (items: unknown) => h.findImage(items),
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
    h.findImage.mockReset().mockReturnValue(null);
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

// A promise chain that is not awaited (a picture being read) settles a few
// turns after the press.
async function settle() {
    for (let index = 0; index < 3; index++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}
function alertText() {
    return container.querySelector('[role="alert"]')?.textContent ?? null;
}
async function submit() {
    await act(async () => {
        button('Connect').closest('form')!.requestSubmit();
    });
}
// A paste carrying what the clipboard holds, the way React reads it.
function pasteEvent(clipboardData: {
    items?: unknown;
    getData?: (type: string) => string;
}) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
        value: { items: [], getData: () => '', ...clipboardData },
    });
    return event;
}
const otherHost: MirrorDiscovery = {
    ...host,
    id: 'host-2',
    name: 'Youth room',
    host: '192.168.1.9',
    port: 39241,
};

describe('Screen Mirror guest page, the less travelled paths', () => {
    test('a camera plugged in is offered again once, half a second after the devices settle', async () => {
        const devices = new EventTarget();
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: devices,
        });
        vi.useFakeTimers();
        try {
            await render();
            expect(h.cameraDevices).not.toHaveBeenCalled();
            devices.dispatchEvent(new Event('devicechange'));
            await vi.advanceTimersByTimeAsync(300);
            devices.dispatchEvent(new Event('devicechange'));
            await vi.advanceTimersByTimeAsync(499);
            expect(h.cameraDevices).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(h.cameraDevices).toHaveBeenCalledOnce();

            // A refresh that fails is not the page's failure.
            h.cameraDevices.mockRejectedValueOnce(new Error('no devices'));
            devices.dispatchEvent(new Event('devicechange'));
            await vi.advanceTimersByTimeAsync(500);
            expect(h.cameraDevices).toHaveBeenCalledTimes(2);

            // Gone with the page: a later change asks nothing, and a refresh
            // still waiting is dropped.
            devices.dispatchEvent(new Event('devicechange'));
            await act(async () => {
                root.unmount();
            });
            root = createRoot(container);
            devices.dispatchEvent(new Event('devicechange'));
            await vi.advanceTimersByTimeAsync(1000);
            expect(h.cameraDevices).toHaveBeenCalledTimes(2);
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
            delete (navigator as any).mediaDevices;
        }
    });

    test('only the latest scan may write the host list and the address', async () => {
        h.found = [host];
        await render();
        expect(input('Host address').value).toBe(host.host);
        const answers: Array<(found: MirrorDiscovery[]) => void> = [];
        h.command.mockImplementation((action: string) => {
            if (action !== 'scan') {
                return Promise.resolve(undefined);
            }
            return new Promise<MirrorDiscovery[]>((resolve) => {
                answers.push(resolve);
            });
        });
        // Two presses before the page has redrawn the button as busy.
        await act(async () => {
            const rescan = button('Rescan');
            rescan.click();
            rescan.click();
        });
        expect(answers).toHaveLength(2);
        expect(button('Rescan').disabled).toBe(true);
        await act(async () => {
            answers[1]([otherHost]);
        });
        expect(button('Rescan').disabled).toBe(false);
        // The older scan answers last, with what it had: it is not listened to.
        const stale: MirrorDiscovery = {
            ...host,
            id: 'host-3',
            name: 'Old answer',
            host: '192.168.1.10',
        };
        await act(async () => {
            answers[0]([stale]);
        });
        expect(container.textContent).toContain('Youth room');
        expect(container.textContent).not.toContain('Old answer');
        expect(container.textContent).not.toContain('Church hall');
        // What the first scan filled in, the latest one may replace.
        expect(input('Host address').value).toBe(otherHost.host);
        expect(input('Port').value).toBe(String(otherHost.port));
    });

    test('a host picked from the list fills the form, and a rescan keeps the pick', async () => {
        h.found = [host, otherHost];
        await render();
        // The scan filled the first one in by itself.
        expect(input('Host address').value).toBe(host.host);
        const pick = `Youth room, ${otherHost.host}:${otherHost.port}`;
        await click(pick);
        expect(input('Host address').value).toBe(otherHost.host);
        expect(input('Port').value).toBe(String(otherHost.port));
        expect(button(pick).getAttribute('aria-pressed')).toBe('true');
        expect(
            button(`Church hall, ${host.host}:${host.port}`).getAttribute(
                'aria-pressed',
            ),
        ).toBe('false');
        await click('Rescan');
        expect(input('Host address').value).toBe(otherHost.host);
        expect(input('Port').value).toBe(String(otherHost.port));
        await submit();
        expect(h.command).toHaveBeenCalledWith('connect', {
            host: otherHost.host,
            port: otherHost.port,
            code: '',
        });
    });

    test('a refused connection shows the reason; anything thrown that is not an error reads as a plain failure', async () => {
        await render();
        await type('Host address', 'example.org');
        h.command.mockImplementation(async (action: string) => {
            if (action === 'connect') {
                throw new Error('Too many hosts');
            }
            return [];
        });
        await submit();
        expect(alertText()).toBe('Error: Too many hosts');
        // No longer busy: it can be tried again.
        expect(button('Connect').disabled).toBe(false);
        h.command.mockImplementation(async (action: string) => {
            if (action === 'connect') {
                throw 'offline';
            }
            return [];
        });
        await submit();
        expect(alertText()).toBe('Connection failed');
        h.command.mockImplementation(async () => undefined);
        await submit();
        // A try that goes through clears the last reason.
        expect(alertText()).toBeNull();
    });

    test('a link typed whole is split into the address and the port before connecting', async () => {
        await render();
        await type('Host address', 'example.org:40123');
        await submit();
        expect(h.command).toHaveBeenCalledWith('connect', {
            host: 'example.org',
            port: 40123,
            code: '',
        });
        expect(input('Host address').value).toBe('example.org');
        expect(input('Port').value).toBe('40123');
    });

    test('a picture that cannot be read says no address was found in it', async () => {
        h.readQr.mockRejectedValueOnce(new Error('not a picture'));
        await render();
        const fileInput =
            container.querySelector<HTMLInputElement>('input[type="file"]')!;
        const file = new File(['?'], 'broken.png', { type: 'image/png' });
        Object.defineProperty(fileInput, 'files', {
            configurable: true,
            value: [file],
        });
        await act(async () => {
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await settle();
        expect(alertText()).toBe('No host address found in this image.');
        expect(input('Host address').value).toBe('');
        expect(button('Read QR code').disabled).toBe(false);
    });

    test('Read QR code opens the picture picker', async () => {
        await render();
        const fileInput =
            container.querySelector<HTMLInputElement>('input[type="file"]')!;
        const open = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
        await click('Read QR code');
        expect(open).toHaveBeenCalledOnce();
        expect(fileInput.accept).toBe('image/*');
    });

    test('a QR code picture on the clipboard is read instead of its text', async () => {
        const picture = new Blob(['png'], { type: 'image/png' });
        const textItem = { types: ['text/plain'], getType: vi.fn() };
        const imageItem = {
            types: ['text/html', 'image/png'],
            getType: vi.fn(async () => picture),
        };
        const readText = vi.fn(async () => 'other.org:1');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                read: vi.fn(async () => [textItem, imageItem]),
                readText,
            },
        });
        h.readQr.mockResolvedValueOnce('example.org:40500');
        await render();
        await click('Paste address');
        await settle();
        expect(textItem.getType).not.toHaveBeenCalled();
        expect(imageItem.getType).toHaveBeenCalledWith('image/png');
        expect(h.readQr).toHaveBeenCalledWith(picture);
        expect(readText).not.toHaveBeenCalled();
        expect(input('Host address').value).toBe('example.org');
        expect(input('Port').value).toBe('40500');
        expect(alertText()).toBeNull();
    });

    test('a clipboard that cannot be read says no address was found', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                read: vi.fn(async () => {
                    throw new Error('denied');
                }),
                readText: vi.fn(async () => 'example.org:1'),
            },
        });
        await render();
        await click('Paste address');
        expect(alertText()).toBe('No host address found in the clipboard.');
        expect(input('Host address').value).toBe('');
    });

    test('a QR code picture pasted onto the form is read into it', async () => {
        const picture = new File(['png'], 'qr.png', { type: 'image/png' });
        const items = [{ kind: 'file' }];
        h.findImage.mockImplementation((given: unknown) => {
            return given === items ? picture : null;
        });
        h.readQr.mockResolvedValueOnce('example.org:40600');
        await render();
        const form = button('Connect').closest('form')!;
        const withPicture = pasteEvent({ items });
        await act(async () => {
            form.dispatchEvent(withPicture);
        });
        await settle();
        expect(withPicture.defaultPrevented).toBe(true);
        expect(h.readQr).toHaveBeenCalledExactlyOnceWith(picture);
        expect(input('Host address').value).toBe('example.org');
        expect(input('Port').value).toBe('40600');

        // Text pasted onto the form is left to the box it lands in.
        const withText = pasteEvent({ items: [{ kind: 'string' }] });
        await act(async () => {
            form.dispatchEvent(withText);
        });
        expect(withText.defaultPrevented).toBe(false);
        expect(h.readQr).toHaveBeenCalledOnce();
    });

    test('pasting host:port into the address box fills both boxes; a bare host pastes as it is', async () => {
        await render();
        const address = input('Host address');
        const withPort = pasteEvent({
            getData: (type) => (type === 'text' ? 'example.org:40123' : ''),
        });
        await act(async () => {
            address.dispatchEvent(withPort);
        });
        expect(withPort.defaultPrevented).toBe(true);
        expect(address.value).toBe('example.org');
        expect(input('Port').value).toBe('40123');

        const bare = pasteEvent({ getData: () => 'church.example.org' });
        await act(async () => {
            address.dispatchEvent(bare);
        });
        // The browser pastes it itself.
        expect(bare.defaultPrevented).toBe(false);
        expect(address.value).toBe('example.org');
        expect(input('Port').value).toBe('40123');
    });
});
