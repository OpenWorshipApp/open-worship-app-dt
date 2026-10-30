// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    Context: null as any,
    screenManagers: new Map<number, any>(),
    isNoRendering: false,
    isDarkMode: false,
    isWallpaperEnabled: true,
    wallpaper: null as any,
    wallpaperArgs: [] as [number, boolean][],
    eventCallbacks: new Map<string, () => void>(),
    refreshDisplayWallpaper: vi.fn(),
}));

function genLayerStub(name: string, use: (context: any) => unknown) {
    return {
        default: (props: Record<string, unknown>) => {
            const screenManager = use(h.Context) as any;
            return (
                <div
                    data-layer={name}
                    data-screen-id={screenManager?.screenId}
                    data-props={JSON.stringify(props)}
                />
            );
        },
    };
}

vi.mock('../managers/screenManagerHooks', async () => {
    const { createContext } = await import('react');
    h.Context = createContext<any>(null);
    return {
        ScreenManagerBaseContext: h.Context,
        useScreenManagerEvents: (
            eventNames: string[],
            _target: unknown,
            callback?: () => void,
        ) => {
            if (callback !== undefined) {
                h.eventCallbacks.set(eventNames[0], callback);
            }
        },
    };
});
vi.mock('../ScreenForegroundComp', async () => {
    const { use } = await import('react');
    return genLayerStub('foreground', use);
});
vi.mock('../ScreenBackgroundComp', async () => {
    const { use } = await import('react');
    return genLayerStub('background', use);
});
vi.mock('../ScreenVaryAppDocumentComp', async () => {
    const { use } = await import('react');
    return genLayerStub('slide', use);
});
vi.mock('../ScreenBibleComp', async () => {
    const { use } = await import('react');
    return genLayerStub('bible', use);
});
vi.mock('../ScreenDrawComp', async () => {
    const { use } = await import('react');
    return genLayerStub('draw', use);
});
vi.mock('../ScreenFocusComp', async () => {
    const { use } = await import('react');
    return genLayerStub('focus', use);
});
vi.mock('../managers/screenManagerHelpers', () => ({
    getScreenManagerByScreenId: (screenId: number) => {
        return h.screenManagers.get(screenId) ?? null;
    },
}));
vi.mock('./displayWallpaperHelpers', () => ({
    getIsWallpaperBackdropEnabled: () => h.isWallpaperEnabled,
    refreshDisplayWallpaper: h.refreshDisplayWallpaper,
    useDisplayWallpaper: (displayId: number, isEnabled: boolean) => {
        h.wallpaperArgs.push([displayId, isEnabled]);
        return h.wallpaper;
    },
}));
vi.mock('../../others/themeHelpers', () => ({
    checkIsDarkMode: () => h.isDarkMode,
}));
vi.mock('./miniScreenRenderingHelpers', () => ({
    useIsMiniScreenNoRendering: () => [h.isNoRendering, vi.fn()],
}));

import MiniScreenAppComp, { genStyleRendering } from './MiniScreenAppComp';

let container: HTMLDivElement;
let root: Root;

function genEffectManager(prefix: string) {
    return {
        styleAnimList: {
            fade: { styleText: `.${prefix}-fade{}` },
            zoom: { styleText: `.${prefix}-zoom{}` },
        },
    };
}

function addScreenManager(screenId: number, displayId = 11) {
    const screenManager = {
        screenId,
        displayId,
        varyAppDocumentEffectManager: genEffectManager('slide'),
        backgroundEffectManager: genEffectManager('bg'),
        foregroundEffectManager: genEffectManager('fg'),
    };
    h.screenManagers.set(screenId, screenManager);
    return screenManager;
}

async function renderApp(screenId: number) {
    await act(async () => {
        root.render(<MiniScreenAppComp screenId={screenId} />);
    });
}

function getLayers() {
    return [...container.querySelectorAll<HTMLElement>('[data-layer]')].map(
        (layer) => {
            return layer.dataset.layer;
        },
    );
}

function getStyles() {
    return [...container.querySelectorAll('style')].map((style) => {
        return style.textContent;
    });
}

