/**
 * The one blend-mode vocabulary this app offers, shared by the foreground
 * widgets (`presenter-foreground/propertiesSettingHelpers.tsx`) and by a
 * slide's canvas items (`slide-editor/canvas/CanvasItem.ts`). A leaf module on
 * purpose -- it imports NOTHING, so the canvas side never pulls the whole
 * foreground panel in to ask what `multiply` is called in Khmer.
 */

export const DEFAULT_BLEND_MODE = 'normal';

/**
 * Every `mix-blend-mode` Chromium implements except `plus-darker`, which is
 * Safari's alone, grouped the way a compositing menu groups them. A video of
 * falling snow shot on black is put over the slide with `screen`; that is what
 * this list is for.
 *
 * The group names are written for a volunteer rather than for a compositor --
 * what the group DOES, not the term of art.
 *
 * `labelKey` is an ENGLISH dictionary key and the lookup that reads it is
 * dynamic, so `tranKeyCoverage.test.ts` parses this list as SOURCE TEXT: keep
 * every key a plain literal and keep the `] as const;` that closes the list.
 * `Screen Blend` rather than `Screen`, because the dictionary's `Screen` is the
 * projector -- a different sense that must never be shown here.
 */
export const BLEND_MODE_GROUP_LIST = [
    {
        labelKey: 'Darker',
        modes: [
            { value: 'darken', labelKey: 'Darken' },
            { value: 'multiply', labelKey: 'Multiply' },
            { value: 'color-burn', labelKey: 'Color Burn' },
        ],
    },
    {
        labelKey: 'Brighter',
        modes: [
            { value: 'lighten', labelKey: 'Lighten' },
            { value: 'screen', labelKey: 'Screen Blend' },
            { value: 'color-dodge', labelKey: 'Color Dodge' },
            { value: 'plus-lighter', labelKey: 'Add' },
        ],
    },
    {
        labelKey: 'Stronger Contrast',
        modes: [
            { value: 'overlay', labelKey: 'Overlay' },
            { value: 'soft-light', labelKey: 'Soft Light' },
            { value: 'hard-light', labelKey: 'Hard Light' },
        ],
    },
    {
        labelKey: 'Compare',
        modes: [
            { value: 'difference', labelKey: 'Difference' },
            { value: 'exclusion', labelKey: 'Exclusion' },
        ],
    },
    {
        labelKey: 'Color Parts',
        modes: [
            { value: 'hue', labelKey: 'Hue' },
            { value: 'saturation', labelKey: 'Saturation' },
            { value: 'color', labelKey: 'Color' },
            { value: 'luminosity', labelKey: 'Value' },
        ],
    },
] as const;

export type BlendModeType =
    | (typeof BLEND_MODE_GROUP_LIST)[number]['modes'][number]['value']
    | typeof DEFAULT_BLEND_MODE;

const blendModeValueSet = new Set<string>(
    BLEND_MODE_GROUP_LIST.flatMap((group) => {
        return group.modes.map((mode) => {
            return mode.value as string;
        });
    }),
);

/**
 * A blend mode reaches the screen as a CSS declaration, and ONE unparseable
 * value voids that whole declaration -- a hand-edited setting or slide document
 * would silently unstyle a live widget. Anything unknown falls back to no
 * blending.
 */
export function toValidBlendMode(value: string | null | undefined) {
    return (
        value !== null && value !== undefined && blendModeValueSet.has(value)
            ? value
            : DEFAULT_BLEND_MODE
    ) as BlendModeType;
}

/**
 * True only for a value that actually paints differently. `normal` is stored
 * NOWHERE -- a canvas item leaves the key off entirely -- so that every slide
 * document written before this existed reads back byte for byte the same.
 */
export function checkIsBlending(value: string | null | undefined) {
    return toValidBlendMode(value) !== DEFAULT_BLEND_MODE;
}
