import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        compileError: null as string | null,
        errors: [] as unknown[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('./errorHelpers', () => ({
    handleError: (error: unknown) => {
        h.errors.push(error);
    },
}));
vi.mock('./cssColorResolveHelpers', () => ({
    resolveCssColor: (text: string) => {
        return text === 'gold' ? '#ffd700' : null;
    },
}));
vi.mock('../background/glslStillRenderer', () => ({
    checkGlslCodeCompiles: () => h.compileError,
}));

import { handleAgentAnimationRequest } from './agentAnimationHelpers';
import {
    listAnimationAgentEditors,
    registerAnimationAgentCode,
    registerAnimationAgentEditor,
    type AnimationAgentCodeHandleType,
} from '../background/animationAgentEditorRegistry';
import {
    parseAnimation,
    toAnimationSrc,
} from '../background/animationValueHelpers';

const CSS_SRC =
    'css?name=aurora&colors=1E3A8A-581C87-0EA5E9&speed=normal&density=normal';
const GLSL_SRC = 'glsl?name=plasma&colors=0F172A-7C3AED&speed=fast&quality=low';
const CODE = [
    'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
    '    fragColor = vec4(palette(iTime * 0.1), 1.0);',
    '}',
].join('\n');

const cleanupList: (() => void)[] = [];

const CSS_STARTER = '/* starter */ .scene { opacity: 1; }';
const CSS_CODE = [
    '.dot { left: calc(var(--x) * 1%); animation: rise 9s infinite; }',
    '@keyframes rise { to { transform: translateY(-20cqh); } }',
].join('\n');

// A picker as the registry sees it: its draft, and Edit Code opened by its
// press -- Shader Code or CSS Code, by the animation held -- the panel's
// handle registered on the next tick, as a lazy panel mounts.
function openEditor(id: string, src: string, compileError?: string) {
    const state = {
        src,
        code: null as string | null,
        applied: [] as string[],
        openEngine: null as 'css' | 'glsl' | null,
    };
    const genCodeHandle = (
        engine: 'css' | 'glsl',
    ): AnimationAgentCodeHandleType => {
        return {
            engine,
            getCode: () => state.code ?? '',
            setCode: (code) => {
                state.code = code;
            },
            checkCode: (code) => {
                return code.includes('broken')
                    ? (compileError ?? 'ERROR')
                    : null;
            },
            apply: () => {
                state.applied.push(state.code ?? '');
                return true;
            },
        };
    };
    cleanupList.push(
        registerAnimationAgentEditor({
            id,
            place: id.startsWith('foreground') ? 'foreground' : 'background',
            screenId: 0,
            getDraftSrc: () => state.src,
            setDraftSrc: (next) => {
                state.src = next;
                return true;
            },
            openCode: () => {
                const animation = parseAnimation(state.src);
                if (animation === null) {
                    return false;
                }
                // An open panel stays as it is, as Edit Code does.
                if (state.openEngine === animation.engine) {
                    return true;
                }
                state.openEngine = animation.engine;
                setTimeout(() => {
                    state.code =
                        animation.engine === 'css'
                            ? (animation.code ?? CSS_STARTER)
                            : (state.code ?? 'void mainImage() {}');
                    cleanupList.push(
                        registerAnimationAgentCode(
                            id,
                            genCodeHandle(animation.engine),
                        ),
                    );
                }, 0);
                return true;
            },
        }),
    );
    return state;
}

beforeEach(() => {
    h.isPagePresenter = true;
    h.compileError = null;
    h.errors = [];
});

afterEach(() => {
    while (cleanupList.length > 0) {
        cleanupList.pop()?.();
    }
    expect(listAnimationAgentEditors()).toEqual([]);
});

describe('off the Presenter page', () => {
    it('reads a note, and refuses a change', async () => {
        h.isPagePresenter = false;
        expect(await handleAgentAnimationRequest({ action: 'read' })).toEqual({
            needsPage: 'presenter',
            note: expect.stringContaining('owa_goto_page'),
        });
        expect(
            await handleAgentAnimationRequest({ action: 'set', speed: 'slow' }),
        ).toMatchObject({ isError: true, needsPage: 'presenter' });
    });
});

describe('read', () => {
    it('says no animation is open, with how to put one up', async () => {
        expect(await handleAgentAnimationRequest({ action: 'read' })).toEqual({
            editors: [],
            note: expect.stringContaining('Background → Animations'),
        });
    });

    it('reads every editor, and the target shader’s code alone', async () => {
        openEditor('background:0', GLSL_SRC);
        openEditor('foreground:0', GLSL_SRC);
        const read: any = await handleAgentAnimationRequest({
            action: 'read',
        });
        expect(read.target).toBe('foreground:0');
        expect(read.editors[0]).toMatchObject({
            editor: 'foreground:0',
            where: 'Animation Show (over the slide), screen 0',
            engine: 'glsl',
            effect: 'plasma',
            quality: 'low',
            isCodeOpen: false,
        });
        // The built-in's code, as Edit Code would open with it.
        expect(read.editors[0].code).toContain('mainImage');
        expect(read.editors[1]).not.toHaveProperty('code');
    });

    it('refuses an editor that is not open, naming the open ones', async () => {
        openEditor('background:0', CSS_SRC);
        const read: any = await handleAgentAnimationRequest({
            action: 'read',
            editor: 'background:7',
        });
        expect(read.note).toContain('Open ones: background:0.');
    });
});

describe('set', () => {
    it('changes the draft the way Customize does, and undoes it', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'set',
            speed: 'slower',
            colors: ['#000000', 'gold'],
        });
        expect(result).toMatchObject({
            did: 'changed colors, speed',
            editor: 'background:0',
            speed: 'slow',
            colors: ['#000000', '#FFD700'],
        });
        expect(parseAnimation(state.src)).toMatchObject({ speed: 'slow' });
        const undone: any = await handleAgentAnimationRequest({
            action: 'undo',
            id: result.undoId,
        });
        expect(undone.did).toContain('put the animation back');
        expect(state.src).toBe(CSS_SRC);
    });

    it('says nothing changed when it already looks that way', async () => {
        openEditor('background:0', CSS_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'set',
            speed: 'normal',
        });
        expect(result.did).toMatch(/^nothing/);
        expect(result).not.toHaveProperty('undoId');
    });

    it('refuses a wrong field and changes nothing', async () => {
        const state = openEditor('background:0', CSS_SRC);
        expect(
            await handleAgentAnimationRequest({
                action: 'set',
                speed: 'slower',
                opacity: 2,
            }),
        ).toMatchObject({ isError: true });
        expect(state.src).toBe(CSS_SRC);
    });
});

