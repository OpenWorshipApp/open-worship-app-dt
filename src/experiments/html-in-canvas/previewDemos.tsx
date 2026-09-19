/**
 * Mini previews and off-screen staging.
 */
import { Fragment, useRef, useState, type CSSProperties } from 'react';

import type { HicCanvasType } from './htmlInCanvasTypes';
import {
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    toErrorMessage,
    withSlideSpace,
    centeredScale,
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
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

const PREVIEW_SIZE_LIST = [
    [200, 113],
    [128, 72],
    [80, 45],
    [48, 27],
] as const;

export function MiniPreviewComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const previewRefList = useRef<(HTMLCanvasElement | null)[]>([]);
    const [foreignError, setForeignError] = useState('not tried yet');
    const [fps, frameCountRef] = useFpsMeter();

    useAnimationLoop((elapsedMillisecond) => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (
            canvas === null ||
            context === null ||
            elementRef.current === null
        ) {
            return;
        }
        frameCountRef.current += 1;
        const phase = (elapsedMillisecond % 3000) / 3000;
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.save();
            centeredScale(context, 0.9 + 0.1 * Math.sin(phase * Math.PI * 2));
            context.drawElementImage(elementRef.current as Element, 0, 0);
            context.restore();
        });
        // Feed every preview from the source canvas bitmap, NOT by drawing the
        // element again: an element can only be drawn by its own parent canvas.
        for (const previewCanvas of previewRefList.current) {
            const previewContext = previewCanvas?.getContext('2d');
            if (previewCanvas === null || !previewContext) {
                continue;
            }
            previewContext.drawImage(
                canvas,
                0,
                0,
                previewCanvas.width,
                previewCanvas.height,
            );
        }
    }, true);

    return (
        <DemoFrameComp
            summary={
                'One slide subtree, one source canvas, many previews. The ' +
                'previews are blits of the source canvas — each additional ' +
                'preview costs a bitmap copy, not another DOM tree.'
            }
            controls={
                <>
                    <ButtonComp
                        label="try drawing the element into a preview canvas"
                        onClick={() => {
                            const previewCanvas = previewRefList.current[0];
                            const previewContext = getHicContext(
                                previewCanvas ?? null,
                            );
                            if (
                                previewContext === null ||
                                elementRef.current === null
                            ) {
                                return;
                            }
                            try {
                                previewContext.drawElementImage(
                                    elementRef.current,
                                    0,
                                    0,
                                );
                                setForeignError('no error (unexpected)');
                            } catch (error) {
                                setForeignError(toErrorMessage(error));
                            }
                        }}
                    />
                    <BadgeComp
                        label={`${fps} fps`}
                        tone={fps >= 55 ? 'good' : 'warn'}
                    />
                </>
            }
            notes={
                <>
                    The button proves the constraint: a subtree can only be
                    drawn by <em>its own</em> canvas, so a second canvas cannot
                    share the DOM — it has to copy pixels. Drawing a 1920x1080
                    subtree straight into a small canvas with the 9-arg overload
                    also works and held 60 fps.
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
                    heading="Source"
                    lines={['one DOM subtree']}
                />
            </canvas>
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 8,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                }}
            >
                {PREVIEW_SIZE_LIST.map(([width, height], index) => {
                    return (
                        <canvas
                            key={`${width}x${height}`}
                            ref={(element) => {
                                previewRefList.current[index] = element;
                            }}
                            width={width}
                            height={height}
                            style={CANVAS_STYLE}
                        />
                    );
                })}
            </div>
            <div
                style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: COLOR.bad,
                    marginTop: 6,
                }}
            >
                {foreignError}
            </div>
        </DemoFrameComp>
    );
}

