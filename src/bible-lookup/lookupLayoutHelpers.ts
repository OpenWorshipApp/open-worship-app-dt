import { getSetting } from '../helper/settingHelpers';
import { parseJsonSafely } from '../helper/helpers';
import {
    type FlexSizeType,
    setFlexSizeSetting,
    toSettingString,
} from '../resize-actor/flexSizeHelpers';

export const ADVANCE_LOOKUP_WIDGET_KEY = 'h3';

export function genLookupFlexSizeDefault(
    hasBibleAndNotes: boolean,
): FlexSizeType {
    return {
        ...(hasBibleAndNotes ? { h1: ['1'] as [string] } : {}),
        h2: ['3'],
        h3: ['1'],
    };
}

// Run before ResizeActor reads its setting: it resets a layout whose keys no
// longer match. Keep the saved Bible/Notes panes and migrate the old toolbar
// preference once; after that the section's own saved state is authoritative.
export function migrateLookupLayout(
    flexSizeName: string,
    hasBibleAndNotes: boolean,
    wasAdvanceLookupOpened: boolean,
) {
    const saved = parseJsonSafely(
        getSetting(toSettingString(flexSizeName)) ?? '',
    );
    if (saved?.[ADVANCE_LOOKUP_WIDGET_KEY]) {
        return;
    }
    const layout = genLookupFlexSizeDefault(hasBibleAndNotes);
    for (const key of hasBibleAndNotes ? ['h1', 'h2'] : ['h2']) {
        const value = saved?.[key];
        if (Array.isArray(value) && typeof value[0] === 'string') {
            layout[key] = value as FlexSizeType[string];
        }
    }
    if (!wasAdvanceLookupOpened || layout.h2[1]) {
        layout.h3 = ['1', ['second', 0]];
    }
    setFlexSizeSetting(flexSizeName, layout);
}
