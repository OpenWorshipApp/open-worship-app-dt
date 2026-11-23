// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PresetsPropsType = {
    canSave?: boolean;
    readCurrent: () => { src: string };
    onSavedPick: (preset: { src: string }, event: object) => void;
    genSavedChipColors: (preset: {
        src: string;
    }) => { color: string; backgroundColor: string } | null;
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
    contextMenu: vi.fn(),
    copied: vi.fn(),
    dragStart: vi.fn(),
    presets: [] as PresetsPropsType[],
    previews: [] as { src: string; isMoving: boolean }[],
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
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (settingName: string) => {
            return state.settings.get(settingName) ?? null;
        },
        setSetting: (settingName: string, value: string | null) => {
            state.settings.set(settingName, value ?? '');
        },
        useStateSettingBoolean: (settingName: string) => {
            const [value, setValue] = useState(() => {
                return state.settings.get(settingName) === 'true';
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
vi.mock('../helper/helpers', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    pressElementLikeButton: () => false,
}));
vi.mock('../helper/dragHelpers', () => ({ handleDragStart: state.dragStart }));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onClick: (event: object) => void) => [
        { menuElement: 'Show on Screens', onSelect: onClick },
    ],
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.contextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
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
// What a tile draws has its own suites; here only what it is handed.
vi.mock('./AnimationPreviewComp', () => ({
    default: (props: { src: string; isMoving?: boolean }) => {
        state.previews.push({ src: props.src, isMoving: !!props.isMoving });
        return <span data-preview={props.src} />;
    },
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: () => [{ menuElement: 'Transition' }],
}));
// The robot reads the AI switch from the main process: not this test's.
vi.mock('./AnimationChatbotButtonComp', () => ({ default: () => null }));
vi.mock('./AnimationCodeEditorComp', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-code-editor>
            <button type="button" onClick={onClose}>
                Close Code
            </button>
        </div>
    ),
}));

// The session strip and the slide show are their own modules' to test:
// here what the tab hands them, and the saved list each session hands its
// pickers.
const frame = vi.hoisted(() => ({
    sessionId: '',
    frames: [] as { kind: string; isShowing: boolean; activeId: string }[],
    syncs: [] as [string, number][],
}));
vi.mock('./PaintTabFrameComp', () => ({
    default: ({ kind, session, isShowing, children }: any) => {
        frame.frames.push({ kind, isShowing, activeId: session.activeId });
        return (
            <div data-frame={kind} data-showing={`${isShowing}`}>
                {children}
            </div>
        );
    },
    usePaintSessionStrip: () => ({
        activeId: frame.sessionId,
        suffix: frame.sessionId === '' ? '' : `-${frame.sessionId}`,
        element: null,
    }),
}));
vi.mock('./BackgroundPaintAutoPlayComp', () => ({
    useBackgroundPaintAutoPlaySync: (kind: string, count: number) => {
        frame.syncs.push([kind, count]);
    },
}));

import BackgroundAnimationsComp from './BackgroundAnimationsComp';
import { listAnimationCategorySamples } from './animationBuiltInHelpers';
import { parseAnimation } from './animationValueHelpers';

const SUNDAY = listAnimationCategorySamples('sunday-worship');
const CHRISTMAS = listAnimationCategorySamples('christmas');
// The Easter sunrise there has always been, now Resurrection Day's.
const SUNRISE = listAnimationCategorySamples('resurrection-day').glsl.find(
    (sample) => {
        return sample.animation.name === 'sunrise';
    },
)!;
const SUNRISE_LABEL = 'Resurrection Day - Sunrise';
const PIN_SETTING_NAME = 'background-animation-pins';
const CATEGORY_SETTING_NAME = 'background-animation-presets-category';

let host: HTMLDivElement;
let root: Root;

function tiles(sectionLabel: string) {
    const section = host.querySelector(
        `.fill-picker-section[aria-label="${sectionLabel}"]`,
    );
    return [
        ...(section?.querySelectorAll<HTMLElement>(
            '.animation-tile[role="button"]',
        ) ?? []),
    ];
}

function findTile(label: string) {
    return host.querySelector<HTMLElement>(
        `.animation-tile[role="button"][aria-label="${label}"]`,
    );
}

