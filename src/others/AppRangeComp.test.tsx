// @vitest-environment jsdom

import { useRef } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('./AppRangeComp.scss', () => ({}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import AppRangeComp, {
    handleCtrlWheel,
    pinchToRangeValue,
    useZoomingRegistering,
    wheelToRangeValue,
    type AppRangeDefaultType,
} from './AppRangeComp';

const defaultSize: AppRangeDefaultType = { size: 5, min: 1, max: 10, step: 1 };

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

describe('others AppRangeComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('wheelToRangeValue clamps within bounds', () => {
        expect(
            wheelToRangeValue({ defaultSize, isUp: true, currentScale: 5 }),
        ).toBe(6);
        expect(
            wheelToRangeValue({ defaultSize, isUp: true, currentScale: 10 }),
        ).toBe(10);
        expect(
            wheelToRangeValue({ defaultSize, isUp: false, currentScale: 1 }),
        ).toBe(1);
    });

    test('pinchToRangeValue scales by distance and clamps', () => {
        expect(
            pinchToRangeValue({
                defaultSize,
                startValue: 5,
                startDistance: 0,
                currentDistance: 10,
            }),
        ).toBe(5);
        expect(
            pinchToRangeValue({
                defaultSize,
                startValue: 5,
                startDistance: 10,
                currentDistance: 40,
            }),
        ).toBe(10); // 20 clamped to max
        expect(
            pinchToRangeValue({
                defaultSize,
                startValue: 5,
                startDistance: 100,
                currentDistance: 1,
            }),
        ).toBe(1); // ~0.05 clamped to min
    });

    test('handleCtrlWheel ignores non-ctrl and applies ctrl scroll', () => {
        const setValue = vi.fn();
        handleCtrlWheel({
            event: { ctrlKey: false },
            value: 5,
            setValue,
            defaultSize,
        });
        expect(setValue).not.toHaveBeenCalled();

        const event = {
            ctrlKey: true,
            deltaY: 10,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        handleCtrlWheel({ event, value: 5, setValue, defaultSize });
        expect(event.preventDefault).toHaveBeenCalled();
        expect(setValue).toHaveBeenCalledWith(6);
    });

    test('useZoomingRegistering wires wheel and pinch gestures', async () => {
        const setValue = vi.fn();
        function Wrapper() {
            const ref = useRef<HTMLDivElement | null>(null);
            useZoomingRegistering(ref, { value: 5, setValue, defaultSize });
            return <div ref={ref} id="zoom-container" />;
        }
        await render(<Wrapper />);
        const el = container.querySelector('#zoom-container')!;

        // ctrl + wheel
        const wheel = new Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheel, 'ctrlKey', { value: true });
        Object.defineProperty(wheel, 'deltaY', { value: 10 });
        await act(async () => {
            el.dispatchEvent(wheel);
        });
        expect(setValue).toHaveBeenCalledWith(6);

        // pinch: start with two touches then move them apart
        const touchStart = new Event('touchstart', { bubbles: true });
        Object.assign(touchStart, {
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 10, clientY: 0 },
            ],
        });
        await act(async () => {
            el.dispatchEvent(touchStart);
        });

        const touchMove = new Event('touchmove', {
            bubbles: true,
            cancelable: true,
        });
        Object.assign(touchMove, {
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 40, clientY: 0 },
            ],
        });
        await act(async () => {
            el.dispatchEvent(touchMove);
        });
        expect(setValue).toHaveBeenCalledWith(10);

        // single-touch move is ignored
        const singleMove = new Event('touchmove', { bubbles: true });
        Object.assign(singleMove, { touches: [{ clientX: 0, clientY: 0 }] });
        await act(async () => {
            el.dispatchEvent(singleMove);
        });

        const touchEnd = new Event('touchend', { bubbles: true });
        Object.assign(touchEnd, { touches: [] });
        await act(async () => {
            el.dispatchEvent(touchEnd);
        });
    });

    test('useZoomingRegistering no-ops without a container', async () => {
        function Wrapper() {
            const ref = useRef<HTMLDivElement | null>(null);
            useZoomingRegistering(ref, {
                value: 5,
                setValue: vi.fn(),
                defaultSize,
            });
            return null;
        }
        await expect(render(<Wrapper />)).resolves.toBeUndefined();
    });

    test('AppRangeComp renders and reacts to zoom buttons and range input', async () => {
        const setValue = vi.fn();
        await render(
            <AppRangeComp
                value={5}
                title="Zoom"
                id="range-1"
                setValue={setValue}
                defaultSize={defaultSize}
                isShowValue
            />,
        );
        const [zoomOut, zoomIn] = Array.from(
            container.querySelectorAll('.pointer'),
        );
        await act(async () => {
            zoomOut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(setValue).toHaveBeenLastCalledWith(4);

        await act(async () => {
            zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        // local state is now 4 (prop is unchanged by the mock), so +1 => 5
        expect(setValue).toHaveBeenLastCalledWith(5);

        const input = container.querySelector(
            'input[type="range"]',
        ) as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        )!.set!;
        nativeSetter.call(input, '8');
        await act(async () => {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(setValue).toHaveBeenLastCalledWith(8);
        expect(container.querySelector('label')?.textContent).toContain('8');
    });

    test('AppRangeComp throws when max is not greater than min', async () => {
        const badRender = render(
            <AppRangeComp
                value={5}
                title="Bad"
                setValue={vi.fn()}
                defaultSize={{ size: 1, min: 5, max: 5, step: 1 }}
            />,
        );
        await expect(badRender).rejects.toThrow('max must be greater than min');
    });
});
