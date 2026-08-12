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
    handleSlideMoving,
    handleNextItemSelecting,
} from './varyAppDocumentHelpers';
import VarySlideRenderWrapperComp from './VarySlideRenderWrapperComp';
import {
    useAppEffect,
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
import { notifyElementHighlight } from '../../helper/domHelpers';
import MissingFontFamilyBannerComp from './MissingFontFamilyBannerComp';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';
import {
    useSlidesPreviewerScope,
    useThumbnailScaleSettingOptions,
} from './slidesPreviewerScopeHelpers';

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
    // MUST be per-instance: the Lyric Stage Previewer mounts one
    // `VarySlidesComp` per stage over the SAME `filePath`, so every pane's
    // `refresh` lands on the same file-source `update` event. A module-level
    // timer let the second caller `clearTimeout` the first's pending callback,
    // leaving every stage but one stale.
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const [varySlides, setVarySlide] = useAppStateAsync<VarySlideType[]>(() => {
        return selectedVaryAppDocument.getSlides();
    }, [selectedVaryAppDocument]);

    const refresh = async () => {
        attemptTimeout(async () => {
            const newVarySlides = await selectedVaryAppDocument.getSlides();
            setVarySlide(newVarySlides);
        });
    };

    useFileSourceEvents(
        ['update'],
        refresh,
        [],
        selectedVaryAppDocument.filePath,
    );

    const varySlidesRef = useAppCurrentRef(varySlides);
    // EVERY mounted previewer's listener fires on a key press, so each one must
    // ask about ITS OWN container — `handleSlideMoving` is what compares the
    // container against `document.activeElement` and lets only the focused one
    // act.
    const scope = useSlidesPreviewerScope();
    const scopeRef = useAppCurrentRef(scope);
    useKeyboardRegistering(
        eventMaps,
        (event) => {
            handleSlideMoving(
                event,
                varySlidesRef.current ?? [],
                scopeRef.current?.containerRef.current ?? null,
            );
        },
        [],
    );

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

    // Read the document's missing fonts once the preview is built. Keyed on
    // `varySlides` so it re-reads after a regeneration/refresh.
    const [missingFontFamilyList] = useAppStateAsync<string[]>(
        async () => {
            if (!varySlides?.length) {
                return [];
            }
            return await selectedVaryAppDocument.getMissingFontFamilyList();
        },
        [selectedVaryAppDocument, varySlides],
        [],
    );

    return {
        varySlides,
        startLoading: () => {
            setVarySlide(undefined);
        },
        isPDFAppDocument,
        isPptxAppDocument,
        isDocxAppDocument,
        missingFontFamilyList,
        refreshPDFImages,
        refreshPptxSlides,
        refreshDocxSlides,
    };
}

/**
 * Every "there is nothing to show, here is the button that might fix it" state:
 * failed to load, and each document kind that can legitimately hold zero
 * slides. They differ only in the sentence and the button, so they are one
 * component — four copies of this markup drifted apart in padding once already.
 *
 * The `tran()` calls stay at the CALL SITES on purpose: a key reaching `tran()`
 * only as a variable is invisible to a grep for it, and a key missing from the
 * Khmer data throws and blanks the page.
 */
function NoSlidesToDisplayComp({
    message,
    actionLabel,
    onAction,
}: Readonly<{
    message: string;
    actionLabel: string;
    onAction: () => void;
}>) {
    return (
        <div
            className={
                'w-100 h-100 d-flex justify-content-center gap-2 ' +
                'flex-column align-items-center p-2'
            }
        >
            <p className="alert alert-warning text-center">{message}</p>
            <button onClick={onAction} className="btn btn-primary">
                {actionLabel}
            </button>
        </div>
    );
}

function LoadingSlidesComp() {
    return (
        <div
            className="w-100 d-flex justify-content-center align-items-center"
            style={{ height: '100px' }}
        >
            <LoadingComp />
        </div>
    );
}

export default function VarySlidesComp() {
    const [thumbSizeScale] = useVarySlideThumbnailSizeScale(
        useThumbnailScaleSettingOptions({
            defaultSize: MIN_THUMBNAIL_SCALE + 10,
        }),
    );
    const scope = useSlidesPreviewerScope();
    const scopeRef = useAppCurrentRef(scope);
    const {
        varySlides,
        startLoading,
        isPDFAppDocument,
        isPptxAppDocument,
        isDocxAppDocument,
        missingFontFamilyList,
        refreshPDFImages,
        refreshPptxSlides,
        refreshDocxSlides,
    } = useVarySlidesData();
    const varySlideThumbnailSize =
        thumbSizeScale * DEFAULT_THUMBNAIL_SIZE_FACTOR;
    const isAnyItemSelected = useAnyItemSelected(varySlides);
    const varySlidesRef = useAppCurrentRef(varySlides);
    const handleNext = useCallback((data: { isNext: boolean }) => {
        const element =
            scopeRef.current?.containerRef.current ?? getContainerDiv();
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
        if (!varySlides?.length) {
            return;
        }
        notifyElementHighlight(() => {
            const root = scopeRef.current?.containerRef.current ?? document;
            return root.querySelector(
                `.${APP_DOCUMENT_ITEM_CLASS}.${HIGHLIGHT_SELECTED_CLASSNAME}.animation`,
            );
        });
    }, [varySlides]);

    if (varySlides === undefined) {
        return <LoadingSlidesComp />;
    }
    if (varySlides === null) {
        return (
            <NoSlidesToDisplayComp
                message={tran('Fail to load slides')}
                actionLabel={tran('Reload')}
                onAction={startLoading}
            />
        );
    }
    if (isPDFAppDocument && varySlides.length === 0) {
        return (
            <NoSlidesToDisplayComp
                message={tran('No slides to display')}
                actionLabel={tran('Refresh PDF Images')}
                onAction={refreshPDFImages}
            />
        );
    }
    if (isPptxAppDocument && varySlides.length === 0) {
        return (
            <NoSlidesToDisplayComp
                message={tran('No slides to display')}
                actionLabel={tran('Refresh PPTX Slides')}
                onAction={refreshPptxSlides}
            />
        );
    }
    if (isDocxAppDocument && varySlides.length === 0) {
        return (
            <NoSlidesToDisplayComp
                message={tran('No pages to display')}
                actionLabel={tran('Refresh DOCX Pages')}
                onAction={refreshDocxSlides}
            />
        );
    }
    return (
        <div className="d-flex flex-wrap justify-content-center pb-5">
            <MissingFontFamilyBannerComp
                missingFontFamilyList={missingFontFamilyList ?? []}
            />
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
