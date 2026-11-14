// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    askedNames: [] as { title: string; suggestedName: string }[],
    // What the name popup answers; null is Cancel.
    nextName: null as string | null,
    onNameAsked: null as null | (() => void),
    confirms: [] as { title: string; message: string }[],
    isConfirmed: true,
    menuItems: [] as { menuElement: string; onSelect: () => unknown }[],
    menuIcons: [] as string[],
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
}));
vi.mock('../popup-widget/presetNameInputHelpers', () => ({
    askPresetName: async (title: string, suggestedName: string) => {
        h.askedNames.push({ title, suggestedName });
        h.onNameAsked?.();
        return h.nextName;
    },
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: async (title: string, message: string) => {
        h.confirms.push({ title, message });
        return h.isConfirmed;
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (_event: MouseEvent, items: typeof h.menuItems) => {
        h.menuItems = items;
    },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (iconName: string) => {
        h.menuIcons.push(iconName);
        return null;
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import PresetsRowComp, { type PresetsRowBuiltInType } from './PresetsRowComp';
import { writeSavedPresets } from './savedPresetHelpers';
import {
    MAX_SAVED_PRESET_COUNT,
    type SavedPresetBaseType,
} from './savedPresetListHelpers';

type ColorPresetType = SavedPresetBaseType & { color: string };

function toColorPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): ColorPresetType | null {
    return typeof item.color === 'string'
        ? { ...base, color: item.color }
        : null;
}

const SETTING_NAME = 'test-look-saved-presets';
const ONE = { id: 'one', name: 'One', color: '#111111' };
const TWO = { id: 'two', name: 'Two', color: '#222222' };

let container: HTMLDivElement;
let root: Root;

function storePresets(presets: ColorPresetType[], name = SETTING_NAME) {
    h.settings.set(name, JSON.stringify(presets));
}

function readStored(name = SETTING_NAME): ColorPresetType[] {
    return JSON.parse(h.settings.get(name) ?? '[]');
}

// How jsdom writes a colour back, so a test can say it in hex.
function toCssColor(color: string) {
    const element = document.createElement('i');
    element.style.color = color;
    return element.style.color;
}

function getButtons(scope: ParentNode = container) {
    return [...scope.querySelectorAll('button')];
}

function getButtonLabels(scope: ParentNode = container) {
    return getButtons(scope).map((button) => {
        return button.textContent;
    });
}

function getButton(title: string, scope: ParentNode = container) {
    const button = scope.querySelector<HTMLButtonElement>(
        `button[title="${title}"]`,
    );
    if (button === null) {
        throw new Error(`Missing button: ${title}`);
    }
    return button;
}

function genBuiltIns(onPick = vi.fn()): PresetsRowBuiltInType[] {
    return [
        {
            id: 'plain',
            iconName: 'square',
            label: 'Plain',
            chipColors: { color: '#FFD60A', backgroundColor: '#000000' },
            onPick: () => {
                onPick('plain');
            },
        },
        {
            id: 'bold',
            iconName: 'type-bold',
            label: 'Bold',
            onPick: () => {
                onPick('bold');
            },
        },
    ];
}

type RowPropsType = Partial<
    Parameters<typeof PresetsRowComp<ColorPresetType>>[0]
>;

function genRow(props: RowPropsType = {}) {
    return (
        <PresetsRowComp<ColorPresetType>
            savedSettingName={SETTING_NAME}
            toSavedPreset={toColorPreset}
            builtIns={genBuiltIns()}
            readCurrent={() => {
                return { color: '#ABCDEF' };
            }}
            onSavedPick={vi.fn()}
            {...props}
        />
    );
}

async function render(element: React.ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

async function openMenu(title: string) {
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        getButton(title).dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings.clear();
    h.askedNames = [];
    h.nextName = null;
    h.onNameAsked = null;
    h.confirms = [];
    h.isConfirmed = true;
    h.menuItems = [];
    h.menuIcons = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('a Presets row', () => {
    test('the built-in looks, then the saved ones, then Save as Preset', async () => {
        storePresets([ONE, TWO]);
        await render(genRow());

        const group = container.querySelector('[role="group"]')!;
        expect(group.className).toBe('app-presets');
        expect(group.getAttribute('aria-label')).toBe('Presets');
        expect(container.querySelector('.app-presets-name')!.textContent).toBe(
            'Presets',
        );
        expect(getButtonLabels()).toEqual([
            'Plain',
            'Bold',
            'One',
            'Two',
            'Save as Preset',
        ]);
        expect(
            getButtons().map((button) => {
                return button.title;
            }),
        ).toEqual([
            'Presets: Plain',
            'Presets: Bold',
            'Presets: One',
            'Presets: Two',
            'Save as Preset',
        ]);
        // A built-in wears its own icon, a saved look the bookmark.
        expect(
            getButton('Presets: Bold').querySelector('i')!.className,
        ).toContain('bi-type-bold');
        expect(
            getButton('Presets: One').querySelector('i')!.className,
        ).toContain('bi-bookmark-star');
        expect(getButton('Save as Preset').disabled).toBe(false);
    });

    test('a press puts the look on: a built-in by its own pick, a saved one by the panel', async () => {
        storePresets([ONE, TWO]);
        const onPick = vi.fn();
        const onSavedPick = vi.fn();
        await render(genRow({ builtIns: genBuiltIns(onPick), onSavedPick }));

        await act(async () => {
            getButton('Presets: Bold').click();
        });
        expect(onPick).toHaveBeenCalledExactlyOnceWith('bold');
        expect(onSavedPick).not.toHaveBeenCalled();

        await act(async () => {
            getButton('Presets: Two').click();
        });
        expect(onSavedPick).toHaveBeenCalledExactlyOnceWith(TWO);
        expect(onPick).toHaveBeenCalledOnce();
    });

    test('a saved press reaches the panel as it is now, not as it was', async () => {
        storePresets([ONE]);
        const firstPick = vi.fn();
        const laterPick = vi.fn();
        await render(genRow({ onSavedPick: firstPick }));
        await render(genRow({ onSavedPick: laterPick }));
        await act(async () => {
            getButton('Presets: One').click();
        });
        expect(firstPick).not.toHaveBeenCalled();
        expect(laterPick).toHaveBeenCalledExactlyOnceWith(ONE);
    });

    test('a chip shows the colours it is given, and none when it has none', async () => {
        storePresets([ONE, TWO]);
        await render(
            genRow({
                genSavedChipColors: (preset: ColorPresetType) => {
                    return preset.id === 'one'
                        ? {
                              color: preset.color,
                              backgroundColor: 'transparent',
                          }
                        : null;
                },
            }),
        );
        const plainChip = getButton('Presets: Plain').querySelector('i')!;
        expect(plainChip.className).toContain('app-preset-chip');
        expect(plainChip.style.color).toBe(toCssColor('#FFD60A'));
        expect(plainChip.style.background).toBe(toCssColor('#000000'));
        const boldIcon = getButton('Presets: Bold').querySelector('i')!;
        expect(boldIcon.className).not.toContain('app-preset-chip');
        expect(boldIcon.getAttribute('style')).toBe(null);

        const oneChip = getButton('Presets: One').querySelector('i')!;
        expect(oneChip.className).toContain('app-preset-chip');
        expect(oneChip.style.color).toBe(toCssColor('#111111'));
        expect(oneChip.style.background).toBe('transparent');
        const twoIcon = getButton('Presets: Two').querySelector('i')!;
        expect(twoIcon.className).not.toContain('app-preset-chip');
    });

    test('a panel shows only the saved looks it can wear', async () => {
        storePresets([ONE, TWO]);
        await render(
            genRow({
                filterSaved: (preset: ColorPresetType) => {
                    return preset.id === 'two';
                },
            }),
        );
        expect(getButtonLabels()).toEqual([
            'Plain',
            'Bold',
            'Two',
            'Save as Preset',
        ]);
    });

    test('the switch beside the name, and the one-line strip form', async () => {
        await render(
            genRow({
                headEnd: <span className="head-end-probe">Dark / Light</span>,
            }),
        );
        const head = container.querySelector('.app-presets-head')!;
        expect(head.lastElementChild!.className).toBe('head-end-probe');
        expect(container.querySelector('.app-presets-compact')).toBe(null);

        await render(genRow({ isCompact: true }));
        expect(container.querySelector('[role="group"]')!.className).toBe(
            'app-presets app-presets-compact',
        );
        expect(container.querySelector('.head-end-probe')).toBe(null);
    });

    test('a strip whose canvas keeps the keyboard keeps it through every button', async () => {
        storePresets([ONE]);
        const onButtonMouseDown = vi.fn((event: { preventDefault(): void }) => {
            event.preventDefault();
        });
        await render(genRow({ onButtonMouseDown }));
        for (const button of getButtons()) {
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
            });
            button.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        expect(onButtonMouseDown).toHaveBeenCalledTimes(4);
    });

    test('without a focus keeper a press takes the focus as usual', async () => {
        await render(genRow());
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        getButton('Presets: Plain').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });

    test('a full list turns Save as Preset off and says why', async () => {
        const fullList = Array.from(
            { length: MAX_SAVED_PRESET_COUNT },
            (_, index) => {
                return {
                    id: `id-${index}`,
                    name: `Look ${index}`,
                    color: '#000000',
                };
            },
        );
        storePresets(fullList);
        // Full is the LIST, whatever this panel shows of it.
        await render(
            genRow({
                filterSaved: () => {
                    return false;
                },
            }),
        );
        const addButton =
            container.querySelector<HTMLButtonElement>('.app-preset-add')!;
        expect(addButton.disabled).toBe(true);
        expect(addButton.title).toBe('Remove a preset to save a new one');
        await act(async () => {
            addButton.click();
        });
        expect(h.askedNames).toEqual([]);

        // One removed elsewhere: it can save again.
        await act(async () => {
            writeSavedPresets(SETTING_NAME, fullList.slice(1));
        });
        expect(addButton.disabled).toBe(false);
        expect(addButton.title).toBe('Save as Preset');
    });

    test('a list that is not one shows no saved looks', async () => {
        h.settings.set(SETTING_NAME, '{not json');
        await render(genRow());
        expect(getButtonLabels()).toEqual(['Plain', 'Bold', 'Save as Preset']);
    });
});

describe('Save as Preset', () => {
    test('asks a name, and keeps the look as it is when the name is given', async () => {
        storePresets([{ ...ONE, name: 'Preset 1' }]);
        const look = { color: '#111111' };
        await render(
            genRow({
                readCurrent: () => {
                    return { ...look };
                },
            }),
        );

        // Cancelled: nothing kept.
        await act(async () => {
            getButton('Save as Preset').click();
        });
        expect(h.askedNames).toEqual([
            { title: 'Save as Preset', suggestedName: 'Preset 2' },
        ]);
        expect(readStored()).toHaveLength(1);

        h.nextName = '  Sunday  ';
        // The look changes while the popup is open.
        h.onNameAsked = () => {
            look.color = '#999999';
        };
        await act(async () => {
            getButton('Save as Preset').click();
        });
        const stored = readStored();
        expect(stored).toHaveLength(2);
        expect(stored[1]).toEqual({
            id: expect.any(String),
            name: 'Sunday',
            color: '#999999',
        });
        expect(getButtonLabels()).toContain('Sunday');
    });

    test('adds to the list as it is then, not as the row read it', async () => {
        await render(genRow());
        // Another window wrote one; this row was not told.
        storePresets([ONE]);
        h.nextName = 'Mine';
        await act(async () => {
            getButton('Save as Preset').click();
        });
        expect(h.askedNames[0].suggestedName).toBe('Preset 1');
        expect(
            readStored().map((preset) => {
                return preset.name;
            }),
        ).toEqual(['One', 'Mine']);
    });

    test("two rows over one list show each other's saves; another list does not", async () => {
        await render(
            <>
                <div className="row-a">{genRow()}</div>
                <div className="row-b">{genRow()}</div>
                <div className="row-c">
                    {genRow({ savedSettingName: 'other-saved-presets' })}
                </div>
            </>,
        );
        const rowA = container.querySelector('.row-a')!;
        const rowB = container.querySelector('.row-b')!;
        const rowC = container.querySelector('.row-c')!;
        h.nextName = 'Shared';
        await act(async () => {
            getButton('Save as Preset', rowA).click();
        });
        expect(getButtonLabels(rowA)).toContain('Shared');
        expect(getButtonLabels(rowB)).toContain('Shared');
        expect(getButtonLabels(rowC)).not.toContain('Shared');

        // And a removal in the other one shows here.
        await openMenu('Presets: Shared');
        await act(async () => {
            await h.menuItems[2].onSelect();
        });
        expect(getButtonLabels(rowA)).not.toContain('Shared');
        expect(getButtonLabels(rowB)).not.toContain('Shared');
    });
});

describe("a saved look's menu", () => {
    test('rename, replace with the look in front, remove', async () => {
        storePresets([ONE, TWO]);
        const look = { color: '#ABCDEF' };
        await render(
            genRow({
                readCurrent: () => {
                    return { ...look };
                },
            }),
        );
        const event = await openMenu('Presets: One');
        expect(event.defaultPrevented).toBe(true);
        expect(
            h.menuItems.map((item) => {
                return item.menuElement;
            }),
        ).toEqual([
            'Rename Preset',
            'Replace with Current Look',
            'Remove Preset',
        ]);
        expect(h.menuIcons).toEqual([
            'pencil-square',
            'arrow-repeat',
            'x-circle',
        ]);

        // Rename, cancelled then given.
        await act(async () => {
            await h.menuItems[0].onSelect();
        });
        expect(h.askedNames).toEqual([
            { title: 'Rename Preset', suggestedName: 'One' },
        ]);
        expect(readStored()).toEqual([ONE, TWO]);
        h.nextName = 'Uno';
        await act(async () => {
            await h.menuItems[0].onSelect();
        });
        expect(readStored()).toEqual([{ ...ONE, name: 'Uno' }, TWO]);
        expect(getButtonLabels()).toContain('Uno');

        // Replace: the look as it is now, its name and id kept.
        look.color = '#FEDCBA';
        await act(async () => {
            await h.menuItems[1].onSelect();
        });
        expect(readStored()).toEqual([
            { id: 'one', name: 'Uno', color: '#FEDCBA' },
            TWO,
        ]);

        // Remove asks first, by the name it was opened on.
        h.isConfirmed = false;
        await act(async () => {
            await h.menuItems[2].onSelect();
        });
        expect(h.confirms).toEqual([
            { title: 'Remove Preset', message: 'Remove "One"?' },
        ]);
        expect(readStored()).toHaveLength(2);
        h.isConfirmed = true;
        await act(async () => {
            await h.menuItems[2].onSelect();
        });
        expect(readStored()).toEqual([TWO]);
        expect(getButtonLabels()).toEqual([
            'Plain',
            'Bold',
            'Two',
            'Save as Preset',
        ]);
    });

    test('a removal keeps what another row saved while the menu was open', async () => {
        storePresets([ONE]);
        await render(genRow());
        await openMenu('Presets: One');
        // Saved somewhere else after this menu opened.
        storePresets([ONE, TWO]);
        await act(async () => {
            await h.menuItems[2].onSelect();
        });
        expect(readStored()).toEqual([TWO]);
    });
});
