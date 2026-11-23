/**
 * `owa_animation_edit`'s worker in the Presenter window (2026-11-19, the
 * user, the shader's Edit Code panel open: _add chatbot icon to open in
 * chatbot and let chatbot control editor_, the goal _chatbot can help handle
 * css and glsl code editing_). Loaded at the first call, never with a panel.
 *
 * It works ONLY through the editors open now (`animationAgentEditorRegistry`):
 *
 * - `read` -- each open editor: the animation Customize shows (effect,
 *   colours, speed, density or quality, opacity, blend) and its code -- the
 *   Edit Code panel's own text while it is open, else what the panel opens
 *   on: a built-in shader's source, a built-in CSS effect written as CSS --
 *   with what is wrong with it.
 * - `set` -- Customize's settings, the way a press there changes them: the
 *   draft, then the screen after the picker's own pause.
 * - `code` -- code TYPED INTO Edit Code (opened when shut), one edit Ctrl+Z
 *   takes back, checked, then applied when it passes unless `apply` is
 *   false: a shader's GLSL into Shader Code, a CSS animation's style sheet
 *   into CSS Code (2026-11-19). The code says which it is (a shader has its
 *   `mainImage`); code of the OTHER kind makes the animation that kind --
 *   a custom shader or a person's own CSS animation -- with its colours,
 *   speed and look, once it passes.
 * - `undo` -- what one change replaced, put back.
 */
import appProvider from '../server/appProvider';
import { handleError } from './errorHelpers';
import { resolveCssColor } from './cssColorResolveHelpers';
import {
    findAnimationAgentUndoEditorId,
    listAnimationAgentEditors,
    onAnimationAgentEditorsChanged,
    pushAnimationAgentUndo,
    takeAnimationAgentUndo,
    type AnimationAgentEditorType,
} from '../background/animationAgentEditorRegistry';
import {
    planAnimationChange,
    toAnimationAgentFields,
    toCustomCssAnimation,
    toCustomShader,
    type AnimationAgentFieldsType,
} from '../background/animationAgentRules';
import {
    MAX_GLSL_CODE_LENGTH,
    checkGlslCodeProblem,
    parseAnimation,
    toAnimationSrc,
    type AnimationType,
} from '../background/animationValueHelpers';
import {
    checkCssCodeProblem,
    checkIsGlslCodeText,
} from '../background/cssCodeCheckHelpers';
import { findCssCodeHint } from '../background/cssCodeAnimationHelpers';

type EngineType = AnimationType['engine'];

/** The Edit Code panel of an engine, by the name on its title bar. */
function toPanelName(engine: EngineType) {
    return engine === 'css' ? 'CSS Code' : 'Shader Code';
}

export type AgentAnimationRequestType = AnimationAgentFieldsType & {
    action?: unknown;
    /** Which editor: `background:0`, `foreground:1`; the last opened when none. */
    editor?: unknown;
    code?: unknown;
    apply?: unknown;
    /** `undo`'s change, as a change answered it. */
    id?: unknown;
};

type AgentResultType = Record<string, unknown>;

// Long enough for Edit Code's lazy chunk and Monaco to come up on an old
// machine; short enough that a panel that never opens is said, not waited on.
const CODE_OPEN_TIMEOUT_MS = 8000;

function fail(reason: string, extra: AgentResultType = {}): AgentResultType {
    return { isError: true, reason, ...extra };
}

function toPlaceWords(editor: AnimationAgentEditorType) {
    const panel =
        editor.place === 'foreground'
            ? 'Animation Show (over the slide)'
            : 'Background → Animations';
    return editor.screenId === null
        ? panel
        : `${panel}, screen ${editor.screenId}`;
}

function readDraft(editor: AnimationAgentEditorType) {
    return parseAnimation(editor.getDraftSrc());
}

/**
 * The code an animation shows: its panel's own text, else what the panel
 * opens on -- a shader's source, a CSS animation's own code or, for a
 * built-in CSS effect, that effect written as CSS (2026-11-19, the user:
 * _css code editor not starting from current selected_).
 */
async function readAnimationCode(
    editor: AnimationAgentEditorType,
    animation: AnimationType,
) {
    if (editor.code?.engine === animation.engine) {
        return editor.code.getCode();
    }
    if (animation.engine === 'css') {
        const { genCssEffectCode } =
            await import('../background/cssEffectCodeHelpers');
        return genCssEffectCode(animation);
    }
    const { genGlslAnimationCode } =
        await import('../background/glslAnimationSources');
    return genGlslAnimationCode(animation);
}

