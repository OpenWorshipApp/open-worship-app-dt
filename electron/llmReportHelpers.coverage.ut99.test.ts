import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Electron wiring of the report door: the relay's session it posts on,
// the registry it reads, the queue a report the server was away for waits in.
const mocks = vi.hoisted(() => ({
    userDataPath: '/mock-user-data',
    isAiEnabled: true,
    servers: [] as any[],
    fetchOnRelaySession: vi.fn(),
    refreshLlmRegistry: vi.fn(),
    queueReportBody: vi.fn(),
    sendQueuedReports: vi.fn(),
}));

vi.mock('electron', () => ({
    app: { getPath: () => mocks.userDataPath },
}));
vi.mock('./aiHelpers', () => ({
    checkIsAiEnabled: () => mocks.isAiEnabled,
}));
vi.mock('./customLlmRelayHelpers', () => ({
    fetchOnRelaySession: mocks.fetchOnRelaySession,
}));
vi.mock('./llmRegistryHelpers', () => ({
    getLlmReportServers: () => mocks.servers,
    refreshLlmRegistry: mocks.refreshLlmRegistry,
}));
vi.mock('./llmReportQueueHelpers', () => ({
    QUEUED_REASON_LIST: ['unreachable', 'timeout'],
    REPORT_QUEUE_FIRST_TRY_DELAY_MILLISECONDS: 60 * 1000,
    REPORT_QUEUE_RETRY_EVERY_MILLISECONDS: 30 * 60 * 1000,
    queueReportBody: mocks.queueReportBody,
    sendQueuedReports: mocks.sendQueuedReports,
}));

import type { LlmReportServerType } from './customLlmProtocol';
import {
    cancelLlmReportPost,
    handleLlmReportPost,
    initLlmReportQueue,
    resetLlmReportForTests,
    runLlmReportPost,
    type LlmReportDepsType,
} from './llmReportHelpers';

const REPORT_TEXT = 'This is a problem report.\n\n# The screen went blank\n';

function genServer(value: Partial<LlmReportServerType> = {}) {
    return {
        id: 'registry-reporting',
        name: 'Report inbox',
        baseUrl: 'https://reports.example/v1/',
        apiKey: 'sk-report',
        note: '',
        ...value,
    };
}

beforeEach(() => {
    resetLlmReportForTests();
    mocks.isAiEnabled = true;
    mocks.servers = [genServer()];
    mocks.fetchOnRelaySession.mockImplementation(async () => {
        return new Response('thank you', { status: 200 });
    });
    mocks.refreshLlmRegistry.mockResolvedValue({});
    mocks.queueReportBody.mockResolvedValue(true);
    mocks.sendQueuedReports.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('handleLlmReportPost, the IPC door', () => {
    test('posts on the relay’s session, then sends what was kept for later', async () => {
        const result = await handleLlmReportPost({ text: REPORT_TEXT });

        expect(result).toEqual({ ok: true });
        expect(mocks.fetchOnRelaySession).toHaveBeenCalledTimes(1);
        const [url, init] = mocks.fetchOnRelaySession.mock.calls[0];
        expect(url).toBe('https://reports.example/v1');
        expect(init.method).toBe('POST');
        expect(init.headers.authorization).toBe('Bearer sk-report');
        expect(JSON.parse(init.body).prompt).toBe(REPORT_TEXT);
        // The server is there now: the queue is emptied into it.
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(1);
        const [queueDeps] = mocks.sendQueuedReports.mock.calls[0];
        expect(queueDeps.dirPath).toBe(
            path.join('/mock-user-data', 'pending-reports'),
        );
        expect(mocks.queueReportBody).not.toHaveBeenCalled();
    });

    test('the queue it sends from delivers on the same door, and follows the AI switch', async () => {
        await handleLlmReportPost({ text: REPORT_TEXT });
        const [queueDeps] = mocks.sendQueuedReports.mock.calls[0];
        mocks.fetchOnRelaySession.mockClear();

        expect(await queueDeps.deliver('{"prompt":"kept"}')).toEqual({
            ok: true,
        });
        expect(mocks.fetchOnRelaySession).toHaveBeenCalledWith(
            'https://reports.example/v1',
            expect.objectContaining({ body: '{"prompt":"kept"}' }),
        );
        expect(queueDeps.isAiEnabled()).toBe(true);
        mocks.isAiEnabled = false;
        expect(queueDeps.isAiEnabled()).toBe(false);
        // Read when asked, not at load: another data folder, another queue.
        mocks.userDataPath = '/other-user-data';
        expect(queueDeps.dirPath).toBe(
            path.join('/other-user-data', 'pending-reports'),
        );
        mocks.userDataPath = '/mock-user-data';
    });

    test('a server that is away keeps the report, and sends nothing queued', async () => {
        mocks.fetchOnRelaySession.mockRejectedValue(
            new Error('getaddrinfo ENOTFOUND reports.example'),
        );

        const result = await handleLlmReportPost({ text: REPORT_TEXT });

        expect(result).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
            queued: true,
        });
        // The registry was read once more before giving up on it.
        expect(mocks.refreshLlmRegistry).toHaveBeenCalledTimes(1);
        expect(mocks.queueReportBody).toHaveBeenCalledTimes(1);
        const [body, queueDeps] = mocks.queueReportBody.mock.calls[0];
        expect(JSON.parse(body).prompt).toBe(REPORT_TEXT);
        expect(queueDeps.dirPath).toBe(
            path.join('/mock-user-data', 'pending-reports'),
        );
        expect(mocks.sendQueuedReports).not.toHaveBeenCalled();
    });

    test('with AI off nothing is sent, kept or read', async () => {
        mocks.isAiEnabled = false;

        expect(await handleLlmReportPost({ text: REPORT_TEXT })).toEqual({
            ok: false,
            reason: 'ai-off',
            detail: 'AI features are turned off in Settings',
        });
        expect(mocks.fetchOnRelaySession).not.toHaveBeenCalled();
        expect(mocks.refreshLlmRegistry).not.toHaveBeenCalled();
        expect(mocks.queueReportBody).not.toHaveBeenCalled();
    });

    test('a registry that shares no report server says so after a fresh read', async () => {
        mocks.servers = [];

        expect(await handleLlmReportPost({ text: REPORT_TEXT })).toEqual({
            ok: false,
            reason: 'no-server',
            detail: 'no report server is shared right now',
        });
        expect(mocks.refreshLlmRegistry).toHaveBeenCalledTimes(1);
        // "No server" is no outage: nothing is kept for it.
        expect(mocks.queueReportBody).not.toHaveBeenCalled();
    });
});

