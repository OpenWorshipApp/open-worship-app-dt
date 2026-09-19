/**
 * Per-item ("nested") animation: each canvas-item drawn on its own timeline.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import {
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    getHicContext,
    toErrorMessage,
    withSlideSpace,
    easing,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useAnimationLoop,
    useFpsMeter,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    SliderComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

type DemoItemType = {
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
    background: string;
    label: string;
};

const DEMO_ITEM_LIST: DemoItemType[] = [
    {
        id: 'item-title',
        left: 120,
        top: 160,
        width: 1400,
        height: 200,
        background: 'rgba(192,57,43,0.85)',
        label: 'title item',
    },
    {
        id: 'item-verse',
        left: 200,
        top: 440,
        width: 1300,
        height: 200,
        background: 'rgba(41,128,185,0.85)',
        label: 'verse item',
    },
    {
        id: 'item-ref',
        left: 280,
        top: 720,
        width: 1100,
        height: 200,
        background: 'rgba(39,174,96,0.85)',
        label: 'reference item',
    },
];

const ITEM_EFFECT_LIST = ['fade up', 'scale in', 'slide left', 'flip'] as const;
type ItemEffectType = (typeof ITEM_EFFECT_LIST)[number];

export function PerItemStaggerComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const backgroundRef = useRef<HTMLDivElement | null>(null);
    const itemRefList = useRef<(HTMLDivElement | null)[]>([]);
    const [effect, setEffect] = useState<ItemEffectType>('fade up');
    const [staggerMillisecond, setStaggerMillisecond] = useState(180);
    const [isPlaying, setIsPlaying] = useState(true);

    useAnimationLoop((elapsedMillisecond) => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        const cycle = 900 + staggerMillisecond * DEMO_ITEM_LIST.length + 900;
        const time = elapsedMillisecond % cycle;
        context.reset();
        withSlideSpace(context, canvas, () => {
            if (backgroundRef.current !== null) {
                context.drawElementImage(backgroundRef.current, 0, 0);
            }
            DEMO_ITEM_LIST.forEach((item, index) => {
                const element = itemRefList.current[index];
                if (element === null || element === undefined) {
                    return;
                }
                const start = index * staggerMillisecond;
                const raw = Math.min(1, Math.max(0, (time - start) / 900));
                const progress = easing.easeOut(raw);
                context.save();
                context.globalAlpha = progress;
                if (effect === 'fade up') {
                    context.translate(
                        item.left,
                        item.top + (1 - progress) * 120,
                    );
                } else if (effect === 'scale in') {
                    context.translate(
                        item.left + item.width / 2,
                        item.top + item.height / 2,
                    );
                    const scale = 0.6 + 0.4 * progress;
                    context.scale(scale, scale);
                    context.translate(-item.width / 2, -item.height / 2);
                } else if (effect === 'slide left') {
                    context.translate(
                        item.left + (1 - progress) * 700,
                        item.top,
                    );
                } else {
                    context.translate(
                        item.left + item.width / 2,
                        item.top + item.height / 2,
                    );
                    context.scale(1, Math.max(0.02, progress));
                    context.translate(-item.width / 2, -item.height / 2);
                }
                context.drawElementImage(element, 0, 0);
                context.restore();
            });
        });
    }, isPlaying);

    return (
        <DemoFrameComp
            summary={
                'Nested animation, the way that actually works: every ' +
                'canvas-item is a direct child of one canvas, and each is ' +
                'drawn with its own transform, alpha and easing — independent ' +
                'timelines with no nested canvases anywhere.'
            }
            controls={
                <>
                    {ITEM_EFFECT_LIST.map((item) => {
                        return (
                            <ButtonComp
                                key={item}
                                label={item}
                                isActive={item === effect}
                                onClick={() => {
                                    setEffect(item);
                                }}
                            />
                        );
                    })}
                    <SliderComp
                        label="stagger ms"
                        value={staggerMillisecond}
                        min={0}
                        max={500}
                        step={10}
                        onChange={setStaggerMillisecond}
                    />
                    <ButtonComp
                        label={isPlaying ? 'Pause' : 'Play'}
                        onClick={() => {
                            setIsPlaying(!isPlaying);
                        }}
                        isActive={isPlaying}
                    />
                </>
            }
            notes={
                <>
                    Item position comes from the item model at draw time (
                    <code>ctx.translate(item.left, item.top)</code>) because
                    canvas children all stack at the origin anyway — which is
                    exactly the geometry <code>CanvasItem</code> already stores.
                    Z-order is draw order.
                </>
            }
        >
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp elementRef={backgroundRef} />
                {DEMO_ITEM_LIST.map((item, index) => {
                    return (
                        <div
                            key={item.id}
                            ref={(element) => {
                                itemRefList.current[index] = element;
                            }}
                            style={{
                                width: item.width,
                                height: item.height,
                                background: item.background,
                                color: '#fff',
                                font: '76px serif',
                                padding: 40,
                                boxSizing: 'border-box',
                                borderRadius: 18,
                            }}
                        >
                            {item.label}
                        </div>
                    );
                })}
            </canvas>
        </DemoFrameComp>
    );
}

export function CachedBackgroundComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const backgroundRef = useRef<HTMLDivElement | null>(null);
    const itemRef = useRef<HTMLDivElement | null>(null);
    const bitmapRef = useRef<ImageBitmap | null>(null);
    const [isCached, setIsCached] = useState(true);
    const [fps, frameCountRef] = useFpsMeter();
    const [status, setStatus] = useState('preparing cache…');

    useAfterRenderingUpdate(() => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            backgroundRef.current === null
        ) {
            return;
        }
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(backgroundRef.current as Element, 0, 0);
        });
        createImageBitmap(canvas)
            .then((bitmap) => {
                bitmapRef.current?.close();
                bitmapRef.current = bitmap;
                setStatus(`cached ${bitmap.width}x${bitmap.height} bitmap`);
            })
            .catch((error: unknown) => {
                setStatus(toErrorMessage(error));
            });
    }, []);

    useAppEffect(() => {
        return () => {
            bitmapRef.current?.close();
            bitmapRef.current = null;
        };
    }, []);

    useAnimationLoop((elapsedMillisecond) => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        frameCountRef.current += 1;
        const phase = (elapsedMillisecond % 2400) / 2400;
        context.reset();
        const bitmap = bitmapRef.current;
        if (isCached && bitmap !== null) {
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        } else if (backgroundRef.current !== null) {
            withSlideSpace(context, canvas, () => {
                context.drawElementImage(
                    backgroundRef.current as Element,
                    0,
                    0,
                );
            });
        }
        if (itemRef.current === null) {
            return;
        }
        withSlideSpace(context, canvas, () => {
            context.save();
            context.globalAlpha =
                0.35 + 0.65 * Math.abs(Math.sin(phase * Math.PI));
            context.translate(180 + phase * 900, 700);
            context.drawElementImage(itemRef.current as Element, 0, 0);
            context.restore();
        });
    }, true);

    return (
        <DemoFrameComp
            summary={
                'The cheap way to animate one item: rasterize the static ' +
                'background once into an ImageBitmap, then per frame blit the ' +
                'bitmap and re-draw only the moving item.'
            }
            controls={
                <>
                    <ButtonComp
                        label={
                            isCached
                                ? 'background: cached bitmap'
                                : 'background: live element'
                        }
                        onClick={() => {
                            setIsCached(!isCached);
                        }}
                        isActive={isCached}
                    />
                    <BadgeComp
                        label={`${fps} fps`}
                        tone={fps >= 55 ? 'good' : 'warn'}
                    />
                    <BadgeComp label={status} />
                </>
            }
            notes={
                <>
                    In the probe runs a cached bitmap never dropped a frame,
                    while a scaled live-element draw hitched on its first pass
                    (~15 of 59 frames) before settling. Toggle the button and
                    watch the fps — on this machine both settle at 60, but the
                    cached path is the one that stays smooth cold.
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
                    elementRef={backgroundRef}
                    heading="Static background"
                    lines={['rasterized once']}
                />
                <div
                    ref={itemRef}
                    style={{
                        width: 800,
                        height: 190,
                        background: 'rgba(255,255,255,0.16)',
                        border: '4px solid rgba(255,255,255,0.5)',
                        borderRadius: 20,
                        color: '#fff',
                        font: '78px serif',
                        padding: 34,
                        boxSizing: 'border-box',
                    }}
                >
                    moving item
                </div>
            </canvas>
        </DemoFrameComp>
    );
}
