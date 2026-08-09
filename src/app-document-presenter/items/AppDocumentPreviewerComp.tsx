import './SlidePreviewer.scss';

import { type CSSProperties, lazy, use } from 'react';

import { tran } from '../../lang/langHelpers';
import { toWidgetLabel } from '../../others/labelIconHelpers';
import VarySlidesPreviewerComp from './VarySlidesPreviewerComp';
import AppDocumentPreviewerFooterComp from './AppDocumentPreviewerFooterComp';
import {
    checkIsLyricFilePath,
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import PageBaseAppearanceSettingComp from '../../screen-setting/PageBaseAppearanceSettingComp';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';
import DocxAppDocument from '../../app-document-list/DocxAppDocument';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import {
    appDocumentFlexSizeNames,
    toAppDocumentFlexSizeName,
} from '../../resize-actor/flexSizeHelpers';
import appProvider from '../../server/appProvider';
import PresenterNoteContainerHandlerComp from '../../slide-editor/note/PresenterNoteContainerHandlerComp';
import { useStateSettingString } from '../../helper/settingHelpers';
import { DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME } from './slideItemRenderHelpers';
import { PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME } from '../../_screen/screenAppDocumentTypeHelpers';
import type { VaryAppDocumentType } from '../../app-document-list/appDocumentTypeHelpers';

type PreviewerBodyStyle = CSSProperties & {
    '--app-docx-preview-background'?: string;
};

// A lyric renders open-lyric's own previewer instead of the slide list, so the
// whole `open-lyric` chain must stay out of this chunk (the slide editor window
// loads this module too).
const LazyLyricHandlerComp = lazy(() => {
    return import('../../lyric-list/LyricHandlerComp');
});

function EditorComp({
    varyAppDocument,
    flexSizeNamePrefix = '',
}: Readonly<{
    varyAppDocument: VaryAppDocumentType;
    // A floating preview shows the SAME document as the main panel may be
    // showing, and the note pane is remembered per document — without a prefix
    // the two panes would overwrite each other's size.
    flexSizeNamePrefix?: string;
}>) {
    const fileSource = varyAppDocument.fileSource;
    if (
        PdfAppDocument.checkIsThisType(varyAppDocument) ||
        DocxAppDocument.checkIsThisType(varyAppDocument)
    ) {
        return <VarySlidesPreviewerComp />;
    }
    return (
        <ResizeActorComp
            flexSizeName={toAppDocumentFlexSizeName(
                appDocumentFlexSizeNames.presenterPreviewer,
                fileSource.filePath,
                flexSizeNamePrefix,
            )}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['6'],
                v2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return <VarySlidesPreviewerComp />;
                        },
                    },
                    key: 'v1',
                    ...toWidgetLabel('Slides'),
                    className: 'app-flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <PresenterNoteContainerHandlerComp
                                    varyAppDocumentWithNote={varyAppDocument}
                                    flexSizeNamePrefix={flexSizeNamePrefix}
                                />
                            );
                        },
                    },
                    key: 'v2',
                    ...toWidgetLabel('Note'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}

/**
 * Only the BODY differs per document kind — a lyric gets the open-lyric
 * previewer, everything else gets the slide list. The previewer's card chrome
 * (footer with the thumbnail scale + file name) is shared by all of them.
 */
function PreviewerBodyComp({
    varyAppDocument,
    flexSizeNamePrefix,
}: Readonly<{
    varyAppDocument: VaryAppDocumentType;
    flexSizeNamePrefix?: string;
}>) {
    const { filePath } = varyAppDocument;
    if (checkIsLyricFilePath(filePath)) {
        return (
            <AppSuspenseComp>
                <LazyLyricHandlerComp filePath={filePath} />
            </AppSuspenseComp>
        );
    }
    if (appProvider.isPagePresenter) {
        return (
            <EditorComp
                varyAppDocument={varyAppDocument}
                flexSizeNamePrefix={flexSizeNamePrefix}
            />
        );
    }
    return <VarySlidesPreviewerComp />;
}

/**
 * The previewer for ONE document, given as a prop rather than read from the
 * global selection — which is what lets a floating preview render the very same
 * tree for a document the main panel is not showing.
 */
export function VaryAppDocumentPreviewerCardComp({
    varyAppDocument,
    isDisableChanging,
    shouldShowHistory,
    flexSizeNamePrefix,
}: Readonly<{
    varyAppDocument: VaryAppDocumentType;
    isDisableChanging?: boolean;
    shouldShowHistory?: boolean;
    flexSizeNamePrefix?: string;
}>) {
    const [docxPreviewBackgroundColor, setDocxPreviewBackgroundColor] =
        useStateSettingString<string>(PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME);
    const isPDF = varyAppDocument instanceof PdfAppDocument;
    const isDocx = varyAppDocument instanceof DocxAppDocument;
    const isPageBase = isPDF || isDocx;
    const previewerBodyStyle: PreviewerBodyStyle = {
        position: 'relative',
    };
    if (isPageBase && docxPreviewBackgroundColor) {
        previewerBodyStyle[DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME] =
            docxPreviewBackgroundColor;
    }
    return (
        <div
            className="slide-previewer card w-100 h-100 app-zero-border-radius"
            style={{
                position: 'relative',
            }}
        >
            <VaryAppDocumentContext value={varyAppDocument}>
                <div
                    className="card-body w-100 h-100 app-overflow-hidden"
                    style={previewerBodyStyle}
                >
                    <PreviewerBodyComp
                        varyAppDocument={varyAppDocument}
                        flexSizeNamePrefix={flexSizeNamePrefix}
                    />
                </div>
                <AppDocumentPreviewerFooterComp
                    isDisableChanging={isDisableChanging}
                    shouldShowHistory={shouldShowHistory}
                />
                {isPageBase ? (
                    <PageBaseAppearanceSettingComp
                        docxPreviewBackgroundColor={docxPreviewBackgroundColor}
                        onDocxPreviewBackgroundColorChange={
                            setDocxPreviewBackgroundColor
                        }
                    />
                ) : null}
            </VaryAppDocumentContext>
        </div>
    );
}

export default function AppDocumentPreviewerComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    const selectedVaryAppDocument =
        selectedAppDocumentContext?.selectedVaryAppDocument ?? null;
    if (selectedVaryAppDocument === null) {
        return (
            <div
                className={
                    'slide-previewer card w-100 h-100 app-zero-border-radius ' +
                    'd-flex align-items-center justify-content-center'
                }
                style={{
                    position: 'relative',
                }}
            >
                <h3 className="text-muted">
                    {tran('No App Document Selected')}
                </h3>
            </div>
        );
    }
    return (
        <VaryAppDocumentPreviewerCardComp
            varyAppDocument={selectedVaryAppDocument}
        />
    );
}
