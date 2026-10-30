// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The foreground launcher's catalog: which data says a component is on a
// screen, which panel each row opens, and where a slide show is running.

const { state } = vi.hoisted(() => ({
    state: {
        foregroundList: [] as [number, any][],
        longTextScreenIds: [] as number[],
        runningKeys: [] as string[],
    },
}));

vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getLongTextShowingList: () =>
            state.longTextScreenIds.map((screenId) => [screenId, {}]),
    },
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        checkIsOnScreen: (data: any) => boolean,
    ) => state.foregroundList.filter(([, data]) => checkIsOnScreen(data)),
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    getRunningAutoPlayKeys: () => state.runningKeys,
}));
// Every panel, stood in by its name. The thin wrappers (Marquee Top, Video
// Show...) stay real: what they ARE is which shared panel they open, and how.
vi.mock('./ForegroundMessageComp', () => ({
    default: () => <span>panel:message</span>,
}));
vi.mock('./ForegroundMarqueeComp', () => ({
    default: ({ position }: { position: string }) => (
        <span>panel:marquee:{position}</span>
    ),
}));
vi.mock('./ForegroundQuickTextComp', () => ({
    default: () => <span>panel:quick-text</span>,
}));
vi.mock('./ForegroundLongTextComp', () => ({
    default: () => <span>panel:long-text</span>,
}));
vi.mock('./ForegroundCountDownComp', () => ({
    default: () => <span>panel:countdown</span>,
}));
vi.mock('./ForegroundStopwatchComp', () => ({
    default: () => <span>panel:stopwatch</span>,
}));
vi.mock('./ForegroundTimeComp', () => ({
    default: () => <span>panel:time</span>,
}));
vi.mock('./ForegroundMediaComp', () => ({
    default: ({ kind }: { kind: string }) => <span>panel:media:{kind}</span>,
}));
vi.mock('./ForegroundCameraComp', () => ({
    default: () => <span>panel:camera</span>,
}));
vi.mock('./ForegroundScreenComp', () => ({
    default: () => <span>panel:screen</span>,
}));

import {
    FOREGROUND_WIDGET_LIST,
    genForegroundPanelMenuItems,
    toForegroundPanelPersistKey,
} from './foregroundWidgetHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.foregroundList = [];
    state.longTextScreenIds = [];
    state.runningKeys = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

function getWidget(key: string) {
    const widget = FOREGROUND_WIDGET_LIST.find((item) => item.key === key);
    expect(widget, `widget ${key}`).toBeDefined();
    return widget!;
}

describe('which data puts a component on a screen', () => {
    const emptyData = {
        messageDataList: [],
        marqueeTopData: null,
        marqueeBottomData: null,
        quickTextData: null,
        countdownData: null,
        stopwatchData: null,
        timeDataList: [],
        videoDataList: [],
        imageDataList: [],
        cameraDataList: [],
        screenDataList: [],
        webDataList: [],
    };
    const onScreenData: { [key: string]: object } = {
        message: { messageDataList: [{ id: 'm' }] },
        'marquee-top': { marqueeTopData: { text: 'top' } },
        'marquee-bottom': { marqueeBottomData: { text: 'bottom' } },
        'quick-text': { quickTextData: { htmlText: 'hi' } },
        countdown: { countdownData: { id: 'c' } },
        stopwatch: { stopwatchData: { id: 's' } },
        time: { timeDataList: [{ id: 't' }] },
        video: { videoDataList: [{ id: 'v' }] },
        image: { imageDataList: [{ id: 'i' }] },
        camera: { cameraDataList: [{ id: 'k' }] },
        screen: { screenDataList: [{ id: 1 }] },
        web: { webDataList: [{ id: 'w' }] },
    };

    test.each(Object.keys(onScreenData))(
        '%s is on a screen only while its own data is',
        (key) => {
            const widget = getWidget(key);
            expect(widget.checkIsOnScreen(emptyData as any)).toBe(false);
            expect(
                widget.checkIsOnScreen({
                    ...emptyData,
                    ...onScreenData[key],
                } as any),
            ).toBe(true);
            // Another component's data says nothing about this one.
            const otherKey = key === 'message' ? 'web' : 'message';
            expect(
                widget.checkIsOnScreen({
                    ...emptyData,
                    ...onScreenData[otherKey],
                } as any),
            ).toBe(false);
        },
    );

    test('a list missing from old data reads as empty', () => {
        for (const key of [
            'message',
            'time',
            'video',
            'image',
            'camera',
            'screen',
            'web',
        ]) {
            expect(getWidget(key).checkIsOnScreen({} as any)).toBe(false);
        }
    });

    test('Long Text Show never answers from the foreground data', () => {
        expect(
            getWidget('long-text').checkIsOnScreen({
                ...emptyData,
                ...onScreenData.message,
            } as any),
        ).toBe(false);
    });
});

