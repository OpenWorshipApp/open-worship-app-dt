// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        askedNames: [] as string[],
        nextName: null as string | null,
        isConfirmed: true,
        menuItems: [] as { menuElement: string; onSelect: () => any }[],
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
    removeSetting: (name: string) => {
        state.settings.delete(name);
    },
}));
vi.mock('../popup-widget/presetNameInputHelpers', () => ({
    askPresetName: async (_title: string, suggestedName: string) => {
        state.askedNames.push(suggestedName);
        return state.nextName;
    },
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async () => state.isConfirmed,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (_event: any, items: any[]) => {
        state.menuItems = items;
    },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useRef, useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: any) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import ForegroundPresetsComp from './ForegroundPresetsComp';
import { subscribeForegroundPanel } from './foregroundPanelRevisionHelpers';

const FLAGS = { isFontSize: false, isGeometry: true, isCommonStyle: true };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.askedNames = [];
    state.nextName = null;
    state.isConfirmed = true;
    state.menuItems = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('the Presets group of a Properties block', () => {
    test('a press writes the look, restyles what is up and remounts the panel', async () => {
        const onChange = vi.fn();
        const onApplied = vi.fn();
        const panelListener = vi.fn();
        const unsubscribe = subscribeForegroundPanel(
            'countdown',
            panelListener,
        );
        await act(async () =>
            root.render(
                <ForegroundPresetsComp
                    widgetKey="countdown"
                    prefix="countdown-s1"
                    flags={FLAGS}
                    onChange={onChange}
                    onApplied={onApplied}
                />,
            ),
        );
        const group = container.querySelector('[role="group"]')!;
        expect(group.getAttribute('aria-label')).toBe('Presets');
        const labels = [...container.querySelectorAll('button')].map(
            (button) => button.textContent,
        );
        expect(labels).toEqual([
            'Top Right',
            'Bottom Right',
            'Center',
            'Bottom Banner',
            'Save as Preset',
        ]);
        const center = container.querySelector(
            '[title="Presets: Center"]',
        ) as HTMLButtonElement;
        // The settings are already written when the panel is told.
        onChange.mockImplementation(() => {
            expect(
                state.settings.get(
                    'countdown-s1-setting-show-widget-width-percentage',
                ),
            ).toBe('60');
        });
        await act(async () => center.click());
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onApplied).toHaveBeenCalledTimes(1);
        expect(panelListener).toHaveBeenCalledTimes(1);
        expect(
            state.settings.get('countdown-s1-setting-show-widget-font-size'),
        ).toBeUndefined();
        unsubscribe();
    });

    test('Dark / Light turns the words and box, and a preset follows the side', async () => {
        const onColors = vi.fn();
        const onChange = vi.fn();
        const render = (color: string, backgroundColor: string) => {
            return act(async () =>
                root.render(
                    <ForegroundPresetsComp
                        widgetKey="message"
                        prefix="message-s1"
                        flags={{ ...FLAGS, isFontSize: true }}
                        colors={{
                            color,
                            backgroundColor,
                            onChange: onColors,
                        }}
                        onChange={onChange}
                        onApplied={vi.fn()}
                    />,
                ),
            );
        };
        await render('#FFFFFF', '#0F766EE6');
        const pressedOf = (title: string) => {
            return container
                .querySelector(`[title="${title}"]`)!
                .getAttribute('aria-pressed');
        };
        const darkTitle = 'Light words for a dark background';
        const lightTitle = 'Dark words for a light background';
        expect(pressedOf(darkTitle)).toBe('true');
        expect(pressedOf(lightTitle)).toBe('false');
        // The side a box is already on: nothing to write.
        await act(async () =>
            (container.querySelector(
                `[title="${darkTitle}"]`,
            ) as HTMLButtonElement)!.click(),
        );
        expect(onColors).not.toHaveBeenCalled();
        await act(async () =>
            (container.querySelector(
                `[title="${lightTitle}"]`,
            ) as HTMLButtonElement)!.click(),
        );
        expect(onColors).toHaveBeenCalledWith({
            color: '#000000',
            backgroundColor: '#89F0E8E6',
        });
        // The block hands its new colours back: the switch reads Light, and
        // each preset's icon wears its Light colours.
        await render('#000000', '#89F0E8E6');
        expect(pressedOf(lightTitle)).toBe('true');
        const chip = container.querySelector(
            '[title="Presets: Top Banner"] i',
        ) as HTMLElement;
        expect(chip.className).toContain('fg-preset-chip');
        expect(chip.style.background).toBe('rgba(255, 255, 255, 0.8)');
        await act(async () =>
            (container.querySelector(
                '[title="Presets: Top Banner"]',
            ) as HTMLButtonElement)!.click(),
        );
        expect(state.settings.get('message-s1-common-color')).toBe('#000000');
        expect(state.settings.get('message-s1-common-background-color')).toBe(
            '#FFFFFFCC',
        );
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    test("the session's look is saved as a preset, pressed back, and managed from its menu", async () => {
        const onChange = vi.fn();
        const onApplied = vi.fn();
        state.settings.set('countdown-s1-setting-show-widget-scale', '3');
        state.settings.set('countdown-s1-common-color', '#FACC15');
        await act(async () =>
            root.render(
                <ForegroundPresetsComp
                    widgetKey="countdown"
                    prefix="countdown-s1"
                    flags={FLAGS}
                    onChange={onChange}
                    onApplied={onApplied}
                />,
            ),
        );
        const saveButton = () => {
            return container.querySelector(
                '[title="Save as Preset"]',
            ) as HTMLButtonElement;
        };
        // Cancelled: nothing kept.
        await act(async () => saveButton().click());
        expect(state.askedNames).toEqual(['Preset 1']);
        expect(state.settings.has('foreground-countdown-saved-presets')).toBe(
            false,
        );
        state.nextName = 'Big Yellow';
        await act(async () => saveButton().click());
        const saved = JSON.parse(
            state.settings.get('foreground-countdown-saved-presets')!,
        );
        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({
            name: 'Big Yellow',
            values: {
                'props.scale': '3',
                'common.color': '#FACC15',
            },
        });
        const savedButton = () => {
            return container.querySelector(
                '[title="Presets: Big Yellow"]',
            ) as HTMLButtonElement;
        };
        expect(savedButton().textContent).toBe('Big Yellow');
        // Another look, then the saved one pressed back -- exactly.
        await act(async () =>
            (container.querySelector(
                '[title="Presets: Center"]',
            ) as HTMLButtonElement)!.click(),
        );
        expect(
            state.settings.get('countdown-s1-setting-show-widget-scale'),
        ).toBe('1');
        await act(async () => savedButton().click());
        expect(
            state.settings.get('countdown-s1-setting-show-widget-scale'),
        ).toBe('3');
        expect(state.settings.get('countdown-s1-common-color')).toBe('#FACC15');
        // The Center look's blur, not in the saved one, is the default again.
        expect(state.settings.has('countdown-s1-common-backdrop-filter')).toBe(
            false,
        );
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(onApplied).toHaveBeenCalledTimes(2);
        // Its menu: rename, replace with the look in front, remove.
        const openMenu = async () => {
            await act(async () => {
                savedButton().dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
            return state.menuItems.map((item) => item.menuElement);
        };
        expect(await openMenu()).toEqual([
            'Rename Preset',
            'Replace with Current Look',
            'Remove Preset',
        ]);
        state.nextName = 'Sunday';
        await act(async () => state.menuItems[0].onSelect());
        expect(container.querySelector('[title="Presets: Sunday"]')).not.toBe(
            null,
        );
        state.settings.set('countdown-s1-setting-show-widget-scale', '4');
        await act(async () => state.menuItems[1].onSelect());
        expect(
            JSON.parse(
                state.settings.get('foreground-countdown-saved-presets')!,
            )[0].values['props.scale'],
        ).toBe('4');
        state.isConfirmed = false;
        await act(async () => state.menuItems[2].onSelect());
        expect(
            JSON.parse(
                state.settings.get('foreground-countdown-saved-presets')!,
            ),
        ).toHaveLength(1);
        state.isConfirmed = true;
        await act(async () => state.menuItems[2].onSelect());
        expect(
            JSON.parse(
                state.settings.get('foreground-countdown-saved-presets')!,
            ),
        ).toEqual([]);
        expect(container.querySelector('[title="Presets: Sunday"]')).toBeNull();
    });

    test('a picture has presets and no Dark / Light', async () => {
        await act(async () =>
            root.render(
                <ForegroundPresetsComp
                    widgetKey="video"
                    prefix="video-show"
                    flags={{ ...FLAGS, isCommonStyle: false }}
                    onChange={vi.fn()}
                    onApplied={vi.fn()}
                />,
            ),
        );
        expect(container.querySelector('.fg-presets-mode')).toBeNull();
        expect(
            container.querySelectorAll('.fg-preset:not(.fg-preset-add)'),
        ).toHaveLength(4);
        expect(container.querySelector('.fg-preset-chip')).toBeNull();
    });

    test('a component with no presets draws nothing', async () => {
        await act(async () =>
            root.render(
                <ForegroundPresetsComp
                    widgetKey="long-text"
                    prefix="long-text"
                    flags={FLAGS}
                    onChange={vi.fn()}
                    onApplied={vi.fn()}
                />,
            ),
        );
        expect(container.innerHTML).toBe('');
    });
});
