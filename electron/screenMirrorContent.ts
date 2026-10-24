import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon',
};
type Resource = { file: string; root: string | null; touched: number };
type Scope = { resources: Map<string, Resource>; ids: Map<string, string> };

export function isContainedPath(root: string, file: string) {
    const relative = path.relative(root, file);
    return (
        relative === '' ||
        (!path.isAbsolute(relative) &&
            relative !== '..' &&
            !relative.startsWith(`..${path.sep}`))
    );
}

export function parseByteRange(
    range: string | undefined,
    size: number,
): { start: number; end: number } | null | false {
    if (!range) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]) || size === 0) return false;
    const start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2]));
    const end =
        match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    return Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start >= 0 &&
        start <= end &&
        start < size
        ? { start, end }
        : false;
}

export async function serveMirrorFile(
    req: IncomingMessage,
    res: ServerResponse,
    file: string,
) {
    const info = await stat(file);
    if (!info.isFile()) {
        res.writeHead(404).end();
        return;
    }
    const range = parseByteRange(req.headers.range, info.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
        'Content-Type',
        mimeTypes[path.extname(file).toLowerCase()] ??
            'application/octet-stream',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (range === false) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
        return;
    }
    if (range)
        res.setHeader(
            'Content-Range',
            `bytes ${range.start}-${range.end}/${info.size}`,
        );
    res.setHeader(
        'Content-Length',
        range ? range.end - range.start + 1 : info.size,
    );
    res.writeHead(range ? 206 : 200);
    if (req.method === 'HEAD' || info.size === 0) {
        res.end();
        return;
    }
    const stream = createReadStream(file, range ?? undefined);
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
}

export class MirrorContentRegistry {
    private scopes = new Map<string, Scope>();
    createScope() {
        const id = randomBytes(24).toString('hex');
        this.scopes.set(id, { resources: new Map(), ids: new Map() });
        return id;
    }
    revoke(scope: string) {
        this.scopes.delete(scope);
    }
    clear() {
        this.scopes.clear();
    }
    publishedFiles(scopeId: string) {
        return new Set(this.scopes.get(scopeId)?.ids.keys());
    }
    publish(scopeId: string, filePath: string) {
        const scope = this.scopes.get(scopeId);
        if (!scope || !path.isAbsolute(filePath) || filePath.includes('\0'))
            return null;
        // Sweep resources no longer touched by snapshots/updates. A short grace
        // keeps outgoing transitions and in-flight requests usable.
        const now = Date.now();
        if (scope.resources.size >= 4096) {
            for (const [id, entry] of scope.resources) {
                if (now - entry.touched > 30000) {
                    scope.resources.delete(id);
                    scope.ids.delete(entry.file);
                }
            }
            if (scope.resources.size >= 4096) return null;
        }
        const file = path.resolve(filePath);
        let id = scope.ids.get(file);
        if (!id) {
            id = randomBytes(12).toString('hex');
            const root = /\.(html?|css)$/i.test(file)
                ? path.dirname(file)
                : null;
            scope.resources.set(id, { file, root, touched: now });
            scope.ids.set(file, id);
        } else scope.resources.get(id)!.touched = now;
        return `/content/${scopeId}/${id}/${encodeURIComponent(path.basename(file))}`;
    }
    async serve(req: IncomingMessage, res: ServerResponse, pathname: string) {
        const match = /^\/content\/([a-f0-9]{48})\/([a-f0-9]{24})\/(.+)$/.exec(
            pathname,
        );
        const entry =
            match && this.scopes.get(match[1])?.resources.get(match[2]);
        if (!entry || !match) {
            res.writeHead(404).end();
            return;
        }
        const tail = decodeURIComponent(match[3]);
        if (
            tail.includes('\0') ||
            tail.split(/[\\/]/).some((part) => part.startsWith('.'))
        ) {
            res.writeHead(404).end();
            return;
        }
        const file = entry.root ? path.resolve(entry.root, tail) : entry.file;
        if (
            (!entry.root && tail !== path.basename(entry.file)) ||
            (entry.root &&
                (!isContainedPath(entry.root, file) ||
                    !mimeTypes[path.extname(file).toLowerCase()]))
        ) {
            res.writeHead(404).end();
            return;
        }
        const actual = await realpath(file);
        if (
            entry.root &&
            !isContainedPath(await realpath(entry.root), actual)
        ) {
            res.writeHead(404).end();
            return;
        }
        // An explicitly published file cannot change into a symlink to another file.
        // Compared through `path.relative`, which ignores case on Windows: the
        // real path carries the disk's casing (`c--Users`), the published one
        // whatever casing the app was given (`C--Users`), and both are one file.
        if (
            !entry.root &&
            path.relative(path.resolve(entry.file), actual) !== ''
        ) {
            res.writeHead(404).end();
            return;
        }
        await serveMirrorFile(req, res, actual);
    }
}
