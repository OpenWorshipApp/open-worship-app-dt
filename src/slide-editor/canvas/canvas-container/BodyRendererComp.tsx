import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent,
} from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasItemsContext } from '../CanvasItem';
import { useSelectedCanvasItemsAndSetterContext } from '../CanvasItem';
import { useShadowingParentWidth } from '../../../others/ShadowingFillParentWidthComp';
import { useThemeSource } from '../../../others/themeHelpers';
import { useAppEffect, useAppCurrentRef } from '../../../helper/appHooks';
import {
    CanvasGuideLineComp,
    CanvasSnapLinesComp,
} from '../CanvasGuideLineComp';
import {
    CanvasSnapContext,
    type GuideLineType,
    type SnapLinesType,
    type SnapTargetsType,
} from '../canvasSnapGuideHelpers';
import {
    checkIsAppendSelectionModifier,
    getCanvasItemsInRect,
    mergeCanvasItemSelection,
} from '../canvasSelectionHelpers';
import {
    clampToCanvasPoint,
    dragOverHandling,
    handleDropping,
    openCanvasContextMenu,
} from './canvasContainerHelpers';
import { CanvasItemsListComp } from './CanvasItemsListComp';

export function BodyRendererComp({
    stopAllModes,
    guides,
    onGuidePointerDown,
    onGuideRemove,
}: Readonly<{
    stopAllModes: () => void;
    guides: GuideLineType[];
    onGuidePointerDown: (axis: 'v' | 'h', id: number, event: any) => void;
    onGuideRemove: (id: number) => void;
}>) {
    const parentWidth = useShadowingParentWidth();
    const canvasController = useCanvasControllerContext();
    const { canvas } = canvasController;
    const scale = useMemo(() => {
        const scale = (parentWidth ?? 0) / canvas.width;
        return scale;
    }, [parentWidth, canvas.width]);
    const canvasItems = useCanvasItemsContext();
    const {
        canvasItems: selectedCanvasItems,
        setCanvasItems: setSelectedCanvasItems,
    } = useSelectedCanvasItemsAndSetterContext();
    const [snapLines, setSnapLines] = useState<SnapLinesType>({
        vertical: [],
        horizontal: [],
    });
    // Mirrored in a ref so the document-level mousemove/mouseup listeners
    // below don't need to be re-subscribed on every render.
    const latestRef = useAppCurrentRef({
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
        guides,
    });
    const getSnapTargets = useCallback(
        (excludeIds: number[]): SnapTargetsType => {
            const excludedIdSet = new Set(excludeIds);
            const vertical: number[] = [0, canvas.width / 2, canvas.width];
            const horizontal: number[] = [0, canvas.height / 2, canvas.height];
            for (const item of latestRef.current.canvasItems) {
                if (excludedIdSet.has(item.id)) {
                    continue;
                }
                const props = item.props as any;
                vertical.push(
                    props.left,
                    props.left + props.width / 2,
                    props.left + props.width,
                );
                horizontal.push(
                    props.top,
                    props.top + props.height / 2,
                    props.top + props.height,
                );
            }
            for (const guide of latestRef.current.guides) {
                if (guide.axis === 'v') {
                    vertical.push(guide.pos);
                } else {
                    horizontal.push(guide.pos);
                }
            }
            return { vertical, horizontal };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [canvas.width, canvas.height],
    );
    const snapContextValue = useMemo(
        () => ({ getSnapTargets, setSnapLines }),
        [getSnapTargets],
    );
    const { theme } = useThemeSource();
    const canvasElementRef = useRef<HTMLDivElement | null>(null);
    const [marquee, setMarquee] = useState<{
        startX: number;
        startY: number;
        x: number;
        y: number;
        isAppend: boolean;
    } | null>(null);
    const toCanvasPoint = useCallback(
        (clientX: number, clientY: number) => {
            const element = canvasElementRef.current;
            if (element === null || scale === 0) {
                return { x: 0, y: 0 };
            }
            const bcr = element.getBoundingClientRect();
            return clampToCanvasPoint(
                clientX,
                clientY,
                bcr,
                scale,
                canvas.width,
                canvas.height,
            );
        },
        [scale, canvas.width, canvas.height],
    );
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.style.opacity = '1';
    }, []);
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const handleDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        handleDropping(canvasControllerRef.current, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const stopAllModesRef = useAppCurrentRef(stopAllModes);
    const handleContextMenuOpening = useCallback((event: any) => {
        event.preventDefault();
        openCanvasContextMenu(
            canvasControllerRef.current,
            event,
            stopAllModesRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const toCanvasPointRef = useAppCurrentRef(toCanvasPoint);
    const handlePointerDown = useCallback((event: any) => {
        event.stopPropagation();
        // Start a marquee (rubber-band) selection only when the press
        // begins on the empty canvas background, not on a box.
        if (event.target === event.currentTarget && event.button === 0) {
            const { x, y } = toCanvasPointRef.current(
                event.clientX,
                event.clientY,
            );
            const isAppend = checkIsAppendSelectionModifier(event);
            setMarquee({ startX: x, startY: y, x, y, isAppend });
        }
        (event.target as HTMLDivElement).dataset.mouseDown = JSON.stringify({
            time: Date.now(),
            x: event.clientX,
            y: event.clientY,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        if (marquee === null) {
            return;
        }
        // The canvas doesn't move/resize during a drag, so the bounding
        // rect is captured once here instead of on every `mousemove`.
        const element = canvasElementRef.current;
        const bcr = element?.getBoundingClientRect() ?? null;
        const toPoint = (event: PointerEvent) => {
            return bcr === null || scale === 0
                ? null
                : clampToCanvasPoint(
                      event.clientX,
                      event.clientY,
                      bcr,
                      scale,
                      canvas.width,
                      canvas.height,
                  );
        };
        // Batch to one state update per frame instead of one per `mousemove`,
        // which can fire far more often than the screen repaints.
        let rafId: number | null = null;
        const handleMove = (event: PointerEvent) => {
            if (rafId !== null) {
                return;
            }
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const point = toPoint(event);
                if (point === null) {
                    return;
                }
                const { x, y } = point;
                setMarquee((prev) => {
                    return prev === null ? prev : { ...prev, x, y };
                });
            });
        };
        const handleUp = (event: PointerEvent) => {
            // Use the release position directly rather than the (possibly
            // one-frame-stale) throttled `prev.x/y` so the final selection
            // rect matches exactly where the pointer was released.
            const releasePoint = toPoint(event);
            setMarquee((prev) => {
                if (prev !== null) {
                    const { x, y } = releasePoint ?? prev;
                    const minX = Math.min(prev.startX, x);
                    const maxX = Math.max(prev.startX, x);
                    const minY = Math.min(prev.startY, y);
                    const maxY = Math.max(prev.startY, y);
                    // Only treat it as a marquee drag when it covers an area;
                    // a tiny movement is a plain click (handled elsewhere).
                    if (maxX - minX >= 3 || maxY - minY >= 3) {
                        const hits = getCanvasItemsInRect(
                            latestRef.current.canvasItems,
                            { minX, maxX, minY, maxY },
                        );
                        // Shift/Ctrl (at drag start or release) appends the
                        // hits to the current selection instead of replacing.
                        const isAppend =
                            prev.isAppend ||
                            checkIsAppendSelectionModifier(event);
                        latestRef.current.setSelectedCanvasItems(
                            isAppend
                                ? mergeCanvasItemSelection(
                                      latestRef.current.selectedCanvasItems,
                                      hits,
                                  )
                                : hits,
                        );
                    }
                }
                return null;
            });
        };
        document.addEventListener('pointermove', handleMove);
        document.addEventListener('pointerup', handleUp);
        document.addEventListener('pointercancel', handleUp);
        return () => {
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
            document.removeEventListener('pointercancel', handleUp);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [marquee !== null, scale, canvas.width, canvas.height]);
    const handlePointerUp = useCallback((event: any) => {
        if (event.target instanceof HTMLTextAreaElement) {
            return;
        }
        const dataset = (event.target as HTMLDivElement).dataset;
        // A right-click (button 2) opens the item's context menu instead
        // of selecting/dragging it (see `BoxEditorController.moveHandler`,
        // which ignores button 2). Treating it as a plain click here
        // would clear the selection right as the context menu opens.
        if (dataset.mouseDown && event.button === 0) {
            const mouseDown = JSON.parse(dataset.mouseDown);
            const timeDiff = Date.now() - mouseDown.time;
            const distance = Math.sqrt(
                Math.pow(event.clientX - mouseDown.x, 2) +
                    Math.pow(event.clientY - mouseDown.y, 2),
            );
            if (timeDiff < 500 && distance < 10) {
                stopAllModesRef.current();
            }
        }
        dataset.mouseDown = '';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const marqueeStyle = useMemo((): CSSProperties | null => {
        if (marquee === null) {
            return null;
        }
        const borderWidth = scale > 0 ? 1 / scale : 1;
        return {
            position: 'absolute',
            left: `${Math.min(marquee.startX, marquee.x)}px`,
            top: `${Math.min(marquee.startY, marquee.y)}px`,
            width: `${Math.abs(marquee.x - marquee.startX)}px`,
            height: `${Math.abs(marquee.y - marquee.startY)}px`,
            border: `${borderWidth}px solid #4aa3ff`,
            backgroundColor: 'rgba(74, 163, 255, 0.25)',
            pointerEvents: 'none',
            zIndex: 9999,
        };
    }, [marquee, scale]);
    return (
        <div
            className="slide-canvas-editor shadow-blank-bg"
            data-shadow-theme={theme}
            ref={canvasElementRef}
            style={{
                width: `${canvas.width}px`,
                height: `${canvas.height}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                // So a finger drag on the empty canvas rubber-band-selects
                // instead of scrolling. Scoped to the canvas only — the outer
                // `overflow: auto` workspace (and its margins) stays pannable
                // by touch. Boxes/handles set their own `touch-action` too.
                touchAction: 'none',
            }}
            onDragOver={dragOverHandling}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={handleContextMenuOpening}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <CanvasSnapContext value={snapContextValue}>
                <CanvasItemsListComp canvasItems={canvasItems} />
            </CanvasSnapContext>
            {guides.map((guide) => (
                <CanvasGuideLineComp
                    key={guide.id}
                    guide={guide}
                    onPointerDown={(event) => {
                        onGuidePointerDown(guide.axis, guide.id, event);
                    }}
                    onRemove={() => onGuideRemove(guide.id)}
                />
            ))}
            <CanvasSnapLinesComp
                vertical={snapLines.vertical}
                horizontal={snapLines.horizontal}
            />
            {marqueeStyle !== null ? <div style={marqueeStyle} /> : null}
        </div>
    );
}
