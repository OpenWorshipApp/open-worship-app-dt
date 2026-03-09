import { useRef, useState } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import { type DataInputType, type FlexSizeType } from './flexSizeHelpers';
import ResizeActorComp from './ResizeActorComp';
import { DYN_SUFFIX } from './dynamicFlexSizeHelpers';

type PerDataType = {
    flexSizeDefault: FlexSizeType;
    dataInput: DataInputType[];
};
export default function ResizeActorDynamicComp({
    flexSizeName,
    data: { minWidth, horizontal, vertical },
    isDisableQuickResize,
    isNotSaveSetting,
}: Readonly<{
    flexSizeName: string;
    data: {
        minWidth: number;
        horizontal: PerDataType;
        vertical: PerDataType;
    };
    isDisableQuickResize?: boolean;
    isNotSaveSetting?: boolean;
}>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHorizontal, setIsHorizontal] = useState(true);
    useAppEffect(() => {
        const current = containerRef.current;
        if (!current) {
            return;
        }
        const observer = new ResizeObserver((entries) => {
            if (entries.length === 0) {
                return;
            }
            const entry = entries[0];
            const newIsHorizontal = entry.contentRect.width >= minWidth;
            setIsHorizontal(newIsHorizontal);
        });
        observer.observe(current);
        setIsHorizontal(current.clientWidth >= minWidth);
        current.style.visibility = 'visible';
        return () => {
            observer.disconnect();
        };
    }, [minWidth, containerRef.current]);
    return (
        <div
            ref={containerRef}
            className="w-100 h-100 app-overflow-hidden"
            style={{
                visibility: 'hidden',
            }}
        >
            {isHorizontal ? (
                <ResizeActorComp
                    isHorizontal
                    flexSizeName={flexSizeName + `${DYN_SUFFIX}h`}
                    flexSizeDefault={horizontal.flexSizeDefault}
                    anotherFlexSizeDefault={vertical.flexSizeDefault}
                    dataInput={horizontal.dataInput}
                    isDisableQuickResize={isDisableQuickResize}
                    isNotSaveSetting={isNotSaveSetting}
                />
            ) : null}
            {isHorizontal ? null : (
                <ResizeActorComp
                    isHorizontal={false}
                    flexSizeName={flexSizeName + `${DYN_SUFFIX}v`}
                    flexSizeDefault={vertical.flexSizeDefault}
                    anotherFlexSizeDefault={horizontal.flexSizeDefault}
                    dataInput={vertical.dataInput}
                    isDisableQuickResize={isDisableQuickResize}
                    isNotSaveSetting={isNotSaveSetting}
                />
            )}
        </div>
    );
}
