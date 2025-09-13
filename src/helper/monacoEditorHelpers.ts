import { useMemo } from 'react';
import { editor, KeyMod, KeyCode } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { useStateSettingBoolean } from './settingHelpers';
import { useAppEffect } from './debuggerHelpers';
import { genTimeoutAttempt } from './helpers';
import { checkIsDarkMode } from '../initHelpers';

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') {
            return new jsonWorker();
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
            return new cssWorker();
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new htmlWorker();
        }
        if (label === 'typescript' || label === 'javascript') {
            return new tsWorker();
        }
        return new editorWorker();
    },
};

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') {
            return new jsonWorker();
        }
        return new editorWorker();
    },
};

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
export type EditorStoreType = {
    editorInstance: editor.IStandaloneCodeEditor;
    div: HTMLDivElement;
    toggleIsWrapText: () => void;
    replaceValue: (value: string) => void;
    lastMouseClickPos: {
        x: number;
        y: number;
    };
};

function createEditor(
    options: editor.IStandaloneEditorConstructionOptions,
    onInit?: (editor: editor.IStandaloneCodeEditor) => void,
    onStore?: (editorStore: EditorStoreType) => void,
) {
    const div = document.createElement('div');
    Object.assign(div.style, {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    });
    let editorInstance: editor.IStandaloneCodeEditor | null = null;
    const isDarkMode = checkIsDarkMode();
    editorInstance = editor.create(div, {
        value: '',
        language: 'plaintext',
        theme: isDarkMode ? 'vs-dark' : 'vs-light',
        fontSize: 17,
        minimap: {
            enabled: false,
        },
        scrollbar: {},
        ...options,
    });
    onInit?.(editorInstance);
    const editorStore: EditorStoreType = {
        editorInstance,
        div,
        toggleIsWrapText: () => {},
        lastMouseClickPos: {
            x: 0,
            y: 0,
        },
        replaceValue: (value: string) => {
            const range = editorInstance.getModel()?.getFullModelRange();
            if (range === undefined) {
                return;
            }
            editorInstance.executeEdits('paste', [
                {
                    range,
                    text: value,
                } as any,
            ]);
            editorInstance.focus();
        },
    };
    onStore?.(editorStore);
    editorInstance.onMouseDown((mouseEvent) => {
        editorStore.lastMouseClickPos = {
            x: mouseEvent.event.posx,
            y: mouseEvent.event.posy,
        };
    });
    editorInstance.addAction({
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
    editorInstance.addAction({
        id: 'paste',
        label: 'Paste',
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyV],
        run: async (editor) => {
            const clipboardText = await getCopiedText();
            if (!clipboardText) {
                return;
            }
            editorInstance.executeEdits('paste', [
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
    options,
    onInit,
    onStore,
    onContentChange,
}: {
    settingName: string;
    options: editor.IStandaloneEditorConstructionOptions;
    onInit?: (editorInstance: editor.IStandaloneCodeEditor) => void;
    onStore?: (editorStore: EditorStoreType) => void;
    onContentChange?: (content: string) => void;
}) {
    const [isWrapText, setIsWrapText] = useStateSettingBoolean(
        settingName,
        false,
    );
    const editorStore = useMemo(() => {
        const newEditorStore = createEditor(options, onInit, onStore);
        const { editorInstance } = newEditorStore;
        editor.onDidChangeMarkers((uriList) => {
            const currentUri = editorInstance.getModel()?.uri;
            if (currentUri === undefined) {
                return;
            }
            if (
                uriList.some(
                    (uri) => uri.toString() === currentUri?.toString(),
                ) === false
            ) {
                return;
            }
        });
        if (onContentChange !== undefined) {
            editorInstance.onDidChangeModelContent(async () => {
                const editorContent = editorInstance.getValue();
                onContentChange(editorContent);
            });
        }
        return newEditorStore;
    }, []);
    useAppEffect(() => {
        editorStore.toggleIsWrapText = () => {
            setIsWrapText(!isWrapText);
        };
        editorStore.editorInstance.updateOptions({
            wordWrap: isWrapText ? 'on' : 'off',
        });
        editorStore.editorInstance.layout();
        editorStore.editorInstance.focus();
    }, [isWrapText, editorStore]);

    const resizeAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);

    return {
        isWrapText,
        setIsWrapText,
        editorStore,
        onContainerInit: (container: HTMLElement | null) => {
            if (container === null) {
                return;
            }
            const resizeObserver = new ResizeObserver(() => {
                resizeAttemptTimeout(() => {
                    editorStore.editorInstance.layout();
                });
            });
            resizeObserver.observe(container);
            container.appendChild(editorStore.div);
            return () => {
                resizeObserver.disconnect();
                container.removeChild(editorStore.div);
            };
        },
    };
}
