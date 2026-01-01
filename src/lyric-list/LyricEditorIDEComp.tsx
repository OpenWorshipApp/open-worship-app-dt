import { useMemo } from 'react';

import { useSelectedLyricContext } from './lyricHelpers';
import Lyric from './Lyric';
import LyricMenuComp from './LyricMenuComp';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import appProvider from '../server/appProvider';
import { useInitMonacoEditor } from '../helper/monacoEditorHelpers';
import { Uri } from 'monaco-editor';

async function loadLyricContent(lyric: Lyric, editorInstance: any) {
    const lyricContent = await lyric.getContent();
    if (lyricContent === null) {
        return;
    }
    const editorContent = editorInstance.getValue();
    if (editorContent === lyricContent) {
        return;
    }
    editorInstance.setValue(lyricContent);
}

export default function LyricEditorIDEComp() {
    const selectedLyric = useSelectedLyricContext();
    const { editorStore, isWrapText, setIsWrapText, onContainerInit } =
        useInitMonacoEditor({
            settingName: 'lytic-editor-wrap-text',
            options: { language: 'markdown' },
            onInit: (editorInstance) => {
                editorInstance.addAction({
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
            onContentChange: (_, content) => {
                selectedLyric.setContent(content);
            },
            uri: Uri.parse('lyric-editor'),
            language: 'markdown',
        });
    useAppEffectAsync(async () => {
        await loadLyricContent(selectedLyric, editorStore.editorInstance);
    }, [selectedLyric, editorStore.editorInstance]);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(() => {
                loadLyricContent(selectedLyric, editorStore.editorInstance);
            });
        },
        [selectedLyric],
        selectedLyric.filePath,
    );

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
                className="w-100 h-100 app-overflow-hidden"
                ref={onContainerInit}
            />
        </div>
    );
}
