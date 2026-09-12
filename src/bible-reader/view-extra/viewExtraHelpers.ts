import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createContext, use } from 'react';

export function cleanupVerseNumberClicked(event: ReactMouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setTimeout(() => {
        const selection = globalThis.getSelection();
        if (selection === null || selection.rangeCount === 0) {
            return;
        }
        // A selection the user has made SINCE this click is theirs, not the
        // leftovers this cleanup was armed to sweep away. Without this check the
        // marking toolbar vanishes mid-gesture for two seconds after any verse
        // number is clicked, and there is no way to tell why.
        if (!selection.isCollapsed) {
            return;
        }
        selection.removeAllRanges();
    }, 2e3);
}

export const BibleViewTitleMaterialContext = createContext<{
    titleElement: ReactNode;
} | null>(null);

export function useBibleViewTitleMaterialContext() {
    const context = use(BibleViewTitleMaterialContext);
    if (context === null) {
        throw new Error(
            'useBibleViewTitleMaterialContext must be used within a ' +
                'BibleViewTitleMaterialContext',
        );
    }
    return context;
}
