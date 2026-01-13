import { useState } from 'react';
import { SchemaNode } from 'json-schema-library';

import { tran } from '../../lang/langHelpers';
import {
    EditorStoreType,
    useInitMonacoEditor,
} from '../../helper/monacoEditorHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';

import { AnyObjectType } from '../../helper/typeHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import { Uri } from 'monaco-editor';

function parseJsonData(content: string) {
    try {
        return JSON.parse(content);
    } catch (_error) {
        return {} as any;
    }
}

let setCanSave1: (canSave: boolean) => void = () => {};
function validateCanSave(
    jsonDataSchema: SchemaNode,
    oldContent: string,
    newContent: string,
) {
    const oldJsonData = parseJsonData(oldContent);
    const newJsonData = parseJsonData(newContent);
    const { valid, errors } = jsonDataSchema.validate(newJsonData);
    const isNoError = valid && errors.length === 0;
    const isChanged =
        oldJsonData !== null &&
        checkAreObjectsEqual(oldJsonData, newJsonData) === false;
    setCanSave1(isNoError && isChanged);
    return { canSave: isNoError, newJsonData };
}

function RenderSaveButton({
    editorStore,
    jsonDataSchema,
    save,
}: Readonly<{
    editorStore: ReturnType<typeof useInitMonacoEditor>['editorStore'];
    jsonDataSchema: SchemaNode;
    save: (newJsonData: AnyObjectType) => void;
}>) {
    const [canSave, setCanSave] = useState(false);
    useAppEffect(() => {
        setCanSave1 = setCanSave;
        return () => {
            setCanSave1 = () => {};
        };
    }, []);
    return (
        <button
            className={
                'btn btn-sm m-1 ' + (canSave ? 'btn-primary' : 'btn-secondary')
            }
            disabled={!canSave}
            onClick={() => {
                const { canSave, newJsonData } = validateCanSave(
                    jsonDataSchema,
                    editorStore.systemContent,
                    editorStore.editorInstance.getValue(),
                );
                if (canSave) {
                    save(newJsonData);
                }
            }}
        >
            {tran('Save')}
        </button>
    );
}

export default function BibleXMLEditorComp({
    id,
    jsonData,
    onStore,
    jsonDataSchema,
    save,
    editorUri,
}: Readonly<{
    id: string;
    jsonData: AnyObjectType;
    onStore: (editorStore: EditorStoreType) => void;
    jsonDataSchema: SchemaNode;
    save: (newJsonData: any) => void;
    editorUri: Uri;
}>) {
    const [isFullView, setIsFullView] = useStateSettingBoolean(
        `bible-xml-info-full-view-${id}`,
        false,
    );
    const store = useInitMonacoEditor({
        settingName: 'bible-xml-wrap-text',
        options: {
            value: '',
            language: 'json',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
        },
        onStore,
        onContentChange: validateCanSave.bind(null, jsonDataSchema),
        uri: editorUri,
        language: 'json',
    });
    const { editorStore, onContainerInit } = store;
    const applyJsonData = (newJsonData: AnyObjectType | null) => {
        const content =
            newJsonData === null ? '' : JSON.stringify(newJsonData, null, 4);
        store.setNewValue(content);
        validateCanSave(jsonDataSchema, content, content);
    };
    useAppEffect(() => {
        applyJsonData(jsonData);
    }, [jsonData]);
    if (jsonData === null) {
        return null;
    }

    return (
        <div
            className={
                'w-100 card app-border-white-round app-overflow-hidden' +
                (isFullView ? ' app-full-view' : '')
            }
        >
            <div
                className="w-100 card-body p-0 m-0 app-overflow-hidden"
                ref={onContainerInit}
                style={{ height: '450px' }}
            />
            <div
                className="w-100 card-footer d-flex p-0 app-overflow-hidden"
                style={{
                    height: '35px',
                }}
            >
                <div className="flex-grow-1">
                    <button
                        className="btn btn-sm btn-secondary m-1"
                        onClick={() => {
                            setIsFullView(!isFullView);
                        }}
                    >
                        {isFullView ? 'Exit Full View' : 'Full View'}
                    </button>
                </div>
                <div>
                    <RenderSaveButton
                        editorStore={editorStore}
                        jsonDataSchema={jsonDataSchema}
                        save={save}
                    />
                </div>
            </div>
        </div>
    );
}
