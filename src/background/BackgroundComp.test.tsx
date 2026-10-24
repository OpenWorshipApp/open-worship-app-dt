// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    checkAudioPlaying: vi.fn(),
    checkBackgroundAudioPlaying: vi.fn(),
    showAudioPlayingToast: vi.fn(),
    getBackgroundSrcListOnScreenSetting: vi.fn(),
    genBackgroundTabTransitionMenuItems: vi.fn(),
    showAppContextMenu: vi.fn(),
    listeners: new Map<string, () => void>(),
    resizeChecks: [] as Array<() => void>,
}));

vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingBoolean: (_key: string, initial: boolean) =>
            react.useState(initial),
        useStateSettingString: (_key: string, initial: string) =>
            react.useState(initial),
    };
});
vi.mock('../others/TabRenderComp', async () => {
    const react = await import('react');
    return {
        default: ({
            tabs,
            activeTabs,
            setActiveTab,
        }: {
            tabs: Array<{
                key: string;
                title: React.ReactNode;
                checkIsOnScreen: (key: string) => boolean;
                onContextMenu: (key: string, event: unknown) => void;
            }>;
            activeTabs: string[];
            setActiveTab: (key: string) => void;
        }) =>
            react.createElement(
                'nav',
                null,
                tabs.map((tab) =>
                    react.createElement(
                        'button',
                        {
                            key: tab.key,
                            'data-tab': tab.key,
                            'data-on-screen': tab.checkIsOnScreen(tab.key),
                            'aria-pressed': activeTabs.includes(tab.key),
                            onClick: () => setActiveTab(tab.key),
                            onContextMenu: (event: unknown) =>
                                tab.onContextMenu(tab.key, event),
                        },
                        tab.title,
                    ),
                ),
            ),
        genTabBody: (active: string, [key]: [string, unknown]) =>
            active === key
                ? react.createElement(
                      'div',
                      { key, 'data-body': key },
                      `${key} body`,
                  )
                : null,
    };
});
vi.mock('../resize-actor/ResizeActorComp', async () => {
    const react = await import('react');
    return {
        default: () =>
            react.createElement(
                'div',
                { 'data-audio-pane': true },
                'Audio pane',
            ),
    };
});
vi.mock('../others/labelIconHelpers', () => ({
    genLabelIcon: () => null,
    toWidgetLabel: (label: string) => ({ title: label }),
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: () => {},
}));
vi.mock('../_screen/screenHelpers', () => ({
    getBackgroundSrcListOnScreenSetting: h.getBackgroundSrcListOnScreenSetting,
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/mediaControlHelpers', () => ({
    AUDIO_PLAYING_CHANGE_EVENT: 'audio-playing-change',
    checkAudioPlaying: h.checkAudioPlaying,
    checkBackgroundAudioPlaying: h.checkBackgroundAudioPlaying,
    showAudioPlayingToast: h.showAudioPlayingToast,
}));
vi.mock('../event/EventHandler', () => ({
    default: {
        registerEventListener: (names: string[], callback: () => void) => {
            for (const name of names) h.listeners.set(name, callback);
            return names;
        },
        unregisterEventListener: (names: string[]) => {
            for (const name of names) h.listeners.delete(name);
        },
    },
}));
vi.mock('./backgroundAudioTabHelpers', () => ({
    OPEN_BACKGROUND_AUDIO_TAB_EVENT: 'open-background-audio-tab',
}));
vi.mock('./backgroundTransitionMenuHelpers', async () => {
    const react = await import('react');
    return {
        BackgroundTransitionBadgeComp: () =>
            react.createElement('i', { 'data-transition': true }),
        genBackgroundTabTransitionMenuItems:
            h.genBackgroundTabTransitionMenuItems,
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BackgroundComp from './BackgroundComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
    vi.clearAllMocks();
    h.listeners.clear();
    h.resizeChecks.length = 0;
    h.checkAudioPlaying.mockReturnValue(false);
    h.checkBackgroundAudioPlaying.mockReturnValue(false);
    h.getBackgroundSrcListOnScreenSetting.mockReturnValue({});
    h.genBackgroundTabTransitionMenuItems.mockReturnValue([
        { menuElement: 'Transition' },
    ]);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            constructor(check: () => void) {
                h.resizeChecks.push(check);
            }
            observe() {}
            disconnect() {}
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(BackgroundComp)));
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

function click(selector: string) {
    const button = container.querySelector<HTMLButtonElement>(selector)!;
    act(() => button.click());
}

describe('Background panel', () => {
    it('shows translated tabs and switches the visible background body', () => {
        expect(
            Array.from(container.querySelectorAll('[data-tab]')).map(
                (element) => element.textContent,
            ),
        ).toEqual(['Colors', 'Images', 'Videos', 'Cameras', 'Webs']);
        expect(container.querySelector('[data-body="image"]')).not.toBeNull();
        click('[data-tab="video"]');
        expect(container.querySelector('[data-body="video"]')).not.toBeNull();
        expect(
            container
                .querySelector('[data-tab="video"]')
                ?.getAttribute('aria-pressed'),
        ).toBe('true');
    });

    it('marks a type that is showing and opens its transition menu', () => {
        h.getBackgroundSrcListOnScreenSetting.mockReturnValue({
            '1': { type: 'image', src: 'picture.png' },
        });
        click('[data-tab="color"]');
        expect(
            container
                .querySelector('[data-tab="image"]')
                ?.getAttribute('data-on-screen'),
        ).toBe('true');
        const imageTab =
            container.querySelector<HTMLButtonElement>('[data-tab="image"]')!;
        act(() =>
            imageTab.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(h.genBackgroundTabTransitionMenuItems).toHaveBeenCalledWith(
            'image',
        );
        expect(h.showAppContextMenu).toHaveBeenCalledWith(expect.anything(), [
            { menuElement: 'Transition' },
        ]);
    });

    it('refuses to close the audio pane while audio is playing', () => {
        const audioTab = Array.from(container.querySelectorAll('button')).find(
            (button) => button.textContent === 'Audios',
        )!;
        act(() => audioTab.click());
        expect(container.querySelector('[data-audio-pane]')).not.toBeNull();
        h.checkAudioPlaying.mockReturnValue(true);
        act(() => audioTab.click());
        expect(h.showAudioPlayingToast).toHaveBeenCalledOnce();
        expect(container.querySelector('[data-audio-pane]')).not.toBeNull();
        h.checkAudioPlaying.mockReturnValue(false);
        act(() => audioTab.click());
        expect(container.querySelector('[data-audio-pane]')).toBeNull();
    });

    it('opens audio on request and marks its tab from the current DOM state', () => {
        act(() => h.listeners.get('open-background-audio-tab')?.());
        expect(container.querySelector('[data-audio-pane]')).not.toBeNull();
        h.checkBackgroundAudioPlaying.mockReturnValue(true);
        act(() => h.listeners.get('audio-playing-change')?.());
        const audioTab = Array.from(container.querySelectorAll('button')).find(
            (button) => button.textContent === 'Audios',
        )!;
        expect(audioTab.className).toContain('app-on-screen');
    });

    it('folds tab words when they overflow the header', () => {
        const header = container.querySelector<HTMLElement>(
            '.background .header',
        )!;
        const tabs = header.firstElementChild as HTMLElement;
        Object.defineProperty(header, 'clientWidth', {
            configurable: true,
            value: 200,
        });
        Object.defineProperty(tabs, 'scrollWidth', {
            configurable: true,
            value: 300,
        });
        Object.defineProperty(tabs, 'clientWidth', {
            configurable: true,
            value: 200,
        });
        act(() => h.resizeChecks[0]());
        expect(header.className).toContain('is-compact');
        Object.defineProperty(header, 'clientWidth', {
            configurable: true,
            value: 1000,
        });
        Object.defineProperty(tabs, 'clientWidth', {
            configurable: true,
            value: 1000,
        });
        act(() => h.resizeChecks[0]());
        expect(
            container.querySelector('.background .header')?.className,
        ).not.toContain('is-compact');
    });
});
