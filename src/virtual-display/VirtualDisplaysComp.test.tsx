// @vitest-environment jsdom

import fs from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
    VirtualDisplayInfo,
    VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';

// The tab over a fake `vd:state` store: what each switch sends, what a failed
// command says, which card a creation opens, and what busy disables.
const { store, commandMock, mirrorCommandMock } = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    return {
        store: {
            value: null as VirtualDisplayState | null,
            listeners,
            set(value: VirtualDisplayState | null) {
                this.value = value;
                for (const listener of listeners) {
                    listener();
                }
            },
        },
        commandMock: vi.fn(),
        mirrorCommandMock: vi.fn(),
    };
});

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../screen-mirror/mirrorConnectionHelpers', () => ({
    mirrorCommand: mirrorCommandMock,
}));
vi.mock('../screen-mirror/MirrorNetworkComps', () => ({
    MirrorRouterStatusComp: ({ busy }: { busy: boolean }) => (
        <div data-part="router" data-busy={String(busy)} />
    ),
}));
vi.mock('../screen-mirror/MirrorInternetComps', () => ({
    MirrorInternetWarningComp: () => <div data-part="warning" />,
    MirrorGuestAccessComp: ({
        mode,
        hasCode,
        onMode,
        onCode,
    }: {
        mode: string;
        hasCode: boolean;
        onMode: (mode: string) => Promise<void>;
        onCode: (code: string) => Promise<void>;
    }) => (
        <div
            data-part="access"
            data-mode={mode}
            data-has-code={String(hasCode)}
        >
            <button type="button" onClick={() => void onMode('code')}>
                Use a code
            </button>
            <button type="button" onClick={() => void onCode('4321')}>
                Set code
            </button>
        </div>
    ),
    MirrorTunnelComp: ({ idPrefix }: { idPrefix: string }) => (
        <div data-part="tunnel" data-id-prefix={idPrefix} />
    ),
    MirrorPublicAddressComp: ({ publicAddress }: { publicAddress: string }) => (
        <div data-part="public" data-address={publicAddress} />
    ),
    MirrorCustomPortComp: ({ customPort }: { customPort: number | null }) => (
        <div data-part="port" data-custom-port={String(customPort)} />
    ),
}));
vi.mock('../screen-mirror/NetworkAccessNoticeComp', () => ({
    default: ({ port }: { port: number }) => (
        <div data-part="notice" data-port={String(port)} />
    ),
}));
vi.mock('../screen-mirror/CollapsibleNoteComp', () => ({
    default: ({
        settingName,
        children,
    }: {
        settingName: string;
        children: unknown;
    }) => <p data-setting={settingName}>{children as any}</p>,
}));
vi.mock('./virtualDisplayHelpers', async () => {
    const { useSyncExternalStore } = await import('react');
    return {
        toVirtualDisplayErrorText: (message: string) => `ERR(${message})`,
        useVirtualDisplayState: () =>
            useSyncExternalStore(
                (listener: () => void) => {
                    store.listeners.add(listener);
                    return () => {
                        store.listeners.delete(listener);
                    };
                },
                () => store.value,
            ),
        virtualDisplayCommand: commandMock,
    };
});
vi.mock('./VirtualDisplayCardComp', () => ({
    default: ({
        display,
        isJustCreated,
        isBusy,
    }: {
        display: VirtualDisplayInfo;
        isJustCreated: boolean;
        isBusy: boolean;
    }) => (
        <article
            data-number={String(display.number)}
            data-just-created={String(isJustCreated)}
            data-busy={String(isBusy)}
        />
    ),
}));

import VirtualDisplaysComp from './VirtualDisplaysComp';

function makeDisplay(number: number): VirtualDisplayInfo {
    return {
        number,
        name: `Display ${number}`,
        width: 1920,
        height: 1080,
        wallpaper: { kind: 'none' },
        displayId: -500000 - number,
        screenIds: [],
        stream: 'idle',
        error: null,
        mimeType: null,
        isWallpaperMissing: false,
        isMp4MicOn: false,
        clients: [],
        blocked: [],
        casts: [],
    };
}

