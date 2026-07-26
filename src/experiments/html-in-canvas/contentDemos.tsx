/**
 * Rich text, iframes and video.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import {
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
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

export function RichTextComp() {
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
                'What makes this API worth the trouble: real text layout. ' +
                'Complex scripts, shaping, bidi, ligatures, shadows, gradient ' +
                'text and blend modes — none of which canvas fillText gives ' +
                'you without reimplementing a text engine.'
            }
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp elementRef={elementRef}>
                    <div
                        style={{
                            position: 'absolute',
                            left: 80,
                            top: 90,
                            fontSize: 78,
                            lineHeight: 1.5,
                        }}
                    >
                        <div>ព្រះគុណដ៏អស្ចារ្យ សូមថ្វាយសិរីល្អ</div>
                        <div dir="rtl">النعمة المدهشة ما أحلى الصوت</div>
                        <div>奇異恩典 何等甘甜 · 素晴らしい恵み</div>
                        <div style={{ fontFamily: 'serif' }}>
                            ligatures: fi fl ffi — kerning: AVATAR
                        </div>
                        <div
                            style={{
                                background:
                                    'linear-gradient(90deg,#ffd86f,#fc6262)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                fontWeight: 700,
                            }}
                        >
                            gradient-filled text
                        </div>
                        <div
                            style={{
                                mixBlendMode: 'difference',
                                color: '#ffe08a',
                            }}
                        >
                            mix-blend-mode: difference
                        </div>
                    </div>
                </SlideComp>
            </canvas>
        </DemoFrameComp>
    );
}

export function IframeComp() {
    const [sameOriginRef, setSameOriginRef] = useHicCanvas();
    const [crossOriginRef, setCrossOriginRef] = useHicCanvas();
    const sameElementRef = useRef<HTMLDivElement | null>(null);
    const crossElementRef = useRef<HTMLDivElement | null>(null);

    const draw = () => {
        for (const [canvasRef, elementRef] of [
            [sameOriginRef, sameElementRef],
            [crossOriginRef, crossElementRef],
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
            try {
                context.reset();
                context.drawElementImage(elementRef.current, 0, 0);
            } catch {
                // reported visually by the empty canvas
            }
        }
    };

    useAfterRenderingUpdate(draw, []);

    return (
        <DemoFrameComp
            summary={
                'Cross-origin content is excluded from element draws for ' +
                'privacy — it blanks to the parent background with no error. ' +
                'Same-origin iframes render normally.'
            }
            controls={<ButtonComp label="Redraw" onClick={draw} />}
            notes={
                <>
                    This is the one functional regression for us:{' '}
                    <code>CanvasItemWebsite</code> and{' '}
                    <code>CanvasItemYouTube</code> are cross-origin iframes, so
                    a canvas-rendered slide shows them as blank holes —
                    silently.
                </>
            }
        >
            <div style={{ display: 'flex', gap: 12 }}>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.good,
                            marginBottom: 4,
                        }}
                    >
                        same-origin (srcdoc) → renders
                    </div>
                    <canvas
                        ref={setSameOriginRef}
                        width={220}
                        height={130}
                        style={CANVAS_STYLE}
                    >
                        <div
                            ref={sameElementRef}
                            style={{
                                width: 220,
                                height: 130,
                                background: '#27ae60',
                            }}
                        >
                            <iframe
                                title="same-origin"
                                srcDoc={
                                    '<body style="margin:0;background:#ff00ff;' +
                                    'color:#fff;font:16px sans-serif">srcdoc iframe</body>'
                                }
                                width={220}
                                height={130}
                                style={{ border: 0 }}
                            />
                        </div>
                    </canvas>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.bad,
                            marginBottom: 4,
                        }}
                    >
                        cross-origin → blanked
                    </div>
                    <canvas
                        ref={setCrossOriginRef}
                        width={220}
                        height={130}
                        style={CANVAS_STYLE}
                    >
                        <div
                            ref={crossElementRef}
                            style={{
                                width: 220,
                                height: 130,
                                background: '#27ae60',
                            }}
                        >
                            <iframe
                                title="cross-origin"
                                src="https://example.com/"
                                width={220}
                                height={130}
                                style={{ border: 0 }}
                            />
                        </div>
                    </canvas>
                </div>
            </div>
        </DemoFrameComp>
    );
}

export function VideoComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const [paintCount, paintCountRef] = useThrottledCounter();
    const [status, setStatus] = useState('pick a video file');

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
            const element = elementRef.current;
            runDrawGuarded(() => {
                context.reset();
                context.drawElementImage(element, 0, 0);
            });
        };
        canvas.requestPaint();
        return () => {
            canvas.onpaint = null;
        };
    }, []);

    useAppEffect(() => {
        return () => {
            if (objectUrlRef.current !== null) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, []);

    return (
        <DemoFrameComp
            summary={
                'A playing <video> inside the subtree is captured live, and ' +
                'each decoded frame fires a paint event — verified against a ' +
                'drawImage(video) control.'
            }
            controls={
                <>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (
                                file === undefined ||
                                videoRef.current === null
                            ) {
                                return;
                            }
                            if (objectUrlRef.current !== null) {
                                URL.revokeObjectURL(objectUrlRef.current);
                            }
                            objectUrlRef.current = URL.createObjectURL(file);
                            videoRef.current.src = objectUrlRef.current;
                            videoRef.current.play().catch((error: unknown) => {
                                setStatus(toErrorMessage(error));
                            });
                            setStatus(file.name);
                        }}
                        style={{ fontSize: 11, color: COLOR.muted }}
                    />
                    <BadgeComp label={`paints: ${paintCount}`} tone="good" />
                    <BadgeComp label={status} />
                </>
            }
            notes="Paint fires at the video's frame rate, not the display's — a 10 fps clip produced ~10 paints/second."
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <div
                    ref={elementRef}
                    style={{
                        width: PREVIEW_WIDTH,
                        height: PREVIEW_HEIGHT,
                        background: '#000',
                        position: 'relative',
                    }}
                >
                    <video
                        ref={videoRef}
                        width={PREVIEW_WIDTH}
                        height={PREVIEW_HEIGHT}
                        muted
                        loop
                        playsInline
                    />
                    <div
                        style={{
                            position: 'absolute',
                            left: 10,
                            bottom: 8,
                            color: '#fff',
                            font: '14px sans-serif',
                            textShadow: '1px 1px 3px #000',
                        }}
                    >
                        HTML overlay on top of the video
                    </div>
                </div>
            </canvas>
        </DemoFrameComp>
    );
}
