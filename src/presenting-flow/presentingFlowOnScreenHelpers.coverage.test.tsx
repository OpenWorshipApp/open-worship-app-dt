// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        appDocs: {} as any,
        backgrounds: {} as any,
        bibles: {} as any,
        foregrounds: {} as any,
        decoded: null as any,
        bibleItem: null as any,
        flowItems: new Map<string, any[]>(),
        screenUpdate: null as null | (() => void),
    },
    mocks: {
        backgroundSelect: vi.fn(),
        varyData: vi.fn(),
        bibleOnScreen: vi.fn(),
        handleError: vi.fn(),
        acquire: vi.fn(),
        release: vi.fn(),
    },
}));

vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: { getSelectBackgroundSrcList: mocks.backgroundSelect },
}));
vi.mock('../_screen/managers/ScreenBibleManager', () => ({
    default: { name: 'bible' },
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { name: 'foreground' },
}));
vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: { getDataList: mocks.varyData },
}));
vi.mock('../_screen/managers/screenUpdateSubscriberHelpers', () => ({
    genRefCountedScreenUpdateSubscriber: (
        _managers: unknown,
        refresh: () => void,
    ) => {
        state.screenUpdate = refresh;
        return {
            acquire: () => {
                mocks.acquire();
                return mocks.release;
            },
        };
    },
}));
vi.mock('../_screen/screenHelpers', () => ({
    getBackgroundSrcListOnScreenSetting: () => state.backgrounds,
    getBibleListOnScreenSetting: () => state.bibles,
    getForegroundDataListOnScreenSetting: () => state.foregrounds,
}));
vi.mock('../_screen/preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: () => state.appDocs,
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { dragDeserialize: () => state.bibleItem },
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    checkIsBibleItemOnScreen: mocks.bibleOnScreen,
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/dragHelpers', () => ({
    deserializeDragData: () => state.decoded,
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('./PresentingFlow', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getItems: async () => state.flowItems.get(filePath) ?? null,
        }),
    },
}));

import { DragTypeEnum } from '../helper/DragInf';
import {
    checkIsAnyPresentingFlowOnScreen,
    checkIsAnythingOnScreen,
    checkIsPresentingFlowFilePathOnScreen,
    checkIsPresentingFlowItemOnScreen,
    refreshOnScreenAfterPresenting,
    refreshOnScreenNow,
    toPresentingFlowItemOnScreenKey,
    useIsOnScreenChecking,
} from './presentingFlowOnScreenHelpers';

function item(overrides: Record<string, unknown> = {}) {
    return {
        type: 'none',
        itemFilePath: '/file',
        id: 2,
        data: null,
        isError: false,
        isSlide: false,
        isAppDocument: false,
        isBackground: false,
        isForeground: false,
        isBibleItem: false,
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.appDocs = {};
    state.backgrounds = {};
    state.bibles = {};
    state.foregrounds = {};
    state.decoded = null;
    state.bibleItem = null;
    state.flowItems.clear();
    mocks.backgroundSelect.mockReturnValue([]);
    mocks.varyData.mockReturnValue([]);
    mocks.bibleOnScreen.mockResolvedValue(false);
});

