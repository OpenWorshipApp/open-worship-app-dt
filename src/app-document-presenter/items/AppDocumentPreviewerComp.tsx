import './SlidePreviewer.scss';

import { type CSSProperties, lazy, use } from 'react';

import { tran } from '../../lang/langHelpers';
import { toWidgetLabel } from '../../others/labelIconHelpers';
import VarySlidesPreviewerComp from './VarySlidesPreviewerComp';
import AppDocumentPreviewerFooterComp from './AppDocumentPreviewerFooterComp';
import {
    checkIsLyricFilePath,
    SelectedVaryAppDocumentContext,
    useVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import PageBaseAppearanceSettingComp from '../../screen-setting/PageBaseAppearanceSettingComp';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';
import DocxAppDocument from '../../app-document-list/DocxAppDocument';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import appProvider from '../../server/appProvider';
import PresenterNoteContainerHandlerComp from '../../slide-editor/note/PresenterNoteContainerHandlerComp';
import { useStateSettingString } from '../../helper/settingHelpers';
import { DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME } from './slideItemRenderHelpers';
import { PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME } from '../../_screen/screenAppDocumentTypeHelpers';

type PreviewerBodyStyle = CSSProperties & {
    '--app-docx-preview-background'?: string;
};

// A lyric renders open-lyric's own previewer instead of the slide list, so the
// whole `open-lyric` chain must stay out of this chunk (the slide editor window
// loads this module too).
const LazyLyricHandlerComp = lazy(() => {
    return import('../../lyric-list/LyricHandlerComp');
});

function EditorComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const fileSource = varyAppDocument.fileSource;
    if (
        PdfAppDocument.checkIsThisType(varyAppDocument) ||
        DocxAppDocument.checkIsThisType(varyAppDocument)
    ) {
        return <VarySlidesPreviewerComp />;
    }
    return (
        <ResizeActorComp
            flexSizeName={fileSource.fullName}
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
                    ...toWidgetLabel('Document List'),
                    className: 'app-flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <PresenterNoteContainerHandlerComp
                                    varyAppDocumentWithNote={varyAppDocument}
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
function PreviewerBodyComp({ filePath }: Readonly<{ filePath: string }>) {
    if (checkIsLyricFilePath(filePath)) {
        return (
            <AppSuspenseComp>
                <LazyLyricHandlerComp filePath={filePath} />
            </AppSuspenseComp>
        );
    }
    if (appProvider.isPagePresenter) {
        return <EditorComp />;
    }
    return <VarySlidesPreviewerComp />;
}

export default function AppDocumentPreviewerComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    const [docxPreviewBackgroundColor, setDocxPreviewBackgroundColor] =
        useStateSettingString<string>(PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME);
    if (!selectedAppDocumentContext?.selectedVaryAppDocument) {
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
    const isPDF =
        selectedAppDocumentContext.selectedVaryAppDocument instanceof
        PdfAppDocument;
    const isDocx =
        selectedAppDocumentContext.selectedVaryAppDocument instanceof
        DocxAppDocument;
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
            <VaryAppDocumentContext
                value={selectedAppDocumentContext.selectedVaryAppDocument}
            >
                <div
                    className="card-body w-100 h-100 app-overflow-hidden"
                    style={previewerBodyStyle}
                >
                    <PreviewerBodyComp
                        filePath={
                            selectedAppDocumentContext.selectedVaryAppDocument
                                .filePath
                        }
                    />
                </div>
                <AppDocumentPreviewerFooterComp />
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
