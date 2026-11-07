// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    selected: [] as [string, { src: string | null }][],
    update: null as null | (() => void),
    manager: null as null | { applyBackgroundSrc: ReturnType<typeof vi.fn> },
    select: vi.fn(),
    toast: vi.fn(),
    transition: vi.fn(),
    extraMenuItems: null as unknown,
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));
vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: {
        getBackgroundSrcListByType: () => state.selected,
        getInstance: () => state.manager,
        handleBackgroundSelecting: state.select,
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: (
        _names: string[],
        _ignored: unknown,
        callback: () => void,
    ) => {
        state.update = callback;
    },
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span>Screen {screenId}</span>
    ),
}));
vi.mock('../others/color/ColorPicker', async () => {
    const { use } = await import('react');
    const { ColorSwatchExtraMenuContext } =
        await import('../others/color/colorSwatchMenuHelpers');
    return {
        default: ({
            color,
            onColorChange,
            onNoColor,
        }: {
            color: string | null;
            onColorChange: (color: string, event: object) => void;
            onNoColor?: () => void;
        }) => {
            // As RenderColorComp: a swatch's right-click asks the panel
            // around it for that colour's extra menu items.
            const genExtraMenuItems = use(ColorSwatchExtraMenuContext) as
                null | ((color: string) => unknown);
            return (
                <div data-color={color ?? 'none'}>
                    <button
                        type="button"
                        className="color-item"
                        aria-label="red"
                        onClick={(event) => onColorChange('#ff0000', event)}
                        onContextMenu={() => {
                            state.extraMenuItems =
                                genExtraMenuItems?.('#ff0000') ?? null;
                        }}
                    >
                        Red
                    </button>
                    {onNoColor ? (
                        <button type="button" onClick={onNoColor}>
                            No Color
                        </button>
                    ) : null}
                </div>
            );
        },
    };
});
vi.mock('../others/color/colorSwatchMenuHelpers', async () => {
    const { createContext } = await import('react');
    return { ColorSwatchExtraMenuContext: createContext(null) };
});
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: state.transition,
}));

import BackgroundColorsComp from './BackgroundColorsComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.selected = [];
    state.update = null;
    state.manager = { applyBackgroundSrc: vi.fn() };
    state.select.mockReset();
    state.toast.mockReset();
    state.transition.mockReset().mockReturnValue([]);
    state.extraMenuItems = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('background color picker', () => {
    it('selects a color for an empty screen set and restores the pressed swatch focus', async () => {
        await act(async () => root.render(<BackgroundColorsComp />));
        expect(host.querySelector('[data-color="none"]')).not.toBeNull();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.select).toHaveBeenCalledWith(expect.any(Object), 'color', {
            src: '#ff0000',
        });

        state.selected = [['2', { src: '#ff0000' }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 2');
        expect(document.activeElement).toBe(host.querySelector('.color-item'));
    });

    it('changes or clears an individual screen and reports a closed screen', async () => {
        state.selected = [['3', { src: '#112233' }]];
        await act(async () => root.render(<BackgroundColorsComp />));
        expect(host.querySelector('[data-color="#112233"]')).not.toBeNull();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith(
            'color',
            { src: '#ff0000' },
        );
        await act(async () =>
            [...host.querySelectorAll('button')]
                .find((button) => button.textContent === 'No Color')!
                .click(),
        );
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith(
            'color',
            { src: null },
        );

        state.manager = null;
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.toast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
    });

    it('a swatch’s right-click offers that colour’s own background transition', async () => {
        state.transition.mockReturnValue([{ menuElement: 'Transition' }]);
        await act(async () => root.render(<BackgroundColorsComp />));
        const openSwatchMenu = () =>
            act(async () => {
                host.querySelector('.color-item')!.dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
        await openSwatchMenu();
        expect(state.transition).toHaveBeenCalledWith('color', '#ff0000');
        expect(state.extraMenuItems).toEqual([{ menuElement: 'Transition' }]);

        // A screen's own picker offers it too.
        state.selected = [['4', { src: '#112233' }]];
        await act(async () => state.update!());
        state.extraMenuItems = null;
        await openSwatchMenu();
        expect(state.transition).toHaveBeenCalledTimes(2);
        expect(state.extraMenuItems).toEqual([{ menuElement: 'Transition' }]);
    });

    it('puts no focus back for a press more than 2 s old', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2026-11-04T10:00:00.000Z'));
            await act(async () => root.render(<BackgroundColorsComp />));
            await act(async () =>
                host.querySelector<HTMLButtonElement>('.color-item')!.click(),
            );
            // Some other change to a screen, long after the press.
            vi.setSystemTime(new Date('2026-11-04T10:00:02.001Z'));
            state.selected = [['2', { src: '#ff0000' }]];
            await act(async () => state.update!());
            expect(host.textContent).toContain('Screen 2');
            expect(document.activeElement).toBe(document.body);
        } finally {
            vi.useRealTimers();
        }
    });

    it('leaves the keyboard where the user moved it, yet keeps the press for its window', async () => {
        const elsewhere = document.createElement('input');
        document.body.append(elsewhere);
        await act(async () => root.render(<BackgroundColorsComp />));
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        elsewhere.focus();
        state.selected = [['2', { src: '#ff0000' }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 2');
        expect(document.activeElement).toBe(elsewhere);

        // The swap can come in a later render: once the keyboard is back on
        // the page, the pressed swatch still gets it.
        elsewhere.blur();
        state.selected = [
            ['2', { src: '#ff0000' }],
            ['3', { src: '#00ff00' }],
        ];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 3');
        expect(document.activeElement).toBe(host.querySelector('.color-item'));
        elsewhere.remove();
    });
});
