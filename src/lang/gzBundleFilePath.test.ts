import { beforeEach, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        send: vi.fn(() => 'C:/OpenWorship'),
        join: vi.fn((...parts: string[]) => parts.join('/')),
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: { sendDataSync: mocks.send },
        pathUtils: { join: mocks.join },
    },
}));
import { resolveGzBundleFilePath } from './gzBundleFilePath';

beforeEach(() => vi.clearAllMocks());
test('leaves an absolute bundle alone and resolves named bundles from the cached distribution directory', () => {
    expect(
        resolveGzBundleFilePath({
            filePath: 'C:/data/lookup.gz',
            fileName: null,
        }),
    ).toBe('C:/data/lookup.gz');
    expect(mocks.send).not.toHaveBeenCalled();
    expect(
        resolveGzBundleFilePath({ filePath: '', fileName: 'lookup.gz' }),
    ).toBe('C:/OpenWorship/dist/lookup.gz');
    expect(
        resolveGzBundleFilePath({ filePath: '', fileName: 'cross-ref.gz' }),
    ).toBe('C:/OpenWorship/dist/cross-ref.gz');
    expect(mocks.send).toHaveBeenCalledOnce();
});
