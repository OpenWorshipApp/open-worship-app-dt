import { EventEmitter } from 'node:events';
import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { disk } = vi.hoisted(() => ({
    disk: {
        dirList: [] as string[],
        deletedList: [] as string[],
        isFolder: true,
    },
}));

// only what this file reaches; the network and the files are the deps below
vi.mock('../server/appProvider', () => ({
    default: { httpUtils: {} },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => {
        return path.join(...parts);
    },
    fsCheckDirExist: async () => {
        return disk.isFolder;
    },
    fsListDirectories: async () => {
        return disk.dirList;
    },
    fsDeleteDir: async (dirPath: string) => {
        disk.deletedList.push(dirPath);
    },
    fsCreateDir: async () => {
        return undefined;
    },
    fsCreateWriteStream: () => {
        return null;
    },
    fsDeleteFile: async () => {
        return undefined;
    },
    getTempPath: () => {
        return '/tmp';
    },
}));

import {
    cleanOldOfficeLinkFolders,
    deleteOfficeLinkFiles,
    downloadOfficeLinkMedia,
    type OfficeLinkDepsType,
} from './officeLinkMediaDownload';

// EC-777: what one link answers -- a status, headers, the body in chunks.
type ReplyType = {
    status?: number;
    headers?: Record<string, string>;
    chunks?: Uint8Array[];
    error?: boolean;
    silent?: boolean;
    // the address the connection really reached
    remoteAddress?: string;
};

const PNG = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...new Array(80).fill(1),
]);

function genDeps(replyMap: Record<string, ReplyType>) {
    const askedList: string[] = [];
    const written: Record<string, number[]> = {};
    const deletedList: string[] = [];
    const createdDirList: string[] = [];
    const genRequest = (scheme: string) => {
        return (options: any, callback: (response: any) => void) => {
            const url = `${scheme}://${options.hostname}${
                options.port === (scheme === 'https' ? 443 : 80)
                    ? ''
                    : `:${options.port}`
            }${options.path}`;
            askedList.push(url);
            const request = new EventEmitter() as any;
            request.destroy = vi.fn();
            request.end = () => {
                const reply = replyMap[url] ?? { status: 404 };
                setTimeout(() => {
                    if (reply.error) {
                        request.emit('error', new Error('ECONNREFUSED'));
                        return;
                    }
                    if (reply.silent) {
                        return;
                    }
                    const response = new EventEmitter() as any;
                    response.statusCode = reply.status ?? 200;
                    response.headers = reply.headers ?? {};
                    response.socket = { remoteAddress: reply.remoteAddress };
                    response.resume = vi.fn();
                    response.destroy = vi.fn();
                    callback(response);
                    setTimeout(() => {
                        for (const chunk of reply.chunks ?? []) {
                            response.emit('data', chunk);
                        }
                        response.emit('end');
                    }, 0);
                }, 0);
            };
            return request;
        };
    };
    const deps: OfficeLinkDepsType = {
        request: genRequest('https'),
        requestHttp: genRequest('http'),
        getFolderPath: () => {
            return '/tmp/links';
        },
        createWriteStream: (filePath: string) => {
            written[filePath] = [];
            const sink = new EventEmitter() as any;
            sink.write = (chunk: Uint8Array) => {
                // a loop: an 8 MB chunk spread is past the call stack
                for (const byte of chunk.subarray(0, 4096)) {
                    written[filePath].push(byte);
                }
                return true;
            };
            sink.end = (callback?: () => void) => {
                callback?.();
            };
            sink.destroy = vi.fn();
            return sink;
        },
        createDir: async (dirPath: string) => {
            createdDirList.push(dirPath);
        },
        deleteFile: async (filePath: string) => {
            deletedList.push(filePath);
        },
        clean: vi.fn(async () => {
            return undefined;
        }),
        now: () => {
            return 1_700_000_000_000;
        },
    };
    return { deps, askedList, written, deletedList, createdDirList };
}

