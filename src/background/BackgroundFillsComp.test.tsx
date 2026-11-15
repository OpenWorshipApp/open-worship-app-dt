// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PresetsPropsType = {
    canSave?: boolean;
    builtIns: unknown[];
    readCurrent: () => { src: string };
    onSavedPick: (preset: { src: string }, event: object) => void;
    genSavedChipColors: (preset: {
        src: string;
    }) => { color: string; backgroundColor: string } | null;
    genSavedMenuItems: (preset: {
        src: string;
    }) => { menuElement: string; onSelect: () => void }[];
    toSavedPreset: (
        item: Record<string, unknown>,
        base: { id: string; name: string },
    ) => unknown;
    savedSettingName: string;
};

const state = vi.hoisted(() => ({
    selected: [] as [string, { src: string | null }][],
    update: null as null | (() => void),
    manager: null as null | {
        applyBackgroundSrc: ReturnType<typeof vi.fn>;
        backgroundSrc: { type: string; src: string | null } | null;
    },
    select: vi.fn(),
    toast: vi.fn(),
    transition: vi.fn(),
    contextMenu: vi.fn(),
    copied: vi.fn(),
    dragged: vi.fn(),
    extraMenuItems: null as unknown,
    presets: [] as PresetsPropsType[],
    settings: new Map<string, string>(),
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
// A screen's fold and its Customize are remembered as settings: a map here.
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (
            settingName: string,
            defaultValue?: boolean,
        ) => {
            const [value, setValue] = useState(() => {
                const stored = state.settings.get(settingName);
                return stored === undefined
                    ? !!defaultValue
                    : stored === 'true';
            });
            const setSettingValue = (
                next: boolean | ((previous: boolean) => boolean),
            ) => {
                const newValue =
                    typeof next === 'function' ? next(value) : next;
                state.settings.set(settingName, `${newValue}`);
                setValue(newValue);
            };
            return [value, setSettingValue];
        },
    };
});
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: (event: {
        key: string;
        currentTarget: HTMLElement;
    }) => {
        if (event.key === 'Enter') {
            event.currentTarget.click();
            return true;
        }
        return false;
    },
}));
vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    serializeForDragging: state.dragged,
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onClick: (event: object) => void) => [
        { menuElement: 'Show on Screens', onSelect: onClick },
    ],
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.contextMenu,
}));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: state.copied }));
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
// The saved fills' row reads and writes settings; its own suite covers it.
// Here only what the Fills tab hands it matters.
vi.mock('../others/PresetsRowComp', () => ({
    default: (props: PresetsPropsType) => {
        state.presets.push(props);
        return (
            <button
                type="button"
                className="presets-save"
                disabled={props.canSave === false}
            >
                Save
            </button>
        );
    },
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
            tone,
            isOtherValueHeld,
        }: {
            color: string | null;
            onColorChange: (color: string, event: object) => void;
            onNoColor?: (color: null, event: object) => void;
            tone?: string;
            isOtherValueHeld?: boolean;
        }) => {
            // As RenderColorComp: a swatch's right-click asks the panel
            // around it for that colour's extra menu items.
            const genExtraMenuItems = use(ColorSwatchExtraMenuContext) as
                null | ((color: string) => unknown);
            return (
                <div
                    data-color={color ?? 'none'}
                    data-tone={tone ?? 'own'}
                    data-other-held={String(isOtherValueHeld === true)}
                >
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
                        <button
                            type="button"
                            onClick={(event) => onNoColor(null, event)}
                        >
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

import BackgroundFillsComp from './BackgroundFillsComp';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';

const NAVY_GRADIENT = 'gradient?shape=linear&angle=180&colors=0F172A-1E3A8A';
const PALE_GRADIENT = 'gradient?shape=linear&angle=180&colors=FEF9C3-FFEDD5';
const DARK_DOTS = 'pattern?name=dots&base=172554&ink=FFFFFF26&size=24';

let host: HTMLDivElement;
let root: Root;

// A tile carries no src of its own in the DOM, so a test finds it by the
// name it is read by.
function findTileByLabel(label: string) {
    return host.querySelector<HTMLElement>(`.fill-tile[aria-label="${label}"]`);
}

function findButton(text: string) {
    return [...host.querySelectorAll('button')].find((button) => {
        return button.textContent === text;
    });
}

function changeInput(
    input: HTMLInputElement | HTMLSelectElement,
    value: string,
) {
    const prototype =
        input instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
        input,
        value,
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastPresets() {
    return state.presets.at(-1)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.selected = [];
    state.update = null;
    state.manager = { applyBackgroundSrc: vi.fn(), backgroundSrc: null };
    state.select.mockReset();
    state.toast.mockReset();
    state.transition.mockReset().mockReturnValue([]);
    state.contextMenu.mockReset();
    state.copied.mockReset();
    state.dragged.mockReset();
    state.extraMenuItems = null;
    state.presets = [];
    state.settings.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the Fills tab', () => {
    it('selects a color for an empty screen set and restores the pressed swatch focus', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(host.querySelector('[data-color="none"]')).not.toBeNull();
        // One switch for the whole tab: the colour picker draws none.
        expect(host.querySelector('[data-tone="dark"]')).not.toBeNull();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.select).toHaveBeenCalledWith(expect.any(Object), 'fill', {
            src: '#ff0000',
        });

        state.selected = [['2', { src: '#ff0000' }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 2');
        expect(document.activeElement).toBe(host.querySelector('.color-item'));
    });

    it('changes or clears an individual screen and reports a closed screen', async () => {
        state.selected = [['3', { src: '#112233' }]];
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(host.querySelector('[data-color="#112233"]')).not.toBeNull();
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith('fill', {
            src: '#ff0000',
        });
        await act(async () => findButton('No Color')!.click());
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith('fill', {
            src: null,
        });

        state.manager = null;
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        expect(state.toast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
    });

    it('offers No Color only on a screen that holds a fill', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findButton('No Color')).toBeUndefined();
    });

    it('a swatch’s right-click offers that colour’s own background transition', async () => {
        state.transition.mockReturnValue([{ menuElement: 'Transition' }]);
        await act(async () => root.render(<BackgroundFillsComp />));
        const openSwatchMenu = () =>
            act(async () => {
                host.querySelector('.color-item')!.dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
        await openSwatchMenu();
        expect(state.transition).toHaveBeenCalledWith('fill', '#ff0000');
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
        vi.setSystemTime(new Date('2026-11-04T10:00:00.000Z'));
        await act(async () => root.render(<BackgroundFillsComp />));
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.color-item')!.click(),
        );
        // Some other change to a screen, long after the press.
        vi.setSystemTime(new Date('2026-11-04T10:00:02.001Z'));
        state.selected = [['2', { src: '#ff0000' }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 2');
        expect(document.activeElement).toBe(document.body);
    });

    it('leaves the keyboard where the user moved it, yet keeps the press for its window', async () => {
        const elsewhere = document.createElement('input');
        document.body.append(elsewhere);
        await act(async () => root.render(<BackgroundFillsComp />));
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

describe('gradients and patterns', () => {
    it('a tile press goes to the chosen screens, and its focus comes back after the swap', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const tiles = host.querySelectorAll<HTMLElement>('.fill-tile');
        // Eight gradients and six patterns on the dark side.
        expect(tiles).toHaveLength(14);
        const label = '180° #0F172A → #1E3A8A';
        const tile = findTileByLabel(label)!;
        expect(tile.getAttribute('aria-pressed')).toBe('false');
        expect(tile.className).toContain('is-dark');
        await act(async () => tile.click());
        expect(state.select).toHaveBeenCalledWith(expect.any(Object), 'fill', {
            src: NAVY_GRADIENT,
        });

        state.selected = [['2', { src: NAVY_GRADIENT }]];
        await act(async () => state.update!());
        const heldTile = findTileByLabel(label)!;
        expect(heldTile.getAttribute('aria-pressed')).toBe('true');
        expect(heldTile.querySelector('.bi-check-lg')).not.toBeNull();
        expect(document.activeElement).toBe(heldTile);
        // A gradient is held: no colour swatch is, and No Color is not lit.
        expect(host.querySelector('[data-color="none"]')).not.toBeNull();
        expect(host.querySelector('[data-other-held="true"]')).not.toBeNull();
    });

    it('a tile that moves on a screen carries a still mark, and drags and right-clicks as a fill', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const moving = findTileByLabel(
            'Grid #FFFFFF1A / #18181B (Speed: Slow)',
        )!;
        expect(moving.querySelector('.fill-tile-motion')).not.toBeNull();
        expect(
            findTileByLabel('Dots #FFFFFF26 / #172554')!.querySelector(
                '.fill-tile-motion',
            ),
        ).toBeNull();

        moving.dispatchEvent(new Event('dragstart', { bubbles: true }));
        expect(state.dragged).toHaveBeenCalledWith(
            expect.any(Object),
            'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
        );

        state.transition.mockReturnValue([{ menuElement: 'Transition' }]);
        await act(async () => {
            moving.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const [, items] = state.contextMenu.mock.calls[0];
        expect(
            items.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['Copy CSS', 'Show on Screens', 'Transition']);
        expect(state.transition).toHaveBeenCalledWith(
            'fill',
            'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
        );
        // Its CSS, motion and all, built only once the row is chosen.
        expect(state.copied).not.toHaveBeenCalled();
        items[0].onSelect();
        expect(state.copied).toHaveBeenCalledWith(
            expect.stringContaining(
                'animation: owa-fill-drift 5.33s linear infinite;',
            ),
            'Copy CSS',
        );
        items[1].onSelect({ type: 'menu' });
        expect(state.select).toHaveBeenCalledWith(
            { type: 'menu' },
            'fill',
            {
                src: 'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
            },
            true,
        );
    });

    it('Enter presses a tile as a click does', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const tile = findTileByLabel('Dots #FFFFFF26 / #172554')!;
        await act(async () => {
            tile.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(state.select).toHaveBeenCalledWith(expect.any(Object), 'fill', {
            src: DARK_DOTS,
        });
    });

    it('one Dark / Light switch swaps the colour tones, gradients and patterns together', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findTileByLabel('180° #FEF9C3 → #FFEDD5')).toBeNull();
        await act(async () => findButton('Light')!.click());
        expect(host.querySelector('[data-tone="light"]')).not.toBeNull();
        const paleTile = findTileByLabel('180° #FEF9C3 → #FFEDD5')!;
        expect(paleTile.className).not.toContain('is-dark');
        expect(findTileByLabel('180° #0F172A → #1E3A8A')).toBeNull();
    });

    it('a screen holding a pale fill opens on the light side', async () => {
        state.selected = [['1', { src: PALE_GRADIENT }]];
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(host.querySelector('[data-tone="light"]')).not.toBeNull();
        expect(
            findTileByLabel('180° #FEF9C3 → #FFEDD5')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
    });
});

describe('Customize', () => {
    function mountHeld(src: string) {
        state.selected = [['5', { src }]];
        state.manager!.backgroundSrc = { type: 'fill', src };
        return act(async () => root.render(<BackgroundFillsComp />));
    }

    function readAngleInput() {
        return host.querySelector<HTMLInputElement>(
            '.fill-editor input[type="range"][aria-label="Angle"]',
        )!;
    }

    it('is offered for a held gradient or pattern, never for a colour or the chosen screens', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(host.querySelector('.fill-editor')).toBeNull();
        state.selected = [['5', { src: '#112233' }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 5');
        expect(host.querySelector('.fill-editor')).toBeNull();
        state.selected = [['5', { src: NAVY_GRADIENT }]];
        await act(async () => state.update!());
        expect(host.querySelector('.fill-editor')).not.toBeNull();
    });

    it('puts a change up after a pause, as one screen change for a whole drag', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        await act(async () => changeInput(readAngleInput(), '90'));
        await act(async () => changeInput(readAngleInput(), '45'));
        expect(apply).not.toHaveBeenCalled();
        // Until it has gone up, the screen still holds the tile it held.
        expect(
            findTileByLabel('180° #0F172A → #1E3A8A')!.getAttribute(
                'aria-pressed',
            ),
        ).toBe('true');
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).toHaveBeenCalledExactlyOnceWith('fill', {
            src: 'gradient?shape=linear&angle=45&colors=0F172A-1E3A8A',
        });
    });

    it('never sends the fill the screen already holds — that would take it down', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        await act(async () => changeInput(readAngleInput(), '90'));
        // Meanwhile the screen got that very fill some other way.
        state.manager!.backgroundSrc = {
            type: 'fill',
            src: 'gradient?shape=linear&angle=90&colors=0F172A-1E3A8A',
        };
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).not.toHaveBeenCalled();
    });

    it('drops a change once the screen no longer holds a fill', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        await act(async () => changeInput(readAngleInput(), '90'));
        state.manager!.backgroundSrc = { type: 'image', src: 'file://a.png' };
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).not.toHaveBeenCalled();
    });

    it('a press wins over a change still waiting', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        await act(async () => changeInput(readAngleInput(), '90'));
        await act(async () =>
            findTileByLabel('Dots #FFFFFF26 / #172554')!.click(),
        );
        expect(apply).toHaveBeenCalledExactlyOnceWith('fill', {
            src: DARK_DOTS,
        });
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(apply).toHaveBeenCalledOnce();
    });

    it('puts a waiting change up when the tab closes', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        await act(async () => changeInput(readAngleInput(), '30'));
        await act(async () => root.unmount());
        expect(apply).toHaveBeenCalledExactlyOnceWith('fill', {
            src: 'gradient?shape=linear&angle=30&colors=0F172A-1E3A8A',
        });
        root = createRoot(host);
    });

    it('keeps the draft under the pointer while its change is on the way up', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        const at90 = 'gradient?shape=linear&angle=90&colors=0F172A-1E3A8A';
        await act(async () => changeInput(readAngleInput(), '90'));
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).toHaveBeenCalledExactlyOnceWith('fill', { src: at90 });
        state.manager!.backgroundSrc = { type: 'fill', src: at90 };
        // The next change is made before the screen says it holds the first.
        await act(async () => changeInput(readAngleInput(), '45'));
        state.selected = [['5', { src: at90 }]];
        await act(async () => state.update!());
        expect(readAngleInput().value).toBe('45');
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).toHaveBeenLastCalledWith('fill', {
            src: 'gradient?shape=linear&angle=45&colors=0F172A-1E3A8A',
        });
    });

    it('follows the screen once nothing is waiting', async () => {
        await mountHeld(NAVY_GRADIENT);
        state.selected = [
            [
                '5',
                { src: 'gradient?shape=linear&angle=10&colors=0F172A-1E3A8A' },
            ],
        ];
        await act(async () => state.update!());
        expect(readAngleInput().value).toBe('10');
    });

    it('changes a gradient part by part', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        const flush = async () => {
            await act(async () => {
                vi.advanceTimersByTime(500);
            });
            const src = apply.mock.lastCall![1].src;
            // What went up is what the screen holds now.
            state.manager!.backgroundSrc = { type: 'fill', src };
            return src;
        };
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('[aria-label="Add: Color"]')!
                .click(),
        );
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=0F172A-1E3A8A-1E3A8A',
        );
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="color"][aria-label="Color 3"]',
                )!,
                '#ff0000',
            ),
        );
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=0F172A-1E3A8A-FF0000',
        );
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Remove: Color 1"]',
                )!
                .click(),
        );
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=1E3A8A-FF0000',
        );
        // Two colours are the fewest a gradient has.
        expect(host.querySelector('[aria-label="Remove: Color 1"]')).toBeNull();
        await act(async () => findButton('Radial')!.click());
        expect(await flush()).toBe(
            'gradient?shape=radial&angle=180&colors=1E3A8A-FF0000',
        );
        // A radial gradient has no angle to set.
        expect(host.querySelector('[aria-label="Angle"]')).toBeNull();
        await act(async () => findButton('Fast')!.click());
        expect(await flush()).toBe(
            'gradient?shape=radial&angle=180&colors=1E3A8A-FF0000&motion=fast',
        );
        // Pressing the speed that is on changes nothing.
        await act(async () => findButton('Fast')!.click());
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(apply).toHaveBeenCalledTimes(5);
    });

    it('lets each of a gradient’s colours be see-through, its well drawn as faint as it is', async () => {
        vi.useFakeTimers();
        await mountHeld(NAVY_GRADIENT);
        const apply = state.manager!.applyBackgroundSrc;
        const flush = async () => {
            await act(async () => {
                vi.advanceTimersByTime(500);
            });
            const src = apply.mock.lastCall![1].src;
            state.manager!.backgroundSrc = { type: 'fill', src };
            return src;
        };
        const readOpacity = (label: string) => {
            return host.querySelector<HTMLInputElement>(
                `input[type="range"][aria-label="Opacity: ${label}"]`,
            )!;
        };
        const readWell = (label: string) => {
            return host.querySelector<HTMLInputElement>(
                `input[type="color"][aria-label="${label}"]`,
            )!;
        };
        // A solid colour is all there: its well drawn whole.
        expect(readOpacity('Color 2').value).toBe('255');
        expect(readWell('Color 2').style.opacity).toBe('1');
        await act(async () => changeInput(readOpacity('Color 2'), '51'));
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=0F172A-1E3A8A33',
        );
        expect(readWell('Color 2').style.opacity).toBe('0.2');
        // A new colour from the well keeps how see-through it was.
        await act(async () => changeInput(readWell('Color 2'), '#ff0000'));
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=0F172A-FF000033',
        );
        // The first colour is untouched by the second's.
        expect(readOpacity('Color 1').value).toBe('255');
        // All the way back is six digits again: the same colour as before.
        await act(async () => changeInput(readOpacity('Color 2'), '255'));
        expect(await flush()).toBe(
            'gradient?shape=linear&angle=180&colors=0F172A-FF0000',
        );
    });

    it('changes a pattern part by part, its tint keeping its see-through', async () => {
        vi.useFakeTimers();
        await mountHeld(DARK_DOTS);
        const apply = state.manager!.applyBackgroundSrc;
        const flush = async () => {
            await act(async () => {
                vi.advanceTimersByTime(500);
            });
            const src = apply.mock.lastCall![1].src;
            state.manager!.backgroundSrc = { type: 'fill', src };
            return src;
        };
        await act(async () =>
            changeInput(
                host.querySelector<HTMLSelectElement>(
                    'select[aria-label="Patterns"]',
                )!,
                'zigzag',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=172554&ink=FFFFFF26&size=24',
        );
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="color"][aria-label="Color"]',
                )!,
                '#00ff00',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=172554&ink=00FF0026&size=24',
        );
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="color"][aria-label="Background Color"]',
                )!,
                '#000000',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=000000&ink=00FF0026&size=24',
        );
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="range"][aria-label="Opacity: Color"]',
                )!,
                '128',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=000000&ink=00FF0080&size=24',
        );
        // The background colour lets the screen show through as well.
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="range"][aria-label="Opacity: Background Color"]',
                )!,
                '0',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=00000000&ink=00FF0080&size=24',
        );
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="range"][aria-label="Size"]',
                )!,
                '64',
            ),
        );
        expect(await flush()).toBe(
            'pattern?name=zigzag&base=00000000&ink=00FF0080&size=64',
        );
    });
});

