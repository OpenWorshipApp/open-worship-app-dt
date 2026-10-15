// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../tools/owa-devtools-mcp/tran.mjs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, any>(),
        dictionaries: [] as Record<string, string>[],
        screens: [] as [number, any][],
        activeId: 'session-a',
        sessionOptions: new Map<string, any>(),
        propsOptions: new Map<string, any>(),
        dropManager: null as any,
        dragStore: { onDropped: null as any },
        keyboardCallback: null as null | (() => void),
        selectedScreenIds: [] as number[],
    },
    mocks: {
        persist: vi.fn(),
        menu: vi.fn(),
        confirm: vi.fn(),
        toast: vi.fn(),
        closeMenu: vi.fn(),
        showTop: vi.fn(),
        showBottom: vi.fn(),
        showQuick: vi.fn(),
        showCountdown: vi.fn(),
        showStopwatch: vi.fn(),
        showTime: vi.fn(),
        setTop: vi.fn(),
        setBottom: vi.fn(),
        setQuick: vi.fn(),
        setCountdown: vi.fn(),
        setStopwatch: vi.fn(),
        addTime: vi.fn(),
        removeTime: vi.fn(),
        manager: vi.fn(),
        showMessages: vi.fn(),
        showMessageSet: vi.fn(),
        setMessages: vi.fn(),
        addMessage: vi.fn(),
        removeMessage: vi.fn(),
        drag: vi.fn(),
        markdown: vi.fn(),
    },
}));

// Keep English labels easy to query while checking BOTH real dictionaries.
// A missing dynamic key must fail this harness instead of being hidden by an identity stub.
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getCurrentLocale: () => 'en-US',
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef, useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: any) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    function useSetting(name: string, fallback: any) {
        const [value, setValue] = useState(() =>
            state.settings.has(name)
                ? state.settings.get(name)
                : typeof fallback === 'function'
                  ? fallback()
                  : fallback,
        );
        return [
            value,
            (next: any) => {
                state.settings.set(name, next);
                mocks.persist(name, next);
                setValue(next);
            },
        ];
    }
    return {
        useStateSettingString: useSetting,
        useStateSettingNumber: useSetting,
        useStateSettingBoolean: useSetting,
        getSetting: (name: string) => state.settings.get(name) ?? null,
        setSetting: (name: string, value: string) => {
            state.settings.set(name, value);
            mocks.persist(name, value);
        },
    };
});
vi.mock('../helper/SettingManager', () => ({
    genStringListSettingManager: (name: string) => ({
        getSetting: () => state.settings.get(name) ?? [],
        setSetting: (value: string[]) => {
            state.settings.set(name, value);
            mocks.persist(name, value);
        },
    }),
}));
vi.mock('moment-timezone', () => ({
    tz: Object.assign(
        (name: string) => ({
            utcOffset: () =>
                name === 'Asia/Kathmandu'
                    ? 345
                    : name === 'Asia/Kolkata'
                      ? 330
                      : 0,
        }),
        { names: () => ['Etc/UTC', 'Asia/Kolkata', 'Asia/Kathmandu'] },
    ),
}));
vi.mock('../helper/helpers', () => ({ getRandomUUID: () => 'saved-new' }));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    MESSAGE_ALL_ID: 'message-all',
    default: {
        setMarqueeTop: mocks.showTop,
        setMarqueeBottom: mocks.showBottom,
        setQuickText: mocks.showQuick,
        setCountdown: mocks.showCountdown,
        setStopwatch: mocks.showStopwatch,
        addTimeData: mocks.showTime,
        addMessageData: mocks.showMessages,
        setData: mocks.showMessageSet,
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        predicate: (value: any) => boolean,
    ) => state.screens.filter(([, data]) => predicate(data)),
    getScreenForegroundManagerInstances: (
        id: number,
        callback: (value: any) => void,
    ) => {
        mocks.manager(id);
        callback({
            setMarqueeTopData: mocks.setTop,
            setMarqueeBottomData: mocks.setBottom,
            setQuickTextData: mocks.setQuick,
            setCountdownData: mocks.setCountdown,
            setStopwatchData: mocks.setStopwatch,
            addTimeData: mocks.addTime,
            removeTimeData: mocks.removeTime,
            foregroundData: state.screens.find(
                ([screenId]) => screenId === id,
            )?.[1] ?? { messageDataList: [] },
            setMessageDataList: mocks.setMessages,
            addMessageData: mocks.addMessage,
            removeMessageData: mocks.removeMessage,
        });
    },
    getScreenForegroundManagerByDropped: () => state.dropManager,
}));
vi.mock('./propertiesSettingHelpers', () => ({
    getForegroundIsBehind: () => true,
    useForegroundPropsSetting: (options: any) => {
        state.propsOptions.set(options.prefix, options);
        return {
            genStyle: () => ({ color: 'red' }),
            getIsBehind: () => true,
            getTransition: () => 'fade',
            fontFamily: 'serif',
            fontWeight: 'bold',
            element: options.extraControls ?? null,
        };
    },
}));
vi.mock('./foregroundSessionHelpers', () => ({
    genForegroundPropsSettingNames: (prefix: string) => [
        `properties-${prefix}`,
    ],
    checkIsSessionData: (data: any, id: string) => data.id === id,
    toSessionShowingList: (list: [number, any][], id: string) =>
        list.filter(([, data]) => data.id === id),
    useForegroundSessions: (options: any) => {
        state.sessionOptions.set(options.widgetKey, options);
        const suffix = `-${state.activeId}`;
        return {
            activeId: state.activeId,
            sessionIds: ['session-a', 'session-b'],
            suffix,
            prefix:
                options.toPrefix?.(suffix) ?? `${options.widgetKey}${suffix}`,
            element: null,
        };
    },
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({
        showingScreenIdDataList,
        buttonText,
        handleForegroundHiding,
    }: any) => (
        <>
            {showingScreenIdDataList.map(
                ([id, data]: [number, any], index: number) => (
                    <button
                        key={`${id}-${index}`}
                        onClick={() => handleForegroundHiding(id, data)}
                    >
                        {buttonText}
                    </button>
                ),
            )}
        </>
    ),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ label, onOpening }: any) => (
        <button onClick={onOpening}>{label}</button>
    ),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (_events: unknown, callback: () => void) => {
        state.keyboardCallback = callback;
    },
}));
vi.mock('../keyboard-shortcut/appShortcutMappers', () => ({
    toggleMessagesEventMapper: {},
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getSelectedScreenManagerBases: () =>
        state.selectedScreenIds.map((screenId) => ({ screenId })),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: mocks.markdown,
}));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: state.dragStore,
    handleDragStart: mocks.drag,
}));
vi.mock('./foregroundDragHelpers', () => ({
    COUNTDOWN_LEAD_SECOND: 1,
    genForegroundDragInf: (kind: string, getData: () => unknown) => ({
        kind,
        getData,
    }),
}));

