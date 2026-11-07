// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// What `BackgroundComp.test.tsx` leaves out on purpose: the tab bodies are
// LAZY, and the Audios split draws the open tab beside the audio list. Here
// `genTabBody` and the split are drawn the way the real ones draw them, and
// each panel module is a stub that names itself.
const h = vi.hoisted(() => ({
    genBackgroundTabTransitionMenuItems: vi.fn(),
    showAppContextMenu: vi.fn(),
    resizeProps: null as any,
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
        default: ({ tabs, setActiveTab }: any) =>
            react.createElement(
                'nav',
                null,
                tabs.map((tab: any) =>
                    react.createElement(
                        'button',
                        {
                            key: tab.key,
                            'data-tab': tab.key,
                            onClick: () => setActiveTab(tab.key),
                            onContextMenu: (event: unknown) =>
                                tab.onContextMenu(tab.key, event),
                        },
                        tab.title,
                    ),
                ),
            ),
        // As the real one: a suspense boundary per tab, its body only while
        // selected.
        genTabBody: (selected: string, [key, PanelComp]: [string, any]) =>
            react.createElement(
                react.Suspense,
                { key: `tab-${key}`, fallback: null },
                selected === key ? react.createElement(PanelComp) : null,
            ),
    };
});
vi.mock('../resize-actor/ResizeActorComp', async () => {
    const react = await import('react');
    return {
        default: (props: any) => {
            h.resizeProps = props;
            return react.createElement(
                'div',
                { 'data-split': props.flexSizeName },
                props.dataInput.map((item: any) =>
                    react.createElement(
                        'div',
                        { key: item.key, 'data-pane': item.key },
                        'render' in item.children
                            ? item.children.render()
                            : react.createElement(
                                  react.Suspense,
                                  { fallback: null },
                                  react.createElement(item.children),
                              ),
                    ),
                ),
            );
        },
    };
});
for (const [path, name] of [
    ['./BackgroundColorsComp', 'colors'],
    ['./BackgroundImagesComp', 'images'],
    ['./BackgroundVideosComp', 'videos'],
    ['./BackgroundCamerasComp', 'cameras'],
    ['./BackgroundWebComp', 'webs'],
    ['./BackgroundAudiosComp', 'audios'],
]) {
    vi.doMock(path, async () => {
        const react = await import('react');
        return {
            default: () =>
                react.createElement('div', { 'data-panel': name }, name),
        };
    });
}
vi.mock('../others/labelIconHelpers', () => ({
    genLabelIcon: () => null,
    toWidgetLabel: (label: string) => ({ widgetName: label }),
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: () => {},
}));
vi.mock('../_screen/screenHelpers', () => ({
    getBackgroundSrcListOnScreenSetting: () => ({}),
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
    checkAudioPlaying: () => false,
    checkBackgroundAudioPlaying: () => false,
    showAudioPlayingToast: () => {},
}));
vi.mock('./backgroundTransitionMenuHelpers', async () => {
    const react = await import('react');
    return {
        BackgroundTransitionBadgeComp: () => react.createElement('i'),
        genBackgroundTabTransitionMenuItems: (type: string) =>
            h.genBackgroundTabTransitionMenuItems(type),
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: unknown, items: unknown) =>
        h.showAppContextMenu(event, items),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BackgroundComp from './BackgroundComp';

let container: HTMLDivElement;
let root: Root;

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function panels() {
    return [...container.querySelectorAll('[data-panel]')].map((element) =>
        element.getAttribute('data-panel'),
    );
}

// A lazy panel arrives through a dynamic import, which can take more than one
// turn of the event loop the first time: wait for it, by the real clock --
// generously, since the whole-surface coverage run shares a loaded CPU.
async function waitForPanel(selector: string) {
    const deadline = Date.now() + 8000;
    while (container.querySelector(selector) === null) {
        if (Date.now() > deadline) {
            throw new Error(`No ${selector} in time`);
        }
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
}

async function click(element: Element) {
    await act(async () => (element as HTMLElement).click());
    await flush();
}

beforeEach(async () => {
    h.resizeProps = null;
    h.genBackgroundTabTransitionMenuItems.mockReturnValue([]);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(BackgroundComp)));
    await flush();
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Background panel bodies', () => {
    it('loads each tab’s own panel when it is opened, one at a time', async () => {
        await waitForPanel('[data-panel="images"]');
        expect(panels()).toEqual(['images']);
        for (const [tab, panel] of [
            ['color', 'colors'],
            ['video', 'videos'],
            ['camera', 'cameras'],
            ['web', 'webs'],
            ['image', 'images'],
        ]) {
            await click(container.querySelector(`[data-tab="${tab}"]`)!);
            await waitForPanel(`[data-panel="${panel}"]`);
            expect(panels()).toEqual([panel]);
        }
    });

    it('the Audios split keeps the open tab beside the audio list', async () => {
        await click(container.querySelector('[data-tab="video"]')!);
        await waitForPanel('[data-panel="videos"]');
        const audiosTab = [...container.querySelectorAll('button')].find(
            (button) => button.textContent === 'Audios',
        )!;
        await click(audiosTab);
        await waitForPanel('[data-pane="h2"] [data-panel="audios"]');
        expect(h.resizeProps).toMatchObject({
            flexSizeName: 'flex-size-background',
            isHorizontal: true,
            isDisableQuickResize: true,
            flexSizeDefault: { h1: ['1'], h2: ['1'] },
        });
        expect(
            h.resizeProps.dataInput.map((item: any) => [
                item.key,
                item.widgetName,
            ]),
        ).toEqual([
            ['h1', 'Background'],
            ['h2', 'Background Audio'],
        ]);
        expect(
            container
                .querySelector('[data-pane="h1"] [data-panel]')
                ?.getAttribute('data-panel'),
        ).toBe('videos');
        expect(
            container
                .querySelector('[data-pane="h2"] [data-panel]')
                ?.getAttribute('data-panel'),
        ).toBe('audios');

        // Closing the split puts the tab back on its own.
        await click(audiosTab);
        expect(container.querySelector('[data-split]')).toBeNull();
        await waitForPanel('[data-panel="videos"]');
        expect(panels()).toEqual(['videos']);
    });

    it('a tab with no transition to offer opens no menu on right-click', async () => {
        const imageTab = container.querySelector('[data-tab="image"]')!;
        await act(async () => {
            imageTab.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(h.genBackgroundTabTransitionMenuItems).toHaveBeenCalledWith(
            'image',
        );
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });
});
