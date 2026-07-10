import './PresenterComp.scss';

import { lazy, useState, useCallback, useMemo, type MouseEvent } from 'react';

import {
    useBibleItemShowing,
    useLyricSelecting,
    useVaryAppDocumentSelecting,
} from '../event/PreviewingEventListener';
import { useVarySlideSelecting } from '../event/VaryAppDocumentEventListener';
import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp from '../others/TabRenderComp';
import { tran } from '../lang/langHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import {
    useBibleItemsViewControllerContext,
    useBibleItemViewControllerUpdateEvent,
} from '../bible-reader/BibleItemsViewController';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import {
    checkIsOnScreen,
    PRESENT_TAB_SETTING_NAME,
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
        h4: ['1'],
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
    if (arr.includes('f')) {
        dataInput.push({
            children: LazyPresenterForegroundComp,
            key: 'h4',
            widgetName: tran('Foreground'),
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
    ['f', tran('Foreground'), LazyPresenterForegroundComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
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
    const { flexSizeDefault, dataInput } = useMemo(() => {
        return genReElements(tabKeys);
    }, [tabKeys]);

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
                    activeTabs={tabKeys.split('') as TabKeyType[]}
                    setActiveTab={(key, event) => {
                        setTabKey1(key, { event });
                    }}
                    className="flex-fill"
                />
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
