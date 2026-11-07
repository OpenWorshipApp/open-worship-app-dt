// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
    VirtualDisplayClient,
    VirtualDisplayInfo,
    VirtualDisplayState,
} from '../../electron/virtualDisplayProtocol';

// The card's corners the folds suite leaves: the status badge, typed names and
// sizes, the wallpaper picker, the address groups, each viewer's own switches
// and the preview. The real `settingHelpers` over an in-memory store.
const { settingStore, mocks } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
    mocks: {
        selectFiles: vi.fn(),
        command: vi.fn(),
        mirrorCommand: vi.fn(),
        copy: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageReader: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        pathUtils: { sep: '/' },
        messageUtils: { listenForData() {}, sendData() {} },
    },
}));
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
    selectFiles: mocks.selectFiles,
    toBaseNameOfAnyOs: (filePath: string) => {
        return filePath.split(/[\\/]/).pop() ?? '';
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: mocks.copy }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => false,
}));
vi.mock('../screen-mirror/MirrorNetworkComps', () => ({
    MirrorQrCodeComp: ({ text }: { text: string }) => (
        <span data-qr={text}>{`[QR ${text}]`}</span>
    ),
}));
vi.mock('../screen-mirror/MirrorIntercomComp', () => ({
    default: ({
        intercom,
        isSpeakerShown = true,
        onChange,
    }: {
        intercom: { mic: boolean; volume: number };
        isSpeakerShown?: boolean;
        onChange: (change: Record<string, unknown>) => unknown;
    }) => (
        <div
            data-intercom={isSpeakerShown ? 'talk-back' : 'mp4'}
            data-mic={String(intercom.mic)}
        >
            <button type="button" onClick={() => void onChange({ mic: true })}>
                Mic on
            </button>
            <button
                type="button"
                onClick={() => void onChange({ volume: 0.25 })}
            >
                Quieter
            </button>
        </div>
    ),
}));
vi.mock('../screen-mirror/mirrorConnectionHelpers', () => ({
    mirrorCommand: mocks.mirrorCommand,
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: any }) => (
        <Suspense fallback={<span>Loading preview</span>}>{children}</Suspense>
    ),
}));
vi.mock('./virtualDisplayHelpers', () => ({
    toVirtualDisplayErrorText: (text: string) => `ERR(${text})`,
    virtualDisplayCommand: mocks.command,
}));

import VirtualDisplayCardComp from './VirtualDisplayCardComp';

const NUMBER = 7;

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

function makeClient(
    patch: Partial<VirtualDisplayClient>,
): VirtualDisplayClient {
    return {
        id: 'viewer-1',
        kind: 'web',
        address: '192.168.1.20',
        network: 'local',
        userAgent: '',
        since: 0,
        isPreview: false,
        isInteractive: false,
        waiting: null,
        ...patch,
    };
}

let container: HTMLDivElement;
let root: Root;

function render(
    nextDisplay: Partial<VirtualDisplayInfo> = {},
    nextState: Partial<VirtualDisplayState> = {},
) {
    act(() => {
        root.render(
            <VirtualDisplayCardComp
                display={{ ...display, ...nextDisplay }}
                state={{ ...state, ...nextState }}
                isBusy={false}
                isJustCreated={false}
                perform={async (work) => {
                    await work();
                }}
            />,
        );
    });
}

function findButton(text: string, parent: ParentNode = container) {
    const button = [...parent.querySelectorAll('button')].find((item) => {
        return item.textContent?.trim() === text;
    });
    if (button === undefined) {
        throw new Error(`No button "${text}"`);
    }
    return button;
}

function badgeText() {
    return container.querySelector('.card-header .badge')?.textContent;
}

async function press(element: HTMLElement) {
    await act(async () => {
        element.click();
    });
}

