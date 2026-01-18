import {
    DEFAULT_LOCALE,
    getLangDataAsync,
    LocaleType,
    tran,
} from '../../lang/langHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../../popup-widget/popupWidgetHelpers';
import { genBibleKeyXMLInput } from './bibleXMLAttributesGuessing';
import { getDownloadedBibleInfoList } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { cloneJson } from '../../helper/helpers';
import {
    bibleDataReader,
    ContentTitleType,
    CustomVerseType,
} from '../../helper/bible-helpers/BibleDataReader';
import { fsListFiles, pathJoin } from '../../server/fileHelpers';
import FileSource from '../../helper/FileSource';
import CacheManager from '../../others/CacheManager';
import { unlockingCacher } from '../../server/unlockingHelpers';
import { getModelKeyBookMap } from '../../helper/bible-helpers/bibleLogicHelpers1';
import { getBibleModelInfo } from '../../helper/bible-helpers/bibleModelHelpers';
import { handleError } from '../../helper/errorHelpers';

const bibleKeyFilePathCache = new CacheManager();
export async function getBibleKeyFromFile(filePath: string) {
    return unlockingCacher(
        filePath,
        async () => {
            const xmlText = await FileSource.readFileData(filePath);
            if (xmlText === null) {
                return null;
            }
            const xmlElementBible = xmlTextToBibleElement(xmlText);
            if (!xmlElementBible) {
                return null;
            }
            const bibleKey = await guessingBibleKey(xmlElementBible);
            return bibleKey;
        },
        bibleKeyFilePathCache,
        true,
    );
}

export async function getAllXMLFileKeys() {
    const dirPath = await bibleDataReader.getWritableBiblePath();
    const files = await fsListFiles(dirPath);
    const entries = await Promise.all(
        files.map(async (fileFullName) => {
            if (!fileFullName.toLocaleLowerCase().endsWith('.xml')) {
                return null;
            }
            const filePath = pathJoin(dirPath, fileFullName);
            const bibleKey = await getBibleKeyFromFile(filePath);
            if (bibleKey === null) {
                return null;
            }
            return [bibleKey, filePath] as const;
        }),
    ).then((results) =>
        results.filter((entry) => {
            return entry !== null;
        }),
    );
    return Object.fromEntries(entries) as { [bibleKey: string]: string };
}

/**
 * {
 *     "info": {
 *         "title": "Title of bible. e.g: King James Version",
 *         "key": "Bible key. e.g: KJV",
 *         "version": <version of data. e.g: 1>,
 *         "locale": "Language of bible. e.g: en",
 *         "legalNote": "Legal note of bible. e.g: Public Domain",
 *         "publisher": "Publisher of bible. e.g: Bible Society",
 *         "copyRights": "Copy rights of bible. e.g: Public Domain",
 *         "books": {
 *             "GEN": "GENESIS",
 *         },
 *         "numbersMap": {
 *            "0": "0",
 *            "1": "1"
 *         },
 *         "filePath": "Path of file. e.g: /path/to/file.xml"
 *     }
 *     "books": {
 *         "GEN": {
 *             "1": "In the beginning God created the heavens and the earth."
 *         }
 *     }
 * }
 */
const tagNamesMap = {
    bible: ['bible'],
    map: ['map'],
    numberMap: ['number-map'],
    bookMap: ['book-map'],
    book: ['book'],
    chapter: ['chapter'],
    verse: ['verse'],
};

const attributesMap = {
    bibleKey: ['key', 'abbr'],
    locale: ['locale'],
    title: ['title', 'name', 'translation'],
    description: ['description', 'desc'],
    version: ['version'],
    legalNote: ['legalNote', 'status'],
    publisher: ['publisher'],
    copyRights: ['copyRights'],
    bookKey: ['key'],
    index: ['number', 'index', 'id'],
    mapKey: ['key'],
    mapValue: ['value'],
};

export type BibleVerseType = {
    [verseNumber: string]: string;
};

export type BibleBookJsonType = {
    [chapterNumber: string]: BibleVerseType;
};

export type BibleJsonInfoType = {
    title: string;
    description: string;
    key: string;
    version: number;
    locale: LocaleType;
    legalNote: string;
    publisher: string;
    copyRights: string;
    keyBookMap: { [booKey: string]: string };
    booksAvailable: string[];
    numbersMap: { [key: string]: string };
};

export type BibleXMLExtraType = {
    newLines: string[];
    newLinesTitleMap: { [key: string]: ContentTitleType[] };
    customVersesMap: { [key: string]: CustomVerseType[] };
};
export type BibleXMLJsonType = BibleXMLExtraType & {
    info: BibleJsonInfoType;
    books: { [booKey: string]: BibleBookJsonType };
};

