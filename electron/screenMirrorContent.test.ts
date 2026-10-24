import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import http from 'node:http';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MirrorContentRegistry, parseByteRange } from './screenMirrorContent';

let directory: string;
let server: http.Server;
let registry: MirrorContentRegistry;
let base: string;
beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-content-test-'));
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
});
describe('presentation resources', () => {
    test('streams byte ranges and HEAD; invalid ranges return 416', async () => {
        const file = path.join(directory, 'ភ្លេង #1.mp4');
        await writeFile(file, '0123456789');
        const resource = registry.publish(registry.createScope(), file)!;
        const response = await fetch(base + resource, {
            headers: { Range: 'bytes=3-5' },
        });
        expect(response.status).toBe(206);
        expect(response.headers.get('content-range')).toBe('bytes 3-5/10');
        expect(await response.text()).toBe('345');
        const head = await fetch(base + resource, { method: 'HEAD' });
        expect(head.headers.get('content-length')).toBe('10');
        expect(await head.text()).toBe('');
        expect(
            (await fetch(base + resource, { headers: { Range: 'bytes=99-' } }))
                .status,
        ).toBe(416);
        expect(parseByteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
        expect(parseByteRange('bytes=1-2,4-5', 10)).toBe(false);
    });
    test('revokes grants and never exposes unpublished files', async () => {
        const file = path.join(directory, 'image.png');
        await writeFile(file, 'picture');
        const scope = registry.createScope();
        const resource = registry.publish(scope, file)!;
        expect((await fetch(base + resource)).status).toBe(200);
        registry.revoke(scope);
        expect((await fetch(base + resource)).status).toBe(404);
        expect(registry.publish(scope, file)).toBeNull();
        expect((await fetch(base + '/content/settings.json')).status).toBe(404);
    });
    // Windows paths ignore case, and the real path carries the disk's own
    // casing: a data folder given as `C--Users` that is `c--Users` on disk
    // made every video on a virtual display a 404.
    test.runIf(process.platform === 'win32')(
        'serves a file published with another casing of its path',
        async () => {
            const file = path.join(directory, 'clip.mp4');
            await writeFile(file, 'video');
            const resource = registry.publish(
                registry.createScope(),
                file.toUpperCase(),
            )!;
            expect((await fetch(base + resource)).status).toBe(200);
        },
    );
    test('allows relative web assets inside the published folder and blocks escapes', async () => {
        await mkdir(path.join(directory, 'web'));
        await writeFile(
            path.join(directory, 'web', 'index.html'),
            '<img src="image.png">',
        );
        await writeFile(path.join(directory, 'web', 'image.png'), 'picture');
        await writeFile(path.join(directory, 'secret.json'), 'secret');
        const resource = registry.publish(
            registry.createScope(),
            path.join(directory, 'web', 'index.html'),
        )!;
        const prefix = resource.slice(0, resource.lastIndexOf('/') + 1);
        expect(await (await fetch(base + prefix + 'image.png')).text()).toBe(
            'picture',
        );
        expect(
            (await fetch(base + prefix + '%2e%2e%2fsecret.json')).status,
        ).toBe(404);
        expect((await fetch(base + prefix + '%2eenv')).status).toBe(404);
    });
});
