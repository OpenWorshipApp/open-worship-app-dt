// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    dirSourceGetInstanceMock,
    fileSourceGetInstanceMock,
    registerFileSourceEventListenerMock,
    unregisterFileSourceEventListenerMock,
    fsCheckDirExistMock,
    checkAreArraysEqualMock,
    watchMock,
    handleErrorMock,
    notifyNewElementAddedMock,
} = vi.hoisted(() => ({
    dirSourceGetInstanceMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    registerFileSourceEventListenerMock: vi.fn(),
    unregisterFileSourceEventListenerMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    checkAreArraysEqualMock: vi.fn(
        (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right),
    ),
    watchMock: vi.fn(),
    handleErrorMock: vi.fn(),
    notifyNewElementAddedMock: vi.fn(),
}));

vi.mock('./debuggerHelpers', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppEffect: React.useEffect,
        useAppEffectAsync: (
            effectMethod: (methods: Record<string, unknown>) => Promise<void | (() => void)>,
            deps: React.DependencyList,
            methods?: Record<string, unknown>,
        ) => {
            React.useEffect(() => {
                let cleanup: void | (() => void);
                void effectMethod({ ...(methods ?? {}) }).then((resolved) => {
                    cleanup = resolved;
                });
                return () => {
                    cleanup?.();
                };
            }, deps);
        },
    };
});

vi.mock('./DirSource', () => ({
    default: {
        getInstance: dirSourceGetInstanceMock,
    },
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
        registerFileSourceEventListener: registerFileSourceEventListenerMock,
        unregisterEventListener: unregisterFileSourceEventListenerMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
}));

vi.mock('../server/comparisonHelpers', () => ({
    checkAreArraysEqual: checkAreArraysEqualMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        fileUtils: {
            watch: watchMock,
        },
    },
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./domHelpers', () => ({
    notifyNewElementAdded: notifyNewElementAddedMock,
}));

import {
    FilePathLoadedContext,
    useDirSourceWatching,
    useFilePaths,
    useFileSourceEvents,
    useFileSourceRefreshEvents,
    useGenDirSourceReload,
} from './dirSourceHelpers';