function guessValue(
    xmlElement: Element,
    bibleKeys: string[],
    defaultValue: string | null = null,
) {
    for (const bibleKey of bibleKeys) {
        const value = xmlElement.getAttribute(bibleKey);
        if (value !== null) {
            return value;
        }
    }
    return defaultValue;
}

function guessElement(xmlElement: Element | Document, tags: string[]) {
    for (const tag of tags) {
        const child = xmlElement.getElementsByTagName(tag);
        if (child !== null) {
            return child;
        }
    }
    return null;
}

function getBibleMap(
    xmlElementMap: Element | null,
    tags: string[],
    defaultMap: { [key: string]: string },
) {
    const bookKeyMap: { [key: string]: string } = defaultMap;
    const bookKeyMapElements =
        xmlElementMap === null
            ? []
            : Array.from(guessElement(xmlElementMap, tags) ?? []);
    for (const bookKeyMapElement of bookKeyMapElements) {
        const bibleKey = guessValue(bookKeyMapElement, attributesMap.mapKey);
        const value = guessValue(bookKeyMapElement, attributesMap.mapValue);
        if (bibleKey === null || value === null) {
            continue;
        }
        bookKeyMap[bibleKey] = value;
    }
    return bookKeyMap;
}

function toGuessingBibleKeys(value: string) {
    return value
        .split(/[.,\s]/)
        .map((value1) => {
            return value1.trim();
        })
        .filter(Boolean);
}

function getGuessingBibleKeys(xmlElementBible: Element) {
    const guessingKeys: string[] = [];
    for (const attribute of Array.from(xmlElementBible.attributes)) {
        const value = attribute.nodeValue;
        if (value) {
            guessingKeys.push(...toGuessingBibleKeys(value));
        }
    }
    return Array.from(new Set(guessingKeys));
}

function getBookKey(xmlElementBook: Element) {
    const bibleModelInfo = getBibleModelInfo();
    const bookKeysOrder = bibleModelInfo.bookKeysOrder;
    let bookKey = guessValue(xmlElementBook, attributesMap.bookKey, null);
    if (bookKey !== null && bookKeysOrder.includes(bookKey)) {
        return bookKey;
    }
    const bookNumberText = guessValue(
        xmlElementBook,
        attributesMap.index,
        null,
    );
    if (bookNumberText === null) {
        return null;
    }
    const bookIndex = Number.parseInt(bookNumberText);
    if (Number.isNaN(bookIndex)) {
        return null;
    }
    bookKey = bookKeysOrder[bookIndex - 1];
    if (bookKey === undefined) {
        return null;
    }
    return bookKey;
}

