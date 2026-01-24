import { Fragment } from 'react';

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
    flexSizeName: string;
    dataInput: DataInputType[];
    isDisableQuickResize: boolean;
    isHorizontal: boolean;
    setFlexSize: (flexSize: FlexSizeType) => void;
    isOnScreen: boolean;
}>) {
    const handleDisabling = (
        targetDataFlexSizeKey: string,
        target: DisabledType,
    ) => {
        const size = setDisablingSetting(
            flexSizeName,
            restoreFlexSize,
            targetDataFlexSizeKey,
            target,
        );
        setFlexSize(size);
    };
    const handleSizeChecking = () => {
        const size = genFlexSizeSetting(flexSizeName, restoreFlexSize);
        setFlexSize(size);
    };

    const { children, key, className = '', extraStyle = {}, widgetName } = data;
    const flexSizeValue = flexSize[key] ?? restoreFlexSize[key] ?? [];
    const onHiddenWidgetClick = flexSizeValue[1]
        ? (event: any) => {
              const flexSizeDisabled = flexSizeValue[1] as DisabledType;
              const size = calcShowingHiddenWidget(
                  event,
                  key,
                  flexSizeName,
                  restoreFlexSize,
                  flexSizeDisabled,
              );
              setFlexSize(size);
          }
        : null;

    let isShowingFlexSizeActor = false;
    if (
        index !== 0 &&
        onHiddenWidgetClick === null &&
        (checkIsThereNotHiddenWidget(dataInput, flexSize, 0, index) ||
            checkIsThereNotHiddenWidget(dataInput, flexSize, index + 1))
    ) {
        isShowingFlexSizeActor = true;
    }
    const type = isHorizontal ? 'h' : 'v';
    const isWidgetHidden = onHiddenWidgetClick !== null;
    return (
        <Fragment key={index}>
            {isShowingFlexSizeActor && (
                <FlexResizeActorComp
                    isDisableQuickResize={isDisableQuickResize}
                    disableWidget={handleDisabling}
                    checkSize={handleSizeChecking}
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
                    onClick={onHiddenWidgetClick ?? (() => {})}
                    isOnScreen={isOnScreen}
                />
            ) : null}
        </Fragment>
    );
}