function checkCodeNow(
    editor: AnimationAgentEditorType,
    engine: EngineType,
    code: string,
) {
    const problem =
        engine === 'css'
            ? checkCssCodeProblem(code)
            : checkGlslCodeProblem(code);
    if (problem !== null) {
        return problem;
    }
    return editor.code?.engine === engine ? editor.code.checkCode(code) : null;
}

async function toEditorRead(
    editor: AnimationAgentEditorType,
    isTarget: boolean,
) {
    const animation = readDraft(editor);
    if (animation === null) {
        return { editor: editor.id, where: toPlaceWords(editor) };
    }
    const base = {
        editor: editor.id,
        where: toPlaceWords(editor),
        ...(editor.screenId === null ? {} : { screenId: editor.screenId }),
        ...toAnimationAgentFields(animation),
        isCodeOpen: editor.code !== null,
    };
    // The code of the editor asked about only: a second screen's shader is
    // the same thousands of characters again.
    if (!isTarget) {
        return base;
    }
    const code = await readAnimationCode(editor, animation);
    if (code === null) {
        return base;
    }
    return {
        ...base,
        code,
        ...(editor.code?.engine === animation.engine
            ? { codeError: checkCodeNow(editor, animation.engine, code) }
            : {}),
    };
}

function pickEditor(request: AgentResultType | AgentAnimationRequestType) {
    const editors = listAnimationAgentEditors();
    if (editors.length === 0) {
        return {
            editors,
            editor: null,
            reason:
                'No animation is open to change. An animation is changed ' +
                'while it is up on a screen: put one up from Background → ' +
                'Animations (or Animation Show), then ask again.',
        };
    }
    const wanted =
        typeof request.editor === 'string' ? request.editor.trim() : '';
    if (wanted === '') {
        return { editors, editor: editors[0], reason: null };
    }
    const editor =
        editors.find((one) => {
            return one.id === wanted;
        }) ?? null;
    return {
        editors,
        editor,
        reason:
            editor === null
                ? `No open animation editor is "${wanted}". Open ones: ` +
                  editors
                      .map((one) => {
                          return one.id;
                      })
                      .join(', ') +
                  '.'
                : null,
    };
}

async function readAnimations(request: AgentAnimationRequestType) {
    const { editors, editor, reason } = pickEditor(request);
    if (editor === null) {
        return { editors: [], note: reason };
    }
    const list = await Promise.all(
        editors.map((one) => {
            return toEditorRead(one, one.id === editor.id);
        }),
    );
    return {
        // The one a change goes to when none is named.
        target: editor.id,
        editors: list,
        note:
            'A change goes up on the screen half a second after it is ' +
            'made. `code` types code into Edit Code: GLSL (with its ' +
            'mainImage) into Shader Code, CSS into CSS Code. Code sent ' +
            'for a built-in effect makes it custom.',
    };
}

async function setAnimation(request: AgentAnimationRequestType) {
    const { editor, reason } = pickEditor(request);
    if (editor === null) {
        return fail(`Nothing was changed. ${reason}`);
    }
    const before = editor.getDraftSrc();
    const animation = parseAnimation(before);
    if (animation === null) {
        return fail('Nothing was changed: the animation could not be read.');
    }
    const plan = planAnimationChange(animation, request, (text) => {
        return resolveCssColor(text);
    });
    if ('reason' in plan) {
        return fail(`Nothing was changed: ${plan.reason}`);
    }
    const src = toAnimationSrc(plan.animation);
    if (src === before) {
        return {
            did: 'nothing: it already looks that way',
            editor: editor.id,
            ...toAnimationAgentFields(plan.animation),
        };
    }
    const undoId = pushAnimationAgentUndo(editor.id, {
        src: before,
        code: null,
    });
    if (!editor.setDraftSrc(src)) {
        return fail('Nothing was changed: the editor refused it.');
    }
    return {
        did: `changed ${plan.changed.join(', ')}`,
        editor: editor.id,
        undoId,
        ...toAnimationAgentFields(plan.animation),
        note: 'On the screen in half a second.',
    };
}

