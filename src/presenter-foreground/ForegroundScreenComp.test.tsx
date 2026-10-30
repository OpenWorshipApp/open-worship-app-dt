// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Screen Show: one card per screen, which puts THAT screen's picture up on
// another screen as an overlay.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        // Every screen there is, as the screen managers list them.
        screenBases: [] as {
            screenId: number;
            width: number;
            height: number;
        }[],
        // Listed, but with no manager behind the id any more.
        unknownBaseIds: new Set<number>(),
        // [screenId, foreground data] as the foreground setting holds them.
        screens: [] as [number, any][],
        propsOptions: new Map<string, any>(),
        isBehind: new Map<string, boolean>(),
        transitions: new Map<string, string>(),
        dropManager: null as any,
        dragStore: { onDropped: null as any },
    },
    mocks: {
        addScreenData: vi.fn(),
        managerAddScreenData: vi.fn(),
        managerRemoveScreenData: vi.fn(),
        manager: vi.fn(),
        drag: vi.fn(),
        screenManagerEvents: vi.fn(),
        foregroundEvents: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ label, onOpening }: any) => (
        <button type="button" aria-label={label} onClick={onOpening} />
    ),
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { addScreenData: mocks.addScreenData },
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        predicate: (value: any) => boolean,
    ) => state.screens.filter(([, data]) => predicate(data)),
    getScreenForegroundManagerInstances: (
        screenId: number,
        callback: (value: any) => void,
    ) => {
        mocks.manager(screenId);
        callback({
            addScreenData: (data: any) => {
                mocks.managerAddScreenData(screenId, data);
            },
            removeScreenData: (data: any) => {
                mocks.managerRemoveScreenData(screenId, data);
            },
        });
    },
    getScreenForegroundManagerByDropped: () => state.dropManager,
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: any) => <i data-icon-screen-id={screenId} />,
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: mocks.foregroundEvents,
}));
vi.mock('../_screen/managers/screenManagerHooks', () => ({
    useScreenManagerEvents: mocks.screenManagerEvents,
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => state.screenBases,
    getScreenManagerBase: (screenId: number) =>
        state.unknownBaseIds.has(screenId)
            ? null
            : (state.screenBases.find((base) => base.screenId === screenId) ??
              null),
}));
vi.mock('./propertiesSettingHelpers', () => ({
    getForegroundIsBehind: (prefix: string) =>
        state.isBehind.get(prefix) ?? false,
    useForegroundPropsSetting: (options: any) => {
        state.propsOptions.set(options.prefix, options);
        return {
            genStyle: () => ({ opacity: 0.5 }),
            element: <div data-testid={`props-${options.prefix}`} />,
        };
    },
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: (_widgetKey: string, prefix: string) =>
        state.transitions.get(prefix),
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ target, children }: any) => (
        <div data-layout-target={target}>{children}</div>
    ),
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

import ForegroundScreenComp from './ForegroundScreenComp';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.screenBases = [
        { screenId: 0, width: 1920, height: 1080 },
        { screenId: 1, width: 1024, height: 768 },
    ];
    state.unknownBaseIds.clear();
    state.screens = [];
    state.propsOptions.clear();
    state.isBehind.clear();
    state.transitions.clear();
    state.dropManager = null;
    state.dragStore.onDropped = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<ForegroundScreenComp />);
    });
}
function getCardBody(screenId: number) {
    const body = container.querySelector(
        `[data-screen-id="${screenId}"]`,
    ) as HTMLElement | null;
    expect(body, `card of screen ${screenId}`).not.toBeNull();
    return body!;
}

