import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The report door as main wires it: the registry it reads, the relay session
// it posts on, the queue a report waits in, and the timers that empty it.
// `llmReportHelpers.test.ts` covers the core through its own deps.

const mocks = vi.hoisted(() => ({
    getPath: vi.fn(),
    checkIsAiEnabled: vi.fn(),
    fetchOnRelaySession: vi.fn(),
    getLlmReportServers: vi.fn(),
    refreshLlmRegistry: vi.fn(),
    queueReportBody: vi.fn(),
    sendQueuedReports: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getPath: mocks.getPath } }));
vi.mock('./aiHelpers', () => ({ checkIsAiEnabled: mocks.checkIsAiEnabled }));
vi.mock('./customLlmRelayHelpers', () => ({
    fetchOnRelaySession: mocks.fetchOnRelaySession,
}));
vi.mock('./llmRegistryHelpers', () => ({
    getLlmReportServers: mocks.getLlmReportServers,
    refreshLlmRegistry: mocks.refreshLlmRegistry,
}));
vi.mock('./llmReportQueueHelpers', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    queueReportBody: mocks.queueReportBody,
    sendQueuedReports: mocks.sendQueuedReports,
}));

import {
    cancelLlmReportPost,
    handleLlmReportPost,
    initLlmReportQueue,
    resetLlmReportForTests,
    runLlmReportPost,
    type LlmReportDepsType,
} from './llmReportHelpers';
import {
    REPORT_QUEUE_FIRST_TRY_DELAY_MILLISECONDS,
    REPORT_QUEUE_RETRY_EVERY_MILLISECONDS,
} from './llmReportQueueHelpers';

const REPORT_TEXT = 'This is a problem report.\n\n# The screen went blank\n';

function genServer(value: Record<string, unknown> = {}) {
    return {
        id: 'registry-reporting',
        name: 'Report inbox',
        baseUrl: 'https://reports.example.com/inbox',
        apiKey: 'sk-report',
        note: '',
        ...value,
    } as any;
}

function genDeps(value: Partial<LlmReportDepsType> = {}) {
    return {
        isAiEnabled: () => true,
        readReportServers: () => [genServer()],
        refreshRegistry: vi.fn(async () => ({})),
        fetch: vi.fn(async () => new Response('ok', { status: 200 })),
        ...value,
    } as LlmReportDepsType & {
        fetch: ReturnType<typeof vi.fn>;
        refreshRegistry: ReturnType<typeof vi.fn>;
    };
}

beforeEach(() => {
    vi.useRealTimers();
    resetLlmReportForTests();
    mocks.getPath.mockReturnValue('/user-data');
    mocks.checkIsAiEnabled.mockReturnValue(true);
    mocks.getLlmReportServers.mockReturnValue([genServer()]);
    mocks.refreshLlmRegistry.mockResolvedValue({ error: null });
    mocks.fetchOnRelaySession.mockImplementation(async () => {
        return new Response('{"ok":true}', { status: 200 });
    });
    mocks.queueReportBody.mockResolvedValue(true);
    mocks.sendQueuedReports.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('the core, on edges the main suite does not reach', () => {
    it('calls it sent when the answer cannot be read to the end', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => {
                const stream = new ReadableStream<Uint8Array>({
                    start(controller) {
                        controller.error(new Error('connection reset'));
                    },
                });
                return new Response(stream, { status: 200 });
            }),
        });
        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: true,
        });
    });

    it('asks no address it cannot post to, and says the server is unusable', async () => {
        const deps = genDeps({
            readReportServers: () => [genServer({ baseUrl: 'not an address' })],
        });
        const result = await runLlmReportPost({ text: REPORT_TEXT }, deps);
        expect(result).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server has no usable address',
        });
        expect(deps.fetch).not.toHaveBeenCalled();
        // The list was read again once before giving up.
        expect(deps.refreshRegistry).toHaveBeenCalledTimes(1);
    });

    it('asks no further address once the whole time is spent', async () => {
        let clock = 0;
        const deps = genDeps({
            now: () => clock,
            readReportServers: () => [
                genServer({ baseUrl: 'https://first.example.com' }),
                genServer({ baseUrl: 'https://second.example.com' }),
            ],
            fetch: vi.fn(async () => {
                // The first address took the whole allowance to say no.
                clock += 10 * 60 * 1000;
                return new Response('', { status: 500 });
            }),
        });
        const result = await runLlmReportPost({ text: REPORT_TEXT }, deps);
        expect(deps.fetch).toHaveBeenCalledTimes(1);
        expect(deps.fetch.mock.calls[0][0]).toBe('https://first.example.com');
        expect(result).toEqual({
            ok: false,
            reason: 'refused',
            detail: 'the report server answered 500',
        });
    });

    it('stops after the fresh read when Stop came while it was read', async () => {
        const deps = genDeps({
            fetch: vi.fn(async () => new Response('', { status: 502 })),
            refreshRegistry: vi.fn(async () => {
                cancelLlmReportPost('report-1');
                return {};
            }),
            readReportServers: vi.fn(() => [genServer()]),
        });
        const result = await runLlmReportPost(
            { text: REPORT_TEXT, requestId: 'report-1' },
            deps,
        );
        expect(result).toEqual({
            ok: false,
            reason: 'cancelled',
            detail: 'stopped',
        });
        // The list read afresh was never walked.
        expect(deps.readReportServers).toHaveBeenCalledTimes(1);
    });
});

