// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const appProviderMock = vi.hoisted(() => {
    return { isPageScreen: false, isPagePresenter: false };
});

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

import {
    applyKeyboardOutline,
    applyOverlayBoxStyle,
    applyOverlayFocusability,
    buildSpotlightBackground,
    checkIsKeyboardTarget,
    clampNumber,
    forwardToOwnScreenOutput,
    genFrameScheduler,
    OVERLAY_KEYBOARD_OUTLINE_COLOR,
    paintStroke,
    toAlphaHex,
    toNativePoint,
} from './screenOverlayHelpers';

const screenManagerBase = { screenId: 3, width: 1920, height: 1080 } as any;

// What `paintStroke` does to a 2D context, in order, plus the state it set.
function genRecordingContext() {
    const calls: string[] = [];
    const record = (name: string) => {
        return (...args: number[]) => {
            calls.push(`${name}(${args.join(',')})`);
        };
    };
    const ctx = {
        calls,
        globalCompositeOperation: 'source-over',
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        lineCap: '',
        lineJoin: '',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        save: record('save'),
        restore: record('restore'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        quadraticCurveTo: record('quadraticCurveTo'),
        arc: (x: number, y: number, radius: number) => {
            calls.push(`arc(${x},${y},${radius})`);
        },
        fill: record('fill'),
        stroke: record('stroke'),
    };
    return ctx;
}

function genStroke(overrides: Record<string, unknown> = {}) {
    return {
        points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
        ],
        color: '#ff0000ff',
        size: 10,
        isEraser: false,
        is3D: false,
        isDots: false,
        isStraight: false,
        ...overrides,
    } as any;
}