describe('initLlmReportQueue', () => {
    test('sends what was kept a minute after start, then every half hour', async () => {
        vi.useFakeTimers();

        initLlmReportQueue();

        expect(mocks.sendQueuedReports).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(60 * 1000);
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000 - 60 * 1000);
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(3);
        expect(mocks.sendQueuedReports.mock.calls[0][0].dirPath).toBe(
            path.join('/mock-user-data', 'pending-reports'),
        );
        vi.clearAllTimers();
    });
});

describe('what an address answers, at the edges', () => {
    function genDeps(value: Partial<LlmReportDepsType> = {}) {
        return {
            isAiEnabled: () => true,
            readReportServers: () => [genServer()],
            refreshRegistry: vi.fn(async () => ({})),
            fetch: vi.fn(async () => new Response('ok', { status: 200 })),
            ...value,
        } satisfies LlmReportDepsType;
    }

    test('an answer that breaks off is a server that took it', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                const body = new ReadableStream<Uint8Array>({
                    start(controller) {
                        controller.error(new Error('socket hang up'));
                    },
                });
                return new Response(body, { status: 200 });
            }),
        });

        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: true,
        });
    });

    test('an address that is no web address is not asked at all', async () => {
        const deps = genDeps({
            readReportServers: () => [
                genServer({ baseUrl: 'file:///C:/inbox' }),
            ],
        });

        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server has no usable address',
        });
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    test('once the whole send is over time, no other address is asked', async () => {
        const second = genServer({
            id: 'registry-second',
            baseUrl: 'https://second.example/v1',
        });
        // The first address takes 50 s to say no; that is past the 40 s
        // the whole send is given.
        const clock = [0, 0, 0, 50_000, 50_000, 50_000];
        const deps = genDeps({
            now: () => clock.shift() ?? 50_000,
            readReportServers: () => [genServer(), second],
            fetch: vi.fn(async () => new Response('busy', { status: 503 })),
        });

        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: false,
            reason: 'refused',
            detail: 'the report server answered 503',
        });
        expect(deps.fetch).toHaveBeenCalledTimes(1);
        expect(vi.mocked(deps.fetch).mock.calls[0][0]).toBe(
            'https://reports.example/v1',
        );
    });

    test('Stop pressed while the registry is read again ends it there', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => new Response('busy', { status: 503 })),
            refreshRegistry: vi.fn(async () => {
                cancelLlmReportPost('req-stop');
                return {};
            }),
        });

        expect(
            await runLlmReportPost(
                { text: REPORT_TEXT, requestId: 'req-stop' },
                deps,
            ),
        ).toEqual({ ok: false, reason: 'cancelled', detail: 'stopped' });
        // Nobody new is asked after the Stop.
        expect(deps.fetch).toHaveBeenCalledTimes(1);
    });
});
