import { lazy } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import { useThemeSource } from '../../others/themeHelpers';
import { tran } from '../../lang/langHelpers';

// Lazy so the embedded song catalog is never loaded until the user actually
// opens the popup.
const LazyPublicDomainSongsPanelComp = lazy(() => {
    return import('./PublicDomainSongsPanelComp');
});

export default function PublicDomainSongsPopupComp({
    dirPath,
    onClose,
}: Readonly<{
    dirPath: string;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={tran('Import From Public Domain Songs')}
                persistKey="floating-widget-rect-public-domain-songs-import"
                onClose={onClose}
                options={{
                    width: 480,
                    height: 600,
                    minWidth: 340,
                    minHeight: 320,
                }}
            >
                <AppSuspenseComp>
                    <LazyPublicDomainSongsPanelComp dirPath={dirPath} />
                </AppSuspenseComp>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