import ForegroundMarqueeComp from './ForegroundMarqueeComp';
import ForegroundQuickTextComp from './ForegroundQuickTextComp';
import ForegroundCountDownComp from './ForegroundCountDownComp';
import ForegroundStopwatchComp from './ForegroundStopwatchComp';
import ForegroundTimeComp from './ForegroundTimeComp';
import ForegroundMessageComp from './ForegroundMessageComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
import ForegroundTimerControlsComp, {
    ForegroundAutoStartSwitchComp,
} from './ForegroundTimerControlsComp';

let container: HTMLDivElement;
let root: Root;
const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.dictionaries = dictionaries;
    state.screens = [];
    state.activeId = 'session-a';
    state.sessionOptions.clear();
    state.propsOptions.clear();
    state.dropManager = null;
    state.dragStore.onDropped = null;
    state.keyboardCallback = null;
    state.selectedScreenIds = [];
    mocks.menu.mockReturnValue({ closeMenu: mocks.closeMenu });
    mocks.markdown.mockImplementation(async (text: string) => ({
        html: `<p>${text}</p>`,
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});
async function render(element: ReactElement) {
    await act(async () => root.render(element));
}
async function click(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === text,
    )!;
    expect(button, `button ${text}`).toBeDefined();
    await act(async () => button.click());
}
async function change(label: string, value: string) {
    const input = container.querySelector(`[aria-label="${label}"]`) as
        HTMLInputElement | HTMLTextAreaElement;
    expect(input).not.toBeNull();
    await act(async () => {
        const prototype =
            input instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
            input,
            value,
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('foreground text panels', () => {
    test.each(['top', 'bottom'] as const)(
        'shows and hides the %s marquee with current text, speed and session',
        async (position) => {
            const title = position === 'top' ? 'Top' : 'Bottom';
            const show = position === 'top' ? mocks.showTop : mocks.showBottom;
            const set = position === 'top' ? mocks.setTop : mocks.setBottom;
            state.screens = [
                [
                    3,
                    {
                        marqueeTopData: { id: 'session-a' },
                        marqueeBottomData: { id: 'session-a' },
                    },
                ],
            ];
            await render(<ForegroundMarqueeComp position={position} />);
            await change(`Marquee ${title}`, 'Welcome today');
            await change(`Marquee ${title} font size (0 = auto)`, '75');
            await change(`Marquee ${title} scroll speed (%)`, '150');
            await click(`Show Marquee ${title}`);
            expect(show).toHaveBeenLastCalledWith(
                expect.anything(),
                'Welcome today',
                { color: 'red', fontSize: '75px' },
                150,
                false,
                'session-a',
                true,
                'fade',
            );
            await click('Show on Screens');
            expect(show.mock.calls.at(-1)?.[4]).toBe(true);
            await click(`Hide Marquee ${title}`);
            expect(set).toHaveBeenLastCalledWith(null);
            expect(
                state.sessionOptions
                    .get(`marquee-${position}`)
                    .toOwnSettingNames('-session-a'),
            ).toEqual([
                `foreground-marquee-${position}-setting-session-a`,
                `foreground-marquee-${position}-font-size-session-a`,
                `foreground-marquee-${position}-speed-percentage-session-a`,
            ]);
        },
    );

    test('keeps independent debounce timers when top and bottom properties change together', async () => {
        const top = { id: 'session-a', text: 'Top', speedPercentage: 100 };
        const bottom = {
            id: 'session-a',
            text: 'Bottom',
            speedPercentage: 100,
        };
        state.screens = [
            [3, { marqueeTopData: top, marqueeBottomData: bottom }],
        ];
        await render(
            <>
                <ForegroundMarqueeComp position="top" />
                <ForegroundMarqueeComp position="bottom" />
            </>,
        );
        await act(async () => {
            state.propsOptions
                .get('marquee-top-session-a')
                .onChange({ color: 'blue' }, false);
            state.propsOptions
                .get('marquee-bottom-session-a')
                .onChange({ color: 'green' }, true);
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(mocks.setTop).not.toHaveBeenCalled();
        expect(mocks.setBottom).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(mocks.setTop).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'Top',
                extraStyle: { color: 'blue' },
            }),
        );
        expect(mocks.setBottom).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'Bottom',
                extraStyle: { color: 'green' },
                isBehind: true,
            }),
        );
    });

    test('switches text sessions without carrying the previous session text into the next', async () => {
        state.settings.set(
            'foreground-marquee-top-setting-session-a',
            'First notice',
        );
        state.settings.set(
            'foreground-marquee-top-setting-session-b',
            'Second notice',
        );
        await render(<ForegroundMarqueeComp position="top" />);
        expect(
            (container.querySelector('textarea') as HTMLTextAreaElement).value,
        ).toBe('First notice');
        state.activeId = 'session-b';
        await render(<ForegroundMarqueeComp position="top" />);
        expect(
            (container.querySelector('textarea') as HTMLTextAreaElement).value,
        ).toBe('Second notice');
        await change('Marquee Top', 'Edited second');
        expect(
            state.settings.get('foreground-marquee-top-setting-session-a'),
        ).toBe('First notice');
        expect(
            state.settings.get('foreground-marquee-top-setting-session-b'),
        ).toBe('Edited second');
    });

    test('carries current marquee values through drag and refuses a drop without a screen', async () => {
        await render(<ForegroundMarqueeComp position="bottom" />);
        await change('Marquee Bottom', 'Drop notice');
        const button = container.querySelector(
            '[title="Show Marquee Bottom"]',
        )!;
        await act(async () =>
            button.dispatchEvent(new Event('dragstart', { bubbles: true })),
        );
        const dragData = mocks.drag.mock.calls.at(-1)?.[1];
        expect(dragData.kind).toBe('marquee-bottom');
        expect(dragData.getData()).toMatchObject({
            text: 'Drop notice',
            transitionEffect: 'fade',
            isBehind: true,
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setBottom).not.toHaveBeenCalled();
        state.dropManager = { setMarqueeBottomData: mocks.setBottom };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setBottom).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'session-a', text: 'Drop notice' }),
        );
        await act(async () =>
            button.dispatchEvent(new Event('dragend', { bubbles: true })),
        );
        expect(state.dragStore.onDropped).toBeNull();
    });

    test('inserts today and normalizes empty marquee size and speed fields', async () => {
        await render(<ForegroundMarqueeComp position="top" />);
        await click("Today's Date");
        expect(
            (container.querySelector('textarea') as HTMLTextAreaElement).value,
        ).toBe(
            new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
        );
        await change('Marquee Top font size (0 = auto)', '');
        await change('Marquee Top scroll speed (%)', '');
        await click('Show Marquee Top');
        expect(mocks.showTop.mock.calls.at(-1)?.slice(2, 4)).toEqual([
            { color: 'red' },
            100,
        ]);
    });

    test('quick text renders the latest markdown and preserves its delay and lifetime', async () => {
        state.screens = [
            [3, { quickTextData: { id: 'session-a', htmlText: 'old' } }],
        ];
        await render(<ForegroundQuickTextComp />);
        await change('Markdown', '**Notice**');
        await change('Seconds to wait before showing the text', '2');
        await change('Seconds the text stays on screen', '9');
        await click('Show Quick Text');
        expect(mocks.markdown).toHaveBeenCalledWith('**Notice**');
        expect(mocks.showQuick).toHaveBeenLastCalledWith(
            expect.anything(),
            '<p>**Notice**</p>',
            2,
            9,
            { color: 'red' },
            false,
            'session-a',
            true,
            'fade',
        );
        await click('Show on Screens');
        expect(mocks.showQuick.mock.calls.at(-1)?.[5]).toBe(true);
        await click('Hide Quick Text');
        expect(mocks.setQuick).toHaveBeenLastCalledWith(null);
    });

    test('quick-text drag carries markdown source, renders only on a valid drop and refreshes the shown style', async () => {
        const shown = {
            id: 'session-a',
            htmlText: 'old',
            timeSecondDelay: 0,
            timeSecondToLive: 3,
        };
        state.screens = [[3, { quickTextData: shown }]];
        await render(<ForegroundQuickTextComp />);
        await change('Markdown', 'Draft');
        const button = container.querySelector('[title="Show Quick Text"]')!;
        await act(async () =>
            button.dispatchEvent(new Event('dragstart', { bubbles: true })),
        );
        expect(mocks.drag.mock.calls.at(-1)?.[1].getData()).toMatchObject({
            markdownText: 'Draft',
            isBehind: true,
        });
        expect(mocks.markdown).not.toHaveBeenCalled();
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.markdown).not.toHaveBeenCalled();
        state.dropManager = { setQuickTextData: mocks.setQuick };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setQuick).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'session-a',
                htmlText: '<p>Draft</p>',
                transitionEffect: 'fade',
            }),
        );
        mocks.setQuick.mockClear();
        await act(async () => {
            state.propsOptions
                .get('quick-text-session-a')
                .onChange({ color: 'blue' }, true);
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.setQuick.mock.calls).toEqual([
            [null],
            [
                expect.objectContaining({
                    htmlText: 'old',
                    extraStyle: { color: 'blue' },
                    isBehind: true,
                }),
            ],
        ]);
    });

    test('session callbacks hide only their own quick text', async () => {
        state.screens = [
            [1, { quickTextData: { id: 'session-a' } }],
            [2, { quickTextData: { id: 'session-b' } }],
        ];
        await render(<ForegroundQuickTextComp />);
        const options = state.sessionOptions.get('quick-text');
        expect(options.checkIsOnScreen('session-a', '', [])).toBe(true);
        expect(options.checkIsOnScreen('missing', '', [])).toBe(false);
        options.hideSession('session-a', '', []);
        expect(mocks.setQuick).toHaveBeenCalledExactlyOnceWith(null);
        expect(options.toOwnSettingNames('-b')).toEqual([
            'foreground-quick-text-setting-b',
            'foreground-quick-text-time-delay-b',
            'foreground-quick-text-time-to-live-b',
        ]);
    });
});

