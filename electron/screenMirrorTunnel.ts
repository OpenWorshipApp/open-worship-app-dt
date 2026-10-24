import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';

import type {
    MirrorTunnelErrorCode,
    MirrorTunnelState,
    MirrorTunnelStatus,
} from './screenMirrorProtocol';

// Cloudflare's free quick tunnel: `cloudflared` dials out to Cloudflare and
// hands back an https://<words>.trycloudflare.com address whose visitors it
// carries to a port on this computer. Nothing has to come IN -- it works
// behind a VPN, carrier NAT or a router that will not forward a port -- and
// phones get https, a secure context. Viewing traffic passes through
// Cloudflare (`ScreenMirrorService` counts everything it carries as the
// internet).
//
// The binary is not in the app package: it comes with the extra-bin pack
// (Settings > Others > Extra Binaries), built from Cloudflare's source tag by
// `extra-work/experiment-building/*-build-cloudflared.*` like the pack's
// media tools. Without the pack the tunnel says `missing`, and starts by
// itself once the pack is installed (`retryMissing`).
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const CONNECTED_PATTERN = /Registered tunnel connection/;
// cloudflared that dies is started again, waiting longer each time.
const RESTART_DELAYS_MILLISECOND = [3000, 10000, 30000, 60000];
const NAME_WAIT_MILLISECOND = 30000;
const NAME_POLL_MILLISECOND = 2000;

export type MirrorTunnelOptionsType = {
    // The pack's cloudflared, asked on every start: the data folder holding
    // the pack is the operator's choice and can change while the app runs.
    binaryPath: () => string;
    onChange: () => void;
    // For Cloudflare's DNS over HTTPS only (`waitForName`).
    fetch: (
        url: string,
        init: { signal: AbortSignal; headers?: Record<string, string> },
    ) => Promise<{
        ok: boolean;
        body: ReadableStream<Uint8Array> | null;
    }>;
    spawn?: typeof spawn;
};

export class MirrorTunnel {
    private status: MirrorTunnelStatus = 'off';
    private url = '';
    private error: MirrorTunnelErrorCode | '' = '';
    private run = 0;
    private port?: number;
    private child?: ChildProcess;
    private restartTimer?: ReturnType<typeof setTimeout>;
    private restarts = 0;

    constructor(private readonly options: MirrorTunnelOptionsType) {}

    get state(): MirrorTunnelState {
        return {
            status: this.status,
            url: this.url,
            error: this.error,
        };
    }

    private set(
        status: MirrorTunnelStatus,
        error: MirrorTunnelErrorCode | '' = '',
    ) {
        this.status = status;
        this.error = error;
        if (status !== 'up') {
            this.url = status === 'starting' ? this.url : '';
        }
        this.options.onChange();
    }

    // Starts carrying `http://127.0.0.1:<port>`; a tunnel already running is
    // ended first. The address comes in `state.url` once cloudflared says it.
    start(port: number) {
        const run = ++this.run;
        this.port = port;
        clearTimeout(this.restartTimer);
        this.killChild();
        void this.launch(run, port);
    }

    // The extra-bin pack was installed or changed: a tunnel waiting for its
    // cloudflared starts now. Anything else is left as it is.
    retryMissing() {
        if (
            this.status === 'error' &&
            this.error === 'missing' &&
            this.port !== undefined
        ) {
            this.start(this.port);
        }
    }

    stop() {
        this.run++;
        this.port = undefined;
        clearTimeout(this.restartTimer);
        this.restarts = 0;
        this.killChild();
        if (this.status !== 'off' || this.url) {
            this.url = '';
            this.set('off');
        }
    }

    private killChild() {
        const child = this.child;
        this.child = undefined;
        if (child && child.exitCode === null) {
            child.kill();
        }
    }

    private async launch(run: number, port: number) {
        const file = this.options.binaryPath();
        const isFound = await fs.promises.stat(file).then(
            (stats) => stats.isFile(),
            () => false,
        );
        if (run !== this.run) {
            return;
        }
        if (!isFound) {
            this.set('error', 'missing');
            return;
        }
        this.url = '';
        this.set('starting');
        const child = (this.options.spawn ?? spawn)(
            file,
            ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`],
            { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        this.child = child;
        // cloudflared logs to stderr; a line can arrive split in two.
        let tail = '';
        let isWaitingForName = false;
        const onData = (chunk: Buffer | string) => {
            if (this.child !== child) {
                return;
            }
            tail = (tail + String(chunk)).slice(-8192);
            const found = URL_PATTERN.exec(tail)?.[0];
            if (found && found !== this.url) {
                this.url = found;
                this.options.onChange();
            }
            if (
                this.url &&
                this.status !== 'up' &&
                !isWaitingForName &&
                CONNECTED_PATTERN.test(tail)
            ) {
                isWaitingForName = true;
                const url = this.url;
                void this.waitForName(url).then(() => {
                    if (this.child === child && this.url === url) {
                        this.restarts = 0;
                        this.set('up');
                    }
                });
            }
        };
        child.stdout?.on('data', onData);
        child.stderr?.on('data', onData);
        child.on('error', () => {
            if (this.child === child) {
                this.child = undefined;
                this.set('error', 'failed');
            }
        });
        child.on('exit', () => {
            if (this.child !== child || run !== this.run) {
                return;
            }
            this.child = undefined;
            this.url = '';
            this.set('error', 'stopped');
            const delay =
                RESTART_DELAYS_MILLISECOND[
                    Math.min(
                        this.restarts,
                        RESTART_DELAYS_MILLISECOND.length - 1,
                    )
                ];
            this.restarts++;
            this.restartTimer = setTimeout(() => {
                if (run === this.run) {
                    this.start(port);
                }
            }, delay);
        });
    }

    // A new address is in Cloudflare's DNS a few seconds after cloudflared
    // registered. Asked for sooner, a resolver -- this computer's, the VPN's
    // -- keeps the "no such name" for minutes, and the operator opening the
    // link at once sees a dead page. So it is announced only once Cloudflare's
    // own DNS over HTTPS knows it, or after half a minute anyway.
    private async waitForName(url: string) {
        const host = new URL(url).host;
        const until = Date.now() + NAME_WAIT_MILLISECOND;
        while (Date.now() < until && this.url === url) {
            try {
                const response = await this.options.fetch(
                    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
                    {
                        signal: AbortSignal.timeout(5000),
                        headers: { accept: 'application/dns-json' },
                    },
                );
                const answer = response.ok
                    ? JSON.parse(await new Response(response.body).text())
                    : null;
                if (
                    Array.isArray(answer?.Answer) &&
                    answer.Answer.some((item: any) => item?.type === 1)
                ) {
                    return;
                }
            } catch {
                // Not yet, or no answer: asked again.
            }
            await new Promise((resolve) => {
                setTimeout(resolve, NAME_POLL_MILLISECOND);
            });
        }
    }
}
