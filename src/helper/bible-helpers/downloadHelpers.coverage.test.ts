import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// A download settles exactly once, whatever order its failures arrive in, and
// a file it could not clean up is logged rather than thrown.
const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    fsCheckFileExist: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsCreateWriteStream: vi.fn(),
    fsCreateDir: vi.fn(),
    fsCheckDirExist: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        appInfo: { name: 'open-worship-app', version: '0.0.0' },
        httpUtils: { request: mocks.request, requestHttp: mocks.request },
        pathUtils: {
            dirname: (filePath: string) => {
                return filePath.split('/').slice(0, -1).join('/');
            },
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: mocks.fsCheckFileExist,
    fsDeleteFile: mocks.fsDeleteFile,
    fsCreateWriteStream: mocks.fsCreateWriteStream,
    fsCreateDir: mocks.fsCreateDir,
    fsCheckDirExist: mocks.fsCheckDirExist,
}));
vi.mock('../errorHelpers', () => ({ handleError: mocks.handleError }));

import { initHttpRequest, writeStreamToFile } from './downloadHelpers';

function genWriteStream() {
    return Object.assign(new EventEmitter(), {
        writable: true,
        write: vi.fn(() => true),
        end: vi.fn(),
        destroy: vi.fn(),
        close: vi.fn(),
    });
}

function genResponse(contentLength: number) {
    return Object.assign(new EventEmitter(), {
        statusCode: 200,
        headers: { 'content-length': `${contentLength}` },
        destroy: vi.fn(),
    });
}

function genOptions() {
    return { onStart: vi.fn(), onProgress: vi.fn(), onDone: vi.fn() };
}

beforeEach(() => {
    mocks.fsCheckFileExist.mockResolvedValue(false);
    mocks.fsCheckDirExist.mockResolvedValue(true);
    mocks.fsDeleteFile.mockResolvedValue(undefined);
    mocks.fsCreateDir.mockResolvedValue(undefined);
});

describe('initHttpRequest', () => {
    test('rejects with the error the request raises', async () => {
        const error = new Error('connect ECONNREFUSED');
        mocks.request.mockImplementation(() => {
            const request = Object.assign(new EventEmitter(), {
                end: () => {
                    request.emit('error', error);
                },
            });
            return request;
        });
        await expect(
            initHttpRequest(new URL('https://example.com/bible.tar')),
        ).rejects.toBe(error);
    });
});

describe('writeStreamToFile', () => {
    test('replaces an earlier file and makes the missing folder first', async () => {
        mocks.fsCheckFileExist.mockResolvedValue(true);
        mocks.fsCheckDirExist.mockResolvedValue(false);
        const writeStream = genWriteStream();
        writeStream.end.mockImplementation(() => {
            writeStream.emit('finish');
        });
        mocks.fsCreateWriteStream.mockReturnValue(writeStream);
        const response = genResponse(4);
        const options = genOptions();

        await writeStreamToFile('/data/bibles/KJV.tar', options, response);
        response.emit('data', Buffer.alloc(4));
        response.emit('end');

        expect(mocks.fsDeleteFile).toHaveBeenCalledWith('/data/bibles/KJV.tar');
        expect(mocks.fsCreateDir).toHaveBeenCalledWith('/data/bibles');
        expect(options.onDone).toHaveBeenCalledExactlyOnceWith(
            null,
            '/data/bibles/KJV.tar',
        );
    });

    test('settles once on the first failure and logs a file it cannot remove', async () => {
        const writeStream = genWriteStream();
        mocks.fsCreateWriteStream.mockReturnValue(writeStream);
        const deleteError = new Error('EBUSY');
        mocks.fsDeleteFile.mockRejectedValue(deleteError);
        const response = genResponse(1024);
        const options = genOptions();

        await writeStreamToFile('/data/bibles/KJV.tar', options, response);
        const firstError = new Error('socket hang up');
        response.emit('error', firstError);
        response.emit('aborted');
        writeStream.emit('error', new Error('disk full'));
        // The stream still finishing afterwards changes nothing.
        writeStream.emit('finish');
        await Promise.resolve();
        await Promise.resolve();

        expect(options.onDone).toHaveBeenCalledExactlyOnceWith(firstError);
        expect(response.destroy).toHaveBeenCalledTimes(1);
        expect(writeStream.destroy).toHaveBeenCalledTimes(1);
        expect(mocks.fsDeleteFile).toHaveBeenCalledTimes(1);
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(deleteError);
    });

    test('logs a file it cannot remove after the stream would not open', async () => {
        const writeStream = { writable: false, close: vi.fn() };
        mocks.fsCreateWriteStream.mockReturnValue(writeStream);
        const deleteError = new Error('EPERM');
        mocks.fsDeleteFile.mockRejectedValue(deleteError);
        const options = genOptions();

        await writeStreamToFile('/data/bibles/KJV.tar', options, {
            statusCode: 200,
            headers: { 'content-length': '10' },
            on: vi.fn(),
        });

        expect(writeStream.close).toHaveBeenCalledTimes(1);
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(deleteError);
        expect(options.onDone).toHaveBeenCalledExactlyOnceWith(
            new Error('Write Stream is not writable'),
        );
        expect(options.onStart).not.toHaveBeenCalled();
    });
});
