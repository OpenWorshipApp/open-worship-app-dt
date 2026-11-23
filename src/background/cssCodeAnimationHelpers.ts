import {
    ANIMATION_SPEED_FACTOR_MAP,
    MAX_ANIMATION_COLOR_COUNT,
    type AnimationLevelType,
    type CssAnimationType,
} from './animationValueHelpers';

/**
 * A person's own CSS animation (2026-11-19, the goal _chatbot can help
 * handle css and glsl code editing_): the boxes the app draws, the frame
 * rules under the person's code, and the code a CSS animation's Edit Code
 * opens with -- the same here for the screen
 * (`cssCodeAnimationElementHelpers`), a tile and Copy Code's page.
 *
 * The code styles a FIXED set of boxes, the way a shader colours a fixed
 * set of pixels:
 *
 *     .scene                the whole picture; var(--color-1) its ground
 *       .layer   x 6        full-size layers, --i 0..5
 *         .dot   x N        per layer, N by Density (low 6, normal 12,
 *                           high 20): --i its number, --x and --y a place
 *                           (0..100), --r a size (0..1), the same every time
 *
 * with `--color-1` .. `--color-4` on `.scene` (a missing colour repeats the
 * last), the accents -- the colours after the ground, going round -- as
 * `--accent-1` .. `--accent-6` and on each box as `--accent`, and
 * `--density` (0 low, 1 normal, 2 high), so code that draws no dots can
 * still follow Density. A `.dot` is drawn only when the code
 * names one outside a comment, a `.layer` only when it names either, so a
 * gradient sheet costs no boxes. Speed scales every animation
 * (`playbackRate`), so durations are written as at normal.
 */

export const CSS_CODE_LAYER_COUNT = 6;
export const CSS_CODE_DOT_COUNT_MAP: Record<AnimationLevelType, number> = {
    low: 6,
    normal: 12,
    high: 20,
};

/** `--accent-1` .. `--accent-6` on `.scene`: the accents, going round. */
export const CSS_CODE_ACCENT_SLOT_COUNT = 6;

/** `--density` on `.scene`: Density as a number code can calculate with. */
export const CSS_CODE_DENSITY_INDEX_MAP: Record<AnimationLevelType, number> = {
    low: 0,
    normal: 1,
    high: 2,
};

export type CssCodeBoxType = {
    className: 'layer' | 'dot';
    variables: Record<string, string>;
    children: CssCodeBoxType[];
};

/** A small seeded random source (mulberry32): the same box, the same place. */
function genRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function toFixed(value: number, digits: number) {
    return String(Number(value.toFixed(digits)));
}

