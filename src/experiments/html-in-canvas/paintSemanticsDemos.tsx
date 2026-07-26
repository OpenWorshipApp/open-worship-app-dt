/**
 * Canvas-side paint effects over a live DOM subtree.
 */
import { useRef, useState } from 'react';

import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    getHicContext,
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

const FILTER_LIST = [
    'none',
    'blur(6px)',
    'brightness(1.6)',
    'grayscale(1)',
    'sepia(0.8)',
    'hue-rotate(120deg)',
    'invert(1)',
    'contrast(2.2)',
    'saturate(3) blur(1px)',
    'drop-shadow(12px 12px 12px #000)',
];

export function FilterComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [filter, setFilter] = useState(FILTER_LIST[1]);

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
        context.reset();
        context.filter = filter;
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(elementRef.current as Element, 0, 0);
        });
        context.filter = 'none';
    }, [filter]);

    return (
        <DemoFrameComp
            summary={
                'ctx.filter applies to element draws, so any live DOM subtree ' +
                'can be blurred, inverted or hue-shifted per frame — the ' +
                'building block for dissolve and focus-pull transitions.'
            }
            controls={FILTER_LIST.map((item) => {
                return (
                    <ButtonComp
                        key={item}
                        label={item}
                        isActive={item === filter}
                        onClick={() => {
                            setFilter(item);
                        }}
                    />
                );
            })}
            notes="Filters cost real raster time — the blur benchmark was the slowest pattern measured. Use them for short transitions, not for steady state."
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp
                    elementRef={elementRef}
                    heading="Filtered"
                    lines={['live DOM, canvas filter']}
                />
            </canvas>
        </DemoFrameComp>
    );
}

const CLIP_SHAPE_LIST = ['bar', 'circle', 'stripes', 'diagonal'] as const;
type ClipShapeType = (typeof CLIP_SHAPE_LIST)[number];

export function ClipWipeComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const backRef = useRef<HTMLDivElement | null>(null);
    const frontRef = useRef<HTMLDivElement | null>(null);
    const [shape, setShape] = useState<ClipShapeType>('bar');
    const [progress, setProgress] = useState(45);

    useAfterRenderingUpdate(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        if (backRef.current === null || frontRef.current === null) {
            return;
        }
        const ratio = progress / 100;
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(backRef.current as Element, 0, 0);
            context.save();
            context.beginPath();
            if (shape === 'bar') {
                context.rect(0, 0, SLIDE_WIDTH * ratio, SLIDE_HEIGHT);
            } else if (shape === 'circle') {
                context.arc(
                    SLIDE_WIDTH / 2,
                    SLIDE_HEIGHT / 2,
                    ratio * 1150,
                    0,
                    Math.PI * 2,
                );
            } else if (shape === 'stripes') {
                const bandCount = 9;
                const bandHeight = SLIDE_HEIGHT / bandCount;
                for (let index = 0; index < bandCount; index += 1) {
                    context.rect(
                        0,
                        index * bandHeight,
                        SLIDE_WIDTH * ratio,
                        bandHeight * 0.72,
                    );
                }
            } else {
                const reach = ratio * (SLIDE_WIDTH + SLIDE_HEIGHT);
                context.moveTo(0, 0);
                context.lineTo(reach, 0);
                context.lineTo(0, reach);
                context.closePath();
            }
            context.clip();
            context.drawElementImage(frontRef.current as Element, 0, 0);
            context.restore();
        });
    }, [shape, progress]);

    return (
        <DemoFrameComp
            summary={
                'ctx.clip() reveals one live DOM subtree through an arbitrary ' +
                'path drawn over another. CSS can approximate this with ' +
                'clip-path; canvas gives per-frame control with no extra layer.'
            }
            controls={
                <>
                    {CLIP_SHAPE_LIST.map((item) => {
                        return (
                            <ButtonComp
                                key={item}
                                label={item}
                                isActive={item === shape}
                                onClick={() => {
                                    setShape(item);
                                }}
                            />
                        );
                    })}
                    <SliderComp
                        label="progress"
                        value={progress}
                        min={0}
                        max={100}
                        onChange={setProgress}
                    />
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
                    elementRef={backRef}
                    heading="Before"
                    lines={['outgoing slide']}
                />
                <SlideComp
                    elementRef={frontRef}
                    background="linear-gradient(160deg,#3d2b0b,#1a1207)"
                    heading="After"
                    lines={['incoming slide']}
                />
            </canvas>
        </DemoFrameComp>
    );
}

export function BackdropFilterComp() {
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
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(elementRef.current as Element, 0, 0);
        });
    }, []);

    return (
        <DemoFrameComp
            summary={
                'backdrop-filter inside the drawn subtree renders correctly — ' +
                'verified with invert(1) over red producing exact cyan. That ' +
                'is notable because our CSS transitions currently break it.'
            }
            notes={
                <>
                    <code>transitionEffectHelpers.ts</code> carries two{' '}
                    <em>
                        &quot;fix backdrop filter stop working during
                        animation&quot;
                    </em>{' '}
                    TODOs, caused by compositing the animated layer. In the
                    canvas path the effect opacity lives in{' '}
                    <code>globalAlpha</code>, so the element is never promoted
                    and the backdrop stays intact.
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
                    background="linear-gradient(90deg,#e74c3c,#2980b9)"
                    heading="Backdrop"
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: 260,
                            top: 520,
                            width: 1400,
                            height: 380,
                            backdropFilter: 'invert(1) blur(14px)',
                            border: '6px solid rgba(255,255,255,0.5)',
                            borderRadius: 30,
                            color: '#fff',
                            font: '70px serif',
                            padding: 40,
                            boxSizing: 'border-box',
                        }}
                    >
                        backdrop-filter: invert(1) blur(14px)
                    </div>
                </SlideComp>
            </canvas>
        </DemoFrameComp>
    );
}
