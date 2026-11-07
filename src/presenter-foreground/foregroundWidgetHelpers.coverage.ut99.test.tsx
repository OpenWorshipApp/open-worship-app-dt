// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The launcher's list: that every entry opens ITS OWN component, that each
// one's on-screen test reads its own slot of the foreground data, and that
// the chooser marks a running slide show and toggles the panel it names.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        foregroundList: [] as [number, any][],
        longTextScreenIds: [] as number[],
        runningKeys: [] as string[],
    },
    mocks: { onToggle: vi.fn() },
}));

vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getLongTextShowingList: () => {
            return state.longTextScreenIds.map((screenId) => {
                return [screenId, {}];
            });
        },
    },
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        checkIsOnScreen: (data: any) => boolean,
    ) => {
        return state.foregroundList.filter(([, data]) => {
            return checkIsOnScreen(data);
        });
    },
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    getRunningAutoPlayKeys: () => {
        return state.runningKeys;
    },
}));
// Each panel's module, standing in for the real (heavy) component so the
// loaders can be checked for pointing at the right one.
vi.mock('./ForegroundMessageComp', () => ({
    default: () => <span data-comp="message" />,
}));
vi.mock('./ForegroundMarqueeTopComp', () => ({
    default: () => <span data-comp="marquee-top" />,
}));
vi.mock('./ForegroundMarqueeBottomComp', () => ({
    default: () => <span data-comp="marquee-bottom" />,
}));
vi.mock('./ForegroundQuickTextComp', () => ({
    default: () => <span data-comp="quick-text" />,
}));
vi.mock('./ForegroundLongTextComp', () => ({
    default: () => <span data-comp="long-text" />,
}));
vi.mock('./ForegroundCountDownComp', () => ({
    default: () => <span data-comp="countdown" />,
}));
vi.mock('./ForegroundStopwatchComp', () => ({
    default: () => <span data-comp="stopwatch" />,
}));
vi.mock('./ForegroundTimeComp', () => ({
    default: () => <span data-comp="time" />,
}));
vi.mock('./ForegroundVideoComp', () => ({
    default: () => <span data-comp="video" />,
}));
vi.mock('./ForegroundImageComp', () => ({
    default: () => <span data-comp="image" />,
}));
vi.mock('./ForegroundCameraComp', () => ({
    default: () => <span data-comp="camera" />,
}));
vi.mock('./ForegroundScreenComp', () => ({
    default: () => <span data-comp="screen" />,
}));
vi.mock('./ForegroundWebComp', () => ({
    default: () => <span data-comp="web" />,
}));

import {
    FOREGROUND_WIDGET_LIST,
    genForegroundPanelMenuItems,
    toForegroundPanelPersistKey,
} from './foregroundWidgetHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

function getWidget(key: string) {
    const widget = FOREGROUND_WIDGET_LIST.find((item) => {
        return item.key === key;
    });
    if (widget === undefined) {
        throw new Error(`no foreground component "${key}"`);
    }
    return widget;
}

describe('the foreground components', () => {
    test('every entry of the launcher opens its own component', async () => {
        expect(
            FOREGROUND_WIDGET_LIST.map((widget) => {
                return widget.key;
            }),
        ).toEqual([
            'message',
            'marquee-top',
            'marquee-bottom',
            'quick-text',
            'long-text',
            'countdown',
            'stopwatch',
            'time',
            'video',
            'image',
            'camera',
            'screen',
            'web',
        ]);
        for (const widget of FOREGROUND_WIDGET_LIST) {
            const { Comp } = widget;
            await act(async () => {
                root.render(
                    <Suspense fallback={<span data-comp="loading" />}>
                        <Comp />
                    </Suspense>,
                );
            });
            await act(async () => {
                await Promise.resolve();
            });
            expect(
                container
                    .querySelector('[data-comp]')!
                    .getAttribute('data-comp'),
                widget.key,
            ).toBe(widget.key);
        }
    });

    test.each([
        ['message', 'messageDataList', 'list'],
        ['marquee-top', 'marqueeTopData', 'slot'],
        ['marquee-bottom', 'marqueeBottomData', 'slot'],
        ['quick-text', 'quickTextData', 'slot'],
        ['countdown', 'countdownData', 'slot'],
        ['stopwatch', 'stopwatchData', 'slot'],
        ['time', 'timeDataList', 'list'],
        ['video', 'videoDataList', 'list'],
        ['image', 'imageDataList', 'list'],
        ['camera', 'cameraDataList', 'list'],
        ['screen', 'screenDataList', 'list'],
        ['web', 'webDataList', 'list'],
    ] as const)(
        '%s is on a screen exactly when its %s holds something',
        (key, field, kind) => {
            const { checkIsOnScreen } = getWidget(key);
            // Another component's slot being full is not this one on screen.
            const otherField =
                field === 'marqueeTopData'
                    ? 'marqueeBottomData'
                    : 'marqueeTopData';
            if (kind === 'slot') {
                expect(
                    checkIsOnScreen({ [field]: null, [otherField]: {} } as any),
                ).toBe(false);
                expect(checkIsOnScreen({ [field]: { id: 'a' } } as any)).toBe(
                    true,
                );
                return;
            }
            // A list the data was saved without counts as empty.
            expect(checkIsOnScreen({} as any)).toBe(false);
            expect(checkIsOnScreen({ [field]: [] } as any)).toBe(false);
            expect(checkIsOnScreen({ [field]: [{ id: 'a' }] } as any)).toBe(
                true,
            );
        },
    );

    test('Long Text Show is never in the foreground data, whatever it holds', () => {
        const { checkIsOnScreen } = getWidget('long-text');
        expect(checkIsOnScreen({ messageDataList: [{}] } as any)).toBe(false);
    });

    test('the chooser marks a running slide show and toggles the panel it names', () => {
        state.runningKeys = [
            // The Default session of Video Show, and a second Image session.
            'foreground-video',
            'foreground-image-session-2',
            // A key that only STARTS like a widget's is not that widget's.
            'foreground-webcam',
        ];
        const translate = (key: string) => {
            return `t(${key})`;
        };
        const menuItems = genForegroundPanelMenuItems(
            'video',
            mocks.onToggle,
            translate,
        );
        const findItem = (title: string) => {
            return menuItems.find((item) => {
                return item.title === title;
            })!;
        };
        const readMark = (title: string) => {
            const [, , autoPlay] = (findItem(title).menuElement as any).props
                .children;
            return autoPlay === null ? null : autoPlay.props.title;
        };
        expect(readMark('t(Video Show)')).toBe('t(Slide show is running)');
        expect(readMark('t(Image Show)')).toBe('t(Slide show is running)');
        expect(readMark('t(Web Show)')).toBeNull();
        expect(readMark('t(Messages)')).toBeNull();
        // An open panel is ticked; a closed one shows its own icon.
        expect(
            (findItem('t(Video Show)').childBefore as any).props.className,
        ).toBe('bi bi-check2-square');
        expect(
            (findItem('t(Web Show)').childBefore as any).props.className,
        ).toBe('bi bi-globe2');

        findItem('t(Web Show)').onSelect();
        expect(mocks.onToggle).toHaveBeenCalledWith('web');
    });

    test('a panel remembers its place under its own key', () => {
        expect(toForegroundPanelPersistKey('countdown')).toBe(
            'floating-widget-rect-foreground-countdown',
        );
        expect(toForegroundPanelPersistKey('web')).not.toBe(
            toForegroundPanelPersistKey('video'),
        );
    });
});
