// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
    VirtualDisplayInfo,
    VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';

// The real `settingHelpers` over an in-memory store, so what the card writes
// is what it reads back when mounted again.
const { settingStore, appProviderMock } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
    appProviderMock: {
        isPageReader: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        pathUtils: { sep: '/' },
        messageUtils: { listenForData() {}, sendData() {} },
    },
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        localStorageDir: '/settings',
        getItem: (key: string) => settingStore.get(key) ?? null,
        getItemForce: (key: string) => settingStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            settingStore.set(key, value);
        },
        removeItem: (key: string) => {
            settingStore.delete(key);
        },
        removeItemCache() {},
        listKeys: async () => [...settingStore.keys()],
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    fsCheckFileExist: async () => true,
    toDataDirRelativePath: (filePath: string) => filePath,
    selectFiles: async () => [],
    toBaseNameOfAnyOs: (filePath: string) => {
        return filePath.split(/[\\/]/).pop() ?? '';
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: vi.fn() }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(async () => false),
}));
vi.mock('../screen-mirror/MirrorNetworkComps', () => ({
    MirrorQrCodeComp: ({ text }: { text: string }) => `[QR ${text}]`,
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: unknown }) => children,
}));
vi.mock('./virtualDisplayHelpers', () => ({
    toVirtualDisplayErrorText: (text: string) => text,
    virtualDisplayCommand: vi.fn(async () => undefined),
}));

import VirtualDisplayCardComp from './VirtualDisplayCardComp';

const NUMBER = 7;
const CARD_KEY = `virtual-display-${NUMBER}-card-expanded`;
const SETTINGS_KEY = `virtual-display-${NUMBER}-settings-expanded`;
const ADDRESSES_KEY = `virtual-display-${NUMBER}-addresses-expanded`;

