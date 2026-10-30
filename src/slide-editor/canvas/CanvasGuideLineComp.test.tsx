// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import {
    CanvasGuideLineComp,
    CanvasSnapLinesComp,
} from './CanvasGuideLineComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('CanvasGuideLineComp', () => {
    test('a horizontal guide is a full-width grab strip centred on its line', async () => {
        const onPointerDown = vi.fn();
        const onRemove = vi.fn();
        await act(async () => {
            root.render(
                <CanvasGuideLineComp
                    guide={{ id: 1, axis: 'h', pos: 120 }}
                    onPointerDown={onPointerDown}
                    onRemove={onRemove}
                />,
            );
        });

        const strip = container.firstElementChild as HTMLDivElement;
        expect(strip.title).toBe('Drag to move, double-click to remove');
        expect(strip.style.top).toBe('117px');
        expect(strip.style.left).toBe('0px');
        expect(strip.style.width).toBe('100%');
        expect(strip.style.height).toBe('6px');
        expect(strip.style.cursor).toBe('row-resize');
        expect(strip.style.touchAction).toBe('none');
        const line = strip.firstElementChild as HTMLDivElement;
        expect(line.style.top).toBe('3px');
        expect(line.style.height).toBe('1px');
        expect(line.style.pointerEvents).toBe('none');

        await act(async () => {
            strip.dispatchEvent(
                new MouseEvent('pointerdown', { bubbles: true }),
            );
        });
        expect(onPointerDown).toHaveBeenCalledOnce();
        await act(async () => {
            strip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        expect(onRemove).toHaveBeenCalledOnce();
    });

    test('a vertical guide is a full-height strip', async () => {
        await act(async () => {
            root.render(
                <CanvasGuideLineComp
                    guide={{ id: 2, axis: 'v', pos: 40 }}
                    onPointerDown={() => {}}
                    onRemove={() => {}}
                />,
            );
        });

        const strip = container.firstElementChild as HTMLDivElement;
        expect(strip.style.left).toBe('37px');
        expect(strip.style.top).toBe('0px');
        expect(strip.style.width).toBe('6px');
        expect(strip.style.height).toBe('100%');
        expect(strip.style.cursor).toBe('col-resize');
        const line = strip.firstElementChild as HTMLDivElement;
        expect(line.style.left).toBe('3px');
        expect(line.style.width).toBe('1px');
    });
});

describe('CanvasSnapLinesComp', () => {
    test('draws every active snap line where it snapped', async () => {
        await act(async () => {
            root.render(
                <CanvasSnapLinesComp vertical={[10, 250]} horizontal={[75]} />,
            );
        });

        const lines = Array.from(
            container.querySelectorAll<HTMLDivElement>('div'),
        );
        expect(
            lines.map((line) => [
                line.style.left,
                line.style.top,
                line.style.width,
                line.style.height,
            ]),
        ).toEqual([
            ['10px', '0px', '1px', '100%'],
            ['250px', '0px', '1px', '100%'],
            ['0px', '75px', '100%', '1px'],
        ]);
        expect(lines.every((line) => line.style.pointerEvents === 'none')).toBe(
            true,
        );
    });

    test('draws nothing when nothing snapped', async () => {
        await act(async () => {
            root.render(<CanvasSnapLinesComp vertical={[]} horizontal={[]} />);
        });
        expect(container.childElementCount).toBe(0);
    });
});
