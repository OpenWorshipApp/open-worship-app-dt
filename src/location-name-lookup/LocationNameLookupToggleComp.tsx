import { lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useThemeSource } from '../others/themeHelpers';
import { tran } from '../lang/langHelpers';
import {
    closeAllDetailPanels,
    useOpenDetailPanels,
} from './detailPanelHelpers';

// Lazy so neither the panel nor — through it — the `bible-note` chunk and the
// ~34MB lookup dataset are touched until the user actually opens the panel.
const LazyLocationNameLookupPanelComp = lazy(() => {
    return import('./LocationNameLookupPanelComp');
});
const LazyLocationNameDetailPanelsComp = lazy(() => {
    return import('./LocationNameDetailPanelsComp');
});

/**
 * Opens a searchable browser over the biblical names and locations dataset.
 *
 * Showing state is deliberately LOCAL rather than a setting-backed store: each
 * mounted lookup header then owns exactly one panel (two headers in one window
 * cannot produce duplicate widgets), and no persisted flag can make the app pay
 * the dataset load automatically at startup.
 */
export default function LocationNameLookupToggleComp() {
    const [isShowing, setIsShowing] = useState(false);
    const { theme } = useThemeSource();
    // Detail panels are opened FROM the lookup panel but outlive it, so they are
    // hosted here rather than inside it — closing the lookup must not yank away
    // the record the user opened to read.
    const openDetailPanels = useOpenDetailPanels();
    // The panel store is module-level but this component is its only host, and
    // the host does go away: in the presenter the whole bible-lookup popup is
    // unmounted when it is closed (`AppPopupBibleLookupComp` returns null).
    // Without this the widgets vanish from the screen while the store still
    // holds them, and reopening the popup resurrects panels the user watched
    // disappear minutes earlier.
    useEffect(() => {
        return () => {
            closeAllDetailPanels();
        };
    }, []);
    const label = tran('Names and locations lookup');
    return (
        <>
            <button
                type="button"
                className={`btn btn-sm btn-${
                    isShowing ? 'info' : 'outline-secondary'
                }`}
                title={label}
                aria-label={label}
                aria-pressed={isShowing}
                onClick={() => {
                    setIsShowing((oldIsShowing) => {
                        return !oldIsShowing;
                    });
                }}
            >
                <i className="bi bi-person-fill" />
                <i className="bi bi-geo-alt-fill ms-1" />
            </button>
            {!isShowing
                ? null
                : createPortal(
                      <div
                          className="app app-floating-widget-portal"
                          data-bs-theme={theme}
                      >
                          <FloatingWidgetComp
                              title={label}
                              persistKey="floating-widget-rect-location-name-lookup"
                              onClose={() => {
                                  setIsShowing(false);
                              }}
                              options={{
                                  width: 340,
                                  height: 560,
                                  minWidth: 280,
                                  minHeight: 260,
                              }}
                          >
                              <AppSuspenseComp>
                                  <LazyLocationNameLookupPanelComp />
                              </AppSuspenseComp>
                          </FloatingWidgetComp>
                      </div>,
                      document.body,
                  )}
            {openDetailPanels.length === 0 ? null : (
                <AppSuspenseComp>
                    <LazyLocationNameDetailPanelsComp />
                </AppSuspenseComp>
            )}
        </>
    );
}
