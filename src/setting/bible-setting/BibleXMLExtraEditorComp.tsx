import { compileSchema, SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import LoadingComp from '../../others/LoadingComp';
import {
    getBibleXMLDataFromKey,
    saveJsonDataToXMLfile,
} from './bibleXMLHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';

import bibleNewLinesSchemaJson from './schemas/bibleExtraSchema.json';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import { useMemo } from 'react';
import { BibleXMLExtraType } from './bibleXMLJsonDataHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

export const bibleExtraSchema: SchemaNode = compileSchema(
    bibleNewLinesSchemaJson,
);
export const uri = Uri.parse('bible-extra');

type DataType = BibleXMLExtraType & {
    bibleKey: string;
};

async function handleSaving(
    bibleKey: string,
    newJsonData: BibleXMLExtraType,
    loadBibleKeys: () => void,
) {
    const xmlBibleData = await getBibleXMLDataFromKey(bibleKey);
    if (!xmlBibleData) {
        showSimpleToast(
            'Saving Bible Data',
            `Bible Data not found for key ${bibleKey}`,
        );
        return;
    }
    const newXmlBibleData = {
        ...xmlBibleData,
        newLines: newJsonData.newLines,
        newLinesTitleMap: newJsonData.newLinesTitleMap,
        customVersesMap: newJsonData.customVersesMap,
    };
    const isSuccess = await saveJsonDataToXMLfile(newXmlBibleData);
    if (isSuccess) {
        loadBibleKeys();
    }
}

export default function BibleXMLExtraEditorComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const [xmlBibleData] = useAppStateAsync(() => {
        return getBibleXMLDataFromKey(bibleKey);
    });
    const jsonData = useMemo(() => {
        if (!xmlBibleData) {
            return {};
        }
        return {
            bibleKey,
            newLines: xmlBibleData.newLines,
            newLinesTitleMap: xmlBibleData.newLinesTitleMap,
            customVersesMap: xmlBibleData.customVersesMap,
        } as DataType;
    }, [xmlBibleData]);
    if (xmlBibleData === undefined) {
        return <LoadingComp />;
    }
    if (xmlBibleData === null) {
        return null;
    }
    return (
        <BibleXMLEditorComp
            id={bibleKey}
            jsonData={jsonData}
            onStore={() => {}}
            jsonDataSchema={bibleExtraSchema}
            save={(newJsonData: DataType) => {
                if (newJsonData.bibleKey !== bibleKey) {
                    showSimpleToast(
                        'Saving Bible Data',
                        `Invalid Bible Key ${newJsonData.bibleKey}`,
                    );
                    return;
                }
                handleSaving(bibleKey, newJsonData, loadBibleKeys);
            }}
            editorUri={uri}
        />
    );
}
