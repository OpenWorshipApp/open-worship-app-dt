import type {
    EventMapperType,
    KeyboardType,
} from '../../event/KeyboardEventListener';
import {
    allArrows,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import { useVarySlideThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import {
    getContainerDiv,
    handleArrowing,
    handleNextItemSelecting,
    showVarySlideInViewport,
} from './varyAppDocumentHelpers';
import VarySlideRenderWrapperComp from './VarySlideRenderWrapperComp';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
    useAppCurrentRef,
} from '../../helper/appHooks';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    useAnyItemSelected,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import SlideAutoPlayComp from '../../slide-auto-play/SlideAutoPlayComp';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
    MIN_THUMBNAIL_SCALE,
} from '../../app-document-list/appDocumentTypeHelpers';
import { useCallback, useMemo } from 'react';
import FillingFlexCenterComp from '../../others/FillingFlexCenterComp';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentHelpers';
import { tran } from '../../lang/langHelpers';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';
import PptxAppDocument from '../../app-document-list/PptxAppDocument';
import DocxAppDocument from '../../app-document-list/DocxAppDocument';
import { removePdfImagesPreview } from '../../helper/pdfHelpers';
import { removePptxHtmlsPreview } from '../../server/pptxHelpers';
import { removeDocxHtmlsPreview } from '../../server/docxHelpers';
import { notifyNewElementAdded } from '../../helper/domHelpers';

const varySlidesToView: { [key: string]: VarySlideType } = {};

