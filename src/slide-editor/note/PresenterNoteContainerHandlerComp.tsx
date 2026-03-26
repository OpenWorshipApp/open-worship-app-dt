import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import SlidesNoteEditorComp from './SlidesNoteEditorComp';
import {
    type VarySlideWithNoteType,
    type VaryAppDocumentWithNoteType,
} from '../../app-document-list/appDocumentTypeHelpers';
import PptxAppDocument from '../../app-document-list/PptxAppDocument';
import PptxSlidesNoteEditorComp from './PptxSlidesNoteEditorComp';
import type PptxSlide from '../../app-document-list/PptxSlide';
import type Slide from '../../app-document-list/Slide';

export default function PresenterNoteContainerHandlerComp({
    varyAppDocumentWithNote,
}: Readonly<{ varyAppDocumentWithNote: VaryAppDocumentWithNoteType }>) {
    const fileFullName = varyAppDocumentWithNote.fileSource.fullName;
    const [varySlides] = useAppStateAsync(async () => {
        const varySlides = await varyAppDocumentWithNote.getSlides();
        return varySlides as VarySlideWithNoteType[];
    }, [varyAppDocumentWithNote]);

    if (PptxAppDocument.checkIsThisType(varyAppDocumentWithNote)) {
        const pptxSlides = (varySlides ?? []) as PptxSlide[];
        return <PptxSlidesNoteEditorComp pptxSlides={pptxSlides} />;
    }
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
                                    appDocument={varyAppDocumentWithNote}
                                />
                            );
                        },
                    },
                    key: 'h1',
                    widgetName: fileFullName,
                    className: 'app-flex-item',
                },
                {
                    children: {
                        render: () => {
                            const slides = (varySlides ?? []) as Slide[];
                            return (
                                <SlidesNoteEditorComp
                                    appDocument={varyAppDocumentWithNote}
                                    slides={slides}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    widgetName: 'Slides',
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
