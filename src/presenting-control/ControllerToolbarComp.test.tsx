// @vitest-environment jsdom

import { act, createElement, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    widgetProps: null as any,
    showAppContextMenu: vi.fn(),
    keepFocus: vi.fn(),
    takeAppSnapshot: vi.fn(),
    sendSnapshotToChatbot: vi.fn(),
    copySnapshot: vi.fn(),
    saveSnapshotToImages: vi.fn(),
    toolShortcuts: {} as Record<string, () => void>,
    shortcuts: new Map<any, () => void>(),
    drawShortcutMap: {
        clearDrawing: [{ key: 'c' }],
        undo: [{ key: 'z', allControlKey: ['Ctrl'] }],
        redo: [{ key: 'z', allControlKey: ['Ctrl', 'Shift'] }],
    },
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
    getSetting: () => null,
    setSetting: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: any) =>
        createElement(Suspense, { fallback: null }, children),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        h.widgetProps = props;
        return createElement(
            'div',
            {
                id: 'widget',
                'data-body-hidden': String(props.isBodyHidden),
            },
            createElement('header', null, props.title),
            createElement('main', null, props.children),
        );
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('./presentingSnapshotHelpers', () => ({
    takeAppSnapshot: h.takeAppSnapshot,
    sendSnapshotToChatbot: h.sendSnapshotToChatbot,
    copySnapshot: h.copySnapshot,
    saveSnapshotToImages: h.saveSnapshotToImages,
}));
vi.mock('../_screen/managers/screenDrawShortcutHelpers', () => ({
    drawShortcutMap: h.drawShortcutMap,
    toShortcutTitle: (label: string, shortcutId: string) =>
        `${label} [${shortcutId}]`,
}));
vi.mock('../_screen/preview/miniScreenOverlayControlComps', () => ({
    handleKeepOverlayFocus: h.keepFocus,
}));
vi.mock('./presentingControlShortcutHelpers', () => ({
    toPresentingShortcutTitle: (label: string, shortcutId: string) =>
        `${label} [${shortcutId}]`,
    usePresentingShortcut: (mappers: any, handle: () => void) => {
        h.shortcuts.set(mappers, handle);
    },
    usePresentingToolShortcut: (shortcutId: string, handle: () => void) => {
        h.toolShortcuts[shortcutId] = handle;
    },
}));
vi.mock('./ControllerDrawToolsComp', () => ({
    default: (props: any) =>
        createElement('div', {
            id: 'draw-tools',
            'data-eraser': String(props.isEraser),
        }),
}));
vi.mock('./ControllerFocusToolsComp', () => ({
    default: () => createElement('div', { id: 'focus-tools' }),
}));

import ControllerToolbarComp from './ControllerToolbarComp';

function genDrawManager() {
    const listeners = new Set<() => void>();
    return {
        canUndo: false,
        canRedo: false,
        isShowing: false,
        undo: vi.fn(),
        redo: vi.fn(),
        clear: vi.fn(),
        addUpdateListener: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        fireUpdate: () => {
            for (const listener of listeners) {
                listener();
            }
        },
    };
}

let container: HTMLDivElement;
let root: Root;
let drawManager: ReturnType<typeof genDrawManager>;
const focusManager = { name: 'focus' };
const setTool = vi.fn();
const onToggleScreencast = vi.fn();
const onClose = vi.fn();

async function renderToolbar(
    props: Partial<{
        tool: string;
        isScreencasting: boolean;
        isScreencastDisabled: boolean;
    }> = {},
) {
    await act(async () => {
        root.render(
            createElement(ControllerToolbarComp, {
                tool: 'interact',
                setTool,
                isScreencasting: false,
                isScreencastDisabled: false,
                onToggleScreencast,
                drawManager: drawManager as any,
                focusManager: focusManager as any,
                onClose,
                ...(props as any),
            }),
        );
    });
    // The two panels are lazy chunks.
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

function getButton(label: string) {
    const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    );
    expect(button, `no button "${label}"`).not.toBeNull();
    return button!;
}

const TOOL_LABELS = {
    interact: 'Use the app (drawing stays on top)',
    paint: 'Draw on the app',
    eraser: 'Erase parts of the drawing',
    focus: 'Spotlight part of the app',
};

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.widgetProps = null;
    h.toolShortcuts = {};
    h.shortcuts.clear();
    drawManager = genDrawManager();
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

describe('tool switcher', () => {
    test('marks the live tool and switches on click', async () => {
        await renderToolbar({ tool: 'paint' });
        for (const [tool, label] of Object.entries(TOOL_LABELS)) {
            const button = getButton(label);
            expect(button.getAttribute('aria-pressed')).toBe(
                String(tool === 'paint'),
            );
            expect(button.className).toContain(
                tool === 'paint' ? 'btn-primary' : 'btn-outline-secondary',
            );
        }
        expect(getButton(TOOL_LABELS.focus).title).toBe(
            `${TOOL_LABELS.focus} [useFocus]`,
        );

        for (const [tool, label] of Object.entries(TOOL_LABELS)) {
            await act(async () => {
                getButton(label).click();
            });
            expect(setTool).toHaveBeenLastCalledWith(tool);
        }
    });

    test('pressing a button never takes the focus off the overlay', async () => {
        await renderToolbar();
        getButton(TOOL_LABELS.paint).dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true }),
        );
        expect(h.keepFocus).toHaveBeenCalledTimes(1);
    });

    test('the tool keys select the same tools', async () => {
        await renderToolbar();
        const expected = {
            useInteract: 'interact',
            usePaint: 'paint',
            useEraser: 'eraser',
            useFocus: 'focus',
        };
        for (const [shortcutId, tool] of Object.entries(expected)) {
            h.toolShortcuts[shortcutId]();
            expect(setTool).toHaveBeenLastCalledWith(tool);
        }
        h.toolShortcuts.toggleScreencast();
        expect(onToggleScreencast).toHaveBeenCalledTimes(1);
    });
});

