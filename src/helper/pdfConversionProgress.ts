import { useCallback, useSyncExternalStore } from 'react';

export type PdfConversionProgress = {
    completed: number;
    total: number | null;
};

const progressByFile = new Map<string, PdfConversionProgress>();
const listenersByFile = new Map<string, Set<() => void>>();
const activeByFile = new Map<string, number>();

function notify(filePath: string) {
    for (const listener of listenersByFile.get(filePath) ?? []) {
        listener();
    }
}

export function startPdfConversion(filePath: string) {
    const count = activeByFile.get(filePath) ?? 0;
    activeByFile.set(filePath, count + 1);
    if (count > 0) {
        return false;
    }
    progressByFile.set(filePath, { completed: 0, total: null });
    notify(filePath);
    return true;
}

export function updatePdfConversion(
    filePath: string,
    completed: number,
    total: number,
) {
    if (!Number.isFinite(completed) || !Number.isFinite(total) || total < 0) {
        return;
    }
    progressByFile.set(filePath, {
        completed: Math.max(0, Math.min(completed, total)),
        total,
    });
    notify(filePath);
}

export function finishPdfConversion(filePath: string) {
    const count = activeByFile.get(filePath) ?? 0;
    if (count > 1) {
        activeByFile.set(filePath, count - 1);
        return false;
    }
    activeByFile.delete(filePath);
    progressByFile.delete(filePath);
    notify(filePath);
    return true;
}

export function usePdfConversionProgress(filePath: string | null) {
    const subscribe = useCallback(
        (listener: () => void) => {
            if (filePath === null) {
                return () => {};
            }
            let listeners = listenersByFile.get(filePath);
            if (!listeners) {
                listeners = new Set();
                listenersByFile.set(filePath, listeners);
            }
            listeners.add(listener);
            return () => {
                listeners?.delete(listener);
                if (listeners?.size === 0) {
                    listenersByFile.delete(filePath);
                }
            };
        },
        [filePath],
    );
    const getSnapshot = useCallback(
        () =>
            filePath === null ? null : (progressByFile.get(filePath) ?? null),
        [filePath],
    );
    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
