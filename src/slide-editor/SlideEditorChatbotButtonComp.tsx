import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { openDocumentInChatbot } from '../helper/ai/lyricChatbotMenuHelpers';
import { tran } from '../lang/langHelpers';

/**
 * The 🤖 in the Slide Editor's footer, beside Undo / Save (2026-11-07, the
 * user: _chatbot be the best choice to help modify appdocument slides_): the
 * help window opens with the document being edited attached, under the card
 * that says what it can do to the slides -- the Lyric Editor's own robot, for
 * slides. Every edit here is already in the document's editing history, the
 * head the assistant reads, so nothing has to be written first; a change the
 * assistant makes comes back into this editor as an update of the file.
 */
export default function SlideEditorChatbotButtonComp({
    filePath,
}: Readonly<{ filePath: string }>) {
    if (!getIsAIEnabled()) {
        return null;
    }
    const label = tran('Open in Chatbot');
    return (
        <button
            type="button"
            className="btn btn-sm btn-outline-info ms-1 flex-shrink-0"
            title={label}
            aria-label={label}
            onClick={() => {
                void openDocumentInChatbot(filePath);
            }}
        >
            <i className="bi bi-robot" aria-hidden="true" />
        </button>
    );
}
