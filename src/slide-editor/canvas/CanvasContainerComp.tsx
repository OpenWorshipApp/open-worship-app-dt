import {
    memo,
    useCallback,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type DragEvent,
} from 'react';

import { BoxEditorComp } from './box/BoxEditorComp';
import { showCanvasContextMenu } from './canvasContextMenuHelpers';
import type CanvasController from './CanvasController';
import { useCanvasControllerContext } from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import type CanvasItem from './CanvasItem';
import {
    CanvasItemContext,
    useCanvasItemsContext,
    useSelectedCanvasItemsAndSetterContext,
} from './CanvasItem';
import { changeDragEventStyle } from '../../helper/helpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from './canvasHelpers';
import {
    checkIsAppendSelectionModifier,
    getCanvasItemsInRect,
    mergeCanvasItemSelection,
} from './canvasSelectionHelpers';
import { tran } from '../../lang/langHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { type useEditingCanvasContextValue } from '../canvasEditingHelpers';
import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from '../../others/ShadowingFillParentWidthComp';
import { getSlideItemShadowingStyle } from '../../app-document-presenter/items/slideItemRenderHelpers';
import { genBoxEditorStyle } from './box/boxEditorHelpers';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { useKeyboardRegistering } from '../../event/KeyboardEventListener';

function dragOverHandling(event: any) {
    event.preventDefault();
    const items: DataTransferItemList = event.dataTransfer.items;
    if (
        Array.from(items).every((item) => {
            return checkIsSupportMediaType(item.type);
        })
    ) {
        event.currentTarget.style.opacity = '0.5';
    }
}

async function handleDropping(
    canvasController: CanvasController,
    event: DragEvent,
) {
    changeDragEventStyle(event, 'opacity', '1');
    for await (const file of readDroppedFiles(event)) {
        if (checkIsSupportMediaType(file.type)) {
            const newCanvasItem =
                await canvasController.genNewImageItemFromFile(file, event);
            if (newCanvasItem) {
                canvasController.addNewItems([newCanvasItem]);
            }
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
                tran('Unsupported file type!'),
            );
        }
    }
}

async function openCanvasContextMenu(
    canvasController: CanvasController,
    event: any,
    stopAllModes: () => void,
) {
    (event.target as HTMLDivElement).focus();
    stopAllModes();
    showCanvasContextMenu(event, canvasController);
}

function clampToCanvasPoint(
    clientX: number,
    clientY: number,
    bcr: { left: number; top: number },
    scale: number,
    width: number,
    height: number,
) {
    const x = Math.max(0, Math.min(width, (clientX - bcr.left) / scale));
    const y = Math.max(0, Math.min(height, (clientY - bcr.top) / scale));
    return { x, y };
}

// Kept as its own memoized component so marquee-drag state updates in
// `BodyRendererComp` don't re-render every box on the canvas.
const CanvasItemsListComp = memo(function CanvasItemsListComp({
    canvasItems,
}: Readonly<{ canvasItems: CanvasItem<any>[] }>) {
    return canvasItems.map((canvasItem) => {
        return (
            <CanvasItemContext key={canvasItem.id} value={canvasItem}>
                <BoxEditorComp />
            </CanvasItemContext>
        );
    });
});

