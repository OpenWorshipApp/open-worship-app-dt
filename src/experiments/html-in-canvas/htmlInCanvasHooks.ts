/**
 * Hooks shared by the HTML-in-Canvas demos.
 */
import { useMemo, useRef, useState, type DependencyList } from 'react';

import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';

import type { HicCanvasType } from './htmlInCanvasTypes';
import { runDrawGuarded } from './htmlInCanvasHelpers';

/**
 * `layoutsubtree` is not in React's JSX typings, and it has to be on the
 * element for the rendering update that gives the children layout, so it is
 * set from a callback ref (commit time) rather than from an effect.
 */
export function useHicCanvas() {
    const canvasRef = useRef<HicCanvasType | null>(null);
    const setCanvasRef = useMemo(() => {
        return (element: HTMLCanvasElement | null) => {
            element?.setAttribute('layoutsubtree', '');
            canvasRef.current = element as HicCanvasType | null;
        };
    }, []);
    return [canvasRef, setCanvasRef] as const;
}

/**
 * The first draw must happen after at least one rendering update, otherwise
 * `drawElementImage` throws "No cached paint record for element".
 */
export function useAfterRenderingUpdate(
    callback: () => void,
    deps: DependencyList,
) {
    const callbackRef = useAppCurrentRef(callback);
    useAppEffect(() => {
        let frameId = requestAnimationFrame(() => {
            frameId = requestAnimationFrame(() => {
                runDrawGuarded(() => {
                    callbackRef.current();
                });
            });
        });
        return () => {
            cancelAnimationFrame(frameId);
        };
    }, deps);
}

export function useAnimationLoop(
    callback: (elapsedMillisecond: number) => void,
    isRunning: boolean,
) {
    const callbackRef = useAppCurrentRef(callback);
    useAppEffect(() => {
        if (!isRunning) {
            return;
        }
        let frameId = 0;
        const startTime = performance.now();
        const step = () => {
            runDrawGuarded(() => {
                callbackRef.current(performance.now() - startTime);
            });
            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [isRunning]);
}

/** Counts events without re-rendering on every single one. */
export function useThrottledCounter() {
    const countRef = useRef(0);
    const [count, setCount] = useState(0);
    useAppEffect(() => {
        const intervalId = setInterval(() => {
            setCount(countRef.current);
        }, 300);
        return () => {
            clearInterval(intervalId);
        };
    }, []);
    return [count, countRef] as const;
}

export function useFpsMeter() {
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const [fps, setFps] = useState(0);
    useAppEffect(() => {
        const intervalId = setInterval(() => {
            const now = performance.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed > 0) {
                setFps(Math.round((frameCountRef.current / elapsed) * 1000));
            }
            frameCountRef.current = 0;
            lastTimeRef.current = now;
        }, 500);
        return () => {
            clearInterval(intervalId);
        };
    }, []);
    return [fps, frameCountRef] as const;
}

// -------------------------------------------------------------------------
// Shared presentation pieces
// -------------------------------------------------------------------------
