import {
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from 'react';

import { useAppEffect } from '../helper/appHooks';
import {
    parseAnimation,
    toAnimationStillFill,
    type GlslAnimationType,
} from './animationValueHelpers';
import { genFillBackground } from './fillValueHelpers';
import { ensureCssAnimationKeyframes } from './cssAnimationLayerHelpers';
import ScreenBackgroundAnimationComp from '../_screen/ScreenBackgroundAnimationComp';

const fillingStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
};

function CssAnimationPreviewComp({
    src,
    isMoving,
}: Readonly<{ src: string; isMoving: boolean }>) {
    const boxRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (isMoving && boxRef.current !== null) {
            ensureCssAnimationKeyframes(boxRef.current.ownerDocument);
        }
    }, [isMoving]);
    return (
        <div ref={boxRef} style={fillingStyle}>
            <ScreenBackgroundAnimationComp
                src={src}
                isMoving={isMoving}
                isOnScreen={false}
            />
        </div>
    );
}

/**
 * True once `boxRef`'s element has come into view, and from then on: a tile
 * far down a long panel asks for nothing until it is scrolled to.
 */
function useHasBeenInView(
    boxRef: RefObject<HTMLElement | null>,
    isWatching: boolean,
) {
    const [hasBeenInView, setHasBeenInView] = useState(!isWatching);
    useAppEffect(() => {
        const box = boxRef.current;
        if (hasBeenInView || box === null) {
            return;
        }
        if (typeof IntersectionObserver === 'undefined') {
            setHasBeenInView(true);
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (
                entries.some((entry) => {
                    return entry.isIntersecting;
                })
            ) {
                observer.disconnect();
                setHasBeenInView(true);
            }
        });
        observer.observe(box);
        return () => {
            observer.disconnect();
        };
    }, [hasBeenInView]);
    return hasBeenInView;
}

function GlslAnimationPreviewComp({
    src,
    animation,
    isMoving,
    stillWidth,
    isDrawnInView,
}: Readonly<{
    src: string;
    animation: GlslAnimationType;
    isMoving: boolean;
    stillWidth: number;
    isDrawnInView: boolean;
}>) {
    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isFailed, setIsFailed] = useState(false);
    const [isDrawn, setIsDrawn] = useState(false);
    const hasBeenInView = useHasBeenInView(boxRef, isDrawnInView);
    useAppEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null || !hasBeenInView) {
            return;
        }
        setIsFailed(false);
        setIsDrawn(false);
        let isCancelled = false;
        let stop = () => {};
        if (isMoving) {
            // One small live canvas, only while the pointer is on it.
            import('../_screen/glslAnimationRuntime').then(
                ({ startGlslAnimation }) => {
                    if (isCancelled) {
                        return;
                    }
                    stop = startGlslAnimation(canvas, animation, {
                        scale: 1,
                        fps: 30,
                        onFirstFrame: () => {
                            setIsDrawn(true);
                        },
                        onError: () => {
                            setIsFailed(true);
                        },
                    }).stop;
                },
            );
        } else {
            canvas.width = stillWidth;
            canvas.height = Math.round((stillWidth * 9) / 16);
            import('./glslStillRenderer').then(({ queueGlslStill }) => {
                if (isCancelled) {
                    return;
                }
                stop = queueGlslStill(animation, canvas, (isOk) => {
                    if (!isCancelled) {
                        setIsDrawn(isOk);
                        setIsFailed(!isOk);
                    }
                });
            });
        }
        return () => {
            isCancelled = true;
            stop();
        };
        // `animation` is `src` parsed: `src` stands for it.
    }, [src, isMoving, stillWidth, hasBeenInView]);
    return (
        <div
            ref={boxRef}
            style={{
                ...fillingStyle,
                // Under the canvas until it has drawn, and for good when it
                // cannot: a still picture of the colours.
                background:
                    isDrawn && !isFailed
                        ? 'none'
                        : genFillBackground(toAnimationStillFill(animation)),
                opacity: animation.opacity / 100,
            }}
        >
            <canvas
                // A canvas that held a 2D picture cannot be handed to WebGL.
                key={isMoving ? 'live' : 'still'}
                ref={canvasRef}
                style={{
                    display: isFailed ? 'none' : 'block',
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
}

/**
 * An animation where it is not presented: a tile, a run sheet row, a slide's
 * thumbnail. Still unless `isMoving` -- a tile under the pointer -- and a
 * shader's still comes from the one shared renderer (`glslStillRenderer`).
 */
export default function AnimationPreviewComp({
    src,
    isMoving = false,
    stillWidth = 320,
    isDrawnInView = false,
}: Readonly<{
    src: string;
    isMoving?: boolean;
    stillWidth?: number;
    /** A shader's still waits until the preview is scrolled into view. */
    isDrawnInView?: boolean;
}>) {
    const animation = useMemo(() => {
        return parseAnimation(src);
    }, [src]);
    if (animation === null) {
        return <div style={fillingStyle} />;
    }
    if (animation.engine === 'css') {
        return <CssAnimationPreviewComp src={src} isMoving={isMoving} />;
    }
    return (
        <GlslAnimationPreviewComp
            src={src}
            animation={animation}
            isMoving={isMoving}
            stillWidth={stillWidth}
            isDrawnInView={isDrawnInView}
        />
    );
}
