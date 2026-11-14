import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    checkIsStudyKeepAsk,
    listAssistantLanguages,
    listTypedLanguages,
} from '../../../../chatbot/chatLangHelpers';
import { readKeepAnswerAsk } from '../../../../chatbot/studyFileChatHelpers';
import {
    checkHasLangPackage,
    listLangPackageCodes,
    ONLINE_LANG_DATA_DIR,
} from '../../../../test-setup/langPackageDirs';

// EC-508 (2026-11-12): "save that as a study file" in any language, not
// in English alone (EC-466). EC-465's patterns had read it in Spanish,
// Chinese or Khmer as an ask for a NEW study, which the model then wrote
// in place of the answer above. Each language says it in its own file
// (`studyKeepAsks`): ONE pair -- its keep words (`keep`), read first, and
// the rest (`pattern`): a word pointing at the answer above and a study
// word, and none of the words asking for more, nor its how-to or note
// words. One sample of each, as a person types it: the ask (`keep`), a
// polite one (`polite`), one asking for more as well (`more`), a new study
// about something (`topic`), and EC-465's own study asks (`studyAsks`).
type SampleType = {
    folder: string;
    keep: string;
    polite: string;
    more: string;
    topic: string;
    studyAsks: string[];
};

const SAMPLE_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'typedStudyKeepAsks.json'),
        'utf8',
    ),
) as Record<string, SampleType>;
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

function findOwnPairList(code: string) {
    return (
        [...listAssistantLanguages(), ...listTypedLanguages()].find(
            (language) => {
                return language.code === code;
            },
        )?.studyKeepAskSources ?? []
    );
}

// The line as `readKeepAnswerAsk` reads it.
function toReadLine(line: string) {
    return line
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʻʼ]/g, "'")
        .trim();
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

// Each language's `studyKeepAsks` as its own files hold it: an entry of
// its typed.json, or its assistant.json.
function listKeepAskEntryList() {
    const typedList = listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'typed.json',
    }).flatMap((folder) => {
        const file = JSON.parse(
            readFileSync(
                path.join(ONLINE_LANG_DATA_DIR, folder, 'typed.json'),
                'utf8',
            ),
        ) as Record<string, { studyKeepAsks?: unknown }>;
        return Object.entries(file).map(([code, entry]) => {
            return { code, list: entry.studyKeepAsks };
        });
    });
    const assistantList = listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'assistant.json',
    }).map((folder) => {
        const file = JSON.parse(
            readFileSync(
                path.join(ONLINE_LANG_DATA_DIR, folder, 'assistant.json'),
                'utf8',
            ),
        ) as { studyKeepAsks?: unknown };
        return { code: folder, list: file.studyKeepAsks };
    });
    return [...typedList, ...assistantList];
}

// A word start is a letter-class lookbehind, and every one costs (memory
// `language-pattern-boundary-cost`): one per word list. The keep words are
// one list; the rest holds at most six.
const MAX_KEEP_WORD_START_COUNT = 1;
const MAX_PATTERN_WORD_START_COUNT = 7;

function countWordStarts(source: string) {
    return source.split('(?<!').length - 1;
}

describe('"save that as a study file" in every language', () => {
    test('every language has a sample', () => {
        expect(Object.keys(SAMPLE_MAP).length).toBeGreaterThanOrEqual(88);
    });

    test('every language carries one pair that compiles', () => {
        const entryList = listKeepAskEntryList();
        expect(entryList.length).toBeGreaterThan(0);
        const problemList = entryList.flatMap(({ code, list }) => {
            if (!Array.isArray(list) || list.length !== 1) {
                return [`${code}: one pair expected`];
            }
            const { keep, pattern } = (list[0] ?? {}) as Record<
                string,
                unknown
            >;
            if (typeof keep !== 'string' || typeof pattern !== 'string') {
                return [`${code}: keep and pattern expected`];
            }
            try {
                new RegExp(keep, 'iu');
                new RegExp(pattern, 'iu');
            } catch (error) {
                return [`${code}: ${String(error)}`];
            }
            return [
                ...(countWordStarts(keep) > MAX_KEEP_WORD_START_COUNT
                    ? [`${code}: keep has ${countWordStarts(keep)} word starts`]
                    : []),
                ...(countWordStarts(pattern) > MAX_PATTERN_WORD_START_COUNT
                    ? [
                          `${code}: pattern has ${countWordStarts(pattern)} word starts`,
                      ]
                    : []),
            ];
        });
        expect(problemList).toEqual([]);
    });

    test.each(SAMPLE_LIST)('%s', (code, sample) => {
        const pairList = findOwnPairList(code);
        expect(pairList.length).toBe(1);
        const keep = new RegExp(pairList[0].keep, 'iu');
        const pattern = new RegExp(pairList[0].pattern, 'iu');
        for (const line of [sample.keep, sample.polite]) {
            const readLine = toReadLine(line);
            // Its own pair reads it, whoever else does.
            expect(keep.test(readLine) && pattern.test(readLine), line).toBe(
                true,
            );
            expect(readKeepAnswerAsk(line), line).toBe(true);
            for (const variant of toTypedVariantList(line)) {
                expect(readKeepAnswerAsk(variant), variant).toBe(true);
            }
        }
        // More asked of it, a new study about something, and an ask for a
        // new study are no language's keep ask: the model reads them.
        for (const line of [sample.more, sample.topic, ...sample.studyAsks]) {
            expect(readKeepAnswerAsk(line), line).toBe(false);
        }
    });
});

// A Latin-script language's keep words can be English ones ("gem",
// "salve", "vista"): no language may read an English line as a keep ask.
// Every question the help window knows, and English lines near one.
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
    'save that as a study file',
    'keep this as a study',
    'make a study file for John 3:16',
    'save that as a study file and add a diagram',
    'how do I save this as a study file?',
    'save that as a note',
    'Save the gem settings for the studies list',
    'Copy that to the study resources folder',
    'Store the vista of the studio',
    'Salve the wound, then save the study',
];

describe('no language reads an English line as its keep ask', () => {
    test('the corpus has questions', () => {
        expect(CORPUS_QUESTION_LIST.length).toBeGreaterThan(400);
    });

    test('none is read', () => {
        const hitList = [...CORPUS_QUESTION_LIST, ...ENGLISH_LINE_LIST].filter(
            (line) => {
                return checkIsStudyKeepAsk(toReadLine(line));
            },
        );
        expect(hitList).toEqual([]);
    });
});