describe('a picture from a link', () => {
    test('downloaded whole into a folder of its own, under its own ending', async () => {
        const { deps, written, createdDirList } = genDeps({
            'https://cdn.example.org/img/Easter%20Cross.jpeg': {
                headers: { 'content-type': 'image/png' },
                chunks: [PNG.slice(0, 10), PNG.slice(10)],
            },
        });
        const found = await downloadOfficeLinkMedia(
            'https://cdn.example.org/img/Easter%20Cross.jpeg',
            'picture',
            null,
            deps,
        );
        expect(found).toEqual({
            name: 'Easter Cross.png',
            filePath: expect.stringMatching(
                /^\/tmp\/links\/[a-z0-9]+-[a-z0-9]+\/Easter Cross\.png$/,
            ),
        });
        expect(createdDirList).toHaveLength(1);
        expect(deps.clean).toHaveBeenCalledWith('/tmp/links', deps.now());
        expect(written[(found as { filePath: string }).filePath]).toEqual([
            ...PNG,
        ]);
    });

    test('a redirect is followed to a public address', async () => {
        const { deps, askedList } = genDeps({
            'http://example.org/p': {
                status: 302,
                headers: { location: 'https://cdn.example.org/real.png' },
            },
            'https://cdn.example.org/real.png': { chunks: [PNG] },
        });
        const found = await downloadOfficeLinkMedia(
            'http://example.org/p',
            'picture',
            null,
            deps,
        );
        expect(found).toMatchObject({ name: 'real.png' });
        expect(askedList).toEqual([
            'http://example.org/p',
            'https://cdn.example.org/real.png',
        ]);
    });

    test('a redirect into the church network is refused, never asked', async () => {
        const { deps, askedList } = genDeps({
            'https://example.org/p': {
                status: 301,
                headers: { location: 'http://192.168.1.1/admin' },
            },
        });
        const found = await downloadOfficeLinkMedia(
            'https://example.org/p',
            'picture',
            null,
            deps,
        );
        expect(found).toEqual({
            reason:
                'The link at example.org sent it on to an address this ' +
                'does not download from.',
        });
        expect(askedList).toEqual(['https://example.org/p']);
    });

    test('a local link is refused before anything is asked', async () => {
        const { deps, askedList } = genDeps({});
        const found = await downloadOfficeLinkMedia(
            'http://localhost:3000/x.png',
            'picture',
            null,
            deps,
        );
        expect(found).toMatchObject({
            reason: expect.stringMatching(
                /^The link is not an internet address/,
            ),
        });
        expect(askedList).toEqual([]);
    });

    test('a public name that led into the church network: nothing read', async () => {
        const { deps, createdDirList } = genDeps({
            'https://rebind.example.org/a.png': {
                remoteAddress: '::ffff:192.168.1.1',
                chunks: [PNG],
            },
        });
        expect(
            await downloadOfficeLinkMedia(
                'https://rebind.example.org/a.png',
                'picture',
                null,
                deps,
            ),
        ).toEqual({
            reason:
                "rebind.example.org is on this computer or the church's " +
                'own network, which this does not download from.',
        });
        expect(createdDirList).toEqual([]);
    });

    test('too many redirects end it', async () => {
        const replyMap: Record<string, ReplyType> = {};
        for (let index = 0; index < 8; index++) {
            replyMap[`https://example.org/${index}`] = {
                status: 307,
                headers: { location: `/${index + 1}` },
            };
        }
        const { deps, askedList } = genDeps(replyMap);
        const found = await downloadOfficeLinkMedia(
            'https://example.org/0',
            'picture',
            null,
            deps,
        );
        expect(found).toEqual({
            reason: 'The link at example.org was sent on too many times.',
        });
        expect(askedList).toHaveLength(6);
    });

    test('a status other than 200 says the link is wrong', async () => {
        const { deps } = genDeps({});
        expect(
            await downloadOfficeLinkMedia(
                'https://example.org/gone.png',
                'picture',
                null,
                deps,
            ),
        ).toEqual({
            reason:
                'example.org answered 404 (the link is wrong, or the file ' +
                'is not shared).',
        });
    });

    test('a web page is said from its header, nothing written', async () => {
        const { deps, written, createdDirList } = genDeps({
            'https://example.org/photo/123': {
                headers: { 'content-type': 'text/html; charset=utf-8' },
                chunks: [new TextEncoder().encode('<!doctype html>')],
            },
        });
        const found = await downloadOfficeLinkMedia(
            'https://example.org/photo/123',
            'picture',
            null,
            deps,
        );
        expect(found).toMatchObject({
            reason: expect.stringMatching(/^The link is a web page/),
        });
        expect(written).toEqual({});
        expect(createdDirList).toEqual([]);
    });

    test('a page sent as something else is told by its bytes', async () => {
        const { deps, written } = genDeps({
            'https://example.org/x': {
                headers: { 'content-type': 'application/octet-stream' },
                chunks: [
                    new TextEncoder().encode(
                        '<!doctype html><html><head></head><body>a picture ' +
                            'page that goes on for long enough</body>',
                    ),
                ],
            },
        });
        const found = await downloadOfficeLinkMedia(
            'https://example.org/x',
            'picture',
            null,
            deps,
        );
        expect(found).toMatchObject({
            reason: expect.stringMatching(/^The link is not a picture/),
        });
        expect(written).toEqual({});
    });

    test('a WebP picture is named, and so is a video asked as a picture', async () => {
        const webp = new Uint8Array([
            ...new TextEncoder().encode('RIFF'),
            0,
            0,
            0,
            0,
            ...new TextEncoder().encode('WEBP'),
        ]);
        const mp4 = new Uint8Array([
            0,
            0,
            0,
            0x18,
            ...new TextEncoder().encode('ftypisom'),
        ]);
        const { deps } = genDeps({
            'https://example.org/a.webp': { chunks: [webp] },
            'https://example.org/a.mp4': { chunks: [mp4] },
        });
        expect(
            await downloadOfficeLinkMedia(
                'https://example.org/a.webp',
                'picture',
                null,
                deps,
            ),
        ).toMatchObject({ reason: expect.stringMatching(/^It is a WebP/) });
        expect(
            await downloadOfficeLinkMedia(
                'https://example.org/a.mp4',
                'picture',
                null,
                deps,
            ),
        ).toEqual({
            reason: 'The link is a video or a sound: give it as `media`.',
        });
        expect(
            await downloadOfficeLinkMedia(
                'https://example.org/a.mp4',
                'media',
                null,
                deps,
            ),
        ).toMatchObject({ name: 'a.mp4' });
    });

    test('too big by its header: refused before a byte', async () => {
        const { deps, createdDirList } = genDeps({
            'https://example.org/big.png': {
                headers: { 'content-length': String(30 * 1024 * 1024) },
                chunks: [PNG],
            },
        });
        expect(
            await downloadOfficeLinkMedia(
                'https://example.org/big.png',
                'picture',
                null,
                deps,
            ),
        ).toMatchObject({ reason: expect.stringMatching(/^It is 30 MB/) });
        expect(createdDirList).toEqual([]);
    });

    test('too big as it comes: stopped and its file deleted', async () => {
        const chunk = new Uint8Array(8 * 1024 * 1024);
        chunk.set(PNG);
        const { deps, deletedList } = genDeps({
            'https://example.org/huge.png': {
                chunks: [chunk, chunk, chunk],
            },
        });
        const found = await downloadOfficeLinkMedia(
            'https://example.org/huge.png',
            'picture',
            null,
            deps,
        );
        expect(found).toMatchObject({
            reason: expect.stringMatching(/^It is over 20 MB/),
        });
        expect(deletedList).toEqual([expect.stringMatching(/\/huge\.png$/)]);
    });

    test('a site that cannot be reached, and a stop pressed', async () => {
        const { deps } = genDeps({
            'https://down.example.org/a.png': { error: true },
            'https://slow.example.org/a.png': { silent: true },
        });
        expect(
            await downloadOfficeLinkMedia(
                'https://down.example.org/a.png',
                'picture',
                null,
                deps,
            ),
        ).toEqual({ reason: 'down.example.org could not be reached.' });
        const controller = new AbortController();
        const waiting = downloadOfficeLinkMedia(
            'https://slow.example.org/a.png',
            'picture',
            controller.signal,
            deps,
        );
        controller.abort();
        expect(await waiting).toEqual({ reason: 'Stopped.' });
    });

    test('a site that never answers times out', async () => {
        vi.useFakeTimers();
        try {
            const { deps } = genDeps({
                'https://slow.example.org/a.png': { silent: true },
            });
            const waiting = downloadOfficeLinkMedia(
                'https://slow.example.org/a.png',
                'picture',
                null,
                deps,
            );
            await vi.advanceTimersByTimeAsync(61_000);
            expect(await waiting).toEqual({
                reason: 'slow.example.org took too long to answer.',
            });
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('the link folders', () => {
    beforeEach(() => {
        disk.dirList = [];
        disk.deletedList = [];
        disk.isFolder = true;
    });

    test('older than an hour go, the newer stay', async () => {
        const now = 1_700_000_000_000;
        disk.dirList = [
            `${(now - 2 * 60 * 60 * 1000).toString(36)}-abc`,
            `${(now - 10 * 60 * 1000).toString(36)}-def`,
            'not-a-stamp',
        ];
        await cleanOldOfficeLinkFolders('/tmp/links', now);
        expect(disk.deletedList).toEqual([
            path.join('/tmp/links', disk.dirList[0]),
        ]);
    });

    test('no folder yet, nothing to do', async () => {
        disk.isFolder = false;
        disk.dirList = ['0-a'];
        await cleanOldOfficeLinkFolders('/tmp/links', Date.now());
        expect(disk.deletedList).toEqual([]);
    });
});

describe('the downloads of an ask, once it is over', () => {
    beforeEach(() => {
        disk.deletedList = [];
    });

    test('their folders go; a path outside the link folder never does', async () => {
        await deleteOfficeLinkFiles(
            [
                '/tmp/links/mwq2ouke-o3hy69/w3c.png',
                '/tmp/links/mwq2ouke-o3hy69/w3c (2).png',
                '/tmp/other/mwq2ouke-o3hy69/x.png',
                '/tmp/links/../secret/x.png',
                '/tmp/links/notours/x.png',
            ],
            '/tmp/links',
        );
        expect(disk.deletedList).toEqual([
            path.join('/tmp/links', 'mwq2ouke-o3hy69'),
            path.join('/tmp/links', 'mwq2ouke-o3hy69'),
        ]);
    });
});
