/**
 * Animating inside one item, and the nested-canvas dead end.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import {
    SLIDE_WIDTH,
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
    useAnimationLoop,
    useThrottledCounter,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
    KeyframesComp,
} from './htmlInCanvasUiComps';

export function InsideItemAnimationComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [paintCount, paintCountRef] = useThrottledCounter();
    const [replayKey, setReplayKey] = useState(0);

    useAppEffect(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        canvas.onpaint = () => {
            paintCountRef.current += 1;
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

    const wordList = ['Amazing', 'grace', 'how', 'sweet', 'the', 'sound'];

    return (
        <DemoFrameComp
            summary={
                'The second level of nesting: ordinary CSS keyframes on ' +
                'descendants inside one canvas-item. They render, and each ' +
                'animation frame fires a paint event, so the canvas keeps up ' +
                'without a rAF loop of its own.'
            }
            controls={
                <>
                    <ButtonComp
                        label="Replay"
                        onClick={() => {
                            setReplayKey(replayKey + 1);
                        }}
                    />
                    <BadgeComp label={`paints: ${paintCount}`} tone="good" />
                </>
            }
            notes="Word-by-word reveal plus an infinite marquee — both are descendant animations, which is why they are visible at all."
        >
            <KeyframesComp />
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp elementRef={elementRef}>
                    <div
                        key={replayKey}
                        style={{
                            position: 'absolute',
                            left: 100,
                            top: 300,
                            display: 'flex',
                            gap: 30,
                        }}
                    >
                        {wordList.map((word, index) => {
                            return (
                                <span
                                    key={word}
                                    style={{
                                        fontSize: 96,
                                        animation: `hic-demo-word-in 500ms ease-out ${
                                            index * 160
                                        }ms both`,
                                    }}
                                >
                                    {word}
                                </span>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 760,
                            width: SLIDE_WIDTH,
                            overflow: 'hidden',
                            background: 'rgba(0,0,0,0.35)',
                            padding: '20px 0',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                width: '200%',
                                animation:
                                    'hic-demo-marquee 6s linear infinite',
                                fontSize: 60,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <span style={{ width: '50%' }}>
                                descendant animations render · descendant
                                animations render ·&nbsp;
                            </span>
                            <span style={{ width: '50%' }}>
                                descendant animations render · descendant
                                animations render ·&nbsp;
                            </span>
                        </div>
                    </div>
                </SlideComp>
            </canvas>
        </DemoFrameComp>
    );
}

export function NestedCanvasComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const [innerRef, setInnerRef] = useHicCanvas();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const plainCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [nestedError, setNestedError] = useState('not tried yet');
    const [grandchildError, setGrandchildError] = useState('not tried yet');
    const grandchildRef = useRef<HTMLDivElement | null>(null);

    useAnimationLoop((elapsedMillisecond) => {
        // A plain (non-layoutsubtree) canvas inside the subtree is captured
        // live — this is the supported way to hand-render a sub-region.
        const plain = plainCanvasRef.current;
        if (plain !== null) {
            const plainContext = plain.getContext('2d');
            if (plainContext !== null) {
                const hue = Math.round((elapsedMillisecond / 12) % 360);
                plainContext.fillStyle = `hsl(${hue} 90% 50%)`;
                plainContext.fillRect(0, 0, plain.width, plain.height);
                plainContext.fillStyle = '#000';
                plainContext.font = '28px sans-serif';
                plainContext.fillText('plain canvas', 16, 60);
            }
        }
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            wrapperRef.current === null
        ) {
            return;
        }
        context.reset();
        context.drawElementImage(wrapperRef.current, 0, 0);
    }, true);

    const tryNested = () => {
        const inner = innerRef.current;
        const context = getHicContext(inner);
        if (
            inner === null ||
            context === null ||
            grandchildRef.current === null
        ) {
            return;
        }
        try {
            context.drawElementImage(grandchildRef.current, 0, 0);
            setNestedError('no error (unexpected)');
        } catch (error) {
            setNestedError(toErrorMessage(error));
        }
    };

    const tryGrandchild = () => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            grandchildRef.current === null
        ) {
            return;
        }
        try {
            context.drawElementImage(grandchildRef.current, 0, 0);
            setGrandchildError('no error (unexpected)');
        } catch (error) {
            setGrandchildError(toErrorMessage(error));
        }
    };

    return (
        <DemoFrameComp
            summary={
                'The two dead ends, demonstrated by the errors they throw — ' +
                'plus the workaround that does work.'
            }
            controls={
                <>
                    <ButtonComp
                        label="draw into a nested canvas"
                        onClick={tryNested}
                    />
                    <ButtonComp
                        label="draw a grandchild"
                        onClick={tryGrandchild}
                    />
                </>
            }
            notes={
                <>
                    So per-item animation cannot be built by giving each item
                    its own canvas — items have to be flattened into direct
                    children of one canvas (see the stagger demo). A{' '}
                    <em>plain</em> canvas inside the subtree is fine, and is
                    captured live at 60 fps, as the colour block shows.
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
                    ref={wrapperRef}
                    style={{
                        width: PREVIEW_WIDTH,
                        height: PREVIEW_HEIGHT,
                        background: '#101a22',
                        color: '#fff',
                        font: '13px sans-serif',
                        padding: 10,
                        boxSizing: 'border-box',
                    }}
                >
                    drawn child
                    <canvas
                        ref={setInnerRef}
                        width={200}
                        height={70}
                        style={{ display: 'block', background: '#333' }}
                    >
                        <div
                            ref={grandchildRef}
                            style={{
                                width: 200,
                                height: 70,
                                background: '#ff00ff',
                            }}
                        >
                            grandchild
                        </div>
                    </canvas>
                    <canvas
                        ref={plainCanvasRef}
                        width={200}
                        height={70}
                        style={{ display: 'block', marginTop: 8 }}
                    />
                </div>
            </canvas>
            <div
                style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    marginTop: 8,
                    lineHeight: 1.7,
                }}
            >
                <div style={{ color: COLOR.bad }}>nested: {nestedError}</div>
                <div style={{ color: COLOR.bad }}>
                    grandchild: {grandchildError}
                </div>
            </div>
        </DemoFrameComp>
    );
}