function BodyRendererComp({
    stopAllModes,
}: Readonly<{ stopAllModes: () => void }>) {
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
    // Mirrored in a ref so the document-level mousemove/mouseup listeners
    // below don't need to be re-subscribed on every render.
    const latestRef = useRef({
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
    });
    latestRef.current = {
        canvasItems,
        selectedCanvasItems,
        setSelectedCanvasItems,
    };
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
    const handleDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            handleDropping(canvasController, event);
        },
        [canvasController],
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            event.preventDefault();
            openCanvasContextMenu(canvasController, event, stopAllModes);
        },
        [canvasController, stopAllModes],
    );
    const handleMouseDown = useCallback(
        (event: any) => {
            event.stopPropagation();
            // Start a marquee (rubber-band) selection only when the press
            // begins on the empty canvas background, not on a box.
            if (event.target === event.currentTarget && event.button === 0) {
                const { x, y } = toCanvasPoint(event.clientX, event.clientY);
                const isAppend = checkIsAppendSelectionModifier(event);
                setMarquee({ startX: x, startY: y, x, y, isAppend });
            }
            (event.target as HTMLDivElement).dataset.mouseDown = JSON.stringify(
                {
                    time: Date.now(),
                    x: event.clientX,
                    y: event.clientY,
                },
            );
        },
        [toCanvasPoint],
    );
    useAppEffect(() => {
        if (marquee === null) {
            return;
        }
        // The canvas doesn't move/resize during a drag, so the bounding
        // rect is captured once here instead of on every `mousemove`.
        const element = canvasElementRef.current;
        const bcr = element?.getBoundingClientRect() ?? null;
        const toPoint = (event: MouseEvent) => {
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
        const handleMove = (event: MouseEvent) => {
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
        const handleUp = (event: MouseEvent) => {
            // Use the release position directly rather than the (possibly
            // one-frame-stale) throttled `prev.x/y` so the final selection
            // rect matches exactly where the mouse was released.
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
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [marquee !== null, scale, canvas.width, canvas.height]);
    const handleMouseUp = useCallback(
        (event: any) => {
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
                    stopAllModes();
                }
            }
            dataset.mouseDown = '';
        },
        [stopAllModes],
    );
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
            }}
            onDragOver={dragOverHandling}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={handleContextMenuOpening}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        >
            <CanvasItemsListComp canvasItems={canvasItems} />
            {marqueeStyle !== null ? <div style={marqueeStyle} /> : null}
        </div>
    );
}

function scrollToCenter(
    parentElement: HTMLDivElement,
    actualWidth: number,
    actualHeight: number,
) {
    parentElement.scrollTop =
        (actualHeight * 5 - parentElement.clientHeight) / 2;
    parentElement.scrollLeft =
        (actualWidth * 5 - parentElement.clientWidth) / 2;
}

export default function CanvasContainerComp({
    contextData,
}: Readonly<{ contextData: ReturnType<typeof useEditingCanvasContextValue> }>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        contextValue: allCanvasContextValue,
        canvasController,
        stopAllModes,
    } = contextData;
    const scale = useSlideCanvasScale(canvasController);
    const { canvas } = canvasController;
    const { actualWidth, actualHeight } = useMemo(() => {
        const actualWidth = Math.round(canvas.width * scale);
        const actualHeight = Math.round(canvas.height * scale);
        return { actualWidth, actualHeight };
    }, [canvas.width, canvas.height, scale]);

    useAppEffect(() => {
        canvasController.toCenterView = () => {
            const container = containerRef.current;
            const parentElement = container?.parentElement ?? null;
            if (
                container === null ||
                parentElement instanceof HTMLDivElement === false
            ) {
                return;
            }
            scrollToCenter(
                parentElement,
                container.clientWidth,
                container.clientHeight,
            );
        };
        return () => {
            canvasController.toCenterView = () => {};
        };
    }, [canvasController]);
    useAppEffect(() => {
        canvasController.toCenterView();
    }, [containerRef.current, actualWidth, actualHeight]);

    useKeyboardRegistering(
        [
            {
                allControlKey: ['Ctrl'],
                key: 'Enter',
            },
        ],
        () => {
            const containerParent = containerRef.current?.parentElement ?? null;
            if (containerParent === null) {
                return;
            }
            if (document.activeElement === document.body) {
                containerParent.focus();
            }
        },
        [containerRef.current],
    );

    return (
        <div className="w-100 h-100" style={{ overflow: 'auto' }}>
            <div
                ref={containerRef}
                style={{
                    width: actualWidth,
                    height: actualHeight,
                    margin: `${actualHeight * 2}px ${actualWidth * 2}px`,
                    position: 'relative',
                }}
            >
                <ShadowingFillParentWidthComp width={actualWidth}>
                    <MultiContextRender contexts={allCanvasContextValue}>
                        {genBoxEditorStyle()}
                        {getSlideItemShadowingStyle()}
                        <BodyRendererComp stopAllModes={stopAllModes} />
                    </MultiContextRender>
                </ShadowingFillParentWidthComp>
            </div>
        </div>
    );
}
