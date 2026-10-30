// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The panel keeps NO copy of the six spotlight settings: the engine is the one
// store, and its update events are what re-render the panel. So it is driven
// against the REAL `PresentingFocusManager` — a stub could not show that a
// value the engine clamped, or a reset done from the keyboard, is what the
// panel then displays.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    ranges: {} as Record<string, any>,
    swatches: {} as Record<string, any>,
    shortcuts: {} as Record<string, () => void>,
    layers: [] as unknown[],
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
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../_screen/managers/screenDrawShortcutHelpers', () => ({
    toShortcutTitle: (label: string, shortcutId: string) =>
        `${label} [${shortcutId}]`,
}));
vi.mock('../_screen/preview/miniScreenOverlayControlComps', () => ({
    handleKeepOverlayFocus: () => {},
    OverlayRangeComp: (props: any) => {
        h.ranges[props.label] = props;
        h.layers.push(props.layer);
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
        expect(checkIsShortcutTarget()).toBe(true);
        h.shortcuts[shortcutId] = handle;
        h.layers.push(layer);
    },
}));
vi.mock('./presentingControlShortcutHelpers', () => ({
    PRESENTING_CONTROL_LAYER: 'presenting-control',
    presentingShortcutMap: { toggleHold: [{ key: 'h' }] },
    toPresentingShortcutTitle: (label: string, shortcutId: string) =>
        `${label} [${shortcutId}]`,
    usePresentingShortcut: (mappers: any, handle: () => void) => {
        expect(mappers).toEqual([{ key: 'h' }]);
        h.shortcuts.toggleHold = handle;
    },
}));

import ControllerFocusToolsComp from './ControllerFocusToolsComp';
import PresentingFocusManager from './PresentingFocusManager';

let container: HTMLDivElement;
let root: Root;
let focusManager: PresentingFocusManager;

async function renderPanel() {
    await act(async () => {
        root.render(createElement(ControllerFocusToolsComp, { focusManager }));
    });
}

function getButton(label: string) {
    const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    );
    expect(button, `no button "${label}"`).not.toBeNull();
    return button!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', undefined);
    h.settings.clear();
    h.ranges = {};
    h.swatches = {};
    h.shortcuts = {};
    h.layers = [];
    focusManager = new PresentingFocusManager();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    focusManager.delete();
    container.remove();
    vi.unstubAllGlobals();
});

describe('reading the engine', () => {
    test('shows the persisted spotlight', async () => {
        h.settings.set('presenting-control-focus-size', '480');
        h.settings.set('presenting-control-focus-dim', '30');
        h.settings.set('presenting-control-focus-color', '#112233');
        focusManager = new PresentingFocusManager();
        await renderPanel();

        expect(h.ranges['Spotlight size'].value).toBe(480);
        expect(h.ranges['Dim the rest of the app'].value).toBe(30);
        expect(h.swatches['Dim color']).toMatchObject({
            color: '#112233',
            opacity: 30,
        });
        expect(container.textContent).toContain('Move over the app');
    });

    test('a value the engine clamps is the value the panel shows', async () => {
        await renderPanel();
        await act(async () => {
            h.ranges['Spotlight size'].setValue(9000);
        });
        expect(focusManager.size).toBe(1200);
        expect(h.ranges['Spotlight size'].value).toBe(1200);

        await act(async () => {
            h.ranges['Dim the rest of the app'].setValue(2);
        });
        expect(h.ranges['Dim the rest of the app'].value).toBe(10);
        await act(async () => {
            h.ranges['Spotlight edge blur (0 = hard edge)'].setValue(0);
        });
        expect(focusManager.edgeBlur).toBe(0);
        await act(async () => {
            h.swatches['Dim color'].setColor('#ABCDEF');
        });
        expect(h.swatches['Dim color'].color).toBe('#abcdef');
    });
});

describe('contrast', () => {
    test('flips the mask from the button and from its key', async () => {
        await renderPanel();
        const button = getButton('Contrast');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.title).toBe(
            'Spotlight: the circle reveals what the pointer is over' +
                ' [toggleContrast]',
        );

        await act(async () => {
            button.click();
        });
        expect(focusManager.isContrast).toBe(true);
        expect(getButton('Contrast').getAttribute('aria-pressed')).toBe('true');
        expect(getButton('Contrast').title).toBe(
            'Contrast: the circle blocks what the pointer is over' +
                ' [toggleContrast]',
        );

        await act(async () => {
            h.shortcuts.toggleContrast();
        });
        expect(focusManager.isContrast).toBe(false);
    });
});

describe('hold mode', () => {
    test('switches between follow and hold, hint included', async () => {
        await renderPanel();
        expect(getButton('Hold to spotlight').textContent).toBe('Follow');

        await act(async () => {
            getButton('Hold to spotlight').click();
        });
        expect(focusManager.isHoldMode).toBe(true);
        expect(getButton('Hold to spotlight').textContent).toBe('Hold');
        expect(getButton('Hold to spotlight').title).toBe(
            'Hold: dim only while the button is down [toggleHold]',
        );
        expect(container.textContent).toContain(
            'Press and hold on the app to spotlight',
        );

        await act(async () => {
            h.shortcuts.toggleHold();
        });
        expect(focusManager.isHoldMode).toBe(false);
    });
});

describe('reset', () => {
    test('the button and the key both restore the shipped spotlight', async () => {
        await renderPanel();
        await act(async () => {
            h.ranges['Spotlight size'].setValue(800);
            focusManager.setIsContrast(true);
        });
        await act(async () => {
            getButton('Reset settings').click();
        });
        expect(h.ranges['Spotlight size'].value).toBe(260);
        expect(focusManager.isContrast).toBe(false);

        await act(async () => {
            focusManager.setSize(900);
        });
        await act(async () => {
            h.shortcuts.resetSettings();
        });
        expect(h.ranges['Spotlight size'].value).toBe(260);
    });
});

test('the on/off marker follows the spotlight', async () => {
    const mask = document.createElement('div');
    mask.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 300, height: 300 }) as DOMRect;
    document.body.append(mask);
    focusManager.div = mask;
    focusManager.setIsArmed(true);
    await renderPanel();
    const marker = container.querySelector('.bi-record-circle:not(button i)')!;
    expect(marker.className).toContain('text-muted');

    await act(async () => {
        mask.dispatchEvent(
            new MouseEvent('pointermove', { clientX: 20, clientY: 20 }),
        );
    });
    expect(marker.className).toContain('text-primary');
    mask.remove();
});

test('every key is bound on the controller layer', async () => {
    await renderPanel();
    expect(new Set(h.layers)).toEqual(new Set(['presenting-control']));
});
