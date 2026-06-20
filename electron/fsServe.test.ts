import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { statSync } = vi.hoisted(() => ({
    statSync: vi.fn(),
}));

vi.mock('node:fs', () => {
    return {
        default: { statSync },
        statSync,
    };
});

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    getCurrent,
    htmlFiles,
    initCustomSchemeHandler,
    rootUrl,
    rootUrlAccess,
    toTitleCase,
} from './fsServe';
import { electronMockState } from './testElectronModule';

describe('fsServe', () => {
    beforeEach(() => {
        electronMockState.reset();
        statSync.mockReset();
    });

    test('capitalizes the first character', () => {
        expect(toTitleCase('presenter')).toBe('Presenter');
    });

    test('returns valid current html file and falls back to presenter', () => {
        expect(
            getCurrent({
                getURL: () => 'https://localhost:3000/setting.html?tab=general',
            } as any),
        ).toBe(htmlFiles.setting);

        expect(
            getCurrent({
                getURL: () => 'https://localhost:3000/unknown.html',
            } as any),
        ).toBe(htmlFiles.presenter);
    });

    test('registers scheme handler and resolves local files', async () => {
        statSync.mockReturnValue({ isFile: () => true });

        initCustomSchemeHandler();

        const handler = electronMockState.protocol.handle.mock.calls[0][1];
        await handler({ url: `${rootUrl}/${htmlFiles.screen}` });

        const expectedPath = `file://${path.resolve('/mock-app', 'dist', 'screen.html')}`;
        expect(electronMockState.net.fetch).toHaveBeenCalledWith(expectedPath);
    });

    test('falls back to presenter for missing local file', async () => {
        statSync.mockImplementation(() => {
            throw Object.assign(new Error('missing file'), { code: 'ENOENT' });
        });

        initCustomSchemeHandler();

        const handler = electronMockState.protocol.handle.mock.calls[0][1];
        await handler({ url: `${rootUrl}/missing.html` });

        const expectedPath = `file://${path.resolve('/mock-app', 'dist', 'presenter.html')}`;
        expect(electronMockState.net.fetch).toHaveBeenCalledWith(expectedPath);
    });

    test('passes through access URLs and injects CORS headers', async () => {
        initCustomSchemeHandler();

        const handler = electronMockState.protocol.handle.mock.calls[0][1];
        await handler({ url: `${rootUrlAccess}/tmp/document.pdf` });

        expect(electronMockState.net.fetch).toHaveBeenCalledWith(
            'file:///tmp/document.pdf',
        );

        const onBeforeSendHeaders =
            electronMockState.session.defaultSession.webRequest
                .onBeforeSendHeaders;
        expect(onBeforeSendHeaders.mock.calls[0][0]).toEqual({
            urls: ['http://*/*', 'https://*/*'],
        });
        const requestCallback = vi.fn();
        onBeforeSendHeaders.mock.calls[0][1](
            {
                id: 7,
                requestHeaders: {
                    Origin: 'https://www.youtube-nocookie.com',
                },
            },
            requestCallback,
        );
        expect(requestCallback).toHaveBeenCalledWith({
            requestHeaders: {
                Origin: 'https://www.youtube-nocookie.com',
            },
        });

        const onHeadersReceived =
            electronMockState.session.defaultSession.webRequest
                .onHeadersReceived;
        expect(onHeadersReceived.mock.calls[0][0]).toEqual({
            urls: ['http://*/*', 'https://*/*'],
        });

        const callback = vi.fn();
        onHeadersReceived.mock.calls[0][1](
            {
                id: 7,
                responseHeaders: {
                    existing: ['x'],
                    'Access-Control-Allow-Headers': ['content-type'],
                    'access-control-allow-origin': ['*'],
                },
            },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({
            responseHeaders: {
                existing: ['x'],
                'Access-Control-Allow-Headers': [
                    'authorization',
                    'content-type',
                    'x-api-key',
                    'x-goog-api-key',
                ],
                'access-control-allow-methods': [
                    'GET',
                    'POST',
                    'PUT',
                    'PATCH',
                    'DELETE',
                    'OPTIONS',
                ],
                'access-control-allow-origin': [
                    'https://www.youtube-nocookie.com',
                ],
                'access-control-allow-credentials': ['true'],
                'access-control-expose-headers': ['*'],
            },
        });
    });

    test('adds an HTTP referrer to external requests from the production app scheme', () => {
        initCustomSchemeHandler();

        const onBeforeSendHeaders =
            electronMockState.session.defaultSession.webRequest
                .onBeforeSendHeaders;
        const requestCallback = vi.fn();
        onBeforeSendHeaders.mock.calls[0][1](
            {
                id: 8,
                url: 'https://example.com/resource.json',
                referrer: `${rootUrl}/${htmlFiles.bibleNote}`,
                requestHeaders: {},
            },
            requestCallback,
        );

        expect(requestCallback).toHaveBeenCalledWith({
            requestHeaders: {
                referer: 'https://www.openworship.app/',
            },
        });
    });

    test('keeps existing HTTP referrers on external requests', () => {
        initCustomSchemeHandler();

        const onBeforeSendHeaders =
            electronMockState.session.defaultSession.webRequest
                .onBeforeSendHeaders;
        const requestCallback = vi.fn();
        onBeforeSendHeaders.mock.calls[0][1](
            {
                id: 9,
                url: 'https://example.com/resource.json',
                requestHeaders: {
                    Referer: 'https://example.org/current-page',
                },
            },
            requestCallback,
        );

        expect(requestCallback).toHaveBeenCalledWith({
            requestHeaders: {
                Referer: 'https://example.org/current-page',
            },
        });
    });
});