async function guessingBibleKey(xmlElementBible: Element) {
    let bibleKey = guessValue(xmlElementBible, attributesMap.bibleKey);
    while (bibleKey === null) {
        const downloadedBibleInfoList = await getDownloadedBibleInfoList();
        if (downloadedBibleInfoList === null) {
            return null;
        }
        const bibleKeysMap = await getAllXMLFileKeys();
        const takenBibleKeys = new Set(Object.keys(bibleKeysMap));
        for (const info of downloadedBibleInfoList) {
            takenBibleKeys.add(info.key);
        }
        let newKey = '';
        const isConfirmInput = await showAppInput(
            tran('Key is missing'),
            genBibleKeyXMLInput(
                newKey,
                (newKey1) => {
                    newKey = newKey1;
                },
                Array.from(takenBibleKeys),
                getGuessingBibleKeys(xmlElementBible),
            ),
            {
                extraStyles: { maxWidth: '700px' },
            },
        );
        if (isConfirmInput) {
            bibleKey = newKey;
        }
        const isConfirm = await showAppConfirm(
            'Confirm Key Value',
            bibleKey
                ? `Do you want to continue with key="${bibleKey}"?`
                : 'Are you sure you want to quite?',
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (isConfirm) {
            break;
        } else {
            bibleKey = null;
        }
    }
    return bibleKey;
}

function getAvailableBooks(xmlElementBooks: Element[]) {
    const availableBooks: string[] = [];
    const modelKeyBook = getModelKeyBookMap();
    for (const book of xmlElementBooks) {
        const bookKey = getBookKey(book);
        if (bookKey !== null && modelKeyBook[bookKey]) {
            availableBooks.push(bookKey);
        }
    }
    return availableBooks;
}

function getBookElements(xmlElementBible: Element) {
    return Array.from(guessElement(xmlElementBible, tagNamesMap.book) ?? []);
}

function getNewLines(xmlElementBible: Element) {
    const result = guessElement(xmlElementBible, [
        'new-lines',
        'newlines',
        'new_lines',
    ]);
    if (!result?.length) {
        return [];
    }
    const xmlElementNewLines = result[0];
    const itemElements = Array.from(
        guessElement(xmlElementNewLines, ['item']) ?? [],
    );
    const newLines: string[] = [];
    for (const xmlElement of itemElements) {
        if (xmlElement.textContent) {
            const text = xmlElement.textContent.trim();
            if (!text) {
                continue;
            }
            newLines.push(text);
        }
    }
    return newLines;
}
function setNewLines(
    xmlDoc: Document,
    xmlElementBible: Element,
    newLines: string[],
) {
    const xmlElementNewLines = xmlDoc.createElement('new-lines');
    xmlElementBible.appendChild(xmlElementNewLines);
    for (const newLine of newLines) {
        const xmlElementItem = xmlDoc.createElement('item');
        xmlElementItem.textContent = newLine;
        xmlElementNewLines.appendChild(xmlElementItem);
    }
}

function readContentJson<T>(xmlElement: Element) {
    if (xmlElement.textContent) {
        try {
            const data = JSON.parse(
                xmlElement.textContent.replaceAll(/(^<!\[CDATA\[|\]\]>$)/g, ''),
            ) as T;
            return data;
        } catch (error) {
            handleError(`Fail to parse custom verses map, error: ${error}`);
        }
    }
    return null;
}

function getNewLinesTitleMap(xmlElementBible: Element) {
    const result = guessElement(xmlElementBible, [
        'new-lines-title-map',
        'newlinestitlemap',
        'new_lines_title_map',
    ]);
    if (!result?.length) {
        return {};
    }
    const xmlElementNewLines = result[0];
    const itemElements = Array.from(
        guessElement(xmlElementNewLines, ['item']) ?? [],
    );
    const newLinesTitleMap: { [key: string]: ContentTitleType[] } = {};
    for (const xmlElement of itemElements) {
        if (xmlElement.textContent) {
            const key = xmlElement.getAttribute('key');
            if (!key) {
                continue;
            }
            const data = readContentJson<ContentTitleType[]>(xmlElement);
            if (!data?.length) {
                continue;
            }
            newLinesTitleMap[key] = data;
        }
    }
    return newLinesTitleMap;
}
function setNewLinesTitleMap(
    xmlDoc: Document,
    xmlElementBible: Element,
    newLinesTitleMap: { [key: string]: ContentTitleType[] },
) {
    const xmlElementNewLinesTitleMap = xmlDoc.createElement(
        'new-lines-title-map',
    );
    xmlElementBible.appendChild(xmlElementNewLinesTitleMap);
    for (const [key, value] of Object.entries(newLinesTitleMap)) {
        const xmlElementItem = xmlDoc.createElement('item');
        xmlElementItem.setAttribute('key', key);
        xmlElementItem.textContent = `<![CDATA[${JSON.stringify(value)}]]>`;
        xmlElementNewLinesTitleMap.appendChild(xmlElementItem);
    }
}

function getCustomVersesMap(xmlElementBible: Element) {
    const result = guessElement(xmlElementBible, [
        'custom-verses-map',
        'customversesmap',
        'custom_verses_map',
    ]);
    if (!result?.length) {
        return {};
    }
    const xmlElementCustomVersesMap = result[0];
    const itemElements = Array.from(
        guessElement(xmlElementCustomVersesMap, ['item']) ?? [],
    );
    const customVersesMap: { [key: string]: CustomVerseType[] } = {};
    for (const xmlElement of itemElements) {
        if (xmlElement.textContent) {
            const key = xmlElement.getAttribute('key');
            if (!key) {
                continue;
            }
            const data = readContentJson<CustomVerseType[]>(xmlElement);
            if (data === null) {
                continue;
            }
            customVersesMap[key] = data;
        }
    }
    return customVersesMap;
}
function setCustomVersesMap(
    xmlDoc: Document,
    xmlElementBible: Element,
    customVersesMap: { [key: string]: CustomVerseType[] },
) {
    const xmlElementCustomVersesMap = xmlDoc.createElement('custom-verses-map');
    for (const [key, value] of Object.entries(customVersesMap)) {
        const xmlElementItem = xmlDoc.createElement('item');
        xmlElementItem.setAttribute('key', key);
        xmlElementItem.textContent = `<![CDATA[${JSON.stringify(value)}]]>`;
        xmlElementCustomVersesMap.appendChild(xmlElementItem);
    }
    xmlElementBible.appendChild(xmlElementCustomVersesMap);
}

export async function getBibleInfoJson(
    xmlElementBible: Element,
): Promise<BibleJsonInfoType | null> {
    const xmlElementMap = guessElement(xmlElementBible, tagNamesMap.map)?.[0];
    const numbersMap = getBibleMap(
        xmlElementMap ?? null,
        tagNamesMap.numberMap,
        Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [i.toString(), i.toString()]),
        ),
    );
    const locale = (guessValue(xmlElementBible, attributesMap.locale) ??
        DEFAULT_LOCALE) as LocaleType;
    const keyBookMap = getBibleMap(
        xmlElementMap ?? null,
        tagNamesMap.bookMap,
        cloneJson(getModelKeyBookMap()),
    );
    const langData = await getLangDataAsync(locale);
    if (langData !== null) {
        for (const [key, value] of Object.entries(keyBookMap)) {
            keyBookMap[key] = langData.sanitizeText(value);
        }
    }
    const bibleKey = await guessingBibleKey(xmlElementBible);
    if (bibleKey === null) {
        return null;
    }
    const xmlElementBooks = Array.from(
        guessElement(xmlElementBible, tagNamesMap.book) ?? [],
    );
    const booksAvailable = getAvailableBooks(xmlElementBooks);
    const title =
        guessValue(xmlElementBible, attributesMap.title) ?? 'Unknown Title';
    const description =
        guessValue(xmlElementBible, attributesMap.description) ??
        'Unknown Description';
    const version =
        Number.parseInt(
            guessValue(xmlElementBible, attributesMap.version) ?? '1',
        ) ?? 1;
    const legalNote =
        guessValue(xmlElementBible, attributesMap.legalNote) ??
        'Unknown Legal Note';
    const publisher =
        guessValue(xmlElementBible, attributesMap.publisher) ??
        'Unknown Publisher';
    const copyRights =
        guessValue(xmlElementBible, attributesMap.copyRights) ??
        'Unknown Copy Rights';
    const bibleInfo = {
        title,
        description,
        key: bibleKey,
        version,
        locale,
        legalNote,
        publisher,
        copyRights,
        numbersMap,
        keyBookMap,
        booksAvailable,
    };
    return bibleInfo;
}
function setBibleInfo(
    xmlDoc: Document,
    xmlElementBible: Element,
    bibleInfo: BibleJsonInfoType,
) {
    const { numbersMap, keyBookMap, ...restInfo } = bibleInfo;
    const bibleInfoKey = Object.keys(restInfo).filter((key) => {
        return !['filePath'].includes(key);
    });
    for (const key of bibleInfoKey) {
        const value = restInfo[key as keyof typeof restInfo];
        xmlElementBible.setAttribute(key, value.toString());
    }
    const xmlElementMap = xmlDoc.createElement(tagNamesMap.map[0]);
    for (const [key, value] of Object.entries(numbersMap)) {
        const xmlElementNumberMap = xmlDoc.createElement(
            tagNamesMap.numberMap[0],
        );
        xmlElementNumberMap.setAttribute(attributesMap.mapKey[0], key);
        xmlElementNumberMap.setAttribute(attributesMap.mapValue[0], value);
        xmlElementMap.appendChild(xmlElementNumberMap);
    }
    for (const [key, value] of Object.entries(keyBookMap)) {
        const xmlElementBookMap = xmlDoc.createElement(tagNamesMap.bookMap[0]);
        xmlElementBookMap.setAttribute(attributesMap.mapKey[0], key);
        xmlElementBookMap.setAttribute(attributesMap.mapValue[0], value);
        xmlElementMap.appendChild(xmlElementBookMap);
    }
    xmlElementBible.appendChild(xmlElementMap);
}

