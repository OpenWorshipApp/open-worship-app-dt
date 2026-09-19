import { type CSSProperties, useId, useRef, useState } from 'react';

import type { DataInputType, FlexSizeType } from './flexSizeHelpers';
import { getFlexSizeSetting, setFlexSizeSetting } from './flexSizeHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import RenderResizeActorItemComp, {
    renderResizerChildren,
} from './RenderResizeActorItemComp';
import { freezeObject } from '../helper/helpers';
import { registerWidgetsResetHandler } from './widgetRegistry';

export default function ResizeActorComp({
    isHorizontal,
    flexSizeName,
    flexSizeDefault,
    anotherFlexSizeDefault,
    dataInput,
    isDisableQuickResize,
    isNotSaveSetting = false,
    containerStyle,
}: Readonly<{
    isHorizontal: boolean;
    flexSizeName: string;
    flexSizeDefault: Readonly<FlexSizeType>;
    anotherFlexSizeDefault?: Readonly<FlexSizeType>;
    dataInput: DataInputType[];
    isDisableQuickResize?: boolean;
    isNotSaveSetting?: boolean;
    containerStyle?: CSSProperties;
}>) {
    // Per INSTANCE, not per `flexSizeName`: two actors can legitimately be
    // mounted under one name (the background panel nests one inside the other),
    // and keying the registry by the name would silently drop one of them.
    const instanceId = useId();
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
        : getFlexSizeSetting(flexSizeName, flexSizeDefault, dataInput);
    const [flexSize, setFlexSize] = useState(restoreFlexSize);
    // The previewer keeps this very actor mounted while the selected document
    // changes under it, so a new `flexSizeName` alone would leave the state
    // holding the PREVIOUS document's layout — which is what made a collapsed
    // note pane look like one global setting shared by every file. Re-read
    // during render (not in an effect) so the new document never paints with
    // the old document's panes.
    const [readFlexSizeName, setReadFlexSizeName] = useState(flexSizeName);
    if (readFlexSizeName !== flexSizeName) {
        setReadFlexSizeName(flexSizeName);
        setFlexSize(restoreFlexSize);
    }
    const setFlexSize1 = (newFlexSize: FlexSizeType) => {
        if (!isNotSaveSetting) {
            setFlexSizeSetting(flexSizeName, newFlexSize);
        }
        setFlexSize(newFlexSize);
    };
    const containerRef = useRef<HTMLDivElement | null>(null);
    const resetRef = useAppCurrentRef(() => {
        // A drag writes `style.flexGrow` straight onto the pane and never tells
        // React (`FlexResizeActorComp.onMouseMove`), so re-rendering the SAME
        // `flex` string React last rendered is a no-op and the dragged width
        // survives the reset. Blank the imperative styles first, exactly as
        // `FlexResizeActorComp.resetSize` does for a single separator.
        // `:scope >` keeps this to THIS actor's own panes: nested actors have
        // their own `[data-fs]` children and their own reset handler.
        const nodes =
            containerRef.current?.querySelectorAll<HTMLDivElement>(
                ':scope > [data-fs]',
            );
        for (const node of nodes ?? []) {
            node.style.flexGrow = '';
            node.style.flex = node.dataset['fsDefault'] ?? '1';
        }
        // `flexSizeDefault` is frozen, and it carries no disabled flag — which
        // is what re-opens every widget that is open by default.
        setFlexSize1(structuredClone(flexSizeDefault) as FlexSizeType);
    });
    useAppEffect(() => {
        return registerWidgetsResetHandler(instanceId, () => {
            resetRef.current();
        });
    }, []);
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

    if (dataInput.length === 0) {
        return null;
    }
    if (dataInput.length === 1) {
        const { children } = dataInput[0];
        return (
            <div
                className={'w-100 h-100 app-overflow-hidden'}
                style={{
                    ...containerStyle,
                }}
            >
                {renderResizerChildren(children)}
            </div>
        );
    }
    return (
        <div
            ref={containerRef}
            className={
                `w-100 h-100 flex ${isHorizontal ? 'h' : 'v'} ` +
                'app-overflow-hidden'
            }
            style={{
                ...containerStyle,
            }}
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
                        anotherDefaultFlexSize={anotherFlexSizeDefault}
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
