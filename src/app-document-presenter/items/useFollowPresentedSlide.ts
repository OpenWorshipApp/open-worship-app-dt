import { useRef } from 'react';

import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import { useVarySlideOnScreenChangeEffect } from '../../_screen/managers/varySlideOnScreenHelpers';
import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
import { useAppEffect } from '../../helper/appHooks';
import appProvider from '../../server/appProvider';
import { revealVirtualItem } from '../../virtual-list/virtualRevealHelpers';
import type { VarySlideGridItemType } from './varySlideGridHelpers';

/** Follow selection even when the selected card has no mounted DOM yet. */
export function useFollowPresentedSlide(
    filePath: string,
    gridItems: VarySlideGridItemType[],
) {
    const previousSlidesRef = useRef(new Map<string, number>());
    const revealSelectedSlide = () => {
        if (appProvider.isPageAppDocumentEditor || gridItems.length === 0) {
            return;
        }
        // Read once per previewer, not once per slide. The live managers also
        // cover rapid steps while the persisted on-screen map is still saving.
        const onScreen =
            ScreenVaryAppDocumentManager.getPresentingDataList(filePath);
        const changed = onScreen.find(([screenId, data]) => {
            return previousSlidesRef.current.get(screenId) !== data.itemJson.id;
        });
        previousSlidesRef.current = new Map(
            onScreen.map(([screenId, data]) => [screenId, data.itemJson.id]),
        );
        if (changed !== undefined) {
            revealVirtualItem(
                toKeyByFilePath(filePath, changed[1].itemJson.id),
                'smooth',
            );
        }
    };
    // This subscription does not re-render the slide list. Unchanged screen
    // updates must also leave an operator's manual scroll position alone.
    useVarySlideOnScreenChangeEffect(revealSelectedSlide);
    useAppEffect(() => {
        previousSlidesRef.current.clear();
        revealSelectedSlide();
    }, [filePath, gridItems]);
}
