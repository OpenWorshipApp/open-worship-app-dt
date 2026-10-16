// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settingNames: [] as string[],
    shortcuts: new Map<string, () => void>(),
    manager: {
        isFocused: false,
        isShowing: true,
        isHighQuality: true,
        canUndo: true,
        canRedo: true,
        setPaintTool: vi.fn(),
        updatePaintToolParams: vi.fn(),
        setRenderQuality: vi.fn(),
        clear: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (name: string, initial: string) => {
            h.settingNames.push(name);
            return useState(initial);
        },
        useStateSettingNumber: (name: string, initial: number) => {
            h.settingNames.push(name);
            return useState(initial);
        },
        useStateSettingBoolean: (name: string, initial: boolean) => {
            h.settingNames.push(name);
            return useState(initial);
        },
    };
});
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => ({
        screenId: 7,
        screenDrawManager: h.manager,
    }),
}));
vi.mock('../managers/screenEventHelpers', () => ({
    useScreenDrawManagerEvents: vi.fn(),
}));
vi.mock('../managers/screenDrawShortcutHelpers', () => ({
    toShortcutTitle: (label: string) => label,
    STEP_SMALL: 1,
    STEP_BIG: 10,
}));
vi.mock('./miniScreenOverlayControlComps', () => ({
    handleKeepOverlayFocus: (event: { preventDefault: () => void }) =>
        event.preventDefault(),
    useOverlayShortcut: (
        id: string,
        callback: () => void,
        checkTarget: () => boolean,
    ) =>
        h.shortcuts.set(id, () => {
            if (checkTarget()) callback();
        }),
    OverlayColorSwatchComp: ({
        setColor,
    }: {
        setColor: (color: string) => void;
    }) => (
        <button type="button" onClick={() => setColor('#112233')}>
            Pick color
        </button>
    ),
    OverlayRangeComp: ({
        label,
        value,
        setValue,
    }: {
        label: string;
        value: number;
        setValue: (value: number) => void;
    }) => (
        <button type="button" onClick={() => setValue(value - 1)}>
            {label} range
        </button>
    ),
}));

import MiniScreenDrawHandlersComp from './MiniScreenDrawHandlersComp';

describe('MiniScreenDrawHandlersComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find(
            (item) =>
                item.getAttribute('aria-label') === label ||
                item.textContent === label,
        );
        if (!button) throw new Error(`Missing button: ${label}`);
        await act(async () => button.click());
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.clearAllMocks();
        h.settingNames.length = 0;
        h.shortcuts.clear();
        h.manager.isFocused = false;
        h.manager.isShowing = true;
        h.manager.isHighQuality = true;
        h.manager.canUndo = true;
        h.manager.canRedo = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('arms the paint tool once and updates brush parameters in place', async () => {
        await act(async () => root.render(<MiniScreenDrawHandlersComp />));
        expect(h.manager.setPaintTool).toHaveBeenCalledTimes(1);
        expect(h.manager.setPaintTool).toHaveBeenCalledWith(
            expect.objectContaining({
                color: '#ff2d2dff',
                size: 10,
                isStraight: false,
                is3D: false,
                isDots: false,
                isEraser: false,
            }),
        );
        expect(h.settingNames).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/color.*7/),
                expect.stringMatching(/size.*7/),
                expect.stringMatching(/alpha.*7/),
            ]),
        );
        await click('Straight');
        await click('3D');
        await click('Dots');
        await click('Manual eraser');
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isStraight: true,
                is3D: true,
                isDots: true,
                isEraser: true,
            }),
        );
        expect(h.manager.setPaintTool).toHaveBeenCalledTimes(1);
        await act(async () => root.unmount());
        expect(h.manager.setPaintTool).toHaveBeenLastCalledWith(null);
        root = createRoot(container);
    });

    test('color, size, opacity, quality, reset, and history buttons reach the manager', async () => {
        await act(async () => root.render(<MiniScreenDrawHandlersComp />));
        await click('Pick color');
        await click('Size range');
        await click('Opacity range');
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({ color: '#112233fc', size: 9 }),
        );
        await click('Toggle drawing quality');
        expect(h.manager.setRenderQuality).toHaveBeenCalledWith(false);
        await click('Undo');
        await click('Redo');
        await click('Clear drawing');
        expect(h.manager.undo).toHaveBeenCalledOnce();
        expect(h.manager.redo).toHaveBeenCalledOnce();
        expect(h.manager.clear).toHaveBeenCalledOnce();
        await click('Reset settings');
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({ color: '#ff2d2dff', size: 10 }),
        );
        expect(h.manager.setRenderQuality).toHaveBeenLastCalledWith(true);
    });

    test('shortcuts act only for the focused drawing canvas', async () => {
        await act(async () => root.render(<MiniScreenDrawHandlersComp />));
        await act(async () => h.shortcuts.get('toggleEraser')?.());
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({ isEraser: false }),
        );
        h.manager.isFocused = true;
        await act(async () => h.shortcuts.get('toggleEraser')?.());
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({ isEraser: true }),
        );
        await act(async () => h.shortcuts.get('usePaint')?.());
        expect(h.manager.updatePaintToolParams).toHaveBeenLastCalledWith(
            expect.objectContaining({ isEraser: false }),
        );
        h.manager.isShowing = false;
        await act(async () => h.shortcuts.get('clearDrawing')?.());
        expect(h.manager.clear).not.toHaveBeenCalled();
        h.manager.isShowing = true;
        await act(async () => h.shortcuts.get('clearDrawing')?.());
        expect(h.manager.clear).toHaveBeenCalledOnce();
    });
});