/** The code without its comments: what it says, not what it explains. */
function stripCssComments(code: string) {
    return code.replaceAll(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ');
}

/**
 * Which boxes the code names: none drawn that it never styles -- a comment
 * that explains the boxes, as every effect's code does, makes none.
 */
export function checkCssCodeNeeds(code: string) {
    const rules = stripCssComments(code);
    const isDotNeeded = /\bdot\b/.test(rules);
    return {
        isDotNeeded,
        isLayerNeeded: isDotNeeded || /\blayer\b/.test(rules),
    };
}

/** The declarations of every rule whose selector names `.dot`. */
function listDotRuleBodies(rules: string) {
    const bodies: string[] = [];
    // Innermost blocks only: a keyframe's step is matched, never its
    // `@keyframes` around it, and no step names a dot.
    for (const match of rules.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        if (/\.dot\b/.test(match[1])) {
            bodies.push(match[2]);
        }
    }
    return bodies;
}

/**
 * What passes its check and still draws nothing much: dots styled but
 * never placed -- every one at the left edge. Seen live 2026-11-19: a model
 * asked for falling snow wrote sizes and a fall and no `left`, and the
 * whole snowfall was one column a few pixels wide. Said to whoever wrote
 * it (a model cannot see the preview); null when nothing is amiss. Dots
 * placed on purpose -- the waves' bands from the left edge, the breathing
 * glows over the whole picture (`cssEffectCodeHelpers`) -- are no slip.
 */
export function findCssCodeHint(code: string): string | null {
    const rules = stripCssComments(code);
    const isPlaced = listDotRuleBodies(rules).some((body) => {
        return /(?:^|[\s;])(?:left|right|inset)\s*:/.test(body);
    });
    if (/\.dot\b/.test(rules) && !/var\(\s*--x\s*\)/.test(rules) && !isPlaced) {
        return (
            'No .dot reads var(--x), so every dot sits at the left edge: ' +
            'place them with left: calc(var(--x) * 1%) (and top: ' +
            'calc(var(--y) * 1%) unless they move in from an edge), and ' +
            'send the whole code again.'
        );
    }
    return null;
}

/** The boxes under `.scene` for this code and density. */
export function genCssCodeBoxes(
    code: string,
    density: AnimationLevelType,
): CssCodeBoxType[] {
    const { isDotNeeded, isLayerNeeded } = checkCssCodeNeeds(code);
    if (!isLayerNeeded) {
        return [];
    }
    const dotCount = isDotNeeded ? CSS_CODE_DOT_COUNT_MAP[density] : 0;
    return Array.from({ length: CSS_CODE_LAYER_COUNT }, (_, layerIndex) => {
        const random = genRandom(layerIndex * 7919 + 17);
        return {
            className: 'layer',
            variables: { '--i': String(layerIndex) },
            children: Array.from({ length: dotCount }, (_, dotIndex) => {
                return {
                    className: 'dot',
                    variables: {
                        '--i': String(dotIndex),
                        '--x': toFixed(random() * 100, 1),
                        '--y': toFixed(random() * 100, 1),
                        '--r': toFixed(random(), 3),
                    },
                    children: [],
                };
            }),
        };
    });
}

/** `--color-1` .. `--color-4`, a missing one the last there is. */
export function genCssCodeColorVariables(animation: CssAnimationType) {
    const variables: Record<string, string> = {};
    for (let index = 0; index < MAX_ANIMATION_COLOR_COUNT; index++) {
        variables[`--color-${index + 1}`] =
            animation.colors[Math.min(index, animation.colors.length - 1)];
    }
    // The accents, as the built-in effects colour their parts
    // (`genAccents` in `cssAnimationLayerHelpers`): the colours after the
    // ground in turn -- or the one colour there is -- so part i of an
    // effect written as CSS is the colour the built-in gives it. Six slots
    // hold one, two or three accents going round whole.
    const accentCount = Math.max(1, animation.colors.length - 1);
    const firstAccent = animation.colors.length > 1 ? 2 : 1;
    for (let slot = 0; slot < CSS_CODE_ACCENT_SLOT_COUNT; slot++) {
        variables[`--accent-${slot + 1}`] =
            `var(--color-${firstAccent + (slot % accentCount)})`;
    }
    return variables;
}

/**
 * Each box's own `--accent`: box i's slot, i counted among its siblings,
 * so the dots of a layer go round the accents as a built-in's parts do.
 * `:where`, so any rule of the person's sets it instead.
 */
function genCssCodeAccentRules() {
    const rules: string[] = [];
    for (let slot = 1; slot <= CSS_CODE_ACCENT_SLOT_COUNT; slot++) {
        rules.push(
            `:where(.layer, .dot):where(:nth-child(` +
                `${CSS_CODE_ACCENT_SLOT_COUNT}n + ${slot})) ` +
                `{ --accent: var(--accent-${slot}); }`,
        );
    }
    return rules;
}

/**
 * The app's rules under the person's code: the boxes placed, the colours
 * named. The person's code comes after them and wins.
 */
export function genCssCodeFrameCss(animation: CssAnimationType) {
    const colorLines = Object.entries(genCssCodeColorVariables(animation))
        .map(([name, value]) => {
            return `  ${name}: ${value};`;
        })
        .join('\n');
    return [
        '.scene {',
        colorLines,
        `  --density: ${CSS_CODE_DENSITY_INDEX_MAP[animation.density]};`,
        '  position: absolute;',
        '  inset: 0;',
        '  overflow: hidden;',
        '  container-type: size;',
        '  background: var(--color-1);',
        '}',
        '.layer { position: absolute; inset: 0; }',
        '.dot { position: absolute; }',
        ...genCssCodeAccentRules(),
    ].join('\n');
}

/**
 * Last, where nothing moves: every animation held where it starts. Where it
 * does move but is not presented (a tile under the pointer), the person's
 * reduced-motion choice holds it too, as it does a built-in effect.
 */
export function genCssCodeStillCss(isMoving: boolean, isOnScreen: boolean) {
    const rule =
        '.scene, .scene * { animation-play-state: paused !important; }';
    if (!isMoving) {
        return rule;
    }
    return isOnScreen
        ? ''
        : `@media (prefers-reduced-motion: reduce) { ${rule} }`;
}

/**
 * The boxes and what the code can read, said in the opening comment of
 * every code the panel opens on: the starter's, and each built-in effect's
 * written as CSS (`cssEffectCodeHelpers`).
 */
export const CSS_CODE_BOXES_COMMENT = `   The app draws these boxes:
   .scene            the whole picture; var(--color-1) is its ground
     .layer  x 6     full-size layers, --i = 0..5
       .dot  x N     per layer (Density sets N), with --i (its number),
                     --x and --y (0..100, a place), --r (0..1, a size)
   Colors: var(--color-1) .. var(--color-4). var(--accent) is a color
   after the ground, the next for each layer and dot in turn (also
   var(--accent-1) .. var(--accent-6)). --density is 0, 1 or 2.
   Speed scales every animation. @keyframes may move transform and
   opacity only.`;

/**
 * The code a CSS animation's Edit Code opens with when it has none of its
 * own: soft lights drifting up over the ground, in the animation's colours,
 * written to be changed.
 */
export const CSS_CODE_STARTER = `/* A CSS animation.
${CSS_CODE_BOXES_COMMENT} */

.scene {
  background:
    radial-gradient(circle at 50% 120%, var(--color-2), transparent 60%),
    var(--color-1);
}

/* Three layers of lights are enough. */
.layer:nth-child(n + 4) {
  display: none;
}

.dot {
  left: calc(var(--x) * 1%);
  top: calc(var(--y) * 1%);
  width: calc(3cqmin + var(--r) * 9cqmin);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-3), transparent 70%);
  opacity: 0.75;
  animation: drift calc(12s + var(--r) * 10s) ease-in-out
    calc(var(--i) * -1.7s) infinite alternate;
}

.layer:nth-child(2) .dot {
  background: radial-gradient(circle, var(--color-4), transparent 70%);
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(4cqmin, -14cqmin, 0) scale(1.3);
  }
}
`;

function toVariableText(variables: Record<string, string>) {
    return Object.entries(variables)
        .map(([name, value]) => {
            return `${name}: ${value}`;
        })
        .join('; ');
}

function genBoxHtml(box: CssCodeBoxType, indent: string): string {
    const children = box.children
        .map((child) => {
            return `\n${genBoxHtml(child, `${indent}  `)}`;
        })
        .join('');
    const close = children === '' ? '' : `\n${indent}`;
    return (
        `${indent}<div class="${box.className}" ` +
        `style="${toVariableText(box.variables)}">${children}${close}</div>`
    );
}

/**
 * Copy Code for a person's CSS animation: a whole web page that plays it,
 * its speed included.
 */
export function genCssCodeAnimationHtml(animation: CssAnimationType): string {
    const code = animation.code ?? '';
    const boxes = genCssCodeBoxes(code, animation.density)
        .map((box) => {
            return genBoxHtml(box, '  ');
        })
        .join('\n');
    const factor = ANIMATION_SPEED_FACTOR_MAP[animation.speed];
    const opacity =
        animation.opacity < 100
            ? ` style="opacity: ${animation.opacity / 100}"`
            : '';
    return [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8" />',
        '<style>',
        'html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }',
        genCssCodeFrameCss(animation),
        '</style>',
        '<style>',
        code,
        '</style>',
        '</head>',
        '<body>',
        `<div class="scene"${opacity}>`,
        boxes,
        '</div>',
        ...(factor === 1
            ? []
            : [
                  '<script>',
                  'document.getAnimations().forEach((animation) => {',
                  `  animation.playbackRate = ${factor};`,
                  '});',
                  '</script>',
              ]),
        '</body>',
        '</html>',
        '',
    ].join('\n');
}
