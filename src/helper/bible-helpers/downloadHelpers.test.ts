import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const requestMock = vi.fn();
const fsCheckFileExistMock = vi.fn();
const fsDeleteFileMock = vi.fn();
const fsCreateWriteStreamMock = vi.fn();
const fsCreateDirMock = vi.fn();
const fsCheckDirExistMock = vi.fn();
const handleErrorMock = vi.fn();

vi.mock('../../server/appProvider', () => ({
    default: {
        httpUtils: {
            request: requestMock,
        },
        pathUtils: {
            dirname: (filePath: string) =>
                filePath.split('/').slice(0, -1).join('/'),
        },
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    fsDeleteFile: fsDeleteFileMock,
    fsCreateWriteStream: fsCreateWriteStreamMock,
    fsCreateDir: fsCreateDirMock,
    fsCheckDirExist: fsCheckDirExistMock,
}));

vi.mock('../errorHelpers', () => ({
    handleError: handleErrorMock,
}));

describe('downloadHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        requestMock.mockImplementation(
            (_options, callback: (response: any) => void) => {
                const req = Object.assign(new EventEmitter(), {
                    end: () => {
                        callback({ statusCode: 200, headers: {}, on: vi.fn() });
                    },
                });
                return req;
            },
        );

        fsCheckFileExistMock.mockResolvedValue(false);
        fsDeleteFileMock.mockResolvedValue(undefined);
        fsCreateDirMock.mockResolvedValue(undefined);
        fsCheckDirExistMock.mockResolvedValue(true);
        handleErrorMock.mockImplementation(() => {});
    });

    test('follows 302 redirect and resolves final response', async () => {
        requestMock
            .mockImplementationOnce(
                (_options, callback: (response: any) => void) => {
                    const req = Object.assign(new EventEmitter(), {
                        end: () => {
                            callback({
                                statusCode: 302,
                                headers: {
                                    location: 'https://example.com/final.bin',
                                },
                            });
                        },
                    });
                    return req;
                },
            )
            .mockImplementationOnce(
                (_options, callback: (response: any) => void) => {
                    const req = Object.assign(new EventEmitter(), {
                        end: () => {
                            callback({
                                statusCode: 200,
                                headers: {},
                                on: vi.fn(),
                            });
                        },
                    });
                    return req;
                },
            );

        const { initHttpRequest } = await import('./downloadHelpers');
        const response = await initHttpRequest(
            new URL('https://example.com/redirect'),
        );

        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(response.statusCode).toBe(200);
    });

    test('reports download progress and completes writing stream', async () => {
        const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-length': `${1024 * 1024}` },
        });

        const closeMock = vi.fn();
        const writeMock = vi.fn(
            (_chunk: Buffer, callback?: (error?: Error) => void) => {
                callback?.();
            },
        );

        fsCreateWriteStreamMock.mockReturnValue({
            writable: true,
            write: writeMock,
            close: closeMock,
        });

        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onDone = vi.fn();

        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            {
                onStart,
                onProgress,
                onDone,
            },
            response,
        );

        response.emit('data', Buffer.alloc(1024 * 1024));
        response.emit('end');

        expect(onStart).toHaveBeenCalledWith(1);
        expect(onProgress).toHaveBeenCalledWith(1);
        expect(writeMock).toHaveBeenCalledTimes(1);
        expect(closeMock).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith(null, '/tmp/update.bin');
    });

    test('calls onDone with error when status code is not 200', async () => {
        const onDone = vi.fn();

        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            {
                onStart: vi.fn(),
                onProgress: vi.fn(),
                onDone,
            },
            {
                statusCode: 500,
                headers: {},
                on: vi.fn(),
            },
        );

        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('cleans up file and reports failure when stream is not writable', async () => {
        fsCreateWriteStreamMock.mockReturnValue({
            writable: false,
            close: vi.fn(),
        });

        const onDone = vi.fn();

        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            {
                onStart: vi.fn(),
                onProgress: vi.fn(),
                onDone,
            },
            {
                statusCode: 200,
                headers: { 'content-length': `${1024 * 1024}` },
                on: vi.fn(),
            },
        );

        expect(fsDeleteFileMock).toHaveBeenCalledWith('/tmp/update.bin');
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});
