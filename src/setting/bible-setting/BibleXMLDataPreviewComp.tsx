import { languages } from 'monaco-editor';

import BibleXMLInfoEditorComp from './BibleXMLInfoEditorComp';
import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import bibleNewLinesSchemaJson from './schemas/bibleNewLinesSchema.json';
import bibleNewLinesTitleSchemaJson from './schemas/bibleNewLinesTitleSchema.json';
import bibleCustomVersesSchemaJson from './schemas/bibleCustomVersesSchema.json';

languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    comments: 'error',
    schemas: [
        {
            uri: 'bible-info',
            fileMatch: ['*'],
            schema: bibleInfoSchemaJson,
        },
        {
            uri: 'bible-new-lines',
            fileMatch: ['*'],
            schema: bibleNewLinesSchemaJson,
        },
        {
            uri: 'bible-new-lines-title',
            fileMatch: ['*'],
            schema: bibleNewLinesTitleSchemaJson,
        },
        {
            uri: 'bible-custom-verses',
            fileMatch: ['*'],
            schema: bibleCustomVersesSchemaJson,
        },
    ],
    enableSchemaRequest: false,
    schemaValidation: 'error',
});

export default function BibleXMLDataPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    return (
        <BibleXMLInfoEditorComp
            bibleKey={bibleKey}
            loadBibleKeys={loadBibleKeys}
        />
    );
}
