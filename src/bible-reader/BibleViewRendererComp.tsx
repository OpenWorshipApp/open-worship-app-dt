import { useEffect, useMemo, useRef } from 'react';

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
import BibleViewPaneSlotComp from './BibleViewPaneSlotComp';
import {
    assignPaneKeys,
    toPaneKeyMemory,
    useBibleViewPaneHostContext,
    type PaneKeyMemoryType,
} from './bibleViewPaneHelpers';

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
    const paneHost = useBibleViewPaneHostContext();
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
    // the panes' keys instead so the two can never disagree.
    // The keys this split drew last time: a pane keeps its slot while it
    // keeps any view it held (`assignPaneKeys`).
    const paneKeyMemoryRef = useRef<PaneKeyMemoryType>(new Map());
    const paneKeyList = Array.isArray(nestedBibleItems)
        ? assignPaneKeys(nestedBibleItems, paneKeyMemoryRef.current)
        : [];
    const paneKeysText = paneKeyList.join(',');
    const paneKeyMemory: PaneKeyMemoryType = Array.isArray(nestedBibleItems)
        ? toPaneKeyMemory(nestedBibleItems, paneKeyList)
        : new Map();
    // Once committed, so a render React throws away teaches it nothing.
    useEffect(() => {
        paneKeyMemoryRef.current = paneKeyMemory;
    });
    const flexSizeDefault = useMemo(() => {
        const keyList = paneKeysText.split(',');
        if (keyList.length <= 1) {
            return {} as FlexSizeType;
        }
        return Object.fromEntries(
            keyList.map((key) => {
                return [key, ['1']];
            }),
        ) as FlexSizeType;
    }, [paneKeysText]);
    if (!Array.isArray(nestedBibleItems)) {
        // Inside a host the view is drawn once, keyed by its id, and only
        // moved here -- whatever this layout does around it.
        if (paneHost === null) {
            return viewController.finalRenderer(nestedBibleItems);
        }
        return <BibleViewPaneSlotComp bibleItemId={nestedBibleItems.id} />;
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
                    key: paneKeyList[i],
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
