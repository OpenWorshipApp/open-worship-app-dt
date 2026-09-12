import { Fragment, useCallback, useMemo, useRef } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import FlexResizeActorComp, {
    ACTIVE_HIDDEN_WIDGET_CLASS,
} from './FlexResizeActorComp';
import type {
    DisabledType,
    DataInputType,
    FlexSizeType,
} from './flexSizeHelpers';
import {
    keyToDataFlexSizeKey,
    setDisablingSetting,
    genFlexSizeSetting,
    checkIsThereNotHiddenWidget,
    calcShowingHiddenWidget,
} from './flexSizeHelpers';
import RenderHiddenWidgetTitleComp from './RenderHiddenWidgetTitleComp';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import {
    checkCanClose,
    reopenAnotherHiddenWidget,
} from './dynamicFlexSizeHelpers';
import { checkMediaPlaying } from '../helper/mediaControlHelpers';
import {
    registerWidgets,
    toWidgetId,
    unregisterWidgets,
} from './widgetRegistry';

export const renderResizerChildren = (Children: any) => {
    if (typeof Children === 'object' && 'render' in Children) {
        return Children.render();
    }
    return (
        <AppSuspenseComp>
            <Children />
        </AppSuspenseComp>
    );
};

export default function RenderResizeActorItemComp({
    data,
    index,
    flexSize,
    setFlexSize,
    restoreFlexSize,
    defaultFlexSize,
    anotherDefaultFlexSize,
    flexSizeName,
    dataInput,
    isDisableQuickResize,
    isHorizontal,
    isOnScreen,
}: Readonly<{
    data: DataInputType;
    index: number;
    flexSize: FlexSizeType;
    restoreFlexSize: FlexSizeType;
    defaultFlexSize: FlexSizeType;
    anotherDefaultFlexSize?: FlexSizeType;
    flexSizeName: string;
    dataInput: DataInputType[];
    isDisableQuickResize: boolean;
    isHorizontal: boolean;
    setFlexSize: (flexSize: FlexSizeType) => void;
    isOnScreen: boolean;
}>) {
    useAppEffect(() => {
        checkCanClose(flexSizeName, defaultFlexSize, anotherDefaultFlexSize);
    }, [flexSizeName, defaultFlexSize, anotherDefaultFlexSize]);
    const flexSizeNameRef = useAppCurrentRef(flexSizeName);
    const restoreFlexSizeRef = useAppCurrentRef(restoreFlexSize);
    const setFlexSizeRef = useAppCurrentRef(setFlexSize);
    const handleDisabling = useCallback(
        (targetDataFlexSizeKey: string, target: DisabledType) => {
            const size = setDisablingSetting(
                flexSizeNameRef.current,
                restoreFlexSizeRef.current,
                targetDataFlexSizeKey,
                target,
            );
            setFlexSizeRef.current(size);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleSizeChecking = useCallback(() => {
        const size = genFlexSizeSetting(
            flexSizeNameRef.current,
            restoreFlexSizeRef.current,
        );
        setFlexSizeRef.current(size);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        children,
        key,
        className = '',
        extraStyle = {},
        widgetName,
        widgetKey,
        widgetIconName,
    } = data;
    const flexSizeValue = flexSize[key] ?? restoreFlexSize[key] ?? [];
    const flexSizeDisabledFlag = flexSizeValue[1];
    const handleReopening = useMemo(() => {
        if (!flexSizeDisabledFlag) {
            return null;
        }
        return (event: { currentTarget: HTMLDivElement }) => {
            reopenAnotherHiddenWidget(
                flexSizeName,
                defaultFlexSize,
                anotherDefaultFlexSize,
            );
            const flexSizeDisabled = flexSizeDisabledFlag;
            const newSize = calcShowingHiddenWidget(
                event,
                key,
                flexSizeName,
                restoreFlexSize,
                flexSizeDisabled,
            );
            setFlexSize(newSize);
        };
    }, [
        flexSizeDisabledFlag,
        key,
        flexSizeName,
        restoreFlexSize,
        setFlexSize,
        defaultFlexSize,
        anotherDefaultFlexSize,
    ]);
    // The pane itself, and the strip that replaces it once collapsed. Both open
    // and close are DOM-relative operations — which sibling absorbs the grow —
    // so the menu drives the very same nodes a pointer would.
    const paneRef = useRef<HTMLDivElement | null>(null);
    const hiddenTitleRef = useRef<HTMLDivElement | null>(null);
    const handleReopeningRef = useAppCurrentRef(handleReopening);
    const handleClosing = useCallback(() => {
        const node = paneRef.current;
        if (node === null) {
            return;
        }
        // Same guard as `FlexResizeActorComp.close`: a pane playing media must
        // not vanish under the operator. This is the discrete path, so it toasts.
        if (checkMediaPlaying({ targetElement: node, includeYouTube: true })) {
            return;
        }
        const findVisibleSibling = (isNext: boolean) => {
            let sibling = (
                isNext ? node.nextElementSibling : node.previousElementSibling
            ) as HTMLDivElement | null;
            while (
                sibling !== null &&
                (sibling.dataset['fs'] === undefined ||
                    sibling.classList.contains(ACTIVE_HIDDEN_WIDGET_CLASS))
            ) {
                sibling = (
                    isNext
                        ? sibling.nextElementSibling
                        : sibling.previousElementSibling
                ) as HTMLDivElement | null;
            }
            return sibling;
        };
        // `'first'` means this pane sat BEFORE the sibling that takes its grow,
        // which is how `calcShowingHiddenWidget` knows where to give it back.
        const nextSibling = findVisibleSibling(true);
        const isFirst = nextSibling !== null;
        const target = isFirst ? nextSibling : findVisibleSibling(false);
        const dataFlexSizeKey = node.dataset['fs'];
        if (target === null || dataFlexSizeKey === undefined) {
            // The last pane standing has nowhere to hand its space to.
            return;
        }
        const ownGrow = Number(node.style.flexGrow || node.style.flex) || 0;
        const targetGrow = Number(target.style.flexGrow || target.style.flex);
        target.style.flexGrow = `${(Number.isNaN(targetGrow) ? 0 : targetGrow) + ownGrow}`;
        handleDisabling(dataFlexSizeKey, [
            isFirst ? 'first' : 'second',
            ownGrow,
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isShowingFlexSizeActor = useMemo(() => {
        if (
            index !== 0 &&
            handleReopening === null &&
            (checkIsThereNotHiddenWidget(dataInput, flexSize, 0, index) ||
                checkIsThereNotHiddenWidget(dataInput, flexSize, index + 1))
        ) {
            return true;
        }
        return false;
    }, [index, handleReopening, dataInput, flexSize]);
    const type = isHorizontal ? 'h' : 'v';
    const isWidgetHidden = !isDisableQuickResize && handleReopening !== null;
    // A group that cannot collapse has nothing for the menu to toggle, and a
    // lone pane has no sibling to hand its space to.
    const canMenuToggle = !isDisableQuickResize && dataInput.length > 1;
    const widgetId = toWidgetId(flexSizeName, key);
    useAppEffect(() => {
        if (!canMenuToggle) {
            return;
        }
        registerWidgets(widgetId, [
            {
                id: widgetId,
                widgetName,
                isHidden: isWidgetHidden,
                toggle: () => {
                    if (!isWidgetHidden) {
                        handleClosing();
                        return;
                    }
                    const element = hiddenTitleRef.current;
                    if (element === null) {
                        return;
                    }
                    // Reuse the strip's own click path verbatim: it already
                    // settles the `-dyn-h`/`-dyn-v` sibling bookkeeping.
                    handleReopeningRef.current?.({ currentTarget: element });
                },
            },
        ]);
        return () => {
            unregisterWidgets(widgetId);
        };
    }, [widgetId, widgetName, isWidgetHidden, canMenuToggle]);
    return (
        <Fragment key={index}>
            {isShowingFlexSizeActor && (
                <FlexResizeActorComp
                    isDisableQuickResize={isDisableQuickResize}
                    disableWidget={handleDisabling}
                    checkSize={handleSizeChecking}
                    checkCanClose={checkCanClose.bind(
                        null,
                        flexSizeName,
                        defaultFlexSize,
                        anotherDefaultFlexSize,
                    )}
                    type={type}
                />
            )}
            {isWidgetHidden ? null : (
                <div
                    ref={paneRef}
                    data-fs={keyToDataFlexSizeKey(flexSizeName, key)}
                    // An OPEN panel used to be nameless: the name is only
                    // drawn once it collapses. So "open the Background
                    // panel" had nothing on screen to match but the
                    // background-TRANSITION button beside the screen
                    // preview, and that is what the chatbot rang.
                    data-widget-name={widgetKey ?? widgetName}
                    data-fs-default={defaultFlexSize[key][0]}
                    data-min-size={50}
                    className={`${className} app-overflow-hidden`}
                    style={{
                        flex: `${flexSizeValue[0] || 1}`,
                        ...extraStyle,
                    }}
                >
                    {renderResizerChildren(children)}
                </div>
            )}
            {isWidgetHidden ? (
                <RenderHiddenWidgetTitleComp
                    elementRef={hiddenTitleRef}
                    widgetName={widgetName}
                    widgetKey={widgetKey}
                    widgetIconName={widgetIconName}
                    type={type}
                    onClick={handleReopening ?? (() => {})}
                    isOnScreen={isOnScreen}
                />
            ) : null}
        </Fragment>
    );
}
