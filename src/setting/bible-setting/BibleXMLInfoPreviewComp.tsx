import { useState } from 'react';
import { editor, languages } from 'monaco-editor';
import { compileSchema, SchemaNode } from 'json-schema-library';

import LoadingComp from '../../others/LoadingComp';
import {
    addMonacoBibleInfoActions,
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

const schema: SchemaNode = compileSchema(bibleInfoSchema);
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
    const setBibleInfo1 = (newBibleInfo: BibleJsonInfoType) => {
        setBibleInfo(newBibleInfo);
        const { valid, errors } = schema.validate(newBibleInfo);
        setCanSave(valid && errors.length === 0);
    };
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
                () => {
                    return getEditorBibleInfo(editorStore.editorInstance);
                },
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
                    applyBibleInfo(newBibleInfo);
                },
            );
        },
        onContentChange: (content) => {
            try {
                const newBibleInfo = JSON.parse(content);
                if (checkAreObjectsEqual(newBibleInfo, bibleInfo)) {
                    return;
                }
                setBibleInfo1(newBibleInfo);
            } catch (_error) {}
        },
    });
    const applyBibleInfo = (newBibleInfo: BibleJsonInfoType) => {
        setBibleInfo1(newBibleInfo);
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
        <div className="app-border-white-round p-2">
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