const STAGING_CASE_LIST: { id: string; style: CSSProperties }[] = [
    { id: 'normal (visible)', style: {} },
    {
        id: 'overflow:hidden 1x1 host',
        style: { width: 1, height: 1, overflow: 'hidden' },
    },
    { id: 'covered by opaque div', style: { position: 'relative' } },
    { id: 'z-index: -1', style: { position: 'relative', zIndex: -1 } },
    { id: 'left: -6000px', style: { position: 'absolute', left: -6000 } },
    {
        id: 'transform: translateX(-7000px)',
        style: { transform: 'translateX(-7000px)' },
    },
    { id: 'opacity: 0', style: { opacity: 0 } },
    { id: 'clip-path: inset(100%)', style: { clipPath: 'inset(100%)' } },
    { id: 'visibility: hidden', style: { visibility: 'hidden' } },
    {
        id: 'content-visibility: hidden',
        style: { contentVisibility: 'hidden' } as CSSProperties,
    },
];

export function StagingComp() {
    const canvasRefList = useRef<(HicCanvasType | null)[]>([]);
    const elementRefList = useRef<(HTMLDivElement | null)[]>([]);
    const [resultList, setResultList] = useState<string[]>([]);

    const run = () => {
        const results = STAGING_CASE_LIST.map((_item, index) => {
            const canvas = canvasRefList.current[index] ?? null;
            const element = elementRefList.current[index] ?? null;
            const context = getHicContext(canvas);
            if (canvas === null || context === null || element === null) {
                return 'not mounted';
            }
            try {
                context.reset();
                context.drawElementImage(element, 0, 0);
                const data = context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                ).data;
                let painted = 0;
                for (let offset = 3; offset < data.length; offset += 4) {
                    if (data[offset] !== 0) {
                        painted += 1;
                    }
                }
                return painted > 0 ? `DREW (${painted}px)` : 'EMPTY (no throw)';
            } catch (error) {
                return `THREW ${toErrorMessage(error)}`;
            }
        });
        setResultList(results);
    };

    useAfterRenderingUpdate(run, []);

    return (
        <DemoFrameComp
            summary={
                'Can you pre-render a slide off-screen? Only if it is still ' +
                'painted. This runs every hiding technique live and reports ' +
                'what each one does to the draw.'
            }
            controls={<ButtonComp label="Run again" onClick={run} />}
            notes={
                <>
                    The <b>EMPTY (no throw)</b> rows are the dangerous ones — a
                    blank frame with no exception to tell you why. Safe staging
                    means keeping the canvas in the viewport and hiding it by
                    clipping or covering.
                </>
            }
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '2px 10px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    alignItems: 'center',
                }}
            >
                {STAGING_CASE_LIST.map((item, index) => {
                    const result = resultList[index] ?? '-';
                    const tone = result.startsWith('DREW')
                        ? COLOR.good
                        : result.startsWith('EMPTY')
                          ? COLOR.warn
                          : COLOR.bad;
                    return (
                        <Fragment key={item.id}>
                            <div style={{ color: COLOR.text }}>{item.id}</div>
                            <div style={{ color: tone }}>{result}</div>
                        </Fragment>
                    );
                })}
            </div>
            <div style={{ position: 'relative', height: 44, marginTop: 10 }}>
                {STAGING_CASE_LIST.map((item, index) => {
                    return (
                        <div
                            key={item.id}
                            style={{
                                position: 'absolute',
                                left: index * 42,
                                top: 0,
                                ...item.style,
                            }}
                        >
                            <canvas
                                ref={(element) => {
                                    element?.setAttribute('layoutsubtree', '');
                                    canvasRefList.current[index] =
                                        element as HicCanvasType | null;
                                }}
                                width={38}
                                height={38}
                                style={CANVAS_STYLE}
                            >
                                <div
                                    ref={(element) => {
                                        elementRefList.current[index] = element;
                                    }}
                                    style={{
                                        width: 38,
                                        height: 38,
                                        background: '#e74c3c',
                                    }}
                                />
                            </canvas>
                            {item.id === 'covered by opaque div' ? (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        width: 38,
                                        height: 38,
                                        background: '#000',
                                    }}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </DemoFrameComp>
    );
}
