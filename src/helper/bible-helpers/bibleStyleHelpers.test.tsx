// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const globalCacheStore = new Map<string, unknown>();

    return {
        getBibleInfoMock: vi.fn(),
        getFontFamilyByLocaleMock: vi.fn(),
        getLangDataAsyncMock: vi.fn(),
        globalCacheManager1M: {
            get: vi.fn(async (key: string) => {
                return globalCacheStore.has(key)
                    ? globalCacheStore.get(key)
                    : null;
            }),
            has: vi.fn(async (key: string) => globalCacheStore.has(key)),
            set: vi.fn(async (key: string, value: unknown) => {
                globalCacheStore.set(key, value);
            }),
        },
        globalCacheStore,
        reset() {
            globalCacheStore.clear();
        },
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return callback();
            },
        ),
    };
});

vi.mock('./bibleInfoHelpers', () => ({
    getBibleInfo: mocks.getBibleInfoMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getFontFamilyByLocale: mocks.getFontFamilyByLocaleMock,
    getLangDataAsync: mocks.getLangDataAsyncMock,
}));

vi.mock('../../others/CacheManager', () => ({
    globalCacheManager1M: mocks.globalCacheManager1M,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../appHooks', async () => {
    const React = await import('react');
    return {
        useAppStateAsync: (
            factory: () => Promise<unknown>,
            deps: unknown[],
        ) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                let active = true;
                Promise.resolve(factory()).then((nextValue) => {
                    if (active) {
                        setValue(nextValue);
                    }
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value];
        },
    };
});

async function loadModule() {
    return await import('./bibleStyleHelpers');
}

describe('bibleStyleHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.getBibleInfoMock.mockResolvedValue({ locale: 'km-KH' });
        mocks.getFontFamilyByLocaleMock.mockImplementation(
            (locale: string) => `font:${locale}`,
        );
        mocks.getLangDataAsyncMock.mockImplementation(
            async (locale: string) => {
                if (locale === 'km-KH') {
                    return { fontFamily: 'Khmer Font' };
                }
                if (locale === 'en-US') {
                    return { fontFamily: 'English Font' };
                }
                return null;
            },
        );

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('resolves the bible locale and falls back when the info is missing', async () => {
        const module = await loadModule();

        mocks.getBibleInfoMock.mockResolvedValueOnce(null);
        expect(await module.getBibleLocale('missing')).toBe('en');
        expect(await module.getBibleLocale('KJV')).toBe('km-KH');
    });

    test('falls back to the default locale language data', async () => {
        const module = await loadModule();

        expect(await module.getLangDataFromBibleKey('KJV')).toEqual({
            fontFamily: 'Khmer Font',
        });

        mocks.getLangDataAsyncMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ fontFamily: 'Fallback Font' });
        expect(await module.getLangDataFromBibleKey('KJV')).toEqual({
            fontFamily: 'Fallback Font',
        });
    });

    test('resolves and caches the bible font family', async () => {
        const module = await loadModule();

        expect(await module.getBibleFontFamily('')).toBe('font:en-US');
        expect(mocks.globalCacheManager1M.set).not.toHaveBeenCalled();

        expect(await module.getBibleFontFamily('KJV')).toBe('font:km-KH');
        expect(await module.getBibleFontFamily('KJV')).toBe('font:km-KH');
        expect(mocks.getFontFamilyByLocaleMock).toHaveBeenCalledTimes(2);
        expect(mocks.globalCacheManager1M.set).toHaveBeenCalledTimes(1);
    });

    test('exposes the font family through useBibleFontFamily', async () => {
        const module = await loadModule();
        const updates: Array<string | undefined> = [];

        function HookHarnessComp() {
            const fontFamily = module.useBibleFontFamily('KJV');

            useEffect(() => {
                updates.push(fontFamily);
            }, [fontFamily]);

            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing container');
            }
            root = createRoot(container);
            root.render(<HookHarnessComp />);
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(updates.at(0)).toBeUndefined();
        expect(updates.at(-1)).toBe('font:km-KH');
    });
});
