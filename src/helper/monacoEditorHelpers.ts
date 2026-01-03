import { useMemo } from 'react';
import { editor, KeyMod, KeyCode, Uri } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { useStateSettingBoolean } from './settingHelpers';
import { useAppEffect } from './debuggerHelpers';
import { genTimeoutAttempt } from './helpers';
import { checkIsDarkMode } from '../others/initHelpers';

globalThis.MonacoEnvironment = {
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
    systemContent: string;
    editorInstance: editor.IStandaloneCodeEditor;
    div: HTMLDivElement;
    toggleIsWrapText: () => void;
    replaceValue: (value: string) => void;
    lastMouseClickPos: {
        x: number;
        y: number;
    };
};

const modelsMap: Record<string, editor.ITextModel> = {};
function getModel(value: string, uri: Uri, language: string) {
    const key = uri.toString();
    if (modelsMap[key] !== undefined) {
        return modelsMap[key];
    }
    const model = editor.createModel(value, language, uri);
    modelsMap[key] = model;
    return model;
}
function createEditor({
    options,
    language,
    onInit,
    onStore,
    uri,
}: {
    uri: Uri;
    language: string;
    options: editor.IStandaloneEditorConstructionOptions;
    onInit?: (editor: editor.IStandaloneCodeEditor) => void;
    onStore?: (editorStore: EditorStoreType) => void;
}) {
    const div = document.createElement('div');
    Object.assign(div.style, {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    });
    let editorInstance: editor.IStandaloneCodeEditor | null = null;
    const isDarkMode = checkIsDarkMode();
    const model = getModel(options.value ?? '', uri, language);
    editorInstance = editor.create(div, {
        value: '',
        theme: isDarkMode ? 'vs-dark' : 'vs-light',
        fontSize: 17,
        minimap: {
            enabled: false,
        },
        scrollbar: {},
        ...options,
        model,
    });

    onInit?.(editorInstance);
    const editorStore: EditorStoreType = {
        systemContent: '',
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
    // TODO: fix Monaco native pasting fail
    editorInstance.addAction({
        id: 'paste-from-clipboard',
        label: 'Paste from Clipboard',
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyV],
        contextMenuGroupId: 'navigation',
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
    return editorStore;
}

export type StoreType = {
    isWrapText: boolean;
    setIsWrapText: (value: boolean) => void;
    editorStore: EditorStoreType;
    setNewValue: (newContent: string) => void;
    onContainerInit: (container: HTMLElement | null) => () => void;
};
export function useInitMonacoEditor({
    settingName,
    options,
    onInit,
    onStore,
    onContentChange,
    uri,
    language,
}: {
    settingName: string;
    options: editor.IStandaloneEditorConstructionOptions;
    onInit?: (editorInstance: editor.IStandaloneCodeEditor) => void;
    onStore?: (editorStore: EditorStoreType) => void;
    onContentChange?: (oldContent: string, newContent: string) => void;
    uri: Uri;
    language: string;
}): StoreType {
    const [isWrapText, setIsWrapText] = useStateSettingBoolean(
        settingName,
        false,
    );
    const editorStore = useMemo(() => {
        const newEditorStore = createEditor({
            options,
            onInit,
            onStore,
            uri,
            language,
        });
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
                onContentChange(editorStore.systemContent, editorContent);
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
        setNewValue: (newContent: string) => {
            editorStore.replaceValue(newContent);
            editorStore.systemContent = newContent;
        },
        onContainerInit: (container: HTMLElement | null) => {
            if (container === null) {
                return () => {};
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
                editorStore.div.remove();
            };
        },
    };
}