describe('code', () => {
    it('makes a CSS animation a custom shader once the code compiles', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CODE,
        });
        expect(result).toMatchObject({
            did: 'made it a custom shader with that code',
            engine: 'glsl',
            effect: 'custom',
        });
        expect(parseAnimation(state.src)).toMatchObject({
            engine: 'glsl',
            name: 'custom',
            code: CODE,
            quality: 'normal',
        });
    });

    it('leaves the CSS animation up when the code does not compile', async () => {
        const state = openEditor('background:0', CSS_SRC);
        h.compileError = "ERROR: 0:2: 'x' : undeclared identifier";
        expect(
            await handleAgentAnimationRequest({ action: 'code', code: CODE }),
        ).toMatchObject({
            isError: true,
            codeError: h.compileError,
        });
        expect(state.src).toBe(CSS_SRC);
    });

    it('types a shader’s code into Edit Code, applies it, and undoes both', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CODE,
        });
        expect(result).toMatchObject({
            did: 'typed the code into Shader Code and applied it to the screen',
            codeError: null,
            isApplied: true,
        });
        expect(state.code).toBe(CODE);
        expect(state.applied).toEqual([CODE]);
        await handleAgentAnimationRequest({
            action: 'undo',
            id: result.undoId,
        });
        // The panel opened with the shader's own code: that is back.
        expect(state.code).toBe('void mainImage() {}');
        expect(state.src).toBe(GLSL_SRC);
    });

    it('undoing a colour change takes back the code typed after it', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const colors: any = await handleAgentAnimationRequest({
            action: 'set',
            speed: 'slower',
        });
        await handleAgentAnimationRequest({ action: 'code', code: CODE });
        await handleAgentAnimationRequest({
            action: 'code',
            code: `${CODE}\n// broken`,
        });
        const undone: any = await handleAgentAnimationRequest({
            action: 'undo',
            id: colors.undoId,
        });
        expect(undone.alsoUndone).toBe(2);
        // Seen live: the colours came back and the broken code stayed.
        expect(state.code).toBe('void mainImage() {}');
        expect(state.src).toBe(GLSL_SRC);
    });

    it('keeps code that does not compile in the editor, applied nowhere', async () => {
        const state = openEditor('background:0', GLSL_SRC, 'ERROR: 0:3: x');
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: `${CODE}\n// broken`,
        });
        expect(result).toMatchObject({
            did: 'typed the code into Shader Code',
            codeError: 'ERROR: 0:3: x',
            isApplied: false,
        });
        expect(result.note).toContain('codeError');
        expect(state.applied).toEqual([]);
    });

    it('types CSS into CSS Code for a CSS animation, applies it, and undoes both', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CSS_CODE,
        });
        expect(result).toMatchObject({
            did: 'typed the code into CSS Code and applied it to the screen',
            codeError: null,
            isApplied: true,
        });
        expect(state.code).toBe(CSS_CODE);
        expect(state.applied).toEqual([CSS_CODE]);
        await handleAgentAnimationRequest({
            action: 'undo',
            id: result.undoId,
        });
        // The panel opened on its starter: that is back.
        expect(state.code).toBe(CSS_STARTER);
        expect(state.src).toBe(CSS_SRC);
    });

    it('applies CSS whose dots are never placed, and says so', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const unplaced = '.dot { width: 1cqmin; animation: fall 9s infinite; }';
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: unplaced,
        });
        expect(result).toMatchObject({ isApplied: true, codeError: null });
        expect(result.note).toContain('No .dot reads var(--x)');
        expect(state.applied).toEqual([unplaced]);
        // Placed, nothing to say.
        const placed: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CSS_CODE,
        });
        expect(placed.note).toBeUndefined();
    });

    it('keeps CSS that loads an address in CSS Code, applied nowhere', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: '.scene { background: url(https://example.com/a.png); }',
        });
        expect(result).toMatchObject({
            did: 'typed the code into CSS Code',
            isApplied: false,
        });
        expect(result.codeError).toContain('url()');
        expect(result.note).toContain('does not pass its check');
        expect(state.applied).toEqual([]);
    });

    it('reads a built-in CSS effect as the CSS its panel opens on', async () => {
        openEditor('background:0', CSS_SRC);
        const read: any = await handleAgentAnimationRequest({
            action: 'read',
        });
        expect(read.editors[0]).toMatchObject({
            engine: 'css',
            effect: 'aurora',
            isCodeOpen: false,
        });
        // The effect itself, written as CSS -- not empty, not a starter.
        expect(read.editors[0].code).toContain('Aurora, written as CSS.');
        expect(read.editors[0].code).toContain('@keyframes float');
        expect(read.note).toContain('makes it custom');
    });

    it('reads a CSS animation’s own code', async () => {
        const custom = toAnimationSrc({
            ...parseAnimation(CSS_SRC)!,
            name: 'custom',
            code: CSS_CODE,
        } as any);
        openEditor('background:0', custom);
        const read: any = await handleAgentAnimationRequest({
            action: 'read',
        });
        expect(read.editors[0]).toMatchObject({
            engine: 'css',
            effect: 'custom',
            code: CSS_CODE,
        });
        expect(read.note).toContain('CSS Code');
    });

    it('makes a shader a CSS animation for CSS code that passes', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CSS_CODE,
        });
        expect(result).toMatchObject({
            did: 'made it a CSS animation with that code',
            engine: 'css',
            effect: 'custom',
        });
        expect(parseAnimation(state.src)).toMatchObject({
            engine: 'css',
            name: 'custom',
            code: CSS_CODE,
            // The shader's quality is its density.
            density: 'low',
        });
    });

    it('leaves the shader up when the CSS does not pass', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: '@keyframes glow { to { background: red; } }',
        });
        expect(result).toMatchObject({ isError: true });
        expect(result.codeError).toContain('animates background');
        expect(state.src).toBe(GLSL_SRC);
    });

    it('tries code without applying it when told', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CODE,
            apply: false,
        });
        expect(result.isApplied).toBe(false);
        expect(state.applied).toEqual([]);
        expect(state.code).toBe(CODE);
    });

    it('only checks code of the other kind when told not to apply', async () => {
        const state = openEditor('background:0', GLSL_SRC);
        const result: any = await handleAgentAnimationRequest({
            action: 'code',
            code: CSS_CODE,
            apply: false,
        });
        expect(result).toMatchObject({
            did: 'checked the code; nothing was changed',
            isApplied: false,
            codeError: null,
        });
        expect(result.undoId).toBeUndefined();
        expect(state.src).toBe(GLSL_SRC);
    });

    it('refuses a call with no code to type or apply', async () => {
        openEditor('background:0', GLSL_SRC);
        expect(
            await handleAgentAnimationRequest({ action: 'code' }),
        ).toMatchObject({ isError: true });
    });
});

describe('undo', () => {
    it('refuses a change that is no longer held', async () => {
        openEditor('background:0', CSS_SRC);
        expect(
            await handleAgentAnimationRequest({
                action: 'undo',
                id: 'animation.999.x',
            }),
        ).toMatchObject({ isError: true });
    });

    it('takes back every change made after the one named', async () => {
        const state = openEditor('background:0', CSS_SRC);
        const first: any = await handleAgentAnimationRequest({
            action: 'set',
            speed: 'slow',
        });
        await handleAgentAnimationRequest({ action: 'set', opacity: 50 });
        const undone: any = await handleAgentAnimationRequest({
            action: 'undo',
            id: first.undoId,
        });
        expect(undone.alsoUndone).toBe(1);
        expect(state.src).toBe(CSS_SRC);
    });
});

it('refuses an action it does not know', async () => {
    expect(
        await handleAgentAnimationRequest({ action: 'delete' }),
    ).toMatchObject({ isError: true });
});
