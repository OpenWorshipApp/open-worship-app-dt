import { compileSchema, SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import LoadingComp from '../../others/LoadingComp';
import {
    addMonacoBibleInfoActions,
    updateBibleXMLInfo,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';

import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import { kjvBibleInfo } from '../../helper/bible-helpers/serverBibleHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';
import { AnyObjectType } from '../../helper/typeHelpers';

export const schemaHandler: SchemaNode = compileSchema(bibleInfoSchemaJson);
export const uri = Uri.parse('bible-info');

async function handleSaving(
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
    await updateBibleXMLInfo(newBibleInfo);
    loadBibleKeys();
}

export default function BibleXMLInfoEditorComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const { bibleInfo, isPending } = useBibleXMLInfo(bibleKey);
    if (isPending) {
        return <LoadingComp />;
    }
    if (bibleInfo === null) {
        return null;
    }

    return (
        <BibleXMLEditorComp
            id={bibleKey}
            jsonData={{ ...bibleInfo, booksAvailable: undefined }}
            onStore={(editorStore) => {
                addMonacoBibleInfoActions(
                    editorStore,
                    // getBibleInfo
                    () => {
                        return JSON.parse(
                            editorStore.editorInstance.getValue(),
                        );
                    },
                    // setPartialBibleInfo
                    (partialBibleInfo: AnyObjectType) => {
                        const oldBibleInfo = JSON.parse(
                            editorStore.editorInstance.getValue(),
                        );
                        if (oldBibleInfo === null) {
                            return;
                        }
                        const newBibleInfo = {
                            ...oldBibleInfo,
                            ...partialBibleInfo,
                        } as BibleJsonInfoType;
                        editorStore.replaceValue(
                            JSON.stringify(newBibleInfo, null, 4),
                        );
                    },
                );
            }}
            jsonDataSchema={schemaHandler}
            save={(newBibleInfo: BibleJsonInfoType) => {
                handleSaving(newBibleInfo, loadBibleKeys);
            }}
            editorUri={uri}
        />
    );
}
