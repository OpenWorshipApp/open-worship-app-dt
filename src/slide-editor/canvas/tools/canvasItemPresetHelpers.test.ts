import { describe, expect, test, vi } from 'vitest';

// `canvasHelpers` asks `fileHelpers` which media it supports, and the real
// module reaches `appProvider`: mocked so this stays a node test.
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: vi.fn(() => true),
    isSupportedMimetype: vi.fn(() => true),
}));

import { checkIsBlending } from '../../../helper/blendModeHelpers';
import { classifySettingKey } from '../../../setting/setting-archive/settingArchiveCatalog';
import {
    canvasItemList,
    checkIsValidTextStyleProps,
    type CanvasItemKindType,
} from '../canvasHelpers';
import { toValidCanvasShadow } from '../canvasShadowHelpers';
import {
    CANVAS_ITEM_PRESET_LIST,
    CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME,
    checkIsCanvasItemPresetFor,
    genCanvasItemLookPatch,
    genCanvasItemPresetColors,
    genCanvasItemPresetPatch,
    genCanvasItemPresetTarget,
    getCanvasItemPresetList,
    readCanvasItemLook,
    toCanvasItemSavedPreset,
    type CanvasItemLookType,
    type CanvasItemPresetIdType,
} from './canvasItemPresetHelpers';

const BOX_KEYS = [
    'backdropFilter',
    'backgroundColor',
    'blendMode',
    'roundSizePercentage',
    'roundSizePixel',
    'shadow',
];
const TEXT_KEYS = ['color', 'fontFamily', 'fontSize', 'fontWeight'];
const ALIGNMENT_KEYS = ['textHorizontalAlignment', 'textVerticalAlignment'];
// What a look must never carry: where the box is, how big, what it says,
// who may move it, how it reads and how it comes in -- and the box's OWN
// alignment, which `applyBoxData` turns into a new position.
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
    'bibleKey',
    'bibleRenderingList',
];

const TEXT_TARGET = genCanvasItemPresetTarget('text');
const BIBLE_TARGET = genCanvasItemPresetTarget('bible');
const IMAGE_TARGET = genCanvasItemPresetTarget('image');
const CAMERA_TARGET = genCanvasItemPresetTarget('camera');

const SHADOW = {
    kind: 'drop' as const,
    offsetX: 3,
    offsetY: 4,
    blur: 5,
    color: '#11223344' as const,
};

// A text box as a slide document holds it.
function genTextProps(overrides: Record<string, unknown> = {}) {
    return {
        id: 3,
        uuid: 'u-3',
        type: 'text',
        top: 279,
        left: 356,
        width: 700,
        height: 400,
        rotate: 15,
        locked: false,
        text: 'Amazing grace',
        textDirection: 'rtl',
        transitionEffect: { style: 'fade', duration: 300 },
        backgroundColor: '#0000008B',
        backdropFilter: 4,
        roundSizePercentage: 10,
        roundSizePixel: 0,
        blendMode: 'multiply',
        shadow: SHADOW,
        color: '#FFFFFF',
        fontSize: 60,
        fontFamily: 'Georgia',
        fontWeight: '700',
        textHorizontalAlignment: 'left',
        textVerticalAlignment: 'end',
        ...overrides,
    };
}

function collectKeys(value: unknown, keys = new Set<string>()) {
    if (typeof value === 'object' && value !== null) {
        for (const [key, child] of Object.entries(value)) {
            keys.add(key);
            collectKeys(child, keys);
        }
    }
    return keys;
}

function expectNoNeverKeys(value: unknown) {
    const keys = collectKeys(value);
    for (const key of NEVER_KEYS) {
        expect(keys.has(key), `"${key}" in ${JSON.stringify(value)}`).toBe(
            false,
        );
    }
}

// A look's own `text` is its words' STYLE, so a look is checked part by
// part: its box and its words' style, never anything of where or what.
function expectCleanLook(look: CanvasItemLookType) {
    expect(Object.keys(look).sort()).toEqual(
        look.text === undefined ? ['box', 'kind'] : ['box', 'kind', 'text'],
    );
    expect(Object.keys(look.box).sort()).toEqual(BOX_KEYS);
    expectNoNeverKeys(look.box);
    if (look.text !== undefined) {
        expect(Object.keys(look.text).sort()).toEqual(
            [...TEXT_KEYS, ...ALIGNMENT_KEYS].sort(),
        );
        expectNoNeverKeys(look.text);
    }
}

