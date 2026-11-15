// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
    CSS_ANIMATION_KEYFRAMES_CSS,
    CSS_ANIMATION_MOVING_CLASS_NAME,
    CSS_ANIMATION_STYLE_ELEMENT_ID,
    checkIsCssAnimationNodeMoving,
    ensureCssAnimationKeyframes,
    genCssAnimationHtml,
    genCssAnimationNodeStyle,
    genCssAnimationStillMarkup,
    genCssAnimationTree,
    toReactStyle,
    type CssAnimationNodeType,
} from './cssAnimationLayerHelpers';
import {
    ANIMATION_LEVEL_LIST,
    CSS_ANIMATION_NAME_LIST,
    type CssAnimationType,
} from './animationValueHelpers';
import type { AppColorType } from '../others/color/colorValueHelpers';

const COLORS: AppColorType[] = ['#102030', '#C08040', '#4080C0', '#E0D0A0'];
// `r,g,b` of each colour, as `rgba()` writes them.
const allowedRgbSet = new Set(
    COLORS.map((color) => {
        return [1, 3, 5]
            .map((index) => {
                return Number.parseInt(color.slice(index, index + 2), 16);
            })
            .join(',');
    }),
);

function genAnimation(
    overrides: Partial<CssAnimationType> = {},
): CssAnimationType {
    return {
        engine: 'css',
        name: 'aurora',
        colors: COLORS,
        speed: 'normal',
        density: 'normal',
        opacity: 100,
        blend: 'normal',
        ...overrides,
    };
}

function collectNodes(node: CssAnimationNodeType): CssAnimationNodeType[] {
    return [node, ...(node.children ?? []).flatMap(collectNodes)];
}

function collectStyleText(node: CssAnimationNodeType) {
    return collectNodes(node)
        .flatMap((one) => {
            return [one.style, one.movingStyle ?? {}, one.stillStyle ?? {}];
        })
        .flatMap((style) => {
            return Object.values(style);
        })
        .join(' ');
}

function readKeyframes() {
    const map = new Map<string, string>();
    for (const match of CSS_ANIMATION_KEYFRAMES_CSS.matchAll(
        /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g,
    )) {
        map.set(match[1], match[2]);
    }
    return map;
}

describe('the keyframes', () => {
    it('move transform and opacity only: no repaint at screen size', () => {
        const keyframes = readKeyframes();
        expect(keyframes.size).toBeGreaterThanOrEqual(10);
        for (const [name, body] of keyframes) {
            const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map(
                (match) => {
                    return match[1];
                },
            );
            expect(properties.length, name).toBeGreaterThan(0);
            for (const property of properties) {
                expect(
                    ['transform', 'opacity'],
                    `${name}: ${property}`,
                ).toContain(property);
            }
        }
    });

    it('are put in a document once', () => {
        ensureCssAnimationKeyframes(document);
        ensureCssAnimationKeyframes(document);
        const styles = document.querySelectorAll(
            `#${CSS_ANIMATION_STYLE_ELEMENT_ID}`,
        );
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe(CSS_ANIMATION_KEYFRAMES_CSS);
    });
});