const movingKeys: KeyboardType[] = [...allArrows, 'PageUp', 'PageDown', ' '];
const eventMaps: EventMapperType[] = movingKeys.map((key) => {
    return { key };
});
eventMaps.push({
    allControlKey: ['Shift'],
    key: ' ',
});
function useVarySlidesData() {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const [varySlides, setVarySlide] = useAppStateAsync<VarySlideType[]>(() => {
        return selectedVaryAppDocument.getSlides();
    }, [selectedVaryAppDocument]);

    useAppEffectAsync(
        async (context) => {
            if (varySlides === undefined) {
                const newVarySlides = await selectedVaryAppDocument.getSlides();
                context.setVarySlide(newVarySlides);
            }
        },
        [varySlides],
        { setVarySlide },
    );
    const refresh = async () => {
        const newVarySlides = await selectedVaryAppDocument.getSlides();
        setVarySlide(newVarySlides);
    };

    useFileSourceEvents(
        ['update'],
        refresh,
        [],
        selectedVaryAppDocument.filePath,
    );

    useKeyboardRegistering(
        eventMaps,
        (event) => {
            handleArrowing(event, varySlides ?? []);
        },
        [varySlides],
    );

    useAppEffect(() => {
        const varySlides = Object.values(varySlidesToView);
        if (varySlides.length === 0) {
            return;
        }
        for (const varySlide of varySlides) {
            showVarySlideInViewport(varySlide.id);
        }
        for (const key of Object.keys(varySlidesToView)) {
            delete varySlidesToView[key];
        }
    }, [varySlides]);
    const isPDFAppDocument = useMemo(() => {
        return PdfAppDocument.checkIsThisType(selectedVaryAppDocument);
    }, [selectedVaryAppDocument]);
    const isPptxAppDocument = useMemo(() => {
        return PptxAppDocument.checkIsThisType(selectedVaryAppDocument);
    }, [selectedVaryAppDocument]);
    const isDocxAppDocument = useMemo(() => {
        return DocxAppDocument.checkIsThisType(selectedVaryAppDocument);
    }, [selectedVaryAppDocument]);
    const selectedVaryAppDocumentRef = useAppCurrentRef(
        selectedVaryAppDocument,
    );
    const isPDFAppDocumentRef = useAppCurrentRef(isPDFAppDocument);
    const refreshPDFImages = useCallback(async () => {
        if (!isPDFAppDocumentRef.current) {
            return;
        }
        const pdfAppDocument =
            selectedVaryAppDocumentRef.current as PdfAppDocument;
        await removePdfImagesPreview(pdfAppDocument.filePath);
        pdfAppDocument.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isPptxAppDocumentRef = useAppCurrentRef(isPptxAppDocument);
    const refreshPptxSlides = useCallback(async () => {
        if (!isPptxAppDocumentRef.current) {
            return;
        }
        const pptxAppDocument =
            selectedVaryAppDocumentRef.current as PptxAppDocument;
        await removePptxHtmlsPreview(pptxAppDocument.filePath);
        pptxAppDocument.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isDocxAppDocumentRef = useAppCurrentRef(isDocxAppDocument);
    const refreshDocxSlides = useCallback(async () => {
        if (!isDocxAppDocumentRef.current) {
            return;
        }
        const docxAppDocument =
            selectedVaryAppDocumentRef.current as DocxAppDocument;
        await removeDocxHtmlsPreview(docxAppDocument.filePath);
        docxAppDocument.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        varySlides,
        startLoading: () => {
            setVarySlide(undefined);
        },
        isPDFAppDocument,
        isPptxAppDocument,
        isDocxAppDocument,
        refreshPDFImages,
        refreshPptxSlides,
        refreshDocxSlides,
    };
}

export default function VarySlidesComp() {
    const [thumbSizeScale] = useVarySlideThumbnailSizeScale({
        defaultSize: MIN_THUMBNAIL_SCALE + 10,
    });
    const {
        varySlides,
        startLoading,
        isPDFAppDocument,
        isPptxAppDocument,
        isDocxAppDocument,
        refreshPDFImages,
        refreshPptxSlides,
        refreshDocxSlides,
    } = useVarySlidesData();
    const varySlideThumbnailSize =
        thumbSizeScale * DEFAULT_THUMBNAIL_SIZE_FACTOR;
    const isAnyItemSelected = useAnyItemSelected(varySlides);
    const varySlidesRef = useAppCurrentRef(varySlides);
    const handleNext = useCallback((data: { isNext: boolean }) => {
        const element = getContainerDiv();
        if (element === null || !varySlidesRef.current) {
            return;
        }
        handleNextItemSelecting({
            container: element,
            varySlides: varySlidesRef.current,
            isNext: data.isNext,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        if (varySlides?.length) {
            notifyNewElementAdded(() => {
                return document.querySelector(
                    `.${APP_DOCUMENT_ITEM_CLASS}.app-highlight-selected.animation`,
                );
            });
        }
    }, [varySlides]);
    if (varySlides === undefined) {
        return <LoadingComp />;
    }
    if (varySlides === null) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex justify-content-center ' +
                    'flex-column align-items-center p-2'
                }
            >
                <p className="alert alert-warning">
                    {tran('Fail to load slides')}
                </p>
                <button onClick={startLoading} className="btn btn-primary">
                    {tran('Reload')}
                </button>
            </div>
        );
    }
    if (isPDFAppDocument && varySlides.length === 0) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex justify-content-center ' +
                    'flex-column align-items-center p-2'
                }
            >
                <p className="alert alert-warning text-center">
                    {tran('No slides to display')}
                </p>
                <br />
                <button onClick={refreshPDFImages} className="btn btn-primary">
                    {tran('Refresh PDF Images')}
                </button>
            </div>
        );
    }
    if (isPptxAppDocument && varySlides.length === 0) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex justify-content-center ' +
                    'flex-column align-items-center p-2'
                }
            >
                <p className="alert alert-warning text-center">
                    {tran('No slides to display')}
                </p>
                <br />
                <button onClick={refreshPptxSlides} className="btn btn-primary">
                    {tran('Refresh PPTX Slides')}
                </button>
            </div>
        );
    }
    if (isDocxAppDocument && varySlides.length === 0) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex justify-content-center ' +
                    'flex-column align-items-center p-2'
                }
            >
                <p className="alert alert-warning text-center">
                    {tran('No pages to display')}
                </p>
                <br />
                <button onClick={refreshDocxSlides} className="btn btn-primary">
                    {tran('Refresh DOCX Pages')}
                </button>
            </div>
        );
    }
    return (
        <div className="d-flex flex-wrap justify-content-center pb-5">
            {varySlides.map((varySlide, i) => {
                return (
                    <VarySlideRenderWrapperComp
                        key={varySlide.id}
                        thumbSize={varySlideThumbnailSize}
                        varySlide={varySlide}
                        index={i}
                    />
                );
            })}
            {varySlides.length > 2 ? (
                <FillingFlexCenterComp
                    width={varySlideThumbnailSize}
                    className={APP_DOCUMENT_ITEM_CLASS}
                />
            ) : null}
            {isAnyItemSelected ? (
                <SlideAutoPlayComp
                    prefix="vary-app-document"
                    onNext={handleNext}
                />
            ) : null}
        </div>
    );
}
