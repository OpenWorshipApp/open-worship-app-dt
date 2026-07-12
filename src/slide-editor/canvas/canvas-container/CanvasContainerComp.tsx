import { useCallback, useMemo, useRef, useState } from 'react';

import { useSlideCanvasScale } from '../canvasEventHelpers';
import { MultiContextRender } from '../../../helper/MultiContextRender';
import { type useEditingCanvasContextValue } from '../../canvasEditingHelpers';
import ShadowingFillParentWidthComp from '../../../others/ShadowingFillParentWidthComp';
import { getSlideItemShadowingStyle } from '../../../app-document-presenter/items/slideItemRenderHelpers';
import { genBoxEditorStyle } from '../box/boxEditorHelpers';
import { useThemeSource } from '../../../others/themeHelpers';
import { useAppEffect } from '../../../helper/appHooks';
import { useKeyboardRegistering } from '../../../event/KeyboardEventListener';
import {
    CanvasRulerComp,
    CanvasRulerCornerComp,
    RULER_THICKNESS,
} from '../CanvasRulerComp';
import { type GuideLineType } from '../canvasSnapGuideHelpers';
import { clampToCanvasPoint, scrollToCenter } from './canvasContainerHelpers';
import { BodyRendererComp } from './BodyRendererComp';

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
    const { theme } = useThemeSource();
    const { actualWidth, actualHeight } = useMemo(() => {
        const actualWidth = Math.round(canvas.width * scale);
        const actualHeight = Math.round(canvas.height * scale);
        return { actualWidth, actualHeight };
    }, [canvas.width, canvas.height, scale]);

    const [guides, setGuides] = useState<GuideLineType[]>([]);
    const nextGuideIdRef = useRef(1);
    const handleGuideRemove = useCallback((id: number) => {
        setGuides((prev) => prev.filter((guide) => guide.id !== id));
    }, []);
    const startGuideDrag = useCallback(
        (axis: 'v' | 'h', id: number, clientX: number, clientY: number) => {
            const moveToPoint = (clientX: number, clientY: number) => {
                const element = containerRef.current;
                if (element === null || scale === 0) {
                    return;
                }
                const bcr = element.getBoundingClientRect();
                const { x, y } = clampToCanvasPoint(
                    clientX,
                    clientY,
                    bcr,
                    scale,
                    canvas.width,
                    canvas.height,
                );
                setGuides((prev) => {
                    return prev.map((guide) => {
                        if (guide.id !== id) {
                            return guide;
                        }
                        return { ...guide, pos: axis === 'h' ? y : x };
                    });
                });
            };
            const handleMove = (event: MouseEvent) => {
                moveToPoint(event.clientX, event.clientY);
            };
            const handleUp = (event: MouseEvent) => {
                globalThis.removeEventListener('mousemove', handleMove);
                globalThis.removeEventListener('mouseup', handleUp);
                const element = containerRef.current;
                const bcr = element?.getBoundingClientRect();
                if (bcr) {
                    const outOfBounds =
                        axis === 'h'
                            ? event.clientY < bcr.top ||
                              event.clientY > bcr.top + bcr.height
                            : event.clientX < bcr.left ||
                              event.clientX > bcr.left + bcr.width;
                    if (outOfBounds) {
                        handleGuideRemove(id);
                    }
                }
            };
            globalThis.addEventListener('mousemove', handleMove);
            globalThis.addEventListener('mouseup', handleUp);
            moveToPoint(clientX, clientY);
        },
        [scale, canvas.width, canvas.height, handleGuideRemove],
    );
    const handleCreateGuide = useCallback(
        (axis: 'v' | 'h', clientX: number, clientY: number) => {
            const id = nextGuideIdRef.current++;
            setGuides((prev) => [...prev, { id, axis, pos: 0 }]);
            startGuideDrag(axis, id, clientX, clientY);
        },
        [startGuideDrag],
    );
    const handleGuideMouseDown = useCallback(
        (axis: 'v' | 'h', id: number, event: any) => {
            event.stopPropagation();
            event.preventDefault();
            startGuideDrag(axis, id, event.clientX, event.clientY);
        },
        [startGuideDrag],
    );

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
                    margin: `${actualHeight * 2 + RULER_THICKNESS}px ${
                        actualWidth * 2 + RULER_THICKNESS
                    }px`,
                    position: 'relative',
                    // Confine the rulers/guides/marquee z-indexes to this
                    // subtree, otherwise they compete with app-wide layers
                    // (modals, popups, toasts) in the root stacking context.
                    isolation: 'isolate',
                }}
            >
                <CanvasRulerCornerComp isDarkTheme={theme === 'dark'} />
                <CanvasRulerComp
                    isHorizontal
                    logicalLength={canvas.width}
                    scale={scale}
                    isDarkTheme={theme === 'dark'}
                    onCreateGuide={(clientX, clientY) => {
                        handleCreateGuide('h', clientX, clientY);
                    }}
                />
                <CanvasRulerComp
                    isHorizontal={false}
                    logicalLength={canvas.height}
                    scale={scale}
                    isDarkTheme={theme === 'dark'}
                    onCreateGuide={(clientX, clientY) => {
                        handleCreateGuide('v', clientX, clientY);
                    }}
                />
                <ShadowingFillParentWidthComp width={actualWidth}>
                    <MultiContextRender contexts={allCanvasContextValue}>
                        {genBoxEditorStyle()}
                        {getSlideItemShadowingStyle()}
                        <BodyRendererComp
                            stopAllModes={stopAllModes}
                            guides={guides}
                            onGuideMouseDown={handleGuideMouseDown}
                            onGuideRemove={handleGuideRemove}
                        />
                    </MultiContextRender>
                </ShadowingFillParentWidthComp>
            </div>
        </div>
    );
}