describe('a screen’s own picker', () => {
    function findFolds() {
        return [
            ...host.querySelectorAll<HTMLButtonElement>('.fill-picker-fold'),
        ];
    }

    function findCustomizeToggles() {
        return [
            ...host.querySelectorAll<HTMLButtonElement>(
                '.fill-picker-customize',
            ),
        ];
    }

    function findPickers() {
        return [...host.querySelectorAll<HTMLElement>('.fill-picker')];
    }

    // As the page reads a colour back: what the screen's badge wears.
    function toDrawnColor(color: string) {
        const probe = document.createElement('span');
        probe.style.color = color;
        return probe.style.color;
    }

    it('folds to its line, its badge kept, in the screen’s own colour, and remembers it for that screen', async () => {
        state.selected = [
            ['0', { src: NAVY_GRADIENT }],
            ['1', { src: '#112233' }],
        ];
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findFolds()).toHaveLength(2);
        expect(findFolds()[0].getAttribute('aria-expanded')).toBe('true');
        expect(findFolds()[0].getAttribute('aria-label')).toBe(
            'Collapse: Screen 0',
        );
        expect(findFolds()[0].style.color).toBe(
            toDrawnColor(genColorFromScreenId(0)),
        );
        expect(findFolds()[1].style.color).toBe(
            toDrawnColor(genColorFromScreenId(1)),
        );
        expect(findFolds()[0].style.color).not.toBe(findFolds()[1].style.color);

        await act(async () => findFolds()[0].click());
        const [folded, open] = findPickers();
        expect(folded.querySelector('.fill-tile, .color-item')).toBeNull();
        expect(folded.querySelector('[data-tone]')).toBeNull();
        expect(folded.textContent).toContain('Screen 0');
        expect(
            folded.querySelector('.fill-picker-held')!.getAttribute('title'),
        ).toContain('#0F172A');
        expect(findFolds()[0].getAttribute('aria-expanded')).toBe('false');
        expect(findFolds()[0].getAttribute('aria-label')).toBe(
            'Expand: Screen 0',
        );
        expect(open.querySelector('.color-item')).not.toBeNull();
        expect(open.querySelector('.fill-picker-held')).toBeNull();
        expect(state.settings.get('background-fill-folded-0')).toBe('true');
        expect(state.settings.has('background-fill-folded-1')).toBe(false);

        // Drawn again, screen 0 is still folded and screen 1 still open.
        await act(async () => root.unmount());
        root = createRoot(host);
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findFolds()[0].getAttribute('aria-expanded')).toBe('false');
        expect(findFolds()[1].getAttribute('aria-expanded')).toBe('true');

        await act(async () => findFolds()[0].click());
        expect(findPickers()[0].querySelector('.fill-tile')).not.toBeNull();
        expect(state.settings.get('background-fill-folded-0')).toBe('false');
    });

    it('a change still waiting goes up though the picker folds under it', async () => {
        vi.useFakeTimers();
        state.selected = [['0', { src: NAVY_GRADIENT }]];
        state.manager!.backgroundSrc = { type: 'fill', src: NAVY_GRADIENT };
        await act(async () => root.render(<BackgroundFillsComp />));
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    '.fill-editor input[type="range"][aria-label="Angle"]',
                )!,
                '90',
            ),
        );
        await act(async () => findFolds()[0].click());
        expect(state.manager!.applyBackgroundSrc).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(500));
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith('fill', {
            src: expect.stringContaining('angle=90'),
        });
    });

    it('opens and closes Customize from the gradients’ line, the saved fills staying under the patterns, and remembers it for that screen', async () => {
        state.selected = [
            ['0', { src: NAVY_GRADIENT }],
            ['1', { src: DARK_DOTS }],
        ];
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findCustomizeToggles()).toHaveLength(2);
        expect(findCustomizeToggles()[0].getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(
            findCustomizeToggles()[0].closest('.fill-picker-head')!.textContent,
        ).toContain('Gradients');
        expect(host.querySelectorAll('.fill-editor')).toHaveLength(2);

        // The saved fills are in the tiles' box, Customize in one of its own.
        const [firstBoxes, secondBoxes] = findPickers().map((picker) => {
            return [...picker.querySelectorAll('.fill-picker-box')];
        });
        expect(firstBoxes).toHaveLength(2);
        expect(firstBoxes[0].querySelector('.fill-tile')).not.toBeNull();
        expect(firstBoxes[0].querySelector('.presets-save')).not.toBeNull();
        expect(firstBoxes[1].querySelector('.fill-editor')).not.toBeNull();
        expect(firstBoxes[1].querySelector('.presets-save')).toBeNull();
        expect(secondBoxes).toHaveLength(2);

        await act(async () => findCustomizeToggles()[0].click());
        const [closed, open] = findPickers();
        expect(closed.querySelector('.fill-editor')).toBeNull();
        expect(closed.querySelectorAll('.fill-picker-box')).toHaveLength(1);
        expect(closed.querySelector('.presets-save')).not.toBeNull();
        expect(open.querySelector('.fill-editor')).not.toBeNull();
        expect(findCustomizeToggles()[0].getAttribute('aria-pressed')).toBe(
            'false',
        );
        expect(state.settings.get('background-fill-customize-closed-0')).toBe(
            'true',
        );

        // Drawn again, it is still closed.
        await act(async () => root.unmount());
        root = createRoot(host);
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findPickers()[0].querySelector('.fill-editor')).toBeNull();
        expect(findPickers()[1].querySelector('.fill-editor')).not.toBeNull();

        // A colour has nothing to customize: no toggle, and no box for it.
        state.selected = [
            ['0', { src: '#112233' }],
            ['1', { src: DARK_DOTS }],
        ];
        await act(async () => state.update!());
        expect(findCustomizeToggles()).toHaveLength(1);
        expect(
            findPickers()[0].querySelectorAll('.fill-picker-box'),
        ).toHaveLength(1);
    });

    it('the one picker for the chosen screens neither folds nor closes', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(findFolds()).toHaveLength(0);
        expect(findCustomizeToggles()).toHaveLength(0);
        expect(host.querySelectorAll('.fill-picker-box')).toHaveLength(1);
        expect(
            host.querySelector('.fill-picker-box .presets-save'),
        ).not.toBeNull();
    });
});

