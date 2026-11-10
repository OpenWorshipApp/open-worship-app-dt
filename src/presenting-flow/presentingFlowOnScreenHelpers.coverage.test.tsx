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
        // Set once, when the module under test is imported.
        screenManagers: null as null | (() => unknown[]),
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
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
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
        managers: () => unknown[],
        refresh: () => void,
    ) => {
        state.screenManagers = managers;
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

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { DragTypeEnum } from '../helper/DragInf';
import { toForegroundRowKey } from '../presenter-foreground/foregroundDragHelpers';
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
            countdownDataList: [{ rowKey: toForegroundRowKey({}) }],
            stopwatchDataList: [{ rowKey: toForegroundRowKey({}) }],
            quickTextDataList: [{ rowKey: toForegroundRowKey({}) }],
            marqueeTopDataList: [{ text: 'top' }],
            marqueeBottomDataList: [{ text: 'bottom' }],
            timeDataList: [{ id: 1 }],
            cameraDataList: [{ id: 2 }],
            screenDataList: [{ id: 3 }],
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
            ['screen', { id: 3 }],
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

    test('a slot row is live only while ITS OWN replay is up', async () => {
        const fiveMinutes = { durationSecond: 300 };
        const tenMinutes = { durationSecond: 600 };
        const countdownRow = (data: unknown) => {
            return item({
                isForeground: true,
                data: { target: 'countdown', data },
            });
        };
        // Started from the panel: no row put it there.
        state.foregrounds = {
            one: { countdownDataList: [{ dateTime: 'x' }] },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(countdownRow(fiveMinutes)),
        ).toBe(false);
        state.foregrounds = {
            one: {
                countdownDataList: [
                    { rowKey: toForegroundRowKey(fiveMinutes) },
                ],
            },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(countdownRow(fiveMinutes)),
        ).toBe(true);
        expect(
            await checkIsPresentingFlowItemOnScreen(countdownRow(tenMinutes)),
        ).toBe(false);
    });

    test('a quick-text row is live when ANY entry of the list is its replay', async () => {
        const notice = { markdownText: 'Notice' };
        const other = { markdownText: 'Other' };
        const quickTextRow = (data: unknown) => {
            return item({
                isForeground: true,
                data: { target: 'quick-text', data },
            });
        };
        state.foregrounds = {
            one: {
                quickTextDataList: [
                    { id: 'a', rowKey: toForegroundRowKey(other) },
                    { id: 'b', rowKey: toForegroundRowKey(notice) },
                ],
            },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(quickTextRow(notice)),
        ).toBe(true);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                quickTextRow({ markdownText: 'Not up' }),
            ),
        ).toBe(false);
        // An empty list is nothing up, whatever an old slot beside it says.
        state.foregrounds = {
            one: {
                quickTextDataList: [],
                quickTextData: { rowKey: toForegroundRowKey(notice) },
            },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(quickTextRow(notice)),
        ).toBe(false);
    });

    // The saved map is read raw, never parsed: an entry an older app saved
    // still holds its ONE datum of a kind until that screen is next written.
    test("an older saved entry's single slot still marks its row live", async () => {
        const notice = { markdownText: 'Notice' };
        const fiveMinutes = { durationSecond: 300 };
        const row = (target: string, data: unknown) => {
            return item({ isForeground: true, data: { target, data } });
        };
        state.foregrounds = {
            one: {
                quickTextData: { rowKey: toForegroundRowKey(notice) },
                countdownData: { rowKey: toForegroundRowKey(fiveMinutes) },
                stopwatchData: { rowKey: toForegroundRowKey({}) },
                marqueeTopData: { text: 'top' },
                marqueeBottomData: { text: 'bottom' },
            },
        };
        for (const [target, data] of [
            ['quick-text', notice],
            ['countdown', fiveMinutes],
            ['stopwatch', {}],
            ['marquee-top', { text: 'top' }],
            ['marquee-bottom', { text: 'bottom' }],
        ] as const) {
            expect(
                await checkIsPresentingFlowItemOnScreen(row(target, data)),
                target,
            ).toBe(true);
        }
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('quick-text', { markdownText: 'Not up' }),
            ),
        ).toBe(false);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('marquee-top', { text: 'bottom' }),
            ),
        ).toBe(false);
        // A slot an older app saved empty is nothing up.
        state.foregrounds = { one: { quickTextData: null } };
        expect(
            await checkIsPresentingFlowItemOnScreen(row('quick-text', notice)),
        ).toBe(false);
    });

    test('a slot row is live while ANY session of its kind holds its replay', async () => {
        const fiveMinutes = { durationSecond: 300 };
        const tenMinutes = { durationSecond: 600 };
        const row = (target: string, data: unknown) => {
            return item({ isForeground: true, data: { target, data } });
        };
        // Session A's countdown from the panel, session B's from this row:
        // the row is up although it is not the first entry.
        state.foregrounds = {
            one: {
                countdownDataList: [
                    { id: 'a', dateTime: 'x' },
                    { id: 'b', rowKey: toForegroundRowKey(fiveMinutes) },
                ],
                marqueeBottomDataList: [
                    { id: 'a', text: 'first' },
                    { id: 'b', text: 'second' },
                ],
            },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('countdown', fiveMinutes),
            ),
        ).toBe(true);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('countdown', tenMinutes),
            ),
        ).toBe(false);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('marquee-bottom', { text: 'second' }),
            ),
        ).toBe(true);
        expect(
            await checkIsPresentingFlowItemOnScreen(
                row('marquee-bottom', { text: 'third' }),
            ),
        ).toBe(false);
    });

    test('a message row is live when ANY message up has its words', async () => {
        state.foregrounds = {
            one: {
                messageDataList: [{ textList: ['first'] }, { textList: ['b'] }],
            },
        };
        expect(
            await checkIsPresentingFlowItemOnScreen(
                item({
                    isForeground: true,
                    data: { target: 'message', data: { textList: ['b'] } },
                }),
            ),
        ).toBe(true);
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

    test('the one screen subscription hears every manager a row can be live on', () => {
        const managers = state.screenManagers!();
        const expected = [
            ScreenVaryAppDocumentManager,
            ScreenBackgroundManager,
            ScreenLongTextManager,
            ScreenForegroundManager,
        ];
        expect(managers).toHaveLength(expected.length);
        for (const manager of expected) {
            expect(managers).toContain(manager);
        }
    });

    test('a message row carrying no list of words is never live', async () => {
        state.foregrounds = { one: { messageDataList: [{ textList: ['a'] }] } };
        for (const data of [{}, { textList: 'a' }, null]) {
            expect(
                await checkIsPresentingFlowItemOnScreen(
                    item({
                        isForeground: true,
                        data: { target: 'message', data },
                    }),
                ),
                JSON.stringify(data),
            ).toBe(false);
        }
    });

    test('several run sheets with nothing of theirs up answer no', async () => {
        state.appDocs = { live: {} };
        state.flowItems.set('/one', [item()]);
        expect(
            await checkIsAnyPresentingFlowOnScreen(['/one', '/missing']),
        ).toBe(false);
        expect(await checkIsAnyPresentingFlowOnScreen([])).toBe(false);
    });
});
