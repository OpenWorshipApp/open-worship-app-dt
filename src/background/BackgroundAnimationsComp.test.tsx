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
vi.mock('./AnimationCodeEditorComp', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-code-editor>
            <button type="button" onClick={onClose}>
                Close Code
            </button>
        </div>
    ),
}));

import BackgroundAnimationsComp from './BackgroundAnimationsComp';
import {
    CSS_ANIMATION_SAMPLE_LIST,
    GLSL_ANIMATION_SAMPLE_LIST,
} from './animationBuiltInHelpers';
import { parseAnimation } from './animationValueHelpers';

const EASTER = GLSL_ANIMATION_SAMPLE_LIST.find((sample) => {
    return sample.theme === 'easter';
})!;

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
    it('offers every worship sample of both kinds, still, to the screens chosen', async () => {
        await render();
        expect(tiles('CSS Animations')).toHaveLength(
            CSS_ANIMATION_SAMPLE_LIST.length,
        );
        expect(tiles('GLSL Shaders')).toHaveLength(
            GLSL_ANIMATION_SAMPLE_LIST.length,
        );
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
        const easterTile = tiles('GLSL Shaders').find((tile) => {
            return tile.getAttribute('aria-label') === 'Easter - Sunrise';
        })!;
        await act(async () => easterTile.click());
        expect(state.select).toHaveBeenCalledWith(
            expect.anything(),
            'animation',
            { src: EASTER.src },
        );
    });

    it('moves a tile only under the pointer, and its right-click copies, shows and transitions', async () => {
        await render();
        const tile = tiles('CSS Animations')[0];
        state.previews = [];
        await act(async () => {
            tile.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(state.previews.at(-1)).toEqual({
            src: CSS_ANIMATION_SAMPLE_LIST[0].src,
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
        ).toEqual(['Copy Code', 'Show on Screens', 'Transition']);
        items[0].onSelect();
        expect(state.copied.mock.calls[0][0]).toMatch(/^<!DOCTYPE html>/);
        items[1].onSelect({});
        expect(state.select).toHaveBeenCalledWith(
            {},
            'animation',
            { src: CSS_ANIMATION_SAMPLE_LIST[0].src },
            true,
        );
    });

    it('a screen holding one gets its own picker, its sample lit, and Customize goes up after a pause', async () => {
        vi.useFakeTimers();
        state.selected = [['2', { src: EASTER.src }]];
        state.manager = {
            applyBackgroundSrc: vi.fn(),
            backgroundSrc: { type: 'animation', src: EASTER.src },
        };
        await render();
        expect(host.textContent).toContain('Screen 2');
        const lit = host.querySelectorAll(
            '[aria-pressed="true"].animation-tile',
        );
        expect(lit).toHaveLength(1);
        expect(lit[0].getAttribute('aria-label')).toBe('Easter - Sunrise');
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
            ...EASTER.animation,
            speed: 'fast',
        });
        // Save keeps the draft.
        expect(state.presets.at(-1)!.readCurrent()).toEqual({ src });
    });

    it('Edit Code opens the shader’s code, and closes with it', async () => {
        state.selected = [['1', { src: EASTER.src }]];
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
        state.selected = [['1', { src: EASTER.src }]];
        state.settings.set('background-animation-folded-1', 'true');
        await render();
        expect(tiles('CSS Animations')).toHaveLength(0);
        expect(host.querySelector('.fill-picker-held')?.textContent).toBe(
            'Easter - Sunrise',
        );
    });
});