const display: VirtualDisplayInfo = {
    number: NUMBER,
    name: 'Lobby TV',
    width: 1280,
    height: 720,
    wallpaper: { kind: 'none' },
    displayId: -500007,
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

const state: VirtualDisplayState = {
    available: true,
    error: null,
    port: 40000,
    shareEnabled: true,
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
    addresses: [{ host: '127.0.0.1', port: 40000, kind: 'this-computer' }],
    displays: [display],
    castTargets: [],
    isCastSearching: false,
};

const PAGE_URL = `http://127.0.0.1:40000/vd/${NUMBER}/`;

describe('VirtualDisplayCardComp folds', () => {
    let container: HTMLDivElement;
    let root: Root | null = null;

    function mount(isJustCreated = false) {
        root = createRoot(container);
        act(() => {
            root!.render(
                <VirtualDisplayCardComp
                    display={display}
                    state={state}
                    isBusy={false}
                    isJustCreated={isJustCreated}
                    perform={async () => {}}
                />,
            );
        });
    }

    function unmount() {
        act(() => {
            root?.unmount();
        });
        root = null;
    }

    function getCardButton() {
        const button = container.querySelector<HTMLButtonElement>(
            '.card-header > button',
        );
        if (button === null) {
            throw new Error('No card chevron');
        }
        return button;
    }

    function getFold(title: string) {
        return container.querySelector<HTMLElement>(
            `section[aria-label="${title}"]`,
        );
    }

    function getFoldButton(title: string) {
        const button =
            getFold(title)?.querySelector<HTMLButtonElement>(':scope > button');
        if (!button) {
            throw new Error(`No fold "${title}"`);
        }
        return button;
    }

    function click(button: HTMLButtonElement) {
        act(() => {
            button.click();
        });
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        settingStore.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        unmount();
        container.remove();
    });

    test('the card starts collapsed, with nothing in it mounted', () => {
        mount();
        expect(getCardButton().getAttribute('aria-expanded')).toBe('false');
        expect(getCardButton().getAttribute('aria-label')).toBe(
            'Lobby TV: 1280 × 720',
        );
        expect(container.querySelector('.card-body')).toBeNull();
        expect(getFold('Settings')).toBeNull();
        expect(settingStore.has(CARD_KEY)).toBe(false);
    });

    test('the chevron expands the card and remembers it', () => {
        mount();
        click(getCardButton());
        expect(getCardButton().getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.card-body')).not.toBeNull();
        expect(settingStore.get(CARD_KEY)).toBe('true');

        click(getCardButton());
        expect(container.querySelector('.card-body')).toBeNull();
        expect(settingStore.get(CARD_KEY)).toBe('false');
    });

    test('Settings and Where to watch start open and fold away', () => {
        mount();
        click(getCardButton());
        const settings = getFold('Settings')!;
        const addresses = getFold('Where to watch')!;
        expect(getFoldButton('Settings').getAttribute('aria-expanded')).toBe(
            'true',
        );
        expect(
            getFoldButton('Where to watch').getAttribute('aria-expanded'),
        ).toBe('true');
        expect(settings.querySelector('input')).not.toBeNull();
        expect(addresses.textContent).toContain(PAGE_URL);

        click(getFoldButton('Settings'));
        expect(getFoldButton('Settings').getAttribute('aria-expanded')).toBe(
            'false',
        );
        expect(getFold('Settings')!.querySelector('input')).toBeNull();
        expect(getFold('Settings')!.querySelector('select')).toBeNull();
        expect(settingStore.get(SETTINGS_KEY)).toBe('false');
        // Folding one leaves the other alone.
        expect(getFold('Where to watch')!.textContent).toContain(PAGE_URL);
        expect(settingStore.has(ADDRESSES_KEY)).toBe(false);

        click(getFoldButton('Where to watch'));
        expect(getFold('Where to watch')!.textContent).not.toContain(PAGE_URL);
        expect(settingStore.get(ADDRESSES_KEY)).toBe('false');
    });

    test('unmounting and mounting again restores all three folds', () => {
        mount();
        click(getCardButton());
        click(getFoldButton('Settings'));
        click(getFoldButton('Where to watch'));
        unmount();
        container.innerHTML = '';

        mount();
        expect(getCardButton().getAttribute('aria-expanded')).toBe('true');
        expect(getFoldButton('Settings').getAttribute('aria-expanded')).toBe(
            'false',
        );
        expect(
            getFoldButton('Where to watch').getAttribute('aria-expanded'),
        ).toBe('false');
        expect(getFold('Settings')!.querySelector('input')).toBeNull();
        expect(getFold('Where to watch')!.textContent).not.toContain(PAGE_URL);

        // And opened again, the next mount sees them open.
        click(getFoldButton('Settings'));
        unmount();
        mount();
        expect(getFoldButton('Settings').getAttribute('aria-expanded')).toBe(
            'true',
        );
        expect(
            getFoldButton('Where to watch').getAttribute('aria-expanded'),
        ).toBe('false');
    });

    test('a collapsed card is remembered collapsed', () => {
        settingStore.set(CARD_KEY, 'false');
        settingStore.set(SETTINGS_KEY, 'false');
        mount();
        expect(getCardButton().getAttribute('aria-expanded')).toBe('false');
        click(getCardButton());
        expect(getFoldButton('Settings').getAttribute('aria-expanded')).toBe(
            'false',
        );
    });

    test('a display just created opens its card', () => {
        mount(true);
        expect(getCardButton().getAttribute('aria-expanded')).toBe('true');
        expect(getFold('Settings')).not.toBeNull();
        expect(settingStore.get(CARD_KEY)).toBe('true');
    });

    test('another display keeps its own folds', () => {
        settingStore.set('virtual-display-8-card-expanded', 'true');
        mount();
        expect(getCardButton().getAttribute('aria-expanded')).toBe('false');
    });
});

// A viewer from the internet not let in yet is marked so, and the operator
// either allows it or rejects it; it cannot be let interact meanwhile.
describe('VirtualDisplayCardComp watching now', () => {
    let container: HTMLDivElement;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        settingStore.clear();
        settingStore.set(CARD_KEY, 'true');
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => {
            root?.unmount();
        });
        root = null;
        container.remove();
    });

    function mount(waiting: 'approval' | 'code' | null) {
        const client = {
            id: 'viewer-0001',
            kind: 'web' as const,
            address: '198.51.100.9',
            network: 'internet' as const,
            userAgent: 'TestBrowser/1.0',
            since: 0,
            isPreview: false,
            isInteractive: false,
            waiting,
        };
        root = createRoot(container);
        act(() => {
            root!.render(
                <VirtualDisplayCardComp
                    display={{ ...display, clients: [client] }}
                    state={state}
                    isBusy={false}
                    isJustCreated={false}
                    perform={async (work) => {
                        await work();
                    }}
                />,
            );
        });
    }

    function findButton(text: string) {
        return [...container.querySelectorAll('button')].find((button) => {
            return button.textContent === text;
        });
    }

    test('one waiting for approval is allowed or rejected', async () => {
        const { virtualDisplayCommand } =
            await import('./virtualDisplayHelpers');
        vi.mocked(virtualDisplayCommand).mockClear();
        mount('approval');
        expect(container.textContent).toContain('Waiting for approval');
        expect(container.querySelector('[role="switch"]')).toBeNull();
        expect(findButton('Disconnect')).toBeUndefined();
        await act(async () => {
            findButton('Allow connection')!.click();
        });
        expect(virtualDisplayCommand).toHaveBeenCalledWith('allow', {
            number: NUMBER,
            clientId: 'viewer-0001',
        });
        await act(async () => {
            findButton('Reject connection')!.click();
        });
        expect(virtualDisplayCommand).toHaveBeenCalledWith('disconnect', {
            number: NUMBER,
            clientId: 'viewer-0001',
        });
    });

    test('one waiting for its code cannot be allowed by hand', () => {
        mount('code');
        expect(container.textContent).toContain('Waiting for the code');
        expect(findButton('Allow connection')).toBeUndefined();
        expect(findButton('Reject connection')).toBeDefined();
    });

    test('one let in can be let interact, and is disconnected', () => {
        mount(null);
        expect(container.textContent).not.toContain('Waiting');
        expect(container.querySelector('[role="switch"]')).not.toBeNull();
        expect(findButton('Disconnect')).toBeDefined();
    });
});

