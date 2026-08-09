import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import {
    appDocumentFlexSizeNames,
    toAppDocumentFlexSizeName,
} from '../../resize-actor/flexSizeHelpers';
import AppDocumentNoteEditorComp from './AppDocumentNoteEditorComp';
import { useAppStateAsync } from '../../helper/appHooks';
import SlidesNoteEditorComp from './SlidesNoteEditorComp';
import {
    type VarySlideWithNoteType,
    type VaryAppDocumentWithNoteType,
} from '../../app-document-list/appDocumentTypeHelpers';
import PptxAppDocument from '../../app-document-list/PptxAppDocument';
import PptxSlidesNoteEditorComp from './PptxSlidesNoteEditorComp';
import type PptxSlide from '../../app-document-list/PptxSlide';
import { toWidgetLabel } from '../../others/labelIconHelpers';

export default function PresenterNoteContainerHandlerComp({
    varyAppDocumentWithNote,
    flexSizeNamePrefix,
}: Readonly<{
    varyAppDocumentWithNote: VaryAppDocumentWithNoteType;
    flexSizeNamePrefix?: string;
}>) {
    const { fullName: fileFullName, filePath } =
        varyAppDocumentWithNote.fileSource;
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
            flexSizeName={toAppDocumentFlexSizeName(
                appDocumentFlexSizeNames.presenterNote,
                filePath,
                flexSizeNamePrefix,
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
                            const slides = varySlides ?? [];
                            return (
                                <SlidesNoteEditorComp
                                    appDocument={varyAppDocumentWithNote}
                                    slides={slides}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    ...toWidgetLabel('Slide Notes'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
