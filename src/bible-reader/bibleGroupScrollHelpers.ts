import {
    PLAY_TO_BOTTOM_CLASSNAME,
    checkIsSubPixelScrolling,
    getSubPixelScrollTop,
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from '../scrolling/subPixelScrollHelpers';

const VERSE_SELECTOR = '.verse-text[data-kjv-verse-key]';
const VERSE_KEY_ATTRIBUTE = 'data-kjv-verse-key';
// A pane auto-scrolling on its own play-to-bottom is left to it: writing
// its offset as well would make the two fight frame by frame.
const PLAYING_SELECTOR = `.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""])`;
const SCROLL_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' ',
]);
// How fast a follower eases out of a gap (enabling sync, a new leading pane,
// a move made by something else). Exponential, so it never overshoots and
// needs no end time: ~95% of the gap is gone after 3 × this.
const GLIDE_MS = 70;
const FRAME_MS = 1000 / 60;

// Every length is in viewport px, as the verse rects are -- except
// `maxScroll`, which is a scroll offset.
type PaneBox = {
    top: number;
    left: number;
    width: number;
    height: number;
    contentTop: number;
    contentEnd: number;
    maxScroll: number;
};

export type BibleGroupScrollOptionsType = {
    // The element holding one verse, in reading order.
    verseSelector?: string;
    // Viewport px per px of scroll offset: 1, except for panes drawn inside a
    // `transform: scale(...)` -- a screen's mini preview scrolls a box laid
    // out at the projector's size. Asked once per frame, of the caller,
    // because a pane cannot measure its own exactly: `offsetHeight` is
    // rounded.
    getScale?: () => number;
};

/**
 * Where a pane sits in reading order. `before` runs from the top of the
 * scrolled content to the verse, `verse` from the verse's start to the next
 * verse's (or its own end), and `after` from there to the end of the content,
 * so the first and last lines of every pane line up too.
 */
export type ReadingPosition = {
    key: string;
    part: 'before' | 'verse' | 'after';
    fraction: number;
};

function measurePane(container: HTMLElement, scale = 1): PaneBox {
    const rect = container.getBoundingClientRect();
    const top = rect.top + container.clientTop * scale;
    const contentTop = top - getSubPixelScrollTop(container) * scale;
    return {
        top,
        left: rect.left + container.clientLeft * scale,
        width: container.clientWidth * scale,
        height: container.clientHeight * scale,
        contentTop,
        contentEnd: contentTop + container.scrollHeight * scale,
        maxScroll: Math.max(0, container.scrollHeight - container.clientHeight),
    };
}

function toFraction(value: number, from: number, to: number) {
    return to > from
        ? Math.min(Math.max((value - from) / (to - from), 0), 1)
        : 0;
}

/**
 * A point of the text flow as one y: its line's top plus how far along the
 * line it sits. Verses sharing a line then still start at increasing
 * positions, so the mapping cannot stall or run backward across that line.
 */
function toReadingY(rect: DOMRect, x: number, pane: PaneBox, isRtl: boolean) {
    const along = isRtl ? pane.left + pane.width - x : x - pane.left;
    return rect.top + rect.height * toFraction(along, 0, pane.width);
}

function getVerseStart(verse: HTMLElement, pane: PaneBox, isRtl: boolean) {
    const rect = verse.getClientRects()[0];
    if (!rect?.height) {
        return null;
    }
    return toReadingY(rect, isRtl ? rect.right : rect.left, pane, isRtl);
}

function getVerseEnd(verse: HTMLElement, pane: PaneBox, isRtl: boolean) {
    const rects = verse.getClientRects();
    const rect = rects[rects.length - 1];
    if (!rect?.height) {
        return null;
    }
    return toReadingY(rect, isRtl ? rect.left : rect.right, pane, isRtl);
}

/** Start of the next verse, or this one's end when it is the last. */
function getSpanEnd(
    verses: NodeListOf<HTMLElement>,
    index: number,
    pane: PaneBox,
    isRtl: boolean,
) {
    return index + 1 < verses.length
        ? getVerseStart(verses[index + 1], pane, isRtl)
        : getVerseEnd(verses[index], pane, isRtl);
}

function checkIsRtl(verses: NodeListOf<HTMLElement>) {
    return verses[0].closest('[dir="rtl"]') !== null;
}

/**
 * The reading position under viewport `y`. Reads only the mounted passage
 * and finds the verse by bisection, never measuring a whole chapter on a
 * scroll frame.
 */
