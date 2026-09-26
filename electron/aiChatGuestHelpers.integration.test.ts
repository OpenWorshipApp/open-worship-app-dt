import { afterEach, describe, expect, test, vi } from 'vitest';

const { electronMock, guestSession, mocks, policy, state } = vi.hoisted(() => ({
    electronMock: {
        app: { on: vi.fn() },
        session: { fromPartition: vi.fn() },
        shell: { openExternal: vi.fn() },
        webContents: { fromId: vi.fn() },
    },
    guestSession: {
        clearAuthCache: vi.fn(),
        clearCache: vi.fn(),
        clearStorageData: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
        webRequest: { onBeforeRequest: vi.fn() },
    },
    mocks: {
        importEsm: vi.fn(),
        toMcpPackagePath: vi.fn(() => '/app/webUrlPolicy.mjs'),
    },
    policy: {
        checkIsLocalHostname: vi.fn((hostname: string) => {
            return (
                hostname === 'localhost' ||
                hostname.startsWith('127.') ||
                hostname.startsWith('192.168.')
            );
        }),
    },
    state: {
        resolvePolicy: null as null | ((policy: unknown) => void),
    },
}));

vi.mock('electron', () => electronMock);
vi.mock('./aiHelpers', () => ({
    importEsm: mocks.importEsm,
    toMcpPackagePath: mocks.toMcpPackagePath,
}));

