import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { findLangPluginAssetFilePath } = vi.hoisted(() => ({
    findLangPluginAssetFilePath: vi.fn(),
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./langPluginHelpers', () => ({ findLangPluginAssetFilePath }));

import { initCustomSchemeHandler, rootUrl } from './fsServe';
import { LANG_PLUGIN_ROUTE_SEGMENT } from './langPluginProtocol';
import { electronMockState } from './testElectronModule';

function getHandler() {
    initCustomSchemeHandler();
    return electronMockState.protocol.handle.mock.calls[0][1] as (request: {
        url: string;
        referrer?: string;
    }) => Promise<Response>;
}

const fontUrl = `${rootUrl}/${LANG_PLUGIN_ROUTE_SEGMENT}/xx/fonts/face.woff2`;

describe('fsServe language plugin route', () => {
    beforeEach(() => {
        electronMockState.reset();
        findLangPluginAssetFilePath.mockReset();
        electronMockState.net.fetch.mockReset();
    });

    test('answers 404 and reads nothing for a file no plugin holds', async () => {
        findLangPluginAssetFilePath.mockReturnValue(null);

        const response = await getHandler()({ url: fontUrl });

        expect(findLangPluginAssetFilePath).toHaveBeenCalledWith(
            `/${LANG_PLUGIN_ROUTE_SEGMENT}/xx/fonts/face.woff2`,
        );
        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not Found');
        expect(electronMockState.net.fetch).not.toHaveBeenCalled();
    });

    test('serves the plugin file open to any origin, keeping its own headers and status', async () => {
        const filePath = path.resolve(
            '/mock-data',
            'lang',
            'xx@1',
            'face.woff2',
        );
        findLangPluginAssetFilePath.mockReturnValue(filePath);
        electronMockState.net.fetch.mockResolvedValue(
            new Response('font-bytes', {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'font/woff2' },
            }),
        );

        const response = await getHandler()({
            url: fontUrl,
            referrer: 'https://localhost:3000/presenter.html',
        });

        expect(electronMockState.net.fetch).toHaveBeenCalledWith(
            pathToFileURL(filePath).href,
        );
        expect(response.status).toBe(200);
        expect(response.statusText).toBe('OK');
        expect(response.headers.get('content-type')).toBe('font/woff2');
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(await response.text()).toBe('font-bytes');
    });

    test('passes a failed read through with its own status', async () => {
        findLangPluginAssetFilePath.mockReturnValue(
            path.resolve('/mock-data', 'lang', 'xx@1', 'gone.json'),
        );
        electronMockState.net.fetch.mockResolvedValue(
            new Response(null, { status: 500, statusText: 'Broken' }),
        );

        const response = await getHandler()({ url: fontUrl });

        expect(response.status).toBe(500);
        expect(response.statusText).toBe('Broken');
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    test('does not send an ordinary page through the plugin route', async () => {
        await getHandler()({ url: `${rootUrl}/presenter.html` });

        expect(findLangPluginAssetFilePath).not.toHaveBeenCalled();
    });
});
