/**
 * The Markdown Preview's two ways into the assistant (2026-11-11, the user,
 * the preview with its editor's line 7 selected and circled: _selected text
 * in editor should have option to mention in chatbot input text, on the
 * markdown file preview should have chatbot icon to attach and forcus on
 * chatbot_). The toolbar's 🤖 hands the file over -- a tab of its own with
 * the file attached, the help window brought forward -- and the editor's
 * **Ask the assistant about this** hands the words selected in it over
 * beside the file, quoted with their lines in the box of the tab on that
 * file (`chatbotHandoffStoreHelpers.ts`, `mentionHandedFileRef`).
 *
 * Everything is loaded at the press, and only leaves: most people only read
 * in this window, and `chatbotHandoffHelpers.ts` would bring the app's
 * dialogs, the Settings opener and `domHelpers.ts` into it. The caution is
 * asked all the same -- the window mounts no popup host, so it answers Open
 * here (it fails open, `aiCautionHelpers.ts`), and asks wherever one is.
 */
import type { editor } from 'monaco-editor';

import type { SelectionMentionType } from '../helper/ai/chatbotHandoffStoreHelpers';

/** The help window opened on the file, with the words selected in it. */
export async function openMarkdownInChatbot(
    filePath: string,
    mention: SelectionMentionType | null = null,
) {
    try {
        const [{ askAiCaution }, { requestChatbotFile }, { openChatbotPage }] =
            await Promise.all([
                import('../helper/ai/aiCautionHelpers'),
                import('../helper/ai/chatbotHandoffStoreHelpers'),
                import('../helper/chatbotPageHelpers'),
            ]);
        if (!(await askAiCaution('assistant'))) {
            return false;
        }
        requestChatbotFile(filePath, null, null, mention);
        openChatbotPage();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

/**
 * The words selected in the editor, the words around them on their first
 * and last line, and the file's lines they are on -- null when nothing but
 * spaces is selected. A selection that ends at the very start of a line
 * (a whole line taken with its line break, as a triple click does) ends on
 * the line before it.
 */
export function toEditorSelectionMention(
    editorInstance: Pick<editor.ICodeEditor, 'getModel' | 'getSelection'>,
): SelectionMentionType | null {
    const model = editorInstance.getModel();
    const selection = editorInstance.getSelection();
    if (model === null || selection === null || selection.isEmpty()) {
        return null;
    }
    const text = model.getValueInRange(selection);
    if (text.trim().length === 0) {
        return null;
    }
    const first = selection.startLineNumber;
    const isEndOnNextLine =
        selection.endColumn === 1 && selection.endLineNumber > first;
    const last = isEndOnNextLine
        ? selection.endLineNumber - 1
        : selection.endLineNumber;
    return {
        text,
        before: model.getLineContent(first).slice(0, selection.startColumn - 1),
        after: isEndOnNextLine
            ? ''
            : model.getLineContent(last).slice(selection.endColumn - 1),
        start: null,
        end: null,
        lines: { first, last },
    };
}
