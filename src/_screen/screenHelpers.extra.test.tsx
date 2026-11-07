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
const showPlayToBottomContextMenuMock = vi.fn();

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
    tran: (v: string) => v,
}));

vi.mock('../scrolling/scrollingHandlerHelpers', () => ({
    PLAY_TO_BOTTOM_CLASSNAME: 'play-to-bottom',
    PLAY_TO_BOTTOM_MENU_CLASSNAME: 'play-to-bottom-menu',
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

// Partial mock: only `useAppStateAsync` is simplified here, and the module's
// siblings (`useAppCurrentRef`) must survive or the hook under test throws.
vi.mock('../helper/appHooks', async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
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

vi.mock('../scrolling/playToBottomMenuHelpers', () => ({
    showPlayToBottomContextMenu: showPlayToBottomContextMenuMock,
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

    test('hands every caller its own copy of the on-screen maps', async () => {
        // The parse is memoized, but the persist paths read a map, add or
        // delete their own screen's key and write the whole thing back — so a
        // caller must never be able to reach the memoized object.
        const { screenManagerSettingNames } =
            await import('../helper/constants');
        const screenHelpers = await import('./screenHelpers');

        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.BACKGROUND) {
                return JSON.stringify({
                    1: { type: 'color', src: '#fff' },
                });
            }
            if (key === screenManagerSettingNames.FOREGROUND) {
                return JSON.stringify({ 1: { marqueeTopData: null } });
            }
            return undefined;
        });

        const backgroundList =
            screenHelpers.getBackgroundSrcListOnScreenSetting();
        expect(Object.keys(backgroundList)).toEqual(['1']);
        delete backgroundList['1'];
        (backgroundList as any)['9'] = { type: 'color', src: '#000' };
        expect(
            Object.keys(screenHelpers.getBackgroundSrcListOnScreenSetting()),
        ).toEqual(['1']);

        const foregroundList =
            screenHelpers.getForegroundDataListOnScreenSetting();
        delete foregroundList['1'];
        expect(
            Object.keys(screenHelpers.getForegroundDataListOnScreenSetting()),
        ).toEqual(['1']);
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

    test('with no mini screen up, a menu opens from the corner; with one, from its corner', async () => {
        const screenHelpers = await import('./screenHelpers');
        expect(screenHelpers.genScreenMouseEvent()).toEqual({
            clientX: 0,
            clientY: 0,
        });
        expect(createMouseEventMock).toHaveBeenLastCalledWith(0, 0);

        const miniScreen = document.createElement('div');
        miniScreen.className = 'mini-screen';
        miniScreen.getBoundingClientRect = () => ({ x: 12, y: 34 }) as DOMRect;
        document.body.appendChild(miniScreen);
        expect(screenHelpers.genScreenMouseEvent()).toEqual({
            clientX: 12,
            clientY: 34,
        });
    });

    test('a foreground map that cannot be checked against the screens is reported and reads as empty', async () => {
        const { screenManagerSettingNames } =
            await import('../helper/constants');
        const screenHelpers = await import('./screenHelpers');
        const error = new Error('no screen list');
        getValidOnScreenMock.mockImplementationOnce(() => {
            throw error;
        });
        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.FOREGROUND) {
                return JSON.stringify({
                    1: { marqueeTopData: { text: 'not checked' } },
                });
            }
            return undefined;
        });
        expect(screenHelpers.getForegroundDataListOnScreenSetting()).toEqual(
            {},
        );
        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('the Bible map drops only the entries it cannot show, and says which', async () => {
        const { screenManagerSettingNames } =
            await import('../helper/constants');
        const BibleItem = (await import('../bible-list/BibleItem'))
            .default as any;
        const screenHelpers = await import('./screenHelpers');
        BibleItem.validate.mockImplementation((bibleItem: any) => {
            if (bibleItem?.id === 'broken') {
                throw new Error('Invalid bible item');
            }
        });
        getValidOnScreenMock.mockImplementation((items) => items);
        const renderedList = [
            {
                locale: 'en',
                bibleKey: 'KJV',
                title: 'John 3:16',
                verses: [{ num: '16', text: 'For God so loved' }],
            },
        ];
        const valid = {
            type: 'bible-item',
            bibleItemData: { bibleItem: { id: 'ok' }, renderedList },
        };
        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.FULL_TEXT) {
                return JSON.stringify({
                    1: valid,
                    2: {
                        type: 'bible-item',
                        bibleItemData: {
                            bibleItem: { id: 'broken' },
                            renderedList,
                        },
                    },
                    // Written by a newer build sharing the data folder.
                    3: { type: 'hymn-sheet' },
                });
            }
            return undefined;
        });
        expect(screenHelpers.getBibleListOnScreenSetting()).toEqual({
            1: valid,
        });
        expect(
            handleErrorMock.mock.calls.map(([error]) => {
                return (error as Error).message;
            }),
        ).toEqual([
            'Dropping invalid bible-screen-view entry for screen id: 2',
            'Dropping invalid bible-screen-view entry for screen id: 3',
        ]);
    });

    test('a Bible map that is not there, or cannot be checked against the screens, reads as empty', async () => {
        const { screenManagerSettingNames } =
            await import('../helper/constants');
        const screenHelpers = await import('./screenHelpers');
        const settings = new Map<string, string>([
            [screenManagerSettingNames.FULL_TEXT, ''],
            [screenManagerSettingNames.MANAGERS, '["bible-empty-case"]'],
        ]);
        getSettingMock.mockImplementation((key: string) => settings.get(key));
        expect(screenHelpers.getBibleListOnScreenSetting()).toEqual({});
        expect(getValidOnScreenMock).not.toHaveBeenCalled();

        const error = new Error('no screen list');
        getValidOnScreenMock.mockImplementation(() => {
            throw error;
        });
        settings.set(
            screenManagerSettingNames.FULL_TEXT,
            JSON.stringify({ 1: { type: 'hymn-sheet' } }),
        );
        expect(screenHelpers.getBibleListOnScreenSetting()).toEqual({});
        expect(handleErrorMock).toHaveBeenLastCalledWith(error);
    });

    test('on the projected screen the auto-scroll button has no menu; in a preview its menu opens without scrolling', async () => {
        const appProvider = (await import('../server/appProvider'))
            .default as any;
        const screenHelpers = await import('./screenHelpers');
        appProvider.isPageScreen = true;
        try {
            const onScreen = document.createElement('div');
            screenHelpers.addPlayToBottom(onScreen);
            expect(onScreen.querySelector('img.play-to-bottom')).not.toBeNull();
            expect(
                onScreen.querySelector('img.play-to-bottom-menu'),
            ).toBeNull();
        } finally {
            delete appProvider.isPageScreen;
        }

        const preview = document.createElement('div');
        const onFrame = vi.fn();
        screenHelpers.addPlayToBottom(preview, onFrame);
        const button = preview.querySelector(
            'img.play-to-bottom',
        ) as HTMLImageElement;
        expect(button.title).toBe('Play to bottom');
        expect(applyPlayToBottomMock).toHaveBeenLastCalledWith(
            button,
            undefined,
            onFrame,
        );
        const menu = preview.querySelector(
            'img.play-to-bottom-menu',
        ) as HTMLImageElement;
        // Right after its button: the stylesheet's sibling selector shows it.
        expect(button.nextElementSibling).toBe(menu);
        expect(menu.title).toBe('Auto Scroll Options');
        expect(menu.src).toMatch(/^data:image\/svg\+xml/);

        const onPreviewClick = vi.fn();
        preview.addEventListener('click', onPreviewClick);
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        menu.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(true);
        expect(onPreviewClick).not.toHaveBeenCalled();
        expect(showPlayToBottomContextMenuMock).toHaveBeenCalledWith(
            click,
            button,
        );
    });

    test('screen updates are checked once they stop coming, by every instance for itself', async () => {
        vi.useFakeTimers();
        try {
            const screenHelpers = await import('./screenHelpers');
            const live = new Set<string>();
            const checkIsOnScreen = vi.fn(async (paths: string[]) => {
                return live.has(paths[0]);
            });
            const callbacks = new Map<string, () => void>();
            let renderingId = '';
            useScreenUpdateEventsMock.mockImplementation(
                (_screenManagerBase: unknown, callback: () => void) => {
                    callbacks.set(renderingId, callback);
                },
            );
            function Host({ id }: Readonly<{ id: string }>) {
                renderingId = id;
                const isOnScreen = screenHelpers.useFileSourceIsOnScreen(
                    [`/slides/${id}.txt`],
                    checkIsOnScreen,
                );
                return <div data-id={id} data-on-screen={`${isOnScreen}`} />;
            }
            const read = () => {
                return ['a', 'b'].map((id) => {
                    return container.querySelector<HTMLElement>(
                        `[data-id="${id}"]`,
                    )!.dataset.onScreen;
                });
            };
            await act(async () => {
                root.render(
                    <>
                        <Host id="a" />
                        <Host id="b" />
                    </>,
                );
            });
            await act(async () => {
                await Promise.resolve();
            });
            expect(read()).toEqual(['false', 'false']);

            live.add('/slides/a.txt');
            live.add('/slides/b.txt');
            // One screen update reaches both instances...
            act(() => {
                callbacks.get('a')!();
                callbacks.get('b')!();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(300);
            });
            // ...and another reaches only a before the wait is over.
            act(() => {
                callbacks.get('a')!();
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(200);
            });
            expect(read()).toEqual(['false', 'true']);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(299);
            });
            expect(read()).toEqual(['false', 'true']);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(read()).toEqual(['true', 'true']);
        } finally {
            vi.useRealTimers();
        }
    });

    test('an answer for paths the hook no longer holds is dropped, not passed on', async () => {
        vi.useFakeTimers();
        try {
            const screenHelpers = await import('./screenHelpers');
            const held: { resolve?: (isOnScreen: boolean) => void } = {};
            let isHolding = false;
            const checkIsOnScreen = vi.fn((_paths: string[]) => {
                if (isHolding) {
                    isHolding = false;
                    return new Promise<boolean>((resolve) => {
                        held.resolve = resolve;
                    });
                }
                return Promise.resolve(false);
            });
            const onUpdate = vi.fn();
            function Host({ filePaths }: Readonly<{ filePaths: string[] }>) {
                const isOnScreen = screenHelpers.useFileSourceIsOnScreen(
                    filePaths,
                    checkIsOnScreen,
                    onUpdate,
                );
                return <div data-on-screen={`${isOnScreen}`} />;
            }
            await act(async () => {
                root.render(<Host filePaths={['/slides/old.txt']} />);
            });
            await act(async () => {
                await Promise.resolve();
            });
            const fireUpdate = updateCallback!;
            isHolding = true;
            await act(async () => {
                fireUpdate();
                await vi.advanceTimersByTimeAsync(500);
            });
            expect(checkIsOnScreen).toHaveBeenLastCalledWith([
                '/slides/old.txt',
            ]);
            expect(held.resolve).toBeDefined();

            // Re-fed another file while that check was out.
            await act(async () => {
                root.render(<Host filePaths={['/slides/new.txt']} />);
            });
            await act(async () => {
                held.resolve!(true);
                await Promise.resolve();
                await Promise.resolve();
            });
            expect(onUpdate).not.toHaveBeenCalledWith(true);
            expect(container.querySelector('div')!.dataset.onScreen).toBe(
                'false',
            );
        } finally {
            vi.useRealTimers();
        }
    });
});
