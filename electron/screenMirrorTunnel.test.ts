import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
    MirrorTunnel,
    type MirrorTunnelOptionsType,
} from './screenMirrorTunnel';
import {
    getCloudflaredBinPath,
    getExtraBinPlatformName,
} from './extraBinPaths';

let directory: string;
let binary: string;
let children: FakeChild[];

class FakeChild extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    exitCode: number | null = null;
    kill = vi.fn(() => {
        this.exitCode = 0;
        return true;
    });
    constructor(
        readonly file: string,
        readonly args: string[],
    ) {
        super();
    }
    say(text: string) {
        this.stderr.write(text);
    }
    die() {
        this.exitCode = 1;
        this.emit('exit', 1);
    }
}

// Cloudflare's DNS over HTTPS: the new name is known once `isNameKnown`.
let isNameKnown = true;
let dnsAsked: string[] = [];
function dnsAnswer(url: string) {
    dnsAsked.push(new URL(url).searchParams.get('name') ?? '');
    const body = JSON.stringify({
        Status: isNameKnown ? 0 : 3,
        Answer: isNameKnown ? [{ type: 1, data: '104.16.230.132' }] : [],
    });
    return { ok: true, body: new Blob([body]).stream() };
}

function genTunnel(options: Partial<MirrorTunnelOptionsType> = {}) {
    const onChange = vi.fn();
    const tunnel = new MirrorTunnel({
        binaryPath: () => binary,
        onChange,
        fetch: async (url) => {
            if (!url.startsWith('https://cloudflare-dns.com/dns-query?')) {
                throw new Error(`Nothing else is fetched: ${url}`);
            }
            return dnsAnswer(url);
        },
        spawn: ((file: string, args: string[]) => {
            const child = new FakeChild(file, args);
            children.push(child);
            return child;
        }) as any,
        ...options,
    });
    return { tunnel, onChange };
}

// The pack as Settings installs it.
async function installPack() {
    await fs.promises.mkdir(path.dirname(binary), { recursive: true });
    await fs.promises.writeFile(binary, 'cloudflared');
}

function waitALittle() {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(async () => {
    directory = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'owa-tunnel-'),
    );
    binary = getCloudflaredBinPath(directory, 'linux', 'x64');
    children = [];
    isNameKnown = true;
    dnsAsked = [];
});

afterEach(async () => {
    vi.useRealTimers();
    await fs.promises.rm(directory, { recursive: true, force: true });
});

test('cloudflared is found in the extra-bin pack, named as the packs are built', () => {
    expect(getCloudflaredBinPath('/data', 'win32', 'x64')).toBe(
        path.join(
            '/data',
            'extra-bin',
            'win',
            'cloudflared',
            'cloudflared.exe',
        ),
    );
    expect(getCloudflaredBinPath('/data', 'darwin', 'arm64')).toBe(
        path.join('/data', 'extra-bin', 'mac', 'cloudflared', 'cloudflared'),
    );
    for (const [platform, arch, name] of [
        ['win32', 'x64', 'win'],
        ['win32', 'arm64', 'win-arm64'],
        ['win32', 'ia32', 'win-i386'],
        ['darwin', 'arm64', 'mac'],
        ['darwin', 'x64', 'mac-int'],
        ['linux', 'x64', 'linux'],
        ['linux', 'arm64', 'linux-arm64'],
    ]) {
        expect(getExtraBinPlatformName(platform, arch)).toBe(name);
    }
});

