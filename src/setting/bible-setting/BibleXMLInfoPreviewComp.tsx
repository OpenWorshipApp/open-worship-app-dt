import { useState } from 'react';
import { editor, languages } from 'monaco-editor';

import LoadingComp from '../../others/LoadingComp';
import {
    addMonacoBibleInfoActions,
    handBibleInfoContextMenuOpening,
    updateBibleXMLInfo,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { useInitMonacoEditor } from '../../helper/monacoEditorHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import appProvider from '../../server/appProvider';

import bibleInfoSchema from './bibleInfoSchema.json';
import { AnyObjectType } from '../../helper/typeHelpers';

languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    comments: 'error',
    schemas: [
        {
            uri: `${appProvider.appInfo.homepage}/bible-info-schema.json`,
            fileMatch: ['*'],
            schema: bibleInfoSchema,
        },
    ],
    enableSchemaRequest: false,
    schemaValidation: 'error',
});

function getEditorBibleInfo(editorInstance: editor.IStandaloneCodeEditor) {
    const oldBibleInfo = editorInstance.getValue();
    if (oldBibleInfo === '') {
        return null;
    }
    try {
        return JSON.parse(oldBibleInfo);
    } catch (_error) {
        return null;
    }
}

export default function BibleXMLInfoPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const [canSave, setCanSave] = useState(false);
    const { bibleInfo, setBibleInfo, isPending } = useBibleXMLInfo(bibleKey);
    const { editorStore, onContainerInit } = useInitMonacoEditor({
        settingName: 'bible-xml-wrap-text',
        options: {
            value: '',
            language: 'json',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
        },
        onStore: (editorStore) => {
            addMonacoBibleInfoActions(
                editorStore,
                (partialBibleInfo: AnyObjectType) => {
                    const oldBibleInfo = getEditorBibleInfo(
                        editorStore.editorInstance,
                    );
                    if (oldBibleInfo === null) {
                        return;
                    }
                    const newBibleInfo = {
                        ...oldBibleInfo,
                        ...partialBibleInfo,
                    } as BibleJsonInfoType;
                    setBibleInfo1(newBibleInfo);
                    setCanSave(true);
                },
            );
        },
        onContentChange: (content) => {
            try {
                const newBibleInfo = JSON.parse(content);
                if (checkAreObjectsEqual(newBibleInfo, bibleInfo)) {
                    return;
                }
                setBibleInfo(newBibleInfo);
                setCanSave(true);
            } catch (_error) {}
        },
        onMarkersChange: (markers) => {
            // Only allow saving if there are no validation errors or warnings
            const hasErrors = markers.some((marker) => marker.severity >= 4); // 4 = Error, 8 = Warning
            setCanSave(!hasErrors && markers.length === 0);
        },
    });
    const setBibleInfo1 = (newBibleInfo: BibleJsonInfoType) => {
        setBibleInfo(newBibleInfo);
        const content = JSON.stringify(newBibleInfo, null, 2);
        editorStore.replaceValue(content);
        setCanSave(true);
    };
    useAppEffect(() => {
        const { editorInstance } = editorStore;
        editorInstance.focus();
        if (bibleInfo === null || editorInstance.getValue() !== '') {
            return;
        }
        const content = JSON.stringify(bibleInfo, null, 2);
        editorStore.editorInstance.setValue(content);
    }, [bibleInfo, onContainerInit]);
    if (isPending) {
        return <LoadingComp />;
    }
    if (bibleInfo === null) {
        return null;
    }
    return (
        <div
            className="app-border-white-round p-2"
            onContextMenu={(event) => {
                handBibleInfoContextMenuOpening(
                    event,
                    bibleInfo,
                    (newOutputJson) => {
                        setBibleInfo1(newOutputJson);
                        setCanSave(true);
                    },
                );
            }}
        >
            <button
                className="btn btn-success"
                style={{
                    position: 'absolute',
                }}
                disabled={!canSave}
                onClick={() => {
                    updateBibleXMLInfo(bibleInfo);
                    loadBibleKeys();
                }}
            >
                `Save
            </button>
            <div
                className="w-100 mt-5"
                ref={onContainerInit}
                style={{
                    height: '500px',
                }}
            />
        </div>
    );
}