export function readPosition(
    container: HTMLElement,
    y: number,
    pane = measurePane(container),
    verseSelector = VERSE_SELECTOR,
): ReadingPosition | null {
    const verses = container.querySelectorAll<HTMLElement>(verseSelector);
    if (!verses.length) {
        return null;
    }
    const isRtl = checkIsRtl(verses);
    let low = 0;
    let high = verses.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        const start = getVerseStart(verses[mid], pane, isRtl);
        if (start !== null && start <= y) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    const index = Math.max(0, low - 1);
    const key = verses[index].getAttribute(VERSE_KEY_ATTRIBUTE)!;
    const start = getVerseStart(verses[index], pane, isRtl);
    if (start === null) {
        return null;
    }
    if (y < start) {
        return {
            key,
            part: 'before',
            fraction: toFraction(y, pane.contentTop, start),
        };
    }
    const end = getSpanEnd(verses, index, pane, isRtl);
    if (end === null) {
        return null;
    }
    if (y >= end && index === verses.length - 1) {
        return {
            key,
            part: 'after',
            fraction: toFraction(y, end, pane.contentEnd),
        };
    }
    return { key, part: 'verse', fraction: toFraction(y, start, end) };
}

/** The viewport y of `position` in another pane, or null without its verse. */
export function locatePosition(
    container: HTMLElement,
    position: ReadingPosition,
    pane = measurePane(container),
    verseSelector = VERSE_SELECTOR,
) {
    const verses = container.querySelectorAll<HTMLElement>(verseSelector);
    let index = -1;
    for (let i = 0; i < verses.length; i++) {
        if (verses[i].getAttribute(VERSE_KEY_ATTRIBUTE) === position.key) {
            index = i;
            break;
        }
    }
    if (index === -1) {
        return null;
    }
    const isRtl = checkIsRtl(verses);
    let from: number | null = pane.contentTop;
    let to: number | null = pane.contentEnd;
    if (position.part === 'before') {
        to = getVerseStart(verses[index], pane, isRtl);
    } else if (position.part === 'verse') {
        from = getVerseStart(verses[index], pane, isRtl);
        to = getSpanEnd(verses, index, pane, isRtl);
    } else {
        from = getSpanEnd(verses, index, pane, isRtl);
    }
    if (from === null || to === null) {
        return null;
    }
    return from + (to - from) * position.fraction;
}

type Member = { group: string; top?: number; offset: number };

/**
 * One coordinator per preview controller, where only user input chooses a
 * leader, and one per screen showing several Bibles side by side
 * (`screenBibleColumnHelpers`), where a scroll sent from another window
 * chooses one too.
 */
export class BibleGroupScrollSync {
    private readonly members = new Map<HTMLElement, Member>();
    private source: HTMLElement | null = null;
    private frame: number | null = null;
    private lastFrameTime: number | null = null;
    private readonly verseSelector: string;
    private readonly getScale: (() => number) | null;

    constructor(options: BibleGroupScrollOptionsType = {}) {
        this.verseSelector = options.verseSelector ?? VERSE_SELECTOR;
        this.getScale = options.getScale ?? null;
    }

    syncFrom(container: HTMLElement) {
        this.lead(container);
        this.scheduleFollow();
    }

    /**
     * Follow a pane that was moved by something other than a hand on it: a
     * scroll another window sent, or an auto-scroll that has to keep the
     * lead. It becomes the leader only if it is not already -- taking the
     * lead again on every frame would restart every follower's glide, and
     * they would trail a steady scroll instead of keeping up with it.
     */
    followFrom(container: HTMLElement) {
        if (this.source !== container) {
            this.lead(container);
        }
        this.scheduleFollow();
    }

    /**
     * Every member at `container`'s reading point now, with no glide: for
     * panes that have only just been drawn, where there is nothing to ease
     * out of and a slide into place would be the only thing moving.
     */
    alignTo(container: HTMLElement) {
        const group = this.members.get(container)?.group;
        if (group === undefined) {
            return;
        }
        this.lead(container);
        this.follow(container, group, Number.POSITIVE_INFINITY);
    }

    checkIsLeading(container: HTMLElement) {
        return this.source === container;
    }

    /**
     * One more frame of following, from a leader that moved without a scroll
     * event: an auto-scroll sliding by fractions of a pixel.
     */
    followFrame(container: HTMLElement) {
        if (this.source === container) {
            this.scheduleFollow();
        }
    }

    /** A new leader: every follower glides from wherever it is now. */
    private lead(container: HTMLElement) {
        this.source = container;
        for (const member of this.members.values()) {
            member.top = undefined;
        }
    }

    private scheduleFollow() {
        if (this.frame !== null) {
            return;
        }
        this.frame = requestAnimationFrame((time) => {
            this.frame = null;
            const elapsed =
                this.lastFrameTime === null ? 0 : time - this.lastFrameTime;
            this.lastFrameTime = time;
            const source = this.source;
            const sourceGroup = source && this.members.get(source)?.group;
            if (
                source &&
                sourceGroup &&
                this.follow(
                    source,
                    sourceGroup,
                    elapsed > 0 && elapsed <= 100 ? elapsed : FRAME_MS,
                )
            ) {
                // Still easing out a gap. It ends by itself; nothing polls.
                this.scheduleFollow();
            }
        });
    }

