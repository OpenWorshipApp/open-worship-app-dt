import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    DEFAULT_CHAT_LANG_CODE,
    listAssistantLanguages,
    listTypedLanguages,
    toPackageLangCode,
} from '../../../../chatbot/chatLangHelpers';
import { readForegroundComponentAsk } from '../../../../chatbot/foregroundChatHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from '../../../../chatbot/studyVerseCheckHelpers';
import { readScreenAsk } from '../../../../chatbot/typedScreenAskHelpers';
import {
    readTypedVerseLine,
    readTypedVerseRef,
} from '../../../../chatbot/typedVerseAskHelpers';
import kjvConfig from '../../../../helper/bible-helpers/kjvBibleConfig.json';
import { toLangPackageDir } from '../../../../test-setup/langPackageDirs';
import englishBooks from '../../en/bibleBooks.json';

// EC-622 (2026-11-14, the user's goal: _chatbot is very smart to help user
// control screen_): with no model, a passage asked for in a language other
// than English -- put up, or read -- had been answered with the guide's
// page: the offline reader knew English verbs only. The line is read by
// what it holds (`typedVerseAskHelpers.ts`): a chapter and a verse after a
// book's name as an installed Bible or English names it, or after a word
// no Bible names a book by, whose answer is the parser's sentence and an
// import of a Bible in that language. Held to the screen asks' four sets
// written BLIND (`screenAsks.test.ts`), read once before the reader was
// fitted to them: each language's passage put up (`others.present`) and
// the lines that only look like a screen ask or a control asked of one.
// Measured at that read, English names alone: of 352 put-ups, 347 taken
// in their own app and 350 in an English one, 230 naming a passage (18 by
// a name English shares, 212 by a word no Bible gives) -- the rest a
// chapter alone (_Psalm 23_), a counter, or a verse after a comma beside a
// word no Bible gives, each also a plain number; and of 11 264 look-alike
// readings none taken.
type HeldOutType = {
    asks: Record<string, string>;
    others: Record<string, string>;
};

const HELD_OUT_FILE_LIST = [
    'screenAsksHeldOut.json',
    'screenAsksHeldOut2.json',
    'screenAsksHeldOut3.json',
    'screenAsksHeldOut4.json',
] as const;

// Every package of the checkout stands in for an installed one.
const LANGUAGE_CODE_SET = new Set(
    [...listAssistantLanguages(), ...listTypedLanguages()]
        .map((language) => {
            return language.code;
        })
        .filter((code) => {
            return code !== DEFAULT_CHAT_LANG_CODE;
        }),
);

// The window's language as `getAppLangCode` reads it off `<html lang>`.
function toAppLangCode(code: string) {
    return code.split('-')[0];
}

const ENGLISH_BIBLE = {
    keys: ['KJV'],
    locale: 'en-US',
    books: englishBooks[0].books,
};

function genNames(
    bibles: { keys: string[]; locale: string; books: string[] }[],
) {
    return genStudyBookNames({
        kind: 'books',
        bookKeys: kjvConfig.bookKeysOrder,
        english: englishBooks[0].books,
        bibles,
    }) as StudyBookNamesType;
}

// An app with the KJV alone, as a new install has it.
const ENGLISH_NAMES = genNames([ENGLISH_BIBLE]);

// The Bibles a package names the books of, installed beside the KJV: what
// an app with a Bible in that language reads by. Null for a package that
// names none.
const ownNamesMap = new Map<string, StudyBookNamesType | null>();
function getOwnNames(code: string) {
    if (!ownNamesMap.has(code)) {
        const dir = toLangPackageDir(toPackageLangCode(code));
        const file = path.join(dir, 'bibleBooks.json');
        let names: StudyBookNamesType | null = null;
        if (existsSync(file)) {
            const meta = JSON.parse(
                readFileSync(path.join(dir, 'meta.json'), 'utf8'),
            );
            const bibles = JSON.parse(readFileSync(file, 'utf8')) as {
                keys: string[];
                books: string[];
            }[];
            names = genNames([
                ENGLISH_BIBLE,
                ...bibles.map((bible) => {
                    return {
                        keys: bible.keys,
                        locale: meta.locale,
                        books: bible.books,
                    };
                }),
            ]);
        }
        ownNamesMap.set(code, names);
    }
    return ownNamesMap.get(code) ?? null;
}