/** Edit Code opened, and its handle once that panel has registered. */
async function openCodeEditor(editorId: string, engine: EngineType) {
    const find = () => {
        return (
            listAnimationAgentEditors().find((one) => {
                return one.id === editorId;
            }) ?? null
        );
    };
    const editor = find();
    if (editor === null || !editor.openCode()) {
        return null;
    }
    if (editor.code?.engine === engine) {
        return editor;
    }
    return await new Promise<AnimationAgentEditorType | null>((resolve) => {
        let isDone = false;
        const finish = (value: AnimationAgentEditorType | null) => {
            if (isDone) {
                return;
            }
            isDone = true;
            clearTimeout(timer);
            stopListening();
            resolve(value);
        };
        const stopListening = onAnimationAgentEditorsChanged(() => {
            const current = find();
            if (current === null) {
                finish(null);
            } else if (current.code?.engine === engine) {
                finish(current);
            }
        });
        const timer = setTimeout(() => {
            finish(null);
        }, CODE_OPEN_TIMEOUT_MS);
    });
}

/**
 * Code of the OTHER kind than the animation held: the animation made that
 * kind, straight onto the screen once the code passes -- no panel of that
 * kind is open to type it into.
 */
async function switchEngineByCode(
    editor: AnimationAgentEditorType,
    beforeSrc: string | null,
    animation: AnimationType,
    codeEngine: EngineType,
    code: string,
    isApplying: boolean,
) {
    let error: string | null;
    if (codeEngine === 'css') {
        error = checkCssCodeProblem(code);
    } else {
        const { checkGlslCodeCompiles } =
            await import('../background/glslStillRenderer');
        error = checkGlslCodeProblem(code) ?? checkGlslCodeCompiles(code);
    }
    if (error !== null) {
        return fail(
            `Nothing was changed: the ${
                codeEngine === 'css' ? 'CSS' : 'shader'
            } does not ${codeEngine === 'css' ? 'pass its check' : 'compile'}, ` +
                `so the ${
                    animation.engine === 'css' ? 'CSS animation' : 'shader'
                } is still up.`,
            { codeError: error },
        );
    }
    if (!isApplying) {
        // Only tried, as `apply: false` asks: no panel of that kind is
        // open to hold it, so nothing anywhere changes.
        return {
            did: 'checked the code; nothing was changed',
            editor: editor.id,
            codeError: null,
            isApplied: false,
            note: [
                `It passes. Send it again without apply: false to make the ` +
                    `${
                        animation.engine === 'css' ? 'CSS animation' : 'shader'
                    } a ${
                        codeEngine === 'css' ? 'CSS animation' : 'shader'
                    } with it.`,
                codeEngine === 'css' ? findCssCodeHint(code) : null,
            ]
                .filter((one) => {
                    return one !== null;
                })
                .join(' '),
        };
    }
    const next =
        codeEngine === 'css'
            ? toCustomCssAnimation(animation, code)
            : toCustomShader(animation, code);
    const undoId = pushAnimationAgentUndo(editor.id, {
        src: beforeSrc,
        code: null,
    });
    editor.setDraftSrc(toAnimationSrc(next));
    return {
        did:
            codeEngine === 'css'
                ? 'made it a CSS animation with that code'
                : 'made it a custom shader with that code',
        editor: editor.id,
        undoId,
        ...toAnimationAgentFields(next),
        note: [
            'On the screen in half a second.',
            codeEngine === 'css' ? findCssCodeHint(code) : null,
        ]
            .filter((one) => {
                return one !== null;
            })
            .join(' '),
    };
}

