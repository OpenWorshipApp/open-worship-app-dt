import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    checkHasChangeClaim,
    checkHasForegroundClaim,
    checkHasMadeChangeClaim,
    findStudyChangeReport,
} from '../../../../chatbot/changeClaimHelpers';
import { toChangeClaimWords } from '../../../../chatbot/chatLangHelpers';
import {
    checkHasLangPackage,
    listLangPackageCodes,
    ONLINE_LANG_DATA_DIR,
} from '../../../../test-setup/langPackageDirs';

// EC-508 (2026-11-12): an answer saying it changed the note or the study
// when nothing did (BN-53, EC-499, EC-501), and such a claim written into
// the study as its new words (EC-505), were read in English alone -- while
// a Gemma 4 model answers in the person's own language. Each language says
// it in its own file (`changeClaims`): `claim`, the assistant's own report
// of a change it made; `unsaved`, its "not saved yet" (read apart since
// EC-700: no more than the truth of a new study a card holds); `save`, the
// study card's Save changes; `file`, words pointing at the file itself --
// compiled only for an answer in it (`toChangeClaimWords`). One sample of
// each, as an assistant writes the
// language: four claims, "not saved yet", Save changes named, two reports
// written into a study, ten lines that claim nothing -- an offer, a step for
// the person, what a person of the Bible did, a study's own words -- and two
// that say nothing was changed. A blind set of answers in each language,
// written without the patterns, found Spanish's "no he cambiado nada" read
// as "he cambiado"; each answer of that set once misread is kept
// (`blindFound`).
type SampleType = {
    folder: string;
    claims: string[];
    unsaved: string;
    save: string;
    reports: string[];
    notClaims: string[];
    negated: string[];
    blindFound?: string[];
};

// The typed asks of EC-465 and EC-508, which ask and never claim.
type KeepSampleType = {
    keep: string;
    polite: string;
    more: string;
    topic: string;
    studyAsks: string[];
};

function readSampleFile<T>(fileName: string) {
    return JSON.parse(
        readFileSync(path.join(import.meta.dirname, fileName), 'utf8'),
    ) as Record<string, T>;
}

const SAMPLE_MAP = readSampleFile<SampleType>('typedChangeClaims.json');
const KEEP_SAMPLE_MAP = readSampleFile<KeepSampleType>(
    'typedStudyKeepAsks.json',
);
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

const STUDY_FILE = 'JHN.3.The New Birth.md';
const ENGLISH_CLAIM = 'I have added a short prayer at the end of the study.';

// As the claim readers read words (`toClaimReadText`).
function toReadText(text: string) {
    return text
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʻʼ]/g, "'");
}

// The lines the help window knows in a language that are not a person's
// question -- its section names and asks: none is a claim. A question ("I
// deleted a Bible by mistake: how do I get it back?") is never an answer,
// and only an answer is read for a claim.
function listCorpusLines(folder: string) {
    const filePath = path.join(ONLINE_LANG_DATA_DIR, folder, 'questions.json');
    if (!existsSync(filePath)) {
        return [];
    }
    const corpus = JSON.parse(readFileSync(filePath, 'utf8')) as {
        sections?: Record<string, { text?: string }>;
        questions?: Record<string, { text?: string }>;
    };
    return [
        ...Object.values(corpus.sections ?? {}),
        ...Object.values(corpus.questions ?? {}),
    ].flatMap((entry) => {
        return typeof entry.text === 'string' && !/[?？؟]\s*$/.test(entry.text)
            ? [entry.text]
            : [];
    });
}

// Each language's `changeClaims` as its own files hold it: an entry of its
// typed.json, or its assistant.json.
function listChangeClaimEntryList() {
    const typedList = listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'typed.json',
    }).flatMap((folder) => {
        const file = JSON.parse(
            readFileSync(
                path.join(ONLINE_LANG_DATA_DIR, folder, 'typed.json'),
                'utf8',
            ),
        ) as Record<string, { changeClaims?: unknown }>;
        return Object.entries(file).map(([code, entry]) => {
            return { code, claims: entry.changeClaims };
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
        ) as { changeClaims?: unknown };
        return { code: folder, claims: file.changeClaims };
    });
    return [...typedList, ...assistantList];
}

