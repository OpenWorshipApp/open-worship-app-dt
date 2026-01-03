import { useMemo } from 'react';
import { Uri } from 'monaco-editor';

import FileSource from '../../helper/FileSource';
import { useSelectedWebContext } from './webEditorHelpers';
import { useInitMonacoEditor } from '../../helper/monacoEditorHelpers';
import appProvider from '../../server/appProvider';
import { useAppEffectAsync } from '../../helper/debuggerHelpers';
import { genTimeoutAttempt } from '../../helper/helpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

async function loadWebContent(filePath: string, editorInstance: any) {
    const fileSource = FileSource.getInstance(filePath);
    const webContent = await fileSource.readFileData();
    if (webContent === null) {
        return;
    }
    const editorContent = editorInstance.getValue();
    if (editorContent === webContent) {
        return;
    }
    editorInstance.setValue(webContent);
}

export default function WebEditorIDEComp() {
    const filePath = useSelectedWebContext();
    const { editorStore, onContainerInit } = useInitMonacoEditor({
        settingName: 'web-editor-wrap-text',
        options: { language: 'html' },
        onInit: (editorInstance) => {
            editorInstance.addAction({
                id: 'learn',
                label: '`Learn More About Web Development`',
                contextMenuGroupId: 'navigation',
                run: async () => {
                    appProvider.browserUtils.openExternalURL(
                        'https://developer.mozilla.org/en-US/docs/Web/HTML',
                    );
                },
            });
        },
        onContentChange: (_, content) => {
            const fileSource = FileSource.getInstance(filePath);
            fileSource.writeFileData(content);
        },
        uri: Uri.parse('web-editor'),
        language: 'html',
    });
    useAppEffectAsync(async () => {
        await loadWebContent(filePath, editorStore.editorInstance);
    }, [filePath, editorStore.editorInstance]);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(() => {
                loadWebContent(filePath, editorStore.editorInstance);
            });
        },
        [filePath],
        filePath,
    );

    return (
        <div className="w-100 h-100 d-flex flex-column">
            <div
                className="w-100 h-100 app-overflow-hidden"
                ref={onContainerInit}
            />
        </div>
    );
}
