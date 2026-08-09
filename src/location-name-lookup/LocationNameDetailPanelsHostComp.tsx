import { lazy } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import { useOpenDetailPanels } from './detailPanelHelpers';

// Lazy so neither the detail panels nor — through them — the `bible-note` chunk
// and the lookup dataset are touched until a record is actually opened.
const LazyLocationNameDetailPanelsComp = lazy(() => {
    return import('./LocationNameDetailPanelsComp');
});

/**
 * Window-level host for the floating record detail panels.
 *
 * Detail panels used to be hosted by the lookup toggle in the bible-lookup
 * header, which meant they could only exist where that header does. Names are
 * now clickable in any verse text, so the host has to be a window singleton the
 * way `ToastComp` is — mounted once per window that can show scripture, and
 * outliving any particular panel or popup that opened a record.
 *
 * Renders nothing at all until a record is opened, so a window that never uses
 * the feature pays only for this component.
 */
export default function LocationNameDetailPanelsHostComp() {
    const openDetailPanels = useOpenDetailPanels();
    if (openDetailPanels.length === 0) {
        return null;
    }
    return (
        <AppSuspenseComp>
            <LazyLocationNameDetailPanelsComp />
        </AppSuspenseComp>
    );
}
