import { languages } from 'monaco-editor';

import BibleXMLInfoEditorComp, {
    uri as bibleInfoUri,
} from './BibleXMLInfoEditorComp';
import BibleXMLExtraEditorComp, {
    uri as bibleExtraUri,
} from './BibleXMLExtraEditorComp';
import BibleXMLBookChapterEditorComp, {
    uri as bibleBookChapterUri,
} from './BibleXMLBookChapterEditorComp';
import { useStateSettingString } from '../../helper/settingHelpers';

import bibleInfoSchemaJson from './schemas/bibleInfoSchema.json';
import bibleExtraSchemaJson from './schemas/bibleExtraSchema.json';
import bookChapterSchemaJson from './schemas/bibleBookChapterSchema.json';

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
            uri: bibleExtraSchemaJson.$id,
            fileMatch: [bibleExtraUri.toString()],
            schema: bibleExtraSchemaJson,
        },
        {
            uri: bookChapterSchemaJson.$id,
            fileMatch: [bibleBookChapterUri.toString()],
            schema: bookChapterSchemaJson,
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
