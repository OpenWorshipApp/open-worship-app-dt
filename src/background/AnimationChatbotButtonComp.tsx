import { useCallback, useMemo } from 'react';

import { tran } from '../lang/langHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { handleError } from '../helper/errorHelpers';
import {
    listAnimationAgentEditors,
    touchAnimationAgentEditor,
} from './animationAgentEditorRegistry';
import { genAnimationLabel } from './animationLabelHelpers';
import { parseAnimation } from './animationValueHelpers';

/**
 * The robot in an animation's Customize and in its Shader Code panel
 * (2026-11-19, the user, the Edit Code panel open: _add chatbot icon to open
 * in chatbot and let chatbot control editor_): the help window opened on
 * THIS editor, which its assistant then changes -- the effect, colours,
 * speed, density or quality, opacity and blend of a CSS animation or a
 * shader, and a shader's code typed into Edit Code (`owa_animation_edit`).
 * Drawn only while AI is on, like every other way into the assistant; the
 * opener and its dialogs load at the press.
 */
export default function AnimationChatbotButtonComp({
    editorId,
    isInTitleBar = false,
}: Readonly<{
    editorId: string;
    /** A floating panel's title bar draws its own button shape. */
    isInTitleBar?: boolean;
}>) {
    const handleClicking = useCallback(async () => {
        const editor = listAnimationAgentEditors().find((one) => {
            return one.id === editorId;
        });
        const animation = parseAnimation(editor?.getDraftSrc() ?? null);
        if (animation === null) {
            return;
        }
        // The one asked about first, whichever editor was opened last.
        touchAnimationAgentEditor(editorId);
        try {
            const { openChatbotWithAnimation } =
                await import('../helper/ai/chatbotHandoffHelpers');
            await openChatbotWithAnimation({
                editorId,
                name: genAnimationLabel(animation),
                engine: animation.engine,
            });
        } catch (error) {
            handleError(error);
        }
    }, [editorId]);
    // Read once: the switch takes effect at the next launch, and Customize
    // re-renders on every slider move -- each read is a synchronous IPC.
    const isAIEnabled = useMemo(() => {
        return getIsAIEnabled();
    }, []);
    if (!isAIEnabled) {
        return null;
    }
    const title = tran('Open in Chatbot');
    return (
        <button
            type="button"
            className={
                isInTitleBar
                    ? 'floating-widget__button'
                    : 'btn btn-sm btn-outline-info ms-auto'
            }
            title={title}
            aria-label={title}
            onClick={() => {
                void handleClicking();
            }}
        >
            <i className="bi bi-robot" />
        </button>
    );
}
