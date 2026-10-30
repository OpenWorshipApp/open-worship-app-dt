// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        settingValues: new Map<string, string>(),
        settingNames: [] as string[],
        menuCalls: [] as { event: any; items: any[] }[],
        videoSources: [] as [string, string][],
        showSimpleToast: vi.fn(),
        checkMediaPlaying: vi.fn(),
        screenManager: null as any,
        screenManagerBase: null as any,
    };
});

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (name: string, initial: string) => {
            h.settingNames.push(name);
            return useState(h.settingValues.get(name) ?? initial);
        },
    };
});
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => h.screenManager,
    useScreenManagerBaseContext: () => h.screenManagerBase,
    useScreenVideoSources: () => h.videoSources,
}));
vi.mock('./DisplayControlComp', () => ({
    default: () => <span data-stub="display" />,
}));
vi.mock('./ScreenEffectControlComp', () => ({
    default: () => <span data-stub="effect" />,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: any, items: any[]) => {
        h.menuCalls.push({ event, items });
    },
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: any }) => (
            <Suspense fallback={<span data-stub="loading" />}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../helper/mediaControlHelpers', () => ({
    checkMediaPlaying: h.checkMediaPlaying,
}));
vi.mock('../screenHelpers', () => ({
    getStageAccentColor: (stage: number) => {
        return ['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(3, 3, 3)'][stage % 3];
    },
    STAGE_NUMBER_CHOICE_COUNT: 6,
}));
vi.mock('./MiniScreenAudioHandlersComp', () => ({
    default: ({ src, videoId }: { src: string; videoId: string }) => (
        <div data-stub="audio" data-src={src} data-video-id={videoId} />
    ),
}));
vi.mock('./MiniScreenDrawHandlersComp', () => ({
    default: () => <div data-stub="draw-panel" />,
}));
vi.mock('./MiniScreenFocusHandlersComp', () => ({
    default: () => <div data-stub="focus-panel" />,
}));

import ScreenPreviewerFooterComp from './ScreenPreviewerFooterComp';

let container: HTMLDivElement;
let root: Root;

function createManagers({
    stage = 0,
    effectType = 'fade',
    hasEffectManager = true,
    isDrawEnabled = false,
    isPanelOpen = false,
} = {}) {
    const effectManager = hasEffectManager ? { effectType } : undefined;
    const screenManagerBase = {
        _stage: stage,
        get stage() {
            return this._stage;
        },
        set stage(value: number) {
            this._stage = value;
            // What the real setter does: a stage above 0 cuts.
            if (value > 0 && effectManager !== undefined) {
                effectManager.effectType = 'none';
            }
        },
    };
    const screenManager = {
        screenId: 4,
        varyAppDocumentEffectManager: effectManager,
        screenDrawManager: {
            isDrawEnabled,
            enableDraw: vi.fn(),
            disableDraw: vi.fn(),
        },
        screenFocusManager: {
            isPanelOpen,
            setIsPanelOpen: vi.fn(),
        },
    };
    h.screenManager = screenManager;
    h.screenManagerBase = screenManagerBase;
    return { screenManager, screenManagerBase, effectManager };
}

async function renderFooter() {
    await act(async () => {
        root.render(<ScreenPreviewerFooterComp />);
    });
    // Let a lazy panel resolve.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function getByLabel(label: string) {
    const element = container.querySelector<HTMLElement>(
        `[aria-label="${label}"]`,
    );
    if (element === null) {
        throw new Error(`Missing control: ${label}`);
    }
    return element;
}

