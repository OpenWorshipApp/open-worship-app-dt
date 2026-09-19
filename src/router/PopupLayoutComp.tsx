import type { ReactNode } from 'react';

import AppContextMenuComp from '../context-menu/AppContextMenuComp';
import HandleAlertComp from '../popup-widget/HandleAlertComp';
import ToastComp from '../toast/ToastComp';
import TopProgressBarComp from '../progress-bar/TopProgressBarComp';

export default function PopupLayoutComp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <div className="w-100 h-100 app-overflow-hidden">{children}</div>
            <TopProgressBarComp />
            <ToastComp />
            <AppContextMenuComp />
            <HandleAlertComp />
        </>
    );
}
