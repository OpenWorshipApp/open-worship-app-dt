import { useMemo } from 'react';
import { editor, KeyMod, KeyCode } from 'monaco-editor';

import { useSelectedLyricContext } from './lyricHelpers';
import Lyric from './Lyric';
import LyricMenuComp from './LyricMenuComp';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import appProvider from '../server/appProvider';

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

function createEditor() {
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
        language: 'markdown',
        theme: 'vs-dark',
        fontSize: 17,
        minimap: {
            enabled: false,
        },
        scrollbar: {},
    });
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
    monacoEditor.addAction({
        id: 'help',
        label: '`Markdown Music Help',
        contextMenuGroupId: 'navigation',
        run: async () => {
            appProvider.browserUtils.openExternalURL(
                'https://github.com/music-markdown/music-markdown?tab=readme-ov-file#verses',
            );
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

async function loadLyricContent(lyric: Lyric, monacoEditor: any) {
    const lyricContent = await lyric.getContent();
    if (lyricContent === null) {
        return;
    }
    const editorContent = monacoEditor.getValue();
    if (editorContent === lyricContent) {
        return;
    }
    monacoEditor.setValue(lyricContent);
}

function useInit(lyric: Lyric) {
    const [isWrapText, setIsWrapText] = useStateSettingBoolean(
        'lytic-editor-wrap-text',
        false,
    );
    const editorStore = useMemo(() => {
        const newEditorStore = createEditor();
        loadLyricContent(lyric, newEditorStore.monacoEditor);
        newEditorStore.monacoEditor.onDidChangeModelContent(async () => {
            const editorContent = newEditorStore.monacoEditor.getValue();
            const lyricContent = await lyric.getContent();
            if (editorContent === lyricContent) {
                return;
            }
            lyric.setContent(editorContent);
        });
        return newEditorStore;
    }, [lyric]);
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

    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(() => {
                loadLyricContent(lyric, editorStore.monacoEditor);
            });
        },
        [lyric],
        lyric.filePath,
    );
    return {
        isWrapText,
        setIsWrapText,
        editorStore,
    };
}

export default function LyricEditorComp() {
    const selectedLyric = useSelectedLyricContext();
    const { editorStore, isWrapText, setIsWrapText } = useInit(selectedLyric);
    const resizeAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    return (
        <div className="w-100 h-100 d-flex flex-column">
            <div className="d-flex">
                <div
                    className="input-group-text"
                    style={{
                        height: '30px',
                    }}
                >
                    Wrap Text:{' '}
                    <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        checked={isWrapText}
                        onChange={(event) => {
                            const checked = event.target.checked;
                            setIsWrapText(checked);
                        }}
                    />
                </div>
                <div className="flex-grow-1">
                    <LyricMenuComp />
                </div>
            </div>
            <div
                className="w-100 h-100 overflow-hidden"
                ref={(container) => {
                    if (container === null) {
                        return;
                    }
                    const resizeObserver = new ResizeObserver(() => {
                        resizeAttemptTimeout(() => {
                            editorStore.monacoEditor.layout();
                        });
                    });
                    resizeObserver.observe(container);
                    container.appendChild(editorStore.div);
                    return () => {
                        resizeObserver.disconnect();
                        container.removeChild(editorStore.div);
                    };
                }}
            />
        </div>
    );
}
