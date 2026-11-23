import { lazy } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import { useThemeSource } from '../../others/themeHelpers';
import { tran } from '../../lang/langHelpers';

// Lazy so the search panel — and through it the SongSelect API client — is
// never touched until the user actually opens the popup.
const LazySongSelectSearchPanelComp = lazy(() => {
    return import('./SongSelectSearchPanelComp');
});

export default function SongSelectSearchPopupComp({
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
                title={tran('Import From SongSelect')}
                // The panel's English name, as every floating panel carries
                // one: a control inside it is scoped by it (`Panel > control`)
                // and reports it as `inPanel` (F-33 / F-42 of robot run
                // 20261120-2021).
                widgetName="Import From SongSelect"
                persistKey="floating-widget-rect-song-select-import"
                onClose={onClose}
                options={{
                    width: 480,
                    height: 600,
                    minWidth: 340,
                    minHeight: 320,
                }}
            >
                <AppSuspenseComp>
                    <LazySongSelectSearchPanelComp dirPath={dirPath} />
                </AppSuspenseComp>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
