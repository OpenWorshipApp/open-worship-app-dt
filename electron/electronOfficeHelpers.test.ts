import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mkdirSync, readFileSync, writeFileSync, convert } = vi.hoisted(() => ({
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    convert: vi.fn(),
}));

vi.mock('node:fs', () => ({
    mkdirSync,
    readFileSync,
    writeFileSync,
}));

vi.mock('libreoffice-convert', () => ({
    convert,
}));

import { officeFileToPdf } from './electronOfficeHelpers';

describe('electronOfficeHelpers', () => {
    beforeEach(() => {
        mkdirSync.mockReset();
        readFileSync.mockReset();
        writeFileSync.mockReset();
        convert.mockReset();
    });

    test('converts an Office document to PDF and writes output', async () => {
        readFileSync.mockReturnValue(Buffer.from('docx'));
        convert.mockImplementation(
            (
                _buf: Buffer,
                _ext: string,
                _filter: any,
                callback: (err: any, result: any) => void,
            ) => {
                callback(null, Buffer.from('pdf-output'));
            },
        );

        await expect(
            officeFileToPdf('/tmp/source.docx', '/tmp/out/file.pdf'),
        ).resolves.toBeNull();

        expect(mkdirSync).toHaveBeenCalledWith('/tmp/out', {
            recursive: true,
        });
        expect(writeFileSync).toHaveBeenCalledTimes(1);
        expect(writeFileSync.mock.calls[0][0]).toBe('/tmp/out/file.pdf');
        expect(Buffer.isBuffer(writeFileSync.mock.calls[0][1])).toBe(true);
    });

    test('returns an Error object when conversion fails', async () => {
        readFileSync.mockImplementation(() => {
            throw new Error('conversion failed');
        });

        const result = await officeFileToPdf(
            '/tmp/source.docx',
            '/tmp/out.pdf',
        );

        expect(result).toBeInstanceOf(Error);
        expect(result?.message).toContain('conversion failed');
    });
});
