import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ALLOWED_CALLS,
    CHECK_AGENT,
    DOOR_HEADER,
    checkIsPublishOwed,
    checkIsTunnelAnswering,
    REPORT_PATH,
    genDefaultId,
    genRegistryServer,
    genReportRegistryServer,
    getPlatformDirName,
    listCloudflaredCandidates,
    mergeRegistry,
    openDoor,
    openTunnel,
    readArgs,
    readKey,
    readModels,
} from './llm-tunnel.mjs';
import { findRegistryProblems } from './s3-push-llm-registry.mjs';

const KEY = 'sk-test-key';
const TUNNEL_URL = 'https://quiet-river-1234.trycloudflare.com';

let tempDir;
const openServers = [];

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-tunnel-test-'));
});

afterEach(async () => {
    vi.useRealTimers();
    for (const server of openServers.splice(0)) {
        server.closeAllConnections();
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
});

function listen(handler) {
    const server = http.createServer(handler);
    openServers.push(server);
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

// An LLM server that remembers what reached it.
async function openFakeLlm(handler) {
    const seen = [];
    const server = await listen((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            seen.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body,
            });
            handler(req, res);
        });
    });
    return { port: server.address().port, seen, server };
}

async function openTestDoor(targetPort, key = KEY) {
    const door = await openDoor(targetPort, key, () => {});
    openServers.push(door);
    return `http://127.0.0.1:${door.address().port}`;
}

function answerJson(res, data) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
}

