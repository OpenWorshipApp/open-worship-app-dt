import { afterEach, expect, test, vi } from 'vitest';

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));

for (const moduleName of [
    './appInfo',
    './appUtils',
    './browserUtils',
    './cryptoUtils',
    './databaseUtils',
    './envUtils',
    './fileUtils',
    './fontUtils',
    './httpUtils',
    './messageUtils',
    './pathUtils',
    './systemUtils',
]) {
    vi.doMock(moduleName, () => ({ default: {} }));
}
vi.doMock('./ytUtils', () => ({ ytUtils: {} }));
vi.doMock('../electronHelpers', () => ({
    POPUP_FRAME_NAME_PREFIX: 'owa-popup',
}));

afterEach(() => {
    delete (globalThis as any).location;
});

test('reload delegates to the renderer location', async () => {
    (globalThis as any).location = { reload };
    const { provider } = await import('./fullProvider');

    provider.reload();

    expect(reload).toHaveBeenCalledTimes(1);
});
