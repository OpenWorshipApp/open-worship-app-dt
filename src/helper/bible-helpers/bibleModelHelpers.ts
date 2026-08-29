import { freezeObject } from '../helpers';

import kjvBibleConfigJson from './kjvBibleConfig.json';
import kjvdBibleJson from './kjvdBible.json';
import douayRheimsBibleJson from './douayRheimsBible.json';

import modelNewLiners from './newLiners.json';
import SettingManager from '../SettingManager';

export type BookType = {
    key: string;
    chapterCount: number;
};

export type BookSubtypeType = {
    title: string;
    type:
        | 'law'
        | 'history'
        | 'poetry'
        | 'majorProphets'
        | 'minorProphets'
        | 'gospels'
        | 'historyActs'
        | 'paulineEpistles'
        | 'generalEpistles'
        | 'prophecyRevelation';
    bookKeys: string[];
};

export type BibleModelInfoType = {
    title: string;
    bookKeysOrder: string[];
    bookKeysOld: string[];
    apocryphalBooks?: string[];
    books: { [key: string]: BookType };
    keyBookMap: { [key: string]: string };
    oneChapterBooks: string[];
    flippingKey: { [key: string]: string };
    bookKeysSubtype?: BookSubtypeType[];
};

export const BIBLE_KJV_KEY = 'KJV';

export const kjvBibleModelInfo = kjvBibleConfigJson as BibleModelInfoType;
freezeObject(kjvBibleModelInfo);
const kjvdBibleModelInfo = kjvdBibleJson as BibleModelInfoType;
freezeObject(kjvdBibleModelInfo);
const douayRheimsBibleModelInfo = douayRheimsBibleJson as BibleModelInfoType;
freezeObject(douayRheimsBibleModelInfo);

export const modelNewLinerInfo: string[] = modelNewLiners;
freezeObject(modelNewLinerInfo);

export enum BibleModelInfoEnum {
    KJV = BIBLE_KJV_KEY,
    KJVD = 'KJVD',
    DR = 'DR',
}
export const bibleModelInfoTitleMap: { [key in BibleModelInfoEnum]: string } = {
    [BibleModelInfoEnum.KJV]: kjvBibleModelInfo.title,
    [BibleModelInfoEnum.KJVD]: kjvdBibleModelInfo.title,
    [BibleModelInfoEnum.DR]: douayRheimsBibleModelInfo.title,
};

const bibleModelInfoSettingManager = new SettingManager<BibleModelInfoEnum>({
    settingName: 'model-bible-info',
    defaultValue: BibleModelInfoEnum.KJV,
    isErrorToDefault: true,
    validate: (value) => {
        return Object.values<string>(BibleModelInfoEnum).includes(value);
    },
});
export function getBibleModelInfoSetting() {
    return bibleModelInfoSettingManager.getSetting();
}
export function setBibleModelInfoSetting(model: BibleModelInfoEnum) {
    bibleModelInfoSettingManager.setSetting(model);
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