describe('the IPC door', () => {
    it('posts on the relay session to the registry entry, then sends what was kept', async () => {
        const result = await handleLlmReportPost({ text: REPORT_TEXT });
        expect(result).toEqual({ ok: true });
        expect(mocks.fetchOnRelaySession).toHaveBeenCalledTimes(1);
        const [url, init] = mocks.fetchOnRelaySession.mock.calls[0];
        expect(url).toBe('https://reports.example.com/inbox');
        expect(init.headers.authorization).toBe('Bearer sk-report');
        expect(JSON.parse(init.body).prompt).toBe(REPORT_TEXT);
        expect(mocks.refreshLlmRegistry).not.toHaveBeenCalled();

        // The server is back: the queue is emptied, into the app's own
        // data folder, through the same door.
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(1);
        const queueDeps = mocks.sendQueuedReports.mock.calls[0][0];
        expect(queueDeps.dirPath).toBe(
            path.join('/user-data', 'pending-reports'),
        );
        expect(mocks.getPath).toHaveBeenCalledWith('userData');
        expect(queueDeps.isAiEnabled()).toBe(true);
        mocks.checkIsAiEnabled.mockReturnValue(false);
        expect(queueDeps.isAiEnabled()).toBe(false);
        expect(await queueDeps.deliver('{"prompt":"kept"}')).toEqual({
            ok: true,
        });
        expect(mocks.fetchOnRelaySession).toHaveBeenCalledTimes(2);
        expect(mocks.fetchOnRelaySession.mock.calls[1][1].body).toBe(
            '{"prompt":"kept"}',
        );
    });

    it('keeps a report the server was away for, and sends nothing kept', async () => {
        mocks.fetchOnRelaySession.mockRejectedValue(new Error('ECONNREFUSED'));
        const result = await handleLlmReportPost({ text: REPORT_TEXT });
        expect(result).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
            queued: true,
        });
        // The registry was read again through its own helper before that.
        expect(mocks.refreshLlmRegistry).toHaveBeenCalledTimes(1);
        expect(mocks.queueReportBody).toHaveBeenCalledTimes(1);
        const [body, queueDeps] = mocks.queueReportBody.mock.calls[0];
        expect(JSON.parse(body).prompt).toBe(REPORT_TEXT);
        expect(queueDeps.dirPath).toBe(
            path.join('/user-data', 'pending-reports'),
        );
        expect(mocks.sendQueuedReports).not.toHaveBeenCalled();
    });

    it('refuses with AI switched off and sends nothing', async () => {
        mocks.checkIsAiEnabled.mockReturnValue(false);
        expect(await handleLlmReportPost({ text: REPORT_TEXT })).toMatchObject({
            ok: false,
            reason: 'ai-off',
        });
        expect(mocks.fetchOnRelaySession).not.toHaveBeenCalled();
        expect(mocks.sendQueuedReports).not.toHaveBeenCalled();
    });
});

describe('the queue timers', () => {
    it('tries what was kept a minute after start, then every half hour', async () => {
        vi.useFakeTimers();
        initLlmReportQueue();
        expect(mocks.sendQueuedReports).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(
            REPORT_QUEUE_FIRST_TRY_DELAY_MILLISECONDS,
        );
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(1);
        expect(mocks.sendQueuedReports.mock.calls[0][0].dirPath).toBe(
            path.join('/user-data', 'pending-reports'),
        );

        await vi.advanceTimersByTimeAsync(
            REPORT_QUEUE_RETRY_EVERY_MILLISECONDS -
                REPORT_QUEUE_FIRST_TRY_DELAY_MILLISECONDS,
        );
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(
            REPORT_QUEUE_RETRY_EVERY_MILLISECONDS,
        );
        expect(mocks.sendQueuedReports).toHaveBeenCalledTimes(3);
    });
});