describe('readArgs', () => {
    it('starts from the defaults', () => {
        expect(readArgs([])).toMatchObject({
            port: 1234,
            host: '127.0.0.1',
            // By default a tunnel is known by the server it carries.
            id: 'llm-1234',
            isKeyWanted: true,
            isNewKey: false,
            checkSeconds: 60,
            isPublishing: false,
        });
    });

    it('reads every option', () => {
        expect(
            readArgs([
                '--port',
                '11434',
                '--host',
                'gpu-box.local',
                '--name',
                'Church Ollama',
                '--id',
                'church-ollama',
                '--cloudflared',
                '/opt/cloudflared',
                '--check',
                '120',
                '--out',
                '/tmp/out',
                '--log',
                '/tmp/tunnel.log',
                '--new-key',
                '--no-key',
                '--publish',
            ]),
        ).toEqual({
            port: 11434,
            host: 'gpu-box.local',
            name: 'Church Ollama',
            id: 'church-ollama',
            isKeyWanted: false,
            isNewKey: true,
            cloudflared: '/opt/cloudflared',
            checkSeconds: 120,
            isPublishing: true,
            outDir: '/tmp/out',
            logFile: '/tmp/tunnel.log',
            isReports: false,
            isWithReports: false,
            dbFile: '',
        });
    });

    // --with-reports: the tunnel to an LLM server takes reports as well.
    it('lets a tunnel to an LLM server take reports too, at its own address', async () => {
        const args = readArgs(['--port', '1237', '--with-reports']);
        expect(args).toMatchObject({
            isWithReports: true,
            isReports: false,
            // Still the LLM server's tunnel: its own name and id.
            name: 'Church LM Studio',
            id: 'llm-1237',
        });
        expect(
            readArgs(['--with-reports', '--db', '/data/in.sqlite']).dbFile,
        ).toBe('/data/in.sqlite');
        // The inbox alone, or beside an LLM server: not both.
        expect(readArgs(['--with-reports', '--reports'])).toBeNull();
        const models = [{ model: 'qwen/qwen3.5-9b', name: 'Qwen 3.5 9B' }];
        const entry = genRegistryServer(
            args,
            `${TUNNEL_URL}/v1`,
            KEY,
            'LM Studio',
            models,
        );
        // ONE entry, marked: an assistant, and where reports are posted.
        expect(entry).toMatchObject({
            id: 'llm-1237',
            baseUrl: `${TUNNEL_URL}/v1`,
            models,
            isAcceptingReport: true,
        });
        expect(
            findRegistryProblems(
                mergeRegistry({}, entry, 'llm-1237', '2026-10-13'),
            ),
        ).toEqual([]);
        // Without the option the entry is as it always was.
        expect(
            genRegistryServer(
                readArgs([]),
                `${TUNNEL_URL}/v1`,
                KEY,
                'x',
                models,
            ),
        ).not.toHaveProperty('isAcceptingReport');
    });

    it('keeps a report posted to its own address and passes the chat calls on', async () => {
        const { openReportTaker } = await import('./llm-report-inbox.mjs');
        const upstreamCalls = [];
        const upstream = http.createServer((req, res) => {
            upstreamCalls.push(`${req.method} ${req.url}`);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"data":[]}');
        });
        await new Promise((resolve) => {
            upstream.listen(0, '127.0.0.1', resolve);
        });
        openServers.push(upstream);
        const lines = [];
        const say = (text) => {
            lines.push(text);
        };
        const taker = await openReportTaker({ dbFile: ':memory:', say });
        const door = await openDoor(
            upstream.address().port,
            KEY,
            say,
            '127.0.0.1',
            taker,
        );
        openServers.push(door);
        const base = `http://127.0.0.1:${door.address().port}/v1`;
        const auth = { authorization: `Bearer ${KEY}` };
        // The app's report: a POST of JSON to the base address itself.
        const report = await fetch(base, {
            method: 'POST',
            headers: {
                ...auth,
                'content-type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                version: 1,
                prompt: '----- BEGIN REPORT OWA-261013-127b -----\n# Projector blank\n',
                attachments: [],
            }),
        });
        expect(report.status).toBe(200);
        expect(report.headers.get(DOOR_HEADER)).toBe('1');
        expect(await report.json()).toEqual({
            ok: true,
            id: 1,
            isNew: true,
            files: 0,
            skipped: [],
        });
        expect(taker.store.find('OWA-261013-127b').title).toBe(
            'Projector blank',
        );
        // It never reached the LLM server.
        expect(upstreamCalls).toEqual([]);
        // The key is asked for first, as for every call.
        expect(
            (await fetch(base, { method: 'POST', body: 'no key' })).status,
        ).toBe(401);
        expect(taker.store.count()).toBe(1);
        // The chat calls go where they always went.
        expect((await fetch(`${base}/models`, { headers: auth })).status).toBe(
            200,
        );
        expect(upstreamCalls).toEqual(['GET /v1/models']);
        // The tunnel's own look at itself leaves no line; a chat call or a
        // report that only CALLS itself the look is logged like any other.
        lines.length = 0;
        const look = { ...auth, 'user-agent': CHECK_AGENT };
        await fetch(`${base}/models`, { headers: look });
        expect(lines).toEqual([]);
        await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: look,
            body: '{}',
        });
        await fetch(base, { method: 'POST', headers: look, body: 'a report' });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('POST /v1/chat/completions  200');
        expect(lines[1]).toContain('POST /v1  200');
        taker.store.close();
    });

    it('opens no report call on a tunnel started without the option', async () => {
        const upstream = http.createServer((_req, res) => {
            res.writeHead(200);
            res.end('{}');
        });
        await new Promise((resolve) => {
            upstream.listen(0, '127.0.0.1', resolve);
        });
        openServers.push(upstream);
        const door = await openDoor(upstream.address().port, KEY, () => {});
        openServers.push(door);
        const response = await fetch(
            `http://127.0.0.1:${door.address().port}/v1`,
            {
                method: 'POST',
                headers: { authorization: `Bearer ${KEY}` },
                body: 'a report',
            },
        );
        expect(response.status).toBe(404);
    });

    // --reports: the door is the report inbox, not an LLM server.
    it('carries the report inbox under a name and an id of its own', () => {
        expect(readArgs(['--reports'])).toMatchObject({
            isReports: true,
            dbFile: '',
            name: 'Report inbox',
            id: 'reports',
        });
        expect(
            readArgs([
                '--reports',
                '--db',
                '/data/inbox.sqlite',
                '--name',
                'Church reports',
                '--id',
                'church-reports',
                '--publish',
            ]),
        ).toMatchObject({
            isReports: true,
            dbFile: '/data/inbox.sqlite',
            name: 'Church reports',
            id: 'church-reports',
            isPublishing: true,
        });
        // A tunnel to an LLM server keeps its own defaults.
        expect(readArgs([])).toMatchObject({
            isReports: false,
            name: 'Church LM Studio',
        });
        // The file is the inbox's, and has to be named.
        expect(readArgs(['--db', '/data/inbox.sqlite'])).toBeNull();
        expect(readArgs(['--reports', '--db'])).toBeNull();
    });

    it('names the inbox in the registry as an entry that takes reports', () => {
        const entry = genReportRegistryServer(
            readArgs(['--reports']),
            `${TUNNEL_URL}${REPORT_PATH}`,
            KEY,
        );
        expect(entry).toEqual({
            id: 'reports',
            name: 'Report inbox',
            baseUrl: 'https://quiet-river-1234.trycloudflare.com/report',
            apiKey: KEY,
            isAcceptingReport: true,
            note: expect.any(String),
        });
        // No models, and still one the app -- and the publisher -- takes.
        expect(
            findRegistryProblems(
                mergeRegistry({}, entry, 'reports', '2026-10-13'),
            ),
        ).toEqual([]);
    });

    it('gives each server an id of its own, so two tunnels are two entries', () => {
        expect(genDefaultId('127.0.0.1', 1234)).toBe('llm-1234');
        expect(genDefaultId('127.0.0.1', 11434)).toBe('llm-11434');
        expect(genDefaultId('gpu-box.local', 1234)).toBe(
            'llm-gpu-box-local-1234',
        );
        expect(readArgs(['--port', '11434']).id).toBe('llm-11434');
        expect(readArgs(['--host', 'gpu-box.local']).id).toBe(
            'llm-gpu-box-local-1234',
        );
        expect(readArgs(['--port', '11434', '--id', 'mine']).id).toBe('mine');
    });

    it('refuses what it cannot read', () => {
        expect(readArgs(['--what'])).toBeNull();
        expect(readArgs(['--port', '0'])).toBeNull();
        expect(readArgs(['--port', 'abc'])).toBeNull();
        expect(readArgs(['--check', '-1'])).toBeNull();
        // A name or an address, never a URL or a sentence.
        expect(readArgs(['--host', 'http://gpu-box'])).toBeNull();
        expect(readArgs(['--host', 'the gpu box'])).toBeNull();
        expect(readArgs(['--host'])).toBeNull();
        // The registry takes a slug id and a name of sixty characters.
        expect(readArgs(['--id', 'not a slug'])).toBeNull();
        expect(readArgs(['--name', 'x'.repeat(61)])).toBeNull();
    });

    it('never looks more often than every ten seconds, and 0 is never', () => {
        expect(readArgs(['--check', '3']).checkSeconds).toBe(10);
        expect(readArgs(['--check', '0']).checkSeconds).toBe(0);
    });
});

