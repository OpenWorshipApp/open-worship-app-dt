// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { CssAnimationType } from './animationValueHelpers';
import {
    CSS_CODE_DOT_COUNT_MAP,
    CSS_CODE_LAYER_COUNT,
    CSS_CODE_STARTER,
    genCssCodeAnimationHtml,
    genCssCodeBoxes,
    genCssCodeFrameCss,
    genCssCodeStillCss,
    findCssCodeHint,
} from './cssCodeAnimationHelpers';
import { genCssCodeAnimationElement } from './cssCodeAnimationElementHelpers';

function genAnimation(
    overrides: Partial<CssAnimationType> = {},
): CssAnimationType {
    return {
        engine: 'css',
        name: 'custom',
        code: CSS_CODE_STARTER,
        colors: ['#000000', '#FF0000'],
        speed: 'normal',
        density: 'normal',
        opacity: 100,
        blend: 'normal',
        ...overrides,
    };
}

describe('genCssCodeBoxes', () => {
    it('draws only the boxes the code names', () => {
        expect(genCssCodeBoxes('.scene { opacity: 1; }', 'high')).toEqual([]);
        const layers = genCssCodeBoxes('.layer { opacity: 1; }', 'high');
        expect(layers).toHaveLength(CSS_CODE_LAYER_COUNT);
        expect(layers[0].children).toEqual([]);
        const dots = genCssCodeBoxes('.dot { opacity: 1; }', 'low');
        expect(dots).toHaveLength(CSS_CODE_LAYER_COUNT);
        expect(dots[2].children).toHaveLength(CSS_CODE_DOT_COUNT_MAP.low);
    });

    it('draws none for boxes a comment names', () => {
        // Every effect's code opens on a comment explaining the boxes.
        expect(
            genCssCodeBoxes('/* .layer x 6, .dot x N */ .scene {}', 'high'),
        ).toEqual([]);
        // One left open runs to the end, as in a browser.
        expect(genCssCodeBoxes('.scene {} /* .dot', 'high')).toEqual([]);
        expect(
            genCssCodeBoxes('/* .dot */ .layer { opacity: 1; }', 'low')[0]
                .children,
        ).toEqual([]);
    });

    it('places each dot the same every time, inside the picture', () => {
        const first = genCssCodeBoxes('.dot {}', 'normal');
        expect(genCssCodeBoxes('.dot {}', 'normal')).toEqual(first);
        for (const dot of first.flatMap((layer) => layer.children)) {
            const x = Number(dot.variables['--x']);
            const r = Number(dot.variables['--r']);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(100);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        }
    });
});

describe('findCssCodeHint', () => {
    it('says when the dots are never placed', () => {
        // The snowfall a model wrote, seen live: one column at the left.
        expect(
            findCssCodeHint(
                '.dot { width: 1cqmin; animation: fall 10s infinite; }',
            ),
        ).toContain('left: calc(var(--x) * 1%)');
        expect(findCssCodeHint(CSS_CODE_STARTER)).toBeNull();
        expect(
            findCssCodeHint('.dot { left: calc( var( --x ) * 1%); }'),
        ).toBeNull();
        expect(findCssCodeHint('.scene { opacity: 1; }')).toBeNull();
    });

    it('takes dots placed on purpose, and reads no comment', () => {
        // A band from the left edge, a glow over the whole picture.
        expect(findCssCodeHint('.dot { left: 0; width: 200%; }')).toBeNull();
        expect(findCssCodeHint('.dot:is(:nth-child(1)) { inset: 0; }')).toBe(
            null,
        );
        // A layer placed is not a dot placed; a keyframe is no rule.
        expect(
            findCssCodeHint(
                '.layer { left: 10%; }\n.dot { width: 1cqmin; }\n' +
                    '@keyframes a { to { transform: scale(2); } }',
            ),
        ).not.toBeNull();
        expect(
            findCssCodeHint('.dot { margin-left: 4px; width: 1cqmin; }'),
        ).not.toBeNull();
        // A comment that explains the dots is not code that styles them.
        expect(findCssCodeHint('/* Each .dot has --x */ .scene {}')).toBeNull();
    });
});

