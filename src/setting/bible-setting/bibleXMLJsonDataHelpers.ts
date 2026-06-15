import type { LocaleType } from '../../lang/langHelpers';
import { DEFAULT_LOCALE, getLangDataAsync, tran } from '../../lang/langHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../../popup-widget/popupWidgetHelpers';
import { genBibleKeyXMLInput } from './bibleXMLAttributesGuessing';
import { getDownloadedBibleInfoList } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { cloneJson } from '../../helper/helpers';
import type {
    ContentTitleType,
    CustomVerseType,
} from '../../helper/bible-helpers/BibleDataReader';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';
import { fsListFiles, pathJoin } from '../../server/fileHelpers';
import FileSource from '../../helper/FileSource';
import CacheManager from '../../others/CacheManager';
import { unlockingCacher } from '../../server/unlockingHelpers';
import { getModelKeyBookMap } from '../../helper/bible-helpers/bibleLogicHelpers1';
import { getBibleModelInfo } from '../../helper/bible-helpers/bibleModelHelpers';
import { handleError } from '../../helper/errorHelpers';
import {
    appXMLParser,
    appXMLSerializer,
    optimizeXMLText,
    type OptimizeXMLTextOptions,
} from '../../helper/xmlHelpers';
import { appLog } from '../../helper/loggerHelpers';

const bibleKeyFilePathCache = new CacheManager();
export async function getBibleKeyFromFile(filePath: string) {
    return unlockingCacher(
        'bible-key-' + filePath,
        async () => {
            const xmlText = await FileSource.readFileData(filePath);
            if (xmlText === null) {
                return null;
            }
            const bibleKey = guessValue(xmlText, attributesMap.bibleKey);
            return bibleKey;
        },
        bibleKeyFilePathCache,
        true,
    );
}

