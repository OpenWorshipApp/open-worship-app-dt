/**
 * Where an animation has to live to be visible through the canvas.
 */
import { useRef, useState, type CSSProperties } from 'react';

import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    withSlideSpace,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useAnimationLoop,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    SliderComp,
    CANVAS_STYLE,
    SlideComp,
    KeyframesComp,
} from './htmlInCanvasUiComps';

export function RootVsDescendantComp() {
    const [leftRef, setLeftRef] = useHicCanvas();
    const [rightRef, setRightRef] = useHicCanvas();
    const leftElementRef = useRef<HTMLDivElement | null>(null);
    const rightElementRef = useRef<HTMLDivElement | null>(null);

    useAnimationLoop(() => {
        for (const [canvasRef, elementRef] of [
            [leftRef, leftElementRef],
            [rightRef, rightElementRef],
        ] as const) {
            const canvas = canvasRef.current;
            const context = getHicContext(canvas);
            if (
                canvas === null ||
                context === null ||
                elementRef.current === null
            ) {
                continue;
            }
            context.reset();
            context.drawElementImage(elementRef.current, 0, 0);
        }
    }, true);

    const boxStyle: CSSProperties = {
        width: 220,
        height: 120,
        background: '#c0392b',
        color: '#fff',
        font: '16px sans-serif',
        padding: 8,
        boxSizing: 'border-box',
    };

    return (
        <DemoFrameComp
            summary={
                'The single most important rule. Left: the CSS animation is on ' +
                'the drawn child itself — it animates in the page but the ' +
                'canvas never sees it. Right: the same animation one level ' +
                'deeper — fully visible, and it drives paint at 60 fps.'
            }
            notes={
                <>
                    A drawn child’s own <code>transform</code> is ignored
                    outright, and <code>transform</code>/<code>opacity</code>{' '}
                    <em>animations</em> on it are compositor-driven, so they are
                    invisible to <code>drawElementImage</code> and fire no paint
                    events. Static <code>opacity</code> on the root <em>is</em>{' '}
                    honoured. Rule of thumb: never animate the element you draw
                    — animate a wrapper inside it, or animate in canvas space.
                </>
            }
        >
            <KeyframesComp />
            <div style={{ display: 'flex', gap: 12 }}>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.bad,
                            marginBottom: 4,
                        }}
                    >
                        animation ON the drawn child → invisible
                    </div>
                    <canvas
                        ref={setLeftRef}
                        width={220}
                        height={120}
                        style={CANVAS_STYLE}
                    >
                        <div
                            ref={leftElementRef}
                            style={{
                                ...boxStyle,
                                animation:
                                    'hic-demo-spin-fade 1.6s linear infinite alternate',
                            }}
                        >
                            root animated
                        </div>
                    </canvas>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.good,
                            marginBottom: 4,
                        }}
                    >
                        animation on a descendant → renders
                    </div>
                    <canvas
                        ref={setRightRef}
                        width={220}
                        height={120}
                        style={CANVAS_STYLE}
                    >
                        <div ref={rightElementRef} style={boxStyle}>
                            <div
                                style={{
                                    width: 120,
                                    height: 60,
                                    background: '#fff',
                                    color: '#000',
                                    animation:
                                        'hic-demo-spin-fade 1.6s linear infinite alternate',
                                }}
                            >
                                descendant
                            </div>
                        </div>
                    </canvas>
                </div>
            </div>
        </DemoFrameComp>
    );
}

export function CanvasSpaceAnimComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [scalePercent, setScalePercent] = useState(100);
    const [alphaPercent, setAlphaPercent] = useState(100);
    const [rotateDegree, setRotateDegree] = useState(0);
    const [offsetX, setOffsetX] = useState(0);

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
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.save();
            context.globalAlpha = alphaPercent / 100;
            context.translate(SLIDE_WIDTH / 2 + offsetX, SLIDE_HEIGHT / 2);
            context.rotate((rotateDegree * Math.PI) / 180);
            context.scale(scalePercent / 100, scalePercent / 100);
            context.translate(-SLIDE_WIDTH / 2, -SLIDE_HEIGHT / 2);
            context.drawElementImage(elementRef.current as Element, 0, 0);
            context.restore();
        });
    };

    useAfterRenderingUpdate(draw, [
        scalePercent,
        alphaPercent,
        rotateDegree,
        offsetX,
    ]);

    return (
        <DemoFrameComp
            summary={
                'The correct way to move a whole slide: leave the DOM alone ' +
                'and transform the drawing. Everything CSS refuses to give ' +
                'you through the canvas — scale, rotate, alpha — works here.'
            }
            controls={
                <>
                    <SliderComp
                        label="scale %"
                        value={scalePercent}
                        min={20}
                        max={160}
                        onChange={setScalePercent}
                    />
                    <SliderComp
                        label="alpha %"
                        value={alphaPercent}
                        min={0}
                        max={100}
                        onChange={setAlphaPercent}
                    />
                    <SliderComp
                        label="rotate°"
                        value={rotateDegree}
                        min={-45}
                        max={45}
                        onChange={setRotateDegree}
                    />
                    <SliderComp
                        label="x"
                        value={offsetX}
                        min={-600}
                        max={600}
                        step={10}
                        onChange={setOffsetX}
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
                    elementRef={elementRef}
                    heading="Canvas space"
                    lines={['transform lives here']}
                />
            </canvas>
        </DemoFrameComp>
    );
}
