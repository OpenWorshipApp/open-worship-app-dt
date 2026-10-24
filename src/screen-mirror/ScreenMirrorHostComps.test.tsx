// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MirrorState } from '../../electron/screenMirrorProtocol';

const h = vi.hoisted(() => ({
    state: null as MirrorState | null,
    command: vi.fn(),
    copy: vi.fn(),
    toast: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: h.copy }));
vi.mock('./mirrorConnectionHelpers', () => ({
    useMirrorState: () => h.state,
    mirrorCommand: h.command,
    toMirrorErrorText: (error: string) => `Mirror: ${error}`,
}));
vi.mock('./CollapsibleNoteComp', () => ({
    default: ({ children }: { children: React.ReactNode }) =>
        createElement('div', {}, children),
}));
vi.mock('./MirrorInternetComps', () => ({
    MirrorCustomPortComp: () => createElement('span', {}, 'Custom port'),
    MirrorGuestAccessComp: ({ onMode, onCode }: any) =>
        createElement(
            'div',
            {},
            createElement(
                'button',
                { onClick: () => onMode('code') },
                'Require code',
            ),
            createElement(
                'button',
                { onClick: () => onCode('1234') },
                'Set code',
            ),
        ),
    MirrorInternetWarningComp: () =>
        createElement('span', {}, 'Internet warning'),
    MirrorPublicAddressComp: () =>
        createElement('span', {}, 'Public address control'),
    MirrorTunnelComp: () => createElement('span', {}, 'Tunnel control'),
}));
vi.mock('./NetworkAccessNoticeComp', () => ({
    default: () => createElement('span', {}, 'Firewall notice'),
}));
vi.mock('./MirrorIntercomComp', () => ({
    default: ({ onChange }: any) =>
        createElement(
            'button',
            { onClick: () => onChange({ mic: true }) },
            'Guest microphone',
        ),
}));

import ScreenMirrorConnectionComp from './ScreenMirrorConnectionComp';
import ScreenMirrorAddressesComp from './ScreenMirrorAddressesComp';
import { MirrorQrCodeComp, MirrorRouterStatusComp } from './MirrorNetworkComps';

function state(extra: Partial<MirrorState> = {}): MirrorState {
    return {
        id: 'host',
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
        connections: [],
        ...extra,
    };
}

let container: HTMLDivElement;
let root: Root;
async function draw(element: React.ReactElement) {
    await act(async () => {
        root.render(element);
    });
}
function button(label: string) {
    const found = [...container.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
    );
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
}
async function click(label: string) {
    await act(async () => {
        button(label).click();
    });
}
async function type(element: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
async function toggle(id: string) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
    await act(async () => {
        input.click();
    });
}
const perform = async (work: () => Promise<unknown>) => {
    await work();
};

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.state = state();
    h.command
        .mockReset()
        .mockImplementation(async (action: string) =>
            action === 'qr' ? { size: 21, path: 'M0 0h1v1z' } : undefined,
        );
    h.copy.mockClear();
    h.toast.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('Screen Mirror host controls', () => {
    test('does not offer hosting until switched on, and reports command failures', async () => {
        await draw(createElement(ScreenMirrorConnectionComp));
        expect(container.textContent).toContain(
            'Turn this on to use other computers',
        );
        h.command.mockRejectedValueOnce(new Error('firewall denied'));
        await toggle('app-mirror-host-switch');
        expect(h.command).toHaveBeenCalledWith('host', { enabled: true });
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'Mirror: firewall denied',
        );
        h.state = state({ hostEnabled: true, internetEnabled: true });
        await draw(createElement(ScreenMirrorConnectionComp));
        expect(container.textContent).toContain('Internet warning');
        await toggle('app-mirror-internet-switch');
        expect(h.command).toHaveBeenCalledWith('internet', { enabled: false });
    });

    test('shows connected guests and acts on approval and rejection requests', async () => {
        h.state = state({
            hostEnabled: true,
            guests: [
                {
                    id: 'g1',
                    prefix: 'A',
                    name: 'Guest laptop',
                    address: '10.0.0.2',
                    network: 'internet',
                    displays: [
                        {
                            id: 7,
                            bounds: { width: 1280, height: 720 },
                            isPrimary: true,
                        },
                    ],
                    cameras: [{ deviceId: 'cam1', label: 'Camera one' }],
                    intercom: {
                        mic: false,
                        speaker: false,
                        volume: 1,
                        remoteMic: false,
                    },
                },
            ] as any,
            pending: [
                {
                    id: 'p1',
                    name: 'Visitor',
                    address: '10.0.0.3',
                    network: 'internet',
                },
                {
                    id: 'p2',
                    name: 'Volunteer',
                    address: '10.0.0.4',
                    network: 'local',
                },
            ],
        });
        await draw(createElement(ScreenMirrorConnectionComp));
        expect(container.textContent).toContain('A: Guest laptop');
        expect(container.textContent).toContain('1280x720 (primary)');
        expect(container.textContent).toContain('Camera one');
        expect(container.textContent).toContain('Internet');
        expect(container.textContent).toContain('This network');
        await click('Guest microphone');
        expect(h.command).toHaveBeenCalledWith('intercom', {
            key: 'guest:g1',
            mic: true,
        });
        await click('Disconnect');
        expect(h.command).toHaveBeenCalledWith('disconnect-guest', {
            id: 'g1',
        });
        await click('Allow connection');
        expect(h.command).toHaveBeenCalledWith('approve', { id: 'p1' });
        await click('Reject connection');
        expect(h.command).toHaveBeenCalledWith('reject', { id: 'p1' });
        await click('Require code');
        expect(h.command).toHaveBeenCalledWith('settings', { mode: 'code' });
        await click('Set code');
        expect(h.command).toHaveBeenCalledWith('settings', {
            mode: 'approve',
            code: '1234',
        });
    });
});

