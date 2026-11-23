import { describe, expect, it } from 'vitest';

import {
    ANIMATION_AGENT_ACTION_LIST,
    ANIMATION_AGENT_FIELD_LIST,
    planAnimationChange,
    toAnimationAgentFields,
    toCustomShader,
} from './animationAgentRules';
import {
    ANIMATION_EDIT_ACTIONS,
    ANIMATION_EDIT_DESCRIPTION,
    ANIMATION_EDIT_FIELDS,
} from '../../tools/owa-devtools-mcp/agentAnimationEdit.mjs';
import {
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    type CssAnimationType,
    type GlslAnimationType,
} from './animationValueHelpers';

const CSS: CssAnimationType = {
    engine: 'css',
    name: 'aurora',
    code: null,
    colors: ['#1E3A8A', '#581C87', '#0EA5E9'],
    speed: 'normal',
    density: 'high',
    opacity: 100,
    blend: 'normal',
};
const GLSL: GlslAnimationType = {
    engine: 'glsl',
    name: 'custom',
    code: 'void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }',
    colors: ['#0F172A', '#7C3AED'],
    speed: 'fast',
    quality: 'low',
    opacity: 80,
    blend: 'screen',
};

// A page's colour reader, as the worker hands one in.
function resolveColor(text: string) {
    return (
        (
            { red: '#ff0000', 'warm orange': '#f97316' } as Record<
                string,
                string
            >
        )[text.toLowerCase()] ?? null
    );
}

describe('the tool and the app name the same actions and fields', () => {
    it('holds the lists together', () => {
        expect([...ANIMATION_AGENT_ACTION_LIST]).toEqual(
            ANIMATION_EDIT_ACTIONS,
        );
        expect([...ANIMATION_AGENT_FIELD_LIST]).toEqual(ANIMATION_EDIT_FIELDS);
    });
});

