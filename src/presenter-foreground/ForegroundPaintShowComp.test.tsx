// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Fill Show and Animation Show: Image Show's way with a fill or an
// animation -- a press puts it up for the session in front, a second press
// takes it down, each session owns one per screen with its own look.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        activeId: '',
        // [screenId, datum] of every overlay of the panel's kind.
        showing: [] as [number, any][],
        listKey: '',
        sessionProps: null as any,
        propsOptions: null as any,
        dropManager: null as any,
        dragStore: { onDropped: null as any },
        pickerProps: null as any,
        // Every picker drawn, by its screen ('' for the one picker).
        pickers: new Map<number | '', any>(),
        // The slide-show control drawn, or null.
        autoPlayProps: null as any,
        runningKeys: [] as string[],
    },
    mocks: {
        setData: vi.fn(),
        put: vi.fn(),
        remove: vi.fn(),
        drag: vi.fn(),
        sync: vi.fn(),
        stop: vi.fn(),
        tick: vi.fn(() => true),
    },
}));

function genManager(screenId: number) {
    return {
        putSessionData: (listKey: string, data: any) => {
            mocks.put(screenId, listKey, data);
        },
        removeSessionData: (listKey: string, data: any) => {
            mocks.remove(screenId, listKey, data);
        },
    };
}

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: useEffect,
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: () => useState(false),
    };
});
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {
        setData: (
            _event: unknown,
            callback: (manager: any) => void,
            isForceChoosing: boolean,
        ) => {
            mocks.setData(isForceChoosing);
            callback(genManager(0));
        },
    },
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundSessionShowingList: (listKey: string) => {
        state.listKey = listKey;
        return state.showing;
    },
    getScreenForegroundManagerInstances: (
        screenId: number,
        callback: (manager: any) => void,
    ) => {
        callback(genManager(screenId));
    },
    getScreenForegroundManagerByDropped: () => state.dropManager,
}));
vi.mock('./propertiesSettingHelpers', () => ({
    genForegroundExtraStyle: (prefix: string) => ({ opacity: 0.5, prefix }),
    getForegroundIsBehind: () => false,
    useForegroundPropsSetting: (options: any) => {
        state.propsOptions = options;
        return { element: <div data-props={options.prefix} /> };
    },
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: () => undefined,
}));
vi.mock('./foregroundSessionHelpers', () => ({
    useForegroundSessions: (props: any) => {
        state.sessionProps = props;
        const suffix = state.activeId === '' ? '' : `-${state.activeId}`;
        return {
            activeId: state.activeId,
            sessionIds: ['', 's1'],
            suffix,
            prefix: props.toPrefix(suffix),
            element: <div data-sessions />,
        };
    },
    checkIsSessionData: (data: any, sessionId: string) => {
        return (data.id ?? '') === sessionId;
    },
    toSessionShowingList: (list: [number, any][], activeId: string) => {
        return list.filter(([, data]) => (data.id ?? '') === activeId);
    },
}));
vi.mock('../media-sessions/MediaSessionsComp', () => ({
    toSessionSuffix: (sessionId: string) => {
        return sessionId === '' ? '' : `-${sessionId}`;
    },
    useMediaSessionAutoPlayRefresh: () => {},
}));
vi.mock('../slide-auto-play/SlideAutoPlayComp', () => ({
    default: (props: any) => {
        state.autoPlayProps = props;
        return <div data-auto-play={props.prefix} />;
    },
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    getRunningAutoPlayKeys: () => state.runningKeys,
}));
vi.mock('../slide-auto-play/slideAutoPlayHelpers', () => ({
    genSlideAutoPlaySettingNames: (prefix: string) => [
        `${prefix}-slide-auto-play-playing`,
    ],
}));
vi.mock('./foregroundPaintAutoPlayHelpers', () => ({
    syncForegroundPaintAutoPlayRunners: mocks.sync,
    stopForegroundPaintAutoPlay: mocks.stop,
    tickForegroundPaint: mocks.tick,
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ target, children }: any) => (
        <div data-layout-target={target}>{children}</div>
    ),
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({ buttonText, showingScreenIdDataList, genTitle }: any) => (
        <div data-hide-row={buttonText}>
            {showingScreenIdDataList.map(([screenId, data]: any) => (
                <span key={screenId} data-hide-title={genTitle(data)} />
            ))}
        </div>
    ),
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onSelect: (event: any) => void) => [
        { menuElement: 'Show on Screens', onSelect },
    ],
}));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: state.dragStore,
    handleDragStart: mocks.drag,
}));
vi.mock('./foregroundDragHelpers', () => ({
    genForegroundDragInf: (kind: string, getData: () => unknown) => ({
        kind,
        getData,
    }),
}));