describe('where cloudflared is looked for', () => {
    it("names a computer the way the app's packs do", () => {
        expect(getPlatformDirName('win32', 'x64')).toBe('win');
        expect(getPlatformDirName('win32', 'arm64')).toBe('win-arm64');
        expect(getPlatformDirName('darwin', 'arm64')).toBe('mac');
        expect(getPlatformDirName('darwin', 'x64')).toBe('mac-int');
        expect(getPlatformDirName('linux', 'x64')).toBe('linux');
        expect(getPlatformDirName('linux', 'arm64')).toBe('linux-arm64');
    });

    it('asks in order: the option, the variable, beside the script, the pack, the repo, PATH', () => {
        const scriptDir = path.join(tempDir, 'extra-work', 'local-llm');
        const repoDir = path.join(
            tempDir,
            'extra-work',
            'experiment-building',
            'linux',
        );
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.mkdirSync(repoDir, { recursive: true });
        fs.writeFileSync(path.join(repoDir, 'cloudflared-2026.9.3-amd64'), '');
        fs.writeFileSync(path.join(repoDir, 'yt-dlp'), '');
        const home = path.join(tempDir, 'home');
        expect(
            listCloudflaredCandidates('/asked/cloudflared', {
                platform: 'linux',
                arch: 'x64',
                env: {
                    CLOUDFLARED: '/env/cloudflared',
                    PATH: ['/usr/bin', '/usr/local/bin'].join(path.delimiter),
                },
                home,
                scriptDir,
            }),
        ).toEqual([
            '/asked/cloudflared',
            '/env/cloudflared',
            path.join(scriptDir, 'cloudflared'),
            path.join(
                home,
                '.config',
                'open-worship-app',
                'extra-bin',
                'linux',
                'cloudflared',
                'cloudflared',
            ),
            path.join(
                home,
                '.config',
                'open-worship-app-dev',
                'extra-bin',
                'linux',
                'cloudflared',
                'cloudflared',
            ),
            path.join(repoDir, 'cloudflared-2026.9.3-amd64'),
            path.join('/usr/bin', 'cloudflared'),
            path.join('/usr/local/bin', 'cloudflared'),
        ]);
    });

    it('looks for an .exe on Windows and under Application Support on a Mac', () => {
        const windows = listCloudflaredCandidates('', {
            platform: 'win32',
            arch: 'arm64',
            env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
            home: 'C:\\Users\\me',
            scriptDir: tempDir,
        });
        expect(windows[0]).toBe(path.join(tempDir, 'cloudflared.exe'));
        expect(windows[1]).toBe(
            path.join(
                'C:\\Users\\me\\AppData\\Roaming',
                'open-worship-app',
                'extra-bin',
                'win-arm64',
                'cloudflared',
                'cloudflared.exe',
            ),
        );
        const mac = listCloudflaredCandidates('', {
            platform: 'darwin',
            arch: 'x64',
            env: {},
            home: '/Users/me',
            scriptDir: tempDir,
        });
        expect(mac[1]).toBe(
            path.join(
                '/Users/me',
                'Library',
                'Application Support',
                'open-worship-app',
                'extra-bin',
                'mac-int',
                'cloudflared',
                'cloudflared',
            ),
        );
    });
});