function makeState(
    patch: Partial<VirtualDisplayState> = {},
): VirtualDisplayState {
    return {
        available: true,
        error: null,
        port: 40000,
        shareEnabled: false,
        internetEnabled: false,
        router: 'off',
        publicPort: null,
        access: 'approve',
        hasCode: false,
        tunnelEnabled: false,
        tunnel: { status: 'off', url: '', error: '' },
        httpsEnabled: false,
        publicAddress: '',
        customPort: null,
        addresses: [],
        displays: [],
        castTargets: [],
        isCastSearching: false,
        ...patch,
    } as VirtualDisplayState;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    store.value = null;
    store.listeners.clear();
    commandMock.mockResolvedValue(undefined);
    mirrorCommandMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

async function mount(state: VirtualDisplayState | null) {
    store.value = state;
    await act(async () => {
        root.render(<VirtualDisplaysComp />);
    });
}

async function setState(state: VirtualDisplayState) {
    await act(async () => {
        store.set(state);
    });
}

function byId(id: string) {
    const element = container.querySelector<HTMLInputElement>(`#${id}`);
    if (element === null) {
        throw new Error(`No #${id}`);
    }
    return element;
}

function part(name: string) {
    return container.querySelector<HTMLElement>(`[data-part="${name}"]`);
}

function findButton(text: string) {
    const button = [...container.querySelectorAll('button')].find((item) => {
        return item.textContent?.trim() === text;
    });
    if (button === undefined) {
        throw new Error(`No button "${text}"`);
    }
    return button;
}

async function press(element: HTMLElement) {
    await act(async () => {
        element.click();
    });
}

function alertText() {
    return container.querySelector('[role="alert"]')?.textContent ?? null;
}

describe('VirtualDisplaysComp', () => {
    test('without a server it says so and sends nothing else', async () => {
        await mount(null);
        expect(alertText()).toBe('Screen mirror server is unavailable');
        expect(container.querySelector('button')).toBeNull();

        await setState(makeState({ available: false }));
        expect(alertText()).toBe('Screen mirror server is unavailable');
    });

    test('on mount it hands the viewers their labels in this language', async () => {
        await mount(makeState());
        expect(commandMock).toHaveBeenCalledTimes(1);
        const [action, options] = commandMock.mock.calls[0];
        expect(action).toBe('labels');
        const { labels } = options as { labels: Record<string, string> };
        // Exactly the keys the viewer page reads: `label('key', …)` and
        // `packet.labels?.key` in `src/virtual-display-viewer.ts`.
        const viewer = fs.readFileSync('src/virtual-display-viewer.ts', 'utf8');
        const read = new Set<string>();
        for (const match of viewer.matchAll(/\blabel\(\s*'(\w+)'/g)) {
            read.add(match[1]);
        }
        for (const match of viewer.matchAll(/labels\?\.(\w+)/g)) {
            read.add(match[1]);
        }
        expect(read.size).toBeGreaterThan(30);
        expect(Object.keys(labels).sort()).toEqual([...read].sort());
        for (const value of Object.values(labels)) {
            expect(value.length).toBeGreaterThan(0);
        }
        expect(labels).toMatchObject({
            fullScreen: 'Full screen',
            exitFullScreen: 'Exit full screen',
            waitingApproval: 'Waiting for host approval',
            castStop: 'Stop',
            cameraStop: 'Stop',
            castNeedsSharing:
                'Turn on “Let other devices watch” to cast to a TV.',
            cameraFailed:
                'The camera could not be opened. Allow it for this page, or close another app using it.',
        });
    });

    test('a refused labels command is swallowed, not shown', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        try {
            commandMock.mockRejectedValueOnce(new Error('No viewer server'));
            await mount(makeState());
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
            expect(alertText()).toBeNull();
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.off('unhandledRejection', unhandled);
        }
    });

    test('with sharing off only the sharing switch and its hint show', async () => {
        await mount(makeState({ displays: [makeDisplay(1)] }));
        const share = byId('app-virtual-display-share-switch');
        expect(share.checked).toBe(false);
        expect(container.textContent).toContain(
            'Turn this on to watch virtual displays from phones, TVs and other computers on this network.',
        );
        expect(
            container.querySelector('#app-virtual-display-https-switch'),
        ).toBe(null);
        expect(part('notice')).toBeNull();
        expect(part('port')).toBeNull();
        // One display: no empty hint, one card, nothing just created.
        expect(container.textContent).not.toContain(
            'A virtual display is a screen that exists only in this app.',
        );
        const cards = container.querySelectorAll('article');
        expect(cards).toHaveLength(1);
        expect(cards[0].dataset.justCreated).toBe('false');

        commandMock.mockClear();
        await press(share);
        expect(commandMock).toHaveBeenCalledExactlyOnceWith('share', {
            enabled: true,
        });
    });

    test('with sharing on, HTTPS and the internet switch send their own commands', async () => {
        await mount(
            makeState({
                shareEnabled: true,
                httpsEnabled: true,
                port: 40123,
                customPort: 41000,
            }),
        );
        const https = byId('app-virtual-display-https-switch');
        expect(https.checked).toBe(true);
        expect(
            container.querySelector(
                '[data-setting="virtual-screens-note-https-expanded"]',
            )?.textContent,
        ).toContain('Media players keep the http address.');
        expect(part('notice')!.dataset.port).toBe('40123');
        expect(part('port')!.dataset.customPort).toBe('41000');
        // The internet half stays folded until it is on.
        expect(part('warning')).toBeNull();
        expect(part('access')).toBeNull();
        expect(part('tunnel')).toBeNull();

        commandMock.mockClear();
        await press(https);
        expect(commandMock).toHaveBeenCalledExactlyOnceWith('https', {
            enabled: false,
        });

        await press(byId('app-virtual-display-share-switch'));
        expect(commandMock).toHaveBeenLastCalledWith('share', {
            enabled: false,
        });

        const internet = byId('app-virtual-display-internet-switch');
        expect(internet.checked).toBe(false);
        await press(internet);
        expect(mirrorCommandMock).toHaveBeenCalledExactlyOnceWith('internet', {
            enabled: true,
        });
        expect(commandMock).not.toHaveBeenCalledWith(
            'internet',
            expect.anything(),
        );
    });

    test('open to the internet, it shows the guest controls and routes their choices', async () => {
        await mount(
            makeState({
                shareEnabled: true,
                internetEnabled: true,
                access: 'code',
                hasCode: true,
                publicAddress: '203.0.113.5',
            }),
        );
        expect(byId('app-virtual-display-internet-switch').checked).toBe(true);
        expect(part('warning')).not.toBeNull();
        expect(part('access')!.dataset.mode).toBe('code');
        expect(part('access')!.dataset.hasCode).toBe('true');
        expect(part('tunnel')!.dataset.idPrefix).toBe('app-virtual-display');
        expect(part('router')).not.toBeNull();
        expect(part('public')!.dataset.address).toBe('203.0.113.5');

        commandMock.mockClear();
        await press(findButton('Use a code'));
        expect(commandMock).toHaveBeenCalledExactlyOnceWith('access', {
            mode: 'code',
        });
        await press(findButton('Set code'));
        expect(commandMock).toHaveBeenLastCalledWith('code', { code: '4321' });
    });

    test('while a command runs everything is busy, and after it is not', async () => {
        await mount(makeState({ shareEnabled: true, internetEnabled: true }));
        await setState(
            makeState({
                shareEnabled: true,
                internetEnabled: true,
                displays: [makeDisplay(1)],
            }),
        );
        let finish: () => void = () => {};
        commandMock.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        await press(byId('app-virtual-display-https-switch'));
        expect(byId('app-virtual-display-share-switch').disabled).toBe(true);
        expect(byId('app-virtual-display-https-switch').disabled).toBe(true);
        expect(byId('app-virtual-display-internet-switch').disabled).toBe(true);
        expect(findButton('Add Virtual Display').disabled).toBe(true);
        expect(part('router')!.dataset.busy).toBe('true');
        expect(container.querySelector('article')!.dataset.busy).toBe('true');

        await act(async () => {
            finish();
        });
        expect(byId('app-virtual-display-share-switch').disabled).toBe(false);
        expect(findButton('Add Virtual Display').disabled).toBe(false);
        expect(container.querySelector('article')!.dataset.busy).toBe('false');
    });

    test('a failed command shows its reason until the next command starts', async () => {
        await mount(makeState({ shareEnabled: true }));
        commandMock.mockRejectedValueOnce(new Error('Unable to turn on HTTPS'));
        await press(byId('app-virtual-display-https-switch'));
        expect(alertText()).toBe('ERR(Unable to turn on HTTPS)');
        // The switch is free again after the failure.
        expect(byId('app-virtual-display-https-switch').disabled).toBe(false);

        // A thrown non-Error is read as its text.
        commandMock.mockRejectedValueOnce('Too many virtual displays');
        await press(byId('app-virtual-display-share-switch'));
        expect(alertText()).toBe('ERR(Too many virtual displays)');

        await press(byId('app-virtual-display-share-switch'));
        expect(alertText()).toBeNull();
    });

    test('Add Virtual Display creates a full-HD display and opens its card', async () => {
        const before = makeState({ displays: [makeDisplay(1)] });
        const after = makeState({
            displays: [makeDisplay(1), makeDisplay(3)],
        });
        await mount(before);
        commandMock.mockClear();
        commandMock.mockResolvedValueOnce(after);
        const add = findButton('Add Virtual Display');
        expect(add.title).toBe('');
        await press(add);
        expect(commandMock).toHaveBeenCalledExactlyOnceWith('create', {
            name: 'Virtual Display',
            width: 1920,
            height: 1080,
            wallpaper: { kind: 'none' },
        });
        // The helper pushes the new state to every reader.
        await setState(after);
        const cards = [...container.querySelectorAll('article')];
        expect(cards.map((card) => card.dataset.number)).toEqual(['1', '3']);
        expect(cards.map((card) => card.dataset.justCreated)).toEqual([
            'false',
            'true',
        ]);
    });

    test('a create that adds nothing new marks no card', async () => {
        const state = makeState({ displays: [makeDisplay(2)] });
        await mount(state);
        commandMock.mockResolvedValueOnce(state);
        await press(findButton('Add Virtual Display'));
        expect(alertText()).toBeNull();
        expect(container.querySelector('article')!.dataset.justCreated).toBe(
            'false',
        );
    });

    test('with no displays it explains them; with the most it refuses another', async () => {
        await mount(makeState());
        expect(container.textContent).toContain(
            'A virtual display is a screen that exists only in this app. Show screens on it like on a real monitor, and watch it from any device as a video.',
        );
        expect(container.querySelectorAll('article')).toHaveLength(0);

        await setState(
            makeState({
                displays: Array.from({ length: 8 }, (_, index) =>
                    makeDisplay(index + 1),
                ),
            }),
        );
        const add = findButton('Add Virtual Display');
        expect(add.disabled).toBe(true);
        expect(add.title).toBe('Too many virtual displays');
        expect(container.querySelectorAll('article')).toHaveLength(8);
        expect(container.textContent).not.toContain(
            'A virtual display is a screen that exists only in this app.',
        );
    });
});
