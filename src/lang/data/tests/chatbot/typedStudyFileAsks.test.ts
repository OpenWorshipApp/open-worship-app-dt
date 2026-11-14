import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    detectTypedLanguage,
    listTypedLanguages,
} from '../../../../chatbot/chatLangHelpers';
import { readStudyFileAsk } from '../../../../chatbot/studyFileChatHelpers';
import {
    checkHasLangPackage,
    listLangPackageCodes,
    ONLINE_LANG_DATA_DIR,
} from '../../../../test-setup/langPackageDirs';

// EC-465 (2026-11-12): a STUDY FILE asked for in any language a person may
// type, not only in English, Khmer and French (EC-464). Each typed language
// says it in its `typed.json` (`studyFileAsks`): ONE pattern holding a
// making word and a study word, and none of its how-to, folder or note words
// -- nor its neighbours' (BN-42's rule: a Danish how-to must not be a
// Norwegian ask). One sample of each, as a person types it: a study file
// made, a Bible study written, a how-to and a note about a study (the
// languages no reader could confirm keep no note sample -- BN-41).
// `more`: lines the pattern reads that no language is named by -- Serbian
// typed in Latin letters, where the app's Serbian is Cyrillic.
type SampleType = {
    folder: string;
    make: string;
    resource: string;
    more?: string[];
    howTo?: string;
    note?: string;
};

const SAMPLE_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'typedStudyFileAsks.json'),
        'utf8',
    ),
) as Record<string, SampleType>;
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

function findOwnPatternList(code: string) {
    return (
        listTypedLanguages().find((language) => {
            return language.code === code;
        })?.studyFileAskPatterns ?? []
    );
}

// The line as `readStudyFileAsk` reads it: a joiner a keyboard puts inside
// a word (Sinhala's) is no part of it.
function toReadLine(line: string) {
    return line.normalize('NFC').replace(/\p{Cf}/gu, '');
}

// What a keyboard may type in place of what the samples write: the curly
// apostrophe and the okina (BN-39), and a zero-width space after a space.
function toTypedVariantList(line: string) {
    return [
        line.replaceAll("'", '’'),
        line.replaceAll("'", 'ʻ'),
        line.replaceAll(' ', ' ​'),
    ];
}

// Each language's `studyFileAsks`, as its own file holds it, by its code.
function listStudyAskEntryList() {
    return listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'typed.json',
    }).flatMap((folder) => {
        const file = JSON.parse(
            readFileSync(
                path.join(ONLINE_LANG_DATA_DIR, folder, 'typed.json'),
                'utf8',
            ),
        ) as Record<string, { studyFileAsks?: unknown }>;
        return Object.entries(file).map(([code, entry]) => {
            return { code, list: entry.studyFileAsks };
        });
    });
}

// Every question asked runs every installed language's pattern, and every
// test file loads all 86. Written first with a word start of its own on
// each word -- 2 164 letter-class lookbehinds in all -- they took 0.7 s to
// read one line each and timed gate files out; one per word list (293)
// reads the same lines in a fifth of the time. The most a pattern holds
// now is 5.
const MAX_WORD_START_COUNT = 6;

describe('a study file asked for in every typed language', () => {
    test('every typed language has a sample', () => {
        expect(Object.keys(SAMPLE_MAP).length).toBeGreaterThanOrEqual(86);
    });

    test('every typed language carries one pattern that compiles', () => {
        const problemList = listStudyAskEntryList().flatMap(
            ({ code, list }) => {
                if (!Array.isArray(list) || list.length !== 1) {
                    return [`${code}: one pattern expected`];
                }
                try {
                    new RegExp(String(list[0]), 'iu');
                    return [];
                } catch (error) {
                    return [`${code}: ${String(error)}`];
                }
            },
        );
        expect(problemList).toEqual([]);
    });

    test('every pattern says a word start once per word list', () => {
        const problemList = listStudyAskEntryList().flatMap(
            ({ code, list }) => {
                const source = Array.isArray(list) ? String(list[0]) : '';
                const count = source.split('(?<!').length - 1;
                return count > MAX_WORD_START_COUNT
                    ? [`${code}: ${count} word starts`]
                    : [];
            },
        );
        expect(problemList).toEqual([]);
    });

    test.each(SAMPLE_LIST)('%s', (code, sample) => {
        const ownPatternList = findOwnPatternList(code);
        expect(ownPatternList.length).toBe(1);
        for (const line of [
            sample.make,
            sample.resource,
            ...(sample.more ?? []),
        ]) {
            expect(
                ownPatternList.some((pattern) => {
                    return pattern.test(toReadLine(line));
                }),
            ).toBe(true);
            expect(readStudyFileAsk(line)).toBe(true);
            for (const variant of toTypedVariantList(line)) {
                expect(readStudyFileAsk(variant)).toBe(true);
            }
        }
        // A how-to and a note are nobody's study ask: not this language's,
        // not a neighbour's.
        for (const line of [sample.howTo, sample.note]) {
            if (line !== undefined) {
                expect(readStudyFileAsk(line)).toBe(false);
            }
        }
    });
});