// The header's cast button opens the TVs on this network; opening it is what
// looks for them.
describe('VirtualDisplayCardComp casting', () => {
    let container: HTMLDivElement;
    let root: Root;
    const TV = { id: 'dlna:1', name: 'Samsung', kind: 'dlna' } as const;

    function render(
        nextDisplay: VirtualDisplayInfo,
        nextState: VirtualDisplayState,
    ) {
        act(() => {
            root.render(
                <VirtualDisplayCardComp
                    display={nextDisplay}
                    state={nextState}
                    isBusy={false}
                    isJustCreated={false}
                    perform={async (work) => {
                        await work();
                    }}
                />,
            );
        });
    }

    const panel = () => {
        return container.querySelector<HTMLElement>(
            'section[aria-label="Cast to a TV"]',
        );
    };
    const buttonIn = (parent: ParentNode, text: string) => {
        return [...parent.querySelectorAll<HTMLButtonElement>('button')].find(
            (button) => button.textContent?.trim() === text,
        )!;
    };
    const press = async (button: HTMLButtonElement) => {
        await act(async () => {
            button.click();
            await Promise.resolve();
        });
    };

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        settingStore.clear();
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

    test('finds TVs, casts to one, shows how it goes, and stops it', async () => {
        const { virtualDisplayCommand } =
            await import('./virtualDisplayHelpers');
        const command = vi.mocked(virtualDisplayCommand);
        command.mockClear();
        render(display, state);
        const castButton = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Cast to a TV"]',
        )!;
        expect(castButton.className).toContain('btn-outline-secondary');
        expect(panel()).toBeNull();
        expect(command).not.toHaveBeenCalled();

        await press(castButton);
        expect(castButton.getAttribute('aria-expanded')).toBe('true');
        expect(command).toHaveBeenCalledWith('cast-search', {});

        render(display, { ...state, isCastSearching: true });
        expect(panel()!.textContent).toContain('Looking for TVs…');
        render(display, state);
        expect(panel()!.textContent).toContain('No TV found.');

        render(display, { ...state, castTargets: [TV] });
        expect(panel()!.textContent).toContain('Samsung');
        expect(panel()!.textContent).toContain('DLNA');
        await press(buttonIn(panel()!, 'Cast'));
        expect(command).toHaveBeenCalledWith('cast-start', {
            number: NUMBER,
            targetId: 'dlna:1',
        });

        const casting = {
            ...display,
            casts: [
                {
                    ...TV,
                    status: 'casting' as const,
                    failure: null,
                    behind: 1.6,
                    playbackRate: 1,
                },
            ],
        };
        render(casting, { ...state, castTargets: [TV] });
        // Lit while a TV plays it; that TV is listed once, with Stop.
        expect(castButton.className).toContain('btn-primary');
        expect(panel()!.textContent).toContain('Casting · 1.6 s behind live');
        expect(buttonIn(panel()!, 'Cast')).toBeUndefined();
        await press(buttonIn(panel()!, 'Stop'));
        expect(command).toHaveBeenLastCalledWith('cast-stop', {
            number: NUMBER,
            targetId: 'dlna:1',
        });

        render(
            {
                ...display,
                casts: [
                    {
                        ...TV,
                        status: 'failed',
                        failure: 'unreachable',
                        behind: null,
                        playbackRate: 1,
                    },
                ],
            },
            state,
        );
        expect(panel()!.querySelector('[role="alert"]')?.textContent).toBe(
            'The TV could not be reached.',
        );

        await press(buttonIn(panel()!, ''));
        expect(panel()).toBeNull();
    });

    test('with other devices not allowed to watch, it says how to cast', async () => {
        render(display, {
            ...state,
            shareEnabled: false,
            castTargets: [TV],
        });
        await press(
            container.querySelector<HTMLButtonElement>(
                'button[aria-label="Cast to a TV"]',
            )!,
        );
        expect(panel()!.textContent).toContain(
            'Turn on “Let other devices watch” to cast to a TV.',
        );
        expect(buttonIn(panel()!, 'Cast').disabled).toBe(true);
    });
});

