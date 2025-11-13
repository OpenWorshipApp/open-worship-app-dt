import { useState } from 'react';
import { languages } from 'monaco-editor';
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

import bibleInfoSchemaJson from './bibleInfoSchema.json';
import { AnyObjectType } from '../../helper/typeHelpers';
import { kjvBibleInfo } from '../../helper/bible-helpers/serverBibleHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';

const bibleInfoSchema: SchemaNode = compileSchema(bibleInfoSchemaJson);
languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    comments: 'error',
    schemas: [
        {
            uri: `${appProvider.appInfo.homepage}/bible-info-schema.json`,
            fileMatch: ['*'],
            schema: bibleInfoSchemaJson,
        },
    ],
    enableSchemaRequest: false,
    schemaValidation: 'error',
});

function getEditorBibleInfo(content: string): BibleJsonInfoType {
    try {
        return JSON.parse(content) as BibleJsonInfoType;
    } catch (_error) {
        return {} as any;
    }
}

async function handleSaving(
    canSave: boolean,
    newBibleInfo: BibleJsonInfoType,
    loadBibleKeys: () => void,
) {
    const booksAvailableLength = newBibleInfo.booksAvailable.length;
    const kjvBooksAvailableLength = kjvBibleInfo.bookKeysOrder.length;

    if (booksAvailableLength !== kjvBooksAvailableLength) {
        const isConfirmed = await showAppConfirm(
            'Confirm Book Count Mismatch',
            `Books available is ${booksAvailableLength}, ` +
                `which is different from KJV (${kjvBooksAvailableLength}). ` +
                'Are you sure to continue?',
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isConfirmed) {
            return;
        }
    }
    if (canSave) {
        updateBibleXMLInfo(newBibleInfo);
        loadBibleKeys();
    }
}

let setCanSave1: (canSave: boolean) => void = () => {};
function validateCanSave(oldContent: string, newContent: string) {
    const oldBibleInfo = getEditorBibleInfo(oldContent);
    const newBibleInfo = getEditorBibleInfo(newContent);
    const { valid, errors } = bibleInfoSchema.validate(newBibleInfo);
    const isNoError = valid && errors.length === 0;
    const isChanged =
        oldBibleInfo !== null &&
        checkAreObjectsEqual(oldBibleInfo, newBibleInfo) === false;
    setCanSave1(isNoError && isChanged);
    return { canSave: isNoError, newBibleInfo };
}

function RenderSaveButton({
    editorStore,
    loadBibleKeys,
}: Readonly<{
    editorStore: ReturnType<typeof useInitMonacoEditor>['editorStore'];
    loadBibleKeys: () => void;
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
            className="btn btn-sm btn-success m-1"
            disabled={!canSave}
            style={{
                position: 'absolute',
            }}
            onClick={() => {
                const { canSave, newBibleInfo } = validateCanSave(
                    editorStore.systemContent,
                    editorStore.editorInstance.getValue(),
                );
                handleSaving(canSave, newBibleInfo, loadBibleKeys);
            }}
        >
            `Save
        </button>
    );
}

export default function BibleXMLInfoPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const { bibleInfo, isPending } = useBibleXMLInfo(bibleKey);
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
        onStore: (editorStore) => {
            addMonacoBibleInfoActions(
                editorStore,
                () => {
                    return getEditorBibleInfo(
                        editorStore.editorInstance.getValue(),
                    );
                },
                (partialBibleInfo: AnyObjectType) => {
                    const oldBibleInfo = getEditorBibleInfo(
                        editorStore.editorInstance.getValue(),
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
    const { editorStore, onContainerInit } = store;
    const applyBibleInfo = (newBibleInfo: BibleJsonInfoType | null) => {
        const content =
            newBibleInfo === null ? '' : JSON.stringify(newBibleInfo, null, 4);
        store.setNewValue(content);
        validateCanSave(content, content);
    };
    useAppEffect(() => {
        applyBibleInfo(bibleInfo);
    }, [bibleInfo]);
    if (isPending) {
        return <LoadingComp />;
    }
    if (bibleInfo === null) {
        return null;
    }

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
                <RenderSaveButton
                    editorStore={editorStore}
                    loadBibleKeys={loadBibleKeys}
                />
            </div>
        </div>
    );
}
