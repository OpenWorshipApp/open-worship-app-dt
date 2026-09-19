import { useMemo, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import PresentingDrawManager from './PresentingDrawManager';
import PresentingFocusManager from './PresentingFocusManager';

// Re-render on an engine update. The engines drive the DOM directly (a canvas /
// one style property) so React is not in their hot path at all — these only
// exist so the TOOLBAR can reflect state it cannot otherwise see: whether
// Undo/Redo/Clear are available, whether the spotlight is on.
//
// Both engines fire only on discrete events (a stroke committed, a setting
// changed, the spotlight turning on or off) — never per pointer sample — so this
// cannot become a per-move re-render.
export function usePresentingManagerEvents(manager: {
    addUpdateListener: (listener: () => void) => () => void;
}) {
    const [, setUpdateCount] = useState(0);
    useAppEffect(() => {
        return manager.addUpdateListener(() => {
            setUpdateCount((oldCount) => {
                return oldCount + 1;
            });
        });
    }, [manager]);
}

// A DOM `resize` listener. Dragging a window edge fires this continuously and
// each run reallocates a (up to 33MB supersampled) canvas backing store, so the
// work here is deliberately just "tell the engines"; their frame schedulers
// coalesce the actual repaint.
export function useWindowResize(handleResize: () => void) {
    const handleResizeRef = useAppCurrentRef(handleResize);
    useAppEffect(() => {
        const handle = () => {
            handleResizeRef.current();
        };
        globalThis.addEventListener('resize', handle);
        return () => {
            globalThis.removeEventListener('resize', handle);
        };
    }, []);
}

// One engine pair per controller session, torn down when the controller closes
// so no canvas backing store, listener or debounced write outlives it.
//
// `delete()` is deliberately RE-ENTRANT rather than terminal: StrictMode
// simulates an unmount/remount on every mount (cleanups first, then effects and
// ref callbacks again), so the engines must come back to life when their ref
// callback hands the element back. It resets state and drops listeners; the
// `canvas`/`div` setters re-attach.
export function usePresentingManagers() {
    const drawManager = useMemo(() => {
        return new PresentingDrawManager();
    }, []);
    const focusManager = useMemo(() => {
        return new PresentingFocusManager();
    }, []);
    useAppEffect(() => {
        return () => {
            drawManager.delete();
            focusManager.delete();
        };
    }, [drawManager, focusManager]);
    return { drawManager, focusManager };
}
