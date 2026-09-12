import { useMemo } from 'react';

import type { NestedBibleItemsType } from './BibleItemsViewController';
import {
    RESIZE_SETTING_NAME,
    useBibleItemsViewControllerContext,
} from './BibleItemsViewController';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import NoBibleViewAvailableComp from './NoBibleViewAvailableComp';
import type {
    FlexSizeType,
    DataInputType,
} from '../resize-actor/flexSizeHelpers';
import { checkIsDarkMode, useThemeSource } from '../others/themeHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';

export default function BibleViewRendererComp({
    isHorizontal = true,
    classPrefix = '',
    nestedBibleItems,
}: Readonly<{
    isHorizontal?: boolean;
    classPrefix?: string;
    nestedBibleItems: NestedBibleItemsType;
}>) {
    const them = useThemeSource();
    const viewController = useBibleItemsViewControllerContext();
    const typeText = isHorizontal ? 'h' : 'v';
    const fullClassPrefix = classPrefix + typeText;
    // `nestedBibleItems` is the view controller's LIVE array: `addBibleItem`
    // splices it in place BEFORE the (microtask-async) update event lands, so
    // any render happening in that window — closing the bible-key popup of
    // `Split Horizontal/Vertical to` is the usual one — re-renders this
    // component with the SAME array reference but a new length. Keying the
    // memo on that reference kept the old pane count while `dataInput` below
    // already had the new one, which is what made `ResizeActorComp` throw
    // `key v3 not found in flexSizeDefault:{"v1":["1"],"v2":["1"]}`. Key it on
    // the count instead so the two can never disagree.
    const itemCount = Array.isArray(nestedBibleItems)
        ? nestedBibleItems.length
        : 0;
    const flexSizeDefault = useMemo(() => {
        if (itemCount <= 1) {
            return {} as FlexSizeType;
        }
        return Object.fromEntries(
            Array.from({ length: itemCount }, (_, i) => {
                return [`${typeText}${i + 1}`, ['1']];
            }),
        ) as FlexSizeType;
    }, [itemCount, typeText]);
    if (!Array.isArray(nestedBibleItems)) {
        return viewController.finalRenderer(nestedBibleItems);
    }
    if (nestedBibleItems.length === 0) {
        return <NoBibleViewAvailableComp />;
    }
    if (nestedBibleItems.length === 1) {
        return (
            <BibleViewRendererComp
                nestedBibleItems={nestedBibleItems[0]}
                isHorizontal={!isHorizontal}
                classPrefix={fullClassPrefix}
            />
        );
    }
    return (
        <ResizeActorComp
            flexSizeName={viewController.toSettingName(
                `${RESIZE_SETTING_NAME}-${fullClassPrefix}`,
            )}
            isHorizontal={isHorizontal}
            isNotSaveSetting
            isDisableQuickResize
            flexSizeDefault={flexSizeDefault}
            dataInput={nestedBibleItems.map((item, i): DataInputType => {
                return {
                    children: {
                        render: () => {
                            return (
                                <BibleViewRendererComp
                                    nestedBibleItems={item}
                                    isHorizontal={!isHorizontal}
                                    classPrefix={fullClassPrefix}
                                />
                            );
                        },
                    },
                    key: `${typeText}${i + 1}`,
                    ...toWidgetLabel('Bible View'),
                };
            })}
            containerStyle={{
                backgroundColor: checkIsDarkMode(them.themeSource)
                    ? 'black'
                    : 'white',
            }}
        />
    );
}
