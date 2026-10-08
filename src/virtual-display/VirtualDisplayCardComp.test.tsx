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
    MirrorQrCodeComp: () => null,
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
    clients: [],
    blocked: [],
};

const state: VirtualDisplayState = {
    available: true,
    error: null,
    port: 40000,
    shareEnabled: true,
    internetEnabled: false,
    router: 'off',
    addresses: [{ host: '127.0.0.1', port: 40000, kind: 'this-computer' }],
    displays: [display],
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
