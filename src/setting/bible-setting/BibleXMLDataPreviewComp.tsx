import { languages } from 'monaco-editor';

import BibleXMLInfoEditorComp, {
    uri as bibleInfoUri,
} from './BibleXMLInfoEditorComp';
import BibleXMLNewLinesEditorComp, {
    uri as bibleNewLinesUri,
} from './BibleXMLNewLinesEditorComp';

import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import bibleNewLinesSchemaJson from './schemas/bibleNewLinesSchema.json';
import bibleNewLinesTitleSchemaJson from './schemas/bibleNewLinesTitleSchema.json';
import bibleCustomVersesSchemaJson from './schemas/bibleCustomVersesSchema.json';
import { useState } from 'react';

languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    comments: 'error',
    schemas: [
        {
            uri: bibleInfoSchemaJson.$id,
            fileMatch: [bibleInfoUri.toString()],
            schema: bibleInfoSchemaJson,
        },
        {
            uri: bibleNewLinesSchemaJson.$id,
            fileMatch: [bibleNewLinesUri.toString()],
            schema: bibleNewLinesSchemaJson,
        },
        {
            uri: bibleNewLinesTitleSchemaJson.$id,
            fileMatch: ['bible-new-lines-title'],
            schema: bibleNewLinesTitleSchemaJson,
        },
        {
            uri: bibleCustomVersesSchemaJson.$id,
            fileMatch: ['bible-custom-verses'],
            schema: bibleCustomVersesSchemaJson,
        },
    ],
    enableSchemaRequest: false,
    schemaValidation: 'error',
});

function RenderChoiceComp({
    setEditingType,
    title,
    editingType,
    targetEditingType,
}: Readonly<{
    setEditingType: (type: string) => void;
    title: string;
    editingType: string;
    targetEditingType: string;
}>) {
    return (
        <button
            className="btn btn-sm btn-info"
            disabled={editingType === targetEditingType}
            onClick={() => {
                setEditingType(targetEditingType);
            }}
        >
            {title}
        </button>
    );
}

export default function BibleXMLDataPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const [editingType, setEditingType] = useState<string>('info');
    let element: any = null;
    if (editingType === 'info') {
        element = (
            <BibleXMLInfoEditorComp
                bibleKey={bibleKey}
                loadBibleKeys={loadBibleKeys}
            />
        );
    } else if (editingType === 'new-lines') {
        element = (
            <BibleXMLNewLinesEditorComp
                bibleKey={bibleKey}
                loadBibleKeys={loadBibleKeys}
            />
        );
    }
    return (
        <div className="card">
            <div className="card-header d-flex justify-content-start">
                <RenderChoiceComp
                    setEditingType={setEditingType}
                    title="Info"
                    targetEditingType="info"
                    editingType={editingType}
                />
                <RenderChoiceComp
                    setEditingType={setEditingType}
                    title="New Lines"
                    targetEditingType="new-lines"
                    editingType={editingType}
                />
            </div>
            <div className="card-body">{element}</div>
        </div>
    );
}
