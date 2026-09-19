/**
 * Hit testing drawn elements.
 */
import { useRef, useState } from 'react';

import {
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
} from './htmlInCanvasHelpers';
import { useHicCanvas, useAfterRenderingUpdate } from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
} from './htmlInCanvasUiComps';

export function HitTestComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [isAligned, setIsAligned] = useState(true);
    const [clickCount, setClickCount] = useState(0);
    const [hitInfo, setHitInfo] = useState('-');

    useAfterRenderingUpdate(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            elementRef.current === null
        ) {
            return;
        }
        const element = elementRef.current;
        context.reset();
        context.save();
        context.translate(150, 90);
        context.rotate(0.12);
        const drawMatrix = context.drawElementImage(element, 0, 0);
        context.restore();
        element.style.transform = isAligned
            ? canvas.getElementTransform(element, drawMatrix).toString()
            : '';
        requestAnimationFrame(() => {
            const canvasRect = canvas.getBoundingClientRect();
            const found = document.elementFromPoint(
                canvasRect.left + 200,
                canvasRect.top + 120,
            );
            setHitInfo(
                `elementFromPoint over the drawn button → ${
                    found?.id || found?.tagName || 'none'
                }`,
            );
        });
    }, [isAligned, clickCount]);

    return (
        <DemoFrameComp
            summary={
                'Canvas children stay in the accessibility and hit-testing ' +
                'tree, but they sit at the canvas origin — not where you drew ' +
                'them. Feed the matrix returned by drawElementImage into ' +
                'getElementTransform and assign it to the element to line the ' +
                'two up, then real clicks land on the drawn pixels.'
            }
            controls={
                <>
                    <ButtonComp
                        label={
                            isAligned
                                ? 'hit area: aligned'
                                : 'hit area: not aligned'
                        }
                        onClick={() => {
                            setIsAligned(!isAligned);
                        }}
                        isActive={isAligned}
                    />
                    <BadgeComp label={`clicks: ${clickCount}`} tone="good" />
                </>
            }
            notes={
                <>
                    Try clicking the drawn button with alignment off — the click
                    goes to the canvas’s top-left corner instead. Note the
                    element also keeps working for screen readers and keyboard
                    focus, which a hand-drawn canvas UI does not.
                </>
            }
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <div
                    id="hit-target"
                    ref={elementRef}
                    onClick={() => {
                        setClickCount(clickCount + 1);
                    }}
                    style={{
                        width: 180,
                        height: 60,
                        background: '#f39c12',
                        color: '#241a02',
                        font: 'bold 20px sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transformOrigin: '0 0',
                    }}
                >
                    click me
                </div>
            </canvas>
            <div
                style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: COLOR.muted,
                    marginTop: 6,
                }}
            >
                {hitInfo}
            </div>
        </DemoFrameComp>
    );
}