// The study is written in the language the ask is named, and its passage
// quoted from a Bible in it: a line named another language, or none (the
// app's), would come back in that one. So each ask is named its own
// language or one of its family in an English app, as a request to add a
// line is (BN-42) -- 33 languages had not been until their little words
// held the words a study ask is made of -- and never another language in
// its own app.
const FAMILY_MAP = new Map(
    listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'typed.json',
    }).flatMap((folder) => {
        const file = JSON.parse(
            readFileSync(
                path.join(ONLINE_LANG_DATA_DIR, folder, 'typed.json'),
                'utf8',
            ),
        ) as Record<string, { family?: string }>;
        return Object.entries(file).map(([code, entry]) => {
            return [code, entry.family ?? null] as const;
        });
    }),
);

function checkIsOwnLanguage(code: string, found: string | null) {
    const family = FAMILY_MAP.get(code) ?? null;
    return (
        found === code ||
        (found !== null && family !== null && FAMILY_MAP.get(found) === family)
    );
}

describe('the language each study ask is named', () => {
    test.each(SAMPLE_LIST)('%s', (code, sample) => {
        const wrongList = [sample.make, sample.resource].flatMap((line) => {
            const inEnglishApp = detectTypedLanguage(line, 'en');
            const inOwnApp = detectTypedLanguage(line, code);
            return [
                ...(checkIsOwnLanguage(code, inEnglishApp)
                    ? []
                    : [`en app: ${line} -> ${inEnglishApp}`]),
                ...(checkIsOwnLanguage(code, inOwnApp) || inOwnApp === null
                    ? []
                    : [`${code} app: ${line} -> ${inOwnApp}`]),
            ];
        });
        expect(wrongList).toEqual([]);
    });
});

// A Latin-script language's words can be English ones ("lag", "gem",
// "general", "studio"): no typed language may read an English line as its
// study ask. Every question the help window knows, and lines found to fall
// into a pattern while the patterns were written.
const QUESTION_DIR = path.join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'tools',
    'owa-devtools-mcp',
    'questions',
);
const CORPUS_QUESTION_LIST = readdirSync(QUESTION_DIR)
    .filter((fileName) => {
        return fileName.endsWith('.json') && fileName !== 'schema.json';
    })
    .flatMap((fileName) => {
        const page = JSON.parse(
            readFileSync(path.join(QUESTION_DIR, fileName), 'utf8'),
        ) as { sections: { questions: { text: string }[] }[] };
        return page.sections.flatMap((section) => {
            return section.questions.map((question) => {
                return question.text;
            });
        });
    });
const ENGLISH_LINE_LIST = [
    'Create a scene in OBS Studio',
    'Prepare the studio for Sunday',
    'Make the studio monitor louder',
    'The markdown component is broken',
    'Markdown general settings are missing',
    'Write a recursive function',
    'Generate a general report of the studies',
    'Save the lag settings for the studies list',
    'Save the gem settings for the studies list',
    'Compose a component for the studio',
    'Prepare the slides for Romans 8',
    'Make a running order for Easter',
    'Create a new Bible note for John 3:16',
];

describe('no typed language reads an English line', () => {
    test('the corpus has questions', () => {
        expect(CORPUS_QUESTION_LIST.length).toBeGreaterThan(400);
    });

    test('none is a typed language study ask', () => {
        const hitList = [...CORPUS_QUESTION_LIST, ...ENGLISH_LINE_LIST].flatMap(
            (line) => {
                return listTypedLanguages()
                    .filter((language) => {
                        return language.studyFileAskPatterns.some((pattern) => {
                            return pattern.test(line);
                        });
                    })
                    .map((language) => {
                        return `${language.code}: ${line}`;
                    });
            },
        );
        expect(hitList).toEqual([]);
    });
});

// The labels a package shows beside a study -- the word-study button, the
// files heading -- are no ask, whatever language reads them.
const LABEL_KEY_LIST = ['Study the words', 'Study files for this chapter'];

describe('no package label is a study ask', () => {
    test('in every package', () => {
        const hitList = listLangPackageCodes({
            isEnglishIncluded: false,
        }).flatMap((folder) => {
            const dictionary = JSON.parse(
                readFileSync(
                    path.join(ONLINE_LANG_DATA_DIR, folder, 'dictionary.json'),
                    'utf8',
                ),
            ) as Record<string, unknown>;
            return LABEL_KEY_LIST.flatMap((key) => {
                const label = dictionary[key];
                return typeof label === 'string' && readStudyFileAsk(label)
                    ? [`${folder} "${key}": ${label}`]
                    : [];
            });
        });
        expect(hitList).toEqual([]);
    });
});