describe('Screen Show cards', () => {
    test('draws one card per screen, in its own colour and shape, and follows the screen list', async () => {
        await render();
        expect(mocks.screenManagerEvents).toHaveBeenCalledWith([
            'instance',
            'visible',
            'color-note-update',
        ]);
        const titles = Array.from(
            container.querySelectorAll('.card-header'),
        ).map((header) => (header as HTMLElement).title);
        expect(titles).toEqual(['Screen: 0', 'Screen: 1']);
        // Not a live picture: the screen's number in its identity colour.
        const picture = getCardBody(1).firstElementChild as HTMLElement;
        expect(picture.textContent).toBe('1');
        expect(picture.style.aspectRatio).toBe('1024 / 768');
        expect(picture.style.backgroundColor).not.toBe('');
        expect(getCardBody(0).firstElementChild as HTMLElement).toHaveProperty(
            'style.aspectRatio',
            '1920 / 1080',
        );
        expect(genColorFromScreenId(0)).not.toBe(genColorFromScreenId(1));
        // Each card's Properties are its own, under `screen-show-`, which
        // a deleted screen's sweep does not reach.
        expect(
            container.querySelector('[data-testid="props-screen-show-0"]'),
        ).not.toBeNull();
        expect(state.propsOptions.get('screen-show-1')).toMatchObject({
            isCommonStyle: false,
            isBlendMode: true,
            widgetKey: 'screen',
        });
    });

    test('a click shows the screen, a right click or the dots choose where', async () => {
        state.transitions.set('screen-show-1', 'zoom');
        await render();
        await act(async () => getCardBody(1).click());
        expect(mocks.addScreenData).toHaveBeenLastCalledWith(
            expect.anything(),
            { id: 1, extraStyle: { opacity: 0.5 }, transitionEffect: 'zoom' },
            false,
        );
        await act(async () => {
            getCardBody(0).dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        // No transition chosen: the datum carries no key at all.
        expect(mocks.addScreenData).toHaveBeenLastCalledWith(
            expect.anything(),
            { id: 0, extraStyle: { opacity: 0.5 } },
            true,
        );
        const dots = container.querySelectorAll(
            'button[aria-label="Show on Screens"]',
        );
        expect(dots).toHaveLength(2);
        state.isBehind.set('screen-show-0', true);
        await act(async () => (dots[0] as HTMLButtonElement).click());
        expect(mocks.addScreenData).toHaveBeenLastCalledWith(
            expect.anything(),
            { id: 0, extraStyle: { opacity: 0.5 }, isBehind: true },
            true,
        );
    });

    test('a screen whose manager cannot be found is drawn 16:9', async () => {
        state.screenBases = [{ screenId: 3, width: 800, height: 600 }];
        state.unknownBaseIds.add(3);
        await render();
        expect(
            (getCardBody(3).firstElementChild as HTMLElement).style.aspectRatio,
        ).toBe('16 / 9');
        state.screenBases = [];
        await render();
        expect(container.querySelector('[data-screen-id]')).toBeNull();
    });

    test('a drag carries the current screen show, and only a screen takes the drop', async () => {
        await render();
        await act(async () => {
            getCardBody(1).dispatchEvent(
                new Event('dragstart', { bubbles: true }),
            );
        });
        const dragData = mocks.drag.mock.calls.at(-1)?.[1];
        expect(dragData.kind).toBe('screen');
        state.isBehind.set('screen-show-1', true);
        expect(dragData.getData()).toEqual({
            id: 1,
            extraStyle: { opacity: 0.5 },
            isBehind: true,
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.managerAddScreenData).not.toHaveBeenCalled();
        const dropAdd = vi.fn();
        state.dropManager = { addScreenData: dropAdd };
        await act(async () => state.dragStore.onDropped({}));
        expect(dropAdd).toHaveBeenCalledExactlyOnceWith({
            id: 1,
            extraStyle: { opacity: 0.5 },
            isBehind: true,
        });
    });
});

describe('what a screen is showing', () => {
    test('lists only the screens showing THIS card’s screen, and hides one', async () => {
        const showsOne = { id: 1, extraStyle: {} };
        const showsZero = { id: 0, extraStyle: {} };
        state.screens = [
            [0, { screenDataList: [showsOne] }],
            [2, { screenDataList: [showsOne, showsZero] }],
            [3, { screenDataList: [] }],
        ];
        await render();
        const hideButtons = Array.from(
            container.querySelectorAll('button.fg-hide'),
        ) as HTMLButtonElement[];
        expect(
            hideButtons.map((button) => button.getAttribute('aria-label')),
        ).toEqual([
            // Card 0: screen 2 shows screen 0.
            'Hide Screen Show 2',
            // Card 1: screens 0 and 2 show screen 1.
            'Hide Screen Show 0',
            'Hide Screen Show 2',
        ]);
        expect(hideButtons[1].title).toBe('Screen: 1');
        await act(async () => hideButtons[2].click());
        expect(mocks.managerRemoveScreenData).toHaveBeenCalledExactlyOnceWith(
            2,
            showsOne,
        );
    });

    test('a Properties change restyles every screen showing that card, after the hand stops', async () => {
        const showsOne = { id: 1, extraStyle: { opacity: 1 } };
        state.screens = [
            [0, { screenDataList: [showsOne] }],
            [2, { screenDataList: [showsOne] }],
        ];
        await render();
        await act(async () => {
            state.propsOptions
                .get('screen-show-1')
                .onChange({ opacity: 0.2 }, true);
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(mocks.managerAddScreenData).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(mocks.managerAddScreenData.mock.calls).toEqual([
            [0, { id: 1, extraStyle: { opacity: 0.2 }, isBehind: true }],
            [2, { id: 1, extraStyle: { opacity: 0.2 }, isBehind: true }],
        ]);
    });

    test('two cards changed together both refresh: each card keeps its own timer', async () => {
        const showsZero = { id: 0, extraStyle: {}, isBehind: true };
        const showsOne = { id: 1, extraStyle: {} };
        state.screens = [[2, { screenDataList: [showsZero, showsOne] }]];
        await render();
        await act(async () => {
            state.propsOptions
                .get('screen-show-0')
                .onChange({ opacity: 0.3 }, false);
            state.propsOptions
                .get('screen-show-1')
                .onChange({ opacity: 0.6 }, false);
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.managerAddScreenData.mock.calls).toEqual([
            // Out from behind: the key is dropped rather than set false.
            [2, { id: 0, extraStyle: { opacity: 0.3 } }],
            [2, { id: 1, extraStyle: { opacity: 0.6 } }],
        ]);
    });
});
