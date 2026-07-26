/**
 * Frame-time benchmark.
 */
import { useRef, useState } from 'react';

import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    withSlideSpace,
    centeredScale,
} from './htmlInCanvasHelpers';
import { useHicCanvas } from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';

type BenchmarkResultType = {
    name: string;
    medianMillisecond: number;
    droppedCount: number;
    frameCount: number;
};

export function BenchmarkComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [resultList, setResultList] = useState<BenchmarkResultType[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [repetition, setRepetition] = useState(0);

    const run = async () => {
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
        setIsRunning(true);
        setResultList([]);

        context.reset();
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(element, 0, 0);
        });
        const bitmap = await createImageBitmap(canvas);
        const snapshot = canvas.captureElementImage(element);

        const patternList: { name: string; render: (index: number) => void }[] =
            [
                { name: 'idle (control)', render: () => {} },
                {
                    name: 'live element, identity',
                    render: () => {
                        context.reset();
                        withSlideSpace(context, canvas, () => {
                            context.drawElementImage(element, 0, 0);
                        });
                    },
                },
                {
                    name: 'live element, alpha',
                    render: (index) => {
                        context.reset();
                        context.globalAlpha = 0.2 + (0.8 * (index % 60)) / 60;
                        withSlideSpace(context, canvas, () => {
                            context.drawElementImage(element, 0, 0);
                        });
                        context.globalAlpha = 1;
                    },
                },
                {
                    name: 'live element, scale',
                    render: (index) => {
                        context.reset();
                        withSlideSpace(context, canvas, () => {
                            context.save();
                            centeredScale(
                                context,
                                0.8 + (0.4 * (index % 60)) / 60,
                            );
                            context.drawElementImage(element, 0, 0);
                            context.restore();
                        });
                    },
                },
                {
                    name: 'ElementImage, scale',
                    render: (index) => {
                        context.reset();
                        withSlideSpace(context, canvas, () => {
                            context.save();
                            centeredScale(
                                context,
                                0.8 + (0.4 * (index % 60)) / 60,
                            );
                            context.drawElementImage(
                                snapshot,
                                0,
                                0,
                                SLIDE_WIDTH,
                                SLIDE_HEIGHT,
                            );
                            context.restore();
                        });
                    },
                },
                {
                    name: 'cached bitmap, scale',
                    render: (index) => {
                        const scale = 0.8 + (0.4 * (index % 60)) / 60;
                        context.reset();
                        context.save();
                        context.translate(canvas.width / 2, canvas.height / 2);
                        context.scale(scale, scale);
                        context.translate(
                            -canvas.width / 2,
                            -canvas.height / 2,
                        );
                        context.drawImage(
                            bitmap,
                            0,
                            0,
                            canvas.width,
                            canvas.height,
                        );
                        context.restore();
                    },
                },
                {
                    name: 'two live elements, crossfade',
                    render: (index) => {
                        const ratio = (index % 60) / 60;
                        context.reset();
                        withSlideSpace(context, canvas, () => {
                            context.globalAlpha = 1 - ratio;
                            context.drawElementImage(element, 0, 0);
                            context.globalAlpha = ratio;
                            context.drawElementImage(element, 0, 0);
                            context.globalAlpha = 1;
                        });
                    },
                },
                {
                    name: 'blur filter',
                    render: (index) => {
                        context.reset();
                        context.filter = `blur(${(index % 12) + 1}px)`;
                        withSlideSpace(context, canvas, () => {
                            context.drawElementImage(element, 0, 0);
                        });
                        context.filter = 'none';
                    },
                },
            ];

        const measure = (
            render: (index: number) => void,
            frameCount: number,
        ) => {
            return new Promise<BenchmarkResultType['medianMillisecond'][]>(
                (resolve) => {
                    const deltaList: number[] = [];
                    let lastTime: number | null = null;
                    let index = 0;
                    const step = (timestamp: number) => {
                        if (lastTime !== null) {
                            deltaList.push(timestamp - lastTime);
                        }
                        lastTime = timestamp;
                        render(index);
                        index += 1;
                        if (index < frameCount) {
                            requestAnimationFrame(step);
                        } else {
                            resolve(deltaList);
                        }
                    };
                    requestAnimationFrame(step);
                },
            );
        };

        const collected: BenchmarkResultType[] = [];
        for (let round = 0; round < 2; round += 1) {
            for (const pattern of patternList) {
                const deltaList = await measure(pattern.render, 60);
                const sorted = [...deltaList].sort((a, b) => {
                    return a - b;
                });
                const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
                const result: BenchmarkResultType = {
                    name: `${pattern.name} — pass ${round + 1}`,
                    medianMillisecond: Number(median.toFixed(1)),
                    droppedCount: deltaList.filter((value) => {
                        return value > 20;
                    }).length,
                    frameCount: deltaList.length,
                };
                collected.push(result);
                setResultList([...collected]);
            }
        }
        snapshot.close();
        bitmap.close();
        setIsRunning(false);
        setRepetition(repetition + 1);
    };

    return (
        <DemoFrameComp
            summary={
                'The benchmark from the research, runnable here. Two passes of ' +
                'each pattern, 60 frames each — the first pass shows the cold ' +
                'cost, the second the warm one.'
            }
            controls={
                <>
                    <ButtonComp
                        label={isRunning ? 'running…' : 'Run benchmark'}
                        onClick={() => {
                            if (!isRunning) {
                                run().catch(() => {
                                    setIsRunning(false);
                                });
                            }
                        }}
                        isActive={isRunning}
                    />
                    <BadgeComp label={`runs: ${repetition}`} />
                </>
            }
            notes={
                <>
                    16.7 ms = 60 fps. What matters for us is the <b>dropped</b>{' '}
                    column on pass 1 versus pass 2: cold animation hitches, warm
                    animation does not. This machine is not the target — re-run
                    it on the weakest machine you support before trusting any of
                    it.
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
                    heading="Benchmark"
                    lines={['1920 x 1080 subtree', 'ព្រះគុណ · 中文 · عربى']}
                />
            </canvas>
            <table
                style={{
                    marginTop: 8,
                    borderCollapse: 'collapse',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    width: '100%',
                }}
            >
                <tbody>
                    <tr style={{ color: COLOR.muted }}>
                        <td style={{ padding: '2px 6px' }}>pattern</td>
                        <td style={{ padding: '2px 6px' }}>median</td>
                        <td style={{ padding: '2px 6px' }}>dropped</td>
                    </tr>
                    {resultList.map((result) => {
                        return (
                            <tr key={result.name}>
                                <td
                                    style={{
                                        padding: '2px 6px',
                                        borderTop: `1px solid ${COLOR.border}`,
                                    }}
                                >
                                    {result.name}
                                </td>
                                <td
                                    style={{
                                        padding: '2px 6px',
                                        borderTop: `1px solid ${COLOR.border}`,
                                        color:
                                            result.medianMillisecond <= 17
                                                ? COLOR.good
                                                : COLOR.warn,
                                    }}
                                >
                                    {result.medianMillisecond} ms
                                </td>
                                <td
                                    style={{
                                        padding: '2px 6px',
                                        borderTop: `1px solid ${COLOR.border}`,
                                        color:
                                            result.droppedCount === 0
                                                ? COLOR.good
                                                : COLOR.bad,
                                    }}
                                >
                                    {result.droppedCount} / {result.frameCount}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </DemoFrameComp>
    );
}