function typeInto(input: HTMLInputElement, value: string) {
    act(() => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function choose(select: HTMLSelectElement, value: string) {
    await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    settingStore.clear();
    settingStore.set(`virtual-display-${NUMBER}-card-expanded`, 'true');
    mocks.command.mockResolvedValue(undefined);
    mocks.mirrorCommand.mockResolvedValue(undefined);
    mocks.copy.mockResolvedValue(undefined);
    mocks.selectFiles.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('VirtualDisplayCardComp status', () => {
    test('the header badge and the stream line follow the stream', () => {
        render({
            stream: 'error',
            error: 'The virtual display stopped recording',
            clients: [makeClient({})],
        });
        // A stopped stream says so even with someone watching.
        expect(badgeText()).toBe('Stopped');
        expect(container.querySelector('[role="alert"]')?.textContent).toBe(
            'ERR(The virtual display stopped recording)',
        );

        render({ stream: 'starting' });
        expect(badgeText()).toBe('Starting…');
        expect(container.querySelector('[role="alert"]')).toBeNull();

        render({ stream: 'idle' });
        expect(badgeText()).toBe('Idle');
        expect(container.textContent).toContain('No one is watching');

        // A preview is not someone watching.
        render({
            stream: 'starting',
            clients: [makeClient({ isPreview: true })],
        });
        expect(badgeText()).toBe('Starting…');
        render({ stream: 'live', clients: [makeClient({ isPreview: true })] });
        expect(badgeText()).toBe('Live · 0');
        render({ stream: 'idle', clients: [makeClient({})] });
        expect(badgeText()).toBe('Live · 1');
    });

    test('an MP4 with no AAC track warns that it is silent', () => {
        render({ mimeType: 'video/mp4; codecs="avc1.42E01E"' });
        expect(container.textContent).toContain(
            'This computer cannot encode AAC audio, so the video has no sound.',
        );
        render({ mimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' });
        expect(container.textContent).not.toContain('cannot encode AAC');
    });
});

describe('VirtualDisplayCardComp settings', () => {
    function nameInput() {
        return container.querySelector<HTMLInputElement>(
            'section[aria-label="Settings"] input.form-control-sm',
        )!;
    }

    test('a name left empty or unchanged is put back; Enter commits a new one', async () => {
        render();
        typeInto(nameInput(), '   ');
        act(() => {
            nameInput().focus();
            nameInput().blur();
        });
        expect(nameInput().value).toBe('Lobby TV');

        typeInto(nameInput(), '  Lobby TV  ');
        act(() => {
            nameInput().focus();
            nameInput().blur();
        });
        expect(nameInput().value).toBe('Lobby TV');
        expect(mocks.command).not.toHaveBeenCalled();

        typeInto(nameInput(), ' Hall ');
        await act(async () => {
            nameInput().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
            );
        });
        expect(mocks.command).not.toHaveBeenCalled();
        await act(async () => {
            nameInput().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith('update', {
            number: NUMBER,
            name: 'Hall',
        });
    });

    test('a custom size is typed, clamped to the limits and applied once', async () => {
        render({ clients: [makeClient({})] });
        expect(container.textContent).toContain(
            'Changing the resolution restarts the stream for everyone watching.',
        );
        const select = container.querySelector<HTMLSelectElement>(
            `#app-vd-resolution-${NUMBER}`,
        )!;
        expect(select.value).toBe('1280x720');
        expect(container.querySelector('input[aria-label="Width"]')).toBeNull();

        await choose(select, 'custom');
        expect(select.value).toBe('custom');
        const width = container.querySelector<HTMLInputElement>(
            'input[aria-label="Width"]',
        )!;
        const height = container.querySelector<HTMLInputElement>(
            'input[aria-label="Height"]',
        )!;
        expect([width.value, height.value]).toEqual(['1280', '720']);
        expect(mocks.command).not.toHaveBeenCalled();

        // Applying the size it already has sends nothing.
        await press(findButton('Apply'));
        expect(mocks.command).not.toHaveBeenCalled();

        typeInto(width, '5001');
        typeInto(height, '101');
        await press(findButton('Apply'));
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith('update', {
            number: NUMBER,
            width: 3840,
            height: 160,
        });
        expect([width.value, height.value]).toEqual(['3840', '160']);
    });

    test('a size that is not a preset starts as a custom one', () => {
        render({ width: 1000, height: 500 });
        expect(
            container.querySelector<HTMLSelectElement>(
                `#app-vd-resolution-${NUMBER}`,
            )!.value,
        ).toBe('custom');
        expect(
            container.querySelector<HTMLInputElement>(
                'input[aria-label="Width"]',
            )!.value,
        ).toBe('1000');
    });

    test('no wallpaper is sent at once; a colour once the picker settles', async () => {
        vi.useFakeTimers();
        render({ wallpaper: { kind: 'color', color: '#112233' } });
        const select = container.querySelector<HTMLSelectElement>(
            `#app-vd-wallpaper-${NUMBER}`,
        )!;
        const picker = container.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        expect(picker.value).toBe('#112233');

        typeInto(picker, '#aa0000');
        typeInto(picker, '#bb0000');
        typeInto(picker, '#cc0000');
        expect(picker.value).toBe('#cc0000');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(mocks.command).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith('update', {
            number: NUMBER,
            wallpaper: { kind: 'color', color: '#cc0000' },
        });

        await choose(select, 'none');
        expect(mocks.command).toHaveBeenLastCalledWith('update', {
            number: NUMBER,
            wallpaper: { kind: 'none' },
        });
        // A value the picker does not offer sends nothing.
        mocks.command.mockClear();
        await choose(select, 'gradient');
        expect(mocks.command).not.toHaveBeenCalled();
        expect(mocks.selectFiles).not.toHaveBeenCalled();
    });

    test('an image or video wallpaper names its file and picks another', async () => {
        render({
            wallpaper: { kind: 'video', filePath: 'C:\\media\\loop.mp4' },
            isWallpaperMissing: true,
        });
        const file = container.querySelector<HTMLElement>(
            'span.app-data.app-ellipsis.flex-fill[title]',
        )!;
        expect(file.title).toBe('C:\\media\\loop.mp4');
        expect(file.textContent).toBe('loop.mp4');
        expect(container.textContent).toContain('File not found');
        expect(container.querySelector('input[type="color"]')).toBeNull();

        // Cancelled: nothing changes.
        await press(findButton('Choose File'));
        expect(mocks.selectFiles).toHaveBeenCalledWith([
            expect.objectContaining({ name: 'Video' }),
        ]);
        expect(mocks.command).not.toHaveBeenCalled();

        mocks.selectFiles.mockResolvedValueOnce(['D:/clips/intro.webm']);
        await press(findButton('Choose File'));
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith('update', {
            number: NUMBER,
            wallpaper: { kind: 'video', filePath: 'D:/clips/intro.webm' },
        });
    });

    test('stacked screens are named, with the newest on top', () => {
        render({ screenIds: [2, 5] });
        expect(container.textContent).toContain(
            'Several screens show on this display, stacked: the one shown last is on top.',
        );
        expect(container.textContent).toContain(
            'Screens on this display: 2, 5',
        );
        render({ screenIds: [2] });
        expect(container.textContent).not.toContain('stacked');
        expect(container.textContent).toContain('Screens on this display: 2');
    });
});

describe('VirtualDisplayCardComp where to watch', () => {
    const addresses: VirtualDisplayState['addresses'] = [
        { host: '127.0.0.1', port: 40000, kind: 'this-computer' },
        { host: '192.168.1.3', port: 40000, kind: 'lan' },
        { host: '203.0.113.5', port: 40000, kind: 'public' },
        { host: 'abc.trycloudflare.com', port: 443, kind: 'tunnel' },
    ];
    const LAN = `http://192.168.1.3:40000/vd/${NUMBER}/`;
    const PUBLIC = `http://203.0.113.5:40000/vd/${NUMBER}/`;
    const TUNNEL = `https://abc.trycloudflare.com/vd/${NUMBER}/`;

    function addressRow(url: string) {
        const row = [
            ...container.querySelectorAll<HTMLElement>(
                'section[aria-label="Where to watch"] li',
            ),
        ].find((item) => {
            return item.querySelector('.app-data')?.textContent === url;
        });
        if (row === undefined) {
            throw new Error(`No row for ${url}`);
        }
        return row;
    }

    function shownQrs() {
        return [...container.querySelectorAll<HTMLElement>('[data-qr]')].map(
            (item) => item.dataset.qr,
        );
    }

    test('each recommended address names its group and is starred', () => {
        render({}, { addresses });
        const badges = [LAN, PUBLIC, TUNNEL].map((url) => {
            const badge = addressRow(url).querySelector('.badge')!;
            return [badge.textContent, badge.getAttribute('title')];
        });
        expect(badges).toEqual([
            ['This network', 'Recommended'],
            ['Public IP', 'Recommended'],
            ['Tunnel', 'Recommended'],
        ]);
        // The first recommended address has its QR code open.
        expect(shownQrs()).toEqual([LAN]);
    });

    test('copy hands the address to the clipboard; a QR code opens one at a time', async () => {
        render({}, { addresses });
        await press(
            addressRow(TUNNEL).querySelector<HTMLButtonElement>(
                `button[aria-label="Copy address: ${TUNNEL}"]`,
            )!,
        );
        expect(mocks.copy).toHaveBeenCalledExactlyOnceWith(
            TUNNEL,
            'Copy address',
        );

        const publicQr = addressRow(PUBLIC).querySelector<HTMLButtonElement>(
            `button[aria-label="QR code: ${PUBLIC}"]`,
        )!;
        expect(publicQr.getAttribute('aria-pressed')).toBe('false');
        await press(publicQr);
        expect(shownQrs()).toEqual([PUBLIC]);
        expect(publicQr.getAttribute('aria-pressed')).toBe('true');

        await press(publicQr);
        expect(shownQrs()).toEqual([]);
    });
});

describe('VirtualDisplayCardComp watching now', () => {
    test('an MP4 player gets the display mic; a browser its talk-back and interaction', async () => {
        render({
            isMp4MicOn: true,
            clients: [
                makeClient({
                    id: 'player-1',
                    kind: 'video',
                    userAgent: 'VLC/3.0.20 LibVLC/3.0.20',
                }),
                makeClient({
                    id: 'phone-2',
                    network: 'internet',
                    address: '198.51.100.4',
                    camera: 'Back camera',
                    userAgent:
                        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
                    intercom: {
                        mic: false,
                        speaker: true,
                        volume: 1,
                        remoteMic: true,
                    },
                }),
            ],
        });
        const rows = [...container.querySelectorAll<HTMLElement>('li')];
        const player = rows.find((row) => row.textContent?.includes('VLC'))!;
        const phone = rows.find((row) => row.textContent?.includes('iPhone'))!;
        expect(player.textContent).toContain('192.168.1.20 · VLC');
        expect(phone.textContent).toContain('198.51.100.4 · Safari · iPhone');
        expect(phone.textContent).toContain('Back camera');
        expect(phone.querySelector('.bi-globe2')).not.toBeNull();

        const mp4 = player.querySelector<HTMLElement>('[data-intercom="mp4"]')!;
        expect(mp4.dataset.mic).toBe('true');
        // A player cannot be let interact.
        expect(player.querySelector('[role="switch"]')).toBeNull();
        await press(findButton('Mic on', mp4));
        expect(mocks.command).toHaveBeenLastCalledWith('mp4-mic', {
            number: NUMBER,
            enabled: true,
        });
        await press(findButton('Quieter', mp4));
        expect(mocks.command).toHaveBeenLastCalledWith('mp4-mic', {
            number: NUMBER,
            enabled: false,
        });

        const talkBack = phone.querySelector<HTMLElement>(
            '[data-intercom="talk-back"]',
        )!;
        await press(findButton('Quieter', talkBack));
        expect(mocks.mirrorCommand).toHaveBeenCalledExactlyOnceWith(
            'intercom',
            { key: 'viewer:phone-2', volume: 0.25 },
        );

        const interactive = phone.querySelector<HTMLInputElement>(
            '#app-vd-interactive-phone-2',
        )!;
        expect(interactive.checked).toBe(false);
        await press(interactive);
        expect(mocks.command).toHaveBeenLastCalledWith('interactive', {
            number: NUMBER,
            clientId: 'phone-2',
            enabled: true,
        });
        await press(findButton('Disconnect', phone));
        expect(mocks.command).toHaveBeenLastCalledWith('disconnect', {
            number: NUMBER,
            clientId: 'phone-2',
        });
    });

    test('this app’s own preview is named so, with no talk-back and no disconnect', () => {
        render({
            clients: [
                makeClient({
                    id: 'preview-1',
                    kind: 'video',
                    network: 'this-computer' as any,
                    isPreview: true,
                    userAgent: 'VLC/3.0.20',
                }),
            ],
        });
        const row = [...container.querySelectorAll<HTMLElement>('li')].find(
            (item) => item.textContent?.includes('This app (preview)'),
        )!;
        expect(row).toBeDefined();
        expect(row.textContent).toContain('This computer');
        expect(row.textContent).not.toContain('VLC');
        expect(row.querySelector('[data-intercom]')).toBeNull();
        expect(
            [...row.querySelectorAll('button')].map((button) =>
                button.textContent?.trim(),
            ),
        ).toEqual([]);
    });
});

describe('VirtualDisplayCardComp casting statuses', () => {
    const TV = { id: 'roku:1', name: 'Den', kind: 'roku' } as const;

    function cast(patch: Record<string, unknown>) {
        return {
            ...TV,
            status: 'casting',
            failure: null,
            behind: null,
            playbackRate: 1,
            ...patch,
        } as VirtualDisplayInfo['casts'][number];
    }

    function statusLine() {
        return container.querySelector<HTMLElement>(
            'section[aria-label="Cast to a TV"] li span.small',
        )!;
    }

    test('each cast says how it goes, a failed one as an alert', async () => {
        render({ casts: [cast({ status: 'connecting' })] });
        await press(
            container.querySelector<HTMLButtonElement>(
                'button[aria-label="Cast to a TV"]',
            )!,
        );
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith(
            'cast-search',
            {},
        );
        expect(statusLine().textContent).toBe('Connecting');
        expect(statusLine().getAttribute('role')).toBeNull();
        expect(
            container.querySelector('section[aria-label="Cast to a TV"]')!
                .textContent,
        ).toContain('Roku');

        render({ casts: [cast({ playbackRate: 1.25 })] });
        expect(statusLine().textContent).toBe('Catching up');
        render({ casts: [cast({ behind: 1.94 })] });
        expect(statusLine().textContent).toBe('Casting · 1.9 s behind live');

        const failures: Array<[unknown, string]> = [
            ['timeout', 'The TV did not answer.'],
            ['ended', 'The TV stopped playing.'],
            [null, 'The TV could not play this display.'],
        ];
        for (const [failure, text] of failures) {
            render({ casts: [cast({ status: 'failed', failure })] });
            expect(statusLine().textContent).toBe(text);
            expect(statusLine().getAttribute('role')).toBe('alert');
            expect(statusLine().className).toContain('text-danger');
        }
    });

    test('Search again asks once more, and a failed search is quiet', async () => {
        mocks.command.mockRejectedValue(new Error('No network'));
        render();
        await press(
            container.querySelector<HTMLButtonElement>(
                'button[aria-label="Cast to a TV"]',
            )!,
        );
        await press(findButton('Search again'));
        expect(mocks.command.mock.calls).toEqual([
            ['cast-search', {}],
            ['cast-search', {}],
        ]);
        expect(
            container.querySelector('section[aria-label="Cast to a TV"]'),
        ).not.toBeNull();
    });
});

describe('VirtualDisplayCardComp preview', () => {
    test('Preview opens the display’s own page from this computer, and closes it', async () => {
        render();
        const button = findButton('Preview');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        await press(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        for (let index = 0; index < 20; index++) {
            if (container.querySelector('iframe') !== null) {
                break;
            }
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5));
            });
        }
        const frame = container.querySelector('iframe')!;
        expect(frame.getAttribute('src')).toBe(
            `http://127.0.0.1:40000/vd/${NUMBER}/?preview=1`,
        );
        expect(frame.title).toBe('Preview');
        expect(frame.style.aspectRatio).toBe('1280 / 720');

        await press(button);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelector('iframe')).toBeNull();
    });
});