async function editCode(request: AgentAnimationRequestType) {
    const { editor: picked, reason } = pickEditor(request);
    if (picked === null) {
        return fail(`Nothing was changed. ${reason}`);
    }
    const beforeSrc = picked.getDraftSrc();
    const animation = parseAnimation(beforeSrc);
    if (animation === null) {
        return fail('Nothing was changed: the animation could not be read.');
    }
    const isApplying = request.apply !== false;
    const code = typeof request.code === 'string' ? request.code : null;
    if (code === null && !(request.apply === true)) {
        return fail(
            'Nothing was changed: send `code` (the whole shader with its ' +
                'mainImage, or the whole CSS), or `apply: true` to apply ' +
                'what Edit Code holds.',
        );
    }
    if (code !== null && code.length > MAX_GLSL_CODE_LENGTH) {
        // Never typed in: no panel holds more.
        return fail(
            `Nothing was changed: the code is longer than ` +
                `${MAX_GLSL_CODE_LENGTH} characters.`,
        );
    }
    let codeEngine: EngineType = animation.engine;
    if (code !== null) {
        codeEngine = checkIsGlslCodeText(code) ? 'glsl' : 'css';
    }
    if (code !== null && codeEngine !== animation.engine) {
        return await switchEngineByCode(
            picked,
            beforeSrc,
            animation,
            codeEngine,
            code,
            isApplying,
        );
    }
    const panelName = toPanelName(animation.engine);
    const editor = await openCodeEditor(picked.id, animation.engine);
    if (editor?.code === null || editor === null) {
        return fail(
            `Nothing was changed: the ${panelName} panel did not open. ` +
                'Ask the person to press Edit Code in Customize.',
        );
    }
    const beforeCode = editor.code.getCode();
    if (code !== null && code !== beforeCode) {
        editor.code.setCode(code);
    }
    const nowCode = editor.code.getCode();
    const codeError = checkCodeNow(editor, animation.engine, nowCode);
    const isTyped = code !== null && code !== beforeCode;
    const isApplied = isApplying && codeError === null && editor.code.apply();
    const undoId =
        isTyped || isApplied
            ? pushAnimationAgentUndo(editor.id, {
                  src: beforeSrc,
                  code: isTyped ? beforeCode : null,
              })
            : null;
    return {
        did: [
            isTyped ? `typed the code into ${panelName}` : null,
            isApplied ? 'applied it to the screen' : null,
        ]
            .filter((one) => {
                return one !== null;
            })
            .join(' and ')
            .replace(/^$/, 'nothing'),
        editor: editor.id,
        ...(undoId === null ? {} : { undoId }),
        codeError,
        isApplied,
        ...toCodeNote(animation.engine, nowCode, codeError),
    };
}

/**
 * What an answer about code says beside it: what to fix when it did not
 * pass, and -- for CSS that did -- what it still draws wrong.
 */
function toCodeNote(
    engine: EngineType,
    code: string,
    codeError: string | null,
): { note?: string } {
    if (codeError !== null) {
        return {
            note:
                'The code is in the editor but ' +
                (engine === 'css'
                    ? 'does not pass its check'
                    : 'does not compile') +
                ', so the screen still shows what it showed. Fix what ' +
                'codeError names and send the whole code again.',
        };
    }
    const hint = engine === 'css' ? findCssCodeHint(code) : null;
    return hint === null ? {} : { note: hint };
}

async function undoChange(request: AgentAnimationRequestType) {
    const undoId = typeof request.id === 'string' ? request.id : null;
    const editorId =
        undoId === null
            ? (listAnimationAgentEditors()[0]?.id ?? null)
            : findAnimationAgentUndoEditorId(undoId);
    if (editorId === null) {
        return fail(
            'Nothing was put back: that change is no longer held -- its ' +
                'animation was taken off the screen, or its panel closed.',
        );
    }
    const taken = takeAnimationAgentUndo(editorId, undoId);
    const editor = listAnimationAgentEditors().find((one) => {
        return one.id === editorId;
    });
    if (taken === null || editor === undefined) {
        return fail(
            'Nothing was put back: no change by the assistant is held.',
        );
    }
    const { undo, laterCount } = taken;
    const animation = parseAnimation(undo.src);
    // The code back into the panel it was typed in: the one of the kind the
    // animation was then, never the other kind's.
    if (
        undo.code !== null &&
        editor.code !== null &&
        editor.code.engine === animation?.engine
    ) {
        editor.code.setCode(undo.code);
    }
    if (undo.src !== null && undo.src !== editor.getDraftSrc()) {
        editor.setDraftSrc(undo.src);
    }
    return {
        did: 'put the animation back as it was before that change',
        editor: editor.id,
        ...(laterCount > 0 ? { alsoUndone: laterCount } : {}),
        ...(animation === null ? {} : toAnimationAgentFields(animation)),
    };
}

export async function handleAgentAnimationRequest(
    request: AgentAnimationRequestType,
): Promise<AgentResultType> {
    try {
        if (!appProvider.isPagePresenter) {
            return {
                needsPage: 'presenter',
                note:
                    'Animations are changed on the Presenter page, and the ' +
                    'main window is not on it. Switch it there first ' +
                    '(owa_goto_page presenter), or tell the person to.',
                ...(request?.action === 'read'
                    ? {}
                    : {
                          isError: true,
                          reason: 'Nothing was changed: the main window is not on the Presenter page.',
                      }),
            };
        }
        switch (request?.action) {
            case 'read':
                return await readAnimations(request);
            case 'set':
                return await setAnimation(request);
            case 'code':
                return await editCode(request);
            case 'undo':
                return await undoChange(request);
            default:
                return fail('`action` is "read", "set", "code" or "undo".');
        }
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
