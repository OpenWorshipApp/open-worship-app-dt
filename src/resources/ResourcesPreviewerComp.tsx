import { useMemo, useState } from 'react';

import BibleItem from '../bible-list/BibleItem';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import ResourcesRendererComp from './ResourcesRendererComp';

// Long enough that arrowing through a chapter does not start a folder walk per
// verse, short enough to still feel live.
const VERSE_CHANGE_DEBOUNCE_MILLISECOND = 500;

/**
 * Files the user keeps on disk for the verse being looked at.
 *
 * Debounced HERE rather than in each folder box: the verse arrives through the
 * single `setResourcesVerseKey` slot, so one timer covers every box, and the
 * boxes below only ever see a settled bible item. Per instance all the same --
 * `genTabBody` mounts one tab today, but a module-level timer would collapse
 * every mounted previewer into one and leave all but the last showing a stale
 * verse, and nothing here should assume the current mount count.
 */
export default function ResourcesPreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const [bibleItem, setBibleItem] = useState<BibleItem | null>(null);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(VERSE_CHANGE_DEBOUNCE_MILLISECOND);
    }, []);
    useAppEffect(() => {
        const applyVerseKey = (bibleVerseKey: string) => {
            if (!bibleVerseKey) {
                return;
            }
            const extracted =
                bibleRenderHelper.fromBibleVerseKey(bibleVerseKey);
            setBibleItem(
                BibleItem.fromJson({
                    id: -1,
                    bibleKey: extracted.bibleKey,
                    target: {
                        bookKey: extracted.bookKey,
                        chapter: extracted.chapter,
                        // One verse: what is looked up on disk is
                        // `<book>.<chapter>.<verse>.*`, and a range has no
                        // single name to look up.
                        // TODO: support multiple verses
                        verseStart: extracted.verseStart,
                        verseEnd: extracted.verseStart,
                    },
                    metadata: {},
                }),
            );
        };
        viewController.setResourcesVerseKey = (bibleVerseKey: string) => {
            attemptTimeout(() => {
                applyVerseKey(bibleVerseKey);
            });
        };
        // Immediately on mount: opening the tab must not sit blank for the
        // debounce interval before showing the verse it already knows.
        applyVerseKey(viewController.selectedVerseKey);
        return () => {
            viewController.setResourcesVerseKey = (_: string) => {};
        };
    }, [viewController]);
    if (bibleItem === null) {
        return (
            <div>
                <h4>Wait...</h4>
                <p>Please select any bible verse.</p>
            </div>
        );
    }
    return (
        <ResourcesRendererComp
            bibleItem={bibleItem}
            setBibleItem={setBibleItem}
        />
    );
}