function findPinButton(label: string) {
    return host.querySelector<HTMLButtonElement>(
        `.animation-tile-pin[aria-label="${label}"]`,
    );
}

function readCategorySelect() {
    return host.querySelector<HTMLSelectElement>(
        '.animation-picker-category select',
    )!;
}

async function chooseCategory(category: string) {
    const select = readCategorySelect();
    await act(async () => {
        select.value = category;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function readPinnedSrcList() {
    return (
        JSON.parse(state.settings.get(PIN_SETTING_NAME) ?? '[]') as {
            src: string;
        }[]
    ).map((pin) => {
        return pin.src;
    });
}

function findButton(text: string) {
    return [...host.querySelectorAll('button')].find((button) => {
        return button.textContent?.trim() === text;
    });
}

async function render() {
    await act(async () => {
        root.render(<BackgroundAnimationsComp />);
    });
}

beforeEach(() => {
    frame.sessionId = '';
    frame.frames = [];
    frame.syncs = [];
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.selected = [];
    state.update = null;
    state.manager = { applyBackgroundSrc: vi.fn(), backgroundSrc: null };
    state.select.mockReset();
    state.toast.mockReset();
    state.contextMenu.mockReset();
    state.copied.mockReset();
    state.dragStart.mockReset();
    state.presets = [];
    state.previews = [];
    state.settings.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('BackgroundAnimationsComp', () => {
    it("offers a category's samples of both kinds, still, to the screens chosen", async () => {
        await render();
        // Sunday Worship until another is chosen.
        expect(readCategorySelect().value).toBe('sunday-worship');
        expect(tiles('CSS Animations')).toHaveLength(SUNDAY.css.length);
        expect(tiles('GLSL Shaders')).toHaveLength(SUNDAY.glsl.length);
        // The shaders first, the CSS animations under them (the user: _move
        // the css top section to the bottom_).
        expect(
            [...host.querySelectorAll('.fill-picker-section')].map(
                (section) => {
                    return section.getAttribute('aria-label');
                },
            ),
        ).toEqual(['GLSL Shaders', 'CSS Animations']);
        // Each captioned with its effect: the Category names the rest.
        expect(
            tiles('CSS Animations')[0].parentElement!.querySelector(
                '.animation-tile-caption',
            )?.textContent,
        ).toBe('Breathe');
        expect(tiles('CSS Animations')[0].getAttribute('aria-label')).toBe(
            'Sunday Worship - Breathe',
        );
        expect(tiles('Pinned')).toHaveLength(0);
        // Nothing moves at rest.
        expect(
            state.previews.some((preview) => {
                return preview.isMoving;
            }),
        ).toBe(false);
        // No screen holds one: nothing to customize, nothing to save.
        expect(host.querySelector('.fill-picker-customize')).toBeNull();
        expect(
            host.querySelector<HTMLButtonElement>('.presets-save')!.disabled,
        ).toBe(true);
        await chooseCategory('resurrection-day');
        const sunriseTile = tiles('GLSL Shaders').find((tile) => {
            return tile.getAttribute('aria-label') === SUNRISE_LABEL;
        })!;
        await act(async () => sunriseTile.click());
        expect(state.select).toHaveBeenCalledWith(
            expect.anything(),
            'animation',
            { src: SUNRISE.src },
        );
    });

    it('gives the keyboard back to the tile pressed, not its namesake of the other kind', async () => {
        await render();
        const label = 'Sunday Worship - Aurora';
        // An effect both kinds draw: a shader tile of the same name sits
        // above, which a label alone would find first.
        expect(
            tiles('GLSL Shaders').some((tile) => {
                return tile.getAttribute('aria-label') === label;
            }),
        ).toBe(true);
        const cssTile = tiles('CSS Animations').find((tile) => {
            return tile.getAttribute('aria-label') === label;
        })!;
        cssTile.focus();
        await act(async () => cssTile.click());
        // The press puts it up: the one picker gives way to the screen's own.
        const aurora = SUNDAY.css.find((sample) => {
            return sample.animation.name === 'aurora';
        })!;
        state.selected = [['0', { src: aurora.src }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 0');
        const focused = document.activeElement as HTMLElement;
        expect(focused.getAttribute('aria-label')).toBe(label);
        expect(
            focused.closest('.fill-picker-section')?.getAttribute('aria-label'),
        ).toBe('CSS Animations');
    });

    it('switches the samples with the Category, and keeps the one chosen', async () => {
        await render();
        await chooseCategory('christmas');
        expect(tiles('CSS Animations')).toHaveLength(CHRISTMAS.css.length);
        expect(tiles('GLSL Shaders')).toHaveLength(CHRISTMAS.glsl.length);
        // Christmas is known by its snow first.
        expect(tiles('CSS Animations')[0].getAttribute('aria-label')).toBe(
            'Christmas - Snowfall',
        );
        expect(
            tiles('CSS Animations').map((tile) => {
                return tile
                    .querySelector('[data-preview]')!
                    .getAttribute('data-preview');
            }),
        ).toEqual(
            CHRISTMAS.css.map((sample) => {
                return sample.src;
            }),
        );
        expect(state.settings.get(CATEGORY_SETTING_NAME)).toBe('christmas');
        // Opened again, it is where it was left.
        await act(async () => root.unmount());
        root = createRoot(host);
        await render();
        expect(readCategorySelect().value).toBe('christmas');
        // Grouped as the list shows them.
        const groups = [
            ...readCategorySelect().querySelectorAll('optgroup'),
        ].map((group) => {
            return group.label;
        });
        expect(groups).toEqual([
            'Services',
            'Church Year',
            'Special Services',
            'Holidays',
            'Seasons',
            'Themes',
        ]);
    });

    it('a pinned animation shows above whichever category is chosen', async () => {
        await render();
        const label = 'Sunday Worship - Breathe';
        expect(findPinButton(`Pin: ${label}`)).not.toBeNull();
        await act(async () => findPinButton(`Pin: ${label}`)!.click());
        expect(readPinnedSrcList()).toEqual([SUNDAY.css[0].src]);
        expect(tiles('Pinned')).toHaveLength(1);
        // Named apart from the category's own tile, and captioned whole.
        expect(findTile(`Pinned: ${label}`)).not.toBeNull();
        expect(findPinButton(`Unpin: ${label}`)).not.toBeNull();
        await chooseCategory('christmas');
        expect(tiles('Pinned')).toHaveLength(1);
        const pinnedTile = findTile(`Pinned: ${label}`)!;
        expect(
            pinnedTile.parentElement!.querySelector('.animation-tile-caption')
                ?.textContent,
        ).toBe(label);
        // Pressed, it goes up, and the Category stays where it is.
        await act(async () => pinnedTile.click());
        expect(state.select).toHaveBeenCalledWith(
            expect.anything(),
            'animation',
            { src: SUNDAY.css[0].src },
        );
        expect(readCategorySelect().value).toBe('christmas');
        expect(state.settings.get(CATEGORY_SETTING_NAME)).toBe('christmas');
        // Unpinned from its own corner, it goes.
        await act(async () => findPinButton(`Unpin: ${label}`)!.click());
        expect(tiles('Pinned')).toHaveLength(0);
        expect(readPinnedSrcList()).toEqual([]);
    });

    it('switches Dark / Light as the Fills do, the pinned ones kept on either side', async () => {
        // 2026-11-19, the user: _`Animations` of background and foreground
        // should support dark/light mode, keep the pin. all category should
        // have dark/light_.
        const sundayLight = listAnimationCategorySamples(
            'sunday-worship',
            'light',
        );
        const previewSrcs = (sectionLabel: string) => {
            return tiles(sectionLabel).map((tile) => {
                return tile
                    .querySelector('[data-preview]')!
                    .getAttribute('data-preview');
            });
        };
        await render();
        expect(findButton('Dark')!.getAttribute('aria-pressed')).toBe('true');
        expect(previewSrcs('GLSL Shaders')).toEqual(
            SUNDAY.glsl.map((sample) => {
                return sample.src;
            }),
        );
        const darkLabel = 'Sunday Worship - Breathe';
        await act(async () => findPinButton(`Pin: ${darkLabel}`)!.click());
        await act(async () => findButton('Light')!.click());
        expect(findButton('Light')!.getAttribute('aria-pressed')).toBe('true');
        expect(previewSrcs('CSS Animations')).toEqual(
            sundayLight.css.map((sample) => {
                return sample.src;
            }),
        );
        expect(previewSrcs('GLSL Shaders')).toEqual(
            sundayLight.glsl.map((sample) => {
                return sample.src;
            }),
        );
        const lightLabel = `${darkLabel} (Light)`;
        expect(tiles('CSS Animations')[0].getAttribute('aria-label')).toBe(
            lightLabel,
        );
        // The Dark pin stays up on the Light side; a Light one joins it.
        expect(findTile(`Pinned: ${darkLabel}`)).not.toBeNull();
        await act(async () => findPinButton(`Pin: ${lightLabel}`)!.click());
        expect(readPinnedSrcList()).toEqual([
            SUNDAY.css[0].src,
            sundayLight.css[0].src,
        ]);
        // Every category has both sides.
        await chooseCategory('christmas');
        expect(previewSrcs('CSS Animations')).toEqual(
            listAnimationCategorySamples('christmas', 'light').css.map(
                (sample) => {
                    return sample.src;
                },
            ),
        );
        await act(async () => findButton('Dark')!.click());
        expect(previewSrcs('CSS Animations')).toEqual(
            CHRISTMAS.css.map((sample) => {
                return sample.src;
            }),
        );
        expect(tiles('Pinned')).toHaveLength(2);
        // A screen holding a Light one opens its own picker on Light.
        await act(async () => findTile(`Pinned: ${lightLabel}`)!.click());
        state.selected = [['0', { src: sundayLight.css[0].src }]];
        await act(async () => state.update!());
        expect(host.textContent).toContain('Screen 0');
        expect(findButton('Light')!.getAttribute('aria-pressed')).toBe('true');
    });

    it('a full pin list says so instead of pinning', async () => {
        state.settings.set(
            PIN_SETTING_NAME,
            JSON.stringify(
                CHRISTMAS.glsl
                    .concat(CHRISTMAS.css)
                    .slice(0, 30)
                    .map((sample, index) => {
                        return { id: `p${index}`, name: 'x', src: sample.src };
                    }),
            ),
        );
        await render();
        expect(tiles('Pinned')).toHaveLength(30);
        const pin = findPinButton('Pin: Sunday Worship - Breathe')!;
        expect(pin.getAttribute('aria-disabled')).toBe('true');
        expect(pin.title).toBe('Unpin one to pin another');
        await act(async () => pin.click());
        expect(readPinnedSrcList()).toHaveLength(30);
        // Its right-click offers no pin either; a pinned one's offers Unpin.
        await act(async () => {
            tiles('CSS Animations')[0].dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(
            (state.contextMenu.mock.calls[0][1] as { menuElement: string }[])
                .map((item) => {
                    return item.menuElement;
                })
                .includes('Pin'),
        ).toBe(false);
        await act(async () => {
            tiles('Pinned')[0].dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const items = state.contextMenu.mock.calls[1][1] as {
            menuElement: string;
            onSelect: () => void;
        }[];
        expect(items[0].menuElement).toBe('Unpin');
        await act(async () => items[0].onSelect());
        expect(readPinnedSrcList()).toHaveLength(29);
    });

    it('moves a tile only under the pointer, and its right-click copies, shows and transitions', async () => {
        await render();
        const tile = tiles('CSS Animations')[0];
        state.previews = [];
        await act(async () => {
            tile.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(state.previews.at(-1)).toEqual({
            src: SUNDAY.css[0].src,
            isMoving: true,
        });
        await act(async () => {
            tile.dispatchEvent(
                new MouseEvent('mouseout', {
                    bubbles: true,
                    relatedTarget: document.body,
                }),
            );
        });
        expect(state.previews.at(-1)?.isMoving).toBe(false);
        await act(async () => {
            tile.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const items = state.contextMenu.mock.calls[0][1] as {
            menuElement: string;
            onSelect: (event?: object) => void;
        }[];
        expect(
            items.map((item) => {
                return item.menuElement;
            }),
        ).toEqual(['Pin', 'Copy Code', 'Show on Screens', 'Transition']);
        items[1].onSelect();
        expect(state.copied.mock.calls[0][0]).toMatch(/^<!DOCTYPE html>/);
        items[2].onSelect({});
        expect(state.select).toHaveBeenCalledWith(
            {},
            'animation',
            { src: SUNDAY.css[0].src },
            true,
        );
        await act(async () => items[0].onSelect());
        expect(readPinnedSrcList()).toEqual([SUNDAY.css[0].src]);
    });

    it('a screen holding one gets its own picker, its sample lit, and Customize goes up after a pause', async () => {
        vi.useFakeTimers();
        state.selected = [['2', { src: SUNRISE.src }]];
        state.manager = {
            applyBackgroundSrc: vi.fn(),
            backgroundSrc: { type: 'animation', src: SUNRISE.src },
        };
        await render();
        expect(host.textContent).toContain('Screen 2');
        // No category chosen yet: it opens on the held one's.
        expect(readCategorySelect().value).toBe('resurrection-day');
        const lit = host.querySelectorAll(
            '[aria-pressed="true"].animation-tile',
        );
        expect(lit).toHaveLength(1);
        expect(lit[0].getAttribute('aria-label')).toBe(SUNRISE_LABEL);
        // Customize is open, with a shader's own rows.
        expect(host.textContent).toContain('Quality');
        expect(host.textContent).not.toContain('Density');
        expect(findButton('Edit Code')).toBeDefined();
        expect(
            host.querySelector<HTMLButtonElement>('.presets-save')!.disabled,
        ).toBe(false);
        await act(async () => findButton('Fast')!.click());
        expect(state.manager.applyBackgroundSrc).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(600);
        });
        expect(state.manager.applyBackgroundSrc).toHaveBeenCalledTimes(1);
        const [type, { src }] = state.manager.applyBackgroundSrc.mock.calls[0];
        expect(type).toBe('animation');
        expect(parseAnimation(src)).toEqual({
            ...SUNRISE.animation,
            speed: 'fast',
        });
        // Save keeps the draft.
        expect(state.presets.at(-1)!.readCurrent()).toEqual({ src });
    });

    it('Edit Code opens the shader’s code, and closes with it', async () => {
        state.selected = [['1', { src: SUNRISE.src }]];
        await render();
        await act(async () => findButton('Edit Code')!.click());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
        });
        expect(
            host.ownerDocument.querySelector('[data-code-editor]'),
        ).not.toBeNull();
        await act(async () => findButton('Close Code')!.click());
        expect(
            host.ownerDocument.querySelector('[data-code-editor]'),
        ).toBeNull();
    });

    it('a folded screen keeps only its line: what it holds, by name', async () => {
        state.selected = [['1', { src: SUNRISE.src }]];
        state.settings.set('background-animation-folded-1', 'true');
        await render();
        expect(tiles('CSS Animations')).toHaveLength(0);
        expect(host.querySelector('.fill-picker-held')?.textContent).toBe(
            SUNRISE_LABEL,
        );
    });
});

describe('its sessions and slide show', () => {
    it('sits under the strip, the show offered once one is up', async () => {
        await act(async () => root.render(<BackgroundAnimationsComp />));
        expect(frame.frames.at(-1)).toEqual({
            kind: 'animation',
            isShowing: false,
            activeId: '',
        });
        expect(frame.syncs.at(-1)).toEqual(['animation', 0]);
        state.selected = [
            ['1', { src: 'css?name=aurora&colors=1E3A8A-581C87' }],
        ];
        await act(async () => state.update!());
        expect(frame.frames.at(-1)!.isShowing).toBe(true);
        // The tab reconciles the show, so a clear that takes the strip's
        // control away still ends it.
        expect(frame.syncs.at(-1)).toEqual(['animation', 1]);
    });

    it("keeps each session's saved ones in a list of its own", async () => {
        await act(async () => root.render(<BackgroundAnimationsComp />));
        expect(state.presets.at(-1)!.savedSettingName).toBe(
            'background-animation-presets',
        );
        frame.sessionId = 's9';
        await act(async () => root.render(<BackgroundAnimationsComp />));
        expect(state.presets.at(-1)!.savedSettingName).toBe(
            'background-animation-presets-s9',
        );
    });
});
