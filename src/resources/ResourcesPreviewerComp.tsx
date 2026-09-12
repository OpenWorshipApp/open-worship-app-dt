import { use, useMemo, useState } from 'react';

import { useBibleItemViewControllerUpdateEvent } from '../bible-reader/BibleItemsViewController';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import LoadingComp from '../others/LoadingComp';
import ResourcesRendererComp from './ResourcesRendererComp';
import {
    fromResourceTargetsKey,
    toResourceTargetsKey,
} from './resourcesScanHelpers';

// Long enough that typing a reference does not start a folder walk per
// character, short enough to still feel live.
const READING_CHANGE_DEBOUNCE_MILLISECOND = 500;

/**
 * Files the user keeps on disk for what they are READING: every pane open in
 * the reader, by book and chapter, not one verse they clicked. It used to
 * follow the selected verse through a `setResourcesVerseKey` slot; now it
 * follows the panes the way the names-and-locations view does, so three panes
 * on Genesis 24, 27 and 29 list the files of all three, and the pane being
 * typed in is read from what its reference box resolves to.
 *
 * What is kept is the target list as ONE STRING (`toResourceTargetsKey`), so
 * an update event that changed nothing about the reading -- a verse click, a
 * color note -- sets the same value and re-scans nothing. Debounced per
 * instance: a module-level timer would collapse every mounted previewer into
 * one and leave all but the last showing a stale reading.
 */
export default function ResourcesPreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    // Re-renders when a pane is opened, closed or retargeted; the items are
    // read off the controller so the editing one can be swapped for what the
    // input resolves to.
    const nestedBibleItems = useBibleItemViewControllerUpdateEvent();
    const [targetsKey, setTargetsKey] = useState<string | null>(null);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(READING_CHANGE_DEBOUNCE_MILLISECOND);
    }, []);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    useAppEffect(() => {
        // Immediately on mount: opening the tab must not sit blank for the
        // debounce interval before showing the reading it already knows.
        const isImmediate = targetsKey === null;
        attemptTimeout(() => {
            const bibleItemList =
                viewController.resolveStraightBibleItems(foundBibleItem);
            setTargetsKey(
                toResourceTargetsKey(
                    bibleItemList.map(({ target }) => {
                        return {
                            bookKey: target.bookKey,
                            chapter: target.chapter,
                        };
                    }),
                ),
            );
        }, isImmediate);
    }, [viewController, foundBibleItem, nestedBibleItems]);
    // One array per KEY, so the boxes below can depend on it by identity and
    // still re-scan only when the reading actually changed.
    const targets = useMemo(() => {
        return fromResourceTargetsKey(targetsKey ?? '');
    }, [targetsKey]);
    if (targetsKey === null) {
        return <LoadingComp />;
    }
    return <ResourcesRendererComp targets={targets} />;
}
