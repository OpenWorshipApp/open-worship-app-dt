import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MirrorContentRegistry, serveMirrorFile } from './screenMirrorContent';

let directory = '';
let server: http.Server;
let registry: MirrorContentRegistry;
let base = '';

beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-'));
    registry = new MirrorContentRegistry();
    server = http.createServer((req, res) => {
        void registry
            .serve(req, res, new URL(req.url!, 'http://localhost').pathname)
            .catch(() => res.writeHead(500).end());
    });
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterEach(async () => {
    vi.useRealTimers();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
});

// A directory link: a junction on Windows, which needs no privilege there,
// and a plain symlink elsewhere.
function linkDirectory(target: string, linkPath: string) {
    return symlink(target, linkPath, 'junction');
}

describe('serveMirrorFile', () => {
    test('a folder is not a file to serve', async () => {
        const res = {
            statusCode: 0,
            isEnded: false,
            writeHead(statusCode: number) {
                this.statusCode = statusCode;
                return this;
            },
            end() {
                this.isEnded = true;
            },
            setHeader: vi.fn(),
        };

        await serveMirrorFile({ headers: {} } as any, res as any, directory);

        expect(res.statusCode).toBe(404);
        expect(res.isEnded).toBe(true);
        expect(res.setHeader).not.toHaveBeenCalled();
    });

    test('an unknown file type goes out as bytes, not something to run', async () => {
        const file = path.join(directory, 'notes.xyz');
        await writeFile(file, 'raw');
        const resource = registry.publish(registry.createScope(), file)!;

        const response = await fetch(base + resource);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe(
            'application/octet-stream',
        );
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(await response.text()).toBe('raw');
    });
});

describe('what a scope holds', () => {
    test('lists the files published in it, and nothing for another scope', () => {
        const scope = registry.createScope();
        const first = path.join(directory, 'one.png');
        const second = path.join(directory, 'two.png');
        registry.publish(scope, first);
        registry.publish(scope, second);
        // Published twice, listed once.
        registry.publish(scope, first);

        expect(registry.publishedFiles(scope)).toEqual(
            new Set([path.resolve(first), path.resolve(second)]),
        );
        expect(registry.publishedFiles('not-a-scope')).toEqual(new Set());
    });

    test('a full scope sweeps what nothing touched for 30 s, then takes more', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
        const scope = registry.createScope();
        for (let index = 0; index < 4095; index++) {
            registry.publish(scope, path.join(directory, `old-${index}.png`));
        }
        // The last one in, twenty seconds later: still in use at the sweep.
        vi.setSystemTime(new Date('2026-11-03T10:00:20.000Z'));
        const kept = path.join(directory, 'kept.png');
        registry.publish(scope, kept);
        vi.setSystemTime(new Date('2026-11-03T10:00:31.000Z'));

        const fresh = registry.publish(scope, path.join(directory, 'new.png'));

        expect(fresh).toMatch(/\/new\.png$/);
        expect(registry.publishedFiles(scope)).toEqual(
            new Set([
                path.resolve(kept),
                path.resolve(path.join(directory, 'new.png')),
            ]),
        );
    });

    test('a full scope of files still in use takes no more', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
        const scope = registry.createScope();
        for (let index = 0; index < 4096; index++) {
            registry.publish(scope, path.join(directory, `busy-${index}.png`));
        }
        vi.setSystemTime(new Date('2026-11-03T10:00:10.000Z'));

        expect(
            registry.publish(scope, path.join(directory, 'one-more.png')),
        ).toBeNull();
        expect(registry.publishedFiles(scope).size).toBe(4096);
    });
});

describe('a published folder of web assets', () => {
    async function publishPage() {
        await mkdir(path.join(directory, 'web'));
        await writeFile(path.join(directory, 'web', 'index.html'), '<p>');
        const resource = registry.publish(
            registry.createScope(),
            path.join(directory, 'web', 'index.html'),
        )!;
        return resource.slice(0, resource.lastIndexOf('/') + 1);
    }

    test('serves only the kinds of file a page loads', async () => {
        const prefix = await publishPage();
        await writeFile(path.join(directory, 'web', 'notes.txt'), 'private');
        await writeFile(path.join(directory, 'web', 'style.css'), 'p{}');

        expect((await fetch(base + prefix + 'notes.txt')).status).toBe(404);
        const css = await fetch(base + prefix + 'style.css');
        expect(css.status).toBe(200);
        expect(await css.text()).toBe('p{}');
    });

    test('a link inside it that leads out of it is not followed', async () => {
        const prefix = await publishPage();
        await mkdir(path.join(directory, 'outside'));
        await writeFile(path.join(directory, 'outside', 'photo.png'), 'away');
        await linkDirectory(
            path.join(directory, 'outside'),
            path.join(directory, 'web', 'link'),
        );

        const response = await fetch(base + prefix + 'link/photo.png');

        expect(response.status).toBe(404);
        expect(await response.text()).toBe('');
    });
});

describe('a single published file', () => {
    test('reached through a link to somewhere else is not served', async () => {
        await mkdir(path.join(directory, 'real'));
        await writeFile(path.join(directory, 'real', 'clip.mp4'), 'video');
        await linkDirectory(
            path.join(directory, 'real'),
            path.join(directory, 'linked'),
        );
        const scope = registry.createScope();
        const throughLink = registry.publish(
            scope,
            path.join(directory, 'linked', 'clip.mp4'),
        )!;
        const direct = registry.publish(
            scope,
            path.join(directory, 'real', 'clip.mp4'),
        )!;

        expect((await fetch(base + throughLink)).status).toBe(404);
        expect((await fetch(base + direct)).status).toBe(200);
    });
});
