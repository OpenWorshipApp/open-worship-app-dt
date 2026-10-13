import { beforeEach, describe, expect, it, vi } from 'vitest';

// The door's core takes its dependencies as an argument; the Electron wiring
// around it (through the relay's session) is stubbed only far enough to load.
vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }));
vi.mock('./ElectronSettingManager', () => ({
    default: { getInstance: vi.fn() },
}));
vi.mock('./aiHelpers', () => ({ checkIsAiEnabled: vi.fn(() => true) }));

import {
    cancelLlmReportPost,
    resetLlmReportForTests,
    runLlmReportPost,
    type LlmReportDepsType,
} from './llmReportHelpers';
import {
    REPORT_FILE_MAX_BYTES,
    REPORT_FILE_MAX_COUNT,
    REPORT_TEXT_MAX,
    type LlmReportFileType,
    type LlmReportServerType,
} from './customLlmProtocol';

const REPORT_TEXT = 'This is a problem report.\n\n# The screen went blank\n';
const FENCED_TEXT =
    'This is a problem report.\n\n' +
    '----- BEGIN REPORT OWA-261013-628c -----\n# The screen went blank\n' +
    '----- END REPORT OWA-261013-628c -----\n';

function genFile(value: Partial<LlmReportFileType> = {}) {
    return {
        name: 'notes.md',
        mimeType: 'text/markdown',
        // "# hi" and a line break
        data: 'IyBoaQo=',
        ...value,
    };
}

function genServer(value: Partial<LlmReportServerType> = {}) {
    return {
        id: 'registry-reporting',
        name: 'Report inbox',
        baseUrl: 'https://reports.trycloudflare.com/v1/',
        apiKey: 'sk-report',
        note: '',
        ...value,
    };
}

function genDeps(value: Partial<LlmReportDepsType> = {}) {
    const deps = {
        isAiEnabled: () => true,
        readReportServers: () => [genServer()],
        refreshRegistry: vi.fn(async () => {}),
        fetch: vi.fn(async (_url: string, _init: RequestInit) => {
            return new Response('thank you', { status: 200 });
        }),
        ...value,
    };
    return deps as LlmReportDepsType & {
        fetch: ReturnType<typeof vi.fn>;
        refreshRegistry: ReturnType<typeof vi.fn>;
    };
}

