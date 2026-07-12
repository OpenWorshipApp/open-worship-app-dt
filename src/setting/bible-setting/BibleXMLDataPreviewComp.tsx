import { useCallback } from 'react';

import { json } from 'monaco-editor';

import BibleXMLInfoEditorComp from './BibleXMLInfoEditorComp';
import { useStateSettingString } from '../../helper/settingHelpers';
import {
    bookChapterEditorSchemaHandler,
    extraEditorSchemaHandler,
    infoEditorSchemaHandler,
} from './schemas/bibleSchemaHelpers';
import BibleXMLBookChapterEditorComp from './BibleXMLBookChapterEditorComp';
import BibleXMLExtraEditorComp from './BibleXMLExtraEditorComp';
import {
    bibleBookChapterUri,
    bibleExtraUri,
    bibleInfoUri,
} from './schemas/bibleEditorUriHelpers';
import { getBibleXMLDataFromKey } from './bibleXMLHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { warnIfBibleKeyDirty } from './bibleEditorDirtyHelpers';
import {
    BIBLE_EDITOR_BODY_HEIGHT,
    BIBLE_EDITOR_FOOTER_HEIGHT,
} from './BibleXMLEditorComp';

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
    const setEditingTypeRef = useAppCurrentRef(setEditingType);
    const targetEditingTypeRef = useAppCurrentRef(targetEditingType);
    const handleClick = useCallback(() => {
        setEditingTypeRef.current(targetEditingTypeRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={'btn btn-sm ' + (isActive ? 'btn-light' : 'btn-primary')}
            onClick={handleClick}
        >
            {title}
        </button>
    );
}

async function downloadBibleJSON(bibleKey: string) {
    const bibleXMLData = await getBibleXMLDataFromKey(bibleKey);
    if (bibleXMLData === null) {
        showSimpleToast(
            'error',
            `Bible XML data for key "${bibleKey}" not found.`,
        );
        return;
    }
    const blob = new Blob([JSON.stringify(bibleXMLData, null, 2)], {
        type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bibleKey}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
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
    // Block switching tabs while the current editor has unsaved changes,
    // mirroring the reload/close guards, so edits are not silently discarded
    // when the editor unmounts.
    const handleSetEditingType = (newEditingType: string) => {
        if (
            newEditingType !== editingType &&
            warnIfBibleKeyDirty(
                bibleKey,
                'Save or discard unsaved Bible changes before switching tabs.',
            )
        ) {
            return;
        }
        setEditingType(newEditingType);
    };
    let element: any;
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
                <div className="btn-group" role="group">
                    <RenderChoiceComp
                        setEditingType={handleSetEditingType}
                        title="Info"
                        targetEditingType="info"
                        editingType={editingType}
                    />
                    <RenderChoiceComp
                        setEditingType={handleSetEditingType}
                        title="Extra"
                        targetEditingType="extra"
                        editingType={editingType}
                    />
                    <RenderChoiceComp
                        setEditingType={handleSetEditingType}
                        title="Book Chapter"
                        targetEditingType="book-chapter"
                        editingType={editingType}
                    />
                </div>
                {/* add download button here, when click then download the whole bible json data to Download */}
                <button
                    className="btn btn-sm btn-success ms-2"
                    onClick={() => {
                        downloadBibleJSON(bibleKey);
                    }}
                >
                    Download
                    <i className="bi bi-download ms-1" />
                </button>
            </div>
            <div
                className="card-body"
                style={{
                    // Reserve the editor card's height (body + footer +
                    // borders) so the card does not collapse to the small
                    // loading spinner and then snap to full size.
                    minHeight:
                        BIBLE_EDITOR_BODY_HEIGHT +
                        BIBLE_EDITOR_FOOTER_HEIGHT +
                        3,
                }}
            >
                {element}
            </div>
        </div>
    );
}