// "Use HTTPS": a browser on another device gets an https address on the same
// port; a media player (the MP4) and this computer's own browser keep http.
describe('VirtualDisplayCardComp with HTTPS', () => {
    let container: HTMLDivElement;
    let root: Root | null = null;
    const lanState: VirtualDisplayState = {
        ...state,
        addresses: [
            { host: '127.0.0.1', port: 40000, kind: 'this-computer' },
            { host: '192.168.1.3', port: 40000, kind: 'lan' },
        ],
    };

    function render(httpsEnabled: boolean) {
        act(() => {
            root!.render(
                <VirtualDisplayCardComp
                    display={display}
                    state={{ ...lanState, httpsEnabled }}
                    isBusy={false}
                    isJustCreated={false}
                    perform={async () => {}}
                />,
            );
        });
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        settingStore.clear();
        settingStore.set(CARD_KEY, 'true');
        settingStore.set(
            `virtual-display-${NUMBER}-more-addresses-expanded`,
            'true',
        );
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root?.unmount();
        });
        root = null;
        container.remove();
    });

    test('the network address turns https and its QR code stays open', () => {
        render(false);
        const lanPage = `192.168.1.3:40000/vd/${NUMBER}/`;
        expect(container.textContent).toContain(`[QR http://${lanPage}]`);
        expect(container.textContent).not.toContain('https://');

        render(true);
        const text = container.textContent ?? '';
        expect(text).toContain(`[QR https://${lanPage}]`);
        // Only the MP4 is still http on this network.
        expect(text.split(`http://${lanPage}`)).toHaveLength(2);
        expect(text).toContain(`http://${lanPage}video`);
        expect(text).toContain(PAGE_URL);
        expect(text).not.toContain('https://127.0.0.1');
    });
});
