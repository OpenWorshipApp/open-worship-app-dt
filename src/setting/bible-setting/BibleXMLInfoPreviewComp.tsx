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
    const handleSaving = async () => {
        const { canSave, newBibleInfo } = validateCanSave();
        const booksAvailableLength = newBibleInfo.booksAvailable.length;
        const kjvBooksAvailableLength = kjvBibleInfo.bookKeysOrder.length;

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
    };
    return (
        <div className="w-100 card app-border-white-round app-overflow-hidden">
            <div
                className="w-100 card-body p-0 m-0 app-overflow-hidden"
                ref={onContainerInit}
                style={{ height: '450px' }}
            />
            <div
                className="card-footer d-flex justify-content-end p-0"
                style={{
                    height: '35px',
                }}
            >
                <button
                    ref={saveButtonRef}
                    className="btn btn-sm btn-success m-1"
                    style={{
                        position: 'absolute',
                    }}
                    onClick={handleSaving}
                >
                    `Save
                </button>
            </div>
        </div>
    );
}
