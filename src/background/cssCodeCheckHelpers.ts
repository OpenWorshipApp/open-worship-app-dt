/**
 * Whether a person's own CSS animation code may be kept (2026-11-19, the
 * goal _chatbot can help handle css and glsl code editing_: a CSS animation
 * has code a person -- and the help window's assistant -- writes, as a
 * shader has).
 *
 * The code is a style sheet for the boxes the app draws
 * (`cssCodeAnimationHelpers`), held in a shadow root on the screen
 * (`cssCodeAnimationElementHelpers`), so its rules reach nothing outside
 * the animation. What this check keeps out is everything else a style
 * sheet can do on a projector:
 *
 * - load anything: no `url()`, `@import`, `image-set()`, `@font-face` -- a
 *   run sheet from somebody else's computer can carry no address onto a
 *   projector, the rule the built-in effects were made under;
 * - hide a word from this check: no backslash escape (`u\rl(`), printable
 *   ASCII only, and the patterns read with the comments taken out too;
 * - reach out of its box: no `:host`, `::slotted`, `::part`, and no `<`, so
 *   Copy Code's page cannot be closed early by the code inside it;
 * - repaint the screen every frame: a `@keyframes` may move `transform`
 *   and `opacity` (and the transform-like `translate`, `rotate`, `scale`,
 *   `offset-distance`) and nothing else -- the rule the built-in effects
 *   keep (CLAUDE.md's rule against animated paint properties: one moving
 *   colour at screen size held an old computer at sixty paints a second).
 *
 * A leaf: imports nothing, so the value parser takes it with no cycle.
 */

/** A person's own CSS animation, in characters, as a shader's. */
export const MAX_CSS_CODE_LENGTH = 12000;

const CODE_CHAR_PATTERN = /^[\t\n\r\x20-\x7E]*$/;

// Each pattern is read on the code with its comments taken out and as it
// stands; English, for the model and the log, as a compiler's words are.
const FORBIDDEN_LIST: [RegExp, string][] = [
    [
        /\\/,
        'The CSS has a backslash (\\); escapes are not allowed, write the ' +
            'characters themselves.',
    ],
    [/</, 'The CSS has a "<"; this is CSS only, with no HTML.'],
    [
        /@import\b/i,
        'The CSS has an @import; an animation cannot load anything.',
    ],
    [
        /@font-face\b/i,
        'The CSS has an @font-face; an animation cannot load fonts.',
    ],
    [/@namespace\b/i, 'The CSS has an @namespace, which is not allowed.'],
    [
        /\burl\s*\(/i,
        'The CSS has a url(); an animation cannot load pictures or files -- ' +
            'draw with gradients and shapes instead.',
    ],
    [
        /\bimage(?:-set)?\s*\(/i,
        'The CSS has an image() or image-set(); an animation cannot load ' +
            'pictures.',
    ],
    [/\bsrc\s*\(/i, 'The CSS has a src(), which is not allowed.'],
    [/\belement\s*\(/i, 'The CSS has an element(), which is not allowed.'],
    [
        /\bexpression\s*\(/i,
        'The CSS has an expression(), which is not allowed.',
    ],
    [/-moz-binding\b/i, 'The CSS has a -moz-binding, which is not allowed.'],
    [/\bbehavior\s*:/i, 'The CSS has a behavior, which is not allowed.'],
    [
        /:host\b/i,
        'The CSS styles :host; it styles only the boxes inside the ' +
            'animation (.scene, .layer, .dot).',
    ],
    [/::?slotted\b/i, 'The CSS has ::slotted, which is not allowed.'],
    [/::part\b/i, 'The CSS has ::part, which is not allowed.'],
];

/** What a `@keyframes` may move: the compositor's properties alone. */
const KEYFRAME_PROPERTY_SET = new Set([
    'transform',
    'opacity',
    'translate',
    'rotate',
    'scale',
    'offset-distance',
    'animation-timing-function',
]);

const KEYFRAMES_HEAD_PATTERN = /@(?:-webkit-)?keyframes\s+([^\s{]+)\s*\{/gi;
const DECLARATION_PATTERN = /([-a-z]+)\s*:/gi;

function stripComments(code: string) {
    return code.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ');
}

/** Each `@keyframes` with what its braces hold. */
function listKeyframes(code: string) {
    const list: { name: string; body: string }[] = [];
    for (const match of code.matchAll(KEYFRAMES_HEAD_PATTERN)) {
        const start = (match.index ?? 0) + match[0].length;
        let depth = 1;
        let index = start;
        while (index < code.length && depth > 0) {
            if (code[index] === '{') {
                depth += 1;
            } else if (code[index] === '}') {
                depth -= 1;
            }
            index += 1;
        }
        list.push({ name: match[1], body: code.slice(start, index - 1) });
    }
    return list;
}

/**
 * Why a person's CSS animation cannot be kept, in English for the model and
 * a log, or null when it can.
 */
export function checkCssCodeProblem(code: unknown): string | null {
    if (typeof code !== 'string' || code.trim() === '') {
        return 'The CSS is empty.';
    }
    if (code.length > MAX_CSS_CODE_LENGTH) {
        return `The CSS is longer than ${MAX_CSS_CODE_LENGTH} characters.`;
    }
    if (!CODE_CHAR_PATTERN.test(code)) {
        return (
            'The CSS has characters other than plain ASCII; write a symbol ' +
            'with shapes instead, and words in English letters.'
        );
    }
    const bare = stripComments(code);
    for (const [pattern, problem] of FORBIDDEN_LIST) {
        if (pattern.test(bare) || pattern.test(code)) {
            return problem;
        }
    }
    for (const { name, body } of listKeyframes(bare)) {
        for (const declaration of body.matchAll(DECLARATION_PATTERN)) {
            const property = declaration[1].toLowerCase();
            if (!KEYFRAME_PROPERTY_SET.has(property)) {
                return (
                    `@keyframes ${name} animates ${property}; a keyframe ` +
                    'may move only transform and opacity (translate, ' +
                    'rotate, scale), because anything else repaints the ' +
                    'whole screen every frame on an old computer. Move ' +
                    'or fade a layer that holds the colour instead.'
                );
            }
        }
    }
    return null;
}

/**
 * GLSL or CSS, by what the code is: a shader always has its `mainImage`,
 * and a style sheet never does.
 */
export function checkIsGlslCodeText(code: string) {
    return /\bmainImage\s*\(/.test(code);
}
