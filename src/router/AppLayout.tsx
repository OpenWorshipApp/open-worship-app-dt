import { useMemo, useState } from 'react';

import {
    TabOptionType,
    editorTab,
    goToPath,
    presenterTab,
    readerTab,
} from './routeHelpers';
import {
    BibleSearchButtonComp,
    BibleSearchShowingContext,
    SettingButtonComp,
} from '../others/commonButtons';
import { tran } from '../lang';
import appProvider from '../server/appProvider';
import { MultiContextRender } from '../helper/MultiContextRender';
import AppPopupWindows from '../app-modal/AppPopupWindows';
import AppContextMenuComp from '../others/AppContextMenuComp';
import HandleAlertComp from '../popup-widget/HandleAlertComp';
import Toast from '../toast/Toast';
import AppDocument from '../app-document-list/AppDocument';
import Slide from '../app-document-list/Slide';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import TopProgressBarComp from '../progress-bar/TopProgressBarComp';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
    getSelectedVaryAppDocument,
    VaryAppDocumentType,
    getSelectedEditingSlide,
    VaryAppDocumentItemType,
    setSelectedVaryAppDocument,
    setSelectedEditingSlide,
} from '../app-document-list/appDocumentHelpers';

const tabs: TabOptionType[] = [];
if (!appProvider.isPagePresenter) {
    tabs.push(presenterTab);
} else if (!appProvider.isPageEditor) {
    tabs.push(editorTab);
}
tabs.push(readerTab);

function TabRender() {
    const handleClicking = async (tab: TabOptionType) => {
        if (tab.preCheck) {
            const isPassed = await tab.preCheck();
            if (!isPassed) {
                return;
            }
        }
        goToPath(tab.routePath);
    };
    return (
        <ul className="nav nav-tabs">
            {tabs.map((tab) => {
                return (
                    <li key={tab.title} className="nav-item">
                        <button
                            className="btn btn-link nav-link"
                            onClick={handleClicking.bind(null, tab)}
                        >
                            {tran(tab.title)}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

function useAppDocumentContextValues() {
    const [varyAppDocument, setVaryAppDocument] =
        useState<VaryAppDocumentType | null>(null);
    const setVaryAppDocument1 = (
        newVaryAppDocument: VaryAppDocumentType | null,
    ) => {
        setVaryAppDocument(newVaryAppDocument);
        setSelectedVaryAppDocument(newVaryAppDocument);
    };

    const [slide, setSlide] = useState<Slide | null>(null);
    const setSlide1 = (newSlide: Slide | null) => {
        setSlide(newSlide);
        setSelectedEditingSlide(newSlide);
    };

    useAppEffectAsync(
        async (methodContext) => {
            const varyAppDocument = await getSelectedVaryAppDocument();
            methodContext.setVaryAppDocument(varyAppDocument);
            const varyAppDocumentItem = await getSelectedEditingSlide();
            methodContext.setSlide(varyAppDocumentItem);
        },
        undefined,
        {
            setVaryAppDocument,
            setSlide,
        },
    );
    const varyAppDocumentContextValue = useMemo(() => {
        return {
            selectedVaryAppDocument: varyAppDocument,
            setSelectedVaryAppDocument: async (
                newVaryAppDocument: VaryAppDocumentType | null,
            ) => {
                setVaryAppDocument1(newVaryAppDocument);
                let selectedSlide: Slide | null = null;
                if (
                    newVaryAppDocument !== null &&
                    AppDocument.checkIsThisType(newVaryAppDocument)
                ) {
                    const varyAppDocumentItems =
                        await newVaryAppDocument.getItems();
                    selectedSlide = varyAppDocumentItems[0] ?? null;
                }
                setSlide1(selectedSlide);
            },
        };
    }, [varyAppDocument]);
    const editingSlideContextValue = useMemo(() => {
        return {
            selectedSlide: slide,
            setSelectedSlide: (newSelectedSlide: Slide) => {
                setSlide1(newSelectedSlide);
            },
        };
    }, [slide]);
    useFileSourceEvents(
        ['delete'],
        (deletedSlide: VaryAppDocumentItemType) => {
            if (slide?.checkIsSame(deletedSlide)) {
                return;
            }
            setSlide1(slide);
        },
        [varyAppDocument, slide],
        varyAppDocument?.filePath,
    );
    useFileSourceEvents(
        ['update'],
        async () => {
            const varyAppDocumentItems =
                varyAppDocument && AppDocument.checkIsThisType(varyAppDocument)
                    ? await varyAppDocument.getItems()
                    : [];
            const newVaryAppDocumentItem = slide
                ? varyAppDocumentItems.find((item) => {
                      return item.checkIsSame(slide);
                  })
                : null;
            setSlide1(newVaryAppDocumentItem || slide);
        },
        [varyAppDocument, slide],
        varyAppDocument?.filePath,
    );
    return {
        varyAppDocumentContextValue,
        editingSlideContextValue,
    };
}

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isBibleSearchShowing, setIsBibleSearchShowing] = useState(false);
    const { varyAppDocumentContextValue, editingSlideContextValue } =
        useAppDocumentContextValues();
    return (
        <MultiContextRender
            contexts={[
                {
                    context: BibleSearchShowingContext,
                    value: {
                        isShowing: isBibleSearchShowing,
                        setIsShowing: setIsBibleSearchShowing,
                    },
                },
                {
                    context: SelectedVaryAppDocumentContext,
                    value: varyAppDocumentContextValue,
                },
                {
                    context: SelectedEditingSlideContext,
                    value: editingSlideContextValue,
                },
            ]}
        >
            {/* <TestInfinite /> */}
            <div id="app-header" className="d-flex">
                <TabRender />
                <div
                    className={
                        'highlight-border-bottom d-flex' +
                        ' justify-content-center flex-fill'
                    }
                >
                    <BibleSearchButtonComp />
                </div>
                <div className="highlight-border-bottom">
                    <SettingButtonComp />
                </div>
            </div>
            <div id="app-body" className="app-border-white-round">
                {children}
            </div>
            <TopProgressBarComp />
            <Toast />
            <AppContextMenuComp />
            <HandleAlertComp />
            <AppPopupWindows />
        </MultiContextRender>
    );
}
