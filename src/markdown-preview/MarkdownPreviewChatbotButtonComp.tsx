import { useCallback, useState } from 'react';

import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { tran } from '../lang/langHelpers';
import { openMarkdownInChatbot } from './markdownPreviewChatbotHelpers';

/**
 * The Markdown Preview toolbar's 🤖 (2026-11-11, the user: _on the markdown
 * file preview should have chatbot icon to attach and forcus on chatbot_):
 * the help window brought forward with this file attached in a tab of its
 * own, as the Resources row's 🤖 does, under the same words. Drawn only
 * while AI is on, like every other way into the assistant.
 */
export default function MarkdownPreviewChatbotButtonComp({
    filePath,
}: Readonly<{
    filePath: string | null;
}>) {
    // Read once: the switch is a synchronous ask of the main process, the
    // toolbar draws again at every keystroke in the editor, and a change
    // to it takes effect at the next launch anyway.
    const [isAIEnabled] = useState(getIsAIEnabled);
    const handleClicking = useCallback(() => {
        if (filePath !== null) {
            void openMarkdownInChatbot(filePath);
        }
    }, [filePath]);
    if (!isAIEnabled) {
        return null;
    }
    const title = tran('Ask the Assistant About This File');
    return (
        <button
            type="button"
            className="btn btn-sm app-markdown-preview-action"
            title={title}
            aria-label={title}
            disabled={filePath === null}
            onClick={handleClicking}
        >
            <i className="bi bi-robot" />
        </button>
    );
}
