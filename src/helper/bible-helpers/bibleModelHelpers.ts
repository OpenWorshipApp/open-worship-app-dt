import { freezeObject } from '../helpers';

import kjvBibleJson from './kjvBible.json';
import kjv1611BibleJson from './kjvBible1611.json';
import douayRheimsBibleJson from './douayRheimsBible.json';

import kjvNewLiners from './kjvNewLiners.json';
import { getSetting, setSetting } from '../settingHelpers';

export type BookType = {
    key: string;
    chapterCount: number;
};

export type BibleModelInfoType = {
    title: string;
    bookKeysOrder: string[];
    bookKeysOld: string[];
    apocryphalBooks?: string[];
    books: { [key: string]: BookType };
    keyBookMap: { [key: string]: string };
    oneChapterBooks: string[];
};

export enum BibleModelInfoEnum {
    KJV = 'KJV',
    KJV1611 = 'KJV1611',
    DR = 'DR',
}
export const bibleModelInfoTitleMap: { [key in BibleModelInfoEnum]: string } = {
    [BibleModelInfoEnum.KJV]: 'King James Version',
    [BibleModelInfoEnum.KJV1611]: 'King James Version 1611',
    [BibleModelInfoEnum.DR]: 'Douay Rheims',
};

const kjvBibleModelInfo = kjvBibleJson as BibleModelInfoType;
freezeObject(kjvBibleModelInfo);
const kjv1611BibleModelInfo = kjv1611BibleJson as BibleModelInfoType;
freezeObject(kjv1611BibleModelInfo);
const douayRheimsBibleModelInfo = douayRheimsBibleJson as BibleModelInfoType;
freezeObject(douayRheimsBibleModelInfo);

export const kjvNewLinerInfo = kjvNewLiners;
freezeObject(kjvNewLinerInfo);

const MODEL_BIBLE_INFO_SETTING_NAME = 'model-bible-info';
export function getBibleModelInfoSetting() {
    const setting = getSetting(MODEL_BIBLE_INFO_SETTING_NAME);
    if (
        setting === BibleModelInfoEnum.KJV1611 ||
        setting === BibleModelInfoEnum.DR
    ) {
        return setting;
    }
    return BibleModelInfoEnum.KJV;
}
export function setBibleModelInfoSetting(model: BibleModelInfoEnum) {
    setSetting(MODEL_BIBLE_INFO_SETTING_NAME, model);
}

export function getBibleModelInfo() {
    const setting = getBibleModelInfoSetting();
    if (setting === BibleModelInfoEnum.KJV1611) {
        return kjv1611BibleModelInfo;
    }
    if (setting === BibleModelInfoEnum.DR) {
        return douayRheimsBibleModelInfo;
    }
    return kjvBibleModelInfo;
}
