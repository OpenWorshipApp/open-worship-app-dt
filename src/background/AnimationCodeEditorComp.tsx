import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Uri, type editor as MonacoEditorType } from 'monaco-editor';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { useInitMonacoEditor } from '../helper/monacoEditorHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import AnimationPreviewComp from './AnimationPreviewComp';
import {
    checkGlslCodeProblem,
    toAnimationSrc,
    type AnimationType,
} from './animationValueHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';
import { checkGlslCodeCompiles } from './glslStillRenderer';
import { GLSL_NO_WEBGL_ERROR } from '../_screen/glslAnimationRuntime';
import { checkCssCodeProblem } from './cssCodeCheckHelpers';
import { genCssEffectCode } from './cssEffectCodeHelpers';
import { registerAnimationAgentCode } from './animationAgentEditorRegistry';
import AnimationChatbotButtonComp from './AnimationChatbotButtonComp';

// One model per opening: a model left from the last one would bring its
// undo history with it.
let openingCount = 0;

type CheckedCodeType = { code: string; error: string | null };

function checkCode(
    engine: AnimationType['engine'],
    code: string,
): CheckedCodeType {
    return {
        code,
        error:
            engine === 'css'
                ? checkCssCodeProblem(code)
                : (checkGlslCodeProblem(code) ?? checkGlslCodeCompiles(code)),
    };
}

/**
 * The code of the animation picked: its own, or a built-in's -- a shader's
 * source, a CSS effect written as CSS. It depends on the effect and the
 * code alone, never the colours, speed or density.
 */
function genStartCode(animation: AnimationType) {
    if (animation.engine === 'css') {
        return genCssEffectCode(animation);
    }
    return genGlslAnimationCode(animation);
}

/** All of the editor's text replaced as ONE edit, so Ctrl+Z takes it back. */
function replaceEditorCode(
    instance: MonacoEditorType.IStandaloneCodeEditor,
    code: string,
) {
    const range = instance.getModel()?.getFullModelRange();
    if (range === undefined) {
        return;
    }
    instance.pushUndoStop();
    instance.executeEdits('owa-animation', [{ range, text: code }]);
    instance.pushUndoStop();
}

function toCustom(animation: AnimationType, code: string): AnimationType {
    return { ...animation, name: 'custom', code };
}

/**
 * Edit Code: an animation's code beside a live preview of it and what is
 * wrong with it (2026-11-15, the goal _support creative animation_).
 *
 * - **Shader Code** -- a shader's `mainImage`. A person may paste a
 *   Shadertoy shader that reads no `iChannel`; `uColors`, `palette()` and
 *   the other helpers the header declares are theirs to use. The graphics
 *   card checks it, on the one shared context the tiles' stills use.
 * - **CSS Code** (2026-11-19, the goal _chatbot can help handle css and glsl
 *   code editing_) -- a CSS animation's own style sheet for the boxes the
 *   app draws (`cssCodeAnimationHelpers`), opened on its own code or, for a
 *   built-in effect, on that effect written as CSS (`cssEffectCodeHelpers`);
 *   `checkCssCodeProblem` checks it.
 *
 * It FOLLOWS the animation picked (the same day, the user: _css code
 * editor not starting from current selected_): another tile, another effect
 * in Customize or code the assistant put up brings that code in, as one
 * edit Ctrl+Z takes back; a colour, speed or density changes nothing here,
 * nor does this panel's own Apply. The code is checked after a pause in the
 * typing (`genTimeoutAttempt`) and the preview moves only while it passes.
 * Apply puts it on the screen as the animation's own code; Reset goes back
 * to the picked animation's code.
 */
