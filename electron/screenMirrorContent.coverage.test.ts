import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import http from 'node:http';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type * as FsModule from 'node:fs';

// A read that fails once the response has started: the stand-in stream
// errors on its first read. Every other read is the real file system's.
const fsState = vi.hoisted(() => ({ failRead: false, reads: 0 }));
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof FsModule>();
    const { Readable } = await import('node:stream');
    const createReadStream = ((...args: any[]) => {
        fsState.reads += 1;
        if (!fsState.failRead) {
            return (actual.createReadStream as any)(...args);
        }
        return new Readable({
            read() {
                this.destroy(new Error('EIO: i/o error, read'));
            },
        });
    }) as typeof actual.createReadStream;
    return {
        ...actual,
        default: { ...actual, createReadStream },
        createReadStream,
    };
});

import { MirrorContentRegistry } from './screenMirrorContent';

let directory: string;
let server: http.Server;
let registry: MirrorContentRegistry;
let base: string;
beforeEach(async () => {
    fsState.failRead = false;
    fsState.reads = 0;
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-content-cover-'));
    registry = new MirrorContentRegistry();
    server = http.createServer((req, res) => {
        void registry
            .serve(req, res, new URL(req.url!, 'http://localhost').pathname)
            .catch(() => res.writeHead(404).end());
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
    vi.useRealTimers();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
});

function prefixOf(resource: string) {
    return resource.slice(0, resource.lastIndexOf('/') + 1);
}

describe('what a scope publishes', () => {
    test('lists the files it published, and nothing for a scope it does not know', async () => {
        const scope = registry.createScope();
        const one = path.join(directory, 'one.png');
        const two = path.join(directory, 'two.mp4');
        registry.publish(scope, one);
        registry.publish(scope, two);
        // Published again: still one entry.
        registry.publish(scope, one);
        expect(registry.publishedFiles(scope)).toEqual(new Set([one, two]));
        expect(registry.publishedFiles('no-such-scope')).toEqual(new Set());
        // A relative path or one with a NUL byte is never published.
        expect(registry.publish(scope, 'relative.png')).toBeNull();
        expect(registry.publish(scope, `${one}\0.png`)).toBeNull();
        expect(registry.publishedFiles(scope).size).toBe(2);
    });

    test('holds 4096 files at most: old ones are swept, while fresh ones refuse a new grant', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
        const scope = registry.createScope();
        const fileOf = (index: number) => {
            return path.join(directory, `slide-${index}.png`);
        };
        for (let index = 0; index < 4095; index++) {
            expect(registry.publish(scope, fileOf(index))).not.toBeNull();
        }
        const kept = registry.publish(scope, fileOf(7));
        vi.advanceTimersByTime(20_000);
        // Still in use: touched again, and it keeps its address.
        expect(registry.publish(scope, fileOf(7))).toBe(kept);
        expect(registry.publish(scope, fileOf(4095))).not.toBeNull();
        // Full, and nothing is older than 30 s: nothing to sweep, no room.
        expect(registry.publish(scope, fileOf(4096))).toBeNull();
        vi.advanceTimersByTime(10_001);
        // Now the untouched ones are swept to make room.
        expect(registry.publish(scope, fileOf(4096))).not.toBeNull();
        expect(registry.publishedFiles(scope)).toEqual(
            new Set([fileOf(7), fileOf(4095), fileOf(4096)]),
        );
        expect(registry.publish(scope, fileOf(7))).toBe(kept);
    });
});

describe('what it serves', () => {
    test('clear revokes every scope at once', async () => {
        const file = path.join(directory, 'image.png');
        await writeFile(file, 'picture');
        const first = registry.createScope();
        const second = registry.createScope();
        const one = registry.publish(first, file)!;
        const two = registry.publish(second, file)!;
        expect((await fetch(base + one)).status).toBe(200);
        registry.clear();
        expect((await fetch(base + one)).status).toBe(404);
        expect((await fetch(base + two)).status).toBe(404);
        expect(registry.publish(first, file)).toBeNull();
        expect(registry.publishedFiles(second)).toEqual(new Set());
    });

    test('a published folder is not a file: 404', async () => {
        const folder = path.join(directory, 'clips');
        await mkdir(folder);
        const resource = registry.publish(registry.createScope(), folder)!;
        const response = await fetch(base + resource);
        expect(response.status).toBe(404);
        expect(fsState.reads).toBe(0);
    });

    test('a published page reaches only files of a type it may serve', async () => {
        await mkdir(path.join(directory, 'web'));
        await writeFile(path.join(directory, 'web', 'index.html'), '<p>');
        await writeFile(path.join(directory, 'web', 'notes.txt'), 'secret');
        await writeFile(path.join(directory, 'web', 'logo.png'), 'picture');
        const resource = registry.publish(
            registry.createScope(),
            path.join(directory, 'web', 'index.html'),
        )!;
        const prefix = prefixOf(resource);
        expect((await fetch(base + prefix + 'notes.txt')).status).toBe(404);
        expect(await (await fetch(base + prefix + 'logo.png')).text()).toBe(
            'picture',
        );
    });

    // A junction needs no privilege on Windows; elsewhere it is a symlink.
    test('a link inside a published folder that leads out of it is refused', async () => {
        await mkdir(path.join(directory, 'web'));
        await mkdir(path.join(directory, 'outside'));
        await writeFile(path.join(directory, 'web', 'index.html'), '<p>');
        await writeFile(path.join(directory, 'outside', 'secret.png'), 'no');
        await symlink(
            path.join(directory, 'outside'),
            path.join(directory, 'web', 'linked'),
            'junction',
        );
        const resource = registry.publish(
            registry.createScope(),
            path.join(directory, 'web', 'index.html'),
        )!;
        const response = await fetch(
            base + prefixOf(resource) + 'linked/secret.png',
        );
        expect(response.status).toBe(404);
        expect(fsState.reads).toBe(0);
    });

    test('a published file that is really another file, through a link, is refused', async () => {
        await mkdir(path.join(directory, 'real'));
        await writeFile(path.join(directory, 'real', 'clip.mp4'), 'video');
        await symlink(
            path.join(directory, 'real'),
            path.join(directory, 'via'),
            'junction',
        );
        const scope = registry.createScope();
        const through = registry.publish(
            scope,
            path.join(directory, 'via', 'clip.mp4'),
        )!;
        expect((await fetch(base + through)).status).toBe(404);
        // The file itself, published as it is, is served.
        const direct = registry.publish(
            scope,
            path.join(directory, 'real', 'clip.mp4'),
        )!;
        expect(await (await fetch(base + direct)).text()).toBe('video');
    });

    test('a read that fails mid-response drops the connection', async () => {
        const file = path.join(directory, 'clip.mp4');
        await writeFile(file, '0123456789');
        const resource = registry.publish(registry.createScope(), file)!;
        fsState.failRead = true;
        await expect(
            fetch(base + resource).then((response) => response.text()),
        ).rejects.toThrow();
        expect(fsState.reads).toBe(1);
        // The server is still there for the next request.
        fsState.failRead = false;
        expect(await (await fetch(base + resource)).text()).toBe('0123456789');
    });
});
