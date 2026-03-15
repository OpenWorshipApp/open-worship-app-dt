import { Fragment, useCallback, useMemo } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import FlexResizeActorComp from './FlexResizeActorComp';
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
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    checkShouldQuickMove,
    reopenAnotherHiddenWidget,
} from './dynamicFlexSizeHelpers';

const renderChildren = (Children: any) => {
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
        checkShouldQuickMove(
            flexSizeName,
            defaultFlexSize,
            anotherDefaultFlexSize,
        );
    }, [flexSizeName, defaultFlexSize, anotherDefaultFlexSize]);
    const handleDisabling = useCallback(
        (targetDataFlexSizeKey: string, target: DisabledType) => {
            const size = setDisablingSetting(
                flexSizeName,
                restoreFlexSize,
                targetDataFlexSizeKey,
                target,
            );
            setFlexSize(size);
        },
        [flexSizeName, restoreFlexSize, setFlexSize],
    );
    const handleSizeChecking = useCallback(() => {
        const size = genFlexSizeSetting(flexSizeName, restoreFlexSize);
        setFlexSize(size);
    }, [flexSizeName, restoreFlexSize, setFlexSize]);

    const { children, key, className = '', extraStyle = {}, widgetName } = data;
    const flexSizeValue = flexSize[key] ?? restoreFlexSize[key] ?? [];
    const handleReopening = useMemo(() => {
        if (!flexSizeValue[1]) {
            return null;
        }
        return (event: { currentTarget: HTMLDivElement }) => {
            reopenAnotherHiddenWidget(
                flexSizeName,
                defaultFlexSize,
                anotherDefaultFlexSize,
            );
            const flexSizeDisabled = flexSizeValue[1] as DisabledType;
            const newSize = calcShowingHiddenWidget(
                event,
                key,
                flexSizeName,
                restoreFlexSize,
                flexSizeDisabled,
            );
            setFlexSize(newSize);
        };
    }, [flexSizeValue[1], key, flexSizeName, restoreFlexSize, setFlexSize]);
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
    const isWidgetHidden = handleReopening !== null;
    return (
        <Fragment key={index}>
            {isShowingFlexSizeActor && (
                <FlexResizeActorComp
                    isDisableQuickResize={isDisableQuickResize}
                    disableWidget={handleDisabling}
                    checkSize={handleSizeChecking}
                    checkShouldQuickMove={checkShouldQuickMove.bind(
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
                    data-fs={keyToDataFlexSizeKey(flexSizeName, key)}
                    data-fs-default={defaultFlexSize[key][0]}
                    data-min-size={50}
                    className={`${className} app-overflow-hidden`}
                    style={{
                        flex: `${flexSizeValue[0] || 1}`,
                        ...extraStyle,
                    }}
                >
                    {renderChildren(children)}
                </div>
            )}
            {isWidgetHidden ? (
                <RenderHiddenWidgetTitleComp
                    widgetName={widgetName}
                    type={type}
                    onClick={handleReopening ?? (() => {})}
                    isOnScreen={isOnScreen}
                />
            ) : null}
        </Fragment>
    );
}
