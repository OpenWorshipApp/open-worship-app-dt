import { useMemo } from 'react';
import { editor, KeyMod, KeyCode } from 'monaco-editor';

import { useStateSettingBoolean } from './settingHelpers';
import { useAppEffect } from './debuggerHelpers';

async function getCopiedText() {
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            if (text.length > 0) {
                return text;
            }
        } else {
            console.error('Clipboard API not supported in this browser.');
        }
    } catch (err) {
        console.error('Failed to read clipboard contents:', err);
    }
    return null;
}

function createEditor(
    language: string,
    onInit: (editor: editor.IStandaloneCodeEditor) => void,
) {
    const div = document.createElement('div');
    Object.assign(div.style, {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    });
    let monacoEditor: editor.IStandaloneCodeEditor | null = null;
    monacoEditor = editor.create(div, {
        value: '',
        language,
        theme: 'vs-dark',
        fontSize: 17,
        minimap: {
            enabled: false,
        },
        scrollbar: {},
    });
    onInit(monacoEditor);
    const editorStore = {
        monacoEditor,
        div,
        toggleIsWrapText: () => {},
    };
    // add context menu
    monacoEditor.addAction({
        id: 'toggle-wrap-text',
        label: '`Toggle Wrap Text',
        contextMenuGroupId: 'navigation',
        keybindings: [KeyMod.Alt | KeyCode.KeyZ],
        contextMenuOrder: 1.5,
        run: () => {
            editorStore.toggleIsWrapText();
        },
    });
    // TODO: fix Monaco native paste fail
    monacoEditor.addAction({
        id: 'paste',
        label: 'Paste',
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyV],
        run: async (editor) => {
            const clipboardText = await getCopiedText();
            if (!clipboardText) {
                return;
            }
            monacoEditor.executeEdits('paste', [
                {
                    range: editor.getSelection(),
                    text: clipboardText,
                } as any,
            ]);
        },
    });
    return editorStore;
}

export function useInitMonacoEditor({
    settingName,
    language,
    onInit,
    onContentChange,
}: {
    settingName: string;
    language: string;
    onInit: (editor: editor.IStandaloneCodeEditor) => void;
    onContentChange: (content: string) => void;
}) {
    const [isWrapText, setIsWrapText] = useStateSettingBoolean(
        settingName,
        false,
    );
    const editorStore = useMemo(() => {
        const newEditorStore = createEditor(language, onInit);
        newEditorStore.monacoEditor.onDidChangeModelContent(async () => {
            const editorContent = newEditorStore.monacoEditor.getValue();
            onContentChange(editorContent);
        });
        return newEditorStore;
    }, []);
    useAppEffect(() => {
        editorStore.toggleIsWrapText = () => {
            setIsWrapText(!isWrapText);
        };
        editorStore.monacoEditor.updateOptions({
            wordWrap: isWrapText ? 'on' : 'off',
        });
        editorStore.monacoEditor.layout();
        editorStore.monacoEditor.focus();
    }, [isWrapText, editorStore]);
    return {
        isWrapText,
        setIsWrapText,
        editorStore,
    };
}