describe('runLlmReportPost', () => {
    beforeEach(() => {
        vi.useRealTimers();
        resetLlmReportForTests();
    });

    // The whole contract with a report server: one JSON object, the words
    // under `prompt` and the files under `attachments`.
    it('posts the report as JSON to the address the registry names, with its key', async () => {
        const deps = genDeps();
        const result = await runLlmReportPost({ text: REPORT_TEXT }, deps);
        expect(result).toEqual({ ok: true });
        expect(deps.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = deps.fetch.mock.calls[0] as any[];
        // The address as written, not a path under it.
        expect(url).toBe('https://reports.trycloudflare.com/v1');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({
            version: 1,
            prompt: REPORT_TEXT,
            // Always there, so whoever takes it reads one shape.
            attachments: [],
        });
        expect(init.headers).toEqual({
            'content-type': 'application/json; charset=utf-8',
            authorization: 'Bearer sk-report',
        });
        // The key goes to that host and no other.
        expect(init.redirect).toBe('manual');
        expect(init.credentials).toBe('omit');
        // It was taken: nothing is read again.
        expect(deps.refreshRegistry).not.toHaveBeenCalled();
    });

    // "accept json ... {"prompt":"...", "attachments":[...]} ... and accept
    // files like markdown pdf".
    it('sends the files with it, each named, typed by its name and in base64', async () => {
        const deps = genDeps();
        const picture = genFile({
            name: 'OWA-261013-628c.png',
            mimeType: 'whatever the window said',
            data: 'iVBORw0KGgo=',
        });
        const result = await runLlmReportPost(
            {
                text: FENCED_TEXT,
                files: [picture, genFile(), genFile({ name: 'order.PDF' })],
            },
            deps,
        );
        expect(result).toEqual({ ok: true });
        const [, init] = deps.fetch.mock.calls[0] as any[];
        expect(JSON.parse(init.body)).toEqual({
            version: 1,
            // The one the report names itself by.
            reference: 'OWA-261013-628c',
            prompt: FENCED_TEXT,
            attachments: [
                // The kind is read off the name in main.
                { ...picture, mimeType: 'image/png' },
                genFile(),
                {
                    ...genFile(),
                    name: 'order.PDF',
                    mimeType: 'application/pdf',
                },
            ],
        });
    });

    it('refuses files this app would not have sent, before anything is sent', async () => {
        const deps = genDeps();
        for (const files of [
            'a file',
            [genFile({ name: 'run-me.exe' })],
            [genFile({ name: 'page.html' })],
            [genFile({ name: '../../notes.md' })],
            [genFile({ name: 'C:\\notes.md' })],
            [genFile({ data: 'not base64!' })],
            [genFile({ data: '' })],
            [{ name: 'notes.md' }],
            [
                genFile({
                    data: 'A'.repeat(
                        Math.ceil(REPORT_FILE_MAX_BYTES / 3) * 4 + 4,
                    ),
                }),
            ],
            Array.from({ length: REPORT_FILE_MAX_COUNT + 1 }, () => {
                return genFile();
            }),
        ]) {
            expect(
                await runLlmReportPost(
                    { text: REPORT_TEXT, files } as any,
                    deps,
                ),
            ).toMatchObject({ ok: false, reason: 'not-allowed' });
        }
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    // The one refusal the window can act on: it sends the words alone.
    it('says so when a server finds it too large, whoever else was asked', async () => {
        const deps = genDeps({
            readReportServers: () => [
                genServer({ baseUrl: 'https://one.example.com/report' }),
                genServer({ baseUrl: 'https://two.example.com/report' }),
            ],
            fetch: vi.fn(async (url: string) => {
                return new Response('', {
                    status: url.includes('one.') ? 413 : 500,
                });
            }),
        });
        expect(
            await runLlmReportPost(
                { text: REPORT_TEXT, files: [genFile()] },
                deps,
            ),
        ).toEqual({
            ok: false,
            reason: 'too-large',
            detail: 'the report server said it is too large',
        });
        expect(deps.fetch).toHaveBeenCalledTimes(2);
    });

    it('sends no bearer for a server that asks for no key', async () => {
        const deps = genDeps({
            readReportServers: () => [genServer({ apiKey: '' })],
        });
        await runLlmReportPost({ text: REPORT_TEXT }, deps);
        const [, init] = deps.fetch.mock.calls[0] as any[];
        expect(init.headers.authorization).toBeUndefined();
    });

    it('says there is no report server when the registry shares none, after one fresh read', async () => {
        const deps = genDeps({ readReportServers: () => [] });
        const result = await runLlmReportPost({ text: REPORT_TEXT }, deps);
        expect(result).toMatchObject({ ok: false, reason: 'no-server' });
        expect(deps.refreshRegistry).toHaveBeenCalledTimes(1);
        expect(deps.fetch).not.toHaveBeenCalled();
    });

    // An app that never read the list, on a machine with no internet.
    it('says the list could not be read, not that nobody shares a server', async () => {
        const deps = genDeps({
            readReportServers: () => [],
            refreshRegistry: vi.fn(async () => {
                return { servers: [], error: 'the registry did not answer' };
            }),
        });
        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the list of report servers could not be read',
        });
    });

    // A registry entry mis-set onto an LLM server: it answers an unknown
    // POST with 200 and an error object, and kept nothing.
    it('does not call it sent when the answer itself says it was not kept', async () => {
        for (const answer of [
            '{"error":"Unexpected endpoint or method. (POST /v1)"}',
            '{"ok":false,"error":{"code":"inbox_full"}}',
        ]) {
            const deps = genDeps({
                fetch: vi.fn(async () => {
                    return new Response(answer, { status: 200 });
                }),
            });
            expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual(
                {
                    ok: false,
                    reason: 'refused',
                    detail: 'the report server did not keep it',
                },
            );
            resetLlmReportForTests();
        }
        // The inbox's own answer, an empty one and plain words are a yes.
        for (const answer of ['{"ok":true,"id":7,"isNew":true}', '', 'OK']) {
            const deps = genDeps({
                fetch: vi.fn(async () => {
                    return new Response(answer, { status: 200 });
                }),
            });
            expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual(
                { ok: true },
            );
            resetLlmReportForTests();
        }
    });

    // An app open since the morning holds the morning's tunnel address.
    it('reads the registry again when nothing took it, and tries only what is new', async () => {
        const old = genServer({ baseUrl: 'https://old.trycloudflare.com/v1' });
        const fresh = genServer({
            baseUrl: 'https://new.trycloudflare.com/v1',
        });
        let servers = [old];
        const deps = genDeps({
            readReportServers: () => servers,
            refreshRegistry: vi.fn(async () => {
                servers = [old, fresh];
            }),
            fetch: vi.fn(async (url: string) => {
                if (url.includes('old.')) {
                    throw new TypeError('getaddrinfo ENOTFOUND old.host');
                }
                return new Response(null, { status: 204 });
            }),
        });
        const result = await runLlmReportPost({ text: REPORT_TEXT }, deps);
        expect(result).toEqual({ ok: true });
        expect(
            deps.fetch.mock.calls.map((call: any[]) => {
                return call[0];
            }),
        ).toEqual([
            'https://old.trycloudflare.com/v1',
            'https://new.trycloudflare.com/v1',
        ]);
    });

    it('tries the next server when one does not take it', async () => {
        const deps = genDeps({
            readReportServers: () => [
                genServer({ baseUrl: 'https://one.example.com/report' }),
                genServer({ baseUrl: 'https://two.example.com/report' }),
            ],
            fetch: vi.fn(async (url: string) => {
                return new Response('', {
                    status: url.includes('one.') ? 503 : 200,
                });
            }),
        });
        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: true,
        });
        expect(deps.fetch).toHaveBeenCalledTimes(2);
    });

    // A window is never told where a shared server lives.
    it('says why in its own words, never the server’s or the address', async () => {
        const refused = await runLlmReportPost(
            { text: REPORT_TEXT },
            genDeps({
                fetch: vi.fn(async () => {
                    return new Response(
                        'see https://reports.trycloudflare.com/help',
                        { status: 500 },
                    );
                }),
            }),
        );
        expect(refused).toEqual({
            ok: false,
            reason: 'refused',
            detail: 'the report server answered 500',
        });
        const down = await runLlmReportPost(
            { text: REPORT_TEXT },
            genDeps({
                fetch: vi.fn(async () => {
                    throw new TypeError(
                        'getaddrinfo ENOTFOUND reports.trycloudflare.com',
                    );
                }),
            }),
        );
        expect(down).toEqual({
            ok: false,
            reason: 'unreachable',
            detail: 'the report server did not answer',
        });
        const moved = await runLlmReportPost(
            { text: REPORT_TEXT },
            genDeps({
                fetch: vi.fn(async () => {
                    return new Response('', {
                        status: 302,
                        headers: { location: 'https://elsewhere.example' },
                    });
                }),
            }),
        );
        expect(moved).toMatchObject({ ok: false, reason: 'refused' });
        for (const result of [refused, down, moved]) {
            expect(JSON.stringify(result)).not.toContain('trycloudflare');
            expect(JSON.stringify(result)).not.toContain('elsewhere');
        }
    });

    it('refuses what is not a report before anything is read or sent', async () => {
        const deps = genDeps();
        for (const text of [
            '',
            '   ',
            undefined,
            42,
            'x'.repeat(REPORT_TEXT_MAX + 1),
        ]) {
            expect(await runLlmReportPost({ text } as any, deps)).toMatchObject(
                { ok: false, reason: 'not-allowed' },
            );
        }
        expect(
            await runLlmReportPost(
                { text: REPORT_TEXT, requestId: 'not an id!' },
                deps,
            ),
        ).toMatchObject({ ok: false, reason: 'not-allowed' });
        expect(await runLlmReportPost(undefined as any, deps)).toMatchObject({
            ok: false,
            reason: 'not-allowed',
        });
        expect(
            await runLlmReportPost(
                { text: REPORT_TEXT },
                genDeps({ isAiEnabled: () => false }),
            ),
        ).toMatchObject({ ok: false, reason: 'ai-off' });
        expect(deps.fetch).not.toHaveBeenCalled();
        expect(deps.refreshRegistry).not.toHaveBeenCalled();
    });

    // A loop must not flood one admin's machine.
    it('takes five in ten minutes and refuses the sixth until the window has passed', async () => {
        let now = 1_000_000;
        const deps = genDeps({ now: () => now });
        for (let index = 0; index < 5; index++) {
            expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual(
                { ok: true },
            );
        }
        expect(
            await runLlmReportPost({ text: REPORT_TEXT }, deps),
        ).toMatchObject({ ok: false, reason: 'too-many' });
        expect(deps.fetch).toHaveBeenCalledTimes(5);
        now += 10 * 60 * 1000 + 1;
        expect(await runLlmReportPost({ text: REPORT_TEXT }, deps)).toEqual({
            ok: true,
        });
    });

    it('gives an address ten seconds and then says it took too long', async () => {
        vi.useFakeTimers();
        const deps = genDeps({
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    });
                });
            }),
        });
        const posting = runLlmReportPost({ text: REPORT_TEXT }, deps);
        await vi.advanceTimersByTimeAsync(10 * 1000);
        expect(await posting).toEqual({
            ok: false,
            reason: 'timeout',
            detail: 'the report server took too long to answer',
        });
    });

    // A picture and a PDF over the uplink of a church hall.
    it('gives a report with files the time a slow line needs to carry them', async () => {
        vi.useFakeTimers();
        const deps = genDeps({
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    });
                });
            }),
        });
        // 3 MB of file: 4 MB of base64, about two minutes at 32 KB a second.
        const posting = runLlmReportPost(
            {
                text: REPORT_TEXT,
                files: [
                    genFile({
                        name: 'order.pdf',
                        data: 'A'.repeat(4 * 1024 * 1024),
                    }),
                ],
            },
            deps,
        );
        let isOver = false;
        void posting.then(() => {
            isOver = true;
        });
        await vi.advanceTimersByTimeAsync(60 * 1000);
        expect(isOver).toBe(false);
        // ...and not for ever: three minutes on top at the most.
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
        expect(await posting).toMatchObject({ ok: false, reason: 'timeout' });
    });

    it('stops the sending, and asks nobody else, when the window says Stop', async () => {
        const deps = genDeps({
            readReportServers: () => [
                genServer({ baseUrl: 'https://one.example.com/report' }),
                genServer({ baseUrl: 'https://two.example.com/report' }),
            ],
            fetch: vi.fn((_url: string, init: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    });
                });
            }),
        });
        const posting = runLlmReportPost(
            { text: REPORT_TEXT, requestId: 'report-1' },
            deps,
        );
        // Let the first address be asked before Stop arrives.
        await Promise.resolve();
        cancelLlmReportPost('report-1');
        expect(await posting).toMatchObject({
            ok: false,
            reason: 'cancelled',
        });
        expect(deps.fetch).toHaveBeenCalledTimes(1);
        expect(deps.refreshRegistry).not.toHaveBeenCalled();
        // A Stop for a post that is over, or that never was, is nothing.
        cancelLlmReportPost('report-1');
        cancelLlmReportPost(undefined);
    });
});
