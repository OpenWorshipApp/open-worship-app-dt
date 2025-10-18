import './PresenterComp.scss';

import { lazy, useState } from 'react';

import {
    useBibleItemShowing,
    useLyricSelecting,
    useVaryAppDocumentSelecting,
} from '../event/PreviewingEventListener';
import { useAppDocumentItemSelecting } from '../event/VaryAppDocumentEventListener';
import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingString,
} from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import {
    checkIsVaryAppDocumentOnScreen,
    getSelectedVaryAppDocument,
} from '../app-document-list/appDocumentHelpers';
import LyricAppDocument from '../lyric-list/LyricAppDocument';
import { getSelectedLyric } from '../lyric-list/lyricHelpers';
import { tran } from '../lang/langHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import BibleItemsViewController, {
    useBibleItemsViewControllerContext,
    useBibleItemViewControllerUpdateEvent,
} from '../bible-reader/BibleItemsViewController';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { getOnScreenBibleItems } from '../bible-list/bibleHelpers';

const LazyAppDocumentPreviewerComp = lazy(() => {
    return import('./items/AppDocumentPreviewerComp');
});
const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});
const LazyLyricHandlerComp = lazy(() => {
    return import('../lyric-list/LyricHandlerComp');
});
const LazyPresenterForegroundComp = lazy(() => {
    return import('../presenter-foreground/PresenterForegroundComp');
});

const PRESENT_TAB_SETTING_NAME = 'presenter-tab';

export function getIsShowingVaryAppDocumentPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'd';
}
export function getIsShowingLyricPreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'l';
}
export function getIsShowingBiblePreviewer() {
    return getSetting(PRESENT_TAB_SETTING_NAME) === 'f';
}

async function checkIsOnScreen<T>(
    targeKey: T,
    viewController: BibleItemsViewController,
) {
    if (targeKey === 'd') {
        const varyAppDocument = await getSelectedVaryAppDocument();
        if (varyAppDocument === null) {
            return false;
        }
        const isOnScreen =
            await checkIsVaryAppDocumentOnScreen(varyAppDocument);
        return isOnScreen;
    } else if (targeKey === 'l') {
        const selectedLyric = await getSelectedLyric();
        if (selectedLyric === null) {
            return false;
        }
        const lyricAppDocument = LyricAppDocument.getInstanceFromLyricFilePath(
            selectedLyric.filePath,
        );
        if (lyricAppDocument === null) {
            return false;
        }
        const isOnScreen =
            await checkIsVaryAppDocumentOnScreen(lyricAppDocument);
        return isOnScreen;
    } else if (targeKey === 'f') {
        const allScreenManager = getAllScreenManagers();
        return allScreenManager.some((screenManager) => {
            return screenManager.screenForegroundManager.isShowing;
        });
    } else if (targeKey === 'b') {
        const titleList = await getOnScreenBibleItems();
        const bibleItems = viewController.straightBibleItems;
        for (const bibleItem of bibleItems) {
            if (titleList.includes(await bibleItem.toTitle())) {
                return true;
            }
        }
    }
    return false;
}

function RenderToggleFullViewComp({
    isFullWidget,
    setIsFullWidget,
}: Readonly<{
    isFullWidget: boolean;
    setIsFullWidget: (value: boolean) => void;
}>) {
    const fullScreenClassname = isFullWidget
        ? 'fullscreen-exit'
        : 'arrows-fullscreen';
    return (
        <div>
            <button
                className={
                    `btn btn-${isFullWidget ? '' : 'outline-'}info ` + 'btn-sm'
                }
                onClick={async () => {
                    setIsFullWidget(!isFullWidget);
                }}
            >
                <i className={`bi bi-${fullScreenClassname}`} />
            </button>
        </div>
    );
}

