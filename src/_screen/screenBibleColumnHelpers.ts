// Several Bibles side by side on one screen, Line Sync off. They used to be
// the cells of ONE table in ONE scroller, so a translation that runs shorter
// had already ended while the one beside it was still verses away: the two
// columns showed different verses. Each Bible is its own scroller now, and
// they keep the same reading point the way the grouped Bible views of the
// Reader do (`BibleGroupScrollSync`): scroll one and the others follow.
//
// Imports leaves only -- the markup, the stylesheet, the renderer and the
// manager all read from here.

import { BibleGroupScrollSync } from '../bible-reader/bibleGroupScrollHelpers';
import { checkIsSubPixelScrolling } from '../scrolling/subPixelScrollHelpers';
import type { ScrollPercentageType } from './managers/screenScrollSyncHelpers';
import {
    getScrollSyncState,
    registerScrollingSyncEvent,
} from './managers/screenScrollSyncHelpers';

// The one box of a screen whose Bibles scroll together: a single Bible, or
// Line Sync.
export const SCREEN_BIBLE_SCROLL_CLASSNAME = 'screen-bible-container-scroll';
export const SCREEN_BIBLE_COLUMNS_CLASSNAME = 'screen-bible-columns';
export const SCREEN_BIBLE_COLUMN_CLASSNAME = 'screen-bible-column';
const VERSE_SELECTOR = '.highlight[data-kjv-verse-key]';
const SYNC_GROUP = 'screen';

// A scroll message names its scroller by selector, and every window finds
// its own copy by it. The viewer feedback of a virtual display lets these
// through by the same shape (`electron/virtualDisplayProtocol.ts`).
export function toScreenBibleColumnClassName(index: number) {
    return `${SCREEN_BIBLE_COLUMN_CLASSNAME}-${index}`;
}

export function toScreenBibleScrollSelector(scroller: HTMLElement) {
    const index = scroller.dataset.columnIndex;
    return index === undefined
        ? `.${SCREEN_BIBLE_SCROLL_CLASSNAME}`
        : `.${toScreenBibleColumnClassName(Number(index))}`;
}

/** The columns of freshly rendered Bible markup; none when it is one table. */
export function getScreenBibleColumns(rendered: HTMLElement) {
    if (!rendered.classList.contains(SCREEN_BIBLE_COLUMNS_CLASSNAME)) {
        return [];
    }
    return Array.from(rendered.children).filter(
        (child): child is HTMLDivElement => {
            return child.classList.contains(SCREEN_BIBLE_COLUMN_CLASSNAME);
        },
    );
}

type ScreenBibleColumnsType = {
    columns: HTMLDivElement[];
    // The column the screen's ONE of everything belongs to: the scroll
    // position it remembers, its auto-scroll and its "to the top".
    host: HTMLDivElement;
    release: () => void;
};

// Weak, keyed by the screen's Bible div: the columns are rebuilt on every
// render and dropped with the card that drew them.
const columnsMap = new WeakMap<HTMLElement, ScreenBibleColumnsType>();
const syncMap = new WeakMap<HTMLElement, BibleGroupScrollSync>();

function getSync(div: HTMLElement) {
    let sync = syncMap.get(div);
    if (sync === undefined) {
        sync = new BibleGroupScrollSync({
            verseSelector: VERSE_SELECTOR,
            // A mini preview is the projector's layout inside a
            // `transform: scale(...)`. The div is laid out a whole number of
            // px wide, so its two widths give the scale exactly.
            getScale: () => {
                const width = div.offsetWidth;
                return width > 0
                    ? div.getBoundingClientRect().width / width
                    : 1;
            },
        });
        syncMap.set(div, sync);
    }
    return sync;
}

// The longest one: it can still scroll when the others cannot, so its
// auto-scroll button is there whenever anything is left to read.
function pickHost(columns: HTMLDivElement[]) {
    let host = columns[0];
    let hostRange = host.scrollHeight - host.clientHeight;
    for (const column of columns) {
        const range = column.scrollHeight - column.clientHeight;
        if (range > hostRange) {
            host = column;
            hostRange = range;
        }
    }
    return host;
}

const COLUMN_NAME_PATTERN = new RegExp(
    `^${SCREEN_BIBLE_COLUMN_CLASSNAME}-\\d+$`,
);

