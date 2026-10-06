import { lazy } from 'react';
import { createPortal } from 'react-dom';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import {
    setMirrorPanelShowing,
    useMirrorPanelShowing,
} from './mirrorConnectionHelpers';

const LazyConnectionComp = lazy(() => import('./ScreenMirrorConnectionComp'));
export default function ScreenMirrorFloatingComp() {
    const showing = useMirrorPanelShowing();
    return showing ? <VisibleScreenMirrorFloatingComp /> : null;
}
function VisibleScreenMirrorFloatingComp() {
    const { theme } = useThemeSource();
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={tran('Screen Mirror Connection')}
                widgetName="Screen Mirror Connection"
                persistKey="floating-widget-rect-screen-mirror"
                onClose={() => setMirrorPanelShowing(false)}
                options={{
                    width: 440,
                    height: 560,
                    minWidth: 300,
                    minHeight: 240,
                }}
            >
                <AppSuspenseComp>
                    <LazyConnectionComp />
                </AppSuspenseComp>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
