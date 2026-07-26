/**
 * How canvas children are laid out and measured.
 */
import { useRef, useState } from 'react';

import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
} from './htmlInCanvasHelpers';
import { useHicCanvas, useAfterRenderingUpdate } from './htmlInCanvasHooks';
import { DemoFrameComp, CANVAS_STYLE } from './htmlInCanvasUiComps';

export function LayoutRulesComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const firstRef = useRef<HTMLDivElement | null>(null);
    const secondRef = useRef<HTMLDivElement | null>(null);
    const absoluteRef = useRef<HTMLDivElement | null>(null);
    const percentRef = useRef<HTMLDivElement | null>(null);
    const [rows, setRows] = useState<string[][]>([]);

    useAfterRenderingUpdate(() => {
        const canvas = canvasRef.current;
        if (canvas === null) {
            return;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const describe = (
            label: string,
            element: HTMLDivElement | null,
        ): string[] => {
            if (element === null) {
                return [label, '-', '-'];
            }
            const rect = element.getBoundingClientRect();
            return [
                label,
                `${Math.round(rect.left - canvasRect.left)}, ${Math.round(
                    rect.top - canvasRect.top,
                )}`,
                `${Math.round(rect.width)} x ${Math.round(rect.height)}`,
            ];
        };
        setRows([
            ['child', 'offset from canvas', 'size'],
            describe('#1 plain 300x100', firstRef.current),
            describe('#2 plain 300x100', secondRef.current),
            describe('#3 absolute 500,200', absoluteRef.current),
            describe('#4 width:100% height:50%', percentRef.current),
            [
                'canvas',
                'backing ' + canvas.width + ' x ' + canvas.height,
                'css ' +
                    Math.round(canvasRect.width) +
                    ' x ' +
                    Math.round(canvasRect.height),
            ],
        ]);
        // The children all live at the origin; the layout you actually see is
        // the one applied here, at draw time. Explicit dw/dh is used so each
        // child lands at its own CSS size in backing pixels — without it the
        // draw is scaled by the canvas's backing/CSS ratio (4.28x here).
        const context = getHicContext(canvas);
        if (context === null) {
            return;
        }
        const placementList: [HTMLDivElement | null, number, number][] = [
            [percentRef.current, 0, 0],
            [firstRef.current, 80, 200],
            [secondRef.current, 500, 480],
            [absoluteRef.current, 920, 760],
        ];
        context.reset();
        for (const [element, left, top] of placementList) {
            if (element === null) {
                continue;
            }
            const rect = element.getBoundingClientRect();
            context.drawElementImage(
                element,
                left,
                top,
                rect.width,
                rect.height,
            );
        }
    }, []);

    return (
        <DemoFrameComp
            summary={
                'Three layout rules that decide how a slide model maps onto ' +
                'canvas children, measured live from the DOM. This canvas has ' +
                'a 1920x1080 backing store shown at 448px wide, so the CSS box ' +
                'and the backing store disagree on purpose.'
            }
            notes={
                <>
                    <b>1.</b> Every direct child is placed at the canvas’s
                    content origin and stacks — even one with{' '}
                    <code>position:absolute; left:500px</code>. Position is
                    something you apply at <em>draw</em> time with{' '}
                    <code>ctx.translate</code> or dx/dy, which suits{' '}
                    <code>CanvasItem</code>’s stored left/top exactly.
                    <br />
                    <b>2.</b> Children live in the canvas’s <em>CSS pixel</em>{' '}
                    space: percentages resolve against the CSS box, not the
                    backing store, so <code>width:100%</code> here is 448px, not
                    1920px — that is the thin yellow strip.
                    <br />
                    <b>3.</b> dx/dy are ordinary backing-store coordinates, but
                    the element’s <em>size</em> is multiplied by backing ÷ CSS
                    (4.28x here) so it rasterizes at the canvas’s device
                    resolution. Pass explicit dw/dh — as this demo does — when
                    you want exact geometry. To author in 1920x1080 units, give
                    the canvas a CSS size of 1920x1080 and scale the canvas
                    element itself.
                </>
            }
        >
            <canvas
                ref={setCanvasRef}
                width={SLIDE_WIDTH}
                height={SLIDE_HEIGHT}
                style={{
                    ...CANVAS_STYLE,
                    width: PREVIEW_WIDTH,
                    height: PREVIEW_HEIGHT,
                }}
            >
                <div
                    ref={firstRef}
                    style={{
                        width: 300,
                        height: 100,
                        background: '#c0392b',
                    }}
                />
                <div
                    ref={secondRef}
                    style={{
                        width: 300,
                        height: 100,
                        background: '#2980b9',
                    }}
                />
                <div
                    ref={absoluteRef}
                    style={{
                        position: 'absolute',
                        left: 500,
                        top: 200,
                        width: 300,
                        height: 100,
                        background: '#27ae60',
                    }}
                />
                <div
                    ref={percentRef}
                    style={{
                        width: '100%',
                        height: '50%',
                        background: 'rgba(255,255,0,0.3)',
                    }}
                />
            </canvas>
            <table
                style={{
                    marginTop: 8,
                    borderCollapse: 'collapse',
                    fontFamily: 'monospace',
                    fontSize: 11,
                }}
            >
                <tbody>
                    {rows.map((row, rowIndex) => {
                        return (
                            <tr key={row[0]}>
                                {row.map((cell) => {
                                    return (
                                        <td
                                            key={cell}
                                            style={{
                                                border: `1px solid ${COLOR.border}`,
                                                padding: '2px 8px',
                                                color:
                                                    rowIndex === 0
                                                        ? COLOR.muted
                                                        : COLOR.text,
                                            }}
                                        >
                                            {cell}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </DemoFrameComp>
    );
}
