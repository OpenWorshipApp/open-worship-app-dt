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
    checkIsVarySlideOnScreen,
    toKeyByFilePath,
    useAnyItemSelected,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import SlideAutoPlayComp, {
    type NextDataType,
} from '../../slide-auto-play/SlideAutoPlayComp';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
    MIN_THUMBNAIL_SCALE,
} from '../../app-document-list/appDocumentTypeHelpers';
import { useCallback, useMemo } from 'react';
import VirtualGridComp from '../../virtual-list/VirtualGridComp';
import {
    genSlideHeightGetter,
    THUMBNAIL_EXTRA_HEIGHT,
    THUMBNAIL_EXTRA_WIDTH,
    toVarySlideKey,
} from './varySlideGridHelpers';
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
import PdfConversionProgressComp from './PdfConversionProgressComp';

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

    const selectedVaryAppDocumentRef = useAppCurrentRef(
        selectedVaryAppDocument,
    );
    const refresh = useCallback(async () => {
        if (
            PdfAppDocument.checkIsThisType(selectedVaryAppDocumentRef.current)
        ) {
            setVarySlide(undefined);
        }
        attemptTimeout(async () => {
            const appDocument = selectedVaryAppDocumentRef.current;
            const newVarySlides = await appDocument.getSlides();
            // When selected file already changed, the new slides are for a
            // different document and must not be applied to the old one.
            if (
                appDocument.fileSource !==
                selectedVaryAppDocumentRef.current.fileSource
            ) {
                refresh();
                return;
            }
            setVarySlide(newVarySlides);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        filePath: selectedVaryAppDocument.filePath,
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

function LoadingSlidesComp({
    pdfFilePath,
}: Readonly<{ pdfFilePath: string | null }>) {
    return (
        <div
            className="w-100 d-flex flex-column justify-content-center align-items-center p-3"
            style={{ minHeight: '140px' }}
        >
            <LoadingComp />
            <PdfConversionProgressComp filePath={pdfFilePath} />
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
        filePath,
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
    const handleNext = useCallback((data: NextDataType) => {
        if (!varySlidesRef.current) {
            return;
        }
        // The answer ENDS the show when it is false: with "no repeat" the
        // document has run out, and nothing else would stop the clock.
        return handleNextItemSelecting({
            varySlides: varySlidesRef.current,
            isNext: data.isNext,
            options: data.options,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Rebuilt whenever the zoom moves, since it is what every row offset in
    // the grid is built from.
    const getSlideHeight = useMemo(() => {
        return genSlideHeightGetter(varySlideThumbnailSize);
    }, [varySlideThumbnailSize]);

    useAppEffect(() => {
        if (!varySlides?.length) {
            return;
        }
        // The card of the slide on a screen may be scrolled out of the window,
        // and a windowed row that is scrolled away has no DOM at all -- so the
        // key of what to look for travels with the query.
        const onScreenVarySlide = varySlides.find(checkIsVarySlideOnScreen);
        notifyElementHighlight(
            () => {
                const root = scopeRef.current?.containerRef.current ?? document;
                return root.querySelector(
                    `.${APP_DOCUMENT_ITEM_CLASS}` +
                        `.${HIGHLIGHT_SELECTED_CLASSNAME}.animation`,
                );
            },
            {
                revealKey:
                    onScreenVarySlide === undefined
                        ? undefined
                        : toKeyByFilePath(
                              onScreenVarySlide.filePath,
                              onScreenVarySlide.id,
                          ),
            },
        );
    }, [varySlides]);

    if (varySlides === undefined) {
        return (
            <LoadingSlidesComp
                pdfFilePath={isPDFAppDocument ? filePath : null}
            />
        );
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
    // A converted document recorded its missing fonts when it was built, so
    // the banner offers the rebuild that picks up a font installed since.
    let fontRefreshProps: { refreshLabel?: string; onRefresh?: () => void } =
        {};
    if (isPptxAppDocument) {
        fontRefreshProps = {
            refreshLabel: tran('Refresh PPTX Slides'),
            onRefresh: refreshPptxSlides,
        };
    } else if (isDocxAppDocument) {
        fontRefreshProps = {
            refreshLabel: tran('Refresh DOCX Pages'),
            onRefresh: refreshDocxSlides,
        };
    }
    return (
        <div className="w-100 slide-auto-play-host">
            <MissingFontFamilyBannerComp
                missingFontFamilyList={missingFontFamilyList ?? []}
                {...fontRefreshProps}
            />
            {/* Only the rows on screen are mounted. Every slide card carries a
                shadow root with a React root of its own, so a document of a
                thousand slides used to build a thousand of them before the
                first one could be looked at. */}
            <VirtualGridComp
                items={varySlides}
                getItemKey={toVarySlideKey}
                renderItem={(varySlide, index) => {
                    return (
                        <VarySlideRenderWrapperComp
                            key={varySlide.id}
                            thumbSize={varySlideThumbnailSize}
                            varySlide={varySlide}
                            index={index}
                        />
                    );
                }}
                itemWidth={varySlideThumbnailSize + THUMBNAIL_EXTRA_WIDTH}
                getItemHeight={getSlideHeight}
                estimateRowHeight={
                    (varySlides.length === 0
                        ? 0
                        : getSlideHeight(varySlides[0])) +
                    THUMBNAIL_EXTRA_HEIGHT
                }
                rowClassName="d-flex"
            />
            {isAnyItemSelected ? (
                <SlideAutoPlayComp
                    prefix="vary-app-document"
                    onNext={handleNext}
                />
            ) : null}
        </div>
    );
}
