import { freezeObject } from '../helpers';

import kjvBibleJson from './kjvBible.json';
import kjvdBibleJson from './kjvdBible.json';
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

const kjvBibleModelInfo = kjvBibleJson as BibleModelInfoType;
freezeObject(kjvBibleModelInfo);
const kjvdBibleModelInfo = kjvdBibleJson as BibleModelInfoType;
freezeObject(kjvdBibleModelInfo);
const douayRheimsBibleModelInfo = douayRheimsBibleJson as BibleModelInfoType;
freezeObject(douayRheimsBibleModelInfo);

export const kjvNewLinerInfo = kjvNewLiners;
freezeObject(kjvNewLinerInfo);

export enum BibleModelInfoEnum {
    KJV = 'KJV',
    KJVD = 'KJVD',
    DR = 'DR',
}
export const bibleModelInfoTitleMap: { [key in BibleModelInfoEnum]: string } = {
    [BibleModelInfoEnum.KJV]: kjvBibleModelInfo.title,
    [BibleModelInfoEnum.KJVD]: kjvdBibleModelInfo.title,
    [BibleModelInfoEnum.DR]: douayRheimsBibleModelInfo.title,
};

const MODEL_BIBLE_INFO_SETTING_NAME = 'model-bible-info';
export function getBibleModelInfoSetting() {
    const setting = getSetting(MODEL_BIBLE_INFO_SETTING_NAME);
    if (
        setting === BibleModelInfoEnum.KJVD ||
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
    if (setting === BibleModelInfoEnum.KJVD) {
        return kjvdBibleModelInfo;
    }
    if (setting === BibleModelInfoEnum.DR) {
        return douayRheimsBibleModelInfo;
    }
    return kjvBibleModelInfo;
}
