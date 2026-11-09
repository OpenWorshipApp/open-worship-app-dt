import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type * as RouterModule from './screenMirrorRouter';

// What a browser watching a virtual display may read of the language plugins:
// the list (never a path on this computer) and each enabled plugin's files --
// and nothing for a viewer the display does not admit.

const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    findLangPluginAssetFilePath: vi.fn(),
    getLangPlugins: vi.fn(),
}));
vi.mock('electron', () => ({
    app: { once: vi.fn(), getAppPath: () => process.cwd() },
    powerSaveBlocker: { start: vi.fn(() => 1), stop: vi.fn() },
    screen: {
        on: vi.fn(),
        getAllDisplays: () => [],
        getPrimaryDisplay: () => ({ id: 1 }),
    },
    BrowserWindow: { getAllWindows: () => [] },
    ipcMain: { on: vi.fn() },
}));
vi.mock('./screenMirrorRouter', async (importOriginal) => ({
    ...(await importOriginal<typeof RouterModule>()),
    findRouterGateway: vi.fn(async () => null),
    getRouterExternalAddress: vi.fn(async () => ''),
    lookUpPublicAddress: vi.fn(async () => ''),
    openRouterPort: vi.fn(),
    probeRouterPort: vi.fn(async () => 'unknown'),
    renewRouterPort: vi.fn(),
    closeRouterPort: vi.fn(async () => undefined),
}));
vi.mock('./ElectronSettingManager', () => ({
    default: {
        getInstance: () => ({
            getClientSetting: (key: string) => fixture.client.get(key),
            setClientSetting: (key: string, value: string) =>
                fixture.client.set(key, value),
            getSecureSetting: (key: string) => fixture.secure.get(key),
            setSecureSetting: (key: string, value: string) =>
                fixture.secure.set(key, value),
        }),
    },
}));
vi.mock('./ElectronScreenController', () => ({
    default: { getInstance: () => null },
}));
vi.mock('./protocolHelpers', () => ({ getRootUrl: () => 'owa://local' }));
vi.mock('./electronHelpers', () => ({
    isDev: false,
    messageChannels: { screenMessage: 'screen-message' },
}));
vi.mock('./langPluginHelpers', () => ({
    findLangPluginAssetFilePath: fixture.findLangPluginAssetFilePath,
    getLangPlugins: fixture.getLangPlugins,
}));

import { ScreenMirrorService } from './screenMirrorService';

let service: ScreenMirrorService;
let directory: string;

async function useFreePort() {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    fixture.client.set('screen-mirror-port', String(port));
}

function mockHttpRequest(url: string, method: string, remoteAddress: string) {
    return {
        method,
        url,
        headers: { host: `127.0.0.1:${service.port}` },
        socket: { remoteAddress },
    } as any;
}

// A response the file server can pipe a read stream into.
function mockHttpResponse() {
    const response = new EventEmitter() as any;
    response.statusCode = 0;
    response.headers = {} as Record<string, string | number>;
    response.headersSent = false;
    response.body = Buffer.alloc(0);
    response.writableEnded = false;
    response.setHeader = (name: string, value: string | number) => {
        response.headers[name.toLowerCase()] = value;
        return response;
    };
    response.writeHead = (
        statusCode: number,
        headers: Record<string, string | number> = {},
    ) => {
        response.statusCode = statusCode;
        response.headersSent = true;
        for (const [name, value] of Object.entries(headers)) {
            response.headers[name.toLowerCase()] = value;
        }
        return response;
    };
    response.write = (chunk: Buffer | string) => {
        response.body = Buffer.concat([
            response.body,
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
        ]);
        return true;
    };
    response.end = (chunk?: Buffer | string) => {
        if (chunk !== undefined) response.write(chunk);
        response.writableEnded = true;
        response.emit('finish');
        return response;
    };
    response.destroy = vi.fn(() => response.emit('close'));
    return response;
}