// A word start is a letter-class lookbehind, and every one costs (memory
// `language-pattern-boundary-cost`): one per word list.
const MAX_WORD_START_COUNT = 3;

function countWordStarts(source: string) {
    return source.split('(?<!').length - 1;
}

describe('"I have changed it" in every language', () => {
    test('every language has a sample', () => {
        expect(Object.keys(SAMPLE_MAP).length).toBeGreaterThanOrEqual(88);
    });

    test('every language carries one set that compiles', () => {
        const entryList = listChangeClaimEntryList();
        // One at least for each package in the checkout, none when only
        // English is in it.
        expect(entryList.length).toBeGreaterThanOrEqual(
            listLangPackageCodes({ isEnglishIncluded: false }).length,
        );
        const problemList = entryList.flatMap(({ code, claims }) => {
            const source = (claims ?? {}) as Record<string, unknown>;
            const fieldList = [
                'claim',
                'unsaved',
                'save',
                'file',
                // A foreground change's words are a language's own, and a
                // language without them is read by its note words alone
                // (EC-607).
                ...(source.foreground === undefined
                    ? []
                    : (['foreground'] as const)),
            ] as const;
            return fieldList.flatMap((field) => {
                const value = source[field];
                if (typeof value !== 'string' || value === '') {
                    return [`${code}: ${field} expected`];
                }
                // An answer is read in NFC (`toClaimReadText`), and NFC
                // takes some letters apart (a nukta letter): so are the
                // words.
                if (value.normalize('NFC') !== value) {
                    return [`${code}: ${field} is not NFC`];
                }
                try {
                    new RegExp(value, 'iu');
                } catch (error) {
                    return [`${code}: ${field} ${String(error)}`];
                }
                return countWordStarts(value) > MAX_WORD_START_COUNT
                    ? [
                          `${code}: ${field} has ${countWordStarts(value)} word starts`,
                      ]
                    : [];
            });
        });
        expect(problemList).toEqual([]);
    });

    test('English has its words in code, and an unknown code none', () => {
        expect(toChangeClaimWords('en')).toBeNull();
        expect(toChangeClaimWords(null)).toBeNull();
        expect(toChangeClaimWords('xx')).toBeNull();
    });

    test.each(SAMPLE_LIST)('%s', (code, sample) => {
        const claimWords = toChangeClaimWords(code);
        expect(claimWords?.claim, code).toBeInstanceOf(RegExp);
        expect(claimWords?.unsaved, code).toBeInstanceOf(RegExp);
        expect(claimWords?.save, code).toBeInstanceOf(RegExp);
        expect(claimWords?.file, code).toBeInstanceOf(RegExp);
        // Its own claims, read by its words -- never by English's alone.
        for (const line of [...sample.claims, sample.unsaved]) {
            expect(checkHasChangeClaim(line, claimWords, false), line).toBe(
                true,
            );
            expect(checkHasChangeClaim(line, null, true), line).toBe(false);
        }
        // A change reported MADE is its claims, never its "not saved yet"
        // -- what an answer under a card holding a new study says of it
        // (EC-700) -- and its "not saved yet" reads none of them.
        for (const line of sample.claims) {
            expect(checkHasMadeChangeClaim(line, claimWords), line).toBe(true);
            expect(claimWords?.unsaved?.test(toReadText(line)), line).toBe(
                false,
            );
        }
        expect(
            checkHasMadeChangeClaim(sample.unsaved, claimWords),
            sample.unsaved,
        ).toBe(false);
        expect(
            claimWords?.unsaved?.test(toReadText(sample.unsaved)),
            sample.unsaved,
        ).toBe(true);
        // Save changes named is a study's claim.
        expect(checkHasChangeClaim(sample.save, claimWords, true)).toBe(true);
        // A report written into a study, under a heading.
        for (const line of sample.reports) {
            expect(
                findStudyChangeReport(
                    { file: STUDY_FILE, content: `## Notes\n\n${line}` },
                    claimWords,
                ),
                line,
            ).toBe(line.trim());
        }
        // An offer, a step, a person of the Bible, a study's own words, and
        // nothing changed.
        expect(sample.negated.length, code).toBe(2);
        for (const line of [
            ...sample.notClaims,
            ...sample.negated,
            ...(sample.blindFound ?? []),
        ]) {
            expect(checkHasChangeClaim(line, claimWords, true), line).toBe(
                false,
            );
        }
        // The file named with no claim: its file words, and no report.
        const fileLine = sample.notClaims[9];
        expect(claimWords?.file?.test(toReadText(fileLine)), fileLine).toBe(
            true,
        );
        expect(
            findStudyChangeReport(
                { file: STUDY_FILE, content: fileLine },
                claimWords,
            ),
        ).toBeNull();
        // English's claim words still read an answer in the language.
        expect(checkHasChangeClaim(ENGLISH_CLAIM, claimWords, false)).toBe(
            true,
        );
        // What a person types asks; it never claims.
        const keep = KEEP_SAMPLE_MAP[code];
        expect(keep, code).toBeDefined();
        for (const line of [
            keep.keep,
            keep.polite,
            keep.more,
            keep.topic,
            ...keep.studyAsks,
            ...listCorpusLines(sample.folder),
        ]) {
            expect(checkHasChangeClaim(line, claimWords, true), line).toBe(
                false,
            );
        }
    });
});

