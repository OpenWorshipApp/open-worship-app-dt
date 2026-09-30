import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';

export const VIRTUAL_ROW_KEY = 'data-virtual-row-key';

// A row whose height moves by less than this is the same row: sub-pixel
// layout, a scrollbar appearing, a font falling back. Writing those back would
// re-measure for ever.
const HEIGHT_TOLERANCE = 1;

type HeightMapType = Map<string, number>;

/** Null while nothing has been measured. */
function toMedian(heightMap: HeightMapType) {
    if (heightMap.size === 0) {
        return null;
    }
    const heights = Array.from(heightMap.values()).sort((one, other) => {
        return one - other;
    });
    return heights[heights.length >> 1];
}

/**
 * Row heights for a windowed list that cannot know them in advance.
 *
 * Two lists need this and they look nothing alike: a run sheet, where one line
 * is a folded header and the next is a song opened out into its slides; and a
 * grid of background thumbnails, where a row is as tall as the tallest picture
 * in it and every picture keeps its own shape. Both were laid out at ONE
 * measured height, which left uneven gaps between rows and, where the measured
 * row was a short one, rows overlapping the row below by up to 26 pixels.
 *
 * So every row that has been drawn is measured and remembered BY KEY -- by key
 * and not by position, so reordering a list carries its measurements with it --
 * and the map is pruned to what the list holds rather than growing with
 * everything that has ever been in it.
 *
 * A row nobody has drawn is assumed to be the MIDDLE of the rows that have
 * been, falling back to the caller's guess while there are none. The caller's
 * guess is about one kind of row and these lists are not one kind of anything:
 * a thousand rows guessed at 34 each make a list 34 000 tall that is really
 * 150 000, and "scroll to line 995" then aims past the end of the scroller and
 * can never arrive. The median is what makes both the scrollbar and that jump
 * honest -- see why it is not the mean at `toMedian`.
 */
