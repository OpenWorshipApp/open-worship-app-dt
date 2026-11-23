import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import {
    appDocumentFlexSizeNames,
    toAppDocumentFlexSizeName,
} from '../../resize-actor/flexSizeHelpers';
import type Slide from '../../app-document-list/Slide';
import type AppDocument from '../../app-document-list/AppDocument';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import VarySlideNoteEditorComp from './VarySlideNoteEditorComp';
import { toWidgetLabel } from '../../others/labelIconHelpers';

export default function CanvasNoteContainerHandlerComp({
    appDocument,
    slide,
}: Readonly<{ appDocument: AppDocument; slide: Slide }>) {
    const { filePath } = appDocument.fileSource;
    return (
        <ResizeActorComp
            flexSizeName={toAppDocumentFlexSizeName(
                appDocumentFlexSizeNames.slideEditorNote,
                filePath,
            )}
            isHorizontal
            flexSizeDefault={{
                h1: ['1'],
                h2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return (
                                <AppDocumentNoteEditorComp
                                    appDocument={appDocument}
                                />
                            );
                        },
                    },
                    key: 'h1',
                    // Named as its header reads: the file name and the slide
                    // id had made the divider "Divider between x.ows and 0"
                    // (F-20 of robot run 20261120-2021).
                    ...toWidgetLabel('Document Note'),
                    className: 'app-flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <VarySlideNoteEditorComp
                                    appDocument={appDocument}
                                    slide={slide}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    ...toWidgetLabel('Slide Note'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