describe('the frame and the still rules', () => {
    it('names four colours, a missing one the last', () => {
        const css = genCssCodeFrameCss(genAnimation());
        expect(css).toContain('--color-1: #000000;');
        expect(css).toContain('--color-2: #FF0000;');
        expect(css).toContain('--color-4: #FF0000;');
    });

    it('names the accents as the built-ins go round them', () => {
        // The colours after the ground, in turn -- or the one colour
        // there is -- in six slots, so 1, 2 or 3 accents go round whole.
        const slots = (colors: string[]) => {
            const css = genCssCodeFrameCss(
                genAnimation({ colors: colors as any }),
            );
            return Array.from({ length: 6 }, (_, index) => {
                const match = new RegExp(
                    `--accent-${index + 1}: var\\(--color-(\\d)\\);`,
                ).exec(css);
                return Number(match?.[1]);
            });
        };
        expect(slots(['#000000'])).toEqual([1, 1, 1, 1, 1, 1]);
        expect(slots(['#000000', '#FF0000'])).toEqual([2, 2, 2, 2, 2, 2]);
        expect(slots(['#000000', '#FF0000', '#00FF00'])).toEqual([
            2, 3, 2, 3, 2, 3,
        ]);
        expect(slots(['#000000', '#FF0000', '#00FF00', '#0000FF'])).toEqual([
            2, 3, 4, 2, 3, 4,
        ]);
        // Each layer and dot its own, by its turn among its siblings, and
        // weightless: any rule of the code sets it instead.
        const css = genCssCodeFrameCss(genAnimation());
        expect(css).toContain(
            ':where(.layer, .dot):where(:nth-child(6n + 1)) ' +
                '{ --accent: var(--accent-1); }',
        );
        expect(css).toContain(
            ':where(.layer, .dot):where(:nth-child(6n + 6)) ' +
                '{ --accent: var(--accent-6); }',
        );
    });

    it('gives code Density as a number', () => {
        // Code that draws no dots can still follow Density with it.
        expect(genCssCodeFrameCss(genAnimation({ density: 'low' }))).toContain(
            '--density: 0;',
        );
        expect(genCssCodeFrameCss(genAnimation())).toContain('--density: 1;');
        expect(genCssCodeFrameCss(genAnimation({ density: 'high' }))).toContain(
            '--density: 2;',
        );
    });

    it('holds every animation still where nothing moves', () => {
        expect(genCssCodeStillCss(false, false)).toContain('paused');
        expect(genCssCodeStillCss(true, true)).toBe('');
        expect(genCssCodeStillCss(true, false)).toContain(
            'prefers-reduced-motion',
        );
    });
});

describe('genCssCodeAnimationHtml', () => {
    it('is a page holding the code, its boxes and its speed', () => {
        const html = genCssCodeAnimationHtml(
            genAnimation({ speed: 'fast', opacity: 50 }),
        );
        expect(html).toContain(CSS_CODE_STARTER);
        expect(html).toContain('<div class="scene" style="opacity: 0.5">');
        expect(html).toContain('<div class="dot" style="--i: 0;');
        expect(html).toContain('animation.playbackRate = 2;');
    });
});

describe('genCssCodeAnimationElement', () => {
    it('puts the code in a shadow root of a contained box', () => {
        const { element } = genCssCodeAnimationElement(
            genAnimation({ opacity: 40 }),
            { isMoving: true },
        );
        expect(element.style.contain).toBe('strict');
        expect(element.style.opacity).toBe('0.4');
        const styles = [...element.shadowRoot!.querySelectorAll('style')];
        expect(styles[1].textContent).toBe(CSS_CODE_STARTER);
        // Moving on a screen: nothing held.
        expect(styles[2].textContent).toBe('');
        const scene = element.shadowRoot!.querySelector('.scene')!;
        expect(scene.querySelectorAll(':scope > .layer')).toHaveLength(
            CSS_CODE_LAYER_COUNT,
        );
        // Nothing of it is in the page's own tree.
        expect(element.querySelector('.scene')).toBeNull();
    });

    it('scales each animation as it starts, and stops listening', () => {
        const { element, stop } = genCssCodeAnimationElement(
            genAnimation({ speed: 'slow' }),
            { isMoving: true },
        );
        const dot = element.shadowRoot!.querySelector('.dot') as any;
        const animation = { playbackRate: 1 };
        dot.getAnimations = () => [animation];
        dot.dispatchEvent(new Event('animationstart', { bubbles: true }));
        expect(animation.playbackRate).toBe(0.5);
        stop();
        animation.playbackRate = 1;
        dot.dispatchEvent(new Event('animationstart', { bubbles: true }));
        expect(animation.playbackRate).toBe(1);
    });

    it('holds a still one where it starts', () => {
        const { element } = genCssCodeAnimationElement(genAnimation(), {
            isMoving: false,
        });
        const styles = element.shadowRoot!.querySelectorAll('style');
        expect(styles[2].textContent).toContain('paused');
    });
});