// The window's labels in an app shown in that language, as `tran` gives
// them: a foreground extra is also named by its panel's label.
const translateMap = new Map<string, (key: string) => string>();
function getTranslate(appLangCode: string) {
    if (appLangCode === DEFAULT_CHAT_LANG_CODE) {
        return (key: string) => {
            return key;
        };
    }
    let translate = translateMap.get(appLangCode);
    if (translate === undefined) {
        const dictionary = JSON.parse(
            readFileSync(
                path.join(
                    toLangPackageDir(toPackageLangCode(appLangCode)),
                    'dictionary.json',
                ),
                'utf8',
            ),
        ) as Record<string, string>;
        translate = (key: string) => {
            return dictionary[key] ?? key;
        };
        translateMap.set(appLangCode, translate);
    }
    return translate;
}

// What the window takes as a passage with no model (`askOffline`): not a
// foreground extra's, no control of the screens, a line that may ask for a
// passage, and a passage named. The verse line is read first: it is the
// cheapest of the three and takes 7 of 480 look-alike lines, where the
// other two cost a few milliseconds each with every package installed --
// in the window's order this file took 78 s of the gate.
function readTaken(
    line: string,
    appLangCode: string,
    names: StudyBookNamesType,
) {
    if (readTypedVerseLine(line, appLangCode) === null) {
        return null;
    }
    if (readForegroundComponentAsk(line, getTranslate(appLangCode)) !== null) {
        return null;
    }
    const kind = readScreenAsk(line, 'presenter', appLangCode);
    if (kind !== null && kind !== 'screen') {
        return null;
    }
    return readTypedVerseRef(line, names);
}

const SAMPLE_LIST = HELD_OUT_FILE_LIST.flatMap((fileName) => {
    const heldOutMap = JSON.parse(
        readFileSync(path.join(import.meta.dirname, fileName), 'utf8'),
    ) as Record<string, HeldOutType>;
    return Object.entries(heldOutMap)
        .filter(([code]) => {
            return LANGUAGE_CODE_SET.has(code);
        })
        .map(([code, sample]) => {
            return { fileName, code, sample };
        });
});

describe('a passage asked for in every language, with no model', () => {
    test('is a line the verse reader takes, in its own app and an English one', () => {
        let ownCount = 0;
        let englishCount = 0;
        for (const { code, sample } of SAMPLE_LIST) {
            const line = sample.others.present;
            if (readTypedVerseLine(line, toAppLangCode(code)) !== null) {
                ownCount++;
            }
            if (readTypedVerseLine(line, DEFAULT_CHAT_LANG_CODE) !== null) {
                englishCount++;
            }
        }
        expect(SAMPLE_LIST.length).toBeGreaterThanOrEqual(352);
        expect(ownCount).toBeGreaterThanOrEqual(347);
        expect(englishCount).toBeGreaterThanOrEqual(350);
    }, 60000);

    test('names its passage with the English names alone, or a word as a book no Bible gives', () => {
        let namedCount = 0;
        let unknownCount = 0;
        for (const { sample } of SAMPLE_LIST) {
            const ref = readTypedVerseRef(sample.others.present, ENGLISH_NAMES);
            if (ref?.isBookNamed === true) {
                namedCount++;
            } else if (ref !== null) {
                unknownCount++;
            }
        }
        expect(namedCount + unknownCount).toBeGreaterThanOrEqual(230);
        expect(namedCount).toBeGreaterThanOrEqual(18);
    });

    test("names it by the package's own Bibles, where it has them", () => {
        const sampleList = SAMPLE_LIST.filter(({ code }) => {
            return getOwnNames(code) !== null;
        });
        const unnamedList = sampleList
            .filter(({ code, sample }) => {
                const ref = readTaken(
                    sample.others.present,
                    toAppLangCode(code),
                    getOwnNames(code) as StudyBookNamesType,
                );
                return ref?.isBookNamed !== true;
            })
            .map(({ fileName, code, sample }) => {
                return `${fileName} ${code}: ${sample.others.present}`;
            });
        expect(unnamedList).toEqual([]);
    }, 60000);

    test('a line that only looks like one is never taken', () => {
        const takenList: string[] = [];
        for (const { fileName, code, sample } of SAMPLE_LIST) {
            const names = getOwnNames(code) ?? ENGLISH_NAMES;
            const lineList = [
                ...Object.entries(sample.others).filter(([topic]) => {
                    return topic !== 'present';
                }),
                ...Object.entries(sample.asks).map(([kind, line]) => {
                    return [`ask ${kind}`, line] as const;
                }),
            ];
            for (const [topic, line] of lineList) {
                for (const appLangCode of [
                    toAppLangCode(code),
                    DEFAULT_CHAT_LANG_CODE,
                ]) {
                    const ref = readTaken(line, appLangCode, names);
                    if (ref !== null) {
                        takenList.push(
                            `${fileName} ${code} in ${appLangCode}, ${topic} as ${ref.reference}: ${line}`,
                        );
                    }
                }
            }
        }
        expect(takenList).toEqual([]);
    }, 120000);
});
