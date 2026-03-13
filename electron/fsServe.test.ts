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
import { createMockWebContents } from './testUtils';

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

        expect(electronMockState.net.fetch).toHaveBeenCalledWith(
            'file:///mock-app/dist/screen.html',
        );
    });

    test('falls back to presenter for missing local file', async () => {
        statSync.mockImplementation(() => {
            throw Object.assign(new Error('missing file'), { code: 'ENOENT' });
        });

        initCustomSchemeHandler();

        const handler = electronMockState.protocol.handle.mock.calls[0][1];
        await handler({ url: `${rootUrl}/missing.html` });

        expect(electronMockState.net.fetch).toHaveBeenCalledWith(
            'file:///mock-app/dist/presenter.html',
        );
    });

    test('passes through access URLs and injects CORS headers', async () => {
        initCustomSchemeHandler();

        const handler = electronMockState.protocol.handle.mock.calls[0][1];
        await handler({ url: `${rootUrlAccess}/tmp/document.pdf` });

        expect(electronMockState.net.fetch).toHaveBeenCalledWith(
            'file:///tmp/document.pdf',
        );

        const onHeadersReceived =
            electronMockState.session.defaultSession.webRequest
                .onHeadersReceived;
        const callback = vi.fn();
        onHeadersReceived.mock.calls[0][1](
            { responseHeaders: { existing: ['x'] } },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({
            responseHeaders: {
                existing: ['x'],
                'access-control-allow-headers': ['x-api-key', 'content-type'],
                'access-control-allow-origin': ['*'],
            },
        });
    });
});
