import { useEffect, useRef } from 'react';

export const RULER_THICKNESS = 18;

const MINOR_TICKS_PER_MAJOR = 5;

function pickStep(scale: number) {
    const steps = [
        1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
    ];
    for (const step of steps) {
        if (step * scale >= 40) {
            return step;
        }
    }
    return steps[steps.length - 1];
}

function getBackgroundColor(isDarkTheme: boolean) {
    return isDarkTheme ? 'rgba(43, 43, 43, 0.7)' : 'rgba(232, 232, 232, 0.7)';
}

function drawRuler(
    canvasEle: HTMLCanvasElement,
    isHorizontal: boolean,
    logicalLength: number,
    scale: number,
    isDarkTheme: boolean,
) {
    const dpr = globalThis.devicePixelRatio || 1;
    const thickness = RULER_THICKNESS;
    const lengthPx = Math.max(1, Math.round(logicalLength * scale));
    const width = isHorizontal ? lengthPx : thickness;
    const height = isHorizontal ? thickness : lengthPx;
    canvasEle.width = Math.round(width * dpr);
    canvasEle.height = Math.round(height * dpr);
    canvasEle.style.width = `${width}px`;
    canvasEle.style.height = `${height}px`;
    const ctx = canvasEle.getContext('2d');
    if (ctx === null) {
        return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tickColor = isDarkTheme ? '#9a9a9a' : '#666666';
    const textColor = isDarkTheme ? '#cfcfcf' : '#333333';
    // Assigning `width`/`height` above already cleared the bitmap, so this
    // semi-transparent fill composites over the page, not a stale frame.
    ctx.fillStyle = getBackgroundColor(isDarkTheme);
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = tickColor;
    ctx.fillStyle = textColor;
    ctx.font = '9px sans-serif';
    ctx.lineWidth = 1;
    // Numbered from the canvas center outward (0 at center, negative to
    // the left/top), matching familiar document-editor rulers.
    const majorStep = pickStep(scale);
    const minorStep = majorStep / MINOR_TICKS_PER_MAJOR;
    const center = logicalLength / 2;
    const firstN = Math.ceil(-center / minorStep);
    const lastN = Math.floor((logicalLength - center) / minorStep);
    for (let n = firstN; n <= lastN; n++) {
        const relative = n * minorStep;
        const v = relative + center;
        if (v < 0 || v > logicalLength) {
            continue;
        }
        const screenPos = Math.round(v * scale) + 0.5;
        const isMajor = n % MINOR_TICKS_PER_MAJOR === 0;
        const tickLen = isMajor ? thickness * 0.65 : thickness * 0.3;
        ctx.beginPath();
        if (isHorizontal) {
            ctx.moveTo(screenPos, thickness - tickLen);
            ctx.lineTo(screenPos, thickness);
        } else {
            ctx.moveTo(thickness - tickLen, screenPos);
            ctx.lineTo(thickness, screenPos);
        }
        ctx.stroke();
        if (isMajor) {
            const label = String(Math.round(relative));
            if (isHorizontal) {
                ctx.fillText(label, screenPos + 2, 10);
            } else {
                ctx.save();
                ctx.translate(9, screenPos - 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(label, 0, 0);
                ctx.restore();
            }
        }
    }
}

export function CanvasRulerComp({
    isHorizontal,
    logicalLength,
    scale,
    isDarkTheme,
    onCreateGuide,
}: Readonly<{
    isHorizontal: boolean;
    logicalLength: number;
    scale: number;
    isDarkTheme: boolean;
    onCreateGuide: (clientX: number, clientY: number) => void;
}>) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const canvasEle = canvasRef.current;
        if (canvasEle === null || scale <= 0) {
            return;
        }
        drawRuler(canvasEle, isHorizontal, logicalLength, scale, isDarkTheme);
    }, [isHorizontal, logicalLength, scale, isDarkTheme]);
    return (
        <canvas
            ref={canvasRef}
            title="Drag onto the canvas to add a guide line"
            style={{
                position: 'absolute',
                top: isHorizontal ? -RULER_THICKNESS : 0,
                left: isHorizontal ? 0 : -RULER_THICKNESS,
                cursor: isHorizontal ? 'row-resize' : 'col-resize',
                // Let a finger drag off the ruler to create a guide instead
                // of scrolling the workspace.
                touchAction: 'none',
                // `.slide-canvas-editor` gets its own stacking context from
                // `transform: scale(...)`, so without an explicit z-index
                // here it paints over the ruler even though the ruler is
                // earlier in the DOM. Keep this local to the container's
                // stacking context; app-wide layers (modals, toasts, ...)
                // own the higher values in `others/variables.scss`.
                zIndex: 2,
            }}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCreateGuide(event.clientX, event.clientY);
            }}
        />
    );
}

export function CanvasRulerCornerComp({
    isDarkTheme,
}: Readonly<{ isDarkTheme: boolean }>) {
    return (
        <div
            style={{
                position: 'absolute',
                top: -RULER_THICKNESS,
                left: -RULER_THICKNESS,
                width: RULER_THICKNESS,
                height: RULER_THICKNESS,
                background: getBackgroundColor(isDarkTheme),
                borderRight: `1px solid ${isDarkTheme ? '#444' : '#ccc'}`,
                borderBottom: `1px solid ${isDarkTheme ? '#444' : '#ccc'}`,
                zIndex: 3,
            }}
        />
    );
}
