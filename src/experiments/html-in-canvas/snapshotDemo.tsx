/**
 * captureElementImage snapshots.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import type { ElementImageType } from './htmlInCanvasTypes';
import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    toErrorMessage,
    withSlideSpace,
} from './htmlInCanvasHelpers';
import { useHicCanvas, useAfterRenderingUpdate } from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    SliderComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

export function SnapshotComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const snapshotRef = useRef<ElementImageType | null>(null);
    const [heading, setHeading] = useState('Original');
    const [status, setStatus] = useState('nothing captured');
    const [splitPercent, setSplitPercent] = useState(50);

    const drawSplit = () => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            elementRef.current === null
        ) {
            return;
        }
        const snapshot = snapshotRef.current;
        context.reset();
        withSlideSpace(context, canvas, () => {
            if (snapshot !== null) {
                context.drawElementImage(
                    snapshot,
                    0,
                    0,
                    SLIDE_WIDTH,
                    SLIDE_HEIGHT,
                );
            }
            context.save();
            context.beginPath();
            context.rect(
                (SLIDE_WIDTH * splitPercent) / 100,
                0,
                SLIDE_WIDTH,
                SLIDE_HEIGHT,
            );
            context.clip();
            context.drawElementImage(elementRef.current as Element, 0, 0);
            context.restore();
            context.strokeStyle = '#fff';
            context.lineWidth = 4;
            context.beginPath();
            context.moveTo((SLIDE_WIDTH * splitPercent) / 100, 0);
            context.lineTo((SLIDE_WIDTH * splitPercent) / 100, SLIDE_HEIGHT);
            context.stroke();
        });
    };

    useAfterRenderingUpdate(drawSplit, [heading, splitPercent]);

    useAppEffect(() => {
        return () => {
            snapshotRef.current?.close();
            snapshotRef.current = null;
        };
    }, []);

    return (
        <DemoFrameComp
            summary={
                'captureElementImage() freezes a child’s pixels so the DOM ' +
                'can move on underneath. Capture, then change the heading: the ' +
                'left half keeps showing the frozen frame, the right half is ' +
                'live.'
            }
            controls={
                <>
                    <ButtonComp
                        label="Capture"
                        onClick={() => {
                            const canvas = canvasRef.current;
                            if (
                                canvas === null ||
                                elementRef.current === null
                            ) {
                                return;
                            }
                            try {
                                snapshotRef.current?.close();
                                const snapshot = canvas.captureElementImage(
                                    elementRef.current,
                                );
                                snapshotRef.current = snapshot;
                                setStatus(
                                    `ElementImage ${snapshot.width}x${snapshot.height} (device px)`,
                                );
                                drawSplit();
                            } catch (error) {
                                setStatus(toErrorMessage(error));
                            }
                        }}
                    />
                    <ButtonComp
                        label="Change the DOM"
                        onClick={() => {
                            setHeading(
                                heading === 'Original'
                                    ? 'Changed!'
                                    : 'Original',
                            );
                        }}
                    />
                    <ButtonComp
                        label="close() then draw"
                        onClick={() => {
                            const context = getHicContext(canvasRef.current);
                            const snapshot = snapshotRef.current;
                            if (context === null || snapshot === null) {
                                setStatus('capture something first');
                                return;
                            }
                            snapshot.close();
                            try {
                                context.drawElementImage(snapshot, 0, 0);
                                setStatus('no error (unexpected)');
                            } catch (error) {
                                setStatus(toErrorMessage(error));
                            }
                            snapshotRef.current = null;
                        }}
                    />
                    <SliderComp
                        label="split"
                        value={splitPercent}
                        min={0}
                        max={100}
                        onChange={setSplitPercent}
                    />
                </>
            }
            notes={
                <>
                    Snapshots are bound to the canvas that captured them —
                    drawing one into a different canvas throws{' '}
                    <code>The source was captured from a different canvas</code>
                    . They are device-pixel sized (a 1920x1080 element at dpr
                    1.5 is 2880x1620 ≈ 18 MB), so pass an explicit destination
                    size and <code>close()</code> them as soon as the transition
                    ends.
                </>
            }
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp
                    elementRef={elementRef}
                    background={
                        heading === 'Original'
                            ? 'linear-gradient(160deg,#0b3d2e,#071a14)'
                            : 'linear-gradient(160deg,#3d0b0b,#1a0707)'
                    }
                    heading={heading}
                    lines={['frozen | live']}
                />
            </canvas>
            <div
                style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: COLOR.muted,
                    marginTop: 6,
                }}
            >
                {status}
            </div>
        </DemoFrameComp>
    );
}