async function handleHttp(
    pathname: string,
    method = 'GET',
    remoteAddress = '192.168.1.7',
) {
    const req = mockHttpRequest(pathname, method, remoteAddress);
    const res = mockHttpResponse();
    await (service as any).handleHttp(req, res);
    await vi.waitFor(() => expect(res.writableEnded).toBe(true));
    return res;
}

beforeEach(async () => {
    fixture.client.clear();
    fixture.secure.clear();
    fixture.findLangPluginAssetFilePath.mockReset();
    fixture.getLangPlugins.mockReset();
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-mirror-lang-'));
    fixture.client.set('screen-mirror-host', 'true');
    await useFreePort();
    service = new ScreenMirrorService();
    await service.start();
    // A virtual display shared on the local network admits its viewers there.
    service.setVirtualDisplayHooks({
        route: (_req, res) => {
            res.writeHead(200).end();
        },
        upgrade: () => {},
        admits: (network) => network === 'local',
        onNetworkChanged: () => {},
    });
});

afterEach(async () => {
    service.stop();
    await rm(directory, { recursive: true, force: true });
});

describe('the language plugins a virtual display viewer reads', () => {
    test('lists only the enabled plugins, with no path of this computer', async () => {
        fixture.getLangPlugins.mockReturnValue([
            {
                langCode: 'xx',
                version: '1.0.0',
                isEnabled: true,
                dirPath: 'C:/data/lang/xx@1.0.0',
                removableDirPaths: ['C:/data/lang/xx@0.9.0'],
            },
            {
                langCode: 'yy',
                version: '2.0.0',
                isEnabled: false,
                dirPath: 'C:/data/lang/yy@2.0.0',
                removableDirPaths: [],
            },
        ]);

        const res = await handleHttp('/@lang/plugins.json');

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe(
            'application/json; charset=utf-8',
        );
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(JSON.parse(res.body.toString())).toEqual([
            {
                langCode: 'xx',
                version: '1.0.0',
                isEnabled: true,
                dirPath: '',
                removableDirPaths: [],
            },
        ]);
        expect(res.body.toString()).not.toContain('C:/data');
    });

    test('a HEAD for the list answers its headers and no body', async () => {
        fixture.getLangPlugins.mockReturnValue([]);

        const res = await handleHttp('/@lang/plugins.json', 'HEAD');

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(0);
    });

    test("serves a plugin's own file from wherever the plugin is installed", async () => {
        const filePath = path.join(directory, 'dictionary.json');
        await writeFile(filePath, '{"Hello":"Hi"}');
        fixture.findLangPluginAssetFilePath.mockReturnValue(filePath);

        const res = await handleHttp('/@lang/xx/dictionary.json');

        expect(fixture.findLangPluginAssetFilePath).toHaveBeenCalledWith(
            '/@lang/xx/dictionary.json',
        );
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('application/json');
        expect(res.body.toString()).toBe('{"Hello":"Hi"}');
    });

    test('a file no installed plugin holds is not found', async () => {
        fixture.findLangPluginAssetFilePath.mockReturnValue(null);

        const res = await handleHttp('/@lang/xx/fonts/face.woff2');

        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveLength(0);
    });

    test('nothing of the plugins is read for a path out of the pattern or a viewer not admitted', async () => {
        fixture.getLangPlugins.mockReturnValue([]);
        fixture.findLangPluginAssetFilePath.mockReturnValue(
            path.join(directory, 'secret.txt'),
        );

        const climbing = await handleHttp('/@lang/xx/../../setting.json');
        const unlisted = await handleHttp('/@lang/xx/secret.txt');
        const internet = await handleHttp(
            '/@lang/plugins.json',
            'GET',
            '198.51.100.9',
        );

        expect(climbing.statusCode).toBe(404);
        expect(unlisted.statusCode).toBe(404);
        expect(internet.statusCode).toBe(404);
        expect(fixture.findLangPluginAssetFilePath).not.toHaveBeenCalled();
        expect(fixture.getLangPlugins).not.toHaveBeenCalled();
    });
});