describe('presenting-flow on-screen matching', () => {
    test('uses the four cheap settings as an early presence gate', () => {
        expect(checkIsAnythingOnScreen()).toBe(false);
        for (const key of [
            'appDocs',
            'backgrounds',
            'bibles',
            'foregrounds',
        ] as const) {
            state[key] = { one: {} };
            expect(checkIsAnythingOnScreen()).toBe(true);
            state[key] = {};
        }
    });

    test('matches errors, slides, documents, colors, and serialized backgrounds', async () => {
        expect(
            await checkIsPresentingFlowItemOnScreen(item({ isError: true })),
        ).toBe(false);
        mocks.varyData.mockReturnValueOnce([{}]);
        expect(
            await checkIsPresentingFlowItemOnScreen(item({ isSlide: true })),
        ).toBe(true);
        expect(mocks.varyData).toHaveBeenCalledWith('/file', 2);
        mocks.varyData.mockReturnValueOnce([{}]);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({ isAppDocument: true }),
            ),
        ).toBe(true);
        expect(mocks.varyData).toHaveBeenCalledWith('/file');

        mocks.backgroundSelect.mockReturnValueOnce(['red']);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    type: DragTypeEnum.BACKGROUND_COLOR,
                    data: '#f00',
                    isBackground: true,
                }),
            ),
        ).toBe(true);
        state.decoded = { item: { src: '/video.mp4' } };
        mocks.backgroundSelect.mockReturnValueOnce(['/video.mp4']);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    type: DragTypeEnum.BACKGROUND_VIDEO,
                    data: '/video.mp4',
                    isBackground: true,
                }),
            ),
        ).toBe(true);
        state.decoded = { item: { src: 4 } };
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    isBackground: true,
                }),
            ),
        ).toBe(false);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({ type: 'unknown', isBackground: true }),
            ),
        ).toBe(false);
    });

    test('matches every foreground family by its stable data', async () => {
        const foregroundData = {
            messageDataList: [{ textList: ['a', 'b'] }],
            countdownData: {},
            stopwatchData: {},
            quickTextData: {},
            marqueeTopData: { text: 'top' },
            marqueeBottomData: { text: 'bottom' },
            timeDataList: [{ id: 1 }],
            cameraDataList: [{ id: 2 }],
            webDataList: [{ filePath: '/web' }],
            videoDataList: [{ filePath: '/video' }],
            imageDataList: [{ filePath: '/image' }],
        };
        state.foregrounds = { one: foregroundData };
        const cases = [
            ['message', { textList: ['a', 'b'] }],
            ['countdown', {}],
            ['stopwatch', {}],
            ['quick-text', {}],
            ['marquee-top', { text: 'top' }],
            ['marquee-bottom', { text: 'bottom' }],
            ['time', { id: 1 }],
            ['camera', { id: 2 }],
            ['web', { filePath: '/web' }],
            ['video', { filePath: '/video' }],
            ['image', { filePath: '/image' }],
        ];
        for (const [target, data] of cases) {
            expect(
                await checkIsPresentingFlowItemOnScreen(
                    item({
                        isForeground: true,
                        data: { target, data },
                    }),
                ),
                String(target),
            ).toBe(true);
        }
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    isForeground: true,
                    data: { target: 'missing', data: {} },
                }),
            ),
        ).toBe(false);
        state.foregrounds = {
            one: { messageDataList: [{ textList: ['wrong'] }] },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    isForeground: true,
                    data: { target: 'message', data: { textList: ['a'] } },
                }),
            ),
        ).toBe(false);
    });

    test('deserializes bible rows and rejects unsupported entries', async () => {
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({ isBibleItem: true }),
            ),
        ).toBe(false);
        state.bibleItem = { id: 4 };
        mocks.bibleOnScreen.mockResolvedValueOnce(true);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({ isBibleItem: true }),
            ),
        ).toBe(true);
        expect(mocks.bibleOnScreen).toHaveBeenCalledWith([{ id: 4 }]);
        expect(await checkIsPresentingFlowItemOnScreen(item())).toBe(false);
        expect(toPresentingFlowItemOnScreenKey(item())).toBe('none-/file-2');
    });

    test('checks one or several run sheets only after the cheap gate', async () => {
        state.flowItems.set('/one', [item()]);
        expect(await checkIsPresentingFlowFilePathOnScreen('/one')).toBe(false);
        expect(await checkIsAnyPresentingFlowOnScreen(['/one'])).toBe(false);
        state.appDocs = { live: {} };
        expect(await checkIsPresentingFlowFilePathOnScreen('/missing')).toBe(
            false,
        );
        mocks.varyData.mockReturnValue([{}]);
        state.flowItems.set('/two', [item({ isSlide: true })]);
        expect(await checkIsAnyPresentingFlowOnScreen(['/one', '/two'])).toBe(
            true,
        );
        state.flowItems.set('/three', [item(), item({ isSlide: true })]);
        expect(await checkIsPresentingFlowFilePathOnScreen('/three')).toBe(
            true,
        );
    });

    test('subscribes once, refreshes changed values, and handles failed checks', async () => {
        let value = false;
        const seen: boolean[] = [];
        function Harness() {
            const isOnScreen = useIsOnScreenChecking(() => value, 'row');
            seen.push(isOnScreen);
            return null;
        }
        const container = document.createElement('div');
        const root = createRoot(container);
        await act(async () => root.render(<Harness />));
        expect(mocks.acquire).toHaveBeenCalled();
        value = true;
        await act(async () => {
            state.screenUpdate?.();
            await Promise.resolve();
        });
        expect(seen.at(-1)).toBe(true);
        refreshOnScreenNow();
        refreshOnScreenAfterPresenting();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await act(async () => root.unmount());
        expect(mocks.release).toHaveBeenCalled();

        function BrokenHarness() {
            useIsOnScreenChecking(async () => {
                throw new Error('failed');
            }, 'broken');
            return null;
        }
        const brokenRoot = createRoot(document.createElement('div'));
        await act(async () => brokenRoot.render(<BrokenHarness />));
        await Promise.resolve();
        expect(mocks.handleError).toHaveBeenCalled();
        await act(async () => brokenRoot.unmount());
    });
});