describe('saved fills', () => {
    it('saves only while there is a fill to save', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(lastPresets().canSave).toBe(false);
        expect(lastPresets().builtIns).toEqual([]);
        expect(lastPresets().savedSettingName).toBe('background-fill-presets');
        expect(
            host.querySelector<HTMLButtonElement>('.presets-save')!.disabled,
        ).toBe(true);

        state.selected = [['1', { src: DARK_DOTS }]];
        await act(async () => state.update!());
        expect(lastPresets().canSave).toBe(true);
        expect(lastPresets().readCurrent()).toEqual({ src: DARK_DOTS });
    });

    it('saves what Customize shows, before it has gone up', async () => {
        vi.useFakeTimers();
        state.selected = [['5', { src: NAVY_GRADIENT }]];
        state.manager!.backgroundSrc = { type: 'fill', src: NAVY_GRADIENT };
        await act(async () => root.render(<BackgroundFillsComp />));
        await act(async () =>
            changeInput(
                host.querySelector<HTMLInputElement>(
                    'input[type="range"][aria-label="Angle"]',
                )!,
                '12',
            ),
        );
        expect(lastPresets().readCurrent()).toEqual({
            src: 'gradient?shape=linear&angle=12&colors=0F172A-1E3A8A',
        });
    });

    it('a saved colour is saved as its code', async () => {
        state.selected = [['1', { src: '#abc' }]];
        await act(async () => root.render(<BackgroundFillsComp />));
        expect(lastPresets().readCurrent()).toEqual({ src: '#AABBCC' });
    });

    it('a saved fill goes up as a press does, wherever the press would go', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const event = { type: 'click' };
        await act(async () => {
            lastPresets().onSavedPick({ src: DARK_DOTS }, event);
        });
        expect(state.select).toHaveBeenCalledWith(event, 'fill', {
            src: DARK_DOTS,
        });

        state.selected = [['1', { src: '#112233' }]];
        await act(async () => state.update!());
        await act(async () => {
            lastPresets().onSavedPick({ src: NAVY_GRADIENT }, event);
        });
        expect(state.manager!.applyBackgroundSrc).toHaveBeenCalledWith('fill', {
            src: NAVY_GRADIENT,
        });
    });

    it('draws a saved chip in its own fill, its words in the colour that reads on it', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const { genSavedChipColors, toSavedPreset } = lastPresets();
        expect(genSavedChipColors({ src: NAVY_GRADIENT })).toEqual({
            color: '#FFFFFF',
            backgroundColor: expect.stringContaining('linear-gradient'),
        });
        expect(genSavedChipColors({ src: PALE_GRADIENT })!.color).toBe(
            '#000000',
        );
        expect(genSavedChipColors({ src: 'url(x)' })).toBeNull();
        // Read off disk: kept in its one form, junk dropped.
        expect(
            toSavedPreset({ src: '#abc' }, { id: 'a', name: 'Mine' }),
        ).toEqual({ id: 'a', name: 'Mine', src: '#AABBCC' });
        expect(
            toSavedPreset({ src: 'url(x)' }, { id: 'b', name: 'Bad' }),
        ).toBeNull();
    });

    it('a saved fill’s right-click copies its CSS, as a tile’s does', async () => {
        await act(async () => root.render(<BackgroundFillsComp />));
        const items = lastPresets().genSavedMenuItems({ src: NAVY_GRADIENT });
        expect(
            items.map((item) => {
                return item.menuElement;
            }),
        ).toEqual(['Copy CSS']);
        items[0].onSelect();
        expect(state.copied).toHaveBeenCalledWith(
            'background-color: #0F172A;\n' +
                'background-image: linear-gradient(180deg, #0F172A, #1E3A8A);',
            'Copy CSS',
        );
        expect(lastPresets().genSavedMenuItems({ src: 'url(x)' })).toEqual([]);
    });
});