describe('genCssAnimationTree', () => {
    const keyframeNames = new Set(readKeyframes().keys());

    for (const name of CSS_ANIMATION_NAME_LIST) {
        for (const density of ANIMATION_LEVEL_LIST) {
            it(`${name}, ${density} density: the same markup each time, built from its parts`, () => {
                const animation = genAnimation({ name, density });
                const tree = genCssAnimationTree(animation);
                expect(genCssAnimationTree(animation)).toEqual(tree);
                const nodes = collectNodes(tree);
                expect(nodes.length).toBeGreaterThan(1);
                // A tile and a projector both size it by its own box.
                expect(tree.style['container-type']).toBe('size');
                const styleText = collectStyleText(tree);
                // Nothing reaches outside: no url(), no import, no script.
                expect(styleText).not.toMatch(/url\(|@import|expression|<|>/i);
                // Every colour is one of the animation's own, or no colour at
                // all (fully clear).
                for (const match of styleText.matchAll(
                    /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
                )) {
                    if (Number.parseFloat(match[4]) === 0) {
                        continue;
                    }
                    expect(
                        allowedRgbSet.has(
                            `${match[1]},${match[2]},${match[3]}`,
                        ),
                        match[0],
                    ).toBe(true);
                }
                expect(styleText).not.toMatch(/#[0-9a-f]{3,8}\b/i);
                // What moves names keyframes that exist, and moves only
                // while asked to.
                const movingNodes = nodes.filter((node) => {
                    return node.movingStyle !== undefined;
                });
                expect(movingNodes.length).toBeGreaterThan(0);
                for (const node of movingNodes) {
                    const names = (
                        node.movingStyle!['animation-name'] ?? ''
                    ).split(/\s*,\s*/);
                    for (const keyframeName of names) {
                        expect(keyframeNames).toContain(keyframeName);
                    }
                    expect(checkIsCssAnimationNodeMoving(node, true)).toBe(
                        true,
                    );
                    expect(checkIsCssAnimationNodeMoving(node, false)).toBe(
                        false,
                    );
                    expect(
                        genCssAnimationNodeStyle(node, false)['animation-name'],
                    ).toBeUndefined();
                }
            });
        }
    }

    it('draws more of it with more density', () => {
        for (const name of ['bokeh', 'snow', 'embers', 'waves'] as const) {
            const low = collectNodes(
                genCssAnimationTree(genAnimation({ name, density: 'low' })),
            ).length;
            const high = collectNodes(
                genCssAnimationTree(genAnimation({ name, density: 'high' })),
            ).length;
            expect(high, name).toBeGreaterThan(low);
        }
        // The stars are dots painted inside the same three layers.
        const countDots = (density: CssAnimationType['density']) => {
            return collectStyleText(
                genCssAnimationTree(genAnimation({ name: 'stars', density })),
            ).split('radial-gradient').length;
        };
        expect(countDots('high')).toBeGreaterThan(countDots('low'));
    });

    it('carries the whole animation’s opacity on its root, never a full one', () => {
        expect(
            genCssAnimationTree(genAnimation()).style.opacity,
        ).toBeUndefined();
        expect(
            genCssAnimationTree(genAnimation({ opacity: 40 })).style.opacity,
        ).toBe('0.4');
    });

    it('speeds up with its speed', () => {
        const seconds = (speed: CssAnimationType['speed']) => {
            const node = collectNodes(
                genCssAnimationTree(genAnimation({ speed })),
            ).find((one) => {
                return one.movingStyle !== undefined;
            })!;
            return Number.parseFloat(node.movingStyle!['--app-anim-seconds']);
        };
        expect(seconds('slow')).toBeGreaterThan(seconds('normal'));
        expect(seconds('normal')).toBeGreaterThan(seconds('fast'));
    });
});

describe('written out', () => {
    it('Copy Code is a whole page that plays it', () => {
        const html = genCssAnimationHtml(genAnimation({ name: 'snow' }));
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('@keyframes app-anim-');
        expect(html).toContain(`class="${CSS_ANIMATION_MOVING_CLASS_NAME}"`);
        const page = new DOMParser().parseFromString(html, 'text/html');
        expect(page.querySelectorAll('body div').length).toBeGreaterThan(3);
    });

    it('paper holds it standing still', () => {
        const markup = genCssAnimationStillMarkup(
            genAnimation({ name: 'rays' }),
        );
        expect(markup).not.toContain(CSS_ANIMATION_MOVING_CLASS_NAME);
        expect(markup).not.toContain('animation-name');
        const box = document.createElement('div');
        box.innerHTML = markup;
        expect(box.firstElementChild?.getAttribute('style')).toContain(
            'container-type: size',
        );
    });

    it('turns a style record into React’s names, custom properties kept', () => {
        expect(
            toReactStyle({
                'border-radius': '50%',
                '--app-anim-x': '4cqw',
                opacity: '1',
            }),
        ).toEqual({
            borderRadius: '50%',
            '--app-anim-x': '4cqw',
            opacity: '1',
        });
    });
});
