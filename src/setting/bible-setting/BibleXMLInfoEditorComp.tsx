import { compileSchema, SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import LoadingComp from '../../others/LoadingComp';
import {
    addMonacoBibleInfoActions,
    updateBibleXMLInfo,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';
import { AnyObjectType } from '../../helper/typeHelpers';

import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import { forceReloadAppWindows } from '../settingHelpers';

export const schemaHandler: SchemaNode = compileSchema(bibleInfoSchemaJson);
export const uri = Uri.parse('bible-info');

async function handleSaving(
    oldBibleInfo: BibleJsonInfoType,
    newBibleInfo: BibleJsonInfoType,
) {
    const isSuccess = await updateBibleXMLInfo(oldBibleInfo, newBibleInfo);
    if (isSuccess) {
        forceReloadAppWindows();
    }
}

export default function BibleXMLInfoEditorComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
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
                        const newBibleInfo: BibleJsonInfoType = {
                            ...oldBibleInfo,
                            ...partialBibleInfo,
                        };
                        editorStore.replaceValue(
                            JSON.stringify(newBibleInfo, null, 4),
                        );
                    },
                );
            }}
            jsonDataSchema={schemaHandler}
            save={(newBibleInfo: BibleJsonInfoType) => {
                handleSaving(bibleInfo, newBibleInfo);
            }}
            editorUri={uri}
        />
    );
}