describe('tool panel', () => {
    test('`interact` has no panel, so the widget is a header alone', async () => {
        await renderToolbar({ tool: 'interact' });
        expect(h.widgetProps.isBodyHidden).toBe(true);
        expect(h.widgetProps.persistKey).toBe('presenting-control-widget-rect');
        expect(h.widgetProps.options.extraClassName).toBe(
            'presenting-control-widget',
        );
        expect(container.querySelector('#draw-tools')).toBeNull();
        expect(container.querySelector('#focus-tools')).toBeNull();
    });

    test('the brush and the eraser share the draw panel', async () => {
        await renderToolbar({ tool: 'paint' });
        expect(h.widgetProps.isBodyHidden).toBe(false);
        expect(
            container.querySelector('#draw-tools')!.getAttribute('data-eraser'),
        ).toBe('false');

        await renderToolbar({ tool: 'eraser' });
        expect(
            container.querySelector('#draw-tools')!.getAttribute('data-eraser'),
        ).toBe('true');
    });

    test('the spotlight gets its own panel', async () => {
        await renderToolbar({ tool: 'focus' });
        expect(h.widgetProps.isBodyHidden).toBe(false);
        expect(container.querySelector('#focus-tools')).not.toBeNull();
        expect(container.querySelector('#draw-tools')).toBeNull();
    });

    test('the widget close is the controller close', async () => {
        await renderToolbar();
        h.widgetProps.onClose();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('screencast switch', () => {
    test('says what it does and toggles', async () => {
        await renderToolbar({ isScreencasting: true });
        const button = getButton('Show the keys being pressed');
        expect(button.disabled).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        await act(async () => {
            button.click();
        });
        expect(onToggleScreencast).toHaveBeenCalledTimes(1);
    });

    test('is off and explains why while a tool is armed', async () => {
        await renderToolbar({ tool: 'paint', isScreencastDisabled: true });
        const button = getButton('Available while using the app');
        expect(button.disabled).toBe(true);
    });
});

describe('drawing history', () => {
    test('tracks what is on the canvas, re-rendering on engine updates', async () => {
        await renderToolbar();
        expect(getButton('Undo').disabled).toBe(true);
        expect(getButton('Redo').disabled).toBe(true);
        expect(getButton('Clear drawing').disabled).toBe(true);
        expect(getButton('Clear drawing').className).toContain(
            'btn-outline-danger',
        );

        drawManager.canUndo = true;
        drawManager.isShowing = true;
        await act(async () => {
            drawManager.fireUpdate();
        });
        expect(getButton('Undo').disabled).toBe(false);
        expect(getButton('Redo').disabled).toBe(true);
        expect(getButton('Clear drawing').disabled).toBe(false);
        expect(getButton('Undo').title).toBe('Undo [undo]');
    });

    test('the buttons and their keys drive the engine', async () => {
        drawManager.canUndo = true;
        drawManager.canRedo = true;
        drawManager.isShowing = true;
        await renderToolbar({ tool: 'paint' });

        await act(async () => {
            getButton('Undo').click();
            getButton('Redo').click();
            getButton('Clear drawing').click();
        });
        expect(drawManager.undo).toHaveBeenCalledTimes(1);
        expect(drawManager.redo).toHaveBeenCalledTimes(1);
        expect(drawManager.clear).toHaveBeenCalledTimes(1);

        h.shortcuts.get(h.drawShortcutMap.undo)!();
        h.shortcuts.get(h.drawShortcutMap.redo)!();
        h.shortcuts.get(h.drawShortcutMap.clearDrawing)!();
        expect(drawManager.undo).toHaveBeenCalledTimes(2);
        expect(drawManager.redo).toHaveBeenCalledTimes(2);
        expect(drawManager.clear).toHaveBeenCalledTimes(2);
    });
});

describe('snapshot', () => {
    const DATA_URL = 'data:image/png;base64,aGkh';

    async function pressCamera() {
        await act(async () => {
            getButton('Take a picture of the app').dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    clientX: 120,
                    clientY: 45,
                }),
            );
        });
    }

    test('takes the picture first, then offers it at the pressed point', async () => {
        h.takeAppSnapshot.mockResolvedValue(DATA_URL);
        await renderToolbar();
        await pressCamera();

        expect(h.takeAppSnapshot).toHaveBeenCalledTimes(1);
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [event, items] = h.showAppContextMenu.mock.calls[0];
        expect(event).toMatchObject({ clientX: 120, clientY: 45 });
        // A remembered point, not the finished click: these are no-ops.
        expect(() => {
            event.preventDefault();
            event.stopPropagation();
        }).not.toThrow();
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Ask the assistant about this',
            'Copy',
            'Save into your images',
        ]);

        items[0].onSelect();
        items[1].onSelect();
        items[2].onSelect();
        expect(h.sendSnapshotToChatbot).toHaveBeenCalledWith(DATA_URL);
        expect(h.copySnapshot).toHaveBeenCalledWith(DATA_URL);
        expect(h.saveSnapshotToImages).toHaveBeenCalledWith(DATA_URL);
    });

    test('a failed capture offers no menu', async () => {
        h.takeAppSnapshot.mockResolvedValue(null);
        await renderToolbar();
        await pressCamera();
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });
});