import ForegroundPaintShowComp, {
    genPaintHideLabel,
} from './ForegroundPaintShowComp';
import { PaintTargetContext } from '../others/color/colorSwatchMenuHelpers';

const RED = '#FF0000';
const BLUE = '#0000FF';

let container: HTMLDivElement;
let root: Root;
let paintTarget: any = null;

function PickerStandInComp(props: any) {
    state.pickerProps = props;
    state.pickers.set(props.screenView?.screenId ?? '', props);
    paintTarget = use(PaintTargetContext);
    return (
        <div
            data-held={props.heldSrc ?? ''}
            data-screen={props.screenView?.screenId ?? ''}
        />
    );
}

function pickerOf(screenId: number | '') {
    return state.pickers.get(screenId);
}

function render(kind: 'fill' | 'animation' = 'fill') {
    act(() => {
        root.render(
            <ForegroundPaintShowComp
                kind={kind}
                hideLabel={genPaintHideLabel(kind)}
                genLabel={(src) => `label:${src}`}
                compareSrc={(one, two) => one === two}
                renderPicker={(props) => <PickerStandInComp {...props} />}
            />,
        );
    });
}

function press(src: string | null) {
    act(() => {
        state.pickerProps.onPick(src, { type: 'click' });
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.activeId = '';
    state.showing = [];
    state.dropManager = null;
    state.dragStore.onDropped = null;
    state.pickerProps = null;
    state.pickers = new Map();
    state.autoPlayProps = null;
    state.runningKeys = [];
    paintTarget = null;
    mocks.sync.mockClear();
    mocks.stop.mockClear();
    mocks.tick.mockClear();
    mocks.setData.mockClear();
    mocks.put.mockClear();
    mocks.remove.mockClear();
    mocks.drag.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Fill Show', () => {
    test('a press puts the fill up for the Default session, with its look', () => {
        render();
        expect(state.listKey).toBe('fillDataList');
        expect(container.querySelector('[data-layout-target="fill"]')).not.toBe(
            null,
        );
        press(RED);
        expect(mocks.setData).toHaveBeenCalledWith(false);
        expect(mocks.put).toHaveBeenCalledTimes(1);
        const [screenId, listKey, data] = mocks.put.mock.calls[0];
        expect(screenId).toBe(0);
        expect(listKey).toBe('fillDataList');
        expect(data.src).toBe(RED);
        // The Default session's datum carries no id at all.
        expect('id' in data).toBe(false);
        expect(data.extraStyle).toEqual({ opacity: 0.5, prefix: 'fill-show' });
    });

    test("another session's press carries its id and its own look", () => {
        state.activeId = 's1';
        render();
        press(BLUE);
        const data = mocks.put.mock.calls[0][2];
        expect(data.id).toBe('s1');
        expect(data.extraStyle.prefix).toBe('fill-show-s1');
    });

    test("a screen's picker takes down what that screen has up, and only that", () => {
        state.showing = [
            [0, { src: RED }],
            [1, { src: RED }],
            [0, { id: 's1', src: RED }],
        ];
        render();
        // One picker per screen this session has something on.
        expect(
            [...container.querySelectorAll('[data-held]')].map((element) => {
                return [
                    element.getAttribute('data-screen'),
                    element.getAttribute('data-held'),
                ];
            }),
        ).toEqual([
            ['0', RED],
            ['1', RED],
        ]);
        act(() => {
            pickerOf(0).onPick(RED, { type: 'click' });
        });
        expect(mocks.setData).not.toHaveBeenCalled();
        expect(mocks.remove.mock.calls).toEqual([
            [0, 'fillDataList', { src: RED }],
        ]);
    });

    test('another fill takes the place of the one up on that screen; No Color takes it down', () => {
        state.showing = [[0, { src: RED }]];
        render();
        act(() => {
            pickerOf(0).onPick(BLUE, { type: 'click' });
        });
        // That screen alone, with no screens asked for.
        expect(mocks.setData).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.put.mock.calls).toHaveLength(1);
        expect(mocks.put.mock.calls[0][0]).toBe(0);
        expect(mocks.put.mock.calls[0][2].src).toBe(BLUE);
        expect(mocks.put.mock.calls[0][2].extraStyle.prefix).toBe('fill-show');
        act(() => {
            pickerOf(0).onPick(null, { type: 'click' });
        });
        expect(mocks.remove.mock.calls).toEqual([
            [0, 'fillDataList', { src: RED }],
        ]);
    });

    test('with nothing up there is one picker, and No Color does nothing', () => {
        render();
        expect(pickerOf('').heldSrc).toBe(null);
        expect(pickerOf('').onEdit).toBeUndefined();
        expect(pickerOf('').customizeView.isCustomizeClosed).toBe(false);
        press(null);
        expect(mocks.setData).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    test("Customize changes that screen's, and nothing else", () => {
        state.showing = [
            [0, { src: RED }],
            [1, { src: BLUE }],
            [2, { id: 's1', src: RED }],
        ];
        render();
        // Screen 2 is another session's: no picker here.
        expect(pickerOf(2)).toBeUndefined();
        act(() => {
            pickerOf(0).onEdit('#00FF00');
        });
        expect(mocks.put.mock.calls).toEqual([
            [0, 'fillDataList', { src: '#00FF00' }],
        ]);
        // What a screen holds already is never sent again.
        act(() => {
            pickerOf(1).onEdit(BLUE);
        });
        expect(mocks.put).toHaveBeenCalledTimes(1);
    });

    test('a Properties change goes up after a pause, as one change', () => {
        state.showing = [[0, { src: RED, extraStyle: {} }]];
        render();
        act(() => {
            state.propsOptions.onChange({ opacity: 0.2 }, false);
            state.propsOptions.onChange({ opacity: 0.3 }, true);
        });
        expect(mocks.put).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(mocks.put).toHaveBeenCalledTimes(1);
        const data = mocks.put.mock.calls[0][2];
        expect(data.src).toBe(RED);
        expect(data.extraStyle).toEqual({ opacity: 0.3 });
        expect(data.isBehind).toBe(true);
    });

    test("the Hide row lists this session's and names each by its fill", () => {
        state.showing = [
            [0, { src: RED }],
            [1, { id: 's1', src: BLUE }],
        ];
        render();
        const row = container.querySelector('[data-hide-row]')!;
        expect(row.getAttribute('data-hide-row')).toBe('Hide Fill');
        expect(
            [...row.querySelectorAll('[data-hide-title]')].map((element) => {
                return element.getAttribute('data-hide-title');
            }),
        ).toEqual([`label:${RED}`]);
        // The session is on a screen only while one of its own is up.
        expect(state.sessionProps.checkIsOnScreen('', '', [''])).toBe(true);
        state.sessionProps.hideSession('s1', '-s1', ['', 's1']);
        expect(mocks.remove.mock.calls).toEqual([
            [1, 'fillDataList', { id: 's1', src: BLUE }],
        ]);
    });

    test('a tile dragged goes to the foreground with the session look', () => {
        render();
        const event = { type: 'dragstart' };
        paintTarget.handleDragStart(event, RED);
        const [dragEvent, dragInf] = mocks.drag.mock.calls[0];
        expect(dragEvent).toBe(event);
        expect(dragInf.kind).toBe('fill');
        expect(dragInf.getData().src).toBe(RED);
        // Dropped on a screen, it is put up there for this session.
        state.dropManager = genManager(3);
        state.dragStore.onDropped({});
        expect(mocks.put.mock.calls[0][0]).toBe(3);
        expect(mocks.put.mock.calls[0][2].src).toBe(RED);
    });

    test('Show on Screens always asks which screens', () => {
        render();
        const [item] = paintTarget.genShowOnScreensMenuItems(RED);
        item.onSelect({ type: 'click' });
        expect(mocks.setData).toHaveBeenCalledWith(true);
        expect(mocks.put.mock.calls[0][2].src).toBe(RED);
    });
});

describe('Animation Show', () => {
    test('a shader dropped on another screen gets a section of its own', () => {
        const CROSS = 'css?name=cross';
        const PLASMA = 'glsl?name=plasma';
        state.showing = [[0, { src: CROSS }]];
        render('animation');
        expect(pickerOf(0).heldSrc).toBe(CROSS);
        expect(pickerOf(1)).toBeUndefined();
        // The drop on screen 1 reaches the panel as an update.
        state.showing = [
            [0, { src: CROSS }],
            [1, { src: PLASMA }],
        ];
        render('animation');
        expect(pickerOf(0).heldSrc).toBe(CROSS);
        expect(pickerOf(1).heldSrc).toBe(PLASMA);
        expect(pickerOf(1).screenView.screenId).toBe(1);
        // Customizing the shader changes screen 1's alone.
        act(() => {
            pickerOf(1).onEdit('glsl?name=plasma&speed=fast');
        });
        expect(mocks.put.mock.calls).toEqual([
            [1, 'animationDataList', { src: 'glsl?name=plasma&speed=fast' }],
        ]);
        // Both screens share the session's Customize toggle.
        act(() => {
            pickerOf(1).screenView.onCustomizeToggle();
        });
        expect(pickerOf(0).screenView.isCustomizeClosed).toBe(true);
        expect(pickerOf(1).screenView.isCustomizeClosed).toBe(true);
    });

    test('works on the animation list, under its own prefix and label', () => {
        render('animation');
        expect(state.listKey).toBe('animationDataList');
        expect(
            container
                .querySelector('[data-hide-row]')!
                .getAttribute('data-hide-row'),
        ).toBe('Hide Animation');
        press('css?name=aurora');
        expect(mocks.put.mock.calls[0][1]).toBe('animationDataList');
        expect(mocks.put.mock.calls[0][2].extraStyle.prefix).toBe(
            'animation-show',
        );
    });
});

describe('a slide show per session', () => {
    test('is offered once the session has one up, under its own key', () => {
        render();
        expect(container.querySelector('[data-auto-play]')).toBe(null);
        state.activeId = 's1';
        state.showing = [[0, { id: 's1', src: RED }]];
        render();
        expect(
            container
                .querySelector('[data-auto-play]')
                ?.getAttribute('data-auto-play'),
        ).toBe('foreground-fill-s1');
        expect(state.autoPlayProps.isTimerExternal).toBe(true);
        expect(state.autoPlayProps.isInline).toBe(true);
        // Another session's overlay is not this session's to walk.
        state.activeId = '';
        render();
        expect(container.querySelector('[data-auto-play]')).toBe(null);
    });

    test('what goes up or comes off reconciles the timers, and so does Play', () => {
        render('animation');
        expect(mocks.sync).toHaveBeenLastCalledWith('animation');
        mocks.sync.mockClear();
        state.showing = [[0, { src: RED }]];
        render('animation');
        expect(mocks.sync).toHaveBeenCalledWith('animation');
        mocks.sync.mockClear();
        act(() => {
            state.autoPlayProps.onStateChange();
        });
        expect(mocks.sync).toHaveBeenCalledWith('animation');
    });

    test("the control's own step walks this session", () => {
        state.activeId = 's1';
        state.showing = [[1, { id: 's1', src: RED }]];
        render();
        const answer = state.autoPlayProps.onNext({
            isNext: false,
            options: {},
        });
        expect(mocks.tick).toHaveBeenCalledWith('fill', 's1', false);
        expect(answer).toBe(true);
    });

    test('a removed session takes its show and its show settings with it', () => {
        render();
        expect(state.sessionProps.toOwnSettingNames('-s1')).toContain(
            'foreground-fill-s1-slide-auto-play-playing',
        );
        state.showing = [[0, { id: 's1', src: RED }]];
        render();
        act(() => {
            state.sessionProps.hideSession('s1', '-s1', ['', 's1']);
        });
        expect(mocks.stop).toHaveBeenCalledWith('fill', '-s1');
        expect(mocks.remove).toHaveBeenCalledWith(0, 'fillDataList', {
            id: 's1',
            src: RED,
        });
    });

    test("a chip's play mark is lit only while its show runs with one up", () => {
        state.showing = [[0, { id: 's1', src: RED }]];
        render();
        const check = state.sessionProps.checkIsAutoPlaying;
        expect(check('s1', '-s1', ['', 's1'])).toBe(false);
        state.runningKeys = ['foreground-fill-s1'];
        render();
        expect(
            state.sessionProps.checkIsAutoPlaying('s1', '-s1', ['', 's1']),
        ).toBe(true);
        // Running, but with nothing up: the show is over.
        expect(state.sessionProps.checkIsAutoPlaying('', '', ['', 's1'])).toBe(
            false,
        );
        state.runningKeys = ['foreground-fill'];
        state.showing = [];
        render();
        expect(state.sessionProps.checkIsAutoPlaying('', '', ['', 's1'])).toBe(
            false,
        );
    });
});
