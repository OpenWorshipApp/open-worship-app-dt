import { useRef } from 'react';
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
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import appProvider from '../../server/appProvider';

import bibleInfoSchema from './bibleInfoSchema.json';
import { AnyObjectType } from '../../helper/typeHelpers';
import { kjvBibleInfo } from '../../helper/bible-helpers/serverBibleHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';

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

function getEditorBibleInfo(
    editorInstance: editor.IStandaloneCodeEditor,
): BibleJsonInfoType {
    const oldBibleInfo = editorInstance.getValue();
    try {
        return JSON.parse(oldBibleInfo) as BibleJsonInfoType;
    } catch (_error) {
        return {} as any;
    }
}

export default function BibleXMLInfoPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const { bibleInfo, isPending } = useBibleXMLInfo(bibleKey);
    const saveButtonRef = useRef<HTMLButtonElement>(null);
    const setCanSave = (canSave: boolean) => {
        if (saveButtonRef.current) {
            saveButtonRef.current.disabled = !canSave;
        }
    };
    const validateCanSave = () => {
        const newBibleInfo = getEditorBibleInfo(editorStore.editorInstance);
        const { valid, errors } = schema.validate(newBibleInfo);
        const canSave = valid && errors.length === 0;
        setCanSave(canSave);
        return { canSave, newBibleInfo };
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
        onContentChange: validateCanSave,
    });
    const applyBibleInfo = (newBibleInfo: BibleJsonInfoType) => {
        const content = JSON.stringify(newBibleInfo, null, 2);
        editorStore.replaceValue(content);
        validateCanSave();
    };
    useAppEffect(() => {
        const content =
            bibleInfo === null ? '' : JSON.stringify(bibleInfo, null, 2);
        editorStore.replaceValue(content);
    }, [bibleInfo]);
    if (isPending) {
        return <LoadingComp />;
    }
    if (bibleInfo === null) {
        return null;
    }
    return (
        <div className="app-border-white-round p-2">
            <button
                ref={saveButtonRef}
                className="btn btn-success"
                style={{
                    position: 'absolute',
                }}
                onClick={async () => {
                    const { canSave, newBibleInfo } = validateCanSave();
                    const booksAvailableLength =
                        newBibleInfo.booksAvailable.length;
                    const kjvBooksAvailableLength =
                        kjvBibleInfo.booksOrder.length;

                    if (booksAvailableLength !== kjvBooksAvailableLength) {
                        const isConfirmed = await showAppConfirm(
                            'Confirm Book Count Mismatch',
                            `Books available is ${booksAvailableLength}, ` +
                                `which is different from KJV (${kjvBooksAvailableLength}). ` +
                                'Are you sure to continue?',
                        );
                        if (!isConfirmed) {
                            return;
                        }
                    }
                    if (canSave) {
                        updateBibleXMLInfo(newBibleInfo);
                        loadBibleKeys();
                    }
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