describe('Screen Mirror host addresses and router', () => {
    test('shows LAN and internet addresses, copies text, and requests QR only when opened', async () => {
        const hostState = state({
            internetEnabled: true,
            addresses: [
                { kind: 'lan', host: '192.168.1.8', port: 39240 },
                { kind: 'internet', host: '2001:db8::1', port: 39240 },
                { kind: 'tunnel', host: 'church.trycloudflare.com', port: 443 },
            ],
        });
        await draw(
            createElement(ScreenMirrorAddressesComp, {
                state: hostState,
                busy: false,
                perform,
            }),
        );
        expect(container.textContent).toContain('192.168.1.8:39240');
        expect(container.textContent).toContain('IPv6');
        expect(container.textContent).toContain('Tunnel');
        expect(h.command).not.toHaveBeenCalledWith('qr', expect.anything());
        const copyButton = container.querySelector<HTMLButtonElement>(
            'button[aria-label^="Copy address"]',
        )!;
        await act(async () => {
            copyButton.click();
        });
        expect(h.copy).toHaveBeenCalledWith(
            '192.168.1.8:39240',
            'Copy address',
        );
        const qrButton = container.querySelector<HTMLButtonElement>(
            'button[aria-label^="QR code"]',
        )!;
        await act(async () => {
            qrButton.click();
        });
        expect(h.command).toHaveBeenCalledWith('qr', {
            text: '192.168.1.8:39240',
        });
        expect(
            container.querySelector('[role="img"]')?.getAttribute('aria-label'),
        ).toContain('192.168.1.8:39240');
        await act(async () => {
            qrButton.click();
        });
        expect(container.querySelector('[role="img"]')).toBeNull();
    });

    test('router status explains port remapping and accepts a new public port', async () => {
        const routerState = {
            router: 'open' as const,
            port: 39240,
            publicPort: 45000,
            addresses: [
                { kind: 'lan', host: '192.168.1.8', port: 39240 },
                { kind: 'router', host: '203.0.113.4', port: 46000 },
            ],
        };
        await draw(
            createElement(MirrorRouterStatusComp, {
                state: routerState,
                busy: false,
                perform,
            }),
        );
        expect(container.textContent).toContain('The router opened the port.');
        expect(container.textContent).toContain('opened another one');
        const portInput = container.querySelector<HTMLInputElement>(
            'input[type="number"]',
        )!;
        await type(portInput, '70000');
        expect(button('Save port').disabled).toBe(true);
        await type(portInput, '47000');
        await click('Save port');
        expect(h.command).toHaveBeenCalledWith('public-port', { port: 47000 });
        expect(portInput.value).toBe('');
    });

    test('router failure gives a retry, while an inactive router renders nothing', async () => {
        const routerState = {
            router: 'refused' as const,
            port: 39240,
            publicPort: null,
            addresses: [{ kind: 'lan', host: '192.168.1.8', port: 39240 }],
        };
        await draw(
            createElement(MirrorRouterStatusComp, {
                state: routerState,
                busy: false,
                perform,
            }),
        );
        expect(container.textContent).toContain(
            'The router refused to open the port.',
        );
        await click('Ask the router again');
        expect(h.command).toHaveBeenCalledWith('router');
        await draw(
            createElement(MirrorRouterStatusComp, {
                state: { ...routerState, router: 'off' },
                busy: false,
                perform,
            }),
        );
        expect(container.textContent).toBe('');
    });
});

describe('Screen Mirror QR preview', () => {
    test('requests its own QR lazily and displays a failure message on error', async () => {
        await draw(createElement(MirrorQrCodeComp, { text: 'host:39240' }));
        expect(h.command).toHaveBeenCalledWith('qr', { text: 'host:39240' });
        expect(container.querySelector('svg[role="img"]')).not.toBeNull();
        h.command.mockRejectedValueOnce(new Error('no QR'));
        await draw(createElement(MirrorQrCodeComp, { text: 'other:39240' }));
        expect(container.textContent).toContain('Connection failed');
    });

    test('copies the QR as a PNG and reports clipboard failure', async () => {
        const fillRect = vi.fn();
        const fillText = vi.fn();
        const scale = vi.fn();
        const fill = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect,
            fillText,
            scale,
            fill,
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) => {
                callback(new Blob(['png'], { type: 'image/png' }));
            },
        );
        const write = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write },
        });
        vi.stubGlobal(
            'ClipboardItem',
            class {
                constructor(public data: Record<string, Blob>) {}
            },
        );
        vi.stubGlobal(
            'Path2D',
            class {
                constructor(public path: string) {}
            },
        );
        await draw(createElement(MirrorQrCodeComp, { text: 'host:39240' }));
        await click('Copy image');
        expect(fillRect).toHaveBeenCalled();
        expect(fillText).toHaveBeenCalledWith('host:39240', 84, 190, 152);
        expect(write).toHaveBeenCalledTimes(1);
        expect(h.toast).toHaveBeenCalledWith(
            'Copy image',
            'The QR code image has been copied to the clipboard',
        );
        write.mockRejectedValueOnce(new Error('denied'));
        await click('Copy image');
        expect(h.toast).toHaveBeenCalledWith(
            'Copy image',
            'The QR code image could not be copied',
        );
    });
});
