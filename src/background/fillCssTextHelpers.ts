import {
    DEFAULT_FILL_PATTERN_SIZE,
    genFillCss,
    genFillMotionPlan,
    type FillCssType,
    type FillMotionPlanType,
    type FillType,
} from './fillValueHelpers';

/** The class a moving fill's stylesheet goes on. */
export const FILL_CSS_CLASS_NAME = 'owa-fill';

const PAINT_PROPERTY_LIST: [keyof FillCssType, string][] = [
    ['backgroundColor', 'background-color'],
    ['backgroundImage', 'background-image'],
    ['backgroundSize', 'background-size'],
    ['backgroundPosition', 'background-position'],
];

function genPaintDeclarations(fill: FillType) {
    const css = genFillCss(fill);
    return PAINT_PROPERTY_LIST.flatMap(([key, property]) => {
        const value = css[key];
        return value === undefined ? [] : [`${property}: ${value};`];
    });
}

function genRule(selector: string, declarations: string[]) {
    return [
        `${selector} {`,
        ...declarations.map((declaration) => {
            return `  ${declaration}`;
        }),
        '}',
    ];
}

function genKeyframes(name: string, steps: [string, string][]) {
    return [
        `@keyframes ${name} {`,
        ...steps.flatMap(([step, transform]) => {
            return [`  ${step} {`, `    transform: ${transform};`, '  }'];
        }),
        '}',
    ];
}

// `ScreenBackgroundFillComp.scss`'s motion, written out: a pattern drifts
// one tile down and right from a layer a tile larger, a gradient sways
// across a layer a quarter larger on every side.
function genMotionParts(plan: FillMotionPlanType) {
    if (plan.animationName === 'app-fill-drift') {
        const tile = `${plan.tilePx ?? DEFAULT_FILL_PATTERN_SIZE}px`;
        return {
            layer: [
                `inset: -${tile} 0 0 -${tile};`,
                `--owa-fill-tile: ${tile};`,
            ],
            animation: `owa-fill-drift ${plan.seconds}s linear infinite`,
            keyframes: genKeyframes('owa-fill-drift', [
                ['from', 'translate3d(0, 0, 0)'],
                [
                    'to',
                    'translate3d(var(--owa-fill-tile), var(--owa-fill-tile), 0)',
                ],
            ]),
        };
    }
    return {
        layer: ['inset: -25%;'],
        animation:
            `owa-fill-sway ${plan.seconds}s ease-in-out infinite ` +
            'alternate',
        keyframes: genKeyframes('owa-fill-sway', [
            ['from', 'translate3d(-8%, -6%, 0)'],
            ['to', 'translate3d(8%, 6%, 0)'],
        ]),
    };
}

/**
 * A fill as CSS a person can take elsewhere (2026-11-14, the user: _each
 * element (gradient pattern) should be able to copy the css_): what a screen
 * paints, at a screen's own size. Pure, and read only by the Background
 * panel's right-click, so the screen window never loads it.
 *
 * A still fill is its declarations alone, for any rule or `style`. A moving
 * one is a whole stylesheet, since it moves as a screen moves it
 * (`ScreenBackgroundFillComp.scss` -- keep the two in step): a layer larger
 * than the element, slid by `transform` alone, which no declaration on one
 * element can say. The element's own content stays over the layer, which
 * sits under it in a stacking context of the element's own. Its keyframes
 * are the same text for every fill -- a pattern's tile comes in through a
 * custom property -- so two fills pasted into one stylesheet cannot change
 * each other's motion.
 */
export function genFillCssText(fill: FillType): string {
    const paint = genPaintDeclarations(fill);
    const plan = genFillMotionPlan(fill);
    if (plan === null) {
        return paint.join('\n');
    }
    const selector = `.${FILL_CSS_CLASS_NAME}`;
    const { layer, animation, keyframes } = genMotionParts(plan);
    return [
        ...genRule(selector, [
            'position: relative;',
            'overflow: hidden;',
            'isolation: isolate;',
        ]),
        ...genRule(`${selector}::before`, [
            'content: "";',
            'position: absolute;',
            ...layer,
            'z-index: -1;',
            ...paint,
            'will-change: transform;',
            `animation: ${animation};`,
        ]),
        ...keyframes,
    ].join('\n');
}