beforeEach(() => {
    appProviderMock.isPageScreen = false;
    appProviderMock.isPagePresenter = false;
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('number helpers', () => {
    test('clampNumber keeps a value inside its range', () => {
        expect(clampNumber(5, 0, 10)).toBe(5);
        expect(clampNumber(-1, 0, 10)).toBe(0);
        expect(clampNumber(11, 0, 10)).toBe(10);
    });

    test('toAlphaHex turns 0..100 into a two-digit alpha', () => {
        expect(toAlphaHex(0)).toBe('00');
        expect(toAlphaHex(100)).toBe('ff');
        expect(toAlphaHex(50)).toBe('80');
        expect(toAlphaHex(2)).toBe('05');
        expect(toAlphaHex(150)).toBe('ff');
        expect(toAlphaHex(-20)).toBe('00');
    });
});

describe('overlay box', () => {
    test('pinned over the screen, taking the pointer only while armed', () => {
        const div = document.createElement('div');
        applyOverlayBoxStyle(div, screenManagerBase, false);
        expect(div.style.position).toBe('absolute');
        expect(div.style.width).toBe('1920px');
        expect(div.style.height).toBe('1080px');
        expect(div.style.overflow).toBe('hidden');
        expect(div.style.pointerEvents).toBe('none');

        applyOverlayBoxStyle(div, screenManagerBase, true);
        expect(div.style.pointerEvents).toBe('auto');
    });

    test('focusable only when armed on the presenter side', () => {
        const element = document.createElement('div');
        applyOverlayFocusability(element, true);
        expect(element.tabIndex).toBe(0);
        applyOverlayFocusability(element, false);
        expect(element.tabIndex).toBe(-1);

        appProviderMock.isPageScreen = true;
        applyOverlayFocusability(element, true);
        expect(element.tabIndex).toBe(-1);
    });

    test('the keyboard ring scales with the screen width', () => {
        const element = document.createElement('div');
        applyKeyboardOutline(element, true, 1920);
        expect(element.style.outline).toBe(
            `4px solid ${OVERLAY_KEYBOARD_OUTLINE_COLOR}`,
        );
        expect(element.style.outlineOffset).toBe('-4px');

        // Never thinner than 2px.
        applyKeyboardOutline(element, true, 320);
        expect(element.style.outlineOffset).toBe('-2px');

        applyKeyboardOutline(element, false, 1920);
        expect(element.style.outline).toBe('none');
        expect(element.style.outlineOffset).toBe('0');
    });
});

describe('checkIsKeyboardTarget', () => {
    test('nothing, or something detached, never owns the keyboard', () => {
        expect(checkIsKeyboardTarget(null)).toBe(false);
        const detached = document.createElement('div');
        detached.tabIndex = 0;
        expect(checkIsKeyboardTarget(detached)).toBe(false);
    });

    test('the focused overlay owns it only while the window has focus', () => {
        const element = document.createElement('div');
        element.tabIndex = 0;
        document.body.appendChild(element);
        const other = document.createElement('div');
        other.tabIndex = 0;
        document.body.appendChild(other);
        element.focus();
        const hasFocusSpy = vi.spyOn(document, 'hasFocus');

        hasFocusSpy.mockReturnValue(true);
        expect(checkIsKeyboardTarget(element)).toBe(true);
        expect(checkIsKeyboardTarget(other)).toBe(false);

        // A key pressed in another app must not count.
        hasFocusSpy.mockReturnValue(false);
        expect(checkIsKeyboardTarget(element)).toBe(false);
    });

    test('inside a mini screen, focus is read off its shadow root', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const element = document.createElement('div');
        element.tabIndex = 0;
        shadowRoot.appendChild(element);
        element.focus();
        vi.spyOn(document, 'hasFocus').mockReturnValue(true);

        // The document only ever sees the host.
        expect(document.activeElement).toBe(host);
        expect(checkIsKeyboardTarget(element)).toBe(true);
    });
});

describe('toNativePoint', () => {
    test('maps a pointer on the scaled preview to native screen px', () => {
        const rect = { left: 100, top: 50, width: 480, height: 270 } as DOMRect;
        expect(toNativePoint(rect, 340, 185, screenManagerBase)).toEqual({
            x: 960,
            y: 540,
        });
    });

    test('no box, or an empty one, has no point', () => {
        expect(toNativePoint(null, 1, 1, screenManagerBase)).toBeNull();
        expect(
            toNativePoint(
                { left: 0, top: 0, width: 0, height: 10 } as DOMRect,
                1,
                1,
                screenManagerBase,
            ),
        ).toBeNull();
        expect(
            toNativePoint(
                { left: 0, top: 0, width: 10, height: 0 } as DOMRect,
                1,
                1,
                screenManagerBase,
            ),
        ).toBeNull();
    });
});

describe('forwardToOwnScreenOutput', () => {
    test('the presenter mirrors a group update to its own output window', () => {
        const sendScreenMessage = vi.fn();
        const base = { screenId: 4, sendScreenMessage } as any;

        forwardToOwnScreenOutput(base, 'draw', { strokes: [] });
        expect(sendScreenMessage).not.toHaveBeenCalled();

        appProviderMock.isPagePresenter = true;
        forwardToOwnScreenOutput(base, 'draw', { strokes: [] });
        // A RAW send: no sync group, so it cannot bounce back.
        expect(sendScreenMessage).toHaveBeenCalledWith(
            { screenId: 4, type: 'draw', data: { strokes: [] } },
            false,
        );
    });
});

describe('paintStroke', () => {
    test('an empty stroke paints nothing at all', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ points: [] }), true);
        expect(ctx.calls).toEqual([]);
    });

    test('a freehand stroke is a polyline in fast mode', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke(), false);
        expect(ctx.calls).toEqual([
            'save()',
            'beginPath()',
            'moveTo(0,0)',
            'lineTo(10,10)',
            'lineTo(20,0)',
            'stroke()',
            'restore()',
        ]);
        expect(ctx.strokeStyle).toBe('#ff0000ff');
        expect(ctx.lineWidth).toBe(10);
        expect(ctx.lineCap).toBe('round');
        expect(ctx.lineJoin).toBe('round');
        expect(ctx.globalCompositeOperation).toBe('source-over');
        expect(ctx.shadowBlur).toBe(0);
    });

    test('high quality smooths through the midpoints', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke(), true);
        expect(ctx.calls).toEqual([
            'save()',
            'beginPath()',
            'moveTo(0,0)',
            'quadraticCurveTo(10,10,15,5)',
            'lineTo(20,0)',
            'stroke()',
            'restore()',
        ]);
    });

    test('two points in high quality are still a straight segment', () => {
        const ctx = genRecordingContext();
        paintStroke(
            ctx as any,
            genStroke({
                points: [
                    { x: 1, y: 2 },
                    { x: 3, y: 4 },
                ],
            }),
            true,
        );
        expect(ctx.calls).toContain('lineTo(3,4)');
        expect(ctx.calls.some((call) => call.startsWith('quadratic'))).toBe(
            false,
        );
    });

    test('a single click is a dot', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ points: [{ x: 5, y: 6 }] }), false);
        expect(ctx.calls).toEqual([
            'save()',
            'beginPath()',
            'arc(5,6,5)',
            'fill()',
            'restore()',
        ]);
        expect(ctx.fillStyle).toBe('#ff0000ff');
    });

    test('a dotted stroke stamps a dot on every point', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ isDots: true }), true);
        expect(ctx.calls.filter((call) => call.startsWith('arc'))).toEqual([
            'arc(0,0,5)',
            'arc(10,10,5)',
            'arc(20,0,5)',
        ]);
        expect(ctx.calls.filter((call) => call === 'fill()')).toHaveLength(3);
        expect(ctx.calls).not.toContain('stroke()');
    });

    test('a straight stroke joins only the first and last points', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ isStraight: true }), true);
        expect(ctx.calls).toEqual([
            'save()',
            'beginPath()',
            'moveTo(0,0)',
            'lineTo(20,0)',
            'stroke()',
            'restore()',
        ]);
    });

    test('a 3D stroke casts a shadow sized by the brush', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ is3D: true, size: 20 }), false);
        expect(ctx.shadowColor).toBe('rgba(0, 0, 0, 0.55)');
        expect(ctx.shadowBlur).toBe(18);
        expect(ctx.shadowOffsetX).toBeCloseTo(3.6);
        expect(ctx.shadowOffsetY).toBeCloseTo(3.6);

        // A thin brush still gets a visible shadow.
        const thin = genRecordingContext();
        paintStroke(thin as any, genStroke({ is3D: true, size: 1 }), false);
        expect(thin.shadowBlur).toBe(2);
        expect(thin.shadowOffsetX).toBe(1);
    });

    test('the eraser rubs out whatever is under it, fully opaque', () => {
        const ctx = genRecordingContext();
        paintStroke(ctx as any, genStroke({ isEraser: true }), false);
        expect(ctx.globalCompositeOperation).toBe('destination-out');
        expect(ctx.strokeStyle).toBe('#000');
        expect(ctx.fillStyle).toBe('#000');
    });
});

