/**
 * Basics: drawing, overloads, the paint event.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    toErrorMessage,
    runDrawGuarded,
    withSlideSpace,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useThrottledCounter,
    useFpsMeter,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

export function BasicDrawComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [info, setInfo] = useState('not drawn yet');

    const draw = () => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            elementRef.current === null
        ) {
            return;
        }
        try {
            context.reset();
            withSlideSpace(context, canvas, () => {
                const matrix = context.drawElementImage(
                    elementRef.current as Element,
                    0,
                    0,
                );
                setInfo(`returned ${matrix.toString()}`);
            });
        } catch (error) {
            setInfo(toErrorMessage(error));
        }
    };

    useAfterRenderingUpdate(draw, []);

    return (
        <DemoFrameComp
            summary={
                'The whole API in one call: a real DOM subtree — web fonts, ' +
                'gradients, shadows, complex scripts — rasterized into a 2D ' +
                'canvas. The subtree itself is never painted into the page.'
            }
            controls={<ButtonComp label="Redraw" onClick={draw} />}
            notes={
                <>
                    <code>drawElementImage</code> returns a DOMMatrix mapping
                    the element to where it was drawn — feed it to{' '}
                    <code>getElementTransform</code> to line the hit area up
                    (see the Hit testing demo). Drawing before the first
                    rendering update throws{' '}
                    <code>No cached paint record for element</code>, which is
                    why every demo draws from a rAF or the paint event.
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
                    heading="Amazing grace"
                    lines={['how sweet the sound', 'ព្រះគុណដ៏អស្ចារ្យ']}
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
                {info}
            </div>
        </DemoFrameComp>
    );
}

export function OverloadsComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);

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
        // 3-arg: natural size at an offset (clipped by the canvas).
        context.drawElementImage(element, 8, 8);
        // 5-arg: scaled into a destination box.
        context.drawElementImage(element, 8, 96, 200, 112);
        // 9-arg: crop a source rect, then scale it into a destination box.
        context.drawElementImage(
            element,
            0,
            0,
            SLIDE_WIDTH / 2,
            SLIDE_HEIGHT / 2,
            220,
            96,
            220,
            124,
        );
    }, []);

    return (
        <DemoFrameComp
            summary={
                'The three overloads, drawn into one canvas: natural size, ' +
                'scaled to a destination box, and a cropped source rect ' +
                'scaled into a destination box.'
            }
            notes={
                <>
                    Top: natural 1920x1080 at (8,8) — only the corner fits.
                    Bottom-left: whole slide squeezed into 200x112. Bottom-
                    right: top-left quarter cropped, then scaled up.
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
                    background="linear-gradient(140deg,#20313f,#0d1519)"
                    heading="Overloads"
                    lines={['crop · scale · place']}
                />
            </canvas>
        </DemoFrameComp>
    );
}

export function PaintEventComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [text, setText] = useState('edit me — the canvas follows');
    const [changed, setChanged] = useState<string[]>([]);
    const [paintCount, paintCountRef] = useThrottledCounter();

    useAppEffect(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        canvas.onpaint = (event) => {
            paintCountRef.current += 1;
            const ids = Array.from(event.changedElements).map((element) => {
                return element.id || element.tagName;
            });
            if (ids.length > 0) {
                setChanged(ids);
            }
            if (elementRef.current === null) {
                return;
            }
            runDrawGuarded(() => {
                context.reset();
                withSlideSpace(context, canvas, () => {
                    context.drawElementImage(
                        elementRef.current as Element,
                        0,
                        0,
                    );
                });
            });
        };
        canvas.requestPaint();
        return () => {
            canvas.onpaint = null;
        };
    }, []);

    return (
        <DemoFrameComp
            summary={
                'The paint event fires whenever a drawn child’s rendering ' +
                'changes — no polling, no rAF. Type below: React updates the ' +
                'canvas child, Chromium fires paint, the handler redraws.'
            }
            controls={
                <>
                    <input
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                        }}
                        style={{
                            background: COLOR.panelSoft,
                            color: COLOR.text,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 12,
                            width: 240,
                        }}
                    />
                    <BadgeComp label={`paints: ${paintCount}`} tone="good" />
                    <BadgeComp
                        label={`changedElements: [${changed.join(', ')}]`}
                    />
                </>
            }
            notes={
                <>
                    <code>changedElements</code> always names the{' '}
                    <em>direct child</em> of the canvas, never the descendant
                    that actually changed — invalidation granularity is one
                    canvas-item. A child you have never drawn has no cached
                    paint record and therefore never fires paint at all.
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
                    heading="Live"
                    lines={[text]}
                />
            </canvas>
        </DemoFrameComp>
    );
}

export function RequestPaintClockComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [isRunning, setIsRunning] = useState(true);
    const [fps, frameCountRef] = useFpsMeter();

    useAppEffect(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null || !isRunning) {
            return;
        }
        let isCancelled = false;
        const startTime = performance.now();
        canvas.onpaint = () => {
            if (isCancelled || elementRef.current === null) {
                return;
            }
            frameCountRef.current += 1;
            const phase = ((performance.now() - startTime) % 2000) / 2000;
            runDrawGuarded(() => {
                context.reset();
                withSlideSpace(context, canvas, () => {
                    context.save();
                    context.translate(Math.sin(phase * Math.PI * 2) * 120, 0);
                    context.drawElementImage(
                        elementRef.current as Element,
                        0,
                        0,
                    );
                    context.restore();
                });
            });
            canvas.requestPaint();
        };
        canvas.requestPaint();
        return () => {
            isCancelled = true;
            canvas.onpaint = null;
        };
    }, [isRunning]);

    return (
        <DemoFrameComp
            summary={
                'Calling requestPaint() from inside the paint handler turns ' +
                'the paint event into an animation clock — a rAF replacement ' +
                'that is already synchronised with canvas-child invalidation.'
            }
            controls={
                <>
                    <ButtonComp
                        label={isRunning ? 'Stop' : 'Start'}
                        onClick={() => {
                            setIsRunning(!isRunning);
                        }}
                        isActive={isRunning}
                    />
                    <BadgeComp
                        label={`${fps} fps`}
                        tone={fps >= 55 ? 'good' : 'warn'}
                    />
                </>
            }
            notes="Measured ~62 fps in the probe runs — same cadence as requestAnimationFrame."
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp
                    elementRef={elementRef}
                    background="linear-gradient(140deg,#2b1b3d,#120a19)"
                    heading="requestPaint()"
                    lines={['as the clock']}
                />
            </canvas>
        </DemoFrameComp>
    );
}
