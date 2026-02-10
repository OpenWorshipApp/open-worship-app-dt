import { useMemo } from 'react';

import LoadingComp from '../../others/LoadingComp';
import {
    getBibleXMLDataFromKey,
    saveJsonDataToXMLfile,
} from './bibleXMLHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import type { BibleXMLExtraType } from './bibleXMLJsonDataHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

import type { AnyObjectType } from '../../helper/typeHelpers';
import { forceReloadAppWindows } from '../settingHelpers';
import { extraEditorSchemaHandler } from './schemas/bibleSchemaHelpers';
import { bibleExtraUri } from './schemas/bibleEditorUriHelpers';

type DataType = BibleXMLExtraType & {
    bibleKey: string;
};

async function handleSaving(bibleKey: string, newJsonData: BibleXMLExtraType) {
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
        forceReloadAppWindows();
    }
}

export default function BibleXMLExtraEditorComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
}>) {
    const [xmlBibleData] = useAppStateAsync(() => {
        return getBibleXMLDataFromKey(bibleKey);
    });
    const jsonData: DataType | AnyObjectType = useMemo(() => {
        if (!xmlBibleData) {
            return {};
        }
        return {
            bibleKey,
            newLines: xmlBibleData.newLines,
            newLinesTitleMap: xmlBibleData.newLinesTitleMap,
            customVersesMap: xmlBibleData.customVersesMap,
        };
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
            jsonDataSchema={extraEditorSchemaHandler}
            save={(newJsonData: DataType) => {
                if (newJsonData.bibleKey !== bibleKey) {
                    showSimpleToast(
                        'Saving Bible Data',
                        `Invalid Bible Key ${newJsonData.bibleKey}`,
                    );
                    return;
                }
                handleSaving(bibleKey, newJsonData);
            }}
            editorUri={bibleExtraUri}
        />
    );
}
