import { lazy } from 'react';
import { createPortal } from 'react-dom';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import {
    setMirrorPanelShowing,
    setMirrorPanelTab,
    useMirrorPanelShowing,
    useMirrorPanelTab,
    type VirtualScreensManagerTabType,
} from './mirrorConnectionHelpers';

const LazyConnectionComp = lazy(() => import('./ScreenMirrorConnectionComp'));
const LazyVirtualDisplaysComp = lazy(
    () => import('../virtual-display/VirtualDisplaysComp'),
);

// The tab labels are translated where they are drawn, never at import.
const TAB_LIST: ReadonlyArray<{
    tab: VirtualScreensManagerTabType;
    labelKey: 'Screen Mirror Connection' | 'Virtual Displays';
    icon: string;
}> = [
    { tab: 'mirror', labelKey: 'Screen Mirror Connection', icon: 'pc-display' },
    { tab: 'virtual', labelKey: 'Virtual Displays', icon: 'display' },
];

function RenderTabsComp({
    activeTab,
}: Readonly<{ activeTab: VirtualScreensManagerTabType }>) {
    return (
        <div
            className="btn-group btn-group-sm w-100 px-2 pt-2"
            role="tablist"
            aria-label={tran('Virtual Screens Manager')}
        >
            {TAB_LIST.map(({ tab, labelKey, icon }) => {
                const isActive = tab === activeTab;
                return (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`btn ${isActive ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => {
                            setMirrorPanelTab(tab);
                        }}
                    >
                        <i className={`bi bi-${icon} me-1`} aria-hidden />
                        {tran(labelKey)}
                    </button>
                );
            })}
        </div>
    );
}

export default function ScreenMirrorFloatingComp() {
    const showing = useMirrorPanelShowing();
    return showing ? <VisibleScreenMirrorFloatingComp /> : null;
}
function VisibleScreenMirrorFloatingComp() {
    const { theme } = useThemeSource();
    const activeTab = useMirrorPanelTab();
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={tran('Virtual Screens Manager')}
                widgetName="Virtual Screens Manager"
                persistKey="floating-widget-rect-screen-mirror"
                onClose={() => setMirrorPanelShowing(false)}
                options={{
                    width: 460,
                    height: 600,
                    minWidth: 300,
                    minHeight: 240,
                }}
            >
                <div className="d-flex flex-column h-100">
                    <RenderTabsComp activeTab={activeTab} />
                    <div
                        className="flex-fill"
                        role="tabpanel"
                        style={{ minHeight: 0 }}
                    >
                        {/* Only the tab in view is mounted: leaving the
                            Virtual Displays tab stops a preview with it. */}
                        <AppSuspenseComp>
                            {activeTab === 'virtual' ? (
                                <LazyVirtualDisplaysComp />
                            ) : (
                                <LazyConnectionComp />
                            )}
                        </AppSuspenseComp>
                    </div>
                </div>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