describe('the key', () => {
    it('is made once and kept', () => {
        const keyFile = path.join(tempDir, 'tunnel-key.txt');
        const key = readKey(false, keyFile);
        expect(key).toMatch(/^sk-[0-9a-f]{40}$/);
        expect(readKey(false, keyFile)).toBe(key);
        expect(fs.readFileSync(keyFile, 'utf8')).toBe(`${key}\n`);
    });

    it('is replaced when a new one is asked for', () => {
        const keyFile = path.join(tempDir, 'tunnel-key.txt');
        const key = readKey(false, keyFile);
        const newKey = readKey(true, keyFile);
        expect(newKey).not.toBe(key);
        expect(readKey(false, keyFile)).toBe(newKey);
    });
});

describe('the door', () => {
    it('answers 401 to every path without the key, and says it is the door', async () => {
        const llm = await openFakeLlm((_req, res) => {
            answerJson(res, { data: [] });
        });
        const door = await openTestDoor(llm.port);
        for (const [headers, route] of [
            [{}, '/v1/models'],
            [{ authorization: 'Bearer wrong' }, '/v1/models'],
            [{ authorization: KEY }, '/v1/models'],
            [{}, '/api/v1/models/load'],
        ]) {
            const response = await fetch(`${door}${route}`, { headers });
            expect(response.status).toBe(401);
            expect(response.headers.get(DOOR_HEADER)).toBe('1');
            expect((await response.json()).error.code).toBe('invalid_api_key');
        }
        expect(llm.seen).toEqual([]);
    });

    it('passes on only the calls a chat client makes', async () => {
        const llm = await openFakeLlm((_req, res) => {
            answerJson(res, { ok: true });
        });
        const door = await openTestDoor(llm.port);
        const headers = { authorization: `Bearer ${KEY}` };
        for (const [method, route] of [
            ['POST', '/api/v1/models/load'],
            ['POST', '/api/v1/models/unload'],
            ['DELETE', '/v1/models'],
            ['POST', '/v1/models'],
            ['GET', '/v1/chat/completions'],
            ['GET', '/'],
            ['GET', '/v1/models/../../api/v1/models/load'],
        ]) {
            const response = await fetch(`${door}${route}`, {
                method,
                headers,
            });
            expect([method, route, response.status]).toEqual([
                method,
                route,
                404,
            ]);
            await response.arrayBuffer();
        }
        expect(llm.seen).toEqual([]);
        for (const [method, route] of ALLOWED_CALLS) {
            const response = await fetch(`${door}${route}`, {
                method,
                headers,
                body: method === 'POST' ? '{}' : undefined,
            });
            expect([method, route, response.status]).toEqual([
                method,
                route,
                200,
            ]);
            expect(response.headers.get(DOOR_HEADER)).toBe('1');
            await response.arrayBuffer();
        }
        expect(
            llm.seen.map((one) => {
                return [one.method, one.url];
            }),
        ).toEqual(ALLOWED_CALLS);
    });

    it('keeps its key from the server and carries the question through', async () => {
        const llm = await openFakeLlm((_req, res) => {
            answerJson(res, { choices: [] });
        });
        const door = await openTestDoor(llm.port);
        const body = JSON.stringify({ model: 'm', messages: [] });
        const response = await fetch(`${door}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${KEY}`,
                'content-type': 'application/json',
            },
            body,
        });
        expect(await response.json()).toEqual({ choices: [] });
        expect(llm.seen).toHaveLength(1);
        expect(llm.seen[0].body).toBe(body);
        expect(llm.seen[0].headers.authorization).toBeUndefined();
        expect(llm.seen[0].headers['content-type']).toBe('application/json');
        expect(llm.seen[0].headers.host).toBe(`localhost:${llm.port}`);
    });

    it("with no key of its own passes the server's key on", async () => {
        const llm = await openFakeLlm((_req, res) => {
            answerJson(res, { data: [] });
        });
        const door = await openTestDoor(llm.port, '');
        const response = await fetch(`${door}/v1/models`, {
            headers: { authorization: 'Bearer the-servers-own' },
        });
        expect(response.status).toBe(200);
        expect(llm.seen[0].headers.authorization).toBe(
            'Bearer the-servers-own',
        );
    });

    it('lets a streamed answer out as it is written, not when it ends', async () => {
        let finish = () => {};
        const llm = await openFakeLlm((_req, res) => {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            res.write('data: one\n\n');
            finish = () => {
                res.end('data: two\n\n');
            };
        });
        const door = await openTestDoor(llm.port);
        const response = await fetch(`${door}/v1/chat/completions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${KEY}` },
            body: '{}',
        });
        const reader = response.body.getReader();
        const first = await reader.read();
        // The server has not finished: this chunk did not wait for it.
        expect(new TextDecoder().decode(first.value)).toBe('data: one\n\n');
        finish();
        const second = await reader.read();
        expect(new TextDecoder().decode(second.value)).toBe('data: two\n\n');
        expect((await reader.read()).done).toBe(true);
    });

    it('stops the server writing when the visitor leaves', async () => {
        let isAborted = false;
        const llm = await openFakeLlm((req, res) => {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            res.write('data: one\n\n');
            res.on('close', () => {
                isAborted = !res.writableEnded;
            });
        });
        const door = await openTestDoor(llm.port);
        const controller = new AbortController();
        const response = await fetch(`${door}/v1/chat/completions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${KEY}` },
            body: '{}',
            signal: controller.signal,
        });
        await response.body.getReader().read();
        controller.abort();
        await vi.waitFor(() => {
            expect(isAborted).toBe(true);
        });
    });

    it('says so itself when the LLM server is off', async () => {
        const llm = await openFakeLlm(() => {});
        const door = await openTestDoor(llm.port);
        llm.server.closeAllConnections();
        await new Promise((resolve) => {
            llm.server.close(resolve);
        });
        const response = await fetch(`${door}/v1/models`, {
            headers: { authorization: `Bearer ${KEY}` },
        });
        expect(response.status).toBe(502);
        expect(response.headers.get(DOOR_HEADER)).toBe('1');
        expect((await response.json()).error.code).toBe('server_unreachable');
    });
});

