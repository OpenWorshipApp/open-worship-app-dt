// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The panel's Presets row (UT-102): a built-in look and a saved one put the
// whole brush on through the panel's own setters, and Save keeps the brush
// as it is now. The rest of the surface is the panel's own test's:
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
        setSetting: (key: string, value: string) => {
            h.settings.set(key, value);
        },
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
vi.mock('../popup-widget/presetNameInputHelpers', () => ({
    askPresetName: async () => 'Sermon marker',
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

const SAVED_SETTING = 'draw-paint-saved-presets';

function getPreset(label: string) {
    const button = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button.app-preset'),
    ).find((candidate) => {
        return candidate.textContent === label;
    });
    expect(button, `no preset "${label}"`).toBeDefined();
    return button!;
}

describe('the Presets row', () => {
    test('a built-in look puts the whole brush on, and it is kept', async () => {
        await renderPanel();
        await act(async () => {
            getPreset('Highlight').click();
        });
        // 35% opacity is 0x59 of 0xff.
        expect(lastBrush()).toEqual({
            color: '#ffd60a59',
            size: 28,
            isStraight: true,
            is3D: false,
            isDots: false,
        });
        expect(h.settings.get('presenting-control-paint-color')).toBe(
            '#ffd60a',
        );
        expect(h.settings.get('presenting-control-paint-alpha')).toBe('35');
        expect(h.settings.get('presenting-control-paint-size')).toBe('28');
        expect(h.settings.get('presenting-control-paint-straight')).toBe(
            'true',
        );
        expect(h.ranges.Opacity.value).toBe(35);
        expect(getButton('Straight').getAttribute('aria-pressed')).toBe('true');
        // The engine's quality is not part of a look.
        expect(drawManager.setRenderQuality).not.toHaveBeenCalled();
    });

    test('Save keeps the brush as it is now, and pressing it puts it back', async () => {
        await renderPanel();
        await act(async () => {
            h.ranges.Size.setValue(30);
        });
        await act(async () => {
            getButton('Dots').click();
        });
        await act(async () => {
            getButton('Save as Preset').click();
        });
        await vi.waitFor(() => {
            expect(h.settings.get(SAVED_SETTING)).toBeDefined();
        });
        const saved = JSON.parse(h.settings.get(SAVED_SETTING)!);
        expect(saved).toHaveLength(1);
        expect(saved[0].name).toBe('Sermon marker');
        expect(saved[0].values).toEqual({
            color: '#ff2d2d',
            alpha: 100,
            size: 30,
            isStraight: false,
            is3D: false,
            isDots: true,
        });

        // Changed after saving...
        await act(async () => {
            getPreset('Underline').click();
        });
        expect(lastBrush().size).toBe(5);
        expect(lastBrush().isDots).toBe(false);
        // ...and the saved chip brings the saved brush back.
        await act(async () => {
            getPreset('Sermon marker').click();
        });
        expect(lastBrush()).toEqual({
            color: '#ff2d2dff',
            size: 30,
            isStraight: false,
            is3D: false,
            isDots: true,
        });
    });
});