describe('planAnimationChange', () => {
    it('refuses a call that names nothing to change', () => {
        expect(planAnimationChange(CSS, {}, resolveColor)).toEqual({
            reason: expect.stringContaining('Nothing to change'),
        });
    });

    it('changes the effect by the words an assistant writes', () => {
        const plan = planAnimationChange(
            CSS,
            { effect: 'Light Rays' },
            resolveColor,
        );
        expect(plan).toEqual({
            animation: { ...CSS, name: 'rays' },
            changed: ['effect'],
        });
    });

    it('moves to the engine that has the effect, keeping the look', () => {
        const plan = planAnimationChange(CSS, { effect: 'fire' }, resolveColor);
        expect(plan).toEqual({
            animation: {
                engine: 'glsl',
                name: 'flames',
                code: null,
                colors: CSS.colors,
                speed: 'normal',
                quality: 'high',
                opacity: 100,
                blend: 'normal',
            },
            changed: ['effect'],
        });
    });

    it('reads the effects of 2026-11-19 by the words written for them', () => {
        for (const [word, name] of [
            ['Falling Leaves', 'leaves'],
            ['leaf', 'leaves'],
            ['firework', 'fireworks'],
            ['petal', 'petals'],
            ['candle', 'candles'],
            ['Candlelight', 'candles'],
            ['heart', 'hearts'],
            ['confetti', 'confetti'],
        ] as const) {
            expect(
                planAnimationChange(CSS, { effect: word }, resolveColor),
                word,
            ).toEqual({
                animation: { ...CSS, name },
                changed: ['effect'],
            });
        }
    });

    it('names every effect of both kinds to the assistant', () => {
        for (const name of [
            ...CSS_ANIMATION_NAME_LIST,
            ...GLSL_ANIMATION_NAME_LIST,
        ]) {
            expect(ANIMATION_EDIT_DESCRIPTION, name).toMatch(
                new RegExp(String.raw`\b${name}\b`),
            );
        }
    });

    it('puts a shader back on a built-in, its own code gone', () => {
        const plan = planAnimationChange(
            GLSL,
            { effect: 'plasma' },
            resolveColor,
        );
        expect('animation' in plan && plan.animation).toMatchObject({
            engine: 'glsl',
            name: 'plasma',
            code: null,
            quality: 'low',
        });
    });

    it('takes an engine named alone as its first effect', () => {
        const plan = planAnimationChange(GLSL, { engine: 'css' }, resolveColor);
        expect('animation' in plan && plan.animation).toMatchObject({
            engine: 'css',
            name: 'aurora',
            density: 'low',
        });
    });

    it('refuses an effect no engine has, naming both lists', () => {
        const plan = planAnimationChange(
            CSS,
            { effect: 'tornado' },
            resolveColor,
        );
        expect('reason' in plan && plan.reason).toMatch(
            /No CSS animation effect is called "tornado".*embers.*sunrise/,
        );
        expect(
            planAnimationChange(CSS, { engine: 'webgl' }, resolveColor),
        ).toEqual({ reason: '`engine` is css or glsl.' });
    });

    it('reads colours as hex, names and a written list', () => {
        const plan = planAnimationChange(
            CSS,
            { colors: 'red, #000, warm orange' },
            resolveColor,
        );
        expect('animation' in plan && plan.animation.colors).toEqual([
            '#FF0000',
            '#000000',
            '#F97316',
        ]);
    });

    it('refuses a colour it cannot read and a count out of range', () => {
        expect(
            planAnimationChange(
                CSS,
                { colors: ['#000', 'sparkly'] },
                resolveColor,
            ),
        ).toEqual({ reason: expect.stringContaining('"sparkly"') });
        expect(
            planAnimationChange(CSS, { colors: ['#000'] }, resolveColor),
        ).toEqual({ reason: expect.stringContaining('2 to 4 colours') });
        expect(planAnimationChange(CSS, { colors: 5 }, resolveColor)).toEqual({
            reason: expect.stringContaining('list of colours'),
        });
    });

    it('steps speed and level, and stops at the ends', () => {
        const slower = planAnimationChange(
            CSS,
            { speed: 'slower', level: 'more' },
            resolveColor,
        );
        expect('animation' in slower && slower.animation).toMatchObject({
            speed: 'slow',
            density: 'high',
        });
        const shader = planAnimationChange(
            GLSL,
            { speed: 'faster', level: 'Higher' },
            resolveColor,
        );
        expect('animation' in shader && shader.animation).toMatchObject({
            speed: 'fast',
            quality: 'normal',
        });
        expect(
            planAnimationChange(CSS, { speed: 'warp' }, resolveColor),
        ).toEqual({ reason: expect.stringContaining('`speed`') });
        expect(
            planAnimationChange(CSS, { level: 'ultra' }, resolveColor),
        ).toEqual({ reason: expect.stringContaining('`level`') });
    });

    it('rounds an opacity and refuses one out of range', () => {
        const plan = planAnimationChange(
            CSS,
            { opacity: '45.6' },
            resolveColor,
        );
        expect('animation' in plan && plan.animation.opacity).toBe(46);
        expect(planAnimationChange(CSS, { opacity: 5 }, resolveColor)).toEqual({
            reason: expect.stringContaining('10 to 100'),
        });
    });

    it('reads a blend mode, none as normal, and refuses another word', () => {
        const plan = planAnimationChange(GLSL, { blend: 'none' }, resolveColor);
        expect('animation' in plan && plan.animation.blend).toBe('normal');
        const dodge = planAnimationChange(
            CSS,
            { blend: 'Color Dodge' },
            resolveColor,
        );
        expect('animation' in dodge && dodge.animation.blend).toBe(
            'color-dodge',
        );
        expect(
            planAnimationChange(CSS, { blend: 'sparkle' }, resolveColor),
        ).toEqual({ reason: expect.stringContaining('mix-blend-mode') });
    });

    it('refuses the WHOLE call when one field is wrong', () => {
        expect(
            planAnimationChange(
                CSS,
                { effect: 'bokeh', speed: 'warp' },
                resolveColor,
            ),
        ).toEqual({ reason: expect.stringContaining('`speed`') });
    });
});

describe('toCustomShader', () => {
    it('keeps a CSS animation’s look, its density as quality', () => {
        expect(toCustomShader(CSS, 'void mainImage() {}')).toEqual({
            engine: 'glsl',
            name: 'custom',
            code: 'void mainImage() {}',
            colors: CSS.colors,
            speed: 'normal',
            quality: 'high',
            opacity: 100,
            blend: 'normal',
        });
    });
});

describe('toAnimationAgentFields', () => {
    it('names density for CSS and quality for a shader', () => {
        expect(toAnimationAgentFields(CSS)).toMatchObject({
            engine: 'css',
            effect: 'aurora',
            density: 'high',
        });
        const fields = toAnimationAgentFields(GLSL);
        expect(fields).toMatchObject({ engine: 'glsl', quality: 'low' });
        expect(fields).not.toHaveProperty('density');
        expect(typeof fields.description).toBe('string');
    });
});
