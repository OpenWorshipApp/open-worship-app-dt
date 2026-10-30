// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The brush panel edits six persisted settings and pushes the resulting brush
// onto the engine. The setting hooks are stood in for by a `useState` over an
// in-memory store, so both halves — what is written, and what the engine is
// handed — can be read back. The shared overlay widgets are stubs that record
// their props, and every key binding records the layer it was bound on.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    ranges: {} as Record<string, any>,
    swatches: {} as Record<string, any>,
    overlayShortcuts: {} as Record<string, () => void>,
    shortcutLayers: [] as unknown[],
    shortcutTargetChecks: [] as (() => boolean)[],
}));

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
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false, isWindows: true } },
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    function useStoredSetting<T>(
        key: string,
        defaultValue: T,
        parse: (raw: string) => T,
    ) {
        const raw = h.settings.get(key);
        const [value, setValue] = useState<T>(
            raw === undefined ? defaultValue : parse(raw),
        );
        return [
            value,
            (newValue: T) => {
                h.settings.set(key, `${newValue}`);
                setValue(newValue);
            },
        ] as const;
    }
    return {
        getSetting: (key: string) => h.settings.get(key) ?? null,
        useStateSettingString: (key: string, defaultValue: string) =>
            useStoredSetting(key, defaultValue, (raw) => raw),
        useStateSettingNumber: (key: string, defaultValue: number) =>
            useStoredSetting(key, defaultValue, Number),
        useStateSettingBoolean: (key: string, defaultValue: boolean) =>
            useStoredSetting(key, defaultValue, (raw) => raw === 'true'),
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../_screen/managers/screenDrawShortcutHelpers', () => ({
    toShortcutTitle: (label: string, shortcutId: string) =>
        `${label} [${shortcutId}]`,
}));
vi.mock('../_screen/preview/miniScreenOverlayControlComps', () => ({
    handleKeepOverlayFocus: () => {},
    OverlayRangeComp: (props: any) => {
        h.ranges[props.label] = props;
        h.shortcutLayers.push(props.layer);
        h.shortcutTargetChecks.push(props.checkIsShortcutTarget);
        return createElement('output', null, `${props.value}${props.suffix}`);
    },
    OverlayColorSwatchComp: (props: any) => {
        h.swatches[props.label] = props;
        return null;
    },
    useOverlayShortcut: (
        shortcutId: string,
        handle: () => void,
        checkIsShortcutTarget: () => boolean,
        _isRepeatable: boolean,
        layer: unknown,
    ) => {
        h.overlayShortcuts[shortcutId] = handle;
        h.shortcutLayers.push(layer);
        h.shortcutTargetChecks.push(checkIsShortcutTarget);
    },
}));
vi.mock('./presentingControlShortcutHelpers', () => ({
    PRESENTING_CONTROL_LAYER: 'presenting-control',
}));

import ControllerDrawToolsComp from './ControllerDrawToolsComp';

let container: HTMLDivElement;
let root: Root;
let drawManager: {
    isHighQuality: boolean;
    setRenderQuality: ReturnType<typeof vi.fn>;
    setPaintParams: ReturnType<typeof vi.fn>;
};

async function renderPanel(isEraser = false) {
    await act(async () => {
        root.render(
            createElement(ControllerDrawToolsComp, {
                drawManager: drawManager as any,
                isEraser,
            }),
        );
    });
}

function getButton(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => {
            return (
                candidate.textContent === text ||
                candidate.getAttribute('aria-label') === text
            );
        },
    );
    expect(button, `no button "${text}"`).toBeDefined();
    return button!;
}

