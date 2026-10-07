/**
 * `owa_bible_xml`, the app's half: read a downloaded Bible with the app's OWN
 * reader and say what is in it, install it under the name and language the
 * person chose, and change or remove an installed one.
 *
 * The download is the MCP server's (`tools/owa-devtools-mcp/bibleXmlDraft.mjs`
 * -- that is where the address rules hold); this half only ever reads a file
 * in the server's drafts folder, named by a path the server built, and checks
 * that it is one before touching it. Nothing parsed is kept: a whole Bible is
 * read when asked about and when installed, and let go in between.
 *
 * Every change is backed up first (`agentBackupHelpers.ts`), and a removal is
 * a move to the trash -- the person this is for is old and not technical, and
 * "I deleted the wrong Bible" must end in an undo, not a lost translation.
 *
 * Reached through the `owa-agent-data` relay in `domHelpers.ts`, lazily. Every
 * sentence here is for the MODEL, in English, never through `tran()`: it is
 * read by whoever is driving the app, and the chat window words it again for
 * a person.
 */
import {
    BIBLE_BOOK_KEYS,
    guessBibleLocale,
} from '../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import {
    genBibleKeyChoices,
    guessBibleLocalesFromText,
    scoreNameLists,
} from '../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import { allLocalesMap, type LocaleType } from '../lang/langHelpers';
import { fsCheckFileExist, fsReadFile } from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import appProvider from '../server/appProvider';
import { getModelKeyBookMap } from './bible-helpers/bibleLogicHelpers1';
import { getDownloadedBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { checkIsBibleKeyTaken } from '../setting/bible-setting/bibleKeyHelpers';
import {
    bibleKeyToXMLFilePath,
    getAllXMLFileKeys,
    getBibleHeadInfoFromFile,
    jsonToXMLText,
    xmlTextToJson,
    type BibleXMLJsonType,
} from '../setting/bible-setting/bibleXMLJsonDataHelpers';
import {
    clearBibleXMLCache,
    saveJsonDataToXMLfile,
} from '../setting/bible-setting/bibleXMLHelpers';
import {
    genNoBackupReason,
    genUndoField,
    NoBackupError,
    runWithAgentBackup,
    snapshotAgentFile,
    trashAgentFile,
    type AgentResultType,
} from './agentBackupHelpers';
import { handleError } from './errorHelpers';

// The server's drafts folder and nothing else. Both separators: the path is
// built by the server on whatever OS the app runs on.
const DRAFT_PATH_PATTERN =
    /[\\/]open-worship-app-bible-import[\\/][a-z0-9]{12}\.xml$/;

const SAMPLE_CHARS = 3000;

type BibleXMLRequestType = {
    action?: unknown;
    xmlPath?: unknown;
    sourceName?: unknown;
    key?: unknown;
    locale?: unknown;
    title?: unknown;
    numbers?: unknown;
    bookNames?: unknown;
    lists?: unknown;
};

function fail(reason: string, problem?: string): AgentResultType {
    return problem === undefined
        ? { isError: true, reason }
        : { isError: true, reason, problem };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function toLanguageName(locale: string) {
    try {
        return (
            new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ??
            locale
        );
    } catch (_error) {
        return locale;
    }
}

/**
 * A locale the app knows, for one a guess produced: the exact one, or the
 * first the app lists in the same language (`pt-BR` for `pt-PT` when only
 * that one is there). Null when the app has nothing in that language.
 */
export function toAppLocale(locale: string): LocaleType | null {
    if (Object.hasOwn(allLocalesMap, locale)) {
        return locale as LocaleType;
    }
    const language = locale.split('-')[0].toLowerCase();
    const found = Object.keys(allLocalesMap).find((one) => {
        return one.split('-')[0].toLowerCase() === language;
    });
    return (found as LocaleType | undefined) ?? null;
}

async function listTakenKeys() {
    const keys = Object.keys(await getAllXMLFileKeys());
    const downloaded = await getDownloadedBibleInfoList();
    for (const info of downloaded ?? []) {
        keys.push(info.key);
    }
    return keys;
}

function checkIsDraftPath(xmlPath: unknown): xmlPath is string {
    return typeof xmlPath === 'string' && DRAFT_PATH_PATTERN.test(xmlPath);
}

async function readDraftText(xmlPath: string) {
    return (await fsCheckFileExist(xmlPath)) ? await fsReadFile(xmlPath) : null;
}

function parseDraft(xmlText: string | null, sourceName: string) {
    return xmlText === null
        ? null
        : xmlTextToJson(xmlText, { isImportPreview: true, sourceName });
}

// The attributes on the root tag, read off the first few KB the way the
// app's own head read does -- for saying WHY a language was suggested.
function readRootAttribute(xmlHead: string, names: string[]) {
    const rootTag = /<bible\b[^>]*>/i.exec(xmlHead)?.[0] ?? '';
    for (const name of names) {
        const value = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(
            rootTag,
        )?.[1];
        if (value) {
            return value.trim();
        }
    }
    return null;
}

function toSampleText(data: BibleXMLJsonType) {
    const sampleList: string[] = [];
    let size = 0;
    for (const book of Object.values(data.books)) {
        for (const chapter of Object.values(book)) {
            for (const verse of Object.values(chapter)) {
                sampleList.push(verse);
                size += verse.length;
                if (size > SAMPLE_CHARS) {
                    return sampleList.join(' ');
                }
            }
        }
    }
    return sampleList.join(' ');
}

function countBible(data: BibleXMLJsonType) {
    let chapters = 0;
    let verses = 0;
    for (const book of Object.values(data.books)) {
        for (const chapter of Object.values(book)) {
            chapters++;
            verses += Object.keys(chapter).length;
        }
    }
    return {
        books: Object.keys(data.books).length,
        chapters,
        verses,
        missingBooks: BIBLE_BOOK_KEYS.filter((key) => {
            return !Object.hasOwn(data.books, key);
        }),
    };
}

type LocaleChoiceType = { locale: LocaleType; name: string; why: string };

function genLocaleChoices({
    attribute,
    sourceName,
    sample,
}: {
    attribute: string | null;
    sourceName: string;
    sample: string;
}) {
    const fromText = guessBibleLocalesFromText(sample);
    const fromName = guessBibleLocale(sourceName);
    const textLanguages = new Set(
        fromText.locales.map((one: string) => {
            return one.split('-')[0];
        }),
    );
    const choices: LocaleChoiceType[] = [];
    // Every reason a locale was suggested, not only the first: "the verses
    // are in Khmer script and the file name says so" is what makes a person
    // trust the suggestion.
    const add = (locale: string | null, why: string) => {
        const appLocale = locale === null ? null : toAppLocale(locale);
        if (appLocale === null) {
            return;
        }
        const found = choices.find((one) => {
            return one.locale === appLocale;
        });
        if (found === undefined) {
            choices.push({
                locale: appLocale,
                name: toLanguageName(appLocale),
                why,
            });
        } else if (!found.why.includes(why)) {
            found.why += ` and ${why}`;
        }
    };
    const agrees = (locale: string | null) => {
        return (
            locale !== null &&
            (textLanguages.size === 0 ||
                textLanguages.has(locale.split('-')[0]))
        );
    };
    const textWhy =
        fromText.script === 'Latin'
            ? 'the words of the verses read like this language'
            : `the verses are written in ${fromText.script} script`;
    // What the file SAYS comes first only when the words agree with it: a
    // `locale="en"` left on a Khmer Bible by whoever made the file is the
    // commonest wrong answer there is.
    if (agrees(attribute)) add(attribute, 'the file says so');
    if (agrees(fromName)) add(fromName, 'the file name says so');
    for (const locale of fromText.locales) {
        add(locale, textWhy);
    }
    add(attribute, 'the file says so');
    add(fromName, 'the file name says so');
    return { script: fromText.script, choices: choices.slice(0, 4) };
}

async function readBundledNameLists(locale: string) {
    const language = locale.split('-')[0];
    const sets =
        language === 'km'
            ? (await import('../lang/data/km/bibleBooks.json')).default
            : language === 'fr'
              ? (await import('../lang/data/fr/bibleBooks.json')).default
              : language === 'en'
                ? (await import('../lang/data/en/bibleBooks.json')).default
                : [];
    return sets
        .filter((set: { books: string[] }) => {
            return set.books.length === BIBLE_BOOK_KEYS.length;
        })
        .map((set: { keys: string[]; books: string[] }) => {
            return {
                label: `${toLanguageName(language)} names (${set.keys.join(' / ')})`,
                source: 'built in',
                names: set.books,
            };
        });
}

/**
 * Best match first, each with how many of its names the text uses. The
 * file's own list stays LAST whatever it scores: it is the fallback, and
 * its id is what an import without a choice falls back to.
 */
function rankNameLists<T extends { names: string[]; source: string }>(
    text: string,
    lists: T[],
) {
    const scoreList = scoreNameLists(text, lists);
    const scored = lists.map((list, index) => {
        return { ...list, matches: scoreList[index] };
    });
    const otherList = scored
        .filter((list) => {
            return list.source !== 'file';
        })
        .sort((one, other) => {
            return other.matches - one.matches;
        });
    return [
        ...otherList,
        ...scored.filter((list) => {
            return list.source === 'file';
        }),
    ];
}

async function handleScore(request: BibleXMLRequestType) {
    if (!checkIsDraftPath(request.xmlPath) || !Array.isArray(request.lists)) {
        return fail('That is not a downloaded Bible draft.');
    }
    const lists = request.lists.filter((list: any) => {
        return Array.isArray(list?.names);
    }) as { names: string[] }[];
    const text = (await readDraftText(request.xmlPath)) ?? '';
    return { matches: scoreNameLists(text, lists) };
}

function toFileBookNames(data: BibleXMLJsonType) {
    const modelMap = getModelKeyBookMap();
    const names = BIBLE_BOOK_KEYS.map((key: string) => {
        return data.info.keyBookMap[key] ?? modelMap[key] ?? key;
    });
    const isOwn = BIBLE_BOOK_KEYS.some((key: string, index: number) => {
        return modelMap[key] !== undefined && names[index] !== modelMap[key];
    });
    return { names, isOwn };
}

function readDigits(data: BibleXMLJsonType) {
    const digits = Array.from({ length: 10 }, (_, index) => {
        return data.info.numbersMap[String(index)] ?? String(index);
    });
    return digits.join('') === '0123456789' ? null : digits;
}

async function handleAnalyze(request: BibleXMLRequestType) {
    if (!checkIsDraftPath(request.xmlPath)) {
        return fail('That is not a downloaded Bible draft.');
    }
    const sourceName = toText(request.sourceName);
    // Read ONCE: the head for what the root tag says, the whole for the app's
    // own reader -- a second read of a 15 MB file is a second 15 MB.
    const xmlText = await readDraftText(request.xmlPath);
    const xmlHead = xmlText?.slice(0, 4096) ?? '';
    const data = await parseDraft(xmlText, sourceName);
    if (data === null) {
        return fail(
            'The file downloaded, but it is not a Bible this app can read: ' +
                'no <bible> with books, chapters and numbered verses was found ' +
                'in it. It may be a different Bible format, or not a Bible.',
            'not-bible',
        );
    }
    const takenKeys = await listTakenKeys();
    const sample = toSampleText(data);
    const locales = genLocaleChoices({
        attribute: readRootAttribute(xmlHead, ['locale', 'lang', 'language']),
        sourceName,
        sample,
    });
    const recommended = locales.choices[0]?.locale ?? null;
    const keyAttribute = readRootAttribute(xmlHead, ['key', 'abbr']);
    const fileNames = toFileBookNames(data);
    const nameLists = rankNameLists(xmlText ?? '', [
        ...(recommended === null
            ? []
            : await readBundledNameLists(recommended)),
        {
            label: fileNames.isOwn
                ? 'The names in the file'
                : 'English names (the file has none of its own)',
            source: 'file',
            names: fileNames.names,
        },
    ]);
    return {
        title: data.info.title,
        keyAttribute,
        ...countBible(data),
        script: locales.script,
        locales: locales.choices,
        recommendedLocale: recommended,
        keys: genBibleKeyChoices({
            keyAttribute,
            title: data.info.title,
            sourceName,
            locale: recommended ?? '',
            isTaken: (key: string) => {
                return checkIsBibleKeyTaken(key, takenKeys);
            },
            isValid: (key: string) => {
                return checkAgentFileName(key) === null;
            },
        }),
        takenKeys,
        fileDigits: readDigits(data),
        nameLists,
    };
}

function readNumbers(value: unknown) {
    if (
        !Array.isArray(value) ||
        value.length !== 10 ||
        !value.every((one) => {
            return typeof one === 'string' && one.length > 0 && one.length < 4;
        })
    ) {
        return null;
    }
    return Object.fromEntries(
        value.map((digit, index) => {
            return [String(index), digit];
        }),
    );
}

function readFullBookNames(value: unknown) {
    if (
        !Array.isArray(value) ||
        value.length !== BIBLE_BOOK_KEYS.length ||
        !value.every((one) => {
            return typeof one === 'string' && one.trim() !== '';
        })
    ) {
        return null;
    }
    return Object.fromEntries(
        BIBLE_BOOK_KEYS.map((key: string, index: number) => {
            return [key, value[index].trim().slice(0, 160)];
        }),
    );
}

// A partial change: `{"GEN": "…"}`, keyed by the stable book ids.
function readBookNameChanges(value: unknown) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const changes: Record<string, string> = {};
    for (const [key, name] of Object.entries(value)) {
        if (
            !BIBLE_BOOK_KEYS.includes(key) ||
            typeof name !== 'string' ||
            name.trim() === ''
        ) {
            return null;
        }
        changes[key] = name.trim().slice(0, 160);
    }
    return changes;
}

function checkKeyReason(key: string, takenKeys: string[]) {
    if (key === '') {
        return 'A Bible key is needed: a short name such as KJV.';
    }
    if (key.length > 24 || /\s/.test(key)) {
        return `"${key}" is too long or has a space. Use a short name with no spaces, such as KSV.`;
    }
    const nameReason = checkAgentFileName(key);
    if (nameReason !== null) {
        return nameReason;
    }
    if (checkIsBibleKeyTaken(key, takenKeys)) {
        return `"${key}" is already the key of an installed Bible. Choose another.`;
    }
    return null;
}

async function handleImport(request: BibleXMLRequestType) {
    if (!checkIsDraftPath(request.xmlPath)) {
        return fail('That is not a downloaded Bible draft.');
    }
    const key = toText(request.key);
    const locale = toAppLocale(toText(request.locale));
    if (locale === null) {
        return fail(
            `"${toText(request.locale)}" is not a language this app knows. ` +
                'Use a code such as km-KH, en-US or fr-FR.',
        );
    }
    const numbersMap = readNumbers(request.numbers);
    if (numbersMap === null) {
        return fail('The digits must be a list of ten, 0 to 9.');
    }
    const keyBookMap =
        request.bookNames === null || request.bookNames === undefined
            ? null
            : readFullBookNames(request.bookNames);
    if (request.bookNames && keyBookMap === null) {
        return fail('A book-name list must have all 66 names, Genesis first.');
    }
    const xmlPath = request.xmlPath;
    const sourceName = toText(request.sourceName);
    // One import at a time, shared with the Settings import: a key must not
    // be checked free by both and then written twice.
    return await unlocking('bible-xml-import', async () => {
        const takenKeys = await listTakenKeys();
        const keyReason = checkKeyReason(key, takenKeys);
        if (keyReason !== null) {
            return fail(keyReason, 'key');
        }
        const filePath = await bibleKeyToXMLFilePath(key, true);
        if (filePath === null || (await fsCheckFileExist(filePath))) {
            return fail(
                `A file for "${key}" is already in the Bibles folder. ` +
                    'Choose another key.',
                'key',
            );
        }
        const data = await parseDraft(await readDraftText(xmlPath), sourceName);
        if (data === null) {
            return fail(
                'The downloaded file could not be read again. Check the ' +
                    'address again.',
                'draft-gone',
            );
        }
        const title = toText(request.title).slice(0, 200) || data.info.title;
        const edited: BibleXMLJsonType = {
            ...data,
            info: {
                ...data.info,
                key,
                title,
                locale,
                numbersMap,
                keyBookMap: keyBookMap ?? data.info.keyBookMap,
            },
        };
        try {
            const { meta } = await runWithAgentBackup(
                `Installed the Bible “${key}”`,
                // A file that was not there: the undo moves it to the trash.
                [{ type: 'file', filePath, text: null, bibleKey: key }],
                async () => {
                    if (!(await saveJsonDataToXMLfile(edited, key))) {
                        throw new Error('The Bible file could not be written.');
                    }
                },
            );
            return {
                installed: key,
                title,
                locale,
                books: Object.keys(edited.books).length,
                ...genUndoField(meta),
            };
        } catch (error: any) {
            return fail(
                error instanceof NoBackupError
                    ? error.message
                    : String(error?.message ?? error),
            );
        }
    });
}

async function findInstalledFilePath(key: string) {
    const keyMap = await getAllXMLFileKeys();
    const found = Object.keys(keyMap).find((one) => {
        return one.toLowerCase() === key.toLowerCase();
    });
    return found === undefined ? null : { key: found, filePath: keyMap[found] };
}

function genNotInstalledReason(key: string, keyList: string[]) {
    return (
        `No installed Bible has the key "${key}". The installed ones are: ` +
        (keyList.length === 0 ? 'none' : keyList.join(', ')) +
        ". (A Bible downloaded from the app's own list is changed in " +
        'Settings, not here.)'
    );
}

async function handleList() {
    const keyMap = await getAllXMLFileKeys();
    const bibles: Record<string, unknown>[] = [];
    for (const [key, filePath] of Object.entries(keyMap)) {
        const head = await getBibleHeadInfoFromFile(filePath);
        bibles.push({
            key,
            title: head?.title ?? null,
            locale: head?.locale ?? null,
            file: appProvider.pathUtils.basename(filePath),
        });
    }
    const downloaded = (await getDownloadedBibleInfoList()) ?? [];
    return {
        bibles,
        downloaded: downloaded.map((info) => {
            return { key: info.key, title: info.title, locale: info.locale };
        }),
        note:
            '`bibles` can be changed or removed here; `downloaded` came from ' +
            "the app's own Bible list and is managed in Settings > Bible.",
    };
}

async function readInstalled(key: string) {
    const found = await findInstalledFilePath(key);
    if (found === null) {
        return null;
    }
    const data = await xmlTextToJson(await fsReadFile(found.filePath));
    return data === null ? null : { ...found, data };
}

async function handleInfo(request: BibleXMLRequestType) {
    const key = toText(request.key);
    const installed = await readInstalled(key);
    if (installed === null) {
        return fail(
            genNotInstalledReason(key, Object.keys(await getAllXMLFileKeys())),
        );
    }
    const { info } = installed.data;
    return {
        key: installed.key,
        title: info.title,
        locale: info.locale,
        language: toLanguageName(info.locale),
        digits: Array.from({ length: 10 }, (_, index) => {
            return info.numbersMap[String(index)] ?? String(index);
        }).join(' '),
        books: Object.keys(installed.data.books).length,
        bookNames: Object.fromEntries(
            BIBLE_BOOK_KEYS.map((bookKey: string) => {
                return [bookKey, info.keyBookMap[bookKey] ?? bookKey];
            }),
        ),
        file: appProvider.pathUtils.basename(installed.filePath),
    };
}

async function handleUpdate(request: BibleXMLRequestType) {
    const key = toText(request.key);
    const installed = await readInstalled(key);
    if (installed === null) {
        return fail(
            genNotInstalledReason(key, Object.keys(await getAllXMLFileKeys())),
        );
    }
    const { info } = installed.data;
    const changedList: string[] = [];
    const nextInfo = { ...info, keyBookMap: { ...info.keyBookMap } };
    const title = toText(request.title).slice(0, 200);
    if (title !== '' && title !== info.title) {
        nextInfo.title = title;
        changedList.push('title');
    }
    if (toText(request.locale) !== '') {
        const locale = toAppLocale(toText(request.locale));
        if (locale === null) {
            return fail(
                `"${toText(request.locale)}" is not a language this app ` +
                    'knows. Use a code such as km-KH, en-US or fr-FR.',
            );
        }
        if (locale !== info.locale) {
            nextInfo.locale = locale;
            changedList.push('language');
        }
    }
    if (request.numbers !== undefined) {
        const numbersMap = readNumbers(request.numbers);
        if (numbersMap === null) {
            return fail('The digits must be a list of ten, 0 to 9.');
        }
        nextInfo.numbersMap = numbersMap;
        changedList.push('digits');
    }
    if (request.bookNames !== undefined) {
        const changes = Array.isArray(request.bookNames)
            ? readFullBookNames(request.bookNames)
            : readBookNameChanges(request.bookNames);
        if (changes === null) {
            return fail(
                'Book names are either all 66 in order, or an object of ' +
                    'changes keyed by book id, e.g. {"GEN": "…"}.',
            );
        }
        Object.assign(nextInfo.keyBookMap, changes);
        changedList.push('book names');
    }
    if (changedList.length === 0) {
        return fail(
            'Nothing to change: give a title, locale, digits or book names.',
        );
    }
    const restore = await snapshotAgentFile(installed.filePath);
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the ${changedList.join(', ')} of the Bible “${installed.key}”`,
            [{ ...restore, bibleKey: installed.key } as typeof restore],
            async () => {
                const xmlText = jsonToXMLText({
                    ...installed.data,
                    info: nextInfo,
                });
                if (xmlText === null) {
                    throw new Error('The Bible could not be written as XML.');
                }
                // Written to the file the key LIVES in, which is not always
                // `<key>.xml` -- a file copied in by hand keeps its own name.
                const { default: FileSource } = await import('./FileSource');
                if (
                    !(await FileSource.getInstance(
                        installed.filePath,
                    ).writeFileData(xmlText))
                ) {
                    throw new Error('The Bible file could not be written.');
                }
                await clearBibleXMLCache(installed.key);
            },
        );
        return {
            changed: changedList,
            key: installed.key,
            ...genUndoField(meta),
        };
    } catch (error: any) {
        return fail(
            error instanceof NoBackupError
                ? error.message
                : String(error?.message ?? error),
        );
    }
}

async function handleDelete(request: BibleXMLRequestType) {
    const key = toText(request.key);
    const found = await findInstalledFilePath(key);
    if (found === null) {
        return fail(
            genNotInstalledReason(key, Object.keys(await getAllXMLFileKeys())),
        );
    }
    let restore;
    try {
        restore = await snapshotAgentFile(found.filePath);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the Bible “${found.key}” to the trash`,
            [{ ...restore, bibleKey: found.key } as typeof restore],
            async () => {
                await trashAgentFile(found.filePath);
                await clearBibleXMLCache(found.key);
            },
        );
        return { removed: found.key, ...genUndoField(meta) };
    } catch (error: any) {
        return fail(
            error instanceof NoBackupError
                ? error.message
                : String(error?.message ?? error),
        );
    }
}

/**
 * One request from `owa_bible_xml`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event, so an exception here would simply hang it.
 */
export async function handleAgentBibleXMLRequest(
    request: BibleXMLRequestType,
): Promise<AgentResultType> {
    try {
        switch (request?.action) {
            case 'analyze':
                return await handleAnalyze(request);
            case 'score':
                return await handleScore(request);
            case 'import':
                return await handleImport(request);
            case 'list':
                return await handleList();
            case 'info':
                return await handleInfo(request);
            case 'update':
                return await handleUpdate(request);
            case 'delete':
                return await handleDelete(request);
            default:
                return fail(`Unknown action "${String(request?.action)}".`);
        }
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