function createContents(type: string, host: any = null) {
    const listeners = new Map<string, (...args: any[]) => unknown>();
    return {
        hostWebContents: host,
        id: 8,
        listeners,
        getType: vi.fn(() => type),
        on: vi.fn((name: string, callback: (...args: any[]) => unknown) => {
            listeners.set(name, callback);
        }),
        once: vi.fn(),
        removeListener: vi.fn(),
        setWindowOpenHandler: vi.fn(),
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('the installed AI Chat guest guard', () => {
    test('guards requests, permissions, guests, popups, and sign-out', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(10_000);
        vi.clearAllMocks();
        vi.resetModules();
        electronMock.session.fromPartition.mockReturnValue(guestSession);
        guestSession.clearAuthCache.mockResolvedValue(undefined);
        guestSession.clearCache.mockResolvedValue(undefined);
        guestSession.clearStorageData.mockResolvedValue(undefined);
        const policyPromise = new Promise((resolve) => {
            state.resolvePolicy = resolve;
        });
        mocks.importEsm.mockReturnValue(policyPromise);

        const module = await import('./aiChatGuestHelpers');
        module.initAiChatGuestGuard();
        module.initAiChatGuestGuard();

        expect(electronMock.session.fromPartition).toHaveBeenCalledWith(
            module.AI_CHAT_PARTITION,
        );
        expect(electronMock.app.on).toHaveBeenCalledTimes(1);
        expect(mocks.importEsm).toHaveBeenCalledTimes(1);

        const requestGuard =
            guestSession.webRequest.onBeforeRequest.mock.calls[0][1];
        const delayedDecision = vi.fn();
        requestGuard({ url: 'https://example.com/app.js' }, delayedDecision);
        expect(delayedDecision).not.toHaveBeenCalled();
        state.resolvePolicy?.(policy);
        await policyPromise;
        await vi.runAllTimersAsync();
        expect(delayedDecision).toHaveBeenCalledWith({ cancel: false });

        const localDecision = vi.fn();
        requestGuard({ url: 'http://127.0.0.1:39223' }, localDecision);
        expect(localDecision).toHaveBeenCalledWith({ cancel: true });

        const requestPermission =
            guestSession.setPermissionRequestHandler.mock.calls[0][0];
        const clipboardDone = vi.fn();
        requestPermission(
            createContents('webview'),
            'clipboard-sanitized-write',
            clipboardDone,
            {},
        );
        expect(clipboardDone).toHaveBeenCalledWith(true);
        const cameraDone = vi.fn();
        requestPermission(createContents('webview'), 'media', cameraDone, {
            isMainFrame: true,
            requestingUrl: 'https://example.com',
            mediaTypes: ['video'],
        });
        expect(cameraDone).toHaveBeenCalledWith(false);

        const checkPermission =
            guestSession.setPermissionCheckHandler.mock.calls[0][0];
        expect(checkPermission({}, 'clipboard-sanitized-write', '', {})).toBe(
            true,
        );
        expect(
            checkPermission({}, 'media', 'https://example.com', {
                isMainFrame: true,
                mediaType: 'audio',
            }),
        ).toBe(true);
        expect(
            checkPermission({}, 'media', 'https://example.com', {
                isMainFrame: true,
                mediaType: 'video',
            }),
        ).toBe(false);

        const onCreated = electronMock.app.on.mock.calls[0][1];
        const ordinaryContents = createContents('window');
        onCreated({}, ordinaryContents);
        const attach = ordinaryContents.listeners.get('will-attach-webview')!;
        const refusedAttach = { preventDefault: vi.fn() };
        attach(
            refusedAttach,
            {},
            {
                src: 'file:///tmp/a.html',
                partition: module.AI_CHAT_PARTITION,
            },
        );
        expect(refusedAttach.preventDefault).toHaveBeenCalledTimes(1);
        const preferences: any = {
            preload: '/tmp/preload.js',
            nodeIntegration: true,
        };
        attach({ preventDefault: vi.fn() }, preferences, {
            src: 'https://chat.example.com',
            partition: module.AI_CHAT_PARTITION,
        });
        expect(preferences).toEqual(
            expect.objectContaining({
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
            }),
        );
        expect(preferences.preload).toBeUndefined();

        const host = {
            id: 4,
            isDestroyed: vi.fn(() => false),
            send: vi.fn(),
        };
        const guest = createContents('webview', host);
        onCreated({}, guest);
        const microphoneDone = vi.fn();
        requestPermission(guest, 'media', microphoneDone, {
            isMainFrame: true,
            requestingUrl: 'https://example.com/call',
            mediaTypes: ['audio'],
        });
        const microphoneAsk = host.send.mock.calls.find(
            ([channel]) => channel === module.AI_CHAT_MICROPHONE_ASK_CHANNEL,
        )?.[1];
        module.answerAiChatMicrophoneAsk(host.id, {
            askId: microphoneAsk.askId,
            isAllowed: true,
        });
        expect(microphoneDone).toHaveBeenCalledWith(true);
        const blockedNavigation = { preventDefault: vi.fn() };
        guest.listeners.get('will-navigate')?.(
            blockedNavigation,
            'http://192.168.1.1/admin',
        );
        expect(blockedNavigation.preventDefault).toHaveBeenCalledTimes(1);
        const allowedNavigation = { preventDefault: vi.fn() };
        guest.listeners.get('will-redirect')?.(
            allowedNavigation,
            'https://example.com/next',
        );
        expect(allowedNavigation.preventDefault).not.toHaveBeenCalled();

        guest.listeners.get('input-event')?.({}, { type: 'mouseDown' });
        const openWindow = guest.setWindowOpenHandler.mock.calls[0][0];
        expect(openWindow({ url: 'https://example.com/citation' })).toEqual({
            action: 'deny',
        });
        expect(electronMock.shell.openExternal).toHaveBeenCalledWith(
            'https://example.com/citation',
        );
        expect(openWindow({ url: 'https://example.com/second' })).toEqual({
            action: 'deny',
        });
        expect(host.send).toHaveBeenCalledWith(
            module.AI_CHAT_POPUP_REFUSED_CHANNEL,
            { guestId: 8, hostname: 'example.com' },
        );
        expect(openWindow({ url: 'http://127.0.0.1:39223/private' })).toEqual({
            action: 'deny',
        });
        expect(electronMock.shell.openExternal).toHaveBeenCalledTimes(1);

        const hostlessGuest = createContents('webview');
        onCreated({}, hostlessGuest);
        const hostlessOpen =
            hostlessGuest.setWindowOpenHandler.mock.calls[0][0];
        expect(hostlessOpen({ url: 'https://example.com/no-host' })).toEqual({
            action: 'deny',
        });
        const malformedNavigation = { preventDefault: vi.fn() };
        hostlessGuest.listeners.get('will-navigate')?.(
            malformedNavigation,
            'javascript:alert(1)',
        );
        expect(malformedNavigation.preventDefault).toHaveBeenCalledTimes(1);

        await module.clearAiChatGuestData();
        expect(guestSession.clearStorageData).toHaveBeenCalledTimes(1);
        expect(guestSession.clearCache).toHaveBeenCalledTimes(1);
        expect(guestSession.clearAuthCache).toHaveBeenCalledTimes(1);
    });

    test('fails closed when the shared address policy cannot load', async () => {
        vi.clearAllMocks();
        vi.resetModules();
        electronMock.session.fromPartition.mockReturnValue(guestSession);
        mocks.importEsm.mockRejectedValue(new Error('missing policy'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        const module = await import('./aiChatGuestHelpers');
        module.initAiChatGuestGuard();
        await vi.waitFor(() => {
            expect(error).toHaveBeenCalledWith(
                'AI Chat address policy could not load',
                expect.any(Error),
            );
        });
    });
});
