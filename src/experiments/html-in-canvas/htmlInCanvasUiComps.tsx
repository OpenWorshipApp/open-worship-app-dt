/**
 * Small presentational pieces shared by the HTML-in-Canvas demos.
 */
import { type CSSProperties, type ReactNode, type RefObject } from 'react';

import { SLIDE_WIDTH, SLIDE_HEIGHT, COLOR } from './htmlInCanvasHelpers';

export function DemoFrameComp({
    summary,
    controls,
    notes,
    children,
}: {
    summary: string;
    controls?: ReactNode;
    notes?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: COLOR.muted, fontSize: 12, lineHeight: 1.5 }}>
                {summary}
            </div>
            {controls === undefined ? null : (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    {controls}
                </div>
            )}
            <div style={{ overflow: 'hidden' }}>{children}</div>
            {notes === undefined ? null : (
                <div
                    style={{
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: COLOR.muted,
                        borderLeft: `2px solid ${COLOR.border}`,
                        paddingLeft: 8,
                    }}
                >
                    {notes}
                </div>
            )}
        </div>
    );
}

export function ButtonComp({
    label,
    onClick,
    isActive = false,
}: {
    label: string;
    onClick: () => void;
    isActive?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background: isActive ? COLOR.accent : COLOR.panelSoft,
                color: isActive ? '#04121f' : COLOR.text,
                border: `1px solid ${isActive ? COLOR.accent : COLOR.border}`,
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );
}

export function SliderComp({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
}) {
    return (
        <label
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: COLOR.muted,
            }}
        >
            {label}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => {
                    onChange(Number(event.target.value));
                }}
                style={{ width: 110 }}
            />
            <span style={{ color: COLOR.text, minWidth: 34 }}>{value}</span>
        </label>
    );
}

export function BadgeComp({
    label,
    tone = 'muted',
}: {
    label: string;
    tone?: 'muted' | 'good' | 'bad' | 'warn';
}) {
    const toneColor = {
        muted: COLOR.muted,
        good: COLOR.good,
        bad: COLOR.bad,
        warn: COLOR.warn,
    }[tone];
    return (
        <span
            style={{
                border: `1px solid ${toneColor}`,
                color: toneColor,
                borderRadius: 3,
                padding: '1px 6px',
                fontSize: 11,
                fontFamily: 'monospace',
            }}
        >
            {label}
        </span>
    );
}

export const CANVAS_STYLE: CSSProperties = {
    background: '#000',
    border: `1px solid ${COLOR.border}`,
    borderRadius: 4,
    display: 'block',
};

/**
 * Everything drawn has to be an *immediate* child of the canvas — wrapping the
 * slides in a host `<div>` makes them grandchildren and every draw throws
 * `Only immediate children of the <canvas> element can be passed to
 * DrawElementImage`. The children are laid out at their own size (1920x1080)
 * while the canvas box is only a few hundred px, so the demo pane clips
 * instead (an `overflow: hidden` ancestor does not affect drawing — see
 * README 4.2).
 */

export function SlideComp({
    elementRef,
    background = 'linear-gradient(160deg, #0b3d2e, #071a14)',
    heading,
    lines = [],
    children,
}: {
    elementRef?: RefObject<HTMLDivElement | null>;
    background?: string;
    heading?: string;
    lines?: string[];
    children?: ReactNode;
}) {
    return (
        <div
            ref={elementRef}
            style={{
                position: 'relative',
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                background,
                overflow: 'hidden',
                fontFamily: 'serif',
                color: '#fff',
            }}
        >
            {heading === undefined ? null : (
                <div
                    style={{
                        position: 'absolute',
                        left: 100,
                        top: 130,
                        fontSize: 108,
                        fontWeight: 700,
                        textShadow: '4px 4px 16px #000',
                    }}
                >
                    {heading}
                </div>
            )}
            {lines.map((line, index) => {
                return (
                    <div
                        key={line}
                        style={{
                            position: 'absolute',
                            left: 100,
                            top: 330 + index * 150,
                            fontSize: 84,
                            textShadow: '3px 3px 12px #000',
                        }}
                    >
                        {line}
                    </div>
                );
            })}
            {children}
        </div>
    );
}

const SEMANTICS_KEYFRAMES = `
@keyframes hic-demo-spin-fade {
    from { opacity: 1; transform: translateX(0) scale(1); }
    to   { opacity: 0.15; transform: translateX(80px) scale(0.75); }
}
@keyframes hic-demo-hue {
    from { background: #c0392b; }
    to   { background: #2980b9; }
}
@keyframes hic-demo-word-in {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes hic-demo-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}
`;

export function KeyframesComp() {
    return <style>{SEMANTICS_KEYFRAMES}</style>;
}
