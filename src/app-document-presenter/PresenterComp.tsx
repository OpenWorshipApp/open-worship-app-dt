import './PresenterComp.scss';

import { lazy, useState, useCallback, useMemo, type MouseEvent } from 'react';

import {
    useBibleItemShowing,
    useLyricSelecting,
    useVaryAppDocumentSelecting,
} from '../event/PreviewingEventListener';
import { useVarySlideSelecting } from '../event/VaryAppDocumentEventListener';
import {
    useStateSettingString,
    useStateSettingBoolean,
} from '../helper/settingHelpers';
import TabRenderComp from '../others/TabRenderComp';
import type { TabHeaderPropsType } from '../others/TabRenderComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { tran } from '../lang/langHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import {
    useBibleItemsViewControllerContext,
    useBibleItemViewControllerUpdateEvent,
} from '../bible-reader/BibleItemsViewController';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { getIsAnyForegroundShowing } from '../presenter-foreground/foregroundHelpers';
import {
    checkIsOnScreen,
    PRESENT_TAB_SETTING_NAME,
    PRESENT_FOREGROUND_FLOATING_SETTING_NAME,
} from './presenterRendererHelpers';
import type {
    DataInputType,
    FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

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
    const label = isFullWidget ? tran('Exit full view') : tran('Full view');

    const isFullWidgetRef = useAppCurrentRef(isFullWidget);
    const setIsFullWidgetRef = useAppCurrentRef(setIsFullWidget);
    const handleClick = useCallback(async () => {
        setIsFullWidgetRef.current(!isFullWidgetRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            <button
                className={`btn btn-${isFullWidget ? '' : 'outline-'}info `}
                title={label}
                aria-label={label}
                onClick={handleClick}
            >
                <i className={`bi bi-${fullScreenClassname}`} />
            </button>
        </div>
    );
}

function genReElements(tabKeys: string) {
    const arr = tabKeys.split('') as TabKeyType[];
    const flexSizeDefault: FlexSizeType = {
        h1: ['1'],
        h2: ['1'],
        h3: ['1'],
    };
    const dataInput: DataInputType[] = [];
    if (arr.includes('d')) {
        dataInput.push({
            children: LazyAppDocumentPreviewerComp,
            key: 'h1',
            widgetName: tran('Documents'),
        });
    }
    if (arr.includes('l')) {
        dataInput.push({
            children: LazyLyricHandlerComp,
            key: 'h2',
            widgetName: tran('Lyrics'),
        });
    }
    if (arr.includes('b')) {
        dataInput.push({
            children: LazyPresenterBiblePreviewerRenderComp,
            key: 'h3',
            widgetName: tran('Bible'),
        });
    }
    return {
        flexSizeDefault,
        dataInput,
    };
}

const tabTypeList = [
    ['d', tran('Documents'), LazyAppDocumentPreviewerComp],
    ['l', tran('Lyrics'), LazyLyricHandlerComp],
    ['b', tran('Bibles'), LazyPresenterBiblePreviewerRenderComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];

function ForegroundFloatingComp() {
    const viewController = useBibleItemsViewControllerContext();
    const [isShowing, setIsShowing] = useStateSettingBoolean(
        PRESENT_FOREGROUND_FLOATING_SETTING_NAME,
        false,
    );
    useScreenForegroundManagerEvents(['update']);
    const isOnScreen = getIsAnyForegroundShowing();
    const foregroundTabs = useMemo<TabHeaderPropsType<'f'>[]>(
        () => [
            {
                key: 'f',
                title: tran('Foreground'),
                checkIsOnScreen: async () => {
                    return checkIsOnScreen('f', viewController);
                },
            },
        ],
        [viewController],
    );
    return (
        <>
            <TabRenderComp<'f'>
                tabs={foregroundTabs}
                activeTabs={isShowing ? ['f'] : []}
                setActiveTab={() => {
                    setIsShowing((prev) => !prev);
                }}
            />
            {isShowing ? (
                <FloatingWidgetComp
                    title={
                        <span className={isOnScreen ? 'app-on-screen' : ''}>
                            {tran('Foreground')}
                        </span>
                    }
                    onClose={() => {
                        setIsShowing(false);
                    }}
                    options={{
                        width: 420,
                        height: 560,
                        minWidth: 300,
                        minHeight: 220,
                    }}
                >
                    <AppSuspenseComp>
                        <LazyPresenterForegroundComp />
                    </AppSuspenseComp>
                </FloatingWidgetComp>
            ) : null}
        </>
    );
}
export default function PresenterComp() {
    const [tabKeys, setTabKeys] = useStateSettingString<string>(
        PRESENT_TAB_SETTING_NAME,
        'd',
    );
    const setTabKeys1 = useCallback(
        (
            value: string,
            { isSolo, isForce }: { isSolo?: boolean; isForce?: boolean } = {},
        ) => {
            setTabKeys((prev) => {
                if (isSolo) {
                    return value;
                }
                const arr = prev.split('');
                if (arr.includes(value)) {
                    if (!isForce) {
                        arr.splice(arr.indexOf(value), 1);
                    }
                } else {
                    arr.push(value);
                }
                if (arr.length === 0) {
                    return prev;
                }
                return arr.join('');
            });
        },
        [setTabKeys],
    );

    const setTabKey1 = useCallback(
        (
            value: TabKeyType,
            {
                event,
                isForce,
            }: {
                event?: MouseEvent<HTMLButtonElement>;
                isForce?: boolean;
            } = {},
        ) => {
            if (event?.type === 'contextmenu') {
                event.preventDefault();
                setTabKeys1(value, { isSolo: true });
            } else {
                setTabKeys1(value, { isForce });
            }
        },
        [setTabKeys1],
    );

    const [isFullWidget, setIsFullWidget] = useState(false);

    const handleLyricSelect = useCallback(() => {
        setTabKey1('l', { isForce: true });
    }, [setTabKey1]);
    const handleBibleShow = useCallback(() => {
        setTabKey1('b', { isForce: true });
    }, [setTabKey1]);
    const setTabKey1Ref = useAppCurrentRef(setTabKey1);
    const handleDocumentSelect = useCallback(() => {
        setTabKey1Ref.current('d', { isForce: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLyricSelecting(handleLyricSelect, [handleLyricSelect]);
    useBibleItemShowing(handleBibleShow, [handleBibleShow]);
    useVaryAppDocumentSelecting(handleDocumentSelect);
    useVarySlideSelecting(handleDocumentSelect);

    const viewController = useBibleItemsViewControllerContext();

    const handleBibleUpdate = useCallback(() => {
        ScreenBibleManager.fireUpdateEvent();
    }, []);

    useBibleItemViewControllerUpdateEvent(handleBibleUpdate);

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
                        return isOnScreen;
                    },
                };
            }),
        [viewController],
    );
    const mainTabKeys = useMemo(() => {
        const filtered = tabKeys
            .split('')
            .filter((key) => tabTypeList.some(([tabKey]) => tabKey === key));
        return filtered.length > 0 ? filtered.join('') : 'd';
    }, [tabKeys]);
    const { flexSizeDefault, dataInput } = useMemo(() => {
        return genReElements(mainTabKeys);
    }, [mainTabKeys]);

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
                    activeTabs={mainTabKeys.split('') as TabKeyType[]}
                    setActiveTab={(key, event) => {
                        setTabKey1(key, { event });
                    }}
                    className="flex-fill"
                />
                <ForegroundFloatingComp />
                <RenderToggleFullViewComp
                    isFullWidget={isFullWidget}
                    setIsFullWidget={setIsFullWidget}
                />
            </div>
            <ResizeActorComp
                flexSizeName={'flex-size-control-center'}
                isHorizontal
                isDisableQuickResize
                flexSizeDefault={flexSizeDefault}
                dataInput={dataInput}
            />
        </div>
    );
}
