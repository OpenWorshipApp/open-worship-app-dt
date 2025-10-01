import {
    DEFAULT_LOCALE,
    getLangCode,
    LocaleType,
} from '../../lang/langHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../../popup-widget/popupWidgetHelpers';
import { genBibleKeyXMLInput } from './bibleXMLAttributesGuessing';
import { getDownloadedBibleInfoList } from '../../helper/bible-helpers/bibleDownloadHelpers';
import { cloneJson } from '../../helper/helpers';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';
import { fsListFiles, pathJoin } from '../../server/fileHelpers';
import FileSource from '../../helper/FileSource';
import { showSimpleToast } from '../../toast/toastHelpers';
import CacheManager from '../../others/CacheManager';
import { unlockingCacher } from '../../server/unlockingHelpers';
import {
    getKJVKeyValue,
    kjvBibleInfo,
} from '../../helper/bible-helpers/serverBibleHelpers';

const bibleKeyFilePathCache = new CacheManager();
export async function getBibleKeyFromFile(filePath: string) {
    return unlockingCacher(
        filePath,
        async () => {
            const xmlText = await FileSource.readFileData(filePath);
            if (xmlText === null) {
                return null;
            }
            const bibleXMLElement = xmlTextToBibleElement(xmlText);
            if (!bibleXMLElement) {
                return null;
            }
            const bibleKey = await guessingBibleKey(bibleXMLElement);
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
    key: string;
    version: number;
    locale: LocaleType;
    legalNote: string;
    publisher: string;
    copyRights: string;
    booksMap: { [booKey: string]: string };
    booksAvailable: string[];
    numbersMap: { [key: string]: string };
};

export type BibleXMLJsonType = {
    info: BibleJsonInfoType;
    books: { [booKey: string]: BibleBookJsonType };
};

function guessValue(
    element: Element,
    bibleKeys: string[],
    defaultValue: string | null = null,
) {
    for (const bibleKey of bibleKeys) {
        const value = element.getAttribute(bibleKey);
        if (value !== null) {
            return value;
        }
    }
    return defaultValue;
}

function guessElement(element: Element | Document, tags: string[]) {
    for (const tag of tags) {
        const child = element.getElementsByTagName(tag);
        if (child !== null) {
            return child;
        }
    }
    return null;
}

function getBibleMap(
    mapElement: Element | null,
    tags: string[],
    defaultMap: { [key: string]: string },
) {
    const bookKeyMap: { [key: string]: string } = defaultMap;
    const bookKeyMapElements =
        mapElement === null
            ? []
            : Array.from(guessElement(mapElement, tags) ?? []);
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
        .split(/[\.,\s]/)
        .map((value1) => {
            return value1.trim();
        })
        .filter((value1) => {
            return value1;
        });
}

function getGuessingBibleKeys(bibleXMLElement: Element) {
    const guessingKeys: string[] = [];
    for (const attribute of Array.from(bibleXMLElement.attributes)) {
        const value = attribute.nodeValue;
        if (value) {
            guessingKeys.push(...toGuessingBibleKeys(value));
        }
    }
    return Array.from(new Set(guessingKeys));
}

function getBookKey(bookXMLElement: Element) {
    const bookKeysOrder = kjvBibleInfo.bookKeysOrder;
    let bookKey = guessValue(bookXMLElement, attributesMap.bookKey, null);
    if (bookKey !== null && bookKeysOrder.includes(bookKey)) {
        return bookKey;
    }
    const bookNumberText = guessValue(
        bookXMLElement,
        attributesMap.index,
        null,
    );
    if (bookNumberText === null) {
        return null;
    }
    const bookIndex = parseInt(bookNumberText);
    if (isNaN(bookIndex)) {
        return null;
    }
    bookKey = bookKeysOrder[bookIndex - 1];
    if (bookKey === undefined) {
        return null;
    }
    return bookKey;
}

async function guessingBibleKey(bibleXMLElement: Element) {
    let bibleKey = guessValue(bibleXMLElement, attributesMap.bibleKey);
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
            '`Key is missing',
            genBibleKeyXMLInput(
                newKey,
                (newKey1) => {
                    newKey = newKey1;
                },
                Array.from(takenBibleKeys),
                getGuessingBibleKeys(bibleXMLElement),
            ),
        );
        if (isConfirmInput) {
            bibleKey = newKey;
        }
        const isConfirm = await showAppConfirm(
            'Confirm Key Value',
            bibleKey
                ? `Do you want to continue with key="${bibleKey}"?`
                : 'Are you sure you want to quite?',
        );
        if (isConfirm) {
            break;
        } else {
            bibleKey = null;
        }
    }
    return bibleKey;
}

function getAvailableBooks(booksXMLElement: Element[]) {
    const availableBooks: string[] = [];
    for (const book of booksXMLElement) {
        const bookKey = getBookKey(book);
        if (bookKey !== null) {
            availableBooks.push(bookKey);
        }
    }
    return availableBooks;
}

function getBookElements(bibleXMLElement: Element) {
    return Array.from(guessElement(bibleXMLElement, tagNamesMap.book) ?? []);
}

