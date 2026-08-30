import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import {
    BibleLookupButtonComp,
    BibleLookupTogglePopupContext,
    HelpButtonComp,
    SettingButtonComp,
} from '../others/commonButtons';
import { MultiContextRenderComp } from '../helper/MultiContextRenderComp';
import AppPopupBibleLookupComp from '../app-modal/AppPopupBibleLookupComp';
import AppContextMenuComp from '../context-menu/AppContextMenuComp';
import HandleAlertComp from '../popup-widget/HandleAlertComp';
import ToastComp from '../toast/ToastComp';
import TopProgressBarComp from '../progress-bar/TopProgressBarComp';
import {
    isInjectedAppDocumentFilePath,
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';
import LayoutTabRenderComp from './LayoutTabRenderComp';
import { useAppDocumentContextValues } from './layoutHelpers';
import AppDocumentPreviewFloatingComp from '../app-document-list/AppDocumentPreviewFloatingComp';
import GraphViewPanelsHostComp from '../graph-view/GraphViewPanelsHostComp';
import LocationNameDetailPanelsHostComp from '../location-name-lookup/LocationNameDetailPanelsHostComp';

export default function AppLayoutComp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const [isBibleLookupShowing, setIsBibleLookupShowing] = useState(false);
    const { varyAppDocumentContextValue, editingSlideContextValue } =
        useAppDocumentContextValues();

    const bibleLookupContextValue = useMemo(
        () => ({
            isShowing: isBibleLookupShowing,
            setIsShowing: setIsBibleLookupShowing,
        }),
        [isBibleLookupShowing],
    );

    const contexts = useMemo(
        () => [
            {
                context: BibleLookupTogglePopupContext,
                value: bibleLookupContextValue,
            },
            {
                context: SelectedVaryAppDocumentContext,
                value: varyAppDocumentContextValue,
            },
            {
                context: SelectedEditingSlideContext,
                value: editingSlideContextValue,
            },
        ],
        [
            bibleLookupContextValue,
            varyAppDocumentContextValue,
            editingSlideContextValue,
        ],
    );

    return (
        <MultiContextRenderComp contexts={contexts}>
            {/* <TestInfiniteComp /> */}
            <div id="app-header" className="d-flex">
                {isInjectedAppDocumentFilePath ? null : <LayoutTabRenderComp />}
                <div
                    className={
                        'app-highlight-border-bottom d-flex' +
                        ' justify-content-center flex-fill'
                    }
                >
                    <BibleLookupButtonComp />
                </div>
                <div className="app-highlight-border-bottom">
                    <div className="btn-group" role="group">
                        {isInjectedAppDocumentFilePath ? null : (
                            <SettingButtonComp />
                        )}
                        <HelpButtonComp />
                    </div>
                </div>
            </div>
            <div id="app-body">{children}</div>
            <AppPopupBibleLookupComp />
            <TopProgressBarComp />
            <ToastComp />
            <AppContextMenuComp />
            <HandleAlertComp />
            <AppDocumentPreviewFloatingComp />
            <LocationNameDetailPanelsHostComp />
            <GraphViewPanelsHostComp />
        </MultiContextRenderComp>
    );
}
