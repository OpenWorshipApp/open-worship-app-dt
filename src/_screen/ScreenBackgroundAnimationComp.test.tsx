import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ScreenBackgroundAnimationComp from './ScreenBackgroundAnimationComp';

const CSS_SRC =
    'css?name=bokeh&colors=1E3A8A-F59E0B-FFFFFF&speed=normal&density=normal';
const GLSL_SRC =
    'glsl?name=plasma&colors=0F172A-7C3AED&speed=normal&quality=normal&opacity=50';

function render(props: {
    src: string;
    isMoving: boolean;
    isOnScreen?: boolean;
}) {
    return renderToStaticMarkup(
        createElement(ScreenBackgroundAnimationComp, props),
    );
}

describe('ScreenBackgroundAnimationComp', () => {
    it('a CSS animation moves on its screen alone', () => {
        const moving = render({ src: CSS_SRC, isMoving: true });
        expect(moving).toContain('app-anim-box app-anim-on-screen');
        expect(moving).toContain('app-anim-moving');
        expect(moving).toContain('animation-name');
        const still = render({ src: CSS_SRC, isMoving: false });
        expect(still).toContain('app-anim-box');
        expect(still).not.toContain('app-anim-on-screen');
        expect(still).not.toContain('app-anim-moving');
        expect(still).not.toContain('animation-name');
    });

    it('a moving tile is not the screen: reduced motion still holds it', () => {
        const tile = render({
            src: CSS_SRC,
            isMoving: true,
            isOnScreen: false,
        });
        expect(tile).toContain('app-anim-moving');
        expect(tile).not.toContain('app-anim-on-screen');
    });

    it('a shader is its still gradient here, at its own opacity', () => {
        const markup = render({ src: GLSL_SRC, isMoving: true });
        expect(markup).toContain('linear-gradient');
        expect(markup).toContain('opacity:0.5');
        expect(markup).not.toContain('canvas');
    });

    it('what is not an animation draws an empty box', () => {
        expect(render({ src: 'css?name=evil', isMoving: true })).toBe(
            '<div style="width:100%;height:100%"></div>',
        );
    });
});
