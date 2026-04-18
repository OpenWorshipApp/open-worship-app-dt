import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? this.store.get(key) : null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    return {
        MockCacheManager,
        appApiFetchMock: vi.fn(),
        cacheStores,
        fsCheckDirExistMock: vi.fn(),
        fsDeleteFileMock: vi.fn(),
        fsListDirectoriesMock: vi.fn(),
        getBibleInfoMock: vi.fn(),
        getBibleXMLCacheInfoListMock: vi.fn(),
        getFileNameMock: vi.fn(),
        getWritableBiblePathMock: vi.fn(),
        handleErrorMock: vi.fn(),
        pathBasenameMock: vi.fn(),
        pathJoinMock: vi.fn((...parts: string[]) => parts.join('/').replaceAll('//', '/')),
        requestMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
        },
        showSimpleToastMock: vi.fn(),
        tarExtractMock: vi.fn(),
        toBiblePathMock: vi.fn(),
        writeStreamToFileMock: vi.fn(),
    };
});

vi.mock('../errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../../_owa-crypto', () => ({
    get_api_key: () => 'api-key',
    get_api_url: () => 'https://api.example.com',
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        httpUtils: {
            request: mocks.requestMock,
        },
        pathUtils: {
            join: mocks.pathJoinMock,
        },
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: mocks.fsCheckDirExistMock,
    fsDeleteFile: mocks.fsDeleteFileMock,
    fsListDirectories: mocks.fsListDirectoriesMock,
    getFileName: mocks.getFileNameMock,
    pathBasename: mocks.pathBasenameMock,
}));

vi.mock('./bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfoMock,
}));

vi.mock('../networkHelpers', () => ({
    appApiFetch: mocks.appApiFetchMock,
}));

vi.mock('../../server/appHelpers', () => ({
    tarExtract: mocks.tarExtractMock,
}));

vi.mock('./downloadHelpers', () => ({
    writeStreamToFile: mocks.writeStreamToFileMock,
}));

vi.mock('../../setting/bible-setting/bibleXMLHelpers', () => ({
    getBibleXMLCacheInfoList: mocks.getBibleXMLCacheInfoListMock,
}));

vi.mock('./BibleDataReader', () => ({
    bibleDataReader: {
        getWritableBiblePath: mocks.getWritableBiblePathMock,
        toBiblePath: mocks.toBiblePathMock,
    },
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
}));

async function loadModule() {
    return await import('./bibleDownloadHelpers');
}

