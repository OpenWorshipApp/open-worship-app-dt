import { use, useMemo, useState } from 'react';

import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { useBibleItemViewControllerUpdateEvent } from '../bible-reader/BibleItemsViewController';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { useAppEffect } from '../helper/appHooks';
import { getVerses } from '../helper/bible-helpers/bibleInfoHelpers';
import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import RenderLookupRecordItemComp from '../location-name-lookup/RenderLookupRecordItemComp';
import type { VerseRecordType } from '../location-name-lookup/verseRecordListHelpers';
import {
    collectVerseRecords,
    toVerseListLabel,
    useLookupRecordLabels,
} from '../location-name-lookup/verseRecordListHelpers';
import { useLookupTextIndex } from '../location-name-lookup/verseTextIndexHelpers';
import LoadingComp from '../others/LoadingComp';

/**
 * Every biblical name and location the dataset attests in the verses currently
 * open in the reader — one section per open bible item.
 *
 * The answer comes from the slim index's verse evidence and its labels sidecar —
 * already-resident integer maps — unioned with the in-text scan that draws the
 * underlines in the reader, which needs the KJV wording of the chapter. That is
 * ONE cached chapter read per pane, never one per verse: targets are KJV-numbered
 * in this app's model, so turning a range into verse keys is pure arithmetic.
 *
 * The ~35MB lookup dataset is touched only if the user clicks a row, which opens
 * the existing floating detail panel.
 */

// Long enough that holding a key down in the lookup input does not rebuild the
// list per character, short enough to still feel live.
const RECOMPUTE_DEBOUNCE_MILLISECOND = 300;

type BibleItemGroupType = {
    key: string;
    title: string;
    chapter: number;
    names: VerseRecordType[];
    locations: VerseRecordType[];
};

function RenderRecordListComp({
    kind,
    label,
    chapter,
    recordList,
}: Readonly<{
    kind: 'name' | 'location';
    label: string;
    chapter: number;
    recordList: VerseRecordType[];
}>) {
    if (recordList.length === 0) {
        return null;
    }
    return (
        <>
            <div className="px-2 pt-1 small text-secondary fw-semibold">
                {`${tran(label)} (${recordList.length})`}
            </div>
            <ul className="list-group list-group-flush">
                {recordList.map((record) => {
                    return (
                        <RenderLookupRecordItemComp
                            key={record.recordId}
                            kind={kind}
                            record={{
                                id: record.recordId,
                                name: record.label,
                                title: record.title,
                                iconClass: record.iconClass,
                            }}
                            extraLabel={toVerseListLabel(
                                chapter,
                                record.verseList,
                            )}
                        />
                    );
                })}
            </ul>
        </>
    );
}

function RenderGroupComp({ group }: Readonly<{ group: BibleItemGroupType }>) {
    const isEmpty = group.names.length === 0 && group.locations.length === 0;
    return (
        <div className="border-bottom pb-1">
            <div className="alert alert-info m-0 px-2 py-1 rounded-0">
                {group.title}
            </div>
            {isEmpty ? (
                <div className="px-2 py-1 small text-secondary">
                    {tran('No matches')}
                </div>
            ) : (
                <>
                    <RenderRecordListComp
                        kind="name"
                        label="Names"
                        chapter={group.chapter}
                        recordList={group.names}
                    />
                    <RenderRecordListComp
                        kind="location"
                        label="Locations"
                        chapter={group.chapter}
                        recordList={group.locations}
                    />
                </>
            )}
        </div>
    );
}

export default function BibleLocationNamePreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    // Re-renders when a pane is opened, closed or retargeted. The returned value
    // is only a change signal here — the items are read off the controller so
    // the editing one can be swapped for what the input resolves to.
    const nestedBibleItems = useBibleItemViewControllerUpdateEvent();
    const index = useLookupTextIndex();
    const recordLabels = useLookupRecordLabels();
    const [groupList, setGroupList] = useState<BibleItemGroupType[] | null>(
        null,
    );
    // Per instance: a module-level timer would collapse every mounted previewer
    // into one and leave all but the last showing a stale list.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(RECOMPUTE_DEBOUNCE_MILLISECOND);
    }, []);

    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    useAppEffect(() => {
        if (index === null || recordLabels === null) {
            return;
        }
        let isCancelled = false;
        const isImmediate = groupList === null;
        attemptTimeout(async () => {
            const bibleItemList =
                viewController.resolveStraightBibleItems(foundBibleItem);
            const newGroupList: BibleItemGroupType[] = [];
            for (const bibleItem of bibleItemList) {
                const { bibleKey, target } = bibleItem;
                // The KJV wording, whatever bible this pane shows: the dataset
                // was extracted from the KJV, and targets carry KJV numbering.
                // One cached chapter read per pane, not one per verse.
                const kjvVerseMap = await getVerses(
                    BIBLE_KJV_KEY,
                    target.bookKey,
                    target.chapter,
                );
                if (isCancelled) {
                    return;
                }
                const { names, locations } = collectVerseRecords(
                    index,
                    recordLabels,
                    target,
                    kjvVerseMap,
                );
                const title = await bibleRenderHelper.toTitle('KJV', target);
                newGroupList.push({
                    key: `${bibleItem.id}-${bibleKey}`,
                    // `(NIV) LUK 3:1-3`. The synchronous formatter on purpose:
                    // `toTitle` would read the bible's book names off disk for a
                    // header that only names the passage.
                    title,
                    chapter: target.chapter,
                    names,
                    locations,
                });
            }
            setGroupList(newGroupList);
        }, isImmediate);
        return () => {
            isCancelled = true;
        };
    }, [index, recordLabels, foundBibleItem, nestedBibleItems]);

    if (index === null || recordLabels === null || groupList === null) {
        return <LoadingComp message={tran('Loading lookup data')} />;
    }
    return (
        <div
            className="location-name-lookup w-100 h-100 d-flex flex-column"
            // Tracks the bible text zoom, like the floating lookup panel.
        >
            <div className="px-2 py-1 small text-secondary border-bottom">
                <i className="bi bi-geo-alt-fill" />
                {` ${tran('Names and locations in your reading')}`}
                {` (${BIBLE_KJV_KEY})`}
            </div>
            <div className="flex-fill overflow-y-auto">
                {groupList.map((group) => {
                    return <RenderGroupComp key={group.key} group={group} />;
                })}
            </div>
        </div>
    );
}