describe('readModels', () => {
    it("reads LM Studio's own list: chat models, their names, who sees pictures", async () => {
        const llm = await openFakeLlm((req, res) => {
            answerJson(res, {
                models: [
                    {
                        type: 'llm',
                        key: 'qwen/qwen3.5-9b',
                        display_name: 'Qwen 3.5 9B',
                        capabilities: { vision: true },
                    },
                    { type: 'llm', key: 'plain/model' },
                    { type: 'embedding', key: 'text-embedding-nomic' },
                ],
            });
        });
        expect(await readModels(llm.port)).toEqual({
            kind: 'LM Studio',
            models: [
                {
                    model: 'qwen/qwen3.5-9b',
                    name: 'Qwen 3.5 9B',
                    canSeeImages: true,
                },
                {
                    model: 'plain/model',
                    name: 'plain/model',
                    canSeeImages: false,
                },
            ],
        });
    });

    it('falls back to the ids any OpenAI-compatible server lists', async () => {
        const llm = await openFakeLlm((req, res) => {
            if (req.url === '/v1/models') {
                answerJson(res, {
                    data: [{ id: 'qwen3:4b' }, { id: 'nomic-embed-text' }],
                });
                return;
            }
            res.writeHead(404);
            res.end('404 page not found');
        });
        expect(await readModels(llm.port)).toEqual({
            kind: 'Local LLM server',
            models: [
                { model: 'qwen3:4b', name: 'qwen3:4b', canSeeImages: false },
            ],
        });
    });

    it('rejects when nothing answers on the port', async () => {
        const llm = await openFakeLlm(() => {});
        llm.server.closeAllConnections();
        await new Promise((resolve) => {
            llm.server.close(resolve);
        });
        await expect(readModels(llm.port)).rejects.toThrow();
    });
});

