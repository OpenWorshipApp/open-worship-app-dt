import { createContext, use } from 'react';

export type SnapLinesType = { vertical: number[]; horizontal: number[] };
export type SnapTargetsType = { vertical: number[]; horizontal: number[] };
export type GuideLineType = { id: number; axis: 'v' | 'h'; pos: number };

export type CanvasSnapContextType = {
    // `excludeIds` covers every box that travels with the drag: a
    // multi-selection moves as one, so its members can't snap to each other.
    getSnapTargets: (excludeIds: number[]) => SnapTargetsType;
    setSnapLines: (lines: SnapLinesType) => void;
};

export const CanvasSnapContext = createContext<CanvasSnapContextType | null>(
    null,
);
export function useCanvasSnapContext() {
    const context = use(CanvasSnapContext);
    if (context === null) {
        throw new Error(
            'useCanvasSnapContext must be used inside a CanvasSnapContext',
        );
    }
    return context;
}
