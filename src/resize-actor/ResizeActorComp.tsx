import { useState } from 'react';

import type { DataInputType, FlexSizeType } from './flexSizeHelpers';
import { getFlexSizeSetting, setFlexSizeSetting } from './flexSizeHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import RenderResizeActorItemComp from './RenderResizeActorItemComp';
import { freezeObject } from '../helper/helpers';

export default function ResizeActorComp({
    isHorizontal,
    flexSizeName,
    flexSizeDefault,
    dataInput,
    isDisableQuickResize,
    isNotSaveSetting = false,
}: Readonly<{
    isHorizontal: boolean;
    flexSizeName: string;
    flexSizeDefault: Readonly<FlexSizeType>;
    dataInput: DataInputType[];
    isDisableQuickResize?: boolean;
    isNotSaveSetting?: boolean;
}>) {
    freezeObject(flexSizeDefault);
    for (const { key } of dataInput) {
        if (flexSizeDefault[key] === undefined) {
            throw new Error(
                `key ${key} not found in flexSizeDefault:` +
                    JSON.stringify(flexSizeDefault),
            );
        }
    }
    const restoreFlexSize = isNotSaveSetting
        ? flexSizeDefault
        : getFlexSizeSetting(flexSizeName, flexSizeDefault);
    const [flexSize, setFlexSize] = useState(restoreFlexSize);
    const setFlexSize1 = (newFlexSize: FlexSizeType) => {
        if (!isNotSaveSetting) {
            setFlexSizeSetting(flexSizeName, newFlexSize);
        }
        setFlexSize(newFlexSize);
    };
    useAppEffect(() => {
        const foundDiff = [];
        const newFlexSize = { ...flexSize };
        for (const key in flexSizeDefault) {
            if (!newFlexSize[key]) {
                newFlexSize[key] = flexSizeDefault[key];
                foundDiff.push(key);
            }
        }
        for (const key in newFlexSize) {
            if (!flexSizeDefault[key]) {
                delete newFlexSize[key];
                foundDiff.push(key);
            }
        }
        if (foundDiff.length > 0) {
            setFlexSize1(newFlexSize);
        }
    }, [flexSize, flexSizeDefault]);

    return (
        <div
            className={
                `w-100 h-100 flex ${isHorizontal ? 'h' : 'v'} ` +
                'app-overflow-hidden'
            }
        >
            {dataInput.map((data, i) => {
                const { key, className, isOnScreen } = data;
                return (
                    <RenderResizeActorItemComp
                        key={`${key}-${className}}`}
                        data={data}
                        index={i}
                        flexSize={flexSize}
                        setFlexSize={setFlexSize1}
                        restoreFlexSize={restoreFlexSize}
                        defaultFlexSize={flexSizeDefault}
                        flexSizeName={flexSizeName}
                        dataInput={dataInput}
                        isDisableQuickResize={!!isDisableQuickResize}
                        isHorizontal={isHorizontal}
                        isOnScreen={!!isOnScreen}
                    />
                );
            })}
        </div>
    );
}