function genFakeChild(pid) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.isKilled = false;
    child.kill = () => {
        child.isKilled = true;
        child.exitCode = 0;
    };
    return child;
}

// cloudflared and Cloudflare's DNS, both pretended.
function openFakeTunnel(overrides = {}) {
    const children = [];
    const calls = { up: [], down: 0, failed: [] };
    const pidFile = path.join(tempDir, 'tunnel-cloudflared.pid');
    const tunnel = openTunnel({
        cloudflared: '/bin/cloudflared',
        doorPort: 4567,
        onUp: (url) => {
            calls.up.push(url);
        },
        onDown: () => {
            calls.down++;
        },
        onFailed: (error) => {
            calls.failed.push(error.message);
        },
        say: () => {},
        spawnChild: (file, args) => {
            const child = genFakeChild(1000 + children.length);
            child.spawnedWith = [file, args];
            children.push(child);
            return child;
        },
        fetchUrl: async () => {
            return {
                ok: true,
                json: async () => {
                    return { Answer: [{ type: 1 }] };
                },
            };
        },
        pidFile,
        ...overrides,
    });
    return { tunnel, children, calls, pidFile };
}

describe('openTunnel', () => {
    it('points cloudflared at the door and notes its pid', () => {
        const { tunnel, children, pidFile } = openFakeTunnel();
        tunnel.start();
        expect(children[0].spawnedWith).toEqual([
            '/bin/cloudflared',
            ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:4567'],
        ]);
        expect(fs.readFileSync(pidFile, 'utf8')).toBe('1000');
    });

    it('is up once the address is registered AND its name is known', async () => {
        const { tunnel, children, calls } = openFakeTunnel();
        tunnel.start();
        // cloudflared logs to stderr, and a line can arrive split in two.
        children[0].stderr.emit(
            'data',
            'INF Requesting new quick Tunnel on api.trycloudflare.com...\n' +
                'INF |  https://quiet-river-12',
        );
        children[0].stderr.emit('data', '34.trycloudflare.com  |\n');
        // Long enough for the pretended DNS to have answered, were it asked.
        await new Promise((resolve) => {
            setTimeout(resolve, 30);
        });
        expect(tunnel.getUrl()).toBe('');
        expect(calls.up).toEqual([]);
        children[0].stderr.emit(
            'data',
            'INF Registered tunnel connection connIndex=0\n',
        );
        await vi.waitFor(() => {
            expect(calls.up).toEqual([TUNNEL_URL]);
        });
        expect(tunnel.getUrl()).toBe(TUNNEL_URL);
        expect(tunnel.getStartingMillisecond()).toBe(0);
    });

    it('waits for the name to be in DNS', async () => {
        let isKnown = false;
        vi.useFakeTimers();
        const { tunnel, children, calls } = openFakeTunnel({
            fetchUrl: async () => {
                return {
                    ok: true,
                    json: async () => {
                        return isKnown ? { Answer: [{ type: 1 }] } : {};
                    },
                };
            },
        });
        tunnel.start();
        children[0].stderr.emit(
            'data',
            `${TUNNEL_URL}\nRegistered tunnel connection\n`,
        );
        await vi.advanceTimersByTimeAsync(4000);
        expect(calls.up).toEqual([]);
        isKnown = true;
        await vi.advanceTimersByTimeAsync(2000);
        expect(calls.up).toEqual([TUNNEL_URL]);
    });

    it('starts cloudflared again when it dies, and takes the address back', async () => {
        vi.useFakeTimers();
        const { tunnel, children, calls } = openFakeTunnel();
        tunnel.start();
        children[0].stderr.emit(
            'data',
            `${TUNNEL_URL}\nRegistered tunnel connection\n`,
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(calls.up).toEqual([TUNNEL_URL]);
        children[0].exitCode = 1;
        children[0].emit('exit', 1);
        expect(tunnel.getUrl()).toBe('');
        expect(calls.down).toBe(1);
        expect(children).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(3000);
        expect(children).toHaveLength(2);
    });

    it('opens a new tunnel on restart and ignores the old one going', async () => {
        const { tunnel, children, calls } = openFakeTunnel();
        tunnel.start();
        children[0].stderr.emit(
            'data',
            `${TUNNEL_URL}\nRegistered tunnel connection\n`,
        );
        await vi.waitFor(() => {
            expect(calls.up).toHaveLength(1);
        });
        tunnel.restart();
        expect(children[0].isKilled).toBe(true);
        expect(children).toHaveLength(2);
        expect(tunnel.getUrl()).toBe('');
        expect(calls.down).toBe(1);
        // The old cloudflared going is not the new one dying.
        children[0].emit('exit', 0);
        expect(calls.down).toBe(1);
        expect(children).toHaveLength(2);
    });

    it('closes: cloudflared ended, pid forgotten, nothing started again', async () => {
        vi.useFakeTimers();
        const { tunnel, children, calls, pidFile } = openFakeTunnel();
        tunnel.start();
        tunnel.close();
        expect(children[0].isKilled).toBe(true);
        expect(fs.existsSync(pidFile)).toBe(false);
        children[0].emit('exit', 0);
        await vi.advanceTimersByTimeAsync(120000);
        expect(children).toHaveLength(1);
        expect(calls.down).toBe(0);
    });

    it('says when cloudflared cannot be started at all', () => {
        const { tunnel, children, calls } = openFakeTunnel();
        tunnel.start();
        children[0].emit('error', new Error('spawn ENOENT'));
        expect(calls.failed).toEqual(['spawn ENOENT']);
    });
});

describe('checkIsTunnelAnswering', () => {
    function genResponse(headers) {
        return { headers: new Headers(headers), body: null };
    }

    it('asks the public address with the key', async () => {
        const asked = [];
        const isAnswering = await checkIsTunnelAnswering(
            TUNNEL_URL,
            KEY,
            async (url, init) => {
                asked.push([url, init.headers.authorization]);
                return genResponse({ [DOOR_HEADER]: '1' });
            },
        );
        expect(isAnswering).toBe(true);
        expect(asked).toEqual([[`${TUNNEL_URL}/v1/models`, `Bearer ${KEY}`]]);
    });

    it("is not fooled by one of Cloudflare's own pages", async () => {
        expect(
            await checkIsTunnelAnswering(TUNNEL_URL, KEY, async () => {
                return genResponse({ 'content-type': 'text/html' });
            }),
        ).toBe(false);
    });

    it('reads no answer as not answering', async () => {
        expect(
            await checkIsTunnelAnswering(TUNNEL_URL, KEY, async () => {
                throw new Error('ENOTFOUND');
            }),
        ).toBe(false);
    });
});

describe('the registry entry', () => {
    const args = { id: 'church-llm', name: 'Church LLM' };
    const models = [{ model: 'qwen/qwen3.5-9b', name: 'Qwen 3.5 9B' }];
    const server = genRegistryServer(
        args,
        `${TUNNEL_URL}/v1`,
        KEY,
        'LM Studio',
        models,
    );

    const other = { id: 'other', name: 'Other', baseUrl: 'http://o/v1' };
    const another = { id: 'another', name: 'Another', baseUrl: 'http://a/v1' };

    it('is one the app will take', () => {
        expect(server).toMatchObject({
            id: 'church-llm',
            name: 'Church LLM',
            baseUrl: `${TUNNEL_URL}/v1`,
            apiKey: KEY,
            isFree: true,
            models,
        });
        expect(
            findRegistryProblems(
                mergeRegistry({}, server, 'church-llm', '2026-10-10'),
            ),
        ).toEqual([]);
    });

    it('is added beside the servers already shared, which are left as they are', () => {
        expect(
            mergeRegistry(
                { version: 1, servers: [other, another] },
                server,
                'church-llm',
                '2026-10-10',
            ),
        ).toEqual({
            version: 1,
            updated: '2026-10-10',
            servers: [other, another, server],
        });
    });

    it('takes the place of the entry it published before, where that was', () => {
        const before = {
            id: 'church-llm',
            name: 'Old',
            baseUrl: 'http://x/v1',
        };
        expect(
            mergeRegistry(
                { version: 1, servers: [other, before, another] },
                server,
                'church-llm',
                '2026-10-10',
            ).servers,
        ).toEqual([other, server, another]);
    });

    it('is the only thing taken out when its tunnel stops', () => {
        expect(
            mergeRegistry(
                { version: 1, servers: [other, server, another] },
                null,
                'church-llm',
                '2026-10-11',
            ),
        ).toEqual({
            version: 1,
            updated: '2026-10-11',
            servers: [other, another],
        });
    });

    // An address that takes the app's problem reports is kept by hand and
    // names no model: a tunnel publishing beside it must neither drop it
    // nor be refused its own publish because of it.
    it('leaves an entry that takes reports where it is, and still publishes', () => {
        const reporting = {
            id: 'reporting',
            name: 'Report inbox',
            baseUrl: 'https://reports.example.com/report',
            apiKey: 'sk-report',
            isAcceptingReport: true,
        };
        const merged = mergeRegistry(
            { version: 1, servers: [reporting] },
            server,
            'church-llm',
            '2026-10-13',
        );
        expect(merged.servers).toEqual([reporting, server]);
        expect(findRegistryProblems(merged)).toEqual([]);
        const closed = mergeRegistry(merged, null, 'church-llm', '2026-10-13');
        expect(closed.servers).toEqual([reporting]);
        expect(findRegistryProblems(closed)).toEqual([]);
        // Still held to a name and an address the app can post to.
        expect(
            findRegistryProblems({
                version: 1,
                servers: [
                    { ...reporting, name: '' },
                    { ...reporting, id: 'two', baseUrl: 'reports.example' },
                    {
                        ...reporting,
                        id: 'three',
                        baseUrl: 'https://reports.example.com/r?to=me',
                    },
                ],
            }),
        ).toEqual([
            'servers[0].name is missing',
            'servers[1].baseUrl must be an http(s) address',
            'servers[2].baseUrl takes reports and must carry no "?" or "#"',
        ]);
    });

    it('leaves an empty registry when it was the only server', () => {
        const emptied = mergeRegistry(
            { version: 1, servers: [server] },
            null,
            'church-llm',
            '2026-10-11',
        );
        expect(emptied.servers).toEqual([]);
        // Nothing shared is still a registry the app reads.
        expect(findRegistryProblems(emptied)).toEqual([]);
    });

    it('two tunnels each add and remove their own', () => {
        const first = { ...server, id: 'llm-1234' };
        const second = { ...server, id: 'llm-11434' };
        let registry = mergeRegistry({}, first, 'llm-1234', '2026-10-10');
        registry = mergeRegistry(registry, second, 'llm-11434', '2026-10-10');
        expect(registry.servers).toEqual([first, second]);
        registry = mergeRegistry(registry, null, 'llm-1234', '2026-10-10');
        expect(registry.servers).toEqual([second]);
        registry = mergeRegistry(registry, null, 'llm-11434', '2026-10-10');
        expect(registry.servers).toEqual([]);
    });

    it('is sent again only when a publish failed, none is on its way, and five minutes passed', () => {
        const minute = 60 * 1000;
        const owed = {
            wantedText: '{"id":"church-llm"}',
            publishedText: '',
            isQueued: false,
            lastPublishAt: 1000,
            now: 1000 + 6 * minute,
        };
        expect(checkIsPublishOwed(owed)).toBe(true);
        // The registry already carries it.
        expect(
            checkIsPublishOwed({ ...owed, publishedText: owed.wantedText }),
        ).toBe(false);
        // One is on its way.
        expect(checkIsPublishOwed({ ...owed, isQueued: true })).toBe(false);
        // The last try is too close.
        expect(checkIsPublishOwed({ ...owed, now: 1000 + 4 * minute })).toBe(
            false,
        );
        // There is nothing to publish: the tunnel is down.
        expect(checkIsPublishOwed({ ...owed, wantedText: '' })).toBe(false);
    });
});