function lastBrush() {
    return drawManager.setPaintParams.mock.calls.at(-1)![0];
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings.clear();
    h.ranges = {};
    h.swatches = {};
    h.overlayShortcuts = {};
    h.shortcutLayers = [];
    h.shortcutTargetChecks = [];
    drawManager = {
        isHighQuality: true,
        setRenderQuality: vi.fn(),
        setPaintParams: vi.fn(),
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('the brush handed to the engine', () => {
    test('starts from the shipped defaults', async () => {
        await renderPanel();
        expect(lastBrush()).toEqual({
            color: '#ff2d2dff',
            size: 10,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        expect(container.textContent).toContain(
            'Drag anywhere on the app to draw',
        );
    });

    test('reads the persisted brush, opacity folded into the colour', async () => {
        h.settings.set('presenting-control-paint-color', '#00ff00');
        h.settings.set('presenting-control-paint-alpha', '50');
        h.settings.set('presenting-control-paint-size', '24');
        h.settings.set('presenting-control-paint-dots', 'true');
        await renderPanel(true);
        expect(lastBrush()).toEqual({
            color: '#00ff0080',
            size: 24,
            isStraight: false,
            is3D: false,
            isDots: true,
        });
        expect(container.textContent).toContain(
            'Drag over the drawing to rub it out',
        );
    });

    test('a slider or swatch edit is persisted and reaches the engine', async () => {
        await renderPanel();
        await act(async () => {
            h.ranges.Size.setValue(30);
        });
        expect(lastBrush().size).toBe(30);
        expect(h.settings.get('presenting-control-paint-size')).toBe('30');

        await act(async () => {
            h.ranges.Opacity.setValue(50);
        });
        expect(lastBrush().color).toBe('#ff2d2d80');

        await act(async () => {
            h.swatches.Color.setColor('#123456');
        });
        expect(lastBrush().color).toBe('#12345680');
        expect(h.settings.get('presenting-control-paint-color')).toBe(
            '#123456',
        );
        // The swatch shows the opacity the stroke will be drawn at.
        expect(h.swatches.Color.opacity).toBe(50);
    });
});

describe('stroke style toggles', () => {
    test('each toggles from its button and from its key', async () => {
        await renderPanel();
        const straight = getButton('Straight');
        expect(straight.getAttribute('aria-pressed')).toBe('false');
        expect(straight.title).toBe('Straight [toggleStraight]');

        await act(async () => {
            straight.click();
        });
        expect(getButton('Straight').getAttribute('aria-pressed')).toBe('true');
        expect(lastBrush().isStraight).toBe(true);
        expect(h.settings.get('presenting-control-paint-straight')).toBe(
            'true',
        );

        await act(async () => {
            h.overlayShortcuts.toggle3D();
        });
        expect(lastBrush().is3D).toBe(true);
        await act(async () => {
            getButton('Dots').click();
        });
        expect(lastBrush().isDots).toBe(true);
        await act(async () => {
            h.overlayShortcuts.toggleStraight();
        });
        expect(lastBrush().isStraight).toBe(false);
    });
});

describe('render quality', () => {
    test('is seeded from the engine and pushed back into it', async () => {
        await renderPanel();
        const qualityButton = getButton('Toggle drawing quality');
        expect(qualityButton.textContent).toBe('HQ');
        expect(qualityButton.title).toBe(
            'High quality drawing (anti-aliased, slower) [toggleQuality]',
        );

        await act(async () => {
            qualityButton.click();
        });
        expect(drawManager.setRenderQuality).toHaveBeenLastCalledWith(false);
        expect(getButton('Toggle drawing quality').textContent).toBe('Fast');
        expect(getButton('Toggle drawing quality').title).toBe(
            'Fast drawing (lighter, less smooth) [toggleQuality]',
        );

        await act(async () => {
            h.overlayShortcuts.toggleQuality();
        });
        expect(drawManager.setRenderQuality).toHaveBeenLastCalledWith(true);
    });

    test('an engine already in fast mode opens the button on Fast', async () => {
        drawManager.isHighQuality = false;
        await renderPanel();
        expect(getButton('Toggle drawing quality').textContent).toBe('Fast');
    });
});

describe('reset', () => {
    test('puts every brush setting and the quality back', async () => {
        h.settings.set('presenting-control-paint-color', '#00ff00');
        h.settings.set('presenting-control-paint-size', '40');
        h.settings.set('presenting-control-paint-3d', 'true');
        drawManager.isHighQuality = false;
        await renderPanel();

        await act(async () => {
            getButton('Reset settings').click();
        });
        expect(lastBrush()).toEqual({
            color: '#ff2d2dff',
            size: 10,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        expect(h.settings.get('presenting-control-paint-color')).toBe(
            '#ff2d2d',
        );
        expect(drawManager.setRenderQuality).toHaveBeenLastCalledWith(true);
        expect(getButton('Toggle drawing quality').textContent).toBe('HQ');
    });

    test('the reset key does the same', async () => {
        await renderPanel();
        await act(async () => {
            h.ranges.Size.setValue(55);
        });
        await act(async () => {
            h.overlayShortcuts.resetSettings();
        });
        expect(lastBrush().size).toBe(10);
    });
});

test('every key is bound on the controller layer, not left to `root`', async () => {
    // Left implicit, `useKeyboardRegistering` resolves the layer at render —
    // before ControllerComp's effect has claimed it — and pins the keys to
    // `root`, where they are dead for as long as the tool stays armed.
    await renderPanel();
    expect(h.shortcutLayers.length).toBeGreaterThan(0);
    expect(new Set(h.shortcutLayers)).toEqual(new Set(['presenting-control']));
    // Mounted only while a drawing tool is armed: being shown is the gate.
    expect(h.shortcutTargetChecks.every((check) => check() === true)).toBe(
        true,
    );
});
