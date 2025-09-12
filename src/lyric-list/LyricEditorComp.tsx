import { useMemo } from 'react';

import { useSelectedLyricContext } from './lyricHelpers';
import Lyric from './Lyric';
import LyricMenuComp from './LyricMenuComp';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import appProvider from '../server/appProvider';
import { useInitMonacoEditor } from '../helper/monacoEditorHelpers';

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

export default function LyricEditorComp() {
    const selectedLyric = useSelectedLyricContext();
    const { editorStore, isWrapText, setIsWrapText } = useInitMonacoEditor({
        settingName: 'lytic-editor-wrap-text',
        language: 'markdown',
        onInit: (editor) => {
            editor.addAction({
                id: 'help',
                label: '`Markdown Music Help',
                contextMenuGroupId: 'navigation',
                run: async () => {
                    appProvider.browserUtils.openExternalURL(
                        'https://github.com/music-markdown/music-markdown?tab=readme-ov-file#verses',
                    );
                },
            });
        },
        onContentChange: (content) => {
            selectedLyric.setContent(content);
        },
    });
    useAppEffectAsync(async () => {
        await loadLyricContent(selectedLyric, editorStore.monacoEditor);
    }, [selectedLyric, editorStore.monacoEditor]);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(() => {
                loadLyricContent(selectedLyric, editorStore.monacoEditor);
            });
        },
        [selectedLyric],
        selectedLyric.filePath,
    );

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