function getBackdrop() {
    return container.querySelector<HTMLElement>(
        'div[style*="pointer-events: none"]',
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.screenManagers.clear();
    h.isNoRendering = false;
    h.isDarkMode = false;
    h.isWallpaperEnabled = true;
    h.wallpaper = null;
    h.wallpaperArgs.length = 0;
    h.eventCallbacks.clear();
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

describe('genStyleRendering', () => {
    test('one style element per transition, keyed by effect type', () => {
        const styles = genStyleRendering(genEffectManager('x') as any);
        expect(
            styles.map((style) => {
                return [style.key, style.props.children];
            }),
        ).toEqual([
            ['fade', '.x-fade{}'],
            ['zoom', '.x-zoom{}'],
        ]);
    });
});

describe('MiniScreenAppComp', () => {
    test('a screen that does not exist draws nothing', async () => {
        await renderApp(42);
        expect(container.innerHTML).toBe('');
    });

    test('draws every layer of its screen, in order, with their styles', async () => {
        addScreenManager(1);
        await renderApp(1);
        expect(getLayers()).toEqual([
            'background',
            'foreground',
            'slide',
            'bible',
            'foreground',
            'draw',
            'focus',
        ]);
        const layers = container.querySelectorAll<HTMLElement>('[data-layer]');
        expect(layers[1].dataset.props).toBe('{"isBehind":true}');
        expect(layers[2].dataset.props).toBe('{"isUnpainted":false}');
        // Every layer reads THIS screen from the context.
        for (const layer of layers) {
            expect(layer.dataset.screenId).toBe('1');
        }
        expect(getStyles()).toEqual([
            '.bg-fade{}',
            '.bg-zoom{}',
            '.slide-fade{}',
            '.slide-zoom{}',
            '.fg-fade{}',
            '.fg-zoom{}',
        ]);
    });

    test('with rendering off only the slide layer stays, unpainted', async () => {
        addScreenManager(2);
        h.isNoRendering = true;
        await renderApp(2);
        expect(getLayers()).toEqual(['slide']);
        expect(
            container.querySelector<HTMLElement>('[data-layer="slide"]')!
                .dataset.props,
        ).toBe('{"isUnpainted":true}');
        expect(getStyles()).toEqual(['.slide-fade{}', '.slide-zoom{}']);
        expect(getBackdrop()).toBe(null);
    });

    test('with no wallpaper the backdrop is the checkered pattern', async () => {
        addScreenManager(3, 21);
        await renderApp(3);
        expect(h.wallpaperArgs.at(-1)).toEqual([21, true]);
        const backdrop = getBackdrop()!;
        expect(backdrop.style.backgroundImage).toContain('--bs-gray-300');
        expect(backdrop.style.backgroundSize).toBe('20px 20px');
    });

    test('in dark mode the pattern is drawn in the darker grays', async () => {
        h.isDarkMode = true;
        addScreenManager(3);
        await renderApp(3);
        expect(getBackdrop()!.style.backgroundImage).toContain('--bs-gray-700');
    });

    test('the wallpaper setting reaches the reader', async () => {
        h.isWallpaperEnabled = false;
        addScreenManager(3, 21);
        await renderApp(3);
        expect(h.wallpaperArgs.at(-1)).toEqual([21, false]);
    });

    test('a desktop with no picture is its plain colour', async () => {
        h.wallpaper = { imageDataUrl: null, color: '#123456', fit: 'cover' };
        addScreenManager(4);
        await renderApp(4);
        const backdrop = getBackdrop()!;
        expect(backdrop.style.backgroundColor).toBe('rgb(18, 52, 86)');
        expect(backdrop.style.backgroundImage).toBe('');
    });

    test('a wallpaper picture is laid out the way the desktop does', async () => {
        h.wallpaper = {
            imageDataUrl: 'data:image/png;base64,AAA',
            color: null,
            fit: 'tile',
        };
        addScreenManager(5);
        await renderApp(5);
        const backdrop = getBackdrop()!;
        expect(backdrop.style.backgroundImage).toBe(
            'url("data:image/png;base64,AAA")',
        );
        expect(backdrop.style.backgroundRepeat).toBe('repeat');
        expect(backdrop.style.backgroundSize).toBe('auto');
        expect(backdrop.style.backgroundPosition).toBe('center');
    });

    test('an unknown fit falls back to cover', async () => {
        h.wallpaper = {
            imageDataUrl: 'data:image/png;base64,BBB',
            color: '#000000',
            fit: 'stretch-ish',
        };
        addScreenManager(6);
        await renderApp(6);
        const backdrop = getBackdrop()!;
        expect(backdrop.style.backgroundSize).toBe('cover');
        expect(backdrop.style.backgroundRepeat).toBe('no-repeat');
        expect(backdrop.style.backgroundColor).toBe('rgb(0, 0, 0)');
    });

    test('Refresh Preview reads the wallpaper of its display again', async () => {
        addScreenManager(7, 33);
        await renderApp(7);
        h.eventCallbacks.get('refresh')!();
        expect(h.refreshDisplayWallpaper).toHaveBeenCalledWith(33);
    });
});
