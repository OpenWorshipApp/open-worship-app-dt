import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import {
    BibleLookupButtonComp,
    BibleLookupTogglePopupContext,
    HelpButtonComp,
    SettingButtonComp,
} from '../others/commonButtons';
import { MultiContextRender } from '../helper/MultiContextRender';
import AppPopupBibleLookupComp from '../app-modal/AppPopupBibleLookupComp';
import AppContextMenuComp from '../context-menu/AppContextMenuComp';
import HandleAlertComp from '../popup-widget/HandleAlertComp';
import ToastComp from '../toast/ToastComp';
import TopProgressBarComp from '../progress-bar/TopProgressBarComp';
import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';
import { SelectedLyricContext } from '../lyric-list/lyricHelpers';
import LayoutTabRenderComp from './LayoutTabRenderComp';
import {
    useAppDocumentContextValues,
    useLyricContextValues,
} from './layoutHelpers';

export default function AppLayoutComp({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const [isBibleLookupShowing, setIsBibleLookupShowing] = useState(false);
    const { varyAppDocumentContextValue, editingSlideContextValue } =
        useAppDocumentContextValues();
    const { lyricContextValue } = useLyricContextValues();

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
                context: SelectedLyricContext,
                value: lyricContextValue,
            },
            {
                context: SelectedEditingSlideContext,
                value: editingSlideContextValue,
            },
        ],
        [
            bibleLookupContextValue,
            varyAppDocumentContextValue,
            lyricContextValue,
            editingSlideContextValue,
        ],
    );

    return (
        <MultiContextRender contexts={contexts}>
            {/* <TestInfinite /> */}
            <div id="app-header" className="d-flex">
                <LayoutTabRenderComp />
                <div
                    className={
                        'app-highlight-border-bottom d-flex' +
                        ' justify-content-center flex-fill'
                    }
                >
                    <BibleLookupButtonComp />
                </div>
                <div className="app-highlight-border-bottom">
                    <SettingButtonComp />
                </div>
                <div className="app-highlight-border-bottom">
                    <HelpButtonComp />
                </div>
            </div>
            <div id="app-body">{children}</div>
            <AppPopupBibleLookupComp />
            <TopProgressBarComp />
            <ToastComp />
            <AppContextMenuComp />
            <HandleAlertComp />
        </MultiContextRender>
    );
}
