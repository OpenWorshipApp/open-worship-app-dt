// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The controller owns the TOOL and everything that follows from it: which
// layer takes the pointer, whether the keyboard is claimed and swallowed, what
// each engine is armed for, and the screencast switch. The toolbar, the
// engines and the key plumbing are stood in for, so each of those facts can be
// read straight off what the controller handed them.
const h = vi.hoisted(() => ({
    toolbarProps: null as any,
    fireEvent: vi.fn(),
    swallowArgs: [] as boolean[],
    exitHandle: null as null | (() => void),
    exitMappers: null as any,
    resizeHandle: null as null | (() => void),
    drawManager: {
        canvas: null as HTMLCanvasElement | null,
        setIsEraser: vi.fn(),
        setIsArmed: vi.fn(),
        render: vi.fn(),
    },
    focusManager: {
        div: null as HTMLDivElement | null,
        setIsArmed: vi.fn(),
        render: vi.fn(),
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
vi.mock('../helper/settingHelpers', () => ({ getSetting: () => null }));
vi.mock('../event/WindowEventListener', () => ({
    default: { fireEvent: h.fireEvent },
}));
vi.mock('./ControllerToolbarComp', () => ({
    default: (props: any) => {
        h.toolbarProps = props;
        return createElement('div', { 'data-toolbar': props.tool });
    },
}));
vi.mock('./presentingControlShortcutHelpers', () => ({
    PRESENTING_CONTROL_ID: 'presenting-control',
    PRESENTING_CONTROL_LAYER: 'presenting-control',
    presentingShortcutMap: { exitTool: [{ key: 'Escape' }] },
    usePresentingKeyboardSwallow: (isSwallowing: boolean) => {
        h.swallowArgs.push(isSwallowing);
    },
    usePresentingShortcut: (mappers: any, handle: () => void) => {
        h.exitMappers = mappers;
        h.exitHandle = handle;
    },
}));
vi.mock('./presentingControlHooks', () => ({
    usePresentingManagers: () => ({
        drawManager: h.drawManager,
        focusManager: h.focusManager,
    }),
    useWindowResize: (handle: () => void) => {
        h.resizeHandle = handle;
    },
}));
vi.mock('./KeyboardScreencastComp', () => ({
    default: () => createElement('div', { id: 'screencast-stub' }),
}));

import ControllerComp from './ControllerComp';

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

function getLayers() {
    const [canvas, mask] = Array.from(
        container.querySelectorAll<HTMLElement>('.presenting-control-layer'),
    );
    return { canvas, mask };
}

async function setTool(tool: string) {
    await act(async () => {
        h.toolbarProps.setTool(tool);
    });
}

async function flushLazy() {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.toolbarProps = null;
    h.swallowArgs = [];
    h.exitHandle = null;
    h.resizeHandle = null;
    h.drawManager.canvas = null;
    h.focusManager.div = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root.render(createElement(ControllerComp, { onClose }));
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('opening', () => {
    test('opens in `interact`: click-through, keyboard left to the app', () => {
        const rootElement = container.querySelector('#presenting-control')!;
        expect(rootElement.className).toBe('');
        const { canvas, mask } = getLayers();
        expect(canvas.style.pointerEvents).toBe('none');
        expect(mask.style.pointerEvents).toBe('none');

        expect(h.toolbarProps.tool).toBe('interact');
        expect(h.toolbarProps.isScreencastDisabled).toBe(false);
        expect(h.toolbarProps.isScreencasting).toBe(false);
        expect(h.toolbarProps.onClose).toBe(onClose);
        expect(h.fireEvent).not.toHaveBeenCalled();
        expect(h.swallowArgs.at(-1)).toBe(false);
        expect(h.drawManager.setIsEraser).toHaveBeenLastCalledWith(false);
        expect(h.drawManager.setIsArmed).toHaveBeenLastCalledWith(false);
        expect(h.focusManager.setIsArmed).toHaveBeenLastCalledWith(false);
    });

    test('hands each engine its own layer element', () => {
        const { canvas, mask } = getLayers();
        expect(h.drawManager.canvas).toBe(canvas);
        expect(h.focusManager.div).toBe(mask);
    });

    test('a window resize is passed to both engines', () => {
        h.resizeHandle!();
        expect(h.drawManager.render).toHaveBeenCalledTimes(1);
        expect(h.focusManager.render).toHaveBeenCalledTimes(1);
    });
});

describe('arming a tool', () => {
    test('the brush takes the pointer, the layer and the keyboard', async () => {
        const appInput = document.createElement('input');
        document.body.append(appInput);
        appInput.focus();

        await setTool('paint');

        // Focus is taken off whatever had it, so its own keys cannot fire.
        expect(document.activeElement).not.toBe(appInput);
        expect(container.querySelector('#presenting-control')!.className).toBe(
            'is-armed',
        );
        const { canvas, mask } = getLayers();
        expect(canvas.style.pointerEvents).toBe('auto');
        expect(canvas.style.cursor).toBe('crosshair');
        expect(mask.style.pointerEvents).toBe('none');
        expect(h.fireEvent).toHaveBeenCalledExactlyOnceWith({
            widget: 'presenting-control',
            state: 'open',
        });
        expect(h.swallowArgs.at(-1)).toBe(true);
        expect(h.drawManager.setIsArmed).toHaveBeenLastCalledWith(true);
        expect(h.drawManager.setIsEraser).toHaveBeenLastCalledWith(false);
        expect(h.toolbarProps.isScreencastDisabled).toBe(true);
    });

    test('brush to eraser stays armed and only flips the stroke kind', async () => {
        await setTool('paint');
        await setTool('eraser');
        expect(h.drawManager.setIsEraser).toHaveBeenLastCalledWith(true);
        expect(h.drawManager.setIsArmed).toHaveBeenLastCalledWith(true);
        // Still the one claim from arming the brush — no close/open churn.
        expect(h.fireEvent).toHaveBeenCalledTimes(1);
    });

    test('the spotlight takes the pointer on the mask instead', async () => {
        await setTool('focus');
        const { canvas, mask } = getLayers();
        expect(mask.style.pointerEvents).toBe('auto');
        expect(mask.style.cursor).toBe('crosshair');
        expect(canvas.style.pointerEvents).toBe('none');
        expect(h.focusManager.setIsArmed).toHaveBeenLastCalledWith(true);
        expect(h.drawManager.setIsArmed).toHaveBeenLastCalledWith(false);
    });

    test('picking the tool already in use changes nothing', async () => {
        const appInput = document.createElement('input');
        document.body.append(appInput);
        appInput.focus();
        await setTool('interact');
        expect(document.activeElement).toBe(appInput);
        expect(h.fireEvent).not.toHaveBeenCalled();
    });
});

describe('disarming', () => {
    test('Escape hands the app back without closing the controller', async () => {
        expect(h.exitMappers).toEqual([{ key: 'Escape' }]);
        await setTool('paint');
        await act(async () => {
            h.exitHandle!();
        });
        expect(h.toolbarProps.tool).toBe('interact');
        expect(h.fireEvent).toHaveBeenLastCalledWith({
            widget: 'presenting-control',
            state: 'close',
        });
        expect(h.swallowArgs.at(-1)).toBe(false);
        expect(onClose).not.toHaveBeenCalled();
    });

    test('closing while armed releases the keyboard layer', async () => {
        await setTool('focus');
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(h.fireEvent).toHaveBeenLastCalledWith({
            widget: 'presenting-control',
            state: 'close',
        });
    });
});

describe('keyboard screencast', () => {
    test('toggles on and off from `interact`', async () => {
        await act(async () => {
            h.toolbarProps.onToggleScreencast();
        });
        await flushLazy();
        expect(h.toolbarProps.isScreencasting).toBe(true);
        expect(container.querySelector('#screencast-stub')).not.toBeNull();

        await act(async () => {
            h.toolbarProps.onToggleScreencast();
        });
        expect(h.toolbarProps.isScreencasting).toBe(false);
        expect(container.querySelector('#screencast-stub')).toBeNull();
    });

    test('arming switches it off, and it cannot be switched on while armed', async () => {
        await act(async () => {
            h.toolbarProps.onToggleScreencast();
        });
        expect(h.toolbarProps.isScreencasting).toBe(true);

        await setTool('paint');
        expect(h.toolbarProps.isScreencasting).toBe(false);

        await act(async () => {
            h.toolbarProps.onToggleScreencast();
        });
        expect(h.toolbarProps.isScreencasting).toBe(false);

        // ...and it does not come back by itself on disarm.
        await setTool('interact');
        expect(h.toolbarProps.isScreencasting).toBe(false);
    });
});