test("runs the pack's cloudflared to this port, up once registered", async () => {
    await installPack();
    const { tunnel } = genTunnel();
    tunnel.start(51234);
    await vi.waitFor(() => expect(children).toHaveLength(1));
    const [child] = children;
    expect(child.file).toBe(binary);
    expect(child.args).toEqual([
        'tunnel',
        '--no-autoupdate',
        '--url',
        'http://127.0.0.1:51234',
    ]);
    expect(tunnel.state.status).toBe('starting');
    // The address comes split across writes; it is up once registered.
    child.say('INF |  https://quiet-river');
    child.say('-tree-1.trycloudflare.com  |\n');
    await vi.waitFor(() => {
        expect(tunnel.state.url).toBe(
            'https://quiet-river-tree-1.trycloudflare.com',
        );
    });
    expect(tunnel.state.status).toBe('starting');
    child.say('INF Registered tunnel connection connIndex=0\n');
    await vi.waitFor(() => expect(tunnel.state.status).toBe('up'));
    expect(dnsAsked).toEqual(['quiet-river-tree-1.trycloudflare.com']);
    // Started again: the running one is ended first.
    tunnel.start(51234);
    await vi.waitFor(() => expect(children).toHaveLength(2));
    expect(child.kill).toHaveBeenCalled();
    tunnel.stop();
    expect(children[1].kill).toHaveBeenCalled();
    expect(tunnel.state).toEqual({ status: 'off', url: '', error: '' });
});

// Nothing is downloaded any more: without the pack the tunnel waits for it,
// and starts once Settings installed it.
test('without the pack it says missing, and starts once the pack is in', async () => {
    const { tunnel } = genTunnel();
    tunnel.retryMissing();
    expect(children).toEqual([]);
    tunnel.start(51234);
    await vi.waitFor(() => expect(tunnel.state.error).toBe('missing'));
    expect(tunnel.state.status).toBe('error');
    expect(children).toEqual([]);
    await installPack();
    tunnel.retryMissing();
    await vi.waitFor(() => expect(children).toHaveLength(1));
    expect(children[0].args.at(-1)).toBe('http://127.0.0.1:51234');
    // Only a tunnel waiting for the pack is started again.
    tunnel.retryMissing();
    await waitALittle();
    expect(children).toHaveLength(1);
    // Once stopped, a pack installed later starts nothing.
    tunnel.stop();
    tunnel.retryMissing();
    await waitALittle();
    expect(children).toHaveLength(1);
});

test('a cloudflared that will not run says so', async () => {
    await installPack();
    const { tunnel } = genTunnel();
    tunnel.start(51234);
    await vi.waitFor(() => expect(children).toHaveLength(1));
    // EACCES, say, or another processor's build.
    children[0].emit('error', new Error('spawn EACCES'));
    expect(tunnel.state).toEqual({
        status: 'error',
        url: '',
        error: 'failed',
    });
});

test('a cloudflared that dies is started again, and stop ends that', async () => {
    await installPack();
    const { tunnel } = genTunnel();
    tunnel.start(51234);
    await vi.waitFor(() => expect(children).toHaveLength(1));
    vi.useFakeTimers();
    children[0].say(
        'https://a-b.trycloudflare.com Registered tunnel connection',
    );
    await vi.waitFor(() => expect(tunnel.state.status).toBe('up'));
    children[0].die();
    expect(tunnel.state).toMatchObject({
        status: 'error',
        error: 'stopped',
        url: '',
    });
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
    // The restart looks for the pack again before it runs it.
    await vi.waitFor(() => expect(children).toHaveLength(2));
    vi.useFakeTimers();
    children[1].die();
    tunnel.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(children).toHaveLength(2);
    expect(tunnel.state.status).toBe('off');
});

// Asked before Cloudflare's DNS has the name, a resolver keeps "no such name"
// for minutes: the address is announced only once the name is known.
test('the address is up only once its name is in the DNS', async () => {
    isNameKnown = false;
    await installPack();
    const { tunnel } = genTunnel();
    tunnel.start(51234);
    await vi.waitFor(() => expect(children).toHaveLength(1));
    children[0].say(
        'https://a-b.trycloudflare.com Registered tunnel connection\n',
    );
    await vi.waitFor(() => expect(dnsAsked).toHaveLength(1));
    expect(tunnel.state).toMatchObject({
        status: 'starting',
        url: 'https://a-b.trycloudflare.com',
    });
    isNameKnown = true;
    await vi.waitFor(() => expect(tunnel.state.status).toBe('up'), {
        timeout: 5000,
    });
    expect(dnsAsked).toEqual([
        'a-b.trycloudflare.com',
        'a-b.trycloudflare.com',
    ]);
    tunnel.stop();
});