    register(container: HTMLElement, group: string) {
        const member: Member = { group, offset: 0 };
        this.members.set(container, member);
        const activate = () => {
            if (this.source !== container) {
                this.lead(container);
            }
        };
        const keyDown = (event: KeyboardEvent) => {
            if (
                SCROLL_KEYS.has(event.key) &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                !(event.target as HTMLElement).closest(
                    'input, textarea, select, [contenteditable="true"]',
                )
            ) {
                activate();
            }
        };
        const scroll = () => {
            if (this.source === container) {
                this.scheduleFollow();
            }
        };
        container.addEventListener('wheel', activate, { passive: true });
        container.addEventListener('pointerdown', activate, { passive: true });
        container.addEventListener('touchstart', activate, { passive: true });
        container.addEventListener('keydown', keyDown);
        container.addEventListener('scroll', scroll, { passive: true });
        return () => {
            container.removeEventListener('wheel', activate);
            container.removeEventListener('pointerdown', activate);
            container.removeEventListener('touchstart', activate);
            container.removeEventListener('keydown', keyDown);
            container.removeEventListener('scroll', scroll);
            this.members.delete(container);
            releaseSubPixelScroll(container);
            if (this.source === container) {
                this.source = null;
                if (this.frame !== null) {
                    cancelAnimationFrame(this.frame);
                    this.frame = null;
                }
            }
        };
    }

    /**
     * Put every follower at the leader's exact reading point, every frame,
     * so it moves as smoothly as the leader does. Returns whether a follower
     * is still gliding and needs another frame.
     */
    private follow(source: HTMLElement, group: string, elapsed: number) {
        const measuredScale = this.getScale?.() ?? 1;
        const scale = measuredScale > 0 ? measuredScale : 1;
        const sourcePane = measurePane(source, scale);
        // The reference line runs from the top edge at the start of the
        // content to the bottom edge at its end, so all panes reach their
        // first and last lines together whatever their sizes.
        const progress = sourcePane.maxScroll
            ? Math.min(getSubPixelScrollTop(source) / sourcePane.maxScroll, 1)
            : 0;
        const position = readPosition(
            source,
            sourcePane.top + sourcePane.height * progress,
            sourcePane,
            this.verseSelector,
        );
        if (!position) {
            return false;
        }
        const decay = Math.exp(-elapsed / GLIDE_MS);
        // While the leader glides by fractions of a pixel, so do its
        // followers; whole pixels alone would tick six times a second.
        const isSubPixel = checkIsSubPixelScrolling(source);
        let isGliding = false;
        // Read all geometry before writing any scroll offset. No state
        // updates, disk writes or idle polling.
        const offsets: [HTMLElement, number][] = [];
        for (const [container, member] of this.members) {
            if (
                container === source ||
                member.group !== group ||
                !container.clientHeight
            ) {
                continue;
            }
            const pane = measurePane(container, scale);
            const y = locatePosition(
                container,
                position,
                pane,
                this.verseSelector,
            );
            const isPlaying =
                container.querySelector(PLAYING_SELECTOR) !== null;
            if (y === null || isPlaying) {
                if (!isPlaying && !isSubPixel) {
                    releaseSubPixelScroll(container);
                }
                member.top = undefined;
                continue;
            }
            const scrollTop = getSubPixelScrollTop(container);
            // The gap is measured where it is drawn and closed where it is
            // scrolled.
            const target =
                scrollTop + (y - pane.top - pane.height * progress) / scale;
            if (
                member.top === undefined ||
                // Moved by something else, e.g. a verse brought into view.
                Math.abs(scrollTop - member.top) > 2
            ) {
                member.offset = scrollTop - target;
            }
            member.offset *= decay;
            // Snap the last pixel: an exponential tail would otherwise creep
            // one device pixel every few frames for a further ~150ms.
            if (Math.abs(member.offset) < 1) {
                member.offset = 0;
            } else {
                isGliding = true;
            }
            const top = Math.max(
                0,
                Math.min(target + member.offset, pane.maxScroll),
            );
            if (
                top !== member.top ||
                checkIsSubPixelScrolling(container) !== isSubPixel
            ) {
                offsets.push([container, top]);
            }
            member.top = top;
        }
        for (const [container, top] of offsets) {
            if (isSubPixel) {
                writeSubPixelScrollTop(container, top);
            } else {
                releaseSubPixelScroll(container);
                container.scrollTop = top;
            }
        }
        return isGliding;
    }
}
