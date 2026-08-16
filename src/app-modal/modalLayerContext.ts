import { createContext, use } from 'react';

// True for everything rendered inside a modal (`#modal-container`), portals
// included — React context follows the React tree, not the DOM, which is exactly
// what a floating widget needs: it is portaled to `document.body` yet is opened
// by, and belongs to, whatever modal hosts its toggle.
export const ModalLayerContext = createContext(false);

export function useIsInModalLayer() {
    return use(ModalLayerContext);
}