function expectNoUndefined(patch: Record<string, unknown>) {
    for (const [key, value] of Object.entries(patch)) {
        expect(value, `"${key}" is undefined`).not.toBeUndefined();
    }
}

function findPreset(id: CanvasItemPresetIdType) {
    const preset = CANVAS_ITEM_PRESET_LIST.find((item) => item.id === id);
    if (preset === undefined) {
        throw new Error(`Missing preset: ${id}`);
    }
    return preset;
}

// WCAG 2 contrast, written out here rather than borrowed from the module
// under test: the words over the box, the box over a slide of the side.
function toChannels(hex: string) {
    let digits = hex.slice(1);
    if (digits.length === 3) {
        digits = digits
            .split('')
            .map((digit) => digit + digit)
            .join('');
    }
    const read = (start: number) => {
        return Number.parseInt(digits.slice(start, start + 2), 16) / 255;
    };
    return {
        rgb: [read(0), read(2), read(4)] as [number, number, number],
        alpha: digits.length === 8 ? read(6) : 1,
    };
}

function blend(
    top: [number, number, number],
    alpha: number,
    under: [number, number, number],
): [number, number, number] {
    return top.map((channel, index) => {
        return channel * alpha + under[index] * (1 - alpha);
    }) as [number, number, number];
}

