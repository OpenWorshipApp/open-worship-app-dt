import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createContext, use } from 'react';

export function cleanupVerseNumberClicked(event: ReactMouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setTimeout(() => {
        const selection = globalThis.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
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
