import type {
    EventMapperType,
    KeyboardType,
} from '../../event/KeyboardEventListener';
import {
    allArrows,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import { useAppDocumentItemThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import {
    getContainerDiv,
    handleArrowing,
    handleNextItemSelecting,
    showVaryAppDocumentItemInViewport,
} from './varyAppDocumentHelpers';
import VaryAppDocumentItemRenderWrapperComp from './VaryAppDocumentItemRenderWrapperComp';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
} from '../../helper/debuggerHelpers';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    useAnyItemSelected,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import SlideAutoPlayComp from '../../slide-auto-play/SlideAutoPlayComp';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
    MIN_THUMBNAIL_SCALE,
} from '../../app-document-list/appDocumentTypeHelpers';
import { useCallback, useMemo } from 'react';
import FillingFlexCenterComp from '../../others/FillingFlexCenterComp';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentHelpers';
import { tran } from '../../lang/langHelpers';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';
import { removePdfImagesPreview } from '../../helper/pdfHelpers';

const varyAppDocumentItemsToView: { [key: string]: VaryAppDocumentItemType } =
    {};

const arrows: KeyboardType[] = [...allArrows, 'PageUp', 'PageDown', ' '];
const eventMaps: EventMapperType[] = arrows.map((key) => {
    return { key };
});
eventMaps.push({
    allControlKey: ['Shift'],
    key: ' ',
});
function useAppDocumentItems() {
    const selectedAppDocument = useVaryAppDocumentContext();
    const [varyAppDocumentItems, setVaryAppDocumentItems] = useAppStateAsync<
        VaryAppDocumentItemType[]
    >(() => {
        return selectedAppDocument.getSlides();
    }, [selectedAppDocument]);

    useAppEffectAsync(
        async (context) => {
            if (varyAppDocumentItems === undefined) {
                const newVaryAppDocumentItems =
                    await selectedAppDocument.getSlides();
                context.setVaryAppDocumentItems(newVaryAppDocumentItems);
            }
        },
        [varyAppDocumentItems],
        { setVaryAppDocumentItems },
    );
    const refresh = async () => {
        const newVaryAppDocumentItems = await selectedAppDocument.getSlides();
        setVaryAppDocumentItems(newVaryAppDocumentItems);
    };

    useFileSourceEvents(['update'], refresh, [], selectedAppDocument.filePath);

    useKeyboardRegistering(
        eventMaps,
        (event) => {
            handleArrowing(event, varyAppDocumentItems ?? []);
        },
        [varyAppDocumentItems],
    );

    useAppEffect(() => {
        const varyAppDocumentItems = Object.values(varyAppDocumentItemsToView);
        if (varyAppDocumentItems.length === 0) {
            return;
        }
        for (const varyAppDocumentItem of varyAppDocumentItems) {
            showVaryAppDocumentItemInViewport(varyAppDocumentItem.id);
        }
        for (const key of Object.keys(varyAppDocumentItemsToView)) {
            delete varyAppDocumentItemsToView[key];
        }
    }, [varyAppDocumentItems]);
    const isPDFAppDocument = useMemo(() => {
        return PdfAppDocument.checkIsThisType(selectedAppDocument);
    }, [selectedAppDocument]);
    const refreshPDFImages = useCallback(async () => {
        if (!isPDFAppDocument) {
            return;
        }
        const pdfAppDocument = selectedAppDocument as PdfAppDocument;
        await removePdfImagesPreview(pdfAppDocument.filePath);
        pdfAppDocument.fileSource.fireUpdateEvent();
    }, [selectedAppDocument, isPDFAppDocument]);

    return {
        varyAppDocumentItems,
        startLoading: () => {
            setVaryAppDocumentItems(undefined);
        },
        isPDFAppDocument,
        refreshPDFImages,
    };
}

export default function AppDocumentItemsComp() {
    const [thumbSizeScale] = useAppDocumentItemThumbnailSizeScale({
        defaultSize: MIN_THUMBNAIL_SCALE + 10,
    });
    const {
        varyAppDocumentItems,
        startLoading,
        isPDFAppDocument,
        refreshPDFImages,
    } = useAppDocumentItems();
    const appDocumentItemThumbnailSize = useMemo(() => {
        return thumbSizeScale * DEFAULT_THUMBNAIL_SIZE_FACTOR;
    }, [thumbSizeScale]);
    const isAnyItemSelected = useAnyItemSelected(varyAppDocumentItems);
    const handleNext = useCallback(
        (data: { isNext: boolean }) => {
            const element = getContainerDiv();
            if (element === null || !varyAppDocumentItems) {
                return;
            }
            handleNextItemSelecting({
                container: element,
                varyAppDocumentItems,
                isNext: data.isNext,
            });
        },
        [varyAppDocumentItems],
    );
    if (varyAppDocumentItems === undefined) {
        return <LoadingComp />;
    }
    if (varyAppDocumentItems === null) {
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
    if (isPDFAppDocument && varyAppDocumentItems.length === 0) {
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
    return (
        <div className="d-flex flex-wrap justify-content-center pb-5">
            {varyAppDocumentItems.map((varyAppDocumentItem, i) => {
                return (
                    <VaryAppDocumentItemRenderWrapperComp
                        key={varyAppDocumentItem.id}
                        thumbSize={appDocumentItemThumbnailSize}
                        varyAppDocumentItem={varyAppDocumentItem}
                        index={i}
                    />
                );
            })}
            {varyAppDocumentItems.length > 2 ? (
                <FillingFlexCenterComp
                    width={appDocumentItemThumbnailSize}
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
