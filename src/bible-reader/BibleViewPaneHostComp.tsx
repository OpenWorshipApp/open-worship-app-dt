import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { NestedBibleItemsType } from './BibleItemsViewController';
import {
    toStraightItems,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import {
    BibleViewPaneHostContext,
    BibleViewPaneStore,
    type BibleViewPaneHostType,
} from './bibleViewPaneHelpers';
import { useAppEffect } from '../helper/appHooks';

function toNextSlottedIdSet(
    slottedIdSet: ReadonlySet<number>,
    id: number,
    isSlotted: boolean,
) {
    if (slottedIdSet.has(id) === isSlotted) {
        return slottedIdSet;
    }
    const nextSlottedIdSet = new Set(slottedIdSet);
    if (isSlotted) {
        nextSlottedIdSet.add(id);
    } else {
        nextSlottedIdSet.delete(id);
    }
    return nextSlottedIdSet;
}

/**
 * Renders every bible view ONCE, keyed by its item's id, beside the split
 * layout in `children`; the layout holds `BibleViewPaneSlotComp`s that move
 * each view's element into place (see `bibleViewPaneHelpers`). A view whose
 * slot moved -- the layout around it collapsed, split or dropped its resize
 * container -- keeps its state, its verses and its scroll.
 *
 * A view is drawn only while a slot holds it. A slot that leaves and one that
 * takes the same view over land in the same commit, so the set they update
 * never loses the id in between and the view is never unmounted for it.
 */
export default function BibleViewPaneHostComp({
    nestedBibleItems,
    children,
}: Readonly<{
    nestedBibleItems: NestedBibleItemsType;
    children: ReactNode;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const [store] = useState(() => {
        return new BibleViewPaneStore();
    });
    const [slottedIdSet, setSlottedIdSet] = useState<ReadonlySet<number>>(
        () => {
            return new Set();
        },
    );
    const host = useMemo<BibleViewPaneHostType>(() => {
        return {
            store,
            attach: (id, slot) => {
                store.attach(id, slot);
                setSlottedIdSet((oldSlottedIdSet) => {
                    return toNextSlottedIdSet(oldSlottedIdSet, id, true);
                });
                return () => {
                    store.detach(id, slot);
                    setSlottedIdSet((oldSlottedIdSet) => {
                        return toNextSlottedIdSet(oldSlottedIdSet, id, false);
                    });
                };
            },
        };
    }, [store]);
    useAppEffect(() => {
        store.sweep();
    }, [slottedIdSet]);
    const paneList = toStraightItems(nestedBibleItems)
        .filter((bibleItem) => {
            return slottedIdSet.has(bibleItem.id);
        })
        .map((bibleItem) => {
            return createPortal(
                viewController.finalRenderer(bibleItem),
                store.getElement(bibleItem.id),
                `${bibleItem.id}`,
            );
        });
    return (
        <BibleViewPaneHostContext value={host}>
            {children}
            {paneList}
        </BibleViewPaneHostContext>
    );
}
