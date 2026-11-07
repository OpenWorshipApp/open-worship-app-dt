import { beforeEach, describe, expect, test, vi } from 'vitest';

// The failures of a Bible download the sibling suite does not reach: a request
// that errors, a path that cannot be prepared, an info file without its map,
// and a downloaded Bible whose info cannot be read.
const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    handleError: vi.fn(),
    getBibleInfo: vi.fn(),
    fsListDirectories: vi.fn(),
    appApiFetch: vi.fn(),
    writeStreamToFile: vi.fn(),
    getWritableBiblePath: vi.fn(),
    toBiblePath: vi.fn(),
}));

vi.mock('../errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: () => {} }));
vi.mock('../../_owa-crypto', () => ({
    get_api_key: () => 'api-key',
    get_api_url: () => 'https://api.example.com',
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        httpUtils: { request: mocks.request },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../../server/fileHelpers', () => ({
    checkIsHiddenName: (fileFullName: string) => fileFullName.startsWith('.'),
    fsCheckDirExist: async () => true,
    fsDeleteFile: async () => {},
    fsListDirectories: mocks.fsListDirectories,
    getFileName: (fileFullName: string) => fileFullName.split('.')[0],
    pathBasename: (filePath: string) => filePath.split('/').pop(),
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./bibleInfoHelpers', () => ({ getBibleInfo: mocks.getBibleInfo }));
vi.mock('../networkHelpers', () => ({ appApiFetch: mocks.appApiFetch }));
vi.mock('../../server/appHelpers', () => ({ tarExtract: async () => {} }));
vi.mock('./downloadHelpers', () => ({
    writeStreamToFile: mocks.writeStreamToFile,
}));
vi.mock('../../setting/bible-setting/bibleXMLHelpers', () => ({
    getBibleXMLCacheInfoList: async () => [],
}));
vi.mock('./BibleDataReader', () => ({
    bibleDataReader: {
        getWritableBiblePath: mocks.getWritableBiblePath,
        toBiblePath: mocks.toBiblePath,
    },
}));
vi.mock('../../others/CacheManager', () => ({
    default: class {
        async get() {
            return null;
        }
        async set() {}
    },
}));

import {
    downloadBible,
    getDownloadedBibleInfoList,
    getOnlineBibleInfoList,
    startDownloadBible,
} from './bibleDownloadHelpers';

type FakeRequestType = {
    options: any;
    respond: (response: any) => void;
    fail: (error: Error) => void;
};
let requests: FakeRequestType[] = [];

const khmerBibleInfo = {
    key: 'KHSV',
    locale: 'km-KH' as const,
    title: 'Khmer Standard Version',
    version: 2,
    filePath: 'bibles/Khmer Bible.tar',
};

beforeEach(() => {
    requests = [];
    mocks.request.mockImplementation(
        (options: any, callback: (response: any) => void) => {
            let onError: (error: Error) => void = () => {};
            requests.push({
                options,
                respond: callback,
                fail: (error) => onError(error),
            });
            return {
                on: (_event: string, handler: (error: Error) => void) => {
                    onError = handler;
                },
                end: () => {},
            };
        },
    );
    mocks.getWritableBiblePath.mockResolvedValue('/data/bibles');
    mocks.toBiblePath.mockImplementation(async (bibleFileFullName: string) => {
        return `/data/bibles${bibleFileFullName}`;
    });
});

describe('downloading a Bible', () => {
    test('hands a request error to the download’s own callback', async () => {
        const onDone = vi.fn();
        await startDownloadBible({
            bibleFileFullName: '/KJV.tar',
            options: { onDone } as any,
        });
        const error = new Error('ECONNRESET');
        requests[0].fail(error);
        expect(onDone).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.writeStreamToFile).not.toHaveBeenCalled();
    });

    test('requests the archive by its encoded path and streams it to disk', async () => {
        const options = { onDone: vi.fn() } as any;
        await downloadBible({ bibleInfo: khmerBibleInfo, options });
        expect(mocks.toBiblePath).toHaveBeenCalledWith(
            '/bibles/Khmer%20Bible.tar',
        );
        expect(requests).toHaveLength(1);
        expect(requests[0].options).toMatchObject({
            path: '/bibles/Khmer%20Bible.tar',
            hostname: 'api.example.com',
            headers: { 'x-api-key': 'api-key' },
        });
        const response = { statusCode: 200, headers: {} };
        requests[0].respond(response);
        expect(mocks.writeStreamToFile).toHaveBeenCalledWith(
            '/data/bibles/bibles/Khmer%20Bible.tar',
            options,
            response,
        );
        expect(options.onDone).not.toHaveBeenCalled();
    });

    test('reports a Bible folder that cannot be prepared', async () => {
        const error = new Error('EACCES');
        mocks.getWritableBiblePath.mockRejectedValue(error);
        const onDone = vi.fn();
        await downloadBible({
            bibleInfo: khmerBibleInfo,
            options: { onDone } as any,
        });
        expect(onDone).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.request).not.toHaveBeenCalled();
    });
});

describe('Bible lists', () => {
    test('an online info file without its map is logged and gives no list', async () => {
        mocks.appApiFetch.mockResolvedValue({ json: async () => ({}) });
        expect(await getOnlineBibleInfoList()).toBeNull();
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(
            new TypeError('Cannot get bible list'),
        );
    });

    test('no downloaded list without a Bible folder', async () => {
        mocks.getWritableBiblePath.mockResolvedValue(null);
        expect(await getDownloadedBibleInfoList()).toBeNull();
        expect(mocks.fsListDirectories).not.toHaveBeenCalled();
    });

    test('a downloaded Bible whose info throws is logged and gives no list', async () => {
        mocks.fsListDirectories.mockResolvedValue(['KJV', '.git', 'WEB']);
        const error = new Error('corrupted _info');
        mocks.getBibleInfo.mockImplementation(async (bibleKey: string) => {
            if (bibleKey === 'WEB') {
                throw error;
            }
            return { key: bibleKey };
        });
        expect(await getDownloadedBibleInfoList()).toBeNull();
        expect(mocks.getBibleInfo).not.toHaveBeenCalledWith('.git', true);
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });
});
