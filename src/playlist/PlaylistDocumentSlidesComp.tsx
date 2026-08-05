import { useCallback } from 'react';

import { showDroppedDataOnScreens } from '../_screen/managers/screenDroppedHelpers';
import { checkIsVarySlideOnScreen } from '../app-document-list/appDocumentHelpers';
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { useAppCurrentRef, useAppStateAsync } from '../helper/appHooks';
import { handleDragStart } from '../helper/dragHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import {
    genRevealOriginal,
    genShowOnScreensContextMenu,
} from '../others/FileItemHandlerComp';
import LoadingComp from '../others/LoadingComp';
import { loadVaryAppDocumentSlides } from './playlistDocumentHelpers';
import { toDragTypeIconName } from './playlistHelpers';
import {
    refreshOnScreenAfterPresenting,
    useIsOnScreenChecking,
} from './playlistOnScreenHelpers';
import PlaylistRowComp from './PlaylistRowComp';
import { notifyVarySlideOrigin } from './playlistOriginHelpers';

export function PlaylistVarySlideRowComp({
    varySlide,
    index,
    depth,
}: Readonly<{
    varySlide: VarySlideType;
    index: number;
    depth: number;
}>) {
    const varySlideRef = useAppCurrentRef(varySlide);
    const handleClicking = useCallback(async (event: any) => {
        // See PlaylistItemComp.handleClicking — keeps the click out of the
        // enclosing FileItemHandlerComp's unscoped `select` broadcast.
        event.stopPropagation();
        const currentVarySlide = varySlideRef.current;
        // The screen comes first and nothing may be interleaved before it: the
        // slide is already resolved here, so the click reaches the screen
        // manager without a single further read.
        await showDroppedDataOnScreens(event, {
            type: currentVarySlide.dragType,
            item: currentVarySlide,
        });
        refreshOnScreenAfterPresenting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A slide held here is already resolved, so it rides the normal synchronous
    // drag path — dropping it on a screen, or back into a playlist, just works.
    const handleDraggingStart = useCallback((event: any) => {
        handleDragStart(event, varySlideRef.current);
        event.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.stopPropagation();
        const currentVarySlide = varySlideRef.current;
        showAppContextMenu(event, [
            genRevealOriginal(() => {
                notifyVarySlideOrigin(varySlideRef.current);
            }),
            ...genShowOnScreensContextMenu((event) => {
                showDroppedDataOnScreens(
                    event,
                    {
                        type: currentVarySlide.dragType,
                        item: currentVarySlide,
                    },
                    true,
                );
            }),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isOnScreen = useIsOnScreenChecking(() => {
        return checkIsVarySlideOnScreen(varySlideRef.current);
    }, `${varySlide.filePath}-${varySlide.id}`);
    return (
        <PlaylistRowComp
            depth={depth}
            idLabel={`#${varySlide.id}`}
            iconName={toDragTypeIconName(varySlide.dragType)}
            label={varySlide.name || `${tran('Slide')} ${index + 1}`}
            onClick={handleClicking}
            onDragStart={handleDraggingStart}
            onContextMenu={handleContextMenuOpening}
            isOnScreen={isOnScreen}
        />
    );
}

export default function PlaylistDocumentSlidesComp({
    filePath,
    depth,
}: Readonly<{
    filePath: string;
    depth: number;
}>) {
    // Loaded on expand and dropped again on collapse (this component unmounts),
    // so a long playlist never holds every document's slides at once.
    const [varySlides] = useAppStateAsync(() => {
        return loadVaryAppDocumentSlides(filePath);
    }, [filePath]);
    if (varySlides === undefined) {
        return <LoadingComp />;
    }
    if (varySlides === null) {
        return (
            <PlaylistRowComp
                depth={depth}
                iconName="exclamation-triangle"
                label={tran('Fail to read file data')}
                extraClassName="app-playlist-row-error"
            />
        );
    }
    if (varySlides.length === 0) {
        return (
            <PlaylistRowComp
                depth={depth}
                iconName="dash"
                label={tran('No slides')}
            />
        );
    }
    return (
        <>
            {varySlides.map((varySlide, i) => {
                return (
                    <PlaylistVarySlideRowComp
                        key={`${varySlide.filePath}-${varySlide.id}`}
                        varySlide={varySlide}
                        index={i}
                        depth={depth}
                    />
                );
            })}
        </>
    );
}