describe('saved text sessions', () => {
    const pick = vi.fn();
    const panel = (text: string, extra: ReactElement | null = null) => (
        <>
            <SavedTextSessionButtonsComp
                settingName="saved"
                label="Quick Text"
                text={text}
                onPickText={pick}
            />
            {extra}
        </>
    );

    test.each([null, '{bad', '{}', '[null, {}, {"id":1,"text":"bad"}]'])(
        'handles malformed stored sessions: %s',
        async (raw) => {
            state.settings.set('saved', raw);
            await render(panel(''));
            expect(
                (
                    container.querySelector(
                        '[title="Pick a previously saved session"]',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true);
            await click('Save');
            expect(mocks.persist).not.toHaveBeenCalled();
            expect(mocks.toast).toHaveBeenCalledWith(
                'Quick Text',
                'Nothing to save: the text is empty',
            );
        },
    );

    test('saves at most 50 entries and rejects a duplicate of the latest text', async () => {
        const old = Array.from({ length: 50 }, (_, i) => ({
            id: String(i),
            text: `text ${i}`,
        }));
        state.settings.set('saved', JSON.stringify(old));
        await render(panel('new text'));
        await click('Save');
        const saved = JSON.parse(state.settings.get('saved'));
        expect(saved).toHaveLength(50);
        expect(saved[0]).toEqual({ id: 'saved-new', text: 'new text' });
        expect(saved.at(-1)).toEqual(old[48]);
        await click('Save');
        expect(mocks.persist).toHaveBeenCalledTimes(1);
        expect(mocks.toast).toHaveBeenLastCalledWith(
            'Quick Text',
            'This text is already the latest saved session',
        );
    });

    test('preserves full text in the menu and replaces it only after confirmation', async () => {
        state.settings.set(
            'saved',
            JSON.stringify([{ id: 'old', text: 'First\n  second' }]),
        );
        await render(panel('unsaved'));
        await click('Saved (1)');
        const item = mocks.menu.mock.calls.at(-1)?.[1][0];
        expect(item).toMatchObject({
            id: 'old',
            menuElement: 'First second',
            title: 'First\n  second',
        });
        mocks.confirm.mockResolvedValueOnce(false);
        await act(async () => {
            item.onSelect();
        });
        expect(pick).not.toHaveBeenCalled();
        mocks.confirm.mockResolvedValueOnce(true);
        await act(async () => {
            item.onSelect();
        });
        expect(pick).toHaveBeenCalledExactlyOnceWith('First\n  second');
    });

    test('deleting a saved entry closes the menu and persists the surviving entries', async () => {
        state.settings.set(
            'saved',
            JSON.stringify([
                { id: 'old', text: 'First' },
                { id: 'keep', text: 'Second' },
            ]),
        );
        await render(panel('unsaved'));
        await click('Saved (2)');
        const item = mocks.menu.mock.calls.at(-1)?.[1][0];
        await render(panel('unsaved', item.childAfter));
        await act(async () =>
            (
                container.querySelector(
                    '[title="Delete this saved session"]',
                ) as HTMLButtonElement
            ).click(),
        );
        expect(mocks.closeMenu).toHaveBeenCalledOnce();
        expect(JSON.parse(state.settings.get('saved'))).toEqual([
            { id: 'keep', text: 'Second' },
        ]);
        expect(pick).not.toHaveBeenCalled();
    });
});

describe('timer controls', () => {
    test.each(['running', 'paused', 'not-started'] as const)(
        'exposes the appropriate actions for %s',
        async (timerState) => {
            const start = vi.fn(),
                pause = vi.fn(),
                reset = vi.fn();
            await render(
                <ForegroundTimerControlsComp
                    state={timerState}
                    resetTitle="Reset timer"
                    onStart={start}
                    onPause={pause}
                    onReset={reset}
                />,
            );
            await click(
                timerState === 'running'
                    ? 'Pause'
                    : timerState === 'paused'
                      ? 'Resume'
                      : 'Start',
            );
            expect(
                timerState === 'running' ? pause : start,
            ).toHaveBeenCalledOnce();
            await click('Reset');
            expect(reset).toHaveBeenCalledTimes(
                timerState === 'not-started' ? 0 : 1,
            );
            expect(container.textContent).toContain(
                timerState === 'running'
                    ? 'Running'
                    : timerState === 'paused'
                      ? 'Paused'
                      : 'Not started',
            );
        },
    );

    test('auto-start uses the latest setter after a rerender', async () => {
        const old = vi.fn(),
            latest = vi.fn();
        await render(
            <ForegroundAutoStartSwitchComp
                isAutoStart={false}
                setIsAutoStart={old}
            />,
        );
        await render(
            <ForegroundAutoStartSwitchComp
                isAutoStart={false}
                setIsAutoStart={latest}
            />,
        );
        await act(async () =>
            (container.querySelector('input') as HTMLInputElement).click(),
        );
        expect(latest).toHaveBeenCalledWith(true);
        expect(old).not.toHaveBeenCalled();
    });
});

async function clickTitle(title: string) {
    const button = container.querySelector(
        `[title="${title}"]`,
    ) as HTMLButtonElement;
    expect(button, title).not.toBeNull();
    await act(async () => button.click());
}

async function dragTitle(title: string) {
    const button = container.querySelector(`[title="${title}"]`)!;
    await act(async () =>
        button.dispatchEvent(
            new Event('dragstart', { bubbles: true, cancelable: true }),
        ),
    );
    return mocks.drag.mock.calls.at(-1)?.[1];
}

describe('countdown panel', () => {
    test('shows a stopped duration, starts on request and keeps context-menu targeting explicit', async () => {
        await render(<ForegroundCountDownComp />);
        await change('Hours', '1');
        await change('Minutes', '2');
        await change('Seconds', '3');
        await click('Show Countdown');
        expect(mocks.showCountdown).toHaveBeenLastCalledWith(
            expect.anything(),
            {
                dateTime: new Date(Date.now() + 3723000),
                durationMillisecond: 3723000,
                pausedMillisecond: 3723000,
            },
            { color: 'red' },
            false,
            'session-a',
            true,
            'fade',
        );
        await act(async () =>
            (
                container.querySelector(
                    'input[type="checkbox"]',
                ) as HTMLInputElement
            ).click(),
        );
        await click('Start Countdown');
        expect(mocks.showCountdown.mock.calls.at(-1)?.[1]).toEqual({
            dateTime: new Date(Date.now() + 3723000),
            durationMillisecond: 3723000,
        });
        await act(async () =>
            container
                .querySelector('[title="Start Countdown"]')!
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
        );
        expect(mocks.showCountdown.mock.calls.at(-1)?.[3]).toBe(true);
        expect(
            state.settings.get(
                'foreground-countdown-auto-start-setting-session-a',
            ),
        ).toBe(true);
    });

    test('treats emptied and negative duration fields as zero', async () => {
        await render(<ForegroundCountDownComp />);
        await change('Hours', '-1');
        await change('Minutes', '');
        await change('Seconds', '-5');
        await click('Show Countdown');
        expect(mocks.showCountdown.mock.calls.at(-1)?.[1]).toMatchObject({
            durationMillisecond: 0,
            pausedMillisecond: 0,
        });
    });

    test('resolves an auto-start duration at drop time instead of drag-start time', async () => {
        state.settings.set(
            'foreground-countdown-auto-start-setting-session-a',
            true,
        );
        await render(<ForegroundCountDownComp />);
        await change('Minutes', '1');
        const payload = await dragTitle('Start Countdown');
        expect(payload.kind).toBe('countdown');
        expect(payload.getData()).toMatchObject({
            durationSecond: 61,
            isAutoStart: true,
            isBehind: true,
            transitionEffect: 'fade',
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setCountdown).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(4000));
        state.dropManager = { setCountdownData: mocks.setCountdown };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setCountdown).toHaveBeenCalledWith({
            id: 'session-a',
            dateTime: new Date(Date.now() + 60000),
            durationMillisecond: 60000,
            extraStyle: { color: 'red' },
            isBehind: true,
            transitionEffect: 'fade',
        });
    });

    test('refuses a past target for showing and dragging, then accepts a future target', async () => {
        await render(<ForegroundCountDownComp />);
        await change('Countdown Date', '2026-10-13');
        await change('Countdown Time', '10:30');
        await click('Start Countdown to DateTime');
        expect(mocks.toast).toHaveBeenCalledWith(
            'That date and time has already passed',
            'Pick a date and time later than now, or press Reset.',
        );
        expect(mocks.showCountdown).not.toHaveBeenCalled();
        const button = container.querySelector(
            '[title="Start Countdown to DateTime"]',
        )!;
        const event = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => button.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.drag).not.toHaveBeenCalled();
        await change('Countdown Date', '2026-10-15');
        await click('Start Countdown to DateTime');
        const target = new Date('2026-10-15 10:30');
        expect(mocks.showCountdown.mock.calls.at(-1)?.[1]).toEqual(target);
        const payload = await dragTitle('Start Countdown to DateTime');
        expect(payload.getData()).toMatchObject({ dateTime: target.toJSON() });
        state.dropManager = { setCountdownData: mocks.setCountdown };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setCountdown.mock.calls.at(-1)?.[0]).toMatchObject({
            dateTime: target,
            id: 'session-a',
        });
        await clickTitle('Reset Date and Time to Now');
        expect(
            (
                container.querySelector(
                    '[aria-label="Countdown Date"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('2026-10-14');
        expect(
            (
                container.querySelector(
                    '[aria-label="Countdown Time"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('09:00');
    });

    test('start, pause, resume and reset update only this session’s duration countdowns', async () => {
        const duration = {
            id: 'session-a',
            dateTime: new Date(Date.now() + 60000),
            durationMillisecond: 60000,
            pausedMillisecond: 60000,
        };
        state.screens = [
            [1, { countdownData: duration }],
            [
                2,
                {
                    countdownData: {
                        id: 'session-a',
                        dateTime: new Date(Date.now() + 120000),
                    },
                },
            ],
            [3, { countdownData: { ...duration, id: 'session-b' } }],
        ];
        await render(<ForegroundCountDownComp />);
        await click('Start');
        expect(mocks.manager).toHaveBeenCalledExactlyOnceWith(1);
        const running = mocks.setCountdown.mock.calls.at(-1)?.[0];
        expect(running).not.toHaveProperty('pausedMillisecond');
        expect(running.dateTime.getTime()).toBe(Date.now() + 60000);
        state.screens[0][1].countdownData = running;
        await render(<ForegroundCountDownComp />);
        await act(async () => vi.advanceTimersByTimeAsync(2500));
        await click('Pause');
        const paused = mocks.setCountdown.mock.calls.at(-1)?.[0];
        expect(paused.pausedMillisecond).toBe(57500);
        state.screens[0][1].countdownData = paused;
        await render(<ForegroundCountDownComp />);
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        await click('Resume');
        const resumed = mocks.setCountdown.mock.calls.at(-1)?.[0];
        expect(resumed.dateTime.getTime()).toBe(Date.now() + 57500);
        expect(resumed).not.toHaveProperty('pausedMillisecond');
        state.screens[0][1].countdownData = resumed;
        await render(<ForegroundCountDownComp />);
        await clickTitle('Reset to the full duration');
        expect(mocks.setCountdown.mock.calls.at(-1)?.[0]).toMatchObject({
            pausedMillisecond: 60000,
            dateTime: new Date(Date.now() + 60000),
        });
        expect(mocks.manager.mock.calls.every(([id]) => id === 1)).toBe(true);
    });

    test('sessions identify and hide their own countdown and declare all owned settings', async () => {
        state.screens = [
            [1, { countdownData: { id: 'session-a', dateTime: new Date() } }],
            [2, { countdownData: { id: 'session-b', dateTime: new Date() } }],
        ];
        await render(<ForegroundCountDownComp />);
        const options = state.sessionOptions.get('countdown');
        expect(options.checkIsOnScreen('session-a', '', [])).toBe(true);
        expect(options.checkIsOnScreen('missing', '', [])).toBe(false);
        options.hideSession('session-a', '', []);
        expect(mocks.manager).toHaveBeenCalledExactlyOnceWith(1);
        expect(mocks.setCountdown).toHaveBeenCalledExactlyOnceWith(null);
        expect(options.toOwnSettingNames('-x')).toEqual([
            'foreground-date-setting-x',
            'foreground-time-setting-x',
            'foreground-hours-setting-x',
            'foreground-minutes-setting-x',
            'foreground-seconds-setting-x',
            'foreground-countdown-auto-start-setting-x',
        ]);
        expect(container.textContent).not.toContain('Pause');
    });
});

describe('stopwatch panel', () => {
    test('shows stopped by default and keeps auto-start in the session’s own setting', async () => {
        await render(<ForegroundStopwatchComp />);
        await click('Show Stopwatch');
        expect(mocks.showStopwatch).toHaveBeenLastCalledWith(
            expect.anything(),
            { dateTime: new Date(), pausedMillisecond: 0 },
            { color: 'red' },
            false,
            'session-a',
            true,
            'fade',
        );
        await act(async () =>
            (
                container.querySelector(
                    'input[type="checkbox"]',
                ) as HTMLInputElement
            ).click(),
        );
        await click('Start Stopwatch');
        expect(mocks.showStopwatch.mock.calls.at(-1)?.[1]).toEqual({
            dateTime: new Date(),
        });
        await click('Show on Screens');
        expect(mocks.showStopwatch.mock.calls.at(-1)?.[3]).toBe(true);
        const payload = await dragTitle('Start Stopwatch');
        expect(payload.getData()).toMatchObject({
            isAutoStart: true,
            isBehind: true,
            transitionEffect: 'fade',
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setStopwatch).not.toHaveBeenCalled();
        state.dropManager = { setStopwatchData: mocks.setStopwatch };
        await act(async () => vi.advanceTimersByTimeAsync(2000));
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.setStopwatch).toHaveBeenCalledWith({
            id: 'session-a',
            dateTime: new Date(),
            extraStyle: { color: 'red' },
            isBehind: true,
            transitionEffect: 'fade',
        });
    });

    test('start and pause preserve elapsed time, while reset saves it before zeroing', async () => {
        state.screens = [
            [
                1,
                {
                    stopwatchData: {
                        id: 'session-a',
                        dateTime: new Date(),
                        pausedMillisecond: 0,
                    },
                },
            ],
        ];
        await render(<ForegroundStopwatchComp />);
        await click('Start');
        let datum = mocks.setStopwatch.mock.calls.at(-1)?.[0];
        expect(datum).toEqual({ id: 'session-a', dateTime: new Date() });
        state.screens[0][1].stopwatchData = datum;
        await render(<ForegroundStopwatchComp />);
        await act(async () => vi.advanceTimersByTimeAsync(3500));
        await click('Pause');
        datum = mocks.setStopwatch.mock.calls.at(-1)?.[0];
        expect(datum.pausedMillisecond).toBe(3500);
        state.screens[0][1].stopwatchData = datum;
        await render(<ForegroundStopwatchComp />);
        await act(async () => vi.advanceTimersByTimeAsync(4000));
        await click('Resume');
        datum = mocks.setStopwatch.mock.calls.at(-1)?.[0];
        expect(datum).not.toHaveProperty('pausedMillisecond');
        expect(datum.dateTime.getTime()).toBe(Date.now() - 3500);
        state.screens[0][1].stopwatchData = datum;
        await render(<ForegroundStopwatchComp />);
        await act(async () => vi.advanceTimersByTimeAsync(2000));
        await click('Reset');
        expect(mocks.setStopwatch.mock.calls.at(-1)?.[0]).toMatchObject({
            pausedMillisecond: 0,
            dateTime: new Date(),
        });
        const historyKey = 'foreground-stopwatch-history-setting-session-a';
        expect(JSON.parse(state.settings.get(historyKey))).toEqual([
            { elapsedMillisecond: 5500, endedAt: Date.now() },
        ]);
        expect(container.textContent).toContain('00:00:05');
        mocks.confirm.mockResolvedValueOnce(false);
        await clickTitle('Clear stopwatch history');
        expect(JSON.parse(state.settings.get(historyKey))).toHaveLength(1);
        mocks.confirm.mockResolvedValueOnce(true);
        await clickTitle('Clear stopwatch history');
        expect(state.settings.get(historyKey)).toBe('');
        expect(container.querySelector('.fg-history')).toBeNull();
    });

    test('does not save a reset reading under one second or leak history across sessions', async () => {
        state.screens = [
            [
                1,
                {
                    stopwatchData: {
                        id: 'session-a',
                        dateTime: new Date(Date.now() - 500),
                    },
                },
            ],
        ];
        state.settings.set(
            'foreground-stopwatch-history-setting-session-b',
            JSON.stringify([{ elapsedMillisecond: 9000, endedAt: Date.now() }]),
        );
        await render(<ForegroundStopwatchComp />);
        await click('Reset');
        expect(
            state.settings.has(
                'foreground-stopwatch-history-setting-session-a',
            ),
        ).toBe(false);
        state.activeId = 'session-b';
        await render(<ForegroundStopwatchComp />);
        expect(container.textContent).toContain('00:00:09');
        expect(container.textContent).not.toContain('Pause');
        const options = state.sessionOptions.get('stopwatch');
        expect(options.toOwnSettingNames('-b')).toEqual([
            'foreground-stopwatch-auto-start-setting-b',
            'foreground-stopwatch-history-setting-b',
        ]);
    });

    test('refreshes independent timer panels and retains the session a change was made on', async () => {
        const countdown = {
            id: 'session-a',
            dateTime: new Date(Date.now() + 60000),
            durationMillisecond: 60000,
        };
        const stopwatch = {
            id: 'session-a',
            dateTime: new Date(Date.now() - 2000),
        };
        state.screens = [
            [1, { countdownData: countdown, stopwatchData: stopwatch }],
            [
                2,
                {
                    countdownData: { ...countdown, id: 'session-b' },
                    stopwatchData: { ...stopwatch, id: 'session-b' },
                },
            ],
        ];
        await render(
            <>
                <ForegroundCountDownComp />
                <ForegroundStopwatchComp />
            </>,
        );
        await act(async () => {
            state.propsOptions
                .get('countdown-session-a')
                .onChange({ color: 'blue' }, false);
            state.propsOptions
                .get('stopwatch-session-a')
                .onChange({ color: 'green' }, true);
        });
        state.activeId = 'session-b';
        await render(
            <>
                <ForegroundCountDownComp />
                <ForegroundStopwatchComp />
            </>,
        );
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(mocks.setCountdown.mock.calls).toEqual([
            [null],
            [{ ...countdown, extraStyle: { color: 'blue' } }],
        ]);
        expect(mocks.setStopwatch.mock.calls).toEqual([
            [null],
            [{ ...stopwatch, extraStyle: { color: 'green' }, isBehind: true }],
        ]);
        expect(mocks.manager.mock.calls).toEqual([[1], [1]]);
        const options = state.sessionOptions.get('stopwatch');
        expect(options.checkIsOnScreen('session-b', '', [])).toBe(true);
        expect(options.checkIsOnScreen('missing', '', [])).toBe(false);
        options.hideSession('session-b', '', []);
        expect(mocks.manager).toHaveBeenLastCalledWith(2);
        expect(mocks.setStopwatch).toHaveBeenLastCalledWith(null);
    });
});

describe('world-time panel', () => {
    const seedClocks = (ids = ['clock-a']) =>
        state.settings.set('foreground-time-id-list-session-a', ids);

    test('preserves fractional UTC offsets and the latest clock label when showing or dropping', async () => {
        seedClocks();
        await render(<ForegroundTimeComp />);
        await change('Label shown above the time', 'Kathmandu');
        await change('Timezone Hour Offset', '5.75');
        await click('Show Time');
        expect(mocks.showTime).toHaveBeenLastCalledWith(
            expect.anything(),
            {
                id: 'clock-a',
                timezoneMinuteOffset: 5.75,
                title: 'Kathmandu',
                is24HourFormat: false,
                extraStyle: { color: 'red' },
                isBehind: true,
                transitionEffect: 'fade',
            },
            false,
        );
        await change('Timezone Hour Offset', '');
        await click('Show on Screens');
        expect(mocks.showTime.mock.calls.at(-1)?.slice(1)).toEqual([
            expect.objectContaining({ timezoneMinuteOffset: 5.75 }),
            true,
        ]);
        const payload = await dragTitle('Show Time');
        expect(payload.getData()).toMatchObject({
            title: 'Kathmandu',
            timezoneMinuteOffset: 5.75,
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.addTime).not.toHaveBeenCalled();
        state.dropManager = { addTimeData: mocks.addTime };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.addTime).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'clock-a',
                timezoneMinuteOffset: 5.75,
            }),
        );
        await click('Use Current Timezone');
        expect(
            state.settings.get(
                'foreground-timezone-minute-offset-setting-clock-a',
            ),
        ).toBe(-new Date().getTimezoneOffset() / 60);
    });

    test('city choices are sorted and convert minute offsets to fractional hours', async () => {
        seedClocks();
        let dismiss: () => void = () => {};
        mocks.menu.mockReturnValue({
            closeMenu: mocks.closeMenu,
            promiseDone: new Promise<void>((resolve) => {
                dismiss = resolve;
            }),
        });
        await render(<ForegroundTimeComp />);
        await click('Choose City');
        const items = mocks.menu.mock.calls.at(-1)?.[1];
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Kathmandu (Asia/Kathmandu)',
            'Kolkata (Asia/Kolkata)',
            'UTC (Etc/UTC)',
        ]);
        await act(async () => items[0].onSelect());
        expect(state.settings.get('foreground-city-name-setting-clock-a')).toBe(
            'Kathmandu (Asia/Kathmandu)',
        );
        expect(
            state.settings.get(
                'foreground-timezone-minute-offset-setting-clock-a',
            ),
        ).toBe(5.75);
        await click('Choose City');
        await act(async () => dismiss());
        expect(state.settings.get('foreground-city-name-setting-clock-a')).toBe(
            'Kathmandu (Asia/Kathmandu)',
        );
    });

    test('two clocks refresh independently when their time format changes together', async () => {
        seedClocks(['clock-a', 'clock-b']);
        const times = [
            { id: 'clock-a', title: 'A', timezoneMinuteOffset: 5.5 },
            { id: 'clock-b', title: 'B', timezoneMinuteOffset: 5.75 },
        ];
        state.screens = [[3, { timeDataList: times }]];
        await render(<ForegroundTimeComp />);
        await act(async () => {
            for (const input of container.querySelectorAll<HTMLInputElement>(
                'input[type="checkbox"]',
            ))
                input.click();
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.removeTime.mock.calls).toEqual([[times[0]], [times[1]]]);
        expect(
            mocks.addTime.mock.calls.map(([data]) => [
                data.id,
                data.is24HourFormat,
            ]),
        ).toEqual([
            ['clock-a', true],
            ['clock-b', true],
        ]);
    });

    test('removing a clock hides its shown data and persists only the remaining clock ids', async () => {
        seedClocks(['clock-a', 'clock-b']);
        const time = { id: 'clock-a', timezoneMinuteOffset: 0 };
        state.screens = [[3, { timeDataList: [time] }]];
        await render(<ForegroundTimeComp />);
        await clickTitle('Remove Time 1');
        expect(mocks.removeTime).toHaveBeenCalledWith(time);
        expect(state.settings.get('foreground-time-id-list-session-a')).toEqual(
            ['clock-b'],
        );
        expect(container.querySelectorAll('[title="Show Time"]')).toHaveLength(
            1,
        );
        const newId = '00000000-0000-4000-8000-000000000001';
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(newId);
        await click('Add Time');
        expect(state.settings.get('foreground-time-id-list-session-a')).toEqual(
            ['clock-b', newId],
        );
        expect(container.querySelectorAll('[title="Show Time"]')).toHaveLength(
            2,
        );
    });

    test('a new session creates one clock; its callbacks own only that session’s clocks', async () => {
        const newId = '00000000-0000-4000-8000-000000000001';
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(newId);
        await render(<ForegroundTimeComp />);
        expect(state.settings.get('foreground-time-id-list-session-a')).toEqual(
            [newId],
        );
        state.screens = [
            [3, { timeDataList: [{ id: newId }, { id: 'other' }] }],
        ];
        await render(<ForegroundTimeComp />);
        const options = state.sessionOptions.get('time');
        expect(options.checkIsOnScreen('', '-session-a')).toBe(true);
        expect(options.checkIsOnScreen('', '-missing')).toBe(false);
        expect(options.toOwnSettingNames('-session-a')).toEqual([
            'foreground-time-id-list-session-a',
            `foreground-city-name-setting-${newId}`,
            `foreground-timezone-minute-offset-setting-${newId}`,
            `foreground-time-is-24-hour-format-setting-${newId}`,
            `properties-time-${newId}`,
        ]);
        options.hideSession('', '-session-a');
        expect(mocks.removeTime).toHaveBeenCalledExactlyOnceWith({ id: newId });
    });

    test('property refresh retains the clock data while changing its style and hiding stays clock-specific', async () => {
        seedClocks();
        const time = { id: 'clock-a', title: 'A', timezoneMinuteOffset: 7 };
        state.screens = [[3, { timeDataList: [time] }]];
        await render(<ForegroundTimeComp />);
        await act(async () => {
            state.propsOptions
                .get('time-clock-a')
                .onChange({ color: 'blue' }, false);
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.removeTime).toHaveBeenCalledWith(time);
        expect(mocks.addTime).toHaveBeenCalledWith({
            ...time,
            extraStyle: { color: 'blue' },
        });
        await click('Hide Time');
        expect(mocks.removeTime).toHaveBeenCalledTimes(2);
    });
});

describe('message panel', () => {
    const seedMessages = (text = 'First\n\nSecond') =>
        state.settings.set('foreground-message-setting-session-a', text);

    test('new message editors keep independent ids and text', async () => {
        await render(<ForegroundMessageComp />);
        expect(container.textContent).toContain('No message yet');
        await click('Add Message');
        expect(
            (
                container.querySelector(
                    '[title="Type in the empty message first"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        await change('Message 1', 'First');
        await click('Add Message');
        await change('Message 2', 'Second');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('First');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 2"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('Second');
        expect(state.settings.get('foreground-message-setting-session-a')).toBe(
            'First\n\nSecond',
        );
    });

    test('keeps trailing whitespace while editing and reorders or removes only the chosen editor', async () => {
        seedMessages();
        await render(<ForegroundMessageComp />);
        await change('Message 1', 'First \n');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('First \n');
        await clickTitle('Move down 1');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('Second');
        await clickTitle('Move up 2');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('First \n');
        await clickTitle('Remove Message 1');
        expect(container.querySelectorAll('textarea')).toHaveLength(1);
        expect(state.settings.get('foreground-message-setting-session-a')).toBe(
            'Second',
        );
        await click('Add Message');
        await change('Message 2', 'Replacement');
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('Second');
    });

    test('saved text reseeds editors only after confirmation and switching sessions reads their own text', async () => {
        seedMessages('Unsaved');
        state.settings.set(
            'foreground-message-saved-sessions',
            JSON.stringify([{ id: 'saved', text: 'Picked\n\nTwo' }]),
        );
        state.settings.set(
            'foreground-message-setting-session-b',
            'Other session',
        );
        await render(<ForegroundMessageComp />);
        await click('Saved (1)');
        const item = mocks.menu.mock.calls.at(-1)?.[1][0];
        mocks.confirm.mockResolvedValueOnce(false);
        await act(async () => item.onSelect());
        expect(container.querySelectorAll('textarea')).toHaveLength(1);
        mocks.confirm.mockResolvedValueOnce(true);
        await act(async () => item.onSelect());
        expect(container.querySelectorAll('textarea')).toHaveLength(2);
        expect(
            (
                container.querySelector(
                    '[aria-label="Message 1"]',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('Picked');
        state.activeId = 'session-b';
        await render(<ForegroundMessageComp />);
        expect(
            (container.querySelector('textarea') as HTMLTextAreaElement).value,
        ).toBe('Other session');
    });

    test('shows the selected editor alongside another session and hides it without changing the other datum', async () => {
        seedMessages('First\nline\n\nSecond');
        const other = {
            id: 'message-0-session-b',
            textList: ['Other'],
            extraStyle: { color: 'green' },
        };
        state.screens = [[1, { messageDataList: [other] }]];
        await render(<ForegroundMessageComp />);
        await clickTitle('Show Message 1');
        expect(mocks.showMessageSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Function),
            false,
        );
        const manager = {
            foregroundData: state.screens[0][1],
            setMessageDataList: mocks.setMessages,
        };
        mocks.showMessageSet.mock.calls.at(-1)?.[1](manager);
        expect(mocks.setMessages).toHaveBeenLastCalledWith([
            other,
            expect.objectContaining({
                id: 'message-0-session-a',
                textList: ['First', 'line'],
                intervalSecond: null,
                extraStyle: { color: 'red' },
                isBehind: true,
                transitionEffect: 'fade',
            }),
        ]);
        state.screens[0][1].messageDataList =
            mocks.setMessages.mock.calls.at(-1)?.[0];
        await render(<ForegroundMessageComp />);
        await clickTitle('Hide Message 1');
        expect(mocks.setMessages).toHaveBeenLastCalledWith([other]);
        await clickTitle('Remove Message 1');
        expect(mocks.removeMessage).toHaveBeenCalledWith('message-0-session-a');
    });

    test('show-all rotation, its drag payload and screen-specific hide preserve the session id', async () => {
        seedMessages();
        await render(<ForegroundMessageComp />);
        await act(async () =>
            (
                container.querySelector(
                    '[aria-label="Show each message in turn"]',
                ) as HTMLInputElement
            ).click(),
        );
        await change('Seconds each message stays before the next', '12');
        await click('Show All Messages');
        const datum = {
            id: 'message-all-session-a',
            textList: ['First', 'Second'],
            intervalSecond: 12,
            extraStyle: { color: 'red' },
            isBehind: true,
            transitionEffect: 'fade',
        };
        expect(mocks.showMessages).toHaveBeenCalledWith(
            expect.anything(),
            datum,
        );
        await click('Show on Screens');
        expect(mocks.showMessages).toHaveBeenCalledTimes(2);
        const payload = await dragTitle('Show All Messages');
        expect(payload.getData()).toMatchObject({
            textList: ['First', 'Second'],
            intervalSecond: 12,
            isBehind: true,
        });
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.addMessage).not.toHaveBeenCalled();
        state.dropManager = { addMessageData: mocks.addMessage };
        await act(async () => state.dragStore.onDropped({}));
        expect(mocks.addMessage).toHaveBeenCalledWith(datum);
        state.screens = [[1, { messageDataList: [datum] }]];
        await render(<ForegroundMessageComp />);
        await click('Hide Messages');
        expect(mocks.removeMessage).toHaveBeenCalledWith(
            'message-all-session-a',
        );
    });

    test('the messages shortcut refuses empty selection, targets ticked screens and takes shown messages down', async () => {
        await render(<ForegroundMessageComp />);
        await act(async () => state.keyboardCallback?.());
        expect(mocks.addMessage).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        seedMessages('Notice');
        state.activeId = 'session-b';
        await render(<ForegroundMessageComp />);
        state.activeId = 'session-a';
        await render(<ForegroundMessageComp />);
        await act(async () => state.keyboardCallback?.());
        expect(mocks.toast).toHaveBeenCalledWith(
            'Tick a screen first, then press the key again',
            'Messages',
        );
        state.selectedScreenIds = [1, 2];
        await act(async () => state.keyboardCallback?.());
        expect(mocks.manager.mock.calls).toEqual([[1], [2]]);
        expect(mocks.addMessage).toHaveBeenCalledTimes(2);
        expect(mocks.addMessage.mock.calls[0][0]).toMatchObject({
            textList: ['Notice'],
            intervalSecond: null,
        });
        const shown = { id: 'message-0-session-b', textList: ['Other'] };
        state.screens = [[3, { messageDataList: [shown] }]];
        await render(<ForegroundMessageComp />);
        await act(async () => state.keyboardCallback?.());
        expect(mocks.manager).toHaveBeenLastCalledWith(3);
        expect(mocks.removeMessage).toHaveBeenCalledWith(shown.id);
    });

    test('property refresh preserves other sessions, stacked order and an existing rotating item', async () => {
        seedMessages('First\nline\n\nSecond');
        const other = { id: 'message-0-session-b', textList: ['Other'] };
        const own = [
            { id: 'message-0-session-a', textList: ['First', 'line'] },
            { id: 'message-1-session-a', textList: ['Second'] },
        ];
        const all = {
            id: 'message-all-session-a',
            textList: ['First\nline', 'Second'],
            intervalSecond: 8,
        };
        state.screens = [[1, { messageDataList: [other, ...own, all] }]];
        await render(<ForegroundMessageComp />);
        await act(async () => {
            state.propsOptions
                .get('message-session-a')
                .onChange({ color: 'blue' }, true);
            await vi.advanceTimersByTimeAsync(500);
        });
        const list = mocks.setMessages.mock.calls.at(-1)?.[0];
        expect(list[0]).toBe(other);
        expect(list[1]).toMatchObject({
            id: own[0].id,
            extraStyle: { color: 'blue' },
        });
        expect(list[2].extraStyle.marginTop).toBeDefined();
        expect(list[3]).toEqual({
            ...all,
            extraStyle: { color: 'blue' },
            isBehind: true,
        });
        const options = state.sessionOptions.get('message');
        expect(options.checkIsOnScreen('session-a', '', [])).toBe(true);
        expect(options.checkIsOnScreen('missing', '', [])).toBe(false);
        expect(options.toOwnSettingNames('-x')).toEqual([
            'foreground-message-setting-x',
            'foreground-message-is-rotating-x',
            'foreground-message-interval-x',
        ]);
        options.hideSession('session-a', '', []);
        expect(mocks.removeMessage.mock.calls.map(([id]) => id)).toEqual([
            ...own.map((data) => data.id),
            all.id,
        ]);
    });
});
