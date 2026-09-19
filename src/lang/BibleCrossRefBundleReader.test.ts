import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fileUtils } = vi.hoisted(() => ({
    fileUtils: {
        openSync: vi.fn(() => 3),
        fstatSync: vi.fn(),
        readSync: vi.fn(),
        closeSync: vi.fn(),
        gunzipSync: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: { fileUtils },
}));

import { BibleCrossRefBundleReader } from './BibleCrossRefBundleReader';

function buildFile(
    indexObj: Record<string, [number, number]>,
    records: Buffer,
    gzip = false,
) {
    const indexBuf = Buffer.from(JSON.stringify(indexObj), 'utf8');
    const indexOffset = records.length;
    const footer = Buffer.alloc(20);
    footer.writeUInt32LE(indexOffset, 0);
    footer.writeUInt32LE(indexBuf.length, 4);
    footer.writeUInt32LE(gzip ? 1 : 0, 8);
    footer.write('FBBNDL01', 12, 'latin1');
    return Buffer.concat([records, indexBuf, footer]);
}

function installFile(file: Buffer) {
    fileUtils.fstatSync.mockReturnValue({ size: file.length });
    fileUtils.readSync.mockImplementation(
        (
            _fd: number,
            buffer: Buffer,
            offset: number,
            length: number,
            position: number,
        ) => {
            file.copy(buffer, offset, position, position + length);
            return length;
        },
    );
}

describe('lang BibleCrossRefBundleReader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fileUtils.openSync.mockReturnValue(3);
    });

    test('reads records from a valid bundle', () => {
        const record = Buffer.from(
            JSON.stringify([{ text: 'ref', verses: ['GEN/1/2'] }]),
            'utf8',
        );
        const file = buildFile({ 'GEN/1/1': [0, record.length] }, record);
        installFile(file);

        const reader = new BibleCrossRefBundleReader('/bundle');
        expect(reader.size).toBe(1);
        expect(reader.has('GEN/1/1')).toBe(true);
        expect(reader.has('missing')).toBe(false);
        expect(reader.getText('GEN/1/1')).toBe(record.toString('utf8'));
        expect(reader.get('GEN/1/1')).toEqual([
            { text: 'ref', verses: ['GEN/1/2'] },
        ]);
        expect(reader.getVerse('GEN', 1, 1)).toEqual([
            { text: 'ref', verses: ['GEN/1/2'] },
        ]);
        expect(reader.getBytes('missing')).toBeUndefined();
        expect(reader.getText('missing')).toBeUndefined();
        expect(reader.get('missing')).toBeNull();

        reader.close();
        expect(fileUtils.closeSync).toHaveBeenCalledWith(3);
    });

    test('decompresses gzip records', () => {
        const stored = Buffer.from('COMPRESSED');
        const file = buildFile({ 'GEN/1/1': [0, stored.length] }, stored, true);
        installFile(file);
        fileUtils.gunzipSync.mockReturnValue(
            Buffer.from(JSON.stringify([{ text: 'gz' }]), 'utf8'),
        );

        const reader = new BibleCrossRefBundleReader('/bundle');
        expect(reader.get('GEN/1/1')).toEqual([{ text: 'gz' }]);
        expect(fileUtils.gunzipSync).toHaveBeenCalled();
    });

    test('throws and closes on a bad magic footer', () => {
        const record = Buffer.from('x', 'utf8');
        const file = buildFile({ 'A/1/1': [0, 1] }, record);
        // corrupt the magic bytes
        file.write('BADMAGIC', file.length - 8, 'latin1');
        installFile(file);

        expect(() => new BibleCrossRefBundleReader('/bundle')).toThrow(
            'bad magic',
        );
        expect(fileUtils.closeSync).toHaveBeenCalledWith(3);
    });
});