// Two windows showing one passage are not always laid out alike: Line Sync is
// a setting of each screen, so the members of a colour group differ, and an
// open screen page keeps the layout it was shown with. A scroll message names
// its scroller, so whatever scrolls here answers to every name the OTHER
// layout would send -- the host column to the one box's, and the one box to
// each column's. Without that, a scroll from one layout moved nothing in a
// window drawn the other way.
function nameScrollers(
    div: HTMLElement,
    host: HTMLElement | null,
    bibleCount: number,
) {
    for (const name of Array.from(div.classList)) {
        if (COLUMN_NAME_PATTERN.test(name)) {
            div.classList.remove(name);
        }
    }
    div.classList.toggle(SCREEN_BIBLE_SCROLL_CLASSNAME, host === null);
    if (host !== null) {
        host.classList.add(SCREEN_BIBLE_SCROLL_CLASSNAME);
        return;
    }
    // One Bible is drawn the same way everywhere: nobody sends a column's.
    for (let i = 0; bibleCount > 1 && i < bibleCount; i++) {
        div.classList.add(toScreenBibleColumnClassName(i));
    }
}

/**
 * Takes over the columns just put into `div` (none: back to one scroller) and
 * answers the element the screen's scroll position belongs to -- the host
 * column, or `div` itself. `bibleCount` is how many Bibles the passage is
 * shown in, however they are laid out.
 */
export function wireScreenBibleColumns(
    div: HTMLDivElement,
    columns: HTMLDivElement[],
    sendScroll: (
        domSelector: string,
        scroll: ScrollPercentageType,
        isFromWheel: boolean,
    ) => void,
    bibleCount = 0,
) {
    columnsMap.get(div)?.release();
    columnsMap.delete(div);
    if (columns.length < 2) {
        nameScrollers(div, null, bibleCount);
        return div;
    }
    const sync = getSync(div);
    const releases = columns.map((column) => {
        const domSelector = toScreenBibleScrollSelector(column);
        registerScrollingSyncEvent(column, (scroll, isFromWheel) => {
            // The leader alone speaks for the screen. A follower's scroll
            // events are this coordinator's own writes, and sent out they
            // would each name a new leader in the other window.
            if (sync.checkIsLeading(column)) {
                sendScroll(domSelector, scroll, isFromWheel);
            }
        });
        // The other window scrolled this column: it leads here too.
        getScrollSyncState(column).onRemoteScroll = () => {
            sync.followFrom(column);
        };
        return sync.register(column, SYNC_GROUP);
    });
    const host = pickHost(columns);
    // Its pinned buttons sit over the other columns, which come later in the
    // DOM and would otherwise be drawn -- and clicked -- on top of them.
    host.style.zIndex = '1';
    nameScrollers(div, host, columns.length);
    columnsMap.set(div, {
        columns,
        host,
        release: () => {
            for (const release of releases) {
                release();
            }
        },
    });
    return host;
}

export function getScreenBibleScroller(div: HTMLDivElement) {
    return columnsMap.get(div)?.host ?? div;
}

/** How far down the screen has been scrolled, whichever column went furthest. */
export function getScreenBibleScrollTop(div: HTMLElement) {
    const state = columnsMap.get(div);
    if (state === undefined) {
        return div.scrollTop;
    }
    let scrollTop = 0;
    for (const column of state.columns) {
        scrollTop = Math.max(scrollTop, column.scrollTop);
    }
    return scrollTop;
}

/** Fresh columns, put where the host is at once: nothing to glide out of. */
export function alignScreenBibleColumns(div: HTMLElement) {
    const state = columnsMap.get(div);
    if (state !== undefined) {
        getSync(div).alignTo(state.host);
    }
}

/**
 * One frame of the host's auto-scroll. It takes the lead back on every one:
 * the scroll that keeps running is the one the others have to stay with.
 */
export function followScreenBibleHost(div: HTMLElement) {
    const state = columnsMap.get(div);
    if (state !== undefined) {
        getSync(div).followFrom(state.host);
    }
}

/**
 * While the host slides by itself -- its own auto-scroll, or the mini
 * preview's arriving frame by frame -- it leads on every frame, so a wheel
 * on another column would tug that column away only for it to be pulled
 * straight back. The wheel is given to the host instead, as if it had been
 * turned over it: the auto-scroll carries on from where it lands.
 */
export function steerScreenBibleAutoScroll(
    div: HTMLElement,
    event: WheelEvent,
) {
    const state = columnsMap.get(div);
    if (
        state === undefined ||
        event.deltaMode !== 0 ||
        !checkIsSubPixelScrolling(state.host)
    ) {
        return;
    }
    const { host } = state;
    const { target } = event;
    if (!(target instanceof Node) || host.contains(target)) {
        return;
    }
    event.preventDefault();
    const hostState = getScrollSyncState(host);
    hostState.wheelAt = hostState.inputAt = performance.now();
    host.scrollTop += event.deltaY;
}
