import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Uri } from 'monaco-editor';

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
    type GlslAnimationType,
} from './animationValueHelpers';
import { genGlslAnimationCode } from './glslAnimationSources';
import { checkGlslCodeCompiles } from './glslStillRenderer';
import { GLSL_NO_WEBGL_ERROR } from '../_screen/glslAnimationRuntime';

// One model per opening: a model left from the last one would bring its
// undo history with it.
let openingCount = 0;

type CheckedCodeType = { code: string; error: string | null };

function checkCode(code: string): CheckedCodeType {
    return {
        code,
        error: checkGlslCodeProblem(code) ?? checkGlslCodeCompiles(code),
    };
}

/**
 * Edit Code: a shader's `mainImage` beside a live preview of it and what
 * the graphics card said about it (2026-11-15, the goal _support creative
 * animation_). A person may paste a Shadertoy shader that reads no
 * `iChannel`; `uColors`, `palette()` and the other helpers the header
 * declares are theirs to use. The code is checked after a pause in the
 * typing (`genTimeoutAttempt`), on the one shared context the tiles' stills
 * use, and the preview moves only while the code compiles. Apply puts it on
 * the screen as a custom shader; Reset goes back to the code it opened
 * with.
 */
export default function AnimationCodeEditorComp({
    animation,
    onApply,
    onClose,
}: Readonly<{
    animation: GlslAnimationType;
    onApply: (animation: GlslAnimationType) => void;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    const startCode = useMemo(() => {
        return genGlslAnimationCode(animation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [checked, setChecked] = useState<CheckedCodeType>(() => {
        return checkCode(startCode);
    });
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const uri = useMemo(() => {
        openingCount += 1;
        return Uri.parse(`shader-code-${openingCount}.glsl`);
    }, []);
    const { editorStore, onContainerInit, setNewValue } = useInitMonacoEditor({
        settingName: 'shader-code-editor-wrap-text',
        options: { language: 'cpp', value: startCode, fontSize: 14 },
        onContentChange: (_, content) => {
            attemptTimeout(() => {
                setChecked(checkCode(content));
            });
        },
        uri,
        language: 'cpp',
    });
    useAppEffect(() => {
        if (editorStore.editorInstance.getValue() !== startCode) {
            editorStore.editorInstance.setValue(startCode);
        }
    }, [editorStore]);
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
    const draft = useMemo<GlslAnimationType>(() => {
        return { ...animation, name: 'custom', code: checked.code };
    }, [animation, checked.code]);
    const draftSrc = useMemo(() => {
        return checked.error === null ? toAnimationSrc(draft) : null;
    }, [draft, checked.error]);
    const onApplyRef = useAppCurrentRef(onApply);
    const label = tran('Shader Code');
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={label}
                widgetName="Shader Code"
                persistKey="floating-widget-rect-shader-code"
                onClose={onClose}
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
                        {checked.error === null ? null : (
                            <pre
                                className="animation-code-editor-error"
                                role="status"
                            >
                                {checked.error === GLSL_NO_WEBGL_ERROR
                                    ? tran(
                                          'WebGL is not available here, so a still picture of the colors is shown instead.',
                                      )
                                    : `${tran('Shader error:')}\n${checked.error}`}
                            </pre>
                        )}
                        <div className="animation-code-editor-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => {
                                    setNewValue(startCode);
                                    setChecked(checkCode(startCode));
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
