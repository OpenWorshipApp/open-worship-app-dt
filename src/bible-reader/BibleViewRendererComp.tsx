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

export default function BibleViewRendererComp({
    isHorizontal = true,
    classPrefix = '',
    nestedBibleItems,
}: Readonly<{
    isHorizontal?: boolean;
    classPrefix?: string;
    nestedBibleItems: NestedBibleItemsType;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    if (!(nestedBibleItems instanceof Array)) {
        return viewController.finalRenderer(nestedBibleItems);
    }
    if (nestedBibleItems.length === 0) {
        return <NoBibleViewAvailableComp />;
    }
    const typeText = isHorizontal ? 'h' : 'v';
    classPrefix += typeText;
    if (nestedBibleItems.length === 1) {
        return (
            <BibleViewRendererComp
                nestedBibleItems={nestedBibleItems[0]}
                isHorizontal={!isHorizontal}
                classPrefix={classPrefix}
            />
        );
    }
    const flexSizeDefault = Object.fromEntries(
        nestedBibleItems.map((_, i) => {
            return [`${typeText}${i + 1}`, ['1']];
        }),
    ) as FlexSizeType;
    return (
        <ResizeActorComp
            flexSizeName={viewController.toSettingName(
                `${RESIZE_SETTING_NAME}-${classPrefix}`,
            )}
            isHorizontal={isHorizontal}
            isNotSaveSetting
            isDisableQuickResize={true}
            flexSizeDefault={flexSizeDefault}
            dataInput={nestedBibleItems.map((item, i): DataInputType => {
                return {
                    children: {
                        render: () => {
                            return (
                                <BibleViewRendererComp
                                    nestedBibleItems={item}
                                    isHorizontal={!isHorizontal}
                                    classPrefix={classPrefix}
                                />
                            );
                        },
                    },
                    key: `${typeText}${i + 1}`,
                    widgetName: 'Bible View',
                };
            })}
        />
    );
}
