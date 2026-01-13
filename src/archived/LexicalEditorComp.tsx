import './LexicalEditorComp.scss';

import { useState } from 'react';
import { createEditor, HISTORY_MERGE_TAG, type LexicalEditor } from 'lexical';
import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';

import prepopulatedRichText from './prepopulatedRichText';
import { useAppEffect } from '../helper/debuggerHelpers';

function initEditor() {
    const target = document.createElement('div');
    Object.assign(target.style, {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    });
    target.innerHTML = `
  <div>
    <h1>Lexical Basic - Vanilla JS</h1>
    <div class="editor-wrapper">
      <div id="lexical-editor" contenteditable></div>
    </div>
    <h4>Editor state:</h4>
    <textarea id="lexical-state"></textarea>
  </div>
`;
    const editorRef = target.querySelector('#lexical-editor') as HTMLDivElement;
    const stateRef = target.querySelector(
        '#lexical-state',
    ) as HTMLTextAreaElement;

    const initialConfig = {
        namespace: 'Vanilla JS Demo',
        // Register nodes specific for @lexical/rich-text
        nodes: [HeadingNode, QuoteNode],
        onError: (error: Error) => {
            throw error;
        },
        theme: {
            // Adding styling to Quote node, see styles.css
            quote: 'PlaygroundEditorTheme__quote',
        },
    };
    const editor = createEditor(initialConfig);
    editor.setRootElement(editorRef);

    // Registering Plugins
    mergeRegister(
        registerRichText(editor),
        registerDragonSupport(editor),
        registerHistory(editor, createEmptyHistoryState(), 300),
    );

    editor.update(prepopulatedRichText, { tag: HISTORY_MERGE_TAG });

    editor.registerUpdateListener(({ editorState }) => {
        stateRef.value = JSON.stringify(editorState.toJSON(), undefined, 2);
    });

    return {
        editor,
        target,
    };
}

let store: {
    editor: LexicalEditor;
    target: HTMLDivElement;
} | null = null;
function updateEditorContainer(container: HTMLDivElement | null) {
    store ??= initEditor();
    if (store.target.parentElement === container) {
        return;
    }
    const { target } = store;
    target?.remove();
    container?.appendChild(target);
}

export default function LexicalEditorComp() {
    const [n, setN] = useState(0);
    useAppEffect(() => {
        const interval = setInterval(() => {
            setN((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div id="lexical-editor-container">
            <div>
                <h3>number:{n}</h3>
                <div
                    id="editor-container"
                    ref={(ref) => {
                        if (ref !== null) {
                            updateEditorContainer(ref);
                        }
                    }}
                />
            </div>
        </div>
    );
}
