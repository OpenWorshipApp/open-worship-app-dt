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
});