// EC-607 (2026-11-13): a Spanish "I have started a countdown" over nothing
// put up drew no note -- a language's note words say "added", never
// "started" -- so a foreground change claimed in any language but English
// was read only where it happened to say a note's word. Each language says
// its own (`changeClaims.foreground`). Held to a set written BLIND, by
// readers never shown the words: six claims (a countdown started, the clock
// taken off, everything cleared, a message put up, a countdown paused, the
// screen turned on), four lines that claim nothing (an offer, a promise, a
// step for the person) and two that say nothing was changed. Each language
// reads its claims at its floor -- the figure when the words were written,
// a few of them mended for a claim the set found missed -- and none of the
// rest, nor a line a person types to ask for an overlay ("I sent you a
// message yesterday" among them), nor a note sample's lines that claim
// nothing.
type ForegroundSampleType = {
    folder: string;
    floor: number;
    claims: string[];
    notClaims: string[];
    negated: string[];
};

const FOREGROUND_SAMPLE_MAP = readSampleFile<ForegroundSampleType>(
    'typedForegroundClaims.json',
);
const FOREGROUND_SAMPLE_LIST = Object.entries(FOREGROUND_SAMPLE_MAP).filter(
    ([, sample]) => {
        return checkHasLangPackage(sample.folder);
    },
);
const FOREGROUND_ASK_MAP_LIST = [
    readSampleFile<unknown>('foregroundAsksHeldOut.json'),
    readSampleFile<unknown>('foregroundMessageAsksHeldOut.json'),
];

function listStrings(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }
    if (value !== null && typeof value === 'object') {
        return Object.values(value).flatMap(listStrings);
    }
    return [];
}

describe('"I have started the countdown" in every language', () => {
    test('every language has a sample', () => {
        expect(Object.keys(FOREGROUND_SAMPLE_MAP).length).toBe(
            Object.keys(SAMPLE_MAP).length,
        );
    });

    test.each(FOREGROUND_SAMPLE_LIST)('%s', (code, sample) => {
        const claimWords = toChangeClaimWords(code);
        const readList = sample.claims.filter((line) => {
            return checkHasForegroundClaim(line, claimWords);
        });
        expect(readList.length, code).toBeGreaterThanOrEqual(sample.floor);
        expect(sample.negated.length, code).toBe(2);
        for (const line of [...sample.notClaims, ...sample.negated]) {
            expect(checkHasForegroundClaim(line, claimWords), line).toBe(false);
        }
        const foreground = claimWords?.foreground ?? null;
        if (foreground === null) {
            return;
        }
        const noteSample = SAMPLE_MAP[code];
        const keep = KEEP_SAMPLE_MAP[code];
        for (const line of [
            ...FOREGROUND_ASK_MAP_LIST.flatMap((askMap) => {
                return listStrings(askMap[code]);
            }),
            ...(noteSample?.notClaims ?? []),
            ...(noteSample?.negated ?? []),
            ...(noteSample?.blindFound ?? []),
            ...(keep === undefined ? [] : listStrings(keep)),
            ...listCorpusLines(sample.folder),
        ]) {
            expect(foreground.test(toReadText(line)), line).toBe(false);
        }
    });
});