describe('dirSourceHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        fsCheckDirExistMock.mockResolvedValue(true);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            src: `src:${filePath}`,
            colorNote: null,
            getColorNote: vi.fn(async () => `${filePath}-color`),
        }));
        registerFileSourceEventListenerMock.mockImplementation(
            (_events: string[], callback: () => void) => {
                return callback;
            },
        );
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
        vi.useRealTimers();
    });

    test('loads file paths, updates file colors, and notifies on added paths', async () => {
        const refreshCallbacks: Array<() => void> = [];
        const onLoaded = vi.fn();
        const observedValues: Array<string[] | null | undefined> = [];
        const dirSource = {
            registerEventListener: vi.fn((_events: string[], callback: () => void) => {
                refreshCallbacks.push(callback);
                return ['refresh-listener'];
            }),
            unregisterEventListener: vi.fn(),
            getFilePaths: vi
                .fn()
                .mockResolvedValueOnce(['/docs/a.owa', '/docs/b.owa'])
                .mockResolvedValueOnce(['/docs/a.owa', '/docs/b.owa', '/docs/c.owa']),
        };

        function Probe() {
            const value = useFilePaths(dirSource as any, 'appDocument' as any);
            useEffect(() => {
                observedValues.push(value);
            }, [value]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <FilePathLoadedContext.Provider value={{ onLoaded }}>
                    <Probe />
                </FilePathLoadedContext.Provider>,
            );
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(observedValues).toContainEqual(['/docs/a.owa', '/docs/b.owa']);
        expect(onLoaded).toHaveBeenCalledWith(['/docs/a.owa', '/docs/b.owa']);
        expect(fileSourceGetInstanceMock).toHaveBeenCalledWith('/docs/a.owa');
        expect(fileSourceGetInstanceMock).toHaveBeenCalledWith('/docs/b.owa');

        const addedElement = document.createElement('div');
        addedElement.setAttribute('data-file-item-file-src', 'src:/docs/c.owa');
        document.body.appendChild(addedElement);

        await act(async () => {
            refreshCallbacks[0]?.();
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
        });

        expect(observedValues).toContainEqual([
            '/docs/a.owa',
            '/docs/b.owa',
            '/docs/c.owa',
        ]);
        expect(onLoaded).toHaveBeenLastCalledWith([
            '/docs/a.owa',
            '/docs/b.owa',
            '/docs/c.owa',
        ]);
        expect(notifyNewElementAddedMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            root?.unmount();
        });
        root = null;
        expect(dirSource.unregisterEventListener).toHaveBeenCalledWith([
            'refresh-listener',
        ]);
    });

    test('reloads dir sources when the reload event fires', async () => {
        const reloadCallbacks: Array<() => void> = [];
        const observedValues: unknown[] = [];
        const firstDirSource = {
            registerEventListener: vi.fn((_events: string[], callback: () => void) => {
                reloadCallbacks.push(callback);
                return ['reload-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };
        const secondDirSource = {
            registerEventListener: vi.fn(() => ['reload-listener-2']),
            unregisterEventListener: vi.fn(),
        };
        dirSourceGetInstanceMock
            .mockResolvedValueOnce(firstDirSource)
            .mockResolvedValueOnce(secondDirSource);

        function Probe() {
            const value = useGenDirSourceReload('selected-dir');
            useEffect(() => {
                observedValues.push(value);
            }, [value]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(observedValues).toContain(firstDirSource);

        await act(async () => {
            reloadCallbacks[0]?.();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(observedValues).toContain(secondDirSource);
    });

    test('registers file source refresh and event listeners and cleans them up', async () => {
        const observedPayloads: string[] = [];
        const registeredCallbacks: Array<(payload?: string) => void> = [];
        registerFileSourceEventListenerMock.mockImplementation(
            (_events: string[], callback: (payload?: string) => void) => {
                registeredCallbacks.push(callback);
                return `listener-${registeredCallbacks.length}`;
            },
        );

        function Probe() {
            useFileSourceRefreshEvents(['update'], '/docs/slide.owa');
            useFileSourceEvents<string>(
                ['update'],
                (payload) => {
                    observedPayloads.push(payload);
                },
                ['dep'],
                '/docs/slide.owa',
            );
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        expect(registerFileSourceEventListenerMock).toHaveBeenCalledTimes(2);

        await act(async () => {
            registeredCallbacks[0]?.();
            registeredCallbacks[1]?.('payload');
            await Promise.resolve();
        });

        expect(observedPayloads).toEqual(['payload']);

        await act(async () => {
            root?.unmount();
        });
        root = null;

        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith('listener-1');
        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith('listener-2');
    });

    test('watches directory changes and refreshes when files change', async () => {
        const dirSource = {
            dirPath: '/docs',
            filePathsMap: {},
            alertFileChanging: vi.fn(),
            fireRefreshEvent: vi.fn(),
            getFilePathsQuick: vi.fn(),
        };
        let watchCallback: ((...args: unknown[]) => void) | undefined;
        watchMock.mockImplementation(
            (_dirPath: string, _options: { signal: AbortSignal }, callback: (...args: unknown[]) => void) => {
                watchCallback = callback;
            },
        );

        function Probe() {
            useDirSourceWatching(dirSource as any);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(watchMock).toHaveBeenCalledWith(
            '/docs',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
            expect.any(Function),
        );

        await act(async () => {
            await watchCallback?.('change', '/docs/new.owa');
        });

        expect(dirSource.alertFileChanging).toHaveBeenCalledWith('/docs/new.owa');
        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);

        dirSource.filePathsMap = { appDocument: ['/docs/a.owa'] };
        dirSource.getFilePathsQuick.mockResolvedValue(['/docs/b.owa']);

        await act(async () => {
            await watchCallback?.('rename');
        });

        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(2);
    });

    test('skips or reports directory watch setup errors', async () => {
        const dirSource = {
            dirPath: '/docs',
            filePathsMap: {},
            alertFileChanging: vi.fn(),
            fireRefreshEvent: vi.fn(),
            getFilePathsQuick: vi.fn(),
        };
        fsCheckDirExistMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        watchMock.mockImplementationOnce(() => {
            throw new Error('watch failed');
        });

        function Probe({ source }: { source: unknown }) {
            useDirSourceWatching(source as any);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe source={null} />);
        });
        expect(watchMock).not.toHaveBeenCalled();

        await act(async () => {
            root?.render(<Probe source={dirSource} />);
            await Promise.resolve();
        });
        expect(watchMock).not.toHaveBeenCalled();

        await act(async () => {
            root?.render(<Probe source={{ ...dirSource, dirPath: '/docs-2' }} />);
            await Promise.resolve();
        });

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'watch failed' }),
        );
    });
});
