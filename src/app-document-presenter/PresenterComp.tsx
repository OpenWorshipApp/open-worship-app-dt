import './PresenterComp.scss';

import { lazy, useState, useCallback, useMemo } from 'react';

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
const LazyPresenterBiblePreviewerRenderComp = lazy(() => {
    return import('./PresenterBiblePreviewerRenderComp');
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

    const handleClick = useCallback(async () => {
        setIsFullWidget(!isFullWidget);
    }, [isFullWidget, setIsFullWidget]);

    return (
        <div>
            <button
                className={`btn btn-${isFullWidget ? '' : 'outline-'}info `}
                onClick={handleClick}
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
    const handleClick = useCallback(() => {
        setIsActive(!isActive);
    }, [isActive, setIsActive]);

    return (
        <ul className={'nav nav-tabs flex-fill d-flex justify-content-end'}>
            <li className={'nav-item '}>
                <button
                    className={
                        'btn btn-sm btn-link nav-link' +
                        ` ${isActive ? 'active' : ''}` +
                        (isOnScreen ? ' app-on-screen' : '')
                    }
                    onClick={handleClick}
                >
                    {tran('Foreground')}
                </button>
            </li>
        </ul>
    );
}

const tabTypeList = [
    ['d', tran('Documents'), LazyAppDocumentPreviewerComp],
    ['l', tran('Lyrics'), LazyLyricHandlerComp],
    ['b', tran('Bibles'), LazyPresenterBiblePreviewerRenderComp],
    ['f', tran('Foreground'), LazyPresenterForegroundComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function PresenterComp() {
    const [isOnScreen, setIsOnScreen] = useState<boolean>(false);
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        PRESENT_TAB_SETTING_NAME,
        'd',
    );

    const setTabKey1 = useCallback(
        (value: TabKeyType) => {
            if (value === 'f') {
                setIsForegroundActive(false);
            }
            setTabKey(value);
        },
        [setTabKey],
    );

    const [isForegroundActive, setIsForegroundActive] = useStateSettingBoolean(
        'foreground-active',
        false,
    );

    const setIsForegroundActive1 = useCallback(
        (value: boolean) => {
            if (tabKey === 'f') {
                setTabKey('d');
            }
            setIsForegroundActive(value);
        },
        [tabKey, setTabKey, setIsForegroundActive],
    );

    const [isFullWidget, setIsFullWidget] = useState(false);

    const handleLyricSelect = useCallback(() => setTabKey('l'), [setTabKey]);
    const handleBibleShow = useCallback(() => setTabKey('b'), [setTabKey]);
    const handleDocumentSelect = useCallback(() => setTabKey('d'), [setTabKey]);

    useLyricSelecting(handleLyricSelect, [handleLyricSelect]);
    useBibleItemShowing(handleBibleShow, [handleBibleShow]);
    useVaryAppDocumentSelecting(handleDocumentSelect);
    useAppDocumentItemSelecting(handleDocumentSelect);

    const viewController = useBibleItemsViewControllerContext();

    const handleBibleUpdate = useCallback(() => {
        ScreenBibleManager.fireUpdateEvent();
    }, []);

    useBibleItemViewControllerUpdateEvent(handleBibleUpdate);

    const normalPresenterChild = useMemo(
        () =>
            tabTypeList.map(([type, _, target]) => {
                return genTabBody<TabKeyType>(tabKey, [type, target]);
            }),
        [tabKey],
    );

    const tabs = useMemo(
        () =>
            tabTypeList.map(([key, name]) => {
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
            }),
        [viewController],
    );

    const resizeActorData = useMemo(
        () => [
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
        ],
        [normalPresenterChild],
    );

    return (
        <div
            className={
                'presenter-manager w-100 h-100 d-flex flex-column app-overflow-hidden' +
                ` ${isFullWidget ? ' app-full-view' : ''}`
            }
        >
            <div className="header d-flex w-100">
                <TabRenderComp<TabKeyType>
                    tabs={tabs}
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
                        dataInput={resizeActorData}
                    />
                ) : (
                    normalPresenterChild
                )}
            </div>
        </div>
    );
}