describe('the panel each launcher row opens', () => {
    const expectedPanels: [string, string][] = [
        ['message', 'panel:message'],
        ['marquee-top', 'panel:marquee:top'],
        ['marquee-bottom', 'panel:marquee:bottom'],
        ['quick-text', 'panel:quick-text'],
        ['long-text', 'panel:long-text'],
        ['countdown', 'panel:countdown'],
        ['stopwatch', 'panel:stopwatch'],
        ['time', 'panel:time'],
        ['video', 'panel:media:video'],
        ['image', 'panel:media:image'],
        ['camera', 'panel:camera'],
        ['screen', 'panel:screen'],
        ['web', 'panel:media:web'],
    ];

    test('covers every component in the launcher', () => {
        expect(FOREGROUND_WIDGET_LIST.map((widget) => widget.key)).toEqual(
            expectedPanels.map(([key]) => key),
        );
    });

    test.each(expectedPanels)(
        '%s loads its own panel when it is first opened',
        async (key, panelText) => {
            const { Comp } = getWidget(key);
            await act(async () => {
                root.render(
                    <Suspense fallback={<span>loading</span>}>
                        <Comp />
                    </Suspense>,
                );
            });
            // The panel is a lazy import: under a full, loaded suite it can
            // take far longer than a few ticks, so wait on the result.
            await vi.waitFor(
                async () => {
                    await act(async () => {
                        await new Promise((resolve) => setTimeout(resolve, 5));
                    });
                    expect(container.textContent).toBe(panelText);
                },
                { timeout: 8000, interval: 5 },
            );
        },
    );
});

describe('the launcher menu', () => {
    function renderMenuElements(items: { menuElement: any }[]) {
        act(() => {
            root.render(
                <>
                    {items.map((item, index) => (
                        <div key={index} data-row={index}>
                            {item.menuElement}
                        </div>
                    ))}
                </>,
            );
        });
    }

    test('marks where a slide show runs, in the default session or any other', () => {
        state.runningKeys = [
            'foreground-video',
            'foreground-image-session-2',
            // Another component's key that merely starts the same way.
            'foreground-webcam',
        ];
        const items = genForegroundPanelMenuItems('', vi.fn(), (key) => key);
        renderMenuElements(items);
        const playingTitles = items
            .filter((_, index) =>
                container.querySelector(
                    `[data-row="${index}"] .bi-play-circle-fill`,
                ),
            )
            .map((item) => item.title);
        expect(playingTitles).toEqual(['Video Show', 'Image Show']);
        expect(
            (container.querySelector('.bi-play-circle-fill') as HTMLElement)
                .title,
        ).toBe('Slide show is running');
    });

    test('ticks the open panels, and a pick toggles that panel', () => {
        const onToggle = vi.fn();
        const items = genForegroundPanelMenuItems(
            'time,web',
            onToggle,
            (key) => `[${key}]`,
        );
        const iconOf = (title: string) =>
            items.find((item) => item.title === title)!.childBefore.props
                .className;
        expect(iconOf('[Time]')).toBe('bi bi-check2-square');
        expect(iconOf('[Web Show]')).toBe('bi bi-check2-square');
        expect(iconOf('[Countdown]')).toBe('bi bi-hourglass-split');
        items.find((item) => item.title === '[Countdown]')!.onSelect();
        expect(onToggle).toHaveBeenCalledExactlyOnceWith('countdown');
    });

    test('names each screen badge in the menu’s own words', () => {
        state.foregroundList = [[2, { webDataList: [{ id: 'w' }] }]];
        const items = genForegroundPanelMenuItems('', vi.fn(), (key) =>
            key === 'Screen' ? 'Écran' : key,
        );
        renderMenuElements(items);
        const badge = container.querySelector('.badge') as HTMLElement;
        expect(badge.textContent).toBe('2');
        expect(badge.title).toBe('Écran: 2');
    });

    test('each panel remembers its own size and place', () => {
        expect(toForegroundPanelPersistKey('message')).toBe(
            'floating-widget-rect-foreground-message',
        );
        expect(toForegroundPanelPersistKey('web')).not.toBe(
            toForegroundPanelPersistKey('message'),
        );
    });
});