describe('bibleDownloadHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.getWritableBiblePathMock.mockResolvedValue('/data/bibles');
        mocks.toBiblePathMock.mockResolvedValue('/data/bibles/KJV.tar');
        mocks.fsDeleteFileMock.mockResolvedValue(undefined);
        mocks.fsCheckDirExistMock.mockResolvedValue(true);
        mocks.pathBasenameMock.mockReturnValue('KJV.tar');
        mocks.getFileNameMock.mockReturnValue('KJV');
        mocks.fsListDirectoriesMock.mockResolvedValue([]);
        mocks.getBibleXMLCacheInfoListMock.mockResolvedValue([]);
        mocks.getBibleInfoMock.mockResolvedValue(null);
        mocks.requestMock.mockImplementation((options: any, callback: (response: any) => void) => {
            const handlers: Record<string, (error: Error) => void> = {};
            const request = {
                end: vi.fn(),
                on: vi.fn((event: string, handler: (error: Error) => void) => {
                    handlers[event] = handler;
                    return request;
                }),
            };
            (request as any).__callback = callback;
            (request as any).__handlers = handlers;
            (request as any).__options = options;
            return request;
        });
    });

    test('requests bible downloads with api headers, follows redirects, and surfaces request errors', async () => {
        const { httpsRequestBible } = await loadModule();
        const callback = vi.fn();

        httpsRequestBible('/redirect-me', callback);
        const firstRequest = mocks.requestMock.mock.results[0]?.value;
        expect(firstRequest.__options).toMatchObject({
            headers: { 'x-api-key': 'api-key' },
            hostname: 'api.example.com',
            method: 'GET',
            path: '/redirect-me',
            port: 443,
        });
        firstRequest.__callback({
            headers: { location: '/final' },
            statusCode: 302,
        });

        const redirectedRequest = mocks.requestMock.mock.results[1]?.value;
        redirectedRequest.__callback({ headers: {}, statusCode: 200 });
        expect(callback).toHaveBeenCalledWith(null, { headers: {}, statusCode: 200 });

        httpsRequestBible('/broken', callback);
        const failedRequest = mocks.requestMock.mock.results[2]?.value;
        failedRequest.__handlers.error(new Error('network down'));
        expect(callback).toHaveBeenLastCalledWith(expect.any(Error));
    });

    test('starts and performs bible downloads through the writable bible path', async () => {
        const { downloadBible, startDownloadBible } = await loadModule();
        const onDone = vi.fn();
        const options = { onDone, onProgress: vi.fn() } as any;

        mocks.toBiblePathMock.mockResolvedValueOnce(null);
        await startDownloadBible({ bibleFileFullName: '/missing.tar', options });
        expect(onDone).toHaveBeenCalledWith(expect.any(Error));

        await startDownloadBible({ bibleFileFullName: '/KJV.tar', options });
        const request = mocks.requestMock.mock.results.at(-1)?.value;
        const response = { headers: {}, statusCode: 200 };
        request.__callback(response);
        expect(mocks.writeStreamToFileMock).toHaveBeenCalledWith(
            '/data/bibles/KJV.tar',
            options,
            response,
        );

        const onDoneInvalid = vi.fn();
        await downloadBible({
            bibleInfo: { key: 'KJV', locale: 'en-US', title: 'KJV', version: 1 },
            options: { onDone: onDoneInvalid } as any,
        });
        expect(onDoneInvalid).toHaveBeenCalledWith(expect.any(Error));

        mocks.getWritableBiblePathMock.mockResolvedValueOnce(null);
        const onDoneNoPath = vi.fn();
        await downloadBible({
            bibleInfo: {
                filePath: 'bibles/KJV.tar',
                key: 'KJV',
                locale: 'en-US',
                title: 'KJV',
                version: 1,
            },
            options: { onDone: onDoneNoPath } as any,
        });
        expect(onDoneNoPath).toHaveBeenCalledWith(expect.any(Error));
    });

    test('extracts downloaded bibles and reports extraction and cleanup failures', async () => {
        const { BIBLE_DOWNLOAD_TOAST_TITLE, extractDownloadedBible } = await loadModule();

        expect(await extractDownloadedBible('/tmp/KJV.tar')).toBe(true);
        expect(mocks.tarExtractMock).toHaveBeenCalledWith('/tmp/KJV.tar', '/data/bibles');
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            BIBLE_DOWNLOAD_TOAST_TITLE,
            'Bible extracted',
        );

        mocks.tarExtractMock.mockRejectedValueOnce(new Error('extract failed'));
        mocks.fsDeleteFileMock.mockRejectedValueOnce(new Error('delete failed'));
        expect(await extractDownloadedBible('/tmp/WEB.tar')).toBe(false);
        await Promise.resolve();
        expect(mocks.handleErrorMock).toHaveBeenCalled();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            BIBLE_DOWNLOAD_TOAST_TITLE,
            'Fail to extract bible',
        );
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            BIBLE_DOWNLOAD_TOAST_TITLE,
            'Fail to delete downloaded file',
        );
    });

    test('loads online and local bible metadata and caches the merged local list', async () => {
        const {
            getAllLocalBibleInfoList,
            getDownloadedBibleInfoList,
            getOnlineBibleInfoList,
        } = await loadModule();

        mocks.appApiFetchMock.mockResolvedValueOnce({
            json: async () => ({
                mapper: {
                    KJV: {
                        filePath: 'bibles/KJV.tar',
                        locale: 'en-US',
                        title: 'King James Version',
                        version: 1,
                    },
                },
            }),
        });
        expect(await getOnlineBibleInfoList()).toEqual([
            {
                filePath: 'bibles/KJV.tar',
                key: 'KJV',
                locale: 'en-US',
                title: 'King James Version',
                version: 1,
            },
        ]);

        mocks.appApiFetchMock.mockResolvedValueOnce({
            json: async () => ({ mapper: null }),
        });
        expect(await getOnlineBibleInfoList()).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalled();

        mocks.getWritableBiblePathMock.mockResolvedValueOnce('/data/bibles');
        mocks.fsListDirectoriesMock.mockResolvedValueOnce(['KJV', 'bad.cache', 'WEB']);
        mocks.getBibleInfoMock
            .mockResolvedValueOnce({ key: 'KJV', locale: 'en-US', title: 'KJV', version: 1 })
            .mockResolvedValueOnce(null);

        expect(await getDownloadedBibleInfoList()).toEqual([
            { key: 'KJV', locale: 'en-US', title: 'KJV', version: 1 },
        ]);

        mocks.fsListDirectoriesMock.mockRejectedValueOnce(new Error('cannot list'));
        await expect(getDownloadedBibleInfoList()).rejects.toThrow('cannot list');

        mocks.fsListDirectoriesMock.mockResolvedValueOnce(['KJV']);
        mocks.getBibleInfoMock.mockResolvedValueOnce({
            key: 'KJV',
            locale: 'en-US',
            title: 'KJV',
            version: 1,
        });
        mocks.getBibleXMLCacheInfoListMock.mockResolvedValueOnce([
            { key: 'XML', locale: 'km-KH', title: 'Khmer XML', version: 2 },
        ]);

        expect(await getAllLocalBibleInfoList()).toEqual([
            { key: 'KJV', locale: 'en-US', title: 'KJV', version: 1 },
            {
                isXML: true,
                key: 'XML',
                locale: 'km-KH',
                title: 'Khmer XML',
                version: 2,
            },
        ]);

        expect(await getAllLocalBibleInfoList()).toEqual([
            { key: 'KJV', locale: 'en-US', title: 'KJV', version: 1 },
            {
                isXML: true,
                key: 'XML',
                locale: 'km-KH',
                title: 'Khmer XML',
                version: 2,
            },
        ]);
        expect(mocks.fsListDirectoriesMock).toHaveBeenCalledTimes(3);
    });
});