export async function getBibleInfoJson(bibleXMLElement: Element) {
    const mapElement = guessElement(bibleXMLElement, tagNamesMap.map)?.[0];
    const numberKeyMap = getBibleMap(
        mapElement ?? null,
        tagNamesMap.numberMap,
        Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [i.toString(), i.toString()]),
        ),
    );
    const bookKeyMap = getBibleMap(
        mapElement ?? null,
        tagNamesMap.bookMap,
        cloneJson(getKJVKeyValue()),
    );
    const bibleKey = await guessingBibleKey(bibleXMLElement);
    if (bibleKey === null) {
        return null;
    }
    const locale =
        guessValue(bibleXMLElement, attributesMap.locale) ?? DEFAULT_LOCALE;
    if (getLangCode(locale as any) === null) {
        return null;
    }
    const books = Array.from(
        guessElement(bibleXMLElement, tagNamesMap.book) ?? [],
    );
    const booksAvailable = getAvailableBooks(books);
    return {
        title:
            guessValue(bibleXMLElement, attributesMap.title) ?? 'Unknown Title',
        key: bibleKey,
        version:
            parseInt(
                guessValue(bibleXMLElement, attributesMap.version) ?? '1',
            ) ?? 1,
        locale,
        legalNote:
            guessValue(bibleXMLElement, attributesMap.legalNote) ??
            'Unknown Legal Note',
        publisher:
            guessValue(bibleXMLElement, attributesMap.publisher) ??
            'Unknown Publisher',
        copyRights:
            guessValue(bibleXMLElement, attributesMap.copyRights) ??
            'Unknown Copy Rights',
        numbersMap: numberKeyMap,
        booksMap: bookKeyMap,
        booksAvailable,
    } as BibleJsonInfoType;
}

function getBibleVerses(chapterXMLElement: Element): BibleVerseType {
    const verseJson: BibleVerseType = {};
    const verses = Array.from(
        guessElement(chapterXMLElement, tagNamesMap.verse) || [],
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

function getBibleChapters(bookXMLElement: Element): BibleBookJsonType {
    const bookJson: BibleBookJsonType = {};
    const chapters = Array.from(
        guessElement(bookXMLElement, tagNamesMap.chapter) ?? [],
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

function getBibleBooksJson(bibleXMLElement: Element) {
    const books = getBookElements(bibleXMLElement);
    const booksJson: { [booKey: string]: BibleBookJsonType } = {};
    for (const book of books) {
        const bookKey = getBookKey(book);
        if (bookKey === null) {
            continue;
        }
        booksJson[bookKey] = getBibleChapters(book);
    }
    for (const book of Object.values(booksJson)) {
        if (Object.keys(book).length === 0) {
            return null;
        }
    }
    return booksJson;
}

export function jsonToXMLText(jsonData: BibleXMLJsonType) {
    const { numbersMap, booksMap, ...info } = jsonData.info;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(
        '<?xml version="1.0" encoding="UTF-8"?><bible></bible>',
        'application/xml',
    );

    const bible = xmlDoc.getElementsByTagName('bible')[0];
    const bibleInfoKey = Object.keys(info).filter((key) => {
        return !['filePath'].includes(key);
    });
    for (const key of bibleInfoKey) {
        const value = info[key as keyof typeof info];
        bible.setAttribute(key, value.toString());
    }
    const map = xmlDoc.createElement(tagNamesMap.map[0]);
    for (const [key, value] of Object.entries(numbersMap)) {
        const numberMap = xmlDoc.createElement(tagNamesMap.numberMap[0]);
        numberMap.setAttribute(attributesMap.mapKey[0], key);
        numberMap.setAttribute(attributesMap.mapValue[0], value);
        map.appendChild(numberMap);
    }
    for (const [key, value] of Object.entries(booksMap)) {
        const bookMap = xmlDoc.createElement(tagNamesMap.bookMap[0]);
        bookMap.setAttribute(attributesMap.mapKey[0], key);
        bookMap.setAttribute(attributesMap.mapValue[0], value);
        map.appendChild(bookMap);
    }
    bible.appendChild(map);
    const books = jsonData.books;
    for (const [bookKey, book] of Object.entries(books)) {
        const bookElement = xmlDoc.createElement(tagNamesMap.book[0]);
        bookElement.setAttribute(attributesMap.bookKey[0], bookKey);
        for (const [chapterKey, chapter] of Object.entries(book)) {
            const chapterElement = xmlDoc.createElement(tagNamesMap.chapter[0]);
            chapterElement.setAttribute(attributesMap.index[0], chapterKey);
            for (const [verseKey, verse] of Object.entries(chapter)) {
                const verseElement = xmlDoc.createElement(tagNamesMap.verse[0]);
                verseElement.setAttribute(attributesMap.index[0], verseKey);
                verseElement.textContent = verse;
                chapterElement.appendChild(verseElement);
            }
            bookElement.appendChild(chapterElement);
        }
        bible.appendChild(bookElement);
    }
    const serializer = new XMLSerializer();
    let xmlText = serializer.serializeToString(xmlDoc);
    xmlText = xmlText.replace(/></g, '>\n<');
    if (xmlText.match(/<book\s/gi)?.length !== Object.keys(books).length) {
        return null;
    }
    return xmlText;
}

export function xmlTextToBibleElement(xmlText: string) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const bible = guessElement(xmlDoc, tagNamesMap.bible)?.[0];
    return bible;
}

export async function xmlToJson(xmlText: string) {
    const bibleXMLElement = xmlTextToBibleElement(xmlText);
    if (!bibleXMLElement) {
        return null;
    }
    const bibleInfo = await getBibleInfoJson(bibleXMLElement);
    if (bibleInfo === null) {
        return null;
    }
    const bibleBooks = getBibleBooksJson(bibleXMLElement);
    if (bibleBooks === null) {
        return null;
    }
    return { info: bibleInfo, books: bibleBooks } as BibleXMLJsonType;
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
    showSimpleToast(
        'Fail to get Bible file path',
        `Unable to find file path for: "${bibleKey}"`,
    );
    return null;
}
