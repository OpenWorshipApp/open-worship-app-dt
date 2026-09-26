import './PresenterComp.scss';

import { lazy, useState, useCallback, useMemo, type MouseEvent } from 'react';

import {
    useBibleItemShowing,
    useVaryAppDocumentSelecting,
} from '../event/PreviewingEventListener';
import { useVarySlideSelecting } from '../event/VaryAppDocumentEventListener';
import { useStateSettingString } from '../helper/settingHelpers';
import TabRenderComp from '../others/TabRenderComp';
import type { TabHeaderPropsType } from '../others/TabRenderComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { tran } from '../lang/langHelpers';
import { toIconedLabel, toWidgetLabel } from '../others/labelIconHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import {
    useBibleItemsViewControllerContext,
    useBibleItemViewControllerUpdateEvent,
} from '../bible-reader/BibleItemsViewController';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { getForegroundShowingScreenIdDataList } from '../presenter-foreground/foregroundHelpers';
import type { ForegroundWidgetType } from '../presenter-foreground/foregroundWidgetHelpers';
import {
    FOREGROUND_OPEN_PANELS_SETTING_NAME,
    FOREGROUND_WIDGET_LIST,
    genForegroundPanelMenuItems,
    toForegroundPanelPersistKey,
    toOpenPanelKeys,
    toToggledPanelKeys,
} from '../presenter-foreground/foregroundWidgetHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    checkIsOnScreen,
    PRESENT_TAB_SETTING_NAME,
} from './presenterRendererHelpers';
import type {
    DataInputType,
    FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import VaryAppDocumentPinComp from './VaryAppDocumentPinComp';

const LazyAppDocumentPreviewerComp = lazy(() => {
    return import('./items/AppDocumentPreviewerComp');
});
const LazyPresenterBiblePreviewerRenderComp = lazy(() => {
    return import('./PresenterBiblePreviewerRenderComp');
});
/**
 * One component of the Foreground in its OWN floating panel: opened from the
 * launcher, closed by its own ✕, and remembering its size and place across a
 * reload through `persistKey`. Mounted beside the launcher rather than inside
 * it, so closing the launcher leaves the panels the operator is working in up.
 */
function ForegroundWidgetPanelComp({
    widget,
    onClose,
}: Readonly<{ widget: ForegroundWidgetType; onClose: () => void }>) {
    useScreenForegroundManagerEvents(['update']);
    const isOnScreen =
        getForegroundShowingScreenIdDataList(widget.checkIsOnScreen).length > 0;
    const { Comp } = widget;
    return (
        <FloatingWidgetComp
            title={
                <span className={isOnScreen ? 'app-on-screen' : ''}>
                    {toIconedLabel(widget.labelKey)}
                </span>
            }
            persistKey={toForegroundPanelPersistKey(widget.key)}
            // Every foreground component reuses the Background tabs' own file
            // grid, so its tiles carry the same words as the ones in the
            // Background panel. Naming the panel is what lets a find be aimed
            // at one of them: `Video Show > snow.mp4` rather than both.
            widgetName={widget.labelKey}
            onClose={onClose}
            options={{
                width: 460,
                height: 520,
                minWidth: 300,
                minHeight: 200,
            }}
        >
            <AppSuspenseComp>
                <Comp />
            </AppSuspenseComp>
        </FloatingWidgetComp>
    );
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
    // `h2` was the Lyrics tab. Lyrics are previewed by the Documents previewer
    // now, but the remaining keys keep their slots so saved flex sizes survive.
    const flexSizeDefault: FlexSizeType = {
        h1: ['1'],
        h3: ['1'],
    };
    const dataInput: DataInputType[] = [];
    if (arr.includes('d')) {
        dataInput.push({
            children: LazyAppDocumentPreviewerComp,
            key: 'h1',
            ...toWidgetLabel('Documents'),
        });
    }
    if (arr.includes('b')) {
        dataInput.push({
            children: LazyPresenterBiblePreviewerRenderComp,
            key: 'h3',
            ...toWidgetLabel('Bible'),
        });
    }
    return {
        flexSizeDefault,
        dataInput,
    };
}

const tabTypeList = [
    ['d', toIconedLabel('Documents'), LazyAppDocumentPreviewerComp],
    ['b', toIconedLabel('Bibles'), LazyPresenterBiblePreviewerRenderComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];

// Module scope so the element identity survives every recompute of the `tabs`
// memo. React still routes context updates into a bailed-out subtree, so the
// pin keeps reacting to the selection.
const PIN_ELEMENT = <VaryAppDocumentPinComp />;

function ForegroundFloatingComp() {
    const viewController = useBibleItemsViewControllerContext();
    // Which components have a panel open, as one setting: the chooser and the
    // panels both read it, so a pick lands in both the same render.
    const [openKeysRaw, setOpenKeysRaw] = useStateSettingString<string>(
        FOREGROUND_OPEN_PANELS_SETTING_NAME,
        '',
    );
    useScreenForegroundManagerEvents(['update']);
    const openKeys = toOpenPanelKeys(openKeysRaw);
    const foregroundTabs = useMemo<TabHeaderPropsType<'f'>[]>(
        () => [
            {
                key: 'f',
                title: toIconedLabel('Foreground'),
                checkIsOnScreen: async () => {
                    return checkIsOnScreen('f', viewController);
                },
            },
        ],
        [viewController],
    );
    const handleToggling = (key: string) => {
        setOpenKeysRaw((prev) => {
            return toToggledPanelKeys(prev, key);
        });
    };
    return (
        <>
            <TabRenderComp<'f'>
                tabs={foregroundTabs}
                activeTabs={openKeys.length > 0 ? ['f'] : []}
                setActiveTab={(_key, event) => {
                    // At the cursor, and gone the moment something is picked:
                    // the chooser is a menu, not another panel to put away.
                    showAppContextMenu(
                        event as any,
                        genForegroundPanelMenuItems(
                            openKeysRaw,
                            handleToggling,
                            tran,
                        ),
                    );
                }}
            />
            {FOREGROUND_WIDGET_LIST.filter((widget) => {
                return openKeys.includes(widget.key);
            }).map((widget) => {
                return (
                    <ForegroundWidgetPanelComp
                        key={widget.key}
                        widget={widget}
                        onClose={() => {
                            handleToggling(widget.key);
                        }}
                    />
                );
            })}
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

    const handleBibleShow = useCallback(() => {
        setTabKey1('b', { isForce: true });
    }, [setTabKey1]);
    const setTabKey1Ref = useAppCurrentRef(setTabKey1);
    const handleDocumentSelect = useCallback(() => {
        setTabKey1Ref.current('d', { isForce: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                    title:
                        key === 'd' ? (
                            <>
                                {name}
                                {PIN_ELEMENT}
                            </>
                        ) : (
                            name
                        ),
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
    // A setting saved while the removed Lyrics tab existed still holds its `l`.
    // Rendering already ignores it, but `setTabKeys1` toggles the RAW string, so
    // without this write-back the dead key comes back on the next toggle.
    useAppEffect(() => {
        if (mainTabKeys !== tabKeys) {
            setTabKeys(mainTabKeys);
        }
    }, [mainTabKeys, tabKeys]);
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
