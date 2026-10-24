// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import {
    CanvasRulerComp,
    CanvasRulerCornerComp,
    RULER_THICKNESS,
} from './CanvasRulerComp';

const context = {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 0,
};
let host: HTMLDivElement;
let root: Root;
let getContext: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('devicePixelRatio', 2);
    for (const value of Object.values(context)) {
        if (typeof value === 'function' && 'mockClear' in value)
            value.mockClear();
    }
    getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(context as never);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    getContext.mockRestore();
    vi.unstubAllGlobals();
});

describe('canvas rulers', () => {
    it('draws a scaled horizontal ruler around the canvas center and creates a guide', async () => {
        const onCreateGuide = vi.fn();
        await act(async () =>
            root.render(
                <CanvasRulerComp
                    isHorizontal
                    logicalLength={100}
                    scale={1}
                    isDarkTheme={false}
                    onCreateGuide={onCreateGuide}
                />,
            ),
        );
        const canvas = host.querySelector('canvas')!;
        expect(RULER_THICKNESS).toBe(18);
        expect(canvas.width).toBe(200);
        expect(canvas.height).toBe(36);
        expect(canvas.style.width).toBe('100px');
        expect(canvas.style.height).toBe('18px');
        expect(canvas.style.cursor).toBe('row-resize');
        expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, 100, 18);
        expect(context.fillText.mock.calls.map((call) => call[0])).toContain(
            '0',
        );
        expect(context.stroke).toHaveBeenCalled();

        const event = new Event('pointerdown', {
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperties(event, {
            clientX: { value: 73 },
            clientY: { value: 21 },
        });
        const parentListener = vi.fn();
        document.body.addEventListener('pointerdown', parentListener);
        await act(async () => canvas.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(true);
        expect(parentListener).not.toHaveBeenCalled();
        expect(onCreateGuide).toHaveBeenCalledWith(73, 21);
        document.body.removeEventListener('pointerdown', parentListener);
    });

    it('draws vertical labels rotated and uses the dark-theme corner color', async () => {
        await act(async () =>
            root.render(
                <>
                    <CanvasRulerCornerComp isDarkTheme />
                    <CanvasRulerComp
                        isHorizontal={false}
                        logicalLength={80}
                        scale={0.5}
                        isDarkTheme
                        onCreateGuide={vi.fn()}
                    />
                </>,
            ),
        );
        const canvas = host.querySelector('canvas')!;
        expect(canvas.width).toBe(36);
        expect(canvas.height).toBe(80);
        expect(canvas.style.cursor).toBe('col-resize');
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, 18, 40);
        expect(context.rotate).toHaveBeenCalledWith(-Math.PI / 2);
        expect(context.save).toHaveBeenCalled();
        expect(context.restore).toHaveBeenCalled();
        expect(host.querySelector('div')?.style.background).toBe(
            'rgba(43, 43, 43, 0.7)',
        );
    });

    it('skips invalid scale and tolerates a missing drawing context', async () => {
        await act(async () =>
            root.render(
                <CanvasRulerComp
                    isHorizontal
                    logicalLength={100}
                    scale={0}
                    isDarkTheme={false}
                    onCreateGuide={vi.fn()}
                />,
            ),
        );
        expect(getContext).not.toHaveBeenCalled();
        getContext.mockReturnValue(null);
        await act(async () =>
            root.render(
                <CanvasRulerComp
                    isHorizontal
                    logicalLength={100}
                    scale={1}
                    isDarkTheme={false}
                    onCreateGuide={vi.fn()}
                />,
            ),
        );
        expect(getContext).toHaveBeenCalledWith('2d');
        expect(host.querySelector('canvas')!.width).toBe(200);
    });
});
