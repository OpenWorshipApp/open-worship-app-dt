// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const createMouseEventMock = vi.fn((x: number, y: number) => ({
    clientX: x,
    clientY: y,
}));
const sendDataMock = vi.fn();
const sendDataSyncMock = vi.fn();
const appLogMock = vi.fn();
const applyPlayToBottomMock = vi.fn();
const applyToTheTopMock = vi.fn();
const getSettingMock = vi.fn();
const handleErrorMock = vi.fn();
const getValidOnScreenMock = vi.fn((items: Record<string, unknown>) => {
    return Object.fromEntries(
        Object.entries(items).filter(([key]) => Number.parseInt(key) === 1),
    );
});
const useScreenUpdateEventsMock = vi.fn();

let updateCallback: (() => Promise<void> | void) | undefined;

vi.mock('../helper/loggerHelpers', () => ({
    appLog: appLogMock,
    appError: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: sendDataMock,
            sendDataSync: sendDataSyncMock,
        },
        systemUtils: {
            generateMD5: (src: string) => `md5-${src}`,
        },
    },
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: createMouseEventMock,
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: vi.fn(),
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../lang/langHelpers', () => ({
    checkIsValidLocale: vi.fn(() => true),
}));

vi.mock('../scrolling/scrollingHandlerHelpers', () => ({
    PLAY_TO_BOTTOM_CLASSNAME: 'play-to-bottom',
    TO_THE_TOP_CLASSNAME: 'to-the-top',
    TO_THE_TOP_STYLE_STRING: '.floating-control { position: fixed; }',
    applyPlayToBottom: applyPlayToBottomMock,
    applyToTheTop: applyToTheTopMock,
}));

vi.mock('./managers/screenManagerBaseHelpers', () => ({
    getValidOnScreen: getValidOnScreenMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: vi.fn((_key: string, callback: () => void) => callback()),
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: vi.fn(async () => undefined),
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static readonly validate = vi.fn();
    },
}));

vi.mock('../helper/appHooks', () => {
    return {
        useAppStateAsync: function useAppStateAsync<T>(
            callee: () => Promise<T> | T,
            _deps: ReadonlyArray<unknown> = [],
            defaultValue?: T | null,
        ) {
            const [value, setValue] = useState<T | null | undefined>(
                defaultValue,
            );
            useEffect(() => {
                let isMounted = true;
                void Promise.resolve(callee()).then((newValue) => {
                    if (isMounted) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isMounted = false;
                };
            });
            return [value, setValue] as const;
        },
    };
});

vi.mock('./managers/screenManagerHooks', () => ({
    useScreenUpdateEvents: useScreenUpdateEventsMock,
}));

describe('screenHelpers extra coverage', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.clearAllMocks();
        updateCallback = undefined;
        useScreenUpdateEventsMock.mockImplementation(
            (
                _screenManagerBase: unknown,
                callback?: () => Promise<void> | void,
            ) => {
                updateCallback = callback;
            },
        );
        Object.defineProperty(globalThis.URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:test'),
        });
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('covers fill and stretch media scaling branches', async () => {
        const screenHelpers = await import('./screenHelpers');

        expect(
            screenHelpers.calMediaSizes(
                { parentWidth: 800, parentHeight: 600 },
                { width: 1600, height: 1200 },
                'fill',
            ),
        ).toEqual({
            width: 800,
            height: 600,
            offsetH: 0,
            offsetV: 0,
        });

        expect(
            screenHelpers.calMediaSizes(
                { parentWidth: 800, parentHeight: 600 },
                { width: 1600, height: 200 },
                'stretch',
            ),
        ).toEqual({
            width: 4800,
            height: 600,
            offsetH: -2000,
            offsetV: 0,
        });
        expect(appLogMock).toHaveBeenCalledWith('stretch');
    });

    test('reuses existing scroll controls and accepts explicit mouse events', async () => {
        const screenHelpers = await import('./screenHelpers');
        const mouseEvent = new MouseEvent('contextmenu');

        expect(screenHelpers.genScreenMouseEvent(mouseEvent)).toBe(mouseEvent);
        expect(createMouseEventMock).not.toHaveBeenCalled();

        const topContainer = document.createElement('div');
        const oldTopIcon = document.createElement('img');
        oldTopIcon.className = 'to-the-top';
        const scrollCallback = vi.fn();
        (oldTopIcon as any)._scrollCallback = scrollCallback;
        topContainer.appendChild(oldTopIcon);
        topContainer.removeEventListener = vi.fn();

        screenHelpers.addToTheTop(topContainer);

        expect(topContainer.removeEventListener).toHaveBeenCalledWith(
            'scroll',
            scrollCallback,
        );
        expect(topContainer.querySelectorAll('img.to-the-top')).toHaveLength(1);
        expect(applyToTheTopMock).toHaveBeenCalledOnce();

        const bottomContainer = document.createElement('div');
        const existingBottomIcon = document.createElement('img');
        existingBottomIcon.className = 'play-to-bottom';
        bottomContainer.appendChild(existingBottomIcon);

        screenHelpers.addPlayToBottom(bottomContainer);

        expect(
            bottomContainer.querySelectorAll('img.play-to-bottom'),
        ).toHaveLength(1);
        expect(applyPlayToBottomMock).not.toHaveBeenCalled();
    });

    test('ignores invalid foreground and background settings', async () => {
        const { screenManagerSettingNames } =
            await import('../helper/constants');
        const screenHelpers = await import('./screenHelpers');

        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.FOREGROUND) {
                return '{';
            }
            if (key === screenManagerSettingNames.BACKGROUND) {
                return JSON.stringify({
                    1: { type: 'color' },
                    2: { src: '#fff' },
                });
            }
            return undefined;
        });

        expect(screenHelpers.getForegroundDataListOnScreenSetting()).toEqual(
            {},
        );
        expect(handleErrorMock).toHaveBeenCalledOnce();
        expect(screenHelpers.getBackgroundSrcListOnScreenSetting()).toEqual({});
    });

    test('tracks file-source visibility and refreshes it on update events', async () => {
        const screenHelpers = await import('./screenHelpers');

        function Host({ filePaths }: Readonly<{ filePaths: string[] }>) {
            const isOnScreen = screenHelpers.useFileSourceIsOnScreen(
                filePaths,
                async (paths) => {
                    return paths.includes('/slides/live.txt');
                },
            );
            return <div data-on-screen={`${isOnScreen}`} />;
        }

        await act(async () => {
            root.render(<Host filePaths={[]} />);
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(container.querySelector('div')?.dataset.onScreen).toBe('false');

        await act(async () => {
            root.render(<Host filePaths={['/slides/live.txt']} />);
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(container.querySelector('div')?.dataset.onScreen).toBe('true');

        await act(async () => {
            root.render(<Host filePaths={['/slides/archived.txt']} />);
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(container.querySelector('div')?.dataset.onScreen).toBe('false');

        await act(async () => {
            root.render(<Host filePaths={['/slides/live.txt']} />);
        });
        await act(async () => {
            await Promise.resolve();
            await updateCallback?.();
            await Promise.resolve();
        });
        expect(container.querySelector('div')?.dataset.onScreen).toBe('true');
    });
});