function toLuminance(rgb: [number, number, number]) {
    const [r, g, b] = rgb.map((channel) => {
        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toContrastOnSlide(
    colors: { color: string; backgroundColor: string },
    mode: 'dark' | 'light',
) {
    const slide: [number, number, number] =
        mode === 'light' ? [1, 1, 1] : [0, 0, 0];
    const background = toChannels(colors.backgroundColor);
    const box = blend(background.rgb, background.alpha, slide);
    const text = toChannels(colors.color);
    const words = blend(text.rgb, text.alpha, box);
    const a = toLuminance(box);
    const b = toLuminance(words);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function toLightness(hex: string) {
    const { rgb } = toChannels(hex);
    return (Math.max(...rgb) + Math.min(...rgb)) / 2;
}

describe('the saved list', () => {
    test('is one list for every slide document, carried with the editors', () => {
        expect(CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME).toBe(
            'slide-editor-canvas-item-saved-presets',
        );
        expect(
            classifySettingKey('local', CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME),
        ).toBe('documents.editors');
    });
});

describe('what kind of box a look is put on', () => {
    test('words: text and Bible, alignment for plain text only', () => {
        const expected: Record<
            CanvasItemKindType,
            [boolean, boolean, boolean]
        > = {
            text: [true, true, false],
            bible: [true, false, false],
            image: [false, false, true],
            video: [false, false, true],
            html: [false, false, false],
            audio: [false, false, false],
            youtube: [false, false, false],
            website: [false, false, false],
            camera: [false, false, false],
            error: [false, false, false],
        };
        for (const type of canvasItemList) {
            const target = genCanvasItemPresetTarget(type);
            expect(
                [
                    target.hasTextProps,
                    target.isAlignmentEnabled,
                    target.isMedia,
                ],
                type,
            ).toEqual(expected[type]);
        }
    });
});

describe('the look a box wears now', () => {
    test('a text box: its box and its words, nothing of where or what', () => {
        const look = readCanvasItemLook(genTextProps(), TEXT_TARGET);
        expect(look).toEqual({
            kind: 'text',
            box: {
                backgroundColor: '#0000008B',
                backdropFilter: 4,
                roundSizePercentage: 10,
                roundSizePixel: 0,
                blendMode: 'multiply',
                shadow: SHADOW,
            },
            text: {
                color: '#FFFFFF',
                fontSize: 60,
                fontFamily: 'Georgia',
                fontWeight: '700',
                textHorizontalAlignment: 'left',
                textVerticalAlignment: 'end',
            },
        });
        expectCleanLook(look);
        // A copy of the shadow, never the box's own object.
        const props = genTextProps();
        expect(readCanvasItemLook(props, TEXT_TARGET).box.shadow).not.toBe(
            props.shadow,
        );
    });

    test('absent blend and shadow read as the values that clear them', () => {
        const { blendMode: _blend, shadow: _shadow, ...props } = genTextProps();
        const look = readCanvasItemLook(props, TEXT_TARGET);
        expect(look.box.blendMode).toBe('normal');
        expect(look.box.shadow).toBeNull();
    });

    test('a picture wears a box look, whatever else its props hold', () => {
        const look = readCanvasItemLook(
            { ...genTextProps(), type: 'image' },
            IMAGE_TARGET,
        );
        expect(look.kind).toBe('box');
        expect(look).not.toHaveProperty('text');
        expectCleanLook(look);
    });

    test('a Bible passage is a box of words', () => {
        const look = readCanvasItemLook(
            { ...genTextProps(), type: 'bible' },
            BIBLE_TARGET,
        );
        expect(look.kind).toBe('text');
        expect(look.text?.fontSize).toBe(60);
    });

    test('out-of-range values are read inside what a field could hold', () => {
        const look = readCanvasItemLook(
            genTextProps({
                backgroundColor: 'red',
                backdropFilter: 900,
                roundSizePercentage: -4,
                roundSizePixel: 99999,
                blendMode: 'glow',
                shadow: { kind: 'inset' },
                fontFamily: '   ',
                fontWeight: 700,
                textHorizontalAlignment: 'justify',
            }),
            TEXT_TARGET,
        );
        expect(look.box).toEqual({
            backgroundColor: '#00000000',
            backdropFilter: 200,
            roundSizePercentage: 0,
            roundSizePixel: 2000,
            blendMode: 'normal',
            shadow: null,
        });
        expect(look.text).toMatchObject({
            fontFamily: null,
            fontWeight: null,
            textHorizontalAlignment: 'center',
        });
    });
});

describe('the patch a saved look writes', () => {
    const textLook = readCanvasItemLook(genTextProps(), TEXT_TARGET);
    const boxLook: CanvasItemLookType = {
        kind: 'box',
        box: textLook.box,
    };

    test('on a picture: the box alone', () => {
        expect(
            Object.keys(genCanvasItemLookPatch(boxLook, IMAGE_TARGET)).sort(),
        ).toEqual(BOX_KEYS);
        // A text look on a picture (the row never offers one) still only
        // dresses the box.
        expect(
            Object.keys(genCanvasItemLookPatch(textLook, IMAGE_TARGET)).sort(),
        ).toEqual(BOX_KEYS);
    });

    test('on a Bible passage: the box and the words, never the alignment', () => {
        expect(
            Object.keys(genCanvasItemLookPatch(textLook, BIBLE_TARGET)).sort(),
        ).toEqual([...BOX_KEYS, ...TEXT_KEYS].sort());
    });

    test('on a text box: the box, the words and their alignment', () => {
        const patch = genCanvasItemLookPatch(textLook, TEXT_TARGET);
        expect(Object.keys(patch).sort()).toEqual(
            [...BOX_KEYS, ...TEXT_KEYS, ...ALIGNMENT_KEYS].sort(),
        );
        expect(patch).toMatchObject({
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'end',
            fontFamily: 'Georgia',
        });
        expectNoNeverKeys(patch);
    });

    test('a box look on a box of words leaves the words alone', () => {
        expect(
            Object.keys(genCanvasItemLookPatch(boxLook, TEXT_TARGET)).sort(),
        ).toEqual(BOX_KEYS);
    });

    test('what a look has none of is CLEARED, in values every copy keeps', () => {
        const bareLook: CanvasItemLookType = {
            kind: 'text',
            box: {
                backgroundColor: '#00000000',
                backdropFilter: 0,
                roundSizePercentage: 0,
                roundSizePixel: 0,
                blendMode: 'normal',
                shadow: null,
            },
            text: {
                color: '#FFFFFF',
                fontSize: 40,
                fontFamily: null,
                fontWeight: null,
                textHorizontalAlignment: 'center',
                textVerticalAlignment: 'center',
            },
        };
        const patch = genCanvasItemLookPatch(bareLook, TEXT_TARGET);
        expect(patch).toMatchObject({
            shadow: null,
            blendMode: 'normal',
            fontFamily: null,
            fontWeight: null,
        });
        expectNoUndefined(patch);
        // The panel's copy (`structuredClone`) and the document on disk
        // (JSON) both keep every key.
        expect(structuredClone(patch)).toEqual(patch);
        expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
        // ...and the box's own cleanup then takes them off.
        expect(checkIsBlending(patch.blendMode as string)).toBe(false);
        expect(toValidCanvasShadow(patch.shadow)).toBeNull();
    });

    test('a look put on a box and saved, the box opens again as a text box', () => {
        const before = genTextProps();
        const bare = readCanvasItemLook(
            genTextProps({ fontFamily: null, fontWeight: null }),
            TEXT_TARGET,
        );
        const after = JSON.parse(
            JSON.stringify({
                ...before,
                ...genCanvasItemLookPatch(bare, TEXT_TARGET),
            }),
        );
        expect(checkIsValidTextStyleProps(after)).toBe(true);
        expect(after.fontFamily).toBeNull();
        expect(after.fontWeight).toBeNull();
    });

    test('Save then pick on another box: the same look, the box where it was', () => {
        const source = genTextProps();
        const other = genTextProps({
            id: 9,
            top: 10,
            left: 20,
            width: 300,
            height: 100,
            rotate: 0,
            text: 'Other words',
            backgroundColor: '#FF000080',
            backdropFilter: 0,
            roundSizePercentage: 0,
            blendMode: undefined,
            shadow: undefined,
            color: '#000000',
            fontSize: 20,
            fontFamily: null,
            fontWeight: null,
            textHorizontalAlignment: 'right',
            textVerticalAlignment: 'start',
        });
        const look = readCanvasItemLook(source, TEXT_TARGET);
        const dressed = {
            ...other,
            ...genCanvasItemLookPatch(look, TEXT_TARGET),
        };
        expect(readCanvasItemLook(dressed, TEXT_TARGET)).toEqual(look);
        for (const key of ['id', 'top', 'left', 'width', 'height', 'rotate']) {
            expect(dressed[key as keyof typeof dressed]).toBe(
                other[key as keyof typeof other],
            );
        }
        expect(dressed.text).toBe('Other words');
    });

    test('on a Bible passage the passage keeps its own alignment', () => {
        const look = readCanvasItemLook(genTextProps(), TEXT_TARGET);
        const passage = genTextProps({
            type: 'bible',
            textHorizontalAlignment: 'center',
            textVerticalAlignment: 'center',
        });
        const dressed = {
            ...passage,
            ...genCanvasItemLookPatch(look, BIBLE_TARGET),
        };
        expect(dressed.textHorizontalAlignment).toBe('center');
        expect(dressed.textVerticalAlignment).toBe('center');
        expect(dressed.fontFamily).toBe('Georgia');
    });
});

describe('a saved look read off disk', () => {
    const BASE = { id: 'p1', name: 'Mine' };
    const BOX = {
        backgroundColor: '#12345678',
        backdropFilter: 10,
        roundSizePercentage: 20,
        roundSizePixel: 6,
        blendMode: 'screen',
        shadow: SHADOW,
    };
    const TEXT = {
        color: '#ABCDEF',
        fontSize: 72,
        fontFamily: 'Georgia',
        fontWeight: '300',
        textHorizontalAlignment: 'right',
        textVerticalAlignment: 'start',
    };

    test('a box look and a text look come back as they were saved', () => {
        expect(
            toCanvasItemSavedPreset({ kind: 'box', box: BOX }, BASE),
        ).toEqual({ ...BASE, kind: 'box', box: BOX });
        expect(
            toCanvasItemSavedPreset(
                { kind: 'text', box: BOX, text: TEXT },
                BASE,
            ),
        ).toEqual({ ...BASE, kind: 'text', box: BOX, text: TEXT });
    });

    test('only a look of a known kind with a box is a look', () => {
        for (const kind of [undefined, 'shape', 'TEXT', 5, null]) {
            expect(
                toCanvasItemSavedPreset({ kind, box: BOX, text: TEXT }, BASE),
            ).toBeNull();
        }
        for (const box of [undefined, null, 'box', [], [BOX]]) {
            expect(
                toCanvasItemSavedPreset({ kind: 'box', box }, BASE),
            ).toBeNull();
            expect(
                toCanvasItemSavedPreset(
                    { kind: 'text', box, text: TEXT },
                    BASE,
                ),
            ).toBeNull();
        }
    });

    test('a text look needs its words, with a size', () => {
        for (const text of [undefined, null, [], 'Georgia']) {
            expect(
                toCanvasItemSavedPreset({ kind: 'text', box: BOX, text }, BASE),
            ).toBeNull();
        }
        for (const fontSize of [undefined, '72', Number.NaN, Infinity]) {
            expect(
                toCanvasItemSavedPreset(
                    { kind: 'text', box: BOX, text: { ...TEXT, fontSize } },
                    BASE,
                ),
            ).toBeNull();
        }
    });

    test('a box look keeps no words, even when the entry has some', () => {
        const preset = toCanvasItemSavedPreset(
            { kind: 'box', box: BOX, text: TEXT, top: 5, left: 6 },
            BASE,
        );
        expect(Object.keys(preset!).sort()).toEqual([
            'box',
            'id',
            'kind',
            'name',
        ]);
    });

    test('colours that are not hex are replaced, never passed on', () => {
        for (const backgroundColor of ['red', '#12', '#GGGGGG', 12, null]) {
            const preset = toCanvasItemSavedPreset(
                { kind: 'box', box: { ...BOX, backgroundColor } },
                BASE,
            );
            expect(preset!.box.backgroundColor).toBe('#00000000');
        }
        for (const color of ['blue', 'rgb(0, 0, 0)', '#1234567890']) {
            const preset = toCanvasItemSavedPreset(
                { kind: 'text', box: BOX, text: { ...TEXT, color } },
                BASE,
            );
            expect(preset!.text!.color).toBe('#FFFFFF');
        }
    });

    test('numbers are held inside what each field could hold', () => {
        const toBox = (box: Record<string, unknown>) => {
            return toCanvasItemSavedPreset(
                { kind: 'box', box: { ...BOX, ...box } },
                BASE,
            )!.box;
        };
        expect(toBox({ backdropFilter: 999 }).backdropFilter).toBe(200);
        expect(toBox({ backdropFilter: -1 }).backdropFilter).toBe(0);
        expect(toBox({ backdropFilter: '9' }).backdropFilter).toBe(0);
        expect(toBox({ roundSizePercentage: 150 }).roundSizePercentage).toBe(
            100,
        );
        expect(toBox({ roundSizePercentage: -3 }).roundSizePercentage).toBe(0);
        expect(toBox({ roundSizePixel: 5000 }).roundSizePixel).toBe(2000);
        expect(toBox({ roundSizePixel: -1 }).roundSizePixel).toBe(0);
        const toText = (text: Record<string, unknown>) => {
            return toCanvasItemSavedPreset(
                { kind: 'text', box: BOX, text: { ...TEXT, ...text } },
                BASE,
            )!.text!;
        };
        expect(toText({ fontSize: 0 }).fontSize).toBe(1);
        expect(toText({ fontSize: -20 }).fontSize).toBe(1);
        expect(toText({ fontSize: 99999 }).fontSize).toBe(2000);
    });

    test('a bad shadow, blend, font or alignment reads as none', () => {
        const preset = toCanvasItemSavedPreset(
            {
                kind: 'text',
                box: { ...BOX, blendMode: 'glow', shadow: { kind: 'inset' } },
                text: {
                    ...TEXT,
                    fontFamily: '',
                    fontWeight: 700,
                    textHorizontalAlignment: 'justify',
                    textVerticalAlignment: 'middle',
                },
            },
            BASE,
        );
        expect(preset!.box.blendMode).toBe('normal');
        expect(preset!.box.shadow).toBeNull();
        expect(preset!.text).toMatchObject({
            fontFamily: null,
            fontWeight: null,
            textHorizontalAlignment: 'center',
            textVerticalAlignment: 'center',
        });
        const noBlend = toCanvasItemSavedPreset(
            { kind: 'box', box: { ...BOX, blendMode: 5 } },
            BASE,
        );
        expect(noBlend!.box.blendMode).toBe('normal');
    });
});

describe('which saved looks a box can wear', () => {
    const boxPreset: CanvasItemLookType = {
        kind: 'box',
        box: readCanvasItemLook(genTextProps(), IMAGE_TARGET).box,
    };
    const textPreset = readCanvasItemLook(genTextProps(), TEXT_TARGET);

    test('words wear both kinds; any other box only the box looks', () => {
        for (const target of [TEXT_TARGET, BIBLE_TARGET]) {
            expect(checkIsCanvasItemPresetFor(boxPreset, target)).toBe(true);
            expect(checkIsCanvasItemPresetFor(textPreset, target)).toBe(true);
        }
        for (const target of [IMAGE_TARGET, CAMERA_TARGET]) {
            expect(checkIsCanvasItemPresetFor(boxPreset, target)).toBe(true);
            expect(checkIsCanvasItemPresetFor(textPreset, target)).toBe(false);
        }
    });
});

describe('the app looks', () => {
    function toIds(type: CanvasItemKindType) {
        return getCanvasItemPresetList(genCanvasItemPresetTarget(type)).map(
            (preset) => preset.id,
        );
    }

    test('words get all five; a picture what it can show; any other box three', () => {
        const all = [
            'plain',
            'shadow',
            'glass-effect',
            'highlight',
            'urgent-alert',
        ];
        expect(toIds('text')).toEqual(all);
        expect(toIds('bible')).toEqual(all);
        expect(toIds('image')).toEqual(['plain', 'shadow']);
        expect(toIds('video')).toEqual(['plain', 'shadow']);
        for (const type of ['html', 'camera', 'youtube', 'website'] as const) {
            expect(toIds(type), type).toEqual([
                'plain',
                'shadow',
                'glass-effect',
            ]);
        }
    });

    test('no look sets a size or a font, nor anything of where the box is', () => {
        for (const preset of CANVAS_ITEM_PRESET_LIST) {
            for (const mode of ['dark', 'light', null] as const) {
                const patch = genCanvasItemPresetPatch(
                    preset,
                    TEXT_TARGET,
                    mode,
                );
                expect(patch).not.toHaveProperty('fontSize');
                expect(patch).not.toHaveProperty('fontFamily');
                expectNoNeverKeys(patch);
                expectNoUndefined(patch);
                expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
                expect(Object.keys(patch)).toEqual(
                    expect.arrayContaining(BOX_KEYS),
                );
            }
        }
    });

    test('with no side, a look is worn as written', () => {
        for (const preset of CANVAS_ITEM_PRESET_LIST) {
            expect(genCanvasItemPresetColors(preset, null)).toEqual({
                color: preset.color,
                backgroundColor: preset.box.backgroundColor,
            });
        }
    });

    test('on either side, every look reads at 4.5 to 1 over a slide of that side', () => {
        for (const preset of CANVAS_ITEM_PRESET_LIST) {
            for (const mode of ['dark', 'light'] as const) {
                const colors = genCanvasItemPresetColors(preset, mode);
                expect(
                    toContrastOnSlide(colors, mode),
                    `${preset.id} on ${mode}: ${JSON.stringify(colors)}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    test('a side moves only how light each colour is, its see-through kept', () => {
        for (const preset of CANVAS_ITEM_PRESET_LIST) {
            const alphaHex = preset.box.backgroundColor.slice(7, 9);
            for (const mode of ['dark', 'light'] as const) {
                const { backgroundColor } = genCanvasItemPresetColors(
                    preset,
                    mode,
                );
                expect(backgroundColor.slice(7, 9).toUpperCase()).toBe(
                    alphaHex.toUpperCase(),
                );
            }
        }
        // Light words on the dark side, dark ones on the light side.
        for (const preset of CANVAS_ITEM_PRESET_LIST) {
            const dark = genCanvasItemPresetColors(preset, 'dark');
            const light = genCanvasItemPresetColors(preset, 'light');
            expect(toLightness(dark.color), preset.id).toBeGreaterThan(0.5);
            expect(toLightness(light.color), preset.id).toBeLessThan(0.5);
        }
    });

    test('on a text box the switch side decides the words, and Highlight is bold', () => {
        const plainDark = genCanvasItemPresetPatch(
            findPreset('plain'),
            TEXT_TARGET,
            'dark',
        );
        const plainLight = genCanvasItemPresetPatch(
            findPreset('plain'),
            TEXT_TARGET,
            'light',
        );
        expect(plainDark.color).toBe('#FFFFFF');
        expect(toLightness(plainLight.color as string)).toBeLessThan(0.5);
        // The font's own weight, written out: a look never leaves the bold
        // of the one pressed before it.
        expect(plainDark.fontWeight).toBeNull();
        expect(plainDark).toMatchObject({
            backgroundColor: '#00000000',
            shadow: null,
            blendMode: 'normal',
        });

        const urgentDark = genCanvasItemPresetPatch(
            findPreset('urgent-alert'),
            TEXT_TARGET,
            'dark',
        );
        const urgentLight = genCanvasItemPresetPatch(
            findPreset('urgent-alert'),
            TEXT_TARGET,
            'light',
        );
        expect(urgentDark.fontWeight).toBe('700');
        expect(urgentLight.fontWeight).toBe('700');
        expect(
            toLightness(urgentLight.backgroundColor as string),
        ).toBeGreaterThan(toLightness(urgentDark.backgroundColor as string));
        expect(
            genCanvasItemPresetPatch(
                findPreset('highlight'),
                BIBLE_TARGET,
                'light',
            ).fontWeight,
        ).toBe('700');
    });

    test('a look on words never depends on the look pressed before it', () => {
        for (const mode of ['dark', 'light'] as const) {
            for (const preset of getCanvasItemPresetList(TEXT_TARGET)) {
                const patch = genCanvasItemPresetPatch(
                    preset,
                    TEXT_TARGET,
                    mode,
                );
                // Every field a look on words can change is in its patch,
                // so the box ends up the same whatever was on it before.
                expect(Object.keys(patch).sort()).toEqual(
                    [
                        'backdropFilter',
                        'backgroundColor',
                        'blendMode',
                        'color',
                        'fontWeight',
                        'roundSizePercentage',
                        'roundSizePixel',
                        'shadow',
                    ].sort(),
                );
                expect(patch.fontWeight).toBe(
                    ['highlight', 'urgent-alert'].includes(preset.id)
                        ? '700'
                        : null,
                );
            }
        }
    });

    test('on a picture a look is the box alone, as written, whatever the side', () => {
        for (const id of ['plain', 'shadow'] as const) {
            const preset = findPreset(id);
            for (const mode of ['dark', 'light', null] as const) {
                const patch = genCanvasItemPresetPatch(
                    preset,
                    IMAGE_TARGET,
                    mode,
                );
                expect(Object.keys(patch).sort()).toEqual(BOX_KEYS);
                expect(patch).toEqual({ ...preset.box });
            }
        }
        const glass = genCanvasItemPresetPatch(
            findPreset('glass-effect'),
            CAMERA_TARGET,
            'light',
        );
        expect(glass).not.toHaveProperty('color');
        expect(glass.backgroundColor).toBe('#FFFFFF26');
    });

    test('a patch is a copy: changing it never changes the look', () => {
        const patch = genCanvasItemPresetPatch(
            findPreset('glass-effect'),
            TEXT_TARGET,
            null,
        );
        patch.backgroundColor = '#000000';
        patch.backdropFilter = 0;
        expect(findPreset('glass-effect').box.backgroundColor).toBe(
            '#FFFFFF26',
        );
        expect(findPreset('glass-effect').box.backdropFilter).toBe(12);
    });
});