export default function AnimationCodeEditorComp({
    agentEditorId,
    animation,
    onApply,
    onClose,
}: Readonly<{
    /** The picker's handle for the help window's assistant, when it has one. */
    agentEditorId?: string;
    animation: AnimationType;
    onApply: (animation: AnimationType) => void;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    // The picker opens one panel per engine (`key`): this one's never changes.
    const engine = animation.engine;
    const isCss = engine === 'css';
    const pickedCode = useMemo(() => {
        return genStartCode(animation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animation.engine, animation.name, animation.code]);
    // What the editor is made with: the code picked when the panel opened.
    const openingCode = useMemo(() => {
        return pickedCode;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [checked, setChecked] = useState<CheckedCodeType>(() => {
        return checkCode(engine, openingCode);
    });
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const uri = useMemo(() => {
        openingCount += 1;
        return Uri.parse(
            isCss
                ? `css-code-${openingCount}.css`
                : `shader-code-${openingCount}.glsl`,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const language = isCss ? 'css' : 'cpp';
    const { editorStore, onContainerInit, setNewValue } = useInitMonacoEditor({
        settingName: 'shader-code-editor-wrap-text',
        options: { language, value: openingCode, fontSize: 14 },
        onContentChange: (_, content) => {
            attemptTimeout(() => {
                setChecked(checkCode(engine, content));
            });
        },
        uri,
        language,
    });
    useAppEffect(() => {
        if (editorStore.editorInstance.getValue() !== openingCode) {
            editorStore.editorInstance.setValue(openingCode);
        }
    }, [editorStore]);
    // Checked now, and the check the edit itself started dropped: a shader
    // is compiled once, not twice.
    const checkCodeNow = (code: string) => {
        attemptTimeout(() => {
            setChecked(checkCode(engine, code));
        }, true);
    };
    // Another animation picked while the panel is open: its code comes in.
    // Not on the first run (the editor was made with it), and not when the
    // editor already holds it -- this panel's own Apply, or the assistant's
    // code put up after it was typed in here.
    const shownPickedCodeRef = useRef(openingCode);
    useAppEffect(() => {
        if (shownPickedCodeRef.current === pickedCode) {
            return;
        }
        shownPickedCodeRef.current = pickedCode;
        const instance = editorStore.editorInstance;
        if (instance.getValue() !== pickedCode) {
            replaceEditorCode(instance, pickedCode);
        }
        checkCodeNow(pickedCode);
    }, [pickedCode, editorStore]);
    // Released with the panel: no check waits for a panel that is gone, and
    // its model goes after the editor does (`useInitMonacoEditor` defers
    // that one task, so a StrictMode remount keeps both).
    const isClosingRef = useRef(false);
    useAppEffect(() => {
        isClosingRef.current = false;
        const model = editorStore.editorInstance.getModel();
        return () => {
            attemptTimeout(() => {}, true);
            isClosingRef.current = true;
            setTimeout(() => {
                if (isClosingRef.current) {
                    model?.dispose();
                }
            }, 10);
        };
    }, []);
    const draft = useMemo<AnimationType>(() => {
        return toCustom(animation, checked.code);
    }, [animation, checked.code]);
    const draftSrc = useMemo(() => {
        return checked.error === null ? toAnimationSrc(draft) : null;
    }, [draft, checked.error]);
    const onApplyRef = useAppCurrentRef(onApply);
    const animationRef = useAppCurrentRef(animation);
    // The help window's assistant types into THIS editor -- one edit, so
    // Ctrl+Z takes it back -- and presses this panel's Apply
    // (`owa_animation_edit`). Held while the panel is open.
    useAppEffect(() => {
        if (agentEditorId === undefined) {
            return;
        }
        const instance = editorStore.editorInstance;
        return registerAnimationAgentCode(agentEditorId, {
            engine,
            getCode: () => {
                return instance.getValue();
            },
            setCode: (code) => {
                replaceEditorCode(instance, code);
            },
            checkCode: (code) => {
                return checkCode(engine, code).error;
            },
            apply: () => {
                const checkedNow = checkCode(engine, instance.getValue());
                setChecked(checkedNow);
                if (checkedNow.error !== null) {
                    return false;
                }
                onApplyRef.current(
                    toCustom(animationRef.current, checkedNow.code),
                );
                return true;
            },
        });
    }, [agentEditorId, editorStore]);
    const label = isCss ? tran('CSS Code') : tran('Shader Code');
    let errorText: string | null = null;
    if (checked.error === GLSL_NO_WEBGL_ERROR) {
        errorText = tran(
            'WebGL is not available here, so a still picture of the colors is shown instead.',
        );
    } else if (checked.error !== null) {
        errorText = `${isCss ? tran('CSS error:') : tran('Shader error:')}\n${checked.error}`;
    }
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={label}
                widgetName={isCss ? 'CSS Code' : 'Shader Code'}
                persistKey={
                    isCss
                        ? 'floating-widget-rect-css-code'
                        : 'floating-widget-rect-shader-code'
                }
                onClose={onClose}
                extraActionButtons={
                    agentEditorId === undefined ? null : (
                        <AnimationChatbotButtonComp
                            editorId={agentEditorId}
                            isInTitleBar
                        />
                    )
                }
                options={{
                    width: 760,
                    height: 480,
                    minWidth: 420,
                    minHeight: 280,
                }}
            >
                <div className="animation-code-editor">
                    <div
                        className="animation-code-editor-code"
                        ref={onContainerInit}
                    />
                    <div className="animation-code-editor-side">
                        <div className="animation-code-editor-preview">
                            {draftSrc === null ? null : (
                                <AnimationPreviewComp src={draftSrc} isMoving />
                            )}
                        </div>
                        {errorText === null ? null : (
                            <pre
                                className="animation-code-editor-error"
                                role="status"
                            >
                                {errorText}
                            </pre>
                        )}
                        <div className="animation-code-editor-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => {
                                    setNewValue(pickedCode);
                                    checkCodeNow(pickedCode);
                                }}
                            >
                                {tran('Reset')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-info"
                                disabled={checked.error !== null}
                                onClick={() => {
                                    onApplyRef.current(draft);
                                }}
                            >
                                {tran('Apply')}
                            </button>
                        </div>
                    </div>
                </div>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