describe('buildSpotlightBackground', () => {
    const mask = {
        point: { x: 100, y: 50 },
        size: 200,
        dimColor: '#000000',
        dimOpacity: 100,
        edgeBlur: 20,
        isContrast: false,
    };

    test('clears the circle and dims everything around it', () => {
        expect(buildSpotlightBackground(mask)).toBe(
            'radial-gradient(circle 100px at 100px 50px, #00000000 0,' +
                ' #00000000 80%, #000000ff 100%)',
        );
    });

    test('contrast dims the circle instead', () => {
        expect(
            buildSpotlightBackground({
                ...mask,
                dimOpacity: 50,
                edgeBlur: 0,
                isContrast: true,
            }),
        ).toBe(
            'radial-gradient(circle 100px at 100px 50px, #00000080 0,' +
                ' #00000080 100%, #00000000 100%)',
        );
    });
});

describe('genFrameScheduler', () => {
    test('coalesces repaints onto one animation frame', () => {
        const original = globalThis.requestAnimationFrame;
        const frames: (() => void)[] = [];
        (globalThis as any).requestAnimationFrame = (
            callback: FrameRequestCallback,
        ) => {
            frames.push(() => {
                callback(0);
            });
            return frames.length;
        };
        try {
            let runCount = 0;
            const schedule = genFrameScheduler(() => {
                runCount += 1;
            });

            schedule();
            schedule();
            schedule();
            expect(frames).toHaveLength(1);
            expect(runCount).toBe(0);

            frames[0]();
            expect(runCount).toBe(1);

            // The next move after the frame schedules a new one.
            schedule();
            expect(frames).toHaveLength(2);
            frames[1]();
            expect(runCount).toBe(2);
        } finally {
            globalThis.requestAnimationFrame = original;
        }
    });

    test('runs inline where there is no animation frame', () => {
        const original = globalThis.requestAnimationFrame;
        (globalThis as any).requestAnimationFrame = undefined;
        try {
            let runCount = 0;
            const schedule = genFrameScheduler(() => {
                runCount += 1;
            });
            schedule();
            schedule();
            expect(runCount).toBe(2);
        } finally {
            globalThis.requestAnimationFrame = original;
        }
    });
});
