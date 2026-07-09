// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    openExternalURLMock,
    showSimpleToastMock,
    showAppConfirmMock,
    fileSourceGetInstanceMock,
    electronSendAsyncMock,
    unlockingMock,
    tranMock,
} = vi.hoisted(() => ({
    openExternalURLMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    electronSendAsyncMock: vi.fn(),
    unlockingMock: vi.fn(async (_key: string, callback: () => unknown) => {
        return await callback();
    }),
    tranMock: vi.fn((value: string) => value),
}));

vi.mock('./appProvider', () => ({
    default: {
        browserUtils: {
            openExternalURL: openExternalURLMock,
        },
    },
}));

vi.mock('../helper/appHooks', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        useAppEffectAsync: <T extends Record<string, unknown>>(
            effectMethod: (methods: T) => Promise<void | (() => void)>,
            deps: readonly unknown[] | undefined,
            methods?: T,
        ) => {
            React.useEffect(() => {
                let cleanup: void | (() => void);
                void effectMethod({ ...(methods ?? ({} as T)) }).then(
                    (resolved) => {
                        cleanup = resolved;
                    },
                );
                return () => {
                    cleanup?.();
                };
            }, deps);
        },
    };
});

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('./appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('./unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

vi.mock('../others/CacheManager', () => ({
    default: class CacheManager<T> {
        private readonly store = new Map<string, T>();

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    },
}));

async function loadModule() {
    vi.resetModules();
    return await import('./fontHelpers');
}

describe('fontHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => {
                root?.unmount();
            });
        }
        root = null;
        container?.remove();
        container = null;
    });

    test('loads the font list once and reuses the cached result', async () => {
        electronSendAsyncMock.mockResolvedValue({
            Arial: 'Arial',
            ' Times New Roman ': 'Times New Roman',
        });

        const module = await loadModule();
        const first = await module.getFontFamilyMapByNodeFont();
        const second = await module.getFontFamilyMapByNodeFont();

        expect(first).toEqual({
            Arial: 'Arial',
            ' Times New Roman ': 'Times New Roman',
        });
        expect(second).toBe(first);
        expect(unlockingMock).toHaveBeenCalledWith(
            'getFontFamilyMapByNodeFont',
            expect.any(Function),
        );
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:get-font-list',
        );
    });

    test('normalizes font family names and returns an empty array for null maps', async () => {
        electronSendAsyncMock.mockResolvedValueOnce({
            Arial: 'Arial',
            ' Times New Roman ': 'Times New Roman',
        });
        let module = await loadModule();

        await expect(module.getFontFamilies()).resolves.toEqual([
            'arial',
            'times new roman',
        ]);

        electronSendAsyncMock.mockResolvedValueOnce(null);
        module = await loadModule();
        await expect(module.getFontFamilies()).resolves.toEqual([]);
    });

    test('useFontList populates hook state from the async font loader', async () => {
        electronSendAsyncMock.mockResolvedValue({ Arial: 'Arial' });
        const module = await loadModule();

        function Harness() {
            const fontList = module.useFontList();
            return (
                <div>
                    {fontList === undefined
                        ? 'loading'
                        : JSON.stringify(fontList)}
                </div>
            );
        }

        root = createRoot(container!);
        await act(async () => {
            root?.render(<Harness />);
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(container?.textContent).toContain('Arial');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(1);
    });

    test('stops when missing fonts were already handled or the user declines', async () => {
        fileSourceGetInstanceMock.mockReturnValue({ name: 'sample.docx' });
        showAppConfirmMock.mockResolvedValue(false);
        const module = await loadModule();

        await module.fixMissingFontFamilies(
            new Set(['Missing Sans']),
            '/docs/sample.docx',
        );
        await module.fixMissingFontFamilies(
            new Set(['Missing Sans']),
            '/docs/sample.docx',
        );

        expect(showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        expect(openExternalURLMock).not.toHaveBeenCalled();
    });

    test('opens search pages for each missing font after confirmation', async () => {
        fileSourceGetInstanceMock.mockReturnValue({ name: 'worship.docx' });
        showAppConfirmMock.mockResolvedValue(true);
        const module = await loadModule();

        await module.fixMissingFontFamilies(
            new Set(['Open Sans', 'Noto Serif']),
            '/docs/worship.docx',
        );

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Missing Fonts in "worship.docx"',
            expect.stringContaining('"Open Sans"'),
            { confirmButtonLabel: 'Yes' },
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Opening Missing Fonts Searching',
            'Please install the missing fonts from the opened pages. and restart the app after installation.',
        );
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://www.google.com/search?q=font+download: "Open Sans"',
        );
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://www.google.com/search?q=font+download: "Noto Serif"',
        );
    });
});
