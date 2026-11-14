// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    canvasItem: { type: 'text' } as { type: string },
    props: {} as Record<string, any>,
    setProps: vi.fn(),
    // What the panel last handed its Presets row.
    row: null as any,
}));

vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => h.canvasItem,
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));
// `canvasHelpers` asks it which media it supports; the real module reaches
// `appProvider`.
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => true,
    isSupportedMimetype: () => true,
}));
// The row has its own suite (`PresetsRowComp`): here only what the panel
// hands it, its head drawn so the real Dark / Light switch can be pressed
// and each of the app's looks a button.
vi.mock('../../../others/PresetsRowComp', () => ({
    default: (props: any) => {
        h.row = props;
        return createElement(
            'div',
            { className: 'row-stub' },
            props.headEnd ?? null,
            ...props.builtIns.map((preset: any) => {
                return createElement(
                    'button',
                    {
                        key: preset.id,
                        type: 'button',
                        title: `Presets: ${preset.label}`,
                        onClick: preset.onPick,
                    },
                    preset.label,
                );
            }),
        );
    },
}));

import { genContrastColors } from '../../../others/color/colorContrastHelpers';
import CanvasItemPresetsComp from './CanvasItemPresetsComp';
import {
    CANVAS_ITEM_PRESET_LIST,
    genCanvasItemLookPatch,
    genCanvasItemPresetColors,
    genCanvasItemPresetPatch,
    genCanvasItemPresetTarget,
    readCanvasItemLook,
    toCanvasItemSavedPreset,
    type CanvasItemPresetIdType,
    type CanvasItemSavedPresetType,
} from './canvasItemPresetHelpers';

// Never in a look's patch: where the box is, how big, what it says and how
// it reads -- and no look of the app's sets a size or a font.
const NEVER_KEYS = [
    'id',
    'uuid',
    'type',
    'top',
    'left',
    'width',
    'height',
    'rotate',
    'text',
    'locked',
    'textDirection',
    'transitionEffect',
    'horizontalAlignment',
    'verticalAlignment',
];

const TEXT_PROPS = {
    id: 1,
    uuid: 'u-1',
    type: 'text',
    top: 10,
    left: 20,
    width: 300,
    height: 200,
    rotate: 0,
    text: 'Words',
    backgroundColor: '#0000008B',
    backdropFilter: 0,
    roundSizePercentage: 0,
    roundSizePixel: 0,
    color: '#FFFFFF',
    fontSize: 60,
    fontFamily: null,
    fontWeight: null,
    textHorizontalAlignment: 'left',
    textVerticalAlignment: 'end',
};

const IMAGE_PROPS = {
    id: 2,
    type: 'image',
    top: 0,
    left: 0,
    width: 640,
    height: 360,
    rotate: 0,
    backgroundColor: '#00000000',
    backdropFilter: 0,
    roundSizePercentage: 0,
    roundSizePixel: 0,
};

const TEXT_LOOK: CanvasItemSavedPresetType = {
    id: 'saved-text',
    name: 'Gold words',
    kind: 'text',
    box: {
        backgroundColor: '#20202080',
        backdropFilter: 6,
        roundSizePercentage: 8,
        roundSizePixel: 0,
        blendMode: 'normal',
        shadow: null,
    },
    text: {
        color: '#FFD700',
        fontSize: 48,
        fontFamily: 'Georgia',
        fontWeight: '600',
        textHorizontalAlignment: 'right',
        textVerticalAlignment: 'start',
    },
};

const BOX_LOOK: CanvasItemSavedPresetType = {
    id: 'saved-box',
    name: 'Soft corners',
    kind: 'box',
    box: { ...TEXT_LOOK.box, roundSizePercentage: 30 },
};

let container: HTMLDivElement;
let root: Root;

async function renderComp(type: string, props: Record<string, any>) {
    h.canvasItem = { type };
    h.props = props;
    await act(async () => {
        root.render(createElement(CanvasItemPresetsComp));
    });
}

function getSwitchButton(label: 'Dark' | 'Light') {
    return Array.from(
        container.querySelectorAll<HTMLButtonElement>(
            '.app-presets-mode button',
        ),
    ).find((button) => button.textContent === label);
}

function getLookButton(label: string) {
    return container.querySelector<HTMLButtonElement>(
        `button[title="Presets: ${label}"]`,
    )!;
}

async function press(button: HTMLButtonElement | undefined) {
    if (button === undefined) {
        throw new Error('Missing button');
    }
    await act(async () => {
        button.click();
    });
}

function findLook(id: CanvasItemPresetIdType) {
    return CANVAS_ITEM_PRESET_LIST.find((preset) => preset.id === id)!;
}