function getBibleVerses(xmlElementChapter: Element): BibleVerseType {
    const verseJson: BibleVerseType = {};
    const verses = Array.from(
        guessElement(xmlElementChapter, tagNamesMap.verse) || [],
    );
    for (const verse of verses) {
        const verseNumber = guessValue(verse, attributesMap.index, null);
        if (verseNumber === null || verse.textContent === null) {
            continue;
        }
        verseJson[verseNumber] = verse.textContent;
    }
    return verseJson;
}

function getBibleChapters(xmlElementBook: Element): BibleBookJsonType {
    const bookJson: BibleBookJsonType = {};
    const chapters = Array.from(
        guessElement(xmlElementBook, tagNamesMap.chapter) ?? [],
    );
    for (const chapter of chapters) {
        const chapterNumber = guessValue(chapter, attributesMap.index, null);
        if (chapterNumber === null) {
            continue;
        }
        bookJson[chapterNumber] = getBibleVerses(chapter);
    }
    return bookJson;
}

function getBibleBooksJson(xmlElementBible: Element) {
    const xmlElementBooks = getBookElements(xmlElementBible);
    const booksJson: { [booKey: string]: BibleBookJsonType } = {};
    for (const xmlElementBook of xmlElementBooks) {
        const bookKey = getBookKey(xmlElementBook);
        if (bookKey === null) {
            continue;
        }
        booksJson[bookKey] = getBibleChapters(xmlElementBook);
    }
    for (const book of Object.values(booksJson)) {
        if (Object.keys(book).length === 0) {
            return null;
        }
    }
    return booksJson;
}
function setBibleBooks(
    xmlDoc: Document,
    xmlElementBible: Element,
    books: { [booKey: string]: BibleBookJsonType },
) {
    for (const [bookKey, book] of Object.entries(books)) {
        const xmlElementBook = xmlDoc.createElement(tagNamesMap.book[0]);
        xmlElementBook.setAttribute(attributesMap.bookKey[0], bookKey);
        for (const [chapterKey, chapter] of Object.entries(book)) {
            const chapterElement = xmlDoc.createElement(tagNamesMap.chapter[0]);
            chapterElement.setAttribute(attributesMap.index[0], chapterKey);
            for (const [verseKey, verse] of Object.entries(chapter)) {
                const verseElement = xmlDoc.createElement(tagNamesMap.verse[0]);
                verseElement.setAttribute(attributesMap.index[0], verseKey);
                verseElement.textContent = verse;
                chapterElement.appendChild(verseElement);
            }
            xmlElementBook.appendChild(chapterElement);
        }
        xmlElementBible.appendChild(xmlElementBook);
    }
}

