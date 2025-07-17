import { CSSProperties, LazyExoticComponent } from 'react';

import { handleError } from '../helper/errorHelpers';
import { isValidJson } from '../helper/helpers';
import { setSetting, getSetting } from '../helper/settingHelpers';

export type FlexSizeType = {
    [key: string]: [string, DisabledType?];
};
export type DataInputType = {
    children:
        | LazyExoticComponent<(props?: any) => React.ReactNode | null>
        | {
              render: () => React.ReactNode | null;
          };
    key: string;
    widgetName: string;
    className?: string;
    extraStyle?: CSSProperties;
};

export const settingPrefix = 'widget-size';
export const disablingTargetTypeList = ['first', 'second'] as const;
export type DisablingTargetType = (typeof disablingTargetTypeList)[number];
export type DisabledType = [DisablingTargetType, number];
export const resizeSettingNames = {
    appEditor: 'app-editor-main',
    appEditorLeft: 'app-editor-left',
    appPresenter: 'app-presenter-main',
    appPresenterLeft: 'app-presenter-left',
    appPresenterMiddle: 'app-presenter-middle',
    appPresenterRight: 'app-presenter-right',
    slideEditor: 'slide-editor',
    read: 'read',
};

export function clearWidgetSizeSetting() {
    Object.values(resizeSettingNames).forEach((name) => {
        setSetting(`${toSettingString(name)}`, '');
    });
}
export function toSettingString(flexSizeName: string) {
    return `${settingPrefix}-${flexSizeName}`;
}
export function dataFlexSizeKeyToKey(
    flexSizeName: string,
    dataFlexSizeKey: string,
) {
    return dataFlexSizeKey.replace(`${flexSizeName}-`, '');
}
export function keyToDataFlexSizeKey(flexSizeName: string, key: string) {
    return `${flexSizeName}-${key}`;
}

export const setDisablingSetting = (
    flexSizeName: string,
    defaultSize: FlexSizeType,
    dataFlexSizeKey: string,
    target?: DisabledType,
) => {
    const settingString = toSettingString(flexSizeName);
    const flexSize = getFlexSizeSetting(flexSizeName, defaultSize);
    const key = dataFlexSizeKeyToKey(flexSizeName, dataFlexSizeKey);
    flexSize[key][1] = target;
    setSetting(settingString, JSON.stringify(flexSize));
    return flexSize;
};

export function clearFlexSizeSetting(flexSizeName: string) {
    const settingString = toSettingString(flexSizeName);
    setSetting(settingString, '');
}

export const genFlexSizeSetting = (
    flexSizeName: string,
    defaultSize: FlexSizeType,
) => {
    const selectorString = `[data-fs^="${flexSizeName}"]`;
    const collection =
        document.querySelectorAll<HTMLDivElement>(selectorString);
    const items = Array.from(collection);
    const flexSize = getFlexSizeSetting(flexSizeName, defaultSize);
    items.forEach((item) => {
        const dataFlexSizeKey = item.getAttribute('data-fs');
        if (dataFlexSizeKey !== null) {
            const key = dataFlexSizeKeyToKey(flexSizeName, dataFlexSizeKey);
            if (flexSize[key]) {
                flexSize[key][0] = item.style.flex;
            }
        }
    });
    return flexSize;
};

export const setFlexSizeSetting = (
    flexSizeName: string,
    flexSize: FlexSizeType,
) => {
    const settingString = toSettingString(flexSizeName);
    setSetting(settingString, JSON.stringify(flexSize));
};

export function getFlexSizeSetting(
    flexSizeName: string,
    defaultSize: FlexSizeType,
): FlexSizeType {
    const settingString = toSettingString(flexSizeName);
    const str = getSetting(settingString) ?? '';
    try {
        if (isValidJson(str, true)) {
            const size = JSON.parse(str);
            if (
                Object.keys(defaultSize).every((k) => {
                    const fsValue = size[k];
                    if (
                        !fsValue ||
                        fsValue.length === 0 ||
                        (fsValue[1] &&
                            !disablingTargetTypeList.includes(fsValue[1][0]) &&
                            typeof fsValue[1][1] !== 'number')
                    ) {
                        return false;
                    }
                    return true;
                })
            ) {
                return size;
            }
        }
    } catch (error) {
        handleError(error);
    }
    setSetting(settingString, JSON.stringify(defaultSize));
    return getFlexSizeSetting(flexSizeName, defaultSize);
}

function checkIsHiddenWidget(
    dataInput: DataInputType[],
    flexSize: FlexSizeType,
    index: number,
) {
    const preKey = dataInput[index]['key'];
    const preFlexSizeValue = flexSize[preKey];
    return !!preFlexSizeValue[1];
}

export function checkIsThereNotHiddenWidget(
    dataInput: DataInputType[],
    flexSize: FlexSizeType,
    startIndex: number,
    endIndex?: number,
) {
    endIndex = endIndex ?? dataInput.length - 1;
    for (let i = startIndex; i < endIndex; i++) {
        if (!checkIsHiddenWidget(dataInput, flexSize, i)) {
            return true;
        }
    }
    return false;
}

export function calcShowingHiddenWidget(
    event: any,
    key: string,
    flexSizeName: string,
    defaultFlexSize: FlexSizeType,
    flexSizeDisabled: DisabledType,
) {
    const dataFlexSizeKey = keyToDataFlexSizeKey(flexSizeName, key);
    setDisablingSetting(flexSizeName, defaultFlexSize, dataFlexSizeKey);
    const current = event.currentTarget;
    const target = (
        flexSizeDisabled[0] === 'first'
            ? current.nextElementSibling
            : current.previousElementSibling
    ) as HTMLDivElement;
    const targetFGrow = Number(target.style.flexGrow);
    const flexGrow = targetFGrow - flexSizeDisabled[1];
    target.style.flexGrow = `${flexGrow < targetFGrow / 10 ? targetFGrow : flexGrow}`;
    const size = genFlexSizeSetting(flexSizeName, defaultFlexSize);
    return size;
}
