import LoadingComp from '../../others/LoadingComp';
import { updateBibleXMLInfo, useBibleXMLInfo } from './bibleXMLHelpers';
import type { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import BibleXMLEditorComp, {
    addMonacoBibleInfoActions,
} from './BibleXMLEditorComp';
import type { AnyObjectType } from '../../helper/typeHelpers';

import { forceReloadAppWindows } from '../settingHelpers';
import { infoEditorSchemaHandler } from './schemas/bibleSchemaHelpers';
import { bibleInfoUri } from './schemas/bibleEditorUriHelpers';

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
            jsonDataSchema={infoEditorSchemaHandler}
            save={(newBibleInfo: BibleJsonInfoType) => {
                handleSaving(bibleInfo, newBibleInfo);
            }}
            editorUri={bibleInfoUri}
        />
    );
}
