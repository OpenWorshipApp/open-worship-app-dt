import { afterEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({ mocks: { error: vi.fn() } }));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.error }));
import { readJsonFile, readJsonFileVersion } from './lookupDataVersionHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});
describe('lookup data version reads', () => {
    test('stops streaming as soon as the head declares a version', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        const read = vi.fn().mockResolvedValue({
            done: false,
            value: new TextEncoder().encode('{"version":42,'),
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                body: { getReader: () => ({ read }) },
            }),
        );
        await expect(readJsonFileVersion('/lookup.json')).resolves.toBe(42);
        expect(read).toHaveBeenCalledOnce();
        expect(abort).toHaveBeenCalledOnce();
        abort.mockRestore();
    });
    test('rejects failed, missing, and thrown reads without fetching the large remainder', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, body: null }),
        );
        await expect(readJsonFileVersion('/missing')).resolves.toBeNull();
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        await expect(readJsonFileVersion('/offline')).resolves.toBeNull();
        expect(mocks.error).toHaveBeenCalledOnce();
    });
    test('reads full JSON only for consumers that actually need the dataset', async () => {
        const json = vi.fn().mockResolvedValue({ version: 3 });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json }));
        await expect(readJsonFile('/full')).resolves.toEqual({ version: 3 });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404 }),
        );
        await expect(readJsonFile('/missing')).rejects.toThrow('404');
    });
    function stubChunks(chunks: string[]) {
        const encoder = new TextEncoder();
        const read = vi.fn();
        for (const chunk of chunks) {
            read.mockResolvedValueOnce({
                done: false,
                value: encoder.encode(chunk),
            });
        }
        read.mockResolvedValue({ done: true, value: undefined });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                body: { getReader: () => ({ read }) },
            }),
        );
        return read;
    }
    test('finds a version split across two chunks', async () => {
        const read = stubChunks(['{"ver', 'sion": 7, "names": {']);
        await expect(readJsonFileVersion('/split.json')).resolves.toBe(7);
        expect(read).toHaveBeenCalledTimes(2);
    });
    test('a file that ends before any version has none', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        const read = stubChunks(['{"names": {}}']);
        await expect(readJsonFileVersion('/short.json')).resolves.toBeNull();
        expect(read).toHaveBeenCalledTimes(2);
        expect(abort).toHaveBeenCalledOnce();
        expect(mocks.error).not.toHaveBeenCalled();
        abort.mockRestore();
    });
    test('stops reading after the head without a version', async () => {
        const filler = `{"names": "${'x'.repeat(600)}`;
        const read = stubChunks([filler, filler, filler, '"version": 9']);
        await expect(readJsonFileVersion('/no-head.json')).resolves.toBeNull();
        // Two chunks pass the 1024-character head; the rest is never read.
        expect(read).toHaveBeenCalledTimes(2);
    });
});
