import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import Slide from '../../app-document-list/Slide';
import AppDocument from '../../app-document-list/AppDocument';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import SlideNoteEditorComp from './SlideNoteEditorComp';

export default function NoteContainerHandlerComp({
    appDocument,
    slide,
}: Readonly<{ appDocument: AppDocument; slide: Slide }>) {
    const fileFullName = appDocument.fileSource.fullName;
    return (
        <ResizeActorComp
            flexSizeName={fileFullName}
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
                    widgetName: slide.name ?? slide.id.toString(),
                    className: 'flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <SlideNoteEditorComp
                                    appDocument={appDocument}
                                    slide={slide}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    widgetName: fileFullName,
                    className: 'flex-item',
                },
            ]}
        />
    );
}
