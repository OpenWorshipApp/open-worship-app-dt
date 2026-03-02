import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import AppDocument from '../../app-document-list/AppDocument';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import SlideNoteEditorComp from './SlideNoteEditorComp';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import Slide from '../../app-document-list/Slide';

function SlidesNoteEditorComp({
    appDocument,
    slides,
}: Readonly<{ appDocument: AppDocument; slides: Slide[] }>) {
    return (
        <div
            className="w-100 app-inner-shadow p-1"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            {slides.map((slide) => {
                return (
                    <div
                        className="w-100"
                        key={slide.id}
                        style={{
                            height: '200px',
                            borderBottom: '1px solid #ccc',
                        }}
                    >
                        <SlideNoteEditorComp
                            appDocument={appDocument}
                            slide={slide}
                            title={`Slide Note: ${slide.name || slide.id.toString()}`}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export default function PresenterNoteContainerHandlerComp({
    appDocument,
}: Readonly<{ appDocument: AppDocument }>) {
    const fileFullName = appDocument.fileSource.fullName;
    const [slides] = useAppStateAsync(() => {
        return appDocument.getSlides();
    }, [appDocument]);
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
                    widgetName: fileFullName,
                    className: 'flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <SlidesNoteEditorComp
                                    appDocument={appDocument}
                                    slides={slides ?? []}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    widgetName: 'Slides',
                    className: 'flex-item',
                },
            ]}
        />
    );
}
