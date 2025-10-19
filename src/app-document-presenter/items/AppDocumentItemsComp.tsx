import {
    allArrows,
    KeyboardType,
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
import {
    VaryAppDocumentItemType,
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
} from '../../app-document-list/appDocumentTypeHelpers';

const varyAppDocumentItemsToView: { [key: string]: VaryAppDocumentItemType } =
    {};

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

    const arrows: KeyboardType[] = [...allArrows, 'PageUp', 'PageDown', ' '];
    useKeyboardRegistering(
        arrows.map((key) => {
            return { key };
        }),
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

    return {
        varyAppDocumentItems,
        startLoading: () => {
            setVaryAppDocumentItems(undefined);
        },
    };
}

export default function AppDocumentItemsComp() {
    const [thumbSizeScale] = useAppDocumentItemThumbnailSizeScale();
    const { varyAppDocumentItems, startLoading } = useAppDocumentItems();
    const appDocumentItemThumbnailSize =
        thumbSizeScale * DEFAULT_THUMBNAIL_SIZE_FACTOR;
    const isAnyItemSelected = useAnyItemSelected(varyAppDocumentItems);
    if (varyAppDocumentItems === undefined) {
        return <LoadingComp />;
    }
    if (varyAppDocumentItems === null) {
        return (
            <div className="d-flex justify-content-center">
                <p className="alert alert-warning">Fail to load slides</p>
                <button onClick={startLoading} className="btn btn-primary">
                    Reload
                </button>
            </div>
        );
    }
    return (
        <div className="d-flex flex-wrap p-1">
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
            {isAnyItemSelected ? (
                <SlideAutoPlayComp
                    prefix="vary-app-document"
                    style={{
                        bottom: '40px',
                    }}
                    onNext={(data) => {
                        const element = getContainerDiv();
                        if (element === null) {
                            return;
                        }
                        handleNextItemSelecting({
                            container: element,
                            varyAppDocumentItems,
                            isNext: data.isNext,
                        });
                    }}
                />
            ) : null}
        </div>
    );
}
