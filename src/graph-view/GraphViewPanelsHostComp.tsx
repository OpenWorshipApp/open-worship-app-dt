import { lazy } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import { useOpenGraphList } from './graphViewStore';

// Lazy so neither the canvas nor — through the source it renders — the lookup
// dataset and the `bible-note` chunk are touched until a graph is opened.
const LazyGraphViewPanelsComp = lazy(() => {
    return import('./GraphViewPanelsComp');
});

/**
 * Window-level host for the floating graph panels.
 *
 * A window singleton for the same reason `LocationNameDetailPanelsHostComp` is
 * one: a graph is opened from a context menu on a name in any verse text, or
 * from a detail panel that itself outlives the lookup, so there is no single
 * subtree that could own it.
 *
 * Renders nothing at all until a graph is opened, so a window that never uses
 * the feature pays only for this component.
 */
export default function GraphViewPanelsHostComp() {
    const openGraphList = useOpenGraphList();
    if (openGraphList.length === 0) {
        return null;
    }
    return (
        <AppSuspenseComp>
            <LazyGraphViewPanelsComp />
        </AppSuspenseComp>
    );
}
