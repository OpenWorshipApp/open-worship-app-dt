import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { readBackgroundLinkAsk } from '../../../../chatbot/backgroundLinkAskHelpers';
import { readBibleListAsk } from '../../../../chatbot/bibleListAskHelpers';
import { readDocumentCreateAsk } from '../../../../chatbot/documentCreateHelpers';
import {
    CREATE_ASK_WORD_GROUP_LIST,
    type CreateAskWordsType,
    readCreateAskInOwnLanguage,
    readTypedCreateAsk,
    type TypedCreateAskType,
} from '../../../../chatbot/typedCreateAskHelpers';
import { readWebBackgroundAsk } from '../../../../chatbot/webBackgroundAskHelpers';
import { checkIsSpacedLocale } from '../../../../helper/bibleVerseFindHelpers';
import {
    checkHasLangPackage,
    listLangPackageCodes,
    ONLINE_LANG_DATA_DIR,
} from '../../../../test-setup/langPackageDirs';

// EC-516 (2026-11-12): a new running order or slide document, passages
// saved to a Bibles list or a new list, a background web page, and a video
// or a track from a link, asked for in every language a person may type,
// not only in English (EC-514, EC-515, EC-518). Each language says the
// words of such a request in its `typed.json` or `assistant.json`
// (`createAsks`, word lists). The samples were written BLIND -- by readers
// never shown the words -- as a volunteer types: each ask read as its job,
// in an English app and in its own, and four lines that ask for nothing (a
// how-to, a where-is, a file made yesterday, an is-there) read as none.
type SampleType = {
    folder: string;
    flow: string;
    flowContent: string;
    slideNamed: { line: string; name: string };
    listSave: { line: string; references: number };
    listNew: { line: string; name: string };
    webPage: string;
    video: string;
    audio: string;
    not: string[];
    // A check that fails for a reason no word list can mend, said: by the
    // app it is asked in (`en`, or `own`), the check's label and why. Each
    // must still fail -- one that passes is taken off.
    knownMiss?: Partial<Record<'en' | 'own', Record<string, string>>>;
};

const SAMPLE_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'typedCreateAsks.json'),
        'utf8',
    ),
) as Record<string, SampleType>;
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});
const LINK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const QUESTION_DIR = path.join(
    import.meta.dirname,
    '../../../../../tools/owa-devtools-mcp/questions',
);

// Each language's `createAsks`, as its own file holds it, by its code.
function listCreateAskEntryList() {
    return listLangPackageCodes({ isEnglishIncluded: false }).flatMap(
        (folder) => {
            const typedPath = path.join(
                ONLINE_LANG_DATA_DIR,
                folder,
                'typed.json',
            );
            const assistantPath = path.join(
                ONLINE_LANG_DATA_DIR,
                folder,
                'assistant.json',
            );
            const entryList: { code: string; words: unknown }[] = [];
            try {
                const file = JSON.parse(
                    readFileSync(typedPath, 'utf8'),
                ) as Record<string, { createAsks?: unknown }>;
                for (const [code, entry] of Object.entries(file)) {
                    entryList.push({ code, words: entry.createAsks });
                }
            } catch (_error) {
                // A package whose assistant file says it instead.
            }
            try {
                const file = JSON.parse(
                    readFileSync(assistantPath, 'utf8'),
                ) as { createAsks?: unknown };
                entryList.push({ code: folder, words: file.createAsks });
            } catch (_error) {
                // A package with a typed file alone.
            }
            return entryList;
        },
    );
}