function onlyPatch() {
    expect(h.setProps).toHaveBeenCalledTimes(1);
    return h.setProps.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.row = null;
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

describe('a box of words', () => {
    test('one list, the five looks in its side colours, the switch on its side', async () => {
        await renderComp('text', TEXT_PROPS);
        expect(h.row.savedSettingName).toBe(
            'slide-editor-canvas-item-saved-presets',
        );
        expect(h.row.toSavedPreset).toBe(toCanvasItemSavedPreset);
        expect(
            h.row.builtIns.map((preset: any) => [preset.id, preset.label]),
        ).toEqual([
            ['plain', 'Plain'],
            ['shadow', 'Shadow'],
            ['glass-effect', 'Glass Effect'],
            ['highlight', 'Highlight'],
            ['urgent-alert', 'Urgent Alert'],
        ]);
        // White words: the Dark side, and every chip shows it.
        for (const preset of h.row.builtIns) {
            expect(preset.chipColors).toEqual(
                genCanvasItemPresetColors(findLook(preset.id), 'dark'),
            );
        }
        expect(getSwitchButton('Dark')!.getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getSwitchButton('Light')!.getAttribute('aria-pressed')).toBe(
            'false',
        );
    });

    test('dark words put it on Light, and a look goes on in Light', async () => {
        await renderComp('text', {
            ...TEXT_PROPS,
            color: '#111111',
            backgroundColor: '#FFFFFFCC',
        });
        expect(getSwitchButton('Light')!.getAttribute('aria-pressed')).toBe(
            'true',
        );
        for (const preset of h.row.builtIns) {
            expect(preset.chipColors).toEqual(
                genCanvasItemPresetColors(findLook(preset.id), 'light'),
            );
        }
        await press(getLookButton('Plain'));
        const patch = onlyPatch();
        expect(patch).toEqual(
            genCanvasItemPresetPatch(
                findLook('plain'),
                genCanvasItemPresetTarget('text'),
                'light',
            ),
        );
        expect(patch.color).not.toBe('#FFFFFF');
    });

    test('the other side is ONE patch of the two colours; its own side, none', async () => {
        await renderComp('text', TEXT_PROPS);
        await press(getSwitchButton('Dark'));
        expect(h.setProps).not.toHaveBeenCalled();

        await press(getSwitchButton('Light'));
        const patch = onlyPatch();
        expect(Object.keys(patch).sort()).toEqual(['backgroundColor', 'color']);
        expect(patch).toEqual(
            genContrastColors(
                {
                    color: TEXT_PROPS.color,
                    backgroundColor: TEXT_PROPS.backgroundColor,
                },
                'light',
            ),
        );
        // Darker words over a lighter box, the box as see-through as it was.
        expect(patch.color).not.toBe(TEXT_PROPS.color);
        expect((patch.backgroundColor as string).slice(7, 9)).toBe('8B');
    });

    test('a Bible passage has the switch too', async () => {
        await renderComp('bible', { ...TEXT_PROPS, type: 'bible' });
        expect(getSwitchButton('Dark')).toBeDefined();
        expect(h.row.builtIns).toHaveLength(5);
    });

    test('each look is ONE patch, never where the box is or what it says', async () => {
        await renderComp('text', TEXT_PROPS);
        const target = genCanvasItemPresetTarget('text');
        for (const preset of h.row.builtIns) {
            h.setProps.mockClear();
            await press(getLookButton(preset.label));
            const patch = onlyPatch();
            expect(patch).toEqual(
                genCanvasItemPresetPatch(findLook(preset.id), target, 'dark'),
            );
            for (const key of [...NEVER_KEYS, 'fontSize', 'fontFamily']) {
                expect(patch, `${preset.id}: ${key}`).not.toHaveProperty(key);
            }
        }
    });

    test('a press acts on the box as it is now, not as it was drawn', async () => {
        await renderComp('text', TEXT_PROPS);
        const firstPick = h.row.builtIns[0].onPick;
        const firstReadCurrent = h.row.readCurrent;
        const lightProps = {
            ...TEXT_PROPS,
            color: '#111111',
            backgroundColor: '#FFFFFFCC',
        };
        await renderComp('text', lightProps);

        await act(async () => {
            firstPick();
        });
        expect(onlyPatch()).toEqual(
            genCanvasItemPresetPatch(
                findLook('plain'),
                genCanvasItemPresetTarget('text'),
                'light',
            ),
        );
        expect(firstReadCurrent()).toEqual(
            readCanvasItemLook(lightProps, genCanvasItemPresetTarget('text')),
        );
    });

    test('Save keeps the look in front, words and alignment included', async () => {
        await renderComp('text', TEXT_PROPS);
        const current = h.row.readCurrent();
        expect(current).toEqual(
            readCanvasItemLook(TEXT_PROPS, genCanvasItemPresetTarget('text')),
        );
        expect(current.kind).toBe('text');
        expect(current.text).toMatchObject({
            color: '#FFFFFF',
            fontSize: 60,
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'end',
        });
        // A look's own `text` is its words' style; inside it and the box,
        // nothing of where the box is or what it says.
        expect(Object.keys(current).sort()).toEqual(['box', 'kind', 'text']);
        for (const key of NEVER_KEYS) {
            expect(current.box).not.toHaveProperty(key);
            expect(current.text).not.toHaveProperty(key);
        }
    });

    test('a saved look goes back on as ONE patch, alignment on plain text only', async () => {
        await renderComp('text', TEXT_PROPS);
        await act(async () => {
            h.row.onSavedPick(TEXT_LOOK);
        });
        const textPatch = onlyPatch();
        expect(textPatch).toEqual(
            genCanvasItemLookPatch(
                TEXT_LOOK,
                genCanvasItemPresetTarget('text'),
            ),
        );
        expect(textPatch).toMatchObject({
            color: '#FFD700',
            fontFamily: 'Georgia',
            textHorizontalAlignment: 'right',
            textVerticalAlignment: 'start',
            shadow: null,
            blendMode: 'normal',
        });

        h.setProps.mockClear();
        await renderComp('bible', { ...TEXT_PROPS, type: 'bible' });
        await act(async () => {
            h.row.onSavedPick(TEXT_LOOK);
        });
        const biblePatch = onlyPatch();
        expect(biblePatch).not.toHaveProperty('textHorizontalAlignment');
        expect(biblePatch).not.toHaveProperty('textVerticalAlignment');
        expect(biblePatch.color).toBe('#FFD700');
    });

    test('it wears every saved look, and a saved text look shows its colours', async () => {
        await renderComp('text', TEXT_PROPS);
        expect(h.row.filterSaved(TEXT_LOOK)).toBe(true);
        expect(h.row.filterSaved(BOX_LOOK)).toBe(true);
        expect(h.row.genSavedChipColors(TEXT_LOOK)).toEqual({
            color: '#FFD700',
            backgroundColor: '#20202080',
        });
        expect(h.row.genSavedChipColors(BOX_LOOK)).toBeNull();
    });
});

describe('a picture', () => {
    test('no switch, the two looks it can show, no colours of words', async () => {
        await renderComp('image', IMAGE_PROPS);
        expect(container.querySelector('.app-presets-mode')).toBeNull();
        expect(h.row.headEnd).toBeNull();
        expect(
            h.row.builtIns.map((preset: any) => [preset.id, preset.label]),
        ).toEqual([
            ['plain', 'Plain'],
            ['shadow', 'Shadow'],
        ]);
        for (const preset of h.row.builtIns) {
            expect(preset.chipColors).toBeNull();
        }

        await press(getLookButton('Shadow'));
        const patch = onlyPatch();
        expect(patch).toEqual({ ...findLook('shadow').box });
        expect(patch).not.toHaveProperty('color');
        expect(patch).not.toHaveProperty('fontWeight');
    });

    test('Save keeps its box only; it wears only the box looks', async () => {
        await renderComp('image', IMAGE_PROPS);
        const current = h.row.readCurrent();
        expect(current).toEqual(
            readCanvasItemLook(IMAGE_PROPS, genCanvasItemPresetTarget('image')),
        );
        expect(current.kind).toBe('box');
        expect(current).not.toHaveProperty('text');

        expect(h.row.filterSaved(TEXT_LOOK)).toBe(false);
        expect(h.row.filterSaved(BOX_LOOK)).toBe(true);
        expect(h.row.genSavedChipColors(TEXT_LOOK)).toBeNull();

        await act(async () => {
            h.row.onSavedPick(BOX_LOOK);
        });
        expect(Object.keys(onlyPatch()).sort()).toEqual([
            'backdropFilter',
            'backgroundColor',
            'blendMode',
            'roundSizePercentage',
            'roundSizePixel',
            'shadow',
        ]);
    });
});

test('a box with no words of another kind gets the glass, but no switch', async () => {
    await renderComp('camera', { ...IMAGE_PROPS, type: 'camera' });
    expect(container.querySelector('.app-presets-mode')).toBeNull();
    expect(h.row.builtIns.map((preset: any) => preset.id)).toEqual([
        'plain',
        'shadow',
        'glass-effect',
    ]);
    await press(getLookButton('Glass Effect'));
    // Worn as written: no side to work its colours out for.
    expect(onlyPatch()).toEqual({ ...findLook('glass-effect').box });
});