export async function getAllXMLFileKeys() {
    const dirPath = await bibleDataReader.getWritableBiblePath();
    const files = await fsListFiles(dirPath);
    const xmlFileFullNames = files.filter((fileFullName) => {
        if (fileFullName.startsWith('.')) {
            return false;
        }
        return fileFullName.toLocaleLowerCase().endsWith('.xml');
    });
    const xmlFilePaths = xmlFileFullNames.map((fileFullName) => {
        return pathJoin(dirPath, fileFullName);
    });
    const entries = await Promise.all(
        xmlFilePaths.map(async (filePath) => {
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
    testament: ['testament'],
    book: ['book'],
    chapter: ['chapter'],
    verse: ['verse'],
    newLines: ['new-lines', 'newlines', 'new_lines'],
    newLinesTitleMap: [
        'new-lines-title-map',
        'newlinestitlemap',
        'new_lines_title_map',
    ],
    customVersesMap: [
        'custom-verses-map',
        'customversesmap',
        'custom_verses_map',
    ],
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
    xmlElementOrText: Element | string,
    keys: string[],
    defaultValue: string | null = null,
) {
    let xmlElement: Element | null = null;
    if (typeof xmlElementOrText === 'string') {
        xmlElement = xmlTextToBibleElement(xmlElementOrText, {
            keys,
        });
    } else {
        xmlElement = xmlElementOrText;
    }
    if (!xmlElement) {
        return defaultValue;
    }
    for (const key of keys) {
        const value = xmlElement.getAttribute(key);
        if (value !== null) {
            return value;
        }
    }
    return defaultValue;
}

function guessElement(
    xmlElementOrText: Element | Document | string,
    tags: string[],
    optimizeOptions: OptimizeXMLTextOptions = {},
) {
    optimizeOptions.childTags = (optimizeOptions.childTags ?? []).concat(tags);
    let xmlElement: Element | Document | null = null;
    if (typeof xmlElementOrText === 'string') {
        xmlElement = xmlTextToBibleElement(xmlElementOrText, optimizeOptions);
    } else {
        xmlElement = xmlElementOrText;
    }
    if (!xmlElement) {
        return [];
    }
    for (const tag of tags) {
        const child = xmlElement.getElementsByTagName(tag);
        if (child.length > 0) {
            return Array.from(child);
        }
    }
    return [];
}

function getBibleMap(
    xmlElementMap: Element | null,
    tags: string[],
    defaultMap: { [key: string]: string },
) {
    const bookKeyMap: { [key: string]: string } = { ...defaultMap };
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

function getGuessingBibleKeys(xmlText: string) {
    const guessingKeys: string[] = [];
    const xmlElementBible = xmlTextToBibleElement(xmlText, {
        keys: 'all',
    });
    if (!xmlElementBible) {
        return guessingKeys;
    }
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

async function guessingBibleKey(xmlText: string) {
    let bibleKey = guessValue(xmlText, attributesMap.bibleKey);
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
                getGuessingBibleKeys(xmlText),
            ),
            {
                extraStyles: { maxWidth: '700px' },
            },
        );
        if (isConfirmInput) {
            bibleKey = newKey;
        }
        const isConfirm = await showAppConfirm(
            tran('Confirm Key for Bible'),
            bibleKey
                ? `${tran('Do you want to continue with')} key="${bibleKey}"?`
                : tran('Are you sure you want to quit?'),
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

function getNewLines(xmlText: string) {
    const result = guessElement(xmlText, tagNamesMap.newLines);
    if (result.length === 0) {
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

function setJsonContent(xmlDoc: Document, xmlElement: Element, value: unknown) {
    const jsonText = JSON.stringify(value);
    if (jsonText === undefined) {
        xmlElement.textContent = '';
        return;
    }
    if (jsonText.includes(']]>')) {
        xmlElement.textContent = jsonText;
        return;
    }
    xmlElement.appendChild(xmlDoc.createCDATASection(jsonText));
}

function getNewLinesTitleMap(xmlText: string) {
    const result = guessElement(xmlText, tagNamesMap.newLinesTitleMap);
    if (result.length === 0) {
        return {};
    }
    const xmlElementNewLines = result[0];
    const itemElements = guessElement(xmlElementNewLines, ['item']);
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
        setJsonContent(xmlDoc, xmlElementItem, value);
        xmlElementNewLinesTitleMap.appendChild(xmlElementItem);
    }
}

function getCustomVersesMap(xmlText: string) {
    const xmlElementCustomVersesMaps = guessElement(
        xmlText,
        tagNamesMap.customVersesMap,
    );
    if (xmlElementCustomVersesMaps.length === 0) {
        return {};
    }
    const xmlElementCustomVersesMap = xmlElementCustomVersesMaps[0];
    const itemElements = guessElement(xmlElementCustomVersesMap, ['item']);
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
        setJsonContent(xmlDoc, xmlElementItem, value);
        xmlElementCustomVersesMap.appendChild(xmlElementItem);
    }
    xmlElementBible.appendChild(xmlElementCustomVersesMap);
}

function parseBibleVersion(versionText: string | null) {
    const version = Number.parseInt(versionText ?? '1', 10);
    return Number.isNaN(version) ? 1 : version;
}

export async function getBibleInfoJson(
    xmlText: string,
): Promise<BibleJsonInfoType | null> {
    const xmlElementMaps = guessElement(xmlText, tagNamesMap.map);
    const xmlElementMap = xmlElementMaps[0] ?? null;
    const numbersMap = getBibleMap(
        xmlElementMap,
        tagNamesMap.numberMap,
        Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [i.toString(), i.toString()]),
        ),
    );
    const locale = (guessValue(xmlText, attributesMap.locale) ??
        DEFAULT_LOCALE) as LocaleType;
    const keyBookMap = getBibleMap(
        xmlElementMap,
        tagNamesMap.bookMap,
        cloneJson(getModelKeyBookMap()),
    );
    const langData = await getLangDataAsync(locale);
    if (langData !== null) {
        for (const [key, value] of Object.entries(keyBookMap)) {
            keyBookMap[key] = langData.sanitizeText(value);
        }
    }
    const bibleKey = await guessingBibleKey(xmlText);
    if (bibleKey === null) {
        return null;
    }
    const xmlElementBooks = Array.from(
        guessElement(xmlText, tagNamesMap.book, {
            childTags: tagNamesMap.testament,
            emptyChildTagContents: true,
        }) ?? [],
    );
    const booksAvailable = getAvailableBooks(xmlElementBooks);
    const title = guessValue(xmlText, attributesMap.title) ?? 'Unknown Title';
    const description =
        guessValue(xmlText, attributesMap.description) ?? 'Unknown Description';
    const version = parseBibleVersion(
        guessValue(xmlText, attributesMap.version),
    );
    const legalNote =
        guessValue(xmlText, attributesMap.legalNote) ?? 'Unknown Legal Note';
    const publisher =
        guessValue(xmlText, attributesMap.publisher) ?? 'Unknown Publisher';
    const copyRights =
        guessValue(xmlText, attributesMap.copyRights) ?? 'Unknown Copy Rights';
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

function getBibleBooksJson(xmlText: string) {
    const xmlElementBooks = Array.from(
        guessElement(xmlText, tagNamesMap.book, {
            childTags: tagNamesMap.testament,
        }) ?? [],
    );
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
    const xmlDoc = appXMLParser.parseFromString(
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
    const xmlText = appXMLSerializer.serializeToString(xmlDoc);
    const actualBooksLength = Object.keys(books).length;
    const matchBooks = xmlText.match(/<book\s/gi);
    if (matchBooks?.length !== actualBooksLength) {
        appLog(
            'Warning: The number of books in XML does not match the JSON data' +
                `Books in JSON: ${actualBooksLength}, Books in XML: ${matchBooks?.length}`,
        );
        return null;
    }
    return xmlText;
}

export function xmlTextToBibleElement<T extends Element>(
    xmlText: string,
    optimizeOptions: OptimizeXMLTextOptions = {},
) {
    const bibleModelInfo = getBibleModelInfo();
    for (const [key, value] of Object.entries(bibleModelInfo.flippingKey)) {
        xmlText = xmlText.replaceAll(key, value);
    }

    const optimizedXMLText = optimizeXMLText(xmlText, optimizeOptions);
    const xmlDoc = appXMLParser.parseFromString(
        optimizedXMLText,
        'application/xml',
    );
    const xmlElementBibles = guessElement(xmlDoc, tagNamesMap.bible);
    if (xmlElementBibles.length === 0) {
        return null;
    }
    const xmlElementBible = xmlElementBibles[0] as T;
    return xmlElementBible;
}

export async function xmlTextToJson(
    xmlText: string,
): Promise<BibleXMLJsonType | null> {
    const bibleInfo = await getBibleInfoJson(xmlText);
    if (bibleInfo === null) {
        return null;
    }
    const bibleBooks = getBibleBooksJson(xmlText);
    if (bibleBooks === null) {
        return null;
    }
    const newLines = getNewLines(xmlText) ?? [];
    const newLinesTitleMap = getNewLinesTitleMap(xmlText) ?? {};
    const customVersesMap = getCustomVersesMap(xmlText) ?? {};
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
