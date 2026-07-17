// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import appProviderMock from './appProvider.mock';

const fileUtils = appProviderMock.fileUtils as any;
const pathUtils = appProviderMock.pathUtils;

describe('server appProvider.mock', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('base64 encode/decode round-trips unicode', () => {
        const encoded = appProviderMock.appUtils.base64Encode('héllo→');
        expect(appProviderMock.appUtils.base64Decode(encoded)).toBe('héllo→');
        appProviderMock.appUtils.handleError(new Error('ignored'));
    });

    test('cryptoUtils encrypt/decrypt and hash adapter', () => {
        const { cryptoUtils } = appProviderMock;
        const secret = cryptoUtils.encrypt('data', 'key');
        expect(cryptoUtils.decrypt(secret, 'key')).toBe('data');
        expect(cryptoUtils.decrypt(secret, 'wrong')).toBe('');
        expect(cryptoUtils.decrypt('not-base64!!', 'key')).toBe('');

        const hash: any = cryptoUtils.createHash('md5');
        hash.update('abc');
        hash.update(new TextEncoder().encode('def').buffer);
        hash.update(new Uint8Array([1, 2, 3]));
        expect(typeof hash.digest()).toBe('string');
        expect(typeof hash.digest('hex')).toBe('string');
        expect(typeof hash.digest('base64')).toBe('string');
    });

    test('path utilities normalize, join, dirname and basename', () => {
        expect(pathUtils.join()).toBe('.');
        expect(pathUtils.join('a', 'b', '..', 'c')).toBe('a/c');
        expect(pathUtils.resolve('/a', 'b')).toBe('/a/b');
        expect(pathUtils.dirname('/a/b')).toBe('/a');
        expect(pathUtils.dirname('/a')).toBe('/');
        expect(pathUtils.dirname('a')).toBe('.');
        expect(pathUtils.dirname('/')).toBe('/');
        expect(pathUtils.basename('/a/b')).toBe('b');
        expect(pathUtils.basename('/')).toBe('/');
        expect(pathUtils.basename('solo')).toBe('solo');
        // windows drive handling
        expect(pathUtils.dirname('C:\\Users\\a')).toBe('C:/Users');
        expect(pathUtils.dirname('C:\\')).toBe('C:/');
        expect(pathUtils.join('C:\\a', 'b')).toBe('C:/a/b');
    });

    test('sync file operations write, read and remove', () => {
        fileUtils.writeFileSync('/tmp/file.txt', 'hello world');
        expect(fileUtils.existsSync('/tmp/file.txt')).toBe(true);
        expect(fileUtils.readFileSync('/tmp/file.txt', 'utf8')).toBe(
            'hello world',
        );
        expect(fileUtils.readFileSync('/tmp/file.txt')).toBeInstanceOf(
            Uint8Array,
        );
        fileUtils.mkdirSync('/tmp/sub');
        expect(fileUtils.existsSync('/tmp/sub')).toBe(true);

        // fd based reads
        const fd = fileUtils.openSync('/tmp/file.txt');
        const buffer = new Uint8Array(5);
        const read = fileUtils.readSync(fd, buffer, 0, 5, 0);
        expect(read).toBe(5);
        expect(fileUtils.fstatSync(fd).size).toBe('hello world'.length);
        fileUtils.closeSync(fd);
        expect(fileUtils.readSync(999, buffer, 0, 5, 0)).toBe(0);

        // gzip is a passthrough
        const bytes = new Uint8Array([9, 8, 7]);
        expect(fileUtils.gunzipSync(bytes)).toBe(bytes);

        fileUtils.writeFileFromBase64Sync(
            '/tmp/img.bin',
            'data:application/octet-stream;base64,QUJD',
        );
        expect(fileUtils.readFileSync('/tmp/img.bin', 'utf8')).toBe('ABC');
        fileUtils.writeFileFromBase64Sync('/tmp/img2.bin', 'QUJD');
        expect(fileUtils.readFileSync('/tmp/img2.bin', 'utf8')).toBe('ABC');

        fileUtils.unlinkSync('/tmp/file.txt');
        expect(fileUtils.existsSync('/tmp/file.txt')).toBe(false);
        expect(() => fileUtils.unlinkSync('/missing.txt')).toThrow();
    });

    test('async callback file operations succeed and surface errors', async () => {
        const run = (fn: (cb: any) => void) =>
            new Promise<{ error: any; data: any }>((resolve) => {
                fn((error: any, data: any) => resolve({ error, data }));
            });

        fileUtils.writeFileSync('/adir/a.txt', 'A');
        fileUtils.writeFileSync('/adir/b.txt', 'B');

        expect(
            (await run((cb) => fileUtils.readdir('/adir', cb))).data,
        ).toEqual(['a.txt', 'b.txt']);
        expect(
            (await run((cb) => fileUtils.readdir('/nope', cb))).data,
        ).toEqual([]);

        expect(
            (
                await run((cb) => fileUtils.stat('/adir/a.txt', cb))
            ).data.isFile(),
        ).toBe(true);
        expect(
            (await run((cb) => fileUtils.stat('/missing', cb))).error,
        ).toBeInstanceOf(Error);

        expect(
            (await run((cb) => fileUtils.mkdir('/mk', {}, cb))).error,
        ).toBeNull();
        expect(
            (await run((cb) => fileUtils.writeFile('/w.txt', 'x', {}, cb)))
                .error,
        ).toBeNull();
        expect(
            (
                await run((cb) =>
                    fileUtils.rename('/adir/a.txt', '/adir/c.txt', cb),
                )
            ).error,
        ).toBeNull();
        expect(
            (await run((cb) => fileUtils.rename('/x', '/y', cb))).error,
        ).toBeInstanceOf(Error);
        expect(
            (await run((cb) => fileUtils.unlink('/adir/b.txt', cb))).error,
        ).toBeNull();
        expect(
            (await run((cb) => fileUtils.unlink('/nope', cb))).error,
        ).toBeInstanceOf(Error);
        expect(
            (await run((cb) => fileUtils.rmdir('/mk', {}, cb))).error,
        ).toBeNull();
        expect(
            (await run((cb) => fileUtils.readFile('/adir/c.txt', 'utf8', cb)))
                .data,
        ).toBe('A');
        expect(
            (await run((cb) => fileUtils.readFile('/adir/c.txt', {}, cb))).data,
        ).toBeInstanceOf(Uint8Array);
        expect(
            (await run((cb) => fileUtils.readFile('/nope', 'utf8', cb))).error,
        ).toBeInstanceOf(Error);
    });

    test('directory rename and removal move nested files', () => {
        fileUtils.writeFileSync('/src/inner/x.txt', 'X');
        fileUtils.writeFileSync('/src/y.txt', 'Y');
        fileUtils.rename('/src', '/dst', () => {});
        expect(fileUtils.existsSync('/dst/inner/x.txt')).toBe(true);
        expect(fileUtils.existsSync('/dst/y.txt')).toBe(true);

        fileUtils.rmdir('/dst', {}, () => {});
        expect(fileUtils.existsSync('/dst/y.txt')).toBe(false);
    });

    test('readExternal, copyFile and copyBlobFile use fetch when needed', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            // returned as a typed array so it survives the mock's
            // cross-realm `instanceof ArrayBuffer` check
            arrayBuffer: async () => new TextEncoder().encode('remote'),
        }));
        vi.stubGlobal('fetch', fetchMock);

        await new Promise<void>((resolve) => {
            fileUtils.copyFile('/remote/file', '/copied.txt', () => resolve());
        });
        expect(fileUtils.readFileSync('/copied.txt', 'utf8')).toBe('remote');

        const blobErr = await new Promise((resolve) => {
            fileUtils.copyBlobFile('blob:xyz', '/blob.txt', (e: any) =>
                resolve(e ?? null),
            );
        });
        expect(blobErr).toBeNull();
        expect(fileUtils.existsSync('/blob.txt')).toBe(true);

        const failFetch = vi.fn(async () => ({ ok: false }));
        vi.stubGlobal('fetch', failFetch);
        const error = await new Promise((resolve) => {
            fileUtils.copyFile('/bad/file', '/x.txt', (err: any) =>
                resolve(err),
            );
        });
        expect(error).toBeInstanceOf(Error);

        expect(fileUtils.watch('/f', {}, () => {})).toHaveProperty('close');
    });

    test('browserUtils and systemUtils resolve paths, mime types and hashes', () => {
        const openMock = vi.fn();
        vi.stubGlobal('open', openMock);

        expect(appProviderMock.browserUtils.pathToFileURL('https://x')).toBe(
            'https://x',
        );
        fileUtils.writeFileSync('/assets/a.html', '<p>hi</p>');
        expect(
            appProviderMock.browserUtils.pathToFileURL('/assets/a.html'),
        ).toContain('data:text/html;base64,');
        // various mime types
        for (const [name, mime] of [
            ['a.json', 'application/json'],
            ['a.txt', 'text/plain'],
            ['a.svg', 'image/svg+xml'],
            ['a.png', 'image/png'],
            ['a.jpg', 'image/jpeg'],
            ['a.bin', 'application/octet-stream'],
        ] as const) {
            fileUtils.writeFileSync(`/assets/${name}`, 'x');
            expect(
                appProviderMock.browserUtils.pathToFileURL(`/assets/${name}`),
            ).toContain(`data:${mime}`);
        }
        // not-found path falls back to a resolved URL
        expect(
            appProviderMock.browserUtils.pathToFileURL('/missing/thing'),
        ).toContain('http');

        appProviderMock.browserUtils.openExternalURL('https://ex');
        expect(openMock).toHaveBeenCalled();

        appProviderMock.systemUtils.copyToClipboard('clip');
        appProviderMock.systemUtils.openFile('/assets/a.html');
        expect(typeof appProviderMock.systemUtils.generateMD5('abc')).toBe(
            'string',
        );
    });

    test('generateFileMD5 hashes contents or falls back to the path', async () => {
        fileUtils.writeFileSync('/hash/file.txt', 'content');
        expect(
            typeof (await appProviderMock.systemUtils.generateFileMD5(
                '/hash/file.txt',
            )),
        ).toBe('string');

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('offline');
            }),
        );
        expect(
            typeof (await appProviderMock.systemUtils.generateFileMD5(
                '/not/in/fs',
            )),
        ).toBe('string');
    });

    test('message utils dispatch to listeners', () => {
        const listener = vi.fn();
        appProviderMock.messageUtils.listenForData('test:channel', listener);
        appProviderMock.messageUtils.sendData('test:channel', 'payload');

        const onceListener = vi.fn();
        appProviderMock.messageUtils.listenOnceForData(
            'once:channel',
            onceListener,
        );
        appProviderMock.messageUtils.sendData('once:channel', 'a');
        appProviderMock.messageUtils.sendData('once:channel', 'b');
        expect(onceListener).toHaveBeenCalledTimes(1);
    });

    test('database, yt and misc utilities are callable', async () => {
        const db =
            await appProviderMock.databaseUtils.getSQLiteDatabaseInstance('db');
        db.database.exec('SELECT 1');
        const stmt = db.database.prepare('SELECT 1');
        expect(stmt.all()).toEqual([]);
        expect(stmt.get()).toBeNull();
        stmt.run();
        db.database.createSession({});
        db.database.applyChangeset({}, {});
        db.database.open();
        db.database.close();
        db.exec('x');
        db.createTable('x');
        expect(db.getAll('x')).toEqual([]);
        db.close();

        const yt = await appProviderMock.ytUtils.getYTHelper();
        expect(yt.on('x', () => {})).toBe(yt);
        expect(yt.off('x', () => {})).toBe(yt);
        expect(yt.exec([])).toBe(yt);

        expect(appProviderMock.fontUtils.getFonts()).resolves.toEqual({});
        expect(appProviderMock.getIsMouseOverApp()).toBe(false);
        expect(typeof appProviderMock.getIsWindowFocused()).toBe('boolean');

        const dispatchSpy = vi.spyOn(globalThis, 'dispatchEvent');
        try {
            appProviderMock.reload();
        } catch {
            // jsdom location.reload is not implemented; the event still fired
        }
        expect(dispatchSpy).toHaveBeenCalled();

        // init runs the lyric mock which early-returns off the lyric page
        await expect(appProviderMock.init()).resolves.toBeUndefined();
    });

    test('httpUtils.request is unimplemented', () => {
        expect(() => appProviderMock.httpUtils.request({} as any)).toThrow(
            'does not implement',
        );
    });
});
