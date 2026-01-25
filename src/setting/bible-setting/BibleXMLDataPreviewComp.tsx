import { json } from 'monaco-editor';

import BibleXMLInfoEditorComp, {
    schemaHandler as infoEditorSchemaHandler,
    uri as bibleInfoUri,
} from './BibleXMLInfoEditorComp';
import BibleXMLExtraEditorComp, {
    schemaHandler as extraEditorSchemaHandler,
    uri as bibleExtraUri,
} from './BibleXMLExtraEditorComp';
import BibleXMLBookChapterEditorComp, {
    schemaHandler as bookChapterEditorSchemaHandler,
    uri as bibleBookChapterUri,
} from './BibleXMLBookChapterEditorComp';
import { useStateSettingString } from '../../helper/settingHelpers';

json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: 'error',
    comments: 'error',
    schemas: [
        {
            uri: infoEditorSchemaHandler.schema.$id,
            fileMatch: [bibleInfoUri.toString()],
            schema: infoEditorSchemaHandler.schema,
        },
        {
            uri: extraEditorSchemaHandler.schema.$id,
            fileMatch: [bibleExtraUri.toString()],
            schema: extraEditorSchemaHandler.schema,
        },
        {
            uri: bookChapterEditorSchemaHandler.schema.$id,
            fileMatch: [bibleBookChapterUri.toString()],
            schema: bookChapterEditorSchemaHandler.schema,
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
    const isActive = editingType === targetEditingType;
    return (
        <button
            className={'btn btn-sm ' + (isActive ? 'btn-light' : 'btn-primary')}
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
}: Readonly<{
    bibleKey: string;
}>) {
    const [editingType, setEditingType] = useStateSettingString<string>(
        `bible-setting-${bibleKey}-xml-data-editing-type`,
        'info',
    );
    let element: any = null;
    if (editingType === 'info') {
        element = <BibleXMLInfoEditorComp bibleKey={bibleKey} />;
    } else if (editingType === 'book-chapter') {
        element = <BibleXMLBookChapterEditorComp bibleKey={bibleKey} />;
    } else {
        element = <BibleXMLExtraEditorComp bibleKey={bibleKey} />;
    }
    return (
        <div className="card">
            <div
                className="card-header d-flex justify-content-start p-0"
                style={{
                    height: '30px',
                }}
            >
                <RenderChoiceComp
                    setEditingType={setEditingType}
                    title="Info"
                    targetEditingType="info"
                    editingType={editingType}
                />
                <RenderChoiceComp
                    setEditingType={setEditingType}
                    title="Extra"
                    targetEditingType="extra"
                    editingType={editingType}
                />
                <RenderChoiceComp
                    setEditingType={setEditingType}
                    title="Book Chapter"
                    targetEditingType="book-chapter"
                    editingType={editingType}
                />
            </div>
            <div className="card-body">{element}</div>
        </div>
    );
}
