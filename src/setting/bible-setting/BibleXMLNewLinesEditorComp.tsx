import { compileSchema, SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import LoadingComp from '../../others/LoadingComp';
import { getBibleXMLDataFromKey } from './bibleXMLHelpers';
import BibleXMLEditorComp from './BibleXMLEditorComp';

import bibleNewLinesSchemaJson from './schemas/bibleNewLinesSchema.json';
import { useAppStateAsync } from '../../helper/debuggerHelpers';

export const bibleNewLinesSchema: SchemaNode = compileSchema(
    bibleNewLinesSchemaJson,
);
export const uri = Uri.parse('bible-new-lines');

export default function BibleXMLNewLinesEditorComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const [xmlBibleData] = useAppStateAsync(() => {
        return getBibleXMLDataFromKey(bibleKey);
    });
    if (xmlBibleData === undefined) {
        return <LoadingComp />;
    }
    if (xmlBibleData === null) {
        return null;
    }
    return (
        <BibleXMLEditorComp
            id={bibleKey}
            jsonData={xmlBibleData.newLines}
            onStore={() => {}}
            jsonDataSchema={bibleNewLinesSchema}
            save={(newNewLines: string[]) => {
                console.log(newNewLines);
            }}
            editorUri={uri}
        />
    );
}