function toNameKey(name: string | null | undefined) {
    return String(name ?? '')
        .normalize('NFC')
        .replace(/["'\p{Pi}\p{Pf}\p{Ps}\p{Pe}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function describeAsk(ask: TypedCreateAskType | null) {
    return JSON.stringify(ask);
}

// What is wrong with one sample's reading, in one app language, as lines.
function listAllProblems(sample: SampleType, appLangCode: string) {
    const problemList: string[] = [];
    const read = (line: string) => {
        return readCreateAskInOwnLanguage(line, appLangCode);
    };
    const expectAsk = (
        label: string,
        line: string,
        check: (ask: TypedCreateAskType | null) => boolean,
    ) => {
        const ask = read(line);
        if (!check(ask)) {
            problemList.push(`${label}: ${line} -> ${describeAsk(ask)}`);
        }
    };
    expectAsk('flow', sample.flow, (ask) => {
        return (
            ask?.job === 'document' && ask.kind === 'flow' && !ask.hasContent
        );
    });
    expectAsk('flowContent', sample.flowContent, (ask) => {
        return ask?.job === 'document' && ask.kind === 'flow' && ask.hasContent;
    });
    expectAsk('slideNamed', sample.slideNamed.line, (ask) => {
        return (
            ask?.job === 'document' &&
            ask.kind === 'slide' &&
            toNameKey(ask.name) === toNameKey(sample.slideNamed.name)
        );
    });
    expectAsk('listSave', sample.listSave.line, (ask) => {
        return (
            ask?.job === 'bibleList' &&
            !ask.isNewList &&
            ask.references.length === sample.listSave.references
        );
    });
    expectAsk('listNew', sample.listNew.line, (ask) => {
        return (
            ask?.job === 'bibleList' &&
            ask.isNewList &&
            toNameKey(ask.listName) === toNameKey(sample.listNew.name)
        );
    });
    expectAsk('webPage', sample.webPage, (ask) => {
        return ask?.job === 'webBackground';
    });
    expectAsk('video', sample.video, (ask) => {
        return (
            ask?.job === 'backgroundLink' &&
            ask.kind === 'video' &&
            ask.url === LINK
        );
    });
    expectAsk('audio', sample.audio, (ask) => {
        return (
            ask?.job === 'backgroundLink' &&
            ask.kind === 'audio' &&
            ask.url === LINK
        );
    });
    for (const line of sample.not) {
        expectAsk('not', line, (ask) => {
            return ask === null;
        });
    }
    return problemList;
}

function toLabel(problem: string) {
    return problem.slice(0, problem.indexOf(':'));
}

// The problems but the known misses, and the known misses that now pass.
function listProblems(sample: SampleType, appLangCode: string) {
    const knownMap =
        sample.knownMiss?.[appLangCode === 'en' ? 'en' : 'own'] ?? {};
    const problemList = listAllProblems(sample, appLangCode);
    const labelList = problemList.map(toLabel);
    return [
        ...problemList.filter((problem) => {
            return !(toLabel(problem) in knownMap);
        }),
        ...Object.keys(knownMap)
            .filter((label) => {
                return !labelList.includes(label);
            })
            .map((label) => {
                return `${label}: a known miss that passes now`;
            }),
    ];
}

describe('something made, asked for in every language', () => {
    test('every language has a sample and its words', () => {
        expect(SAMPLE_LIST.length).toBeGreaterThanOrEqual(
            listLangPackageCodes({ isEnglishIncluded: false }).length,
        );
        const missingList = listCreateAskEntryList()
            .filter(({ words }) => {
                return words === undefined;
            })
            .map(({ code }) => {
                return code;
            });
        expect(missingList).toEqual([]);
    });

    test('every list is of lower-case words, and every group is known', () => {
        const groupSet = new Set<string>(CREATE_ASK_WORD_GROUP_LIST);
        const problemList = listCreateAskEntryList().flatMap(
            ({ code, words }) => {
                if (words === undefined) {
                    return [];
                }
                if (typeof words !== 'object' || words === null) {
                    return [`${code}: not an object`];
                }
                return Object.entries(words).flatMap(([group, list]) => {
                    if (!groupSet.has(group)) {
                        return [`${code}: ${group} is no group`];
                    }
                    if (!Array.isArray(list)) {
                        return [`${code}: ${group} is not a list`];
                    }
                    return list
                        .filter((word) => {
                            return (
                                typeof word !== 'string' ||
                                word.trim() === '' ||
                                word !== word.normalize('NFC').toLowerCase()
                            );
                        })
                        .map((word) => {
                            return `${code}: ${group} "${String(word)}"`;
                        });
                });
            },
        );
        expect(problemList).toEqual([]);
    });

    test.each(SAMPLE_LIST)('%s, in an English app', (_code, sample) => {
        expect(listProblems(sample, 'en')).toEqual([]);
    });

    test.each(SAMPLE_LIST)('%s, in its own app', (code, sample) => {
        expect(listProblems(sample, code)).toEqual([]);
    });
});

// A second set, HELD OUT (2026-11-12): written blind by other readers once
// the words above were made, and scored as it came -- 837 of 1 056 checks
// in an English app and 839 in each language's own; 488 of 704 asks read
// right, and 698 of 704 lines that ask for nothing read as none. Those three
// lines were mended (a typed language's own question words in the reader,
// and two languages' lists); nothing else was tuned on it. Each language
// keeps at least what it scored (`floor`, raised when it does better), and
// no line that asks for nothing is ever read. A word added FOR one of these
// lines spends the set: a round that does so writes a new one to measure by.
type HeldOutSampleType = SampleType & { floor: { en: number; own: number } };

const HELD_OUT_LIST = Object.entries(
    JSON.parse(
        readFileSync(
            path.join(import.meta.dirname, 'typedCreateAsksHeldOut.json'),
            'utf8',
        ),
    ) as Record<string, HeldOutSampleType>,
).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

describe('a held-out set, written blind after the words', () => {
    test.each(HELD_OUT_LIST)('%s keeps what it scored', (code, sample) => {
        const countPassing = (appLangCode: string) => {
            return (
                8 +
                sample.not.length -
                listAllProblems(sample, appLangCode).length
            );
        };
        const readNotList = [
            ...listAllProblems(sample, 'en'),
            ...listAllProblems(sample, code),
        ].filter((problem) => {
            return toLabel(problem) === 'not';
        });
        expect(readNotList).toEqual([]);
        expect(countPassing('en')).toBeGreaterThanOrEqual(sample.floor.en);
        expect(countPassing(code)).toBeGreaterThanOrEqual(sample.floor.own);
    });
});

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

// An English line is English's to read, in any app: no language's words
// may take one the English readers left alone.
describe('no language reads an English line as its ask', () => {
    test('the corpus has questions', () => {
        expect(CORPUS_QUESTION_LIST.length).toBeGreaterThan(400);
    });

    test.each(
        SAMPLE_LIST.map(([code]) => {
            return code;
        }),
    )('none is read in a %s app', (code) => {
        const hitList = CORPUS_QUESTION_LIST.filter((line) => {
            return readCreateAskInOwnLanguage(line, code) !== null;
        });
        expect(hitList).toEqual([]);
    });
});

// A supported question in a language's own corpus is the guide's, as its
// English is: none whose English the English readers leave alone may be
// read as an ask in that language's app.
function checkIsEnglishAsk(text: string) {
    return (
        readDocumentCreateAsk(text) !== null ||
        readBibleListAsk(text) !== null ||
        readWebBackgroundAsk(text) !== null ||
        readBackgroundLinkAsk(text) !== null
    );
}

const OWN_CORPUS_LIST = listLangPackageCodes({ isEnglishIncluded: false })
    .map((folder) => {
        try {
            const file = JSON.parse(
                readFileSync(
                    path.join(ONLINE_LANG_DATA_DIR, folder, 'questions.json'),
                    'utf8',
                ),
            ) as {
                lang: string;
                questions: Record<string, { en: string; text: string }>;
            };
            return { code: file.lang, rowList: Object.values(file.questions) };
        } catch (_error) {
            return null;
        }
    })
    .filter((corpus) => {
        return corpus !== null;
    });

describe("no language reads its own corpus's questions as asks", () => {
    test.runIf(OWN_CORPUS_LIST.length > 0).each(
        OWN_CORPUS_LIST.map((corpus) => {
            return [corpus.code, corpus.rowList] as const;
        }),
    )('none is read in a %s app', (code, rowList) => {
        const hitList = rowList
            .filter((row) => {
                return (
                    !checkIsEnglishAsk(row.en) &&
                    readCreateAskInOwnLanguage(row.text, code) !== null
                );
            })
            .map((row) => {
                return row.text;
            });
        expect(hitList).toEqual([]);
    });
});

// EC-783 (2026-11-21): _my presentation is open in PowerPoint, but
// PowerPoint is closed. What do I do?_ -- the French "do" is "make", and a
// slide document was made from words two sentences apart. In every language
// the word to make and the thing made must share a sentence: each language's
// own words, said apart, ask for nothing; said together, they still ask.
describe('the word to make and the thing made share a sentence', () => {
    // A list entry as a person writes it: no stem mark, no parts.
    const toPlainWord = (list: string[] | undefined) => {
        return (list ?? []).find((entry) => {
            return !/[*…]/u.test(entry) && entry.trim() !== '';
        });
    };
    const caseList = listCreateAskEntryList().flatMap(({ code, words }) => {
        const wordMap = (words ?? {}) as CreateAskWordsType;
        const make = toPlainWord(wordMap.make);
        const slide = toPlainWord(wordMap.slide);
        if (make === undefined || slide === undefined) {
            return [];
        }
        return [{ code, wordMap, make, slide }];
    });

    test('apart, in every script, they ask for nothing; together they ask', () => {
        const problemList: string[] = [];
        const heldList: string[] = [];
        for (const { code, wordMap, make, slide } of caseList) {
            const isSpaced = checkIsSpacedLocale(code);
            const together = isSpaced ? `${make} ${slide}` : `${make}${slide}`;
            const read = (line: string) => {
                return readTypedCreateAsk(line, wordMap, isSpaced);
            };
            if (read(together)?.job !== 'document') {
                // A pair the language reads as nothing even together (a
                // make word that is also a how-to word) says nothing here.
                continue;
            }
            heldList.push(code);
            for (const end of ['. ', '? ', '! ', '។', '。', '؟ ', '। ']) {
                const apart = `${slide}${end}${make}?`;
                const ask = read(apart);
                if (ask !== null) {
                    problemList.push(
                        `${code}: ${apart} -> ${describeAsk(ask)}`,
                    );
                }
            }
        }
        expect(problemList).toEqual([]);
        // 61 languages write a plain word for each (2026-11-21); the others
        // say theirs as stems or in parts, held by their samples above.
        expect(heldList.length).toBeGreaterThanOrEqual(55);
    });

    test('a stop that ends no sentence, and a sentence after the ask, are kept', () => {
        const words: CreateAskWordsType = {
            make: ['make'],
            slide: ['slide document'],
            bibleList: ['bible list'],
            webPage: ['web page'],
            named: ['called'],
        };
        const read = (line: string) => {
            return readTypedCreateAsk(line, words, true);
        };
        expect(read('Make a slide document. Thanks!')?.job).toBe('document');
        expect(read('Make a bible list with John 3.16')?.job).toBe('bibleList');
        expect(read('Slide document? Make it later.')).toBeNull();
        expect(read('My web page is gone. Make tea!')).toBeNull();
        expect(read('Thanks. Make a web page.')?.job).toBe('webBackground');
    });
});

// Under the answer to such a request the window offers the corpus's nearest
// questions when the model offered none -- ranked against English rows (and
// the app's own language where its questions are installed), which hold
// none of another language's words: a background web page asked for in
// Spanish in an English app had drawn the Reader's demo questions.
describe('the questions offered under the answer', () => {
    test('a request in another language is offered no English corpus question', async () => {
        const { genFollowUpQuestions } =
            await import('../../../../chatbot/questionHelpers');
        const offeredList: string[] = [];
        for (const [code, sample] of SAMPLE_LIST) {
            const followUps = await genFollowUpQuestions(
                sample.webPage,
                'presenter',
            );
            if (followUps.length > 0) {
                offeredList.push(`${code}: ${followUps.join(' | ')}`);
            }
        }
        expect(offeredList).toEqual([]);
        expect(
            await genFollowUpQuestions(
                'Make me a background web page with a clock',
                'presenter',
            ),
        ).toHaveLength(2);
    });
});
