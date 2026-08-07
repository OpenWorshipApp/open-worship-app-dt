// @vitest-environment jsdom

import { act, useEffect, useRef } from 'react';
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
    notifyElementHighlightMock,
} = vi.hoisted(() => ({
    dirSourceGetInstanceMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    registerFileSourceEventListenerMock: vi.fn(),
    unregisterFileSourceEventListenerMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    checkAreArraysEqualMock: vi.fn(
        (left: unknown, right: unknown) =>
            JSON.stringify(left) === JSON.stringify(right),
    ),
    watchMock: vi.fn(),
    handleErrorMock: vi.fn(),
    notifyElementHighlightMock: vi.fn(),
}));

vi.mock('./appHooks', () => {
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = useRef(target);
            ref.current = target;
            return ref;
        },
        useAppEffectAsync: (
            effectMethod: (
                methods: Record<string, unknown>,
            ) => Promise<void | (() => void)>,
            deps: readonly unknown[],
            methods?: Record<string, unknown>,
        ) => {
            const methodContext = methods === undefined ? {} : { ...methods };
            /* eslint-disable react-hooks/exhaustive-deps */
            useEffect(() => {
                let cleanup: void | (() => void);
                void effectMethod(methodContext).then((resolved) => {
                    cleanup = resolved;
                });
                return () => {
                    cleanup?.();
                };
            }, deps);
            /* eslint-enable react-hooks/exhaustive-deps */
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
        systemUtils: {
            isMac: false,
        },
    },
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./domHelpers', () => ({
    notifyElementHighlight: notifyElementHighlightMock,
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
            registerEventListener: vi.fn(
                (events: string[], callback: () => void) => {
                    if (events.includes('refresh')) {
                        refreshCallbacks.push(callback);
                        return ['refresh-listener'];
                    }
                    return ['other-listener'];
                },
            ),
            unregisterEventListener: vi.fn(),
            getFilePaths: vi
                .fn()
                .mockResolvedValueOnce(['/docs/a.owa', '/docs/b.owa'])
                .mockResolvedValueOnce([
                    '/docs/a.owa',
                    '/docs/b.owa',
                    '/docs/c.owa',
                ]),
        };

        function Probe() {
            const value = useFilePaths(
                dirSource as any,
                ['appDocument'] as any,
            );
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
        expect(notifyElementHighlightMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            root?.unmount();
        });
        root = null;
        expect(dirSource.unregisterEventListener).toHaveBeenCalledWith([
            'refresh-listener',
        ]);
    });

    // Mapping a change inside `<doc>.histories` back to the document is no
    // longer done here: `useFilePaths` used to subscribe to `file-update` and
    // walk its own list to find the owner, which meant every listing of every
    // directory paid for it. `DirSource.alertFileChanging` does it once, at the
    // one place that knows a change happened at all — covered by
    // `DirSource.test.ts`.
    test('takes no file-update subscription of its own', async () => {
        const registeredEvents: string[][] = [];
        const dirSource = {
            registerEventListener: vi.fn((events: string[]) => {
                registeredEvents.push(events);
                return events;
            }),
            unregisterEventListener: vi.fn(),
            getFilePaths: vi
                .fn()
                .mockResolvedValue(['/docs/a.owa', '/docs/b.owa']),
        };
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return {
                src: `src:${filePath}`,
                colorNote: null,
                getColorNote: vi.fn(async () => null),
                fireUpdateEvent: vi.fn(),
            };
        });

        function Probe() {
            useFilePaths(dirSource as any, ['appDocument'] as any);
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

        expect(registeredEvents.flat()).not.toContain('file-update');
    });

    test('reloads dir sources when the reload event fires', async () => {
        const reloadCallbacks: Array<() => void> = [];
        const observedValues: unknown[] = [];
        const firstDirSource = {
            registerEventListener: vi.fn(
                (_events: string[], callback: () => void) => {
                    reloadCallbacks.push(callback);
                    return ['reload-listener'];
                },
            ),
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

    /**
     * A file source instance as the two hooks use it when they are NAMED a file:
     * they subscribe to that one file rather than to every file source in the
     * app, so the registration lives on the instance.
     */
    function genFileSourceStub(registeredCallbacks: Array<(p?: any) => void>) {
        const unregisterEventListener = vi.fn();
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return {
                filePath,
                registerEventListener: vi.fn(
                    (_events: string[], callback: (p?: any) => void) => {
                        registeredCallbacks.push(callback);
                        return `listener-${registeredCallbacks.length}`;
                    },
                ),
                unregisterEventListener,
            };
        });
        return unregisterEventListener;
    }

    test('subscribes to the NAMED file source and cleans up', async () => {
        const observedPayloads: string[] = [];
        const registeredCallbacks: Array<(payload?: string) => void> = [];
        const unregisterEventListener = genFileSourceStub(registeredCallbacks);

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

        // Both hooks went to the instance, and NOT to the app-wide listener —
        // a named file must not be told about every other file's events.
        expect(fileSourceGetInstanceMock).toHaveBeenCalledWith(
            '/docs/slide.owa',
        );
        expect(registeredCallbacks).toHaveLength(2);
        expect(registerFileSourceEventListenerMock).not.toHaveBeenCalled();

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

        expect(unregisterEventListener).toHaveBeenCalledWith('listener-1');
        expect(unregisterEventListener).toHaveBeenCalledWith('listener-2');
    });

    test('falls back to the app-wide listener with no file named', async () => {
        const observedPayloads: string[] = [];
        const registeredCallbacks: Array<(payload?: string) => void> = [];
        registerFileSourceEventListenerMock.mockImplementation(
            (_events: string[], callback: (payload?: string) => void) => {
                registeredCallbacks.push(callback);
                return `listener-${registeredCallbacks.length}`;
            },
        );

        function Probe() {
            useFileSourceRefreshEvents(['update']);
            useFileSourceEvents<string>(
                ['update'],
                (payload) => {
                    observedPayloads.push(payload);
                },
                ['dep'],
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
        expect(fileSourceGetInstanceMock).not.toHaveBeenCalled();

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

        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
            'listener-1',
        );
        expect(unregisterFileSourceEventListenerMock).toHaveBeenCalledWith(
            'listener-2',
        );
    });

    test('keeps file source listeners registered while using the latest callback', async () => {
        const observedPayloads: string[] = [];
        const registeredCallbacks: Array<(payload?: string) => void> = [];
        const unregisterEventListener = genFileSourceStub(registeredCallbacks);

        function Probe({ tag }: Readonly<{ tag: string }>) {
            useFileSourceRefreshEvents(['update'], '/docs/slide.owa');
            useFileSourceEvents<string>(
                ['update'],
                (payload) => {
                    observedPayloads.push(`${tag}:${payload}`);
                },
                [],
                '/docs/slide.owa',
            );
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe tag="first" />);
        });
        expect(registeredCallbacks).toHaveLength(2);

        await act(async () => {
            root?.render(<Probe tag="second" />);
        });
        expect(registeredCallbacks).toHaveLength(2);
        expect(unregisterEventListener).not.toHaveBeenCalled();

        await act(async () => {
            registeredCallbacks[0]?.();
            registeredCallbacks[1]?.('payload');
            await Promise.resolve();
        });

        expect(observedPayloads).toEqual(['second:payload']);
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
            (
                _dirPath: string,
                _options: { signal: AbortSignal },
                callback: (...args: unknown[]) => void,
            ) => {
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
            expect.objectContaining({
                signal: expect.any(AbortSignal),
                recursive: false,
            }),
            expect.any(Function),
        );

        // fs.watch reports filenames relative to the watched directory.
        await act(async () => {
            await watchCallback?.('change', 'new.owa');
        });

        expect(dirSource.alertFileChanging).toHaveBeenCalledWith('new.owa');
        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(1);

        dirSource.filePathsMap = { appDocument: ['/docs/a.owa'] };
        dirSource.getFilePathsQuick.mockResolvedValue(['/docs/b.owa']);

        await act(async () => {
            await watchCallback?.('rename');
        });

        expect(dirSource.fireRefreshEvent).toHaveBeenCalledTimes(2);

        // Windows/Linux surface a history edit as a 'change' on the
        // `.histories` folder entry itself (a top-level name). handleFileEvent
        // forwards the raw changed path as-is; mapping the `.histories` folder
        // back to its document happens in useFilePaths.
        await act(async () => {
            await watchCallback?.('change', 'a1 (Copy).ows.histories');
        });

        expect(dirSource.alertFileChanging).toHaveBeenLastCalledWith(
            'a1 (Copy).ows.histories',
        );

        // macOS's recursive watch reports the write as a sub-path inside the
        // `.histories` folder. Such a change can never alter the directory's
        // top-level file list, so the readdir diff is skipped.
        dirSource.fireRefreshEvent.mockClear();
        await act(async () => {
            await watchCallback?.('rename', 'a1.ows.histories/5-head');
        });

        expect(dirSource.alertFileChanging).toHaveBeenLastCalledWith(
            'a1.ows.histories/5-head',
        );
        expect(dirSource.fireRefreshEvent).not.toHaveBeenCalled();
    });

    test('skips or reports directory watch setup errors', async () => {
        const dirSource = {
            dirPath: '/docs',
            filePathsMap: {},
            alertFileChanging: vi.fn(),
            fireRefreshEvent: vi.fn(),
            getFilePathsQuick: vi.fn(),
        };
        fsCheckDirExistMock
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
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
            root?.render(
                <Probe source={{ ...dirSource, dirPath: '/docs-2' }} />,
            );
            await Promise.resolve();
        });

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'watch failed' }),
        );
    });
});