async function click(element: HTMLElement) {
    await act(async () => {
        element.click();
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settingValues.clear();
    h.settingNames.length = 0;
    h.menuCalls.length = 0;
    h.videoSources = [];
    h.checkMediaPlaying.mockReturnValue(false);
    createManagers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ScreenPreviewerFooterComp stage number', () => {
    test('offers every stage, decrement and increment, current one disabled', async () => {
        createManagers({ stage: 2 });
        await renderFooter();
        const stageButton = getByLabel('Stage 2: Click to change Stage Number');
        expect(stageButton.textContent).toContain('2');
        expect(stageButton.style.color).toBe('rgb(3, 3, 3)');

        await click(stageButton);
        const { items } = h.menuCalls.at(-1)!;
        expect(
            items.map((item: any) => {
                return item.menuElement;
            }),
        ).toEqual(['0', '1', '2', '3', '4', '5', 'Decrement', 'Increment']);
        expect(
            items
                .filter((item: any) => {
                    return item.disabled;
                })
                .map((item: any) => {
                    return item.menuElement;
                }),
        ).toEqual(['2']);
        expect(items[0].childBefore).toBe('icon:0-circle');
    });

    test('picking a stage writes it to the screen and relabels the chip', async () => {
        const { screenManagerBase } = createManagers({
            stage: 0,
            effectType: 'none',
        });
        await renderFooter();
        await click(getByLabel('Stage 0: Click to change Stage Number'));

        await act(async () => {
            h.menuCalls.at(-1)!.items[3].onSelect();
        });
        expect(screenManagerBase.stage).toBe(3);
        expect(
            getByLabel('Stage 3: Click to change Stage Number').textContent,
        ).toContain('3');
        // The transition was already None: nothing to explain.
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('says so when a stage above 0 turned the slide transition off', async () => {
        const { effectManager } = createManagers({
            stage: 0,
            effectType: 'fade',
        });
        await renderFooter();
        await click(getByLabel('Stage 0: Click to change Stage Number'));
        const increment = h.menuCalls
            .at(-1)!
            .items.find((item: any) => item.menuElement === 'Increment');
        await act(async () => {
            increment.onSelect();
        });
        expect(effectManager!.effectType).toBe('none');
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Slide transition',
            'A stage above 0 cuts between slides, so the Slide transition was set to None.',
        );
    });

    test('decrement never goes below 0 and is disabled at 0', async () => {
        const { screenManagerBase } = createManagers({ stage: 1 });
        await renderFooter();
        await click(getByLabel('Stage 1: Click to change Stage Number'));
        const decrement = h.menuCalls
            .at(-1)!
            .items.find((item: any) => item.menuElement === 'Decrement');
        expect(decrement.disabled).toBe(false);
        await act(async () => {
            decrement.onSelect();
        });
        expect(screenManagerBase.stage).toBe(0);

        await click(getByLabel('Stage 0: Click to change Stage Number'));
        const decrementAtZero = h.menuCalls
            .at(-1)!
            .items.find((item: any) => item.menuElement === 'Decrement');
        expect(decrementAtZero.disabled).toBe(true);
        await act(async () => {
            decrementAtZero.onSelect();
        });
        expect(screenManagerBase.stage).toBe(0);
    });

    test('a screen with no effect manager changes stage without a toast', async () => {
        const { screenManagerBase } = createManagers({
            stage: 0,
            hasEffectManager: false,
        });
        await renderFooter();
        await click(getByLabel('Stage 0: Click to change Stage Number'));
        await act(async () => {
            h.menuCalls.at(-1)!.items[1].onSelect();
        });
        expect(screenManagerBase.stage).toBe(1);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('Enter on the chip opens the same menu', async () => {
        await renderFooter();
        const stageButton = getByLabel('Stage 0: Click to change Stage Number');
        await act(async () => {
            stageButton.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.menuCalls).toHaveLength(1);
    });
});

describe('ScreenPreviewerFooterComp drawing switch', () => {
    test('reads the persisted mode for THIS screen and seeds from the draw manager', async () => {
        createManagers({ isDrawEnabled: true });
        await renderFooter();
        expect(h.settingNames).toContain('screen-draw-mode-4');
        const toggle = getByLabel('Disable Drawing');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('[data-stub="draw-panel"]')).not.toBe(
            null,
        );
    });

    test('a persisted focus mode seeds from the focus manager instead', async () => {
        h.settingValues.set('screen-draw-mode-4', 'focus');
        createManagers({ isDrawEnabled: true, isPanelOpen: false });
        await renderFooter();
        expect(getByLabel('Enable Focusing').getAttribute('aria-pressed')).toBe(
            'false',
        );
        expect(container.querySelector('[data-stub="focus-panel"]')).toBe(null);
    });

    test('an unknown persisted mode falls back to Drawing', async () => {
        h.settingValues.set('screen-draw-mode-4', 'bogus');
        await renderFooter();
        expect(getByLabel('Enable Drawing')).not.toBe(null);
        expect(container.querySelector('.bi-brush')).not.toBe(null);
    });

    test('drawing turns on through the draw manager and off through both', async () => {
        const { screenManager } = createManagers();
        await renderFooter();

        await click(getByLabel('Enable Drawing'));
        expect(
            screenManager.screenDrawManager.enableDraw,
        ).toHaveBeenCalledTimes(1);
        expect(container.querySelector('[data-stub="draw-panel"]')).not.toBe(
            null,
        );

        await click(getByLabel('Disable Drawing'));
        expect(
            screenManager.screenDrawManager.disableDraw,
        ).toHaveBeenCalledTimes(1);
        // Off is off whichever panel is showing.
        expect(
            screenManager.screenFocusManager.setIsPanelOpen,
        ).toHaveBeenCalledWith(false);
        expect(container.querySelector('[data-stub="draw-panel"]')).toBe(null);
    });

    test('focus mode turns on through the focus manager only', async () => {
        h.settingValues.set('screen-draw-mode-4', 'focus');
        const { screenManager } = createManagers();
        await renderFooter();

        await click(getByLabel('Enable Focusing'));
        expect(
            screenManager.screenFocusManager.setIsPanelOpen,
        ).toHaveBeenCalledWith(true);
        expect(
            screenManager.screenDrawManager.enableDraw,
        ).not.toHaveBeenCalled();
        expect(container.querySelector('[data-stub="focus-panel"]')).not.toBe(
            null,
        );
    });

    test('switching mode keeps the on/off state and moves where it is kept', async () => {
        const { screenManager } = createManagers();
        await renderFooter();
        await click(getByLabel('Enable Drawing'));

        await click(getByLabel('Choose Drawing or Focusing'));
        const { items } = h.menuCalls.at(-1)!;
        expect(
            items.map((item: any) => {
                return [item.menuElement, item.disabled, item.childBefore];
            }),
        ).toEqual([
            ['Drawing', true, 'icon:brush'],
            ['Focusing', false, 'icon:record-circle'],
        ]);

        await act(async () => {
            items[1].onSelect();
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        // Still on, now as Focusing, and persisted in the focus manager.
        expect(
            screenManager.screenFocusManager.setIsPanelOpen,
        ).toHaveBeenLastCalledWith(true);
        expect(getByLabel('Disable Focusing')).not.toBe(null);
        expect(container.querySelector('[data-stub="focus-panel"]')).not.toBe(
            null,
        );

        // Back to Drawing while on: re-armed in the draw manager.
        await click(getByLabel('Choose Drawing or Focusing'));
        await act(async () => {
            h.menuCalls.at(-1)!.items[0].onSelect();
        });
        expect(
            screenManager.screenDrawManager.enableDraw,
        ).toHaveBeenCalledTimes(2);
    });

    test('switching mode while off keeps it off', async () => {
        const { screenManager } = createManagers();
        await renderFooter();
        const group = container.querySelector<HTMLElement>('.btn-group')!;
        await act(async () => {
            group.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await act(async () => {
            h.menuCalls.at(-1)!.items[1].onSelect();
        });
        expect(
            screenManager.screenFocusManager.setIsPanelOpen,
        ).toHaveBeenLastCalledWith(false);
        expect(getByLabel('Enable Focusing')).not.toBe(null);

        // And back to Drawing, still off: the draw manager is told so.
        await click(getByLabel('Choose Drawing or Focusing'));
        await act(async () => {
            h.menuCalls.at(-1)!.items[0].onSelect();
        });
        expect(
            screenManager.screenDrawManager.disableDraw,
        ).toHaveBeenCalledTimes(1);
        expect(
            screenManager.screenDrawManager.enableDraw,
        ).not.toHaveBeenCalled();
        expect(getByLabel('Enable Drawing')).not.toBe(null);
    });
});

describe('ScreenPreviewerFooterComp background audio', () => {
    test('no background video, no audio switch', async () => {
        await renderFooter();
        expect(
            container.querySelector(
                '[aria-label="Enable Background Audio Handlers"]',
            ),
        ).toBe(null);
    });

    test('shows one audio handler per background video once enabled', async () => {
        h.videoSources = [
            ['/videos/a.mp4', 'video-a'],
            ['/videos/b.mp4', 'video-b'],
        ];
        await renderFooter();
        const toggle = getByLabel('Enable Background Audio Handlers');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelectorAll('[data-stub="audio"]')).toHaveLength(
            0,
        );

        await click(toggle);
        const handlers = container.querySelectorAll<HTMLElement>(
            '[data-stub="audio"]',
        );
        expect(
            [...handlers].map((handler) => {
                return [handler.dataset.src, handler.dataset.videoId];
            }),
        ).toEqual([
            ['/videos/a.mp4', 'video-a'],
            ['/videos/b.mp4', 'video-b'],
        ]);
        expect(
            getByLabel('Enable Background Audio Handlers').getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
    });

    test('refuses to hide the handlers while a background audio plays', async () => {
        h.videoSources = [['/videos/a.mp4', 'video-a']];
        await renderFooter();
        await click(getByLabel('Enable Background Audio Handlers'));

        h.checkMediaPlaying.mockReturnValue(true);
        await click(getByLabel('Enable Background Audio Handlers'));
        expect(h.checkMediaPlaying).toHaveBeenCalledWith({
            query: 'audio[data-video-id]',
            withMessage: false,
        });
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Audio is Playing',
            'Please pause all background audios before disabling audio handlers',
        );
        expect(container.querySelectorAll('[data-stub="audio"]')).toHaveLength(
            1,
        );

        h.checkMediaPlaying.mockReturnValue(false);
        await click(getByLabel('Enable Background Audio Handlers'));
        expect(container.querySelectorAll('[data-stub="audio"]')).toHaveLength(
            0,
        );
    });
});