export function jsonToXMLText(jsonData: BibleXMLJsonType) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(
        '<?xml version="1.0" encoding="UTF-8"?><bible></bible>',
        'application/xml',
    );

    const xmlElementBible = xmlDoc.getElementsByTagName('bible')[0];
    setBibleInfo(xmlDoc, xmlElementBible, jsonData.info);
    const { newLines, newLinesTitleMap, customVersesMap } = jsonData;
    setNewLines(xmlDoc, xmlElementBible, newLines);
    setNewLinesTitleMap(xmlDoc, xmlElementBible, newLinesTitleMap);
    setCustomVersesMap(xmlDoc, xmlElementBible, customVersesMap);
    const books = jsonData.books;
    setBibleBooks(xmlDoc, xmlElementBible, books);
    const serializer = new XMLSerializer();
    let xmlText = serializer.serializeToString(xmlDoc);
    xmlText = xmlText.replaceAll('><', '>\n<');
    if (xmlText.match(/<book\s/gi)?.length !== Object.keys(books).length) {
        return null;
    }
    return xmlText;
}

export function xmlTextToBibleElement(xmlText: string) {
    const bibleModelInfo = getBibleModelInfo();
    for (const [key, value] of Object.entries(bibleModelInfo.flippingKey)) {
        xmlText = xmlText.replaceAll(key, value);
    }
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const bible = guessElement(xmlDoc, tagNamesMap.bible)?.[0];
    return bible;
}

export async function xmlTextToJson(
    xmlText: string,
): Promise<BibleXMLJsonType | null> {
    const xmlElementBible = xmlTextToBibleElement(xmlText);
    if (!xmlElementBible) {
        return null;
    }
    const bibleInfo = await getBibleInfoJson(xmlElementBible);
    if (bibleInfo === null) {
        return null;
    }
    const bibleBooks = getBibleBooksJson(xmlElementBible);
    if (bibleBooks === null) {
        return null;
    }
    const newLines = getNewLines(xmlElementBible);
    const newLinesTitleMap = getNewLinesTitleMap(xmlElementBible);
    const customVersesMap = getCustomVersesMap(xmlElementBible);
    const bibleXMLData = {
        info: bibleInfo,
        books: bibleBooks,
        newLines,
        newLinesTitleMap,
        customVersesMap,
    };
    return bibleXMLData;
}

export async function bibleKeyToXMLFilePath(
    bibleKey: string,
    isFromFileName = false,
) {
    if (isFromFileName) {
        const dirPath = await bibleDataReader.getWritableBiblePath();
        const filePath = pathJoin(dirPath, `${bibleKey}.xml`);
        return filePath;
    }
    const bibleKeyFilePathMap = await getAllXMLFileKeys();
    const filePath = bibleKeyFilePathMap[bibleKey];
    if (filePath) {
        return filePath;
    }
    handleError(
        'Fail to get Bible file path' +
            `Unable to find file path for: "${bibleKey}"`,
    );
    return null;
}
