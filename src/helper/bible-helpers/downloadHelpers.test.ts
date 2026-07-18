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
        appInfo: {
            name: 'open-worship-app',
            version: '0.0.0',
        },
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

    test('resolves a relative redirect Location against the current URL', async () => {
        requestMock
            .mockImplementationOnce(
                (_options, callback: (response: any) => void) => {
                    const req = Object.assign(new EventEmitter(), {
                        end: () => {
                            callback({
                                statusCode: 308,
                                headers: { location: '/final.bin' },
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
            new URL('https://cdn.example.com/a/b/redirect'),
        );

        const secondOptions = requestMock.mock.calls[1][0];
        expect(secondOptions.hostname).toBe('cdn.example.com');
        expect(secondOptions.path).toBe('/final.bin');
        expect(response.statusCode).toBe(200);
    });

    test('rejects after too many redirects', async () => {
        requestMock.mockImplementation(
            (_options, callback: (response: any) => void) => {
                const req = Object.assign(new EventEmitter(), {
                    end: () => {
                        callback({
                            statusCode: 302,
                            headers: {
                                location: 'https://example.com/loop',
                            },
                        });
                    },
                });
                return req;
            },
        );

        const { initHttpRequest } = await import('./downloadHelpers');
        await expect(
            initHttpRequest(new URL('https://example.com/loop')),
        ).rejects.toThrow('Too many download redirects');
    });

    function createWriteStreamMock() {
        const writeStream = Object.assign(new EventEmitter(), {
            writable: true,
            write: vi.fn(() => true),
            end: vi.fn(() => {
                writeStream.emit('finish');
            }),
            destroy: vi.fn(),
            close: vi.fn(),
        });
        return writeStream;
    }

    test('sends a User-Agent header so the CDN serves the binary', async () => {
        const { initHttpRequest } = await import('./downloadHelpers');
        await initHttpRequest(new URL('https://example.com/file.bin'));

        const options = requestMock.mock.calls[0][0];
        expect(options.headers?.['User-Agent']).toBe('open-worship-app/0.0.0');
    });

    test('reports download progress and only completes after flush', async () => {
        const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-length': `${1024 * 1024}` },
            destroy: vi.fn(),
        });

        const writeStream = createWriteStreamMock();
        fsCreateWriteStreamMock.mockReturnValue(writeStream);

        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onDone = vi.fn();

        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            { onStart, onProgress, onDone },
            response,
        );

        response.emit('data', Buffer.alloc(1024 * 1024));
        // Success must NOT be reported until the write stream has flushed.
        expect(onDone).not.toHaveBeenCalled();

        response.emit('end');

        expect(onStart).toHaveBeenCalledWith(1);
        expect(onProgress).toHaveBeenCalledWith(1);
        expect(writeStream.write).toHaveBeenCalledTimes(1);
        expect(writeStream.end).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith(null, '/tmp/update.bin');
    });

    test('pauses the response on backpressure and resumes on drain', async () => {
        const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-length': `${1024 * 1024}` },
            destroy: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        });

        const writeStream = createWriteStreamMock();
        writeStream.write = vi.fn(() => false); // buffer full
        fsCreateWriteStreamMock.mockReturnValue(writeStream);

        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            { onStart: vi.fn(), onProgress: vi.fn(), onDone: vi.fn() },
            response,
        );

        response.emit('data', Buffer.alloc(512));
        expect(response.pause).toHaveBeenCalledTimes(1);

        writeStream.emit('drain');
        expect(response.resume).toHaveBeenCalledTimes(1);
    });

    test('fails when the connection is aborted mid-download', async () => {
        const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-length': `${1024 * 1024}` },
            destroy: vi.fn(),
        });

        const writeStream = createWriteStreamMock();
        fsCreateWriteStreamMock.mockReturnValue(writeStream);

        const onDone = vi.fn();
        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            { onStart: vi.fn(), onProgress: vi.fn(), onDone },
            response,
        );

        response.emit('data', Buffer.alloc(512));
        response.emit('aborted');

        expect(writeStream.destroy).toHaveBeenCalledTimes(1);
        expect(fsDeleteFileMock).toHaveBeenCalledWith('/tmp/update.bin');
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('fails on a truncated download (fewer bytes than content-length)', async () => {
        const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-length': `${1024 * 1024}` },
            destroy: vi.fn(),
        });

        const writeStream = createWriteStreamMock();
        fsCreateWriteStreamMock.mockReturnValue(writeStream);

        const onDone = vi.fn();
        const { writeStreamToFile } = await import('./downloadHelpers');
        await writeStreamToFile(
            '/tmp/update.bin',
            { onStart: vi.fn(), onProgress: vi.fn(), onDone },
            response,
        );

        response.emit('data', Buffer.alloc(512)); // far fewer than 1MB
        response.emit('end');

        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone.mock.calls[0][0]).toBeInstanceOf(Error);
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
