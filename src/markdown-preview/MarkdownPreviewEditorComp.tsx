import { useMemo, useRef } from 'react';
import { editor, KeyCode, KeyMod, Uri } from 'monaco-editor';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { useInitMonacoEditor } from '../helper/monacoEditorHelpers';
import { tran } from '../lang/langHelpers';

/**
 * ONE model for the whole window, whatever file it shows: the Monaco model
 * cache (`monacoEditorHelpers.ts`) keeps a model per address after its editor
 * is gone, and a model holds the whole text and its undo history. A fixed
 * address keeps that to one, while still bringing back the undo history when
 * the person toggles back into the same draft.
 */
const MARKDOWN_PREVIEW_EDITOR_URI = 'markdown-preview-editor';

/**
 * The Markdown Preview window's editor. Its own chunk, imported the first time
 * Edit is pressed, so a window that is only read never loads Monaco.
 *
 * The text it is given is read once, as it mounts; after that the editor owns
 * it and reports every change. The window remounts it (a new `key`) to put a
 * different text in, e.g. after Discard or a change made on disk.
 */
export default function MarkdownPreviewEditorComp({
    text,
    isDarkMode,
    onDraftChange,
    onSave,
}: Readonly<{
    text: string;
    isDarkMode: boolean;
    onDraftChange: (text: string) => void;
    onSave: () => void;
}>) {
    const onDraftChangeRef = useAppCurrentRef(onDraftChange);
    const onSaveRef = useAppCurrentRef(onSave);
    // Monaco writes a text with mixed line endings back with one kind, so the
    // text this component puts in itself can read as an edit the person made.
    // It is not reported: only their own changes are a draft.
    const isSettingTextRef = useRef(false);
    const { editorStore, onContainerInit } = useInitMonacoEditor({
        settingName: 'markdown-preview-wrap-text',
        isWrapTextDefault: true,
        options: { language: 'markdown', value: text },
        onInit: (editorInstance) => {
            editorInstance.addAction({
                id: 'save-markdown-file',
                label: tran('Save'),
                keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1,
                run: () => {
                    onSaveRef.current();
                },
            });
        },
        onContentChange: (_, newText) => {
            if (isSettingTextRef.current) {
                return;
            }
            onDraftChangeRef.current(newText);
        },
        uri: Uri.parse(MARKDOWN_PREVIEW_EDITOR_URI),
        language: 'markdown',
    });
    useAppEffect(() => {
        const model = editorStore.editorInstance.getModel();
        // The cached model already holds this text when the person toggles
        // back into the same draft; setting it again would lose its undo.
        if (model !== null && model.getValue() !== text) {
            isSettingTextRef.current = true;
            try {
                model.setValue(text);
            } finally {
                isSettingTextRef.current = false;
            }
        }
        // Only as it mounts (`text` left out on purpose): see the note above
        // the component.
    }, [editorStore]);
    useAppEffect(() => {
        editor.setTheme(isDarkMode ? 'vs-dark' : 'vs-light');
    }, [isDarkMode]);
    // The hook hands out a new callback every render, and React detaches and
    // re-attaches a ref whose callback changed: the editor's element would be
    // taken out of the page and put back -- losing the caret's focus -- each
    // time the window re-renders, which the first keystroke does (the unsaved
    // mark). The first one is kept; all it reads is the store, which is fixed.
    const handleContainerInit = useMemo(() => {
        return onContainerInit;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorStore]);
    return (
        <div
            className="app-markdown-preview-editor w-100 h-100 app-overflow-hidden"
            ref={handleContainerInit}
        />
    );
}
