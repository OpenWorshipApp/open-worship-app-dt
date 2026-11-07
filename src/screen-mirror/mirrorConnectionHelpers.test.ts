// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MirrorState } from '../../electron/screenMirrorProtocol';

// The guest page, the floating panel and the host controls all read Screen
// Mirror through this one module: the main process's state pushed on
// `mirror:state`, the panel's place kept in two settings, and every action
// sent as one `mirror:command`. The module keeps its state at module level,
// so each test loads a fresh copy.
const h = vi.hoisted(() => ({
    listenForData: vi.fn(),
    sendDataSync: vi.fn(),
    sendAsync: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    settings: {} as Record<string, string>,
    stateListener: null as null | ((event: unknown, value: unknown) => void),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            listenForData: h.listenForData,
            sendDataSync: h.sendDataSync,
        },
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: h.sendAsync,
}));
// A prefix, so a test sees the text went through the translation.
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `tr:${text}`,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSetting,
    setSetting: h.setSetting,
}));

type HelpersType = typeof import('./mirrorConnectionHelpers');

async function load(): Promise<HelpersType> {
    vi.resetModules();
    return import('./mirrorConnectionHelpers');
}

function mirrorState(extra: Partial<MirrorState> = {}): MirrorState {
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

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings = {};
    h.stateListener = null;
    h.listenForData.mockImplementation(
        (channel: string, callback: (event: unknown, value: any) => void) => {
            if (channel === 'mirror:state') {
                h.stateListener = callback;
            }
        },
    );
    h.sendDataSync.mockReturnValue(undefined);
    h.getSetting.mockImplementation((name: string) => {
        return h.settings[name] ?? null;
    });
    h.setSetting.mockImplementation((name: string, value: string) => {
        h.settings[name] = value;
    });
    h.sendAsync.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('toMirrorErrorText', () => {
    test.each([
        'Connection code is incorrect',
        'Disconnected by host',
        'Incompatible or duplicate connection',
        'Invalid host or port',
        'Too many hosts',
        'Too many wrong codes. Try again later.',
        'Too many connection requests. Try again later.',
        'Microphone access denied',
    ])('shows the service reason "%s" in the app language', async (reason) => {
        const { toMirrorErrorText } = await load();
        expect(toMirrorErrorText(reason)).toBe(`tr:${reason}`);
    });

    test('any other reason reads as a plain failure, never as the raw text', async () => {
        const { toMirrorErrorText } = await load();
        expect(toMirrorErrorText('connect ECONNREFUSED 10.0.0.2:39240')).toBe(
            'tr:Connection failed',
        );
        expect(toMirrorErrorText('')).toBe('tr:Connection failed');
        // Close is not equal: a reason with another case is not trusted.
        expect(toMirrorErrorText('too many hosts')).toBe(
            'tr:Connection failed',
        );
    });
});

describe('the mirror state', () => {
    test('is read once from the main process, then kept current by its broadcast', async () => {
        const first = mirrorState({ port: 39241 });
        h.sendDataSync.mockReturnValue(first);
        const { getMirrorState } = await load();
        expect(h.listenForData).not.toHaveBeenCalled();

        expect(getMirrorState()).toBe(first);
        expect(h.sendDataSync).toHaveBeenCalledExactlyOnceWith('mirror:state');
        expect(h.listenForData).toHaveBeenCalledExactlyOnceWith(
            'mirror:state',
            expect.any(Function),
        );
        // Asked again: no second listener, no second synchronous read.
        expect(getMirrorState()).toBe(first);
        expect(h.listenForData).toHaveBeenCalledOnce();
        expect(h.sendDataSync).toHaveBeenCalledOnce();

        const pushed = mirrorState({ port: 39242, hostEnabled: true });
        h.stateListener!(null, pushed);
        expect(getMirrorState()).toBe(pushed);
        expect(h.sendDataSync).toHaveBeenCalledOnce();
    });

    test('is null while the main process has no Screen Mirror server', async () => {
        const { getMirrorState } = await load();
        expect(getMirrorState()).toBeNull();
    });

    test('redraws a component when the main process pushes a new state', async () => {
        h.sendDataSync.mockReturnValue(mirrorState({ port: 39240 }));
        const { useMirrorState } = await load();
        function ProbeComp() {
            const state = useMirrorState();
            return createElement(
                'span',
                {},
                state === null ? 'none' : `port ${state.port}`,
            );
        }
        act(() => root.render(createElement(ProbeComp)));
        expect(container.textContent).toBe('port 39240');

        act(() => h.stateListener!(null, mirrorState({ port: 39250 })));
        expect(container.textContent).toBe('port 39250');
    });

    test('a page drawn on the server has no state yet', async () => {
        h.sendDataSync.mockReturnValue(mirrorState());
        const { useMirrorState } = await load();
        function ProbeComp() {
            const state = useMirrorState();
            return createElement('span', {}, state === null ? 'none' : 'some');
        }
        expect(renderToStaticMarkup(createElement(ProbeComp))).toBe(
            '<span>none</span>',
        );
        expect(h.sendDataSync).not.toHaveBeenCalled();
    });
});

describe('the Virtual Screens Manager panel', () => {
    test('opens where it was left: shown, on the Virtual Displays tab', async () => {
        h.settings['virtual-screens-manager-showing'] = 'true';
        h.settings['virtual-screens-manager-tab'] = 'virtual';
        const { getMirrorPanelShowing, getMirrorPanelTab } = await load();
        // Read on first ask, not at import.
        expect(h.getSetting).not.toHaveBeenCalled();
        expect(getMirrorPanelShowing()).toBe(true);
        expect(getMirrorPanelTab()).toBe('virtual');
        expect(getMirrorPanelShowing()).toBe(true);
        expect(getMirrorPanelTab()).toBe('virtual');
        // Each setting is read once and then kept.
        expect(h.getSetting.mock.calls).toEqual([
            ['virtual-screens-manager-showing'],
            ['virtual-screens-manager-tab'],
        ]);
    });

    test('is closed on the Screen Mirror tab when nothing, or nothing known, was kept', async () => {
        const fresh = await load();
        expect(fresh.getMirrorPanelShowing()).toBe(false);
        expect(fresh.getMirrorPanelTab()).toBe('mirror');

        h.settings['virtual-screens-manager-showing'] = 'yes';
        h.settings['virtual-screens-manager-tab'] = 'settings';
        const odd = await load();
        expect(odd.getMirrorPanelShowing()).toBe(false);
        expect(odd.getMirrorPanelTab()).toBe('mirror');
    });

    test('a tab chosen is kept in its setting and redraws the panel', async () => {
        const { setMirrorPanelTab, getMirrorPanelTab, useMirrorPanelTab } =
            await load();
        function ProbeComp() {
            return createElement('span', {}, useMirrorPanelTab());
        }
        act(() => root.render(createElement(ProbeComp)));
        expect(container.textContent).toBe('mirror');

        act(() => setMirrorPanelTab('virtual'));
        expect(h.setSetting).toHaveBeenCalledExactlyOnceWith(
            'virtual-screens-manager-tab',
            'virtual',
        );
        expect(getMirrorPanelTab()).toBe('virtual');
        expect(container.textContent).toBe('virtual');
    });

    test('opening and closing are kept, and a named tab is switched to in the same press', async () => {
        const helpers = await load();
        function ProbeComp() {
            const showing = helpers.useMirrorPanelShowing();
            const tab = helpers.useMirrorPanelTab();
            return createElement(
                'span',
                {},
                `${showing ? 'open' : 'closed'} ${tab}`,
            );
        }
        act(() => root.render(createElement(ProbeComp)));
        expect(container.textContent).toBe('closed mirror');

        act(() => helpers.setMirrorPanelShowing(true));
        expect(h.setSetting.mock.calls).toEqual([
            ['virtual-screens-manager-showing', 'true'],
        ]);
        expect(container.textContent).toBe('open mirror');

        act(() => helpers.setMirrorPanelShowing(true, 'virtual'));
        expect(container.textContent).toBe('open virtual');
        expect(h.settings).toEqual({
            'virtual-screens-manager-showing': 'true',
            'virtual-screens-manager-tab': 'virtual',
        });

        act(() => helpers.setMirrorPanelShowing(false));
        expect(h.settings['virtual-screens-manager-showing']).toBe('false');
        expect(helpers.getMirrorPanelShowing()).toBe(false);
        expect(container.textContent).toBe('closed virtual');
    });

    test('a server-drawn panel is closed, on the Screen Mirror tab', async () => {
        h.settings['virtual-screens-manager-showing'] = 'true';
        h.settings['virtual-screens-manager-tab'] = 'virtual';
        const helpers = await load();
        function ProbeComp() {
            const showing = helpers.useMirrorPanelShowing();
            return createElement(
                'span',
                {},
                `${showing ? 'open' : 'closed'} ${helpers.useMirrorPanelTab()}`,
            );
        }
        expect(renderToStaticMarkup(createElement(ProbeComp))).toBe(
            '<span>closed mirror</span>',
        );
    });
});

describe('mirrorCommand', () => {
    test('sends the action and its options as one mirror command, and answers with the reply', async () => {
        const found = [{ id: 'host-1', name: 'Church hall', port: 39240 }];
        h.sendAsync.mockResolvedValueOnce(found);
        const { mirrorCommand } = await load();
        await expect(mirrorCommand('scan')).resolves.toBe(found);
        expect(h.sendAsync).toHaveBeenLastCalledWith('mirror:command', {
            action: 'scan',
        });

        await mirrorCommand('connect', {
            host: '192.168.1.8',
            port: 39240,
            code: 'secret',
        });
        expect(h.sendAsync).toHaveBeenLastCalledWith('mirror:command', {
            action: 'connect',
            host: '192.168.1.8',
            port: 39240,
            code: 'secret',
        });
    });

    test('a refused command rejects with the reason', async () => {
        h.sendAsync.mockRejectedValueOnce(new Error('Too many hosts'));
        const { mirrorCommand } = await load();
        await expect(mirrorCommand('connect', { host: 'x' })).rejects.toThrow(
            'Too many hosts',
        );
    });
});
