import { freezeObject } from '../helpers';

import kjvBibleJson from './kjvBible.json';
import kjv1611BibleJson from './kjvBible1611.json';
import douayRheimsBibleJson from './douayRheimsBible.json';

import kjvNewLiners from './kjvNewLiners.json';

export type BookType = {
    key: string;
    chapterCount: number;
};

export type ModelBibleInfoType = {
    title: string;
    bookKeysOrder: string[];
    bookKeysOld: string[];
    books: { [key: string]: BookType };
    keyBookMap: { [key: string]: string };
    oneChapterBooks: string[];
};

const kjvModelBibleInfo = kjvBibleJson as ModelBibleInfoType;
freezeObject(kjvModelBibleInfo);
const kjv1611ModelBibleInfo = kjv1611BibleJson as ModelBibleInfoType;
freezeObject(kjv1611ModelBibleInfo);
const douayRheimsModelBibleInfo = douayRheimsBibleJson as ModelBibleInfoType;
freezeObject(douayRheimsModelBibleInfo);

export const kjvNewLinerInfo = kjvNewLiners;
freezeObject(kjvNewLinerInfo);

export function getModelBibleInfo() {
    return kjvModelBibleInfo;
}
