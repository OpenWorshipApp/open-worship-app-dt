import { createContext, use } from 'react';

import type { NestedBibleItemsType } from './BibleItemsViewController';

/**
 * Bible views live in elements of their own, keyed by the bible item's id,
 * and the split layout only says WHERE each one goes.
 *
 * React keeps a component only while it stays at the same position under the
 * same parents, and the split layout cannot hold still: closing a view
 * collapses the split around the survivors (`sanitizeNestedItems`), a lone
 * view drops the resize container altogether, and a split moves a view one
 * level down. Each of those used to throw the surviving views away and build
 * them again -- verses re-read, scroll back at the top -- which is the
 * "reload" a volunteer saw on every close and split. React has no way to move
 * a mounted subtree (the reparenting RFC has been open since 2018), so a view
 * is portaled once into its own element, beside the layout, and a slot in the
 * layout moves that ELEMENT into place. Only the slot is rebuilt.
 *
 * Moving an element out of the document drops its scroll offsets and its
 * focus, so both are read just before it leaves (a slot's layout cleanup runs
 * before React removes the slot's DOM) and given back as it lands.
 *
 * Memory: one element per view on screen. An element whose slot is gone and
 * did not come back in the same commit is released by `sweep`, so the map
 * never outgrows the views showing, and a view no slot shows is unmounted.
 */

type ScrollOffsetType = [element: Element, top: number, left: number];
type PaneRecordType = {
    element: HTMLDivElement;
    slot: HTMLElement | null;
    scrollOffsetList: ScrollOffsetType[];
    focusedElement: HTMLElement | null;
};

export const BIBLE_VIEW_PANE_CLASS = 'bible-view-pane';

function genPaneElement() {
    const element = document.createElement('div');
    element.className = BIBLE_VIEW_PANE_CLASS;
    // No box of its own: the view lays out against the slot's parent exactly
    // as it did when it was that parent's child.
    element.style.display = 'contents';
    return element;
}

// Only on a move, never at rest: a move is a close or a split.
function readScrollOffsetList(element: HTMLElement) {
    const scrollOffsetList: ScrollOffsetType[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node !== null) {
        if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
            scrollOffsetList.push([node, node.scrollTop, node.scrollLeft]);
        }
        node = walker.nextNode() as Element | null;
    }
    return scrollOffsetList;
}

export class BibleViewPaneStore {
    private readonly recordMap = new Map<number, PaneRecordType>();

    private getRecord(id: number) {
        let record = this.recordMap.get(id);
        if (record === undefined) {
            record = {
                element: genPaneElement(),
                slot: null,
                scrollOffsetList: [],
                focusedElement: null,
            };
            this.recordMap.set(id, record);
        }
        return record;
    }

    get size() {
        return this.recordMap.size;
    }

    getElement(id: number) {
        return this.getRecord(id).element;
    }

    attach(id: number, slot: HTMLElement) {
        const record = this.getRecord(id);
        record.slot = slot;
        if (record.element.parentElement !== slot) {
            slot.appendChild(record.element);
        }
        const { scrollOffsetList, focusedElement } = record;
        record.scrollOffsetList = [];
        record.focusedElement = null;
        for (const [node, top, left] of scrollOffsetList) {
            if (record.element.contains(node)) {
                node.scrollTop = top;
                node.scrollLeft = left;
            }
        }
        if (
            focusedElement !== null &&
            record.element.contains(focusedElement)
        ) {
            focusedElement.focus({ preventScroll: true });
        }
    }

    detach(id: number, slot: HTMLElement) {
        const record = this.recordMap.get(id);
        // A slot that no longer holds this view -- another took it over in
        // the same commit -- has nothing left to give back.
        if (record === undefined || record.slot !== slot) {
            return;
        }
        record.slot = null;
        if (record.element.isConnected) {
            record.scrollOffsetList = readScrollOffsetList(record.element);
            const activeElement = document.activeElement;
            record.focusedElement =
                activeElement instanceof HTMLElement &&
                record.element.contains(activeElement)
                    ? activeElement
                    : null;
        }
        record.element.remove();
    }

    // Releases every element no slot holds. Never one a slot attached in the
    // commit being swept, whatever that commit's render said.
    sweep() {
        for (const [id, record] of this.recordMap) {
            if (record.slot === null) {
                record.element.remove();
                this.recordMap.delete(id);
            }
        }
    }
}

/**
 * Keys for the panes of one split, held from one render to the next.
 *
 * A pane is a SLOT in the split -- the resize container keeps its size under
 * its key -- and what fills the slot changes: a split turns a view into a
 * group holding it, a close turns a group back into the view left in it. By
 * position, closing the first view handed every later slot the wrong size;
 * by the first view's id, splitting a group's first view renamed the group
 * and reset its sizes. So a child takes the key of the slot it held last
 * time -- the slot that held any of the views it holds now -- and only a
 * child holding no view from before gets a new one.
 *
 * Memory: one entry per pane of the split, replaced every render.
 */
export type PaneKeyMemoryType = ReadonlyMap<string, readonly number[]>;

export function toPaneLeafIdList(
    nestedBibleItems: NestedBibleItemsType,
): number[] {
    if (!Array.isArray(nestedBibleItems)) {
        return [nestedBibleItems.id];
    }
    return nestedBibleItems.flatMap(toPaneLeafIdList);
}

export function assignPaneKeys(
    childList: NestedBibleItemsType[],
    memory: PaneKeyMemoryType,
): string[] {
    const usedKeySet = new Set<string>();
    return childList.map((child, index) => {
        const leafIdList = toPaneLeafIdList(child);
        for (const [key, oldLeafIdList] of memory) {
            if (
                !usedKeySet.has(key) &&
                oldLeafIdList.some((id) => {
                    return leafIdList.includes(id);
                })
            ) {
                usedKeySet.add(key);
                return key;
            }
        }
        let key: string;
        if (leafIdList.length === 0) {
            key = `g-${index}`;
        } else {
            key = `${Array.isArray(child) ? 'g' : 'i'}${leafIdList[0]}`;
        }
        // A slot handed to another child can carry the name this one would
        // have taken.
        while (usedKeySet.has(key)) {
            key = `${key}-${index}`;
        }
        usedKeySet.add(key);
        return key;
    });
}

export function toPaneKeyMemory(
    childList: NestedBibleItemsType[],
    keyList: string[],
): PaneKeyMemoryType {
    return new Map(
        keyList.map((key, i) => {
            return [key, toPaneLeafIdList(childList[i])];
        }),
    );
}

export type BibleViewPaneHostType = {
    store: BibleViewPaneStore;
    // Puts the view's element in `slot`; the returned function takes it out.
    attach: (id: number, slot: HTMLElement) => () => void;
};

export const BibleViewPaneHostContext =
    createContext<BibleViewPaneHostType | null>(null);

export function useBibleViewPaneHostContext() {
    return use(BibleViewPaneHostContext);
}
