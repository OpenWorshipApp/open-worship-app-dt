import { describe, expect, test, vi } from 'vitest';

const { pathToFileURLMock } = vi.hoisted(() => ({
    pathToFileURLMock: vi.fn((filePath: string) => `file://${filePath}`),
}));

vi.mock('./appProvider', () => ({
    default: {
        browserUtils: {
            pathToFileURL: pathToFileURLMock,
        },
    },
}));

import { fromBase64, pathToFileURL, toBase64 } from './calcHelpers';

describe('calcHelpers', () => {
    test('delegates pathToFileURL to the app provider', () => {
        expect(pathToFileURL('C:/docs/file.txt')).toBe(
            'file://C:/docs/file.txt',
        );
        expect(pathToFileURLMock).toHaveBeenCalledWith('C:/docs/file.txt');
    });

    test('encodes and decodes utf-8 text as base64', () => {
        const encoded = toBase64('hello 한글');

        expect(encoded).toBe(Buffer.from('hello 한글', 'utf-8').toString('base64'));
        expect(fromBase64(encoded)).toBe('hello 한글');
    });
});