function RenderForegroundTabComp({
    isActive,
    setIsActive,
    isOnScreen,
}: Readonly<{
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    isOnScreen: boolean;
}>) {
    return (
        <ul className={'nav nav-tabs flex-fill d-flex justify-content-end'}>
            <li className={'nav-item '}>
                <button
                    className={
                        'btn btn-link nav-link' +
                        ` ${isActive ? 'active' : ''}` +
                        (isOnScreen ? ' app-on-screen' : '')
                    }
                    onClick={() => {
                        setIsActive(!isActive);
                    }}
                >
                    {tran('Foreground')}
                </button>
            </li>
        </ul>
    );
}

const tabTypeList = [
    ['d', 'Documents', LazyAppDocumentPreviewerComp],
    ['l', 'Lyrics', LazyLyricHandlerComp],
    ['b', 'Bibles', LazyBiblePreviewerRenderComp],
    ['f', 'Foreground', LazyPresenterForegroundComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function PresenterComp() {
    const [isOnScreen, setIsOnScreen] = useState<boolean>(false);
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        PRESENT_TAB_SETTING_NAME,
        'd',
    );
    const setTabKey1 = (value: TabKeyType) => {
        if (value === 'f') {
            setIsForegroundActive(false);
        }
        setTabKey(value);
    };
    const [isForegroundActive, setIsForegroundActive] = useStateSettingBoolean(
        'foreground-active',
        false,
    );
    const setIsForegroundActive1 = (value: boolean) => {
        if (tabKey === 'f') {
            setTabKey('d');
        }
        setIsForegroundActive(value);
    };
    const [isFullWidget, setIsFullWidget] = useState(false);
    useLyricSelecting(() => setTabKey('l'), []);
    useBibleItemShowing(() => setTabKey('b'), []);
    useVaryAppDocumentSelecting(() => setTabKey('d'));
    useAppDocumentItemSelecting(() => setTabKey('d'));
    const viewController = useBibleItemsViewControllerContext();
    useBibleItemViewControllerUpdateEvent(() => {
        ScreenBibleManager.fireUpdateEvent();
    });
    const normalPresenterChild = tabTypeList.map(([type, _, target]) => {
        return genTabBody<TabKeyType>(tabKey, [type, target]);
    });
    return (
        <div
            className={
                'presenter-manager w-100 h-100 d-flex flex-column app-overflow-hidden' +
                ` ${isFullWidget ? ' app-full-view' : ''}`
            }
        >
            <div className="header d-flex w-100">
                <TabRenderComp<TabKeyType>
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
                            checkIsOnScreen: async () => {
                                const isOnScreen = await checkIsOnScreen(
                                    key,
                                    viewController,
                                );
                                if (key === 'f') {
                                    setIsOnScreen(isOnScreen);
                                }
                                return isOnScreen;
                            },
                        };
                    })}
                    activeTab={tabKey}
                    setActiveTab={setTabKey1}
                    className="flex-fill"
                />
                <RenderForegroundTabComp
                    isActive={isForegroundActive}
                    setIsActive={setIsForegroundActive1}
                    isOnScreen={isOnScreen}
                />
                <RenderToggleFullViewComp
                    isFullWidget={isFullWidget}
                    setIsFullWidget={setIsFullWidget}
                />
            </div>
            <div className="body flex-fill app-overflow-hidden">
                {isForegroundActive ? (
                    <ResizeActorComp
                        flexSizeName={'flex-size-background'}
                        isHorizontal
                        isDisableQuickResize={true}
                        flexSizeDefault={{
                            h1: ['1'],
                            h2: ['1'],
                        }}
                        dataInput={[
                            {
                                children: {
                                    render: () => {
                                        return normalPresenterChild;
                                    },
                                },
                                key: 'h1',
                                widgetName: 'Presenter',
                            },
                            {
                                children: LazyPresenterForegroundComp,
                                key: 'h2',
                                widgetName: 'Foreground',
                            },
                        ]}
                    />
                ) : (
                    normalPresenterChild
                )}
            </div>
        </div>
    );
}
