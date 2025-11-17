import { compileSchema, SchemaNode } from 'json-schema-library';

import LoadingComp from '../../others/LoadingComp';
import { updateBibleXMLInfo, useBibleXMLInfo } from './bibleXMLHelpers';
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';

import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import { kjvBibleInfo } from '../../helper/bible-helpers/serverBibleHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';

export const bibleInfoSchema: SchemaNode = compileSchema(bibleInfoSchemaJson);

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
            jsonData={bibleInfo}
            onStore={() => {}}
            jsonDataSchema={bibleInfoSchema}
            save={(newBibleInfo: BibleJsonInfoType) => {
                handleSaving(newBibleInfo, loadBibleKeys);
            }}
        />
    );
}