export function useMeasuredRowHeights({
    rowKeys,
    estimateRowHeight,
    containerRef,
}: {
    /** One key per ROW, in order. */
    rowKeys: string[];
    estimateRowHeight: number;
    containerRef: RefObject<HTMLElement | null>;
}) {
    const [heightMap, setHeightMap] = useState<HeightMapType>(() => {
        return new Map();
    });

    // Pruned on the KEYS, never on the count. A list of three thousand rows
    // holds a measurement for the ten that have been drawn, so "is the map
    // bigger than the list?" is false for ever -- and the rows a background
    // panel measured in Thumbnail View stayed in it after a switch to List
    // View, where they are a different shape entirely. Their heights then
    // carried the median, and every list row was laid out 75 pixels apart
    // from the row above it that was only 31 tall.
    useAppEffect(() => {
        setHeightMap((previousMap) => {
            if (previousMap.size === 0) {
                return previousMap;
            }
            const keySet = new Set(rowKeys);
            const nextMap: HeightMapType = new Map();
            for (const [key, height] of previousMap) {
                if (keySet.has(key)) {
                    nextMap.set(key, height);
                }
            }
            return nextMap.size === previousMap.size ? previousMap : nextMap;
        });
    }, [rowKeys]);

    const measureRows = useCallback((elements: Iterable<Element>) => {
        const measuredList: [string, number][] = [];
        for (const element of elements) {
            if (!element.isConnected) {
                continue;
            }
            const key = element.getAttribute(VIRTUAL_ROW_KEY);
            const height = element.getBoundingClientRect().height;
            if (key !== null && height > 0) {
                measuredList.push([key, height]);
            }
        }
        if (measuredList.length === 0) {
            return;
        }
        setHeightMap((previousMap) => {
            // Copied only once something has actually moved: a row coming back
            // into view is measured again at the size it already has, and that
            // must cost nothing.
            let nextMap: HeightMapType | null = null;
            for (const [key, height] of measuredList) {
                const previousHeight = previousMap.get(key);
                if (
                    previousHeight !== undefined &&
                    Math.abs(previousHeight - height) <= HEIGHT_TOLERANCE
                ) {
                    continue;
                }
                nextMap ??= new Map(previousMap);
                nextMap.set(key, height);
            }
            return nextMap ?? previousMap;
        });
    }, []);

    // Measured on a TIMER rather than only by the observer below, and batched
    // so a screenful of new rows forces one layout between them. A window that
    // is not on screen delivers no `ResizeObserver` callbacks at all -- it runs
    // no frames -- and a list that waited for one stayed at its estimated row
    // heights for as long as another window covered the app.
    const pendingRef = useRef(new Set<Element>());
    const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const measureRowsRef = useAppCurrentRef(measureRows);
    const scheduleMeasuring = useCallback((element: Element) => {
        pendingRef.current.add(element);
        if (measureTimeoutRef.current !== null) {
            return;
        }
        measureTimeoutRef.current = setTimeout(() => {
            measureTimeoutRef.current = null;
            const elements = Array.from(pendingRef.current);
            pendingRef.current.clear();
            measureRowsRef.current(elements);
        }, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        return () => {
            if (measureTimeoutRef.current !== null) {
                clearTimeout(measureTimeoutRef.current);
            }
        };
    }, []);

    // Built during render, not in an effect: React attaches a row's ref BEFORE
    // effects run, so an observer created in one would miss the first rows and
    // -- with nothing else measuring them -- never get a second chance.
    const resizeObserver = useMemo(() => {
        return new ResizeObserver((entries) => {
            measureRowsRef.current(
                entries.map((entry) => {
                    return entry.target;
                }),
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        return () => {
            resizeObserver.disconnect();
        };
    }, [resizeObserver]);

    const attachedRef = useRef(new Set<Element>());
    const handleRowRef = useCallback(
        (element: HTMLDivElement | null) => {
            if (element === null) {
                return;
            }
            attachedRef.current.add(element);
            scheduleMeasuring(element);
            resizeObserver.observe(element);
            return () => {
                attachedRef.current.delete(element);
                pendingRef.current.delete(element);
                resizeObserver.unobserve(element);
            };
        },
        [resizeObserver, scheduleMeasuring],
    );

    const remeasureAttached = useCallback(() => {
        for (const element of attachedRef.current) {
            scheduleMeasuring(element);
        }
    }, [scheduleMeasuring]);

    // Re-measure what is on screen whenever the keys change, which is the one
    // thing a ref callback cannot notice: React reuses a row's element when
    // only its key changes, so it never calls the callback again -- and the
    // rows a background panel had measured in Thumbnail View, pruned on the
    // way into List View, came back to Thumbnail View with nothing measured at
    // all and were laid out at the caller's guess for ever. The observer would
    // have caught it, except that a window nobody is looking at runs no frames
    // and delivers no observer callbacks.
    useAppEffect(() => {
        remeasureAttached();
    }, [rowKeys, remeasureAttached]);

    // And whenever a row's CONTENT arrives late, which is the other thing the
    // ref callback cannot notice and the `ResizeObserver` only notices in a
    // window that is painting: a run sheet line holding a document reads its
    // slides off the disk and grows twenty thousand pixels a moment after it
    // was drawn and measured at nothing. Both of these are delivered as
    // microtasks rather than at a frame boundary, so an occluded window keeps
    // its geometry honest -- which is what the operator comes back to.
    useAppEffect(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        const mutationObserver = new MutationObserver(remeasureAttached);
        mutationObserver.observe(container, {
            childList: true,
            subtree: true,
            // A nested windowed list inside a row settles its own height by
            // writing it as an inline style, and that is a change no child
            // list reports: the run sheet line holding a two-hundred-slide
            // document was still 708 pixels short of its grid without this.
            attributes: true,
            attributeFilter: ['style'],
        });
        // Captured: `load` does not bubble, and a thumbnail that decodes is
        // what makes a row of pictures its final height.
        container.addEventListener('load', remeasureAttached, true);
        return () => {
            mutationObserver.disconnect();
            container.removeEventListener('load', remeasureAttached, true);
        };
    }, [containerRef, remeasureAttached]);

    const rowHeight = useMemo(() => {
        // The MEDIAN of what has been measured, not the mean: one line of a
        // run sheet is a whole song opened out into its slides and stands
        // 20 000 pixels tall, and a mean carrying that made a thousand-line
        // sheet 1 200 000 pixels long -- a scrollbar with a thumb too small to
        // grab, for a sheet really about a tenth of that. The middle row is
        // what a row is typically like, and one giant cannot move it.
        const safeEstimate = Math.max(
            1,
            toMedian(heightMap) ?? estimateRowHeight,
        );
        return (index: number) => {
            return heightMap.get(rowKeys[index]) ?? safeEstimate;
        };
    }, [rowKeys, estimateRowHeight, heightMap]);

    return { rowHeight, handleRowRef };
}
