import {
    getFlexSizeSetting,
    type FlexSizeType,
    type QuickMoveType,
    type DisabledType,
    setDisablingSetting,
    keyToDataFlexSizeKey,
} from './flexSizeHelpers';

export const DYN_SUFFIX = '-dyn-';

function getDynamicFlexSizeData(
    flexSizeName: string,
    defaultFlexSize: FlexSizeType,
    anotherDefaultFlexSize?: FlexSizeType,
) {
    if (anotherDefaultFlexSize === undefined) {
        return null;
    }
    const arr = flexSizeName.split(DYN_SUFFIX);
    if (arr.length !== 2) {
        return null;
    }
    const flexSizeNamePrefix = arr[0];
    const suffixType = arr[1];
    if (!['h', 'v'].includes(suffixType)) {
        return null;
    }
    const settingData = getFlexSizeSetting(flexSizeName, defaultFlexSize);
    const isHorizontal = suffixType === 'h';
    const anotherFlexSizeName =
        flexSizeNamePrefix + DYN_SUFFIX + (isHorizontal ? 'v' : 'h');
    const anotherSettingData = getFlexSizeSetting(
        anotherFlexSizeName,
        anotherDefaultFlexSize,
    );
    if (
        Object.keys(settingData).length !== 2 ||
        Object.keys(anotherSettingData).length !== 2
    ) {
        return null;
    }
    return {
        flexSizeName,
        isHorizontal,
        anotherFlexSizeName,
        settingData,
        anotherSettingData,
    } as {
        flexSizeName: string;
        isHorizontal: boolean;
        anotherFlexSizeName: string;
        settingData: FlexSizeType;
        anotherSettingData: FlexSizeType;
    };
}

function checkIsWidgetDisabled(flexSize: FlexSizeType) {
    return Object.values(flexSize).some(([, disabled]) => {
        return !!disabled;
    });
}
export function checkShouldQuickMove(
    flexSizeName: string,
    defaultFlexSize: FlexSizeType,
    anotherDefaultFlexSize?: FlexSizeType,
): QuickMoveType | null {
    const data = getDynamicFlexSizeData(
        flexSizeName,
        defaultFlexSize,
        anotherDefaultFlexSize,
    );
    if (data === null) {
        return null;
    }
    const { settingData, anotherSettingData } = data;
    if (checkIsWidgetDisabled(settingData)) {
        return null;
    }
    if (!checkIsWidgetDisabled(anotherSettingData)) {
        return null;
    }

    for (const disableData of Object.values(anotherSettingData)) {
        if (!disableData[1]) {
            continue;
        }
        const [disablingType]: DisabledType = disableData[1];
        if (disablingType === 'first') {
            return 'left';
        }
        if (disablingType === 'second') {
            return 'right';
        }
    }

    return null;
}

function checkShouldReopenHiddenWidget(
    flexSizeName: string,
    defaultFlexSize: FlexSizeType,
    anotherDefaultFlexSize?: FlexSizeType,
) {
    const data = getDynamicFlexSizeData(
        flexSizeName,
        defaultFlexSize,
        anotherDefaultFlexSize,
    );
    if (data === null) {
        return false;
    }
    const { settingData, anotherSettingData } = data;
    if (!checkIsWidgetDisabled(settingData)) {
        return false;
    }
    if (checkIsWidgetDisabled(anotherSettingData)) {
        return true;
    }

    return false;
}

export function reopenAnotherHiddenWidget(
    flexSizeName: string,
    defaultFlexSize: FlexSizeType,
    anotherDefaultFlexSize?: FlexSizeType,
) {
    if (
        !checkShouldReopenHiddenWidget(
            flexSizeName,
            defaultFlexSize,
            anotherDefaultFlexSize,
        )
    ) {
        return;
    }
    const data = getDynamicFlexSizeData(
        flexSizeName,
        defaultFlexSize,
        anotherDefaultFlexSize,
    );
    if (data === null) {
        return;
    }
    const { anotherFlexSizeName, anotherSettingData } = data;
    if (!checkIsWidgetDisabled(anotherSettingData)) {
        return;
    }
    for (const [key, flexSize] of Object.entries(anotherSettingData)) {
        if (!flexSize[1]) {
            continue;
        }
        const dataFlexSizeKey = keyToDataFlexSizeKey(anotherFlexSizeName, key);
        setDisablingSetting(
            anotherFlexSizeName,
            anotherSettingData,
            dataFlexSizeKey,
        );
    }
}
