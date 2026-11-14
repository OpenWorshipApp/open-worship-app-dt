import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    type ForegroundAskWordType,
    toCharClassSource,
    toForegroundAskWords,
} from '../../../../chatbot/chatLangHelpers';
import { readForegroundComponentAsk } from '../../../../chatbot/foregroundChatHelpers';
import {
    checkHasLangPackage,
    listLangPackageCodes,
    toLangPackageDir,
} from '../../../../test-setup/langPackageDirs';

// EC-564 (2026-11-13): "put the clock on the screen" in a language other
// than English, Khmer or French named no component -- the Time panel's
// label is an everyday word, read by a phrase only -- and was answered with
// the panel's steps. Each language says its words for a clock in its
// `typed.json` or `assistant.json` (`foregroundAsks.time`), read as its
// `createAsks` are: a bare word where the word is only a clock, the clock
// near the screen ("clock … screen") where it is also an hour or "o'clock".
// Held to the app's own clock lines in each language's dictionary, and to a
// set written BLIND (by a reader never shown the words): two asks naming
// the clock, read as the clock; three everyday lines about the time, read
// as none even with every language's words at once.
type HeldOutType = {
    put: string[];
    take: string;
    whatTime: string;
    startsAt: string;
    hours: string;
};

const HELD_OUT_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'foregroundAsksHeldOut.json'),
        'utf8',
    ),
) as Record<string, HeldOutType>;

const PACKAGE_LIST = listLangPackageCodes({ isEnglishIncluded: false });

function readJson(file: string) {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

type AskFileType = {
    foregroundAsks?: Record<string, string[]>;
    optionalMarks?: string;
};

// A package's words: its `assistant.json`'s, and each language its
// `typed.json` holds (keyed by that language's code), in its own spacing,
// read as the window reads them (`toForegroundAskWords`).
function readWords(code: string): ForegroundAskWordType[] {
    const dir = toLangPackageDir(code);
    const fileList: [string, AskFileType][] = [
        [code, readJson(path.join(dir, 'assistant.json'))],
        ...(Object.entries(readJson(path.join(dir, 'typed.json'))) as [
            string,
            AskFileType,
        ][]),
    ];
    return fileList.flatMap(([langCode, file]) => {
        return toForegroundAskWords(
            file.foregroundAsks,
            langCode,
            file.optionalMarks,
        );
    });
}

// A package's `optionalMarks`, from either file (EC-640).
function readOptionalMarks(code: string) {
    const dir = toLangPackageDir(code);
    const fileList: AskFileType[] = [
        readJson(path.join(dir, 'assistant.json')),
        ...(Object.values(
            readJson(path.join(dir, 'typed.json')),
        ) as AskFileType[]),
    ];
    return fileList
        .map((file) => {
            return file.optionalMarks ?? '';
        })
        .join('');
}

function readDictionary(code: string): Record<string, string> {
    return readJson(path.join(toLangPackageDir(code), 'dictionary.json'));
}

const ALL_WORDS = PACKAGE_LIST.flatMap(readWords);
const ENGLISH = (key: string) => {
    return key;
};

// The app's own lines: what its progress shows while the clock goes up and
// comes off, read as the clock; lines about other things or about hours,
// read as no clock.
const CLOCK_KEY_LIST = [
    'Putting a clock on the screen',
    'Taking the clock off the screen',
    'put a clock on the screen',
];
const NOT_CLOCK_KEY_LIST = [
    'Hours',
    'Spending limit per hour',
    'Limit per hour',
    'Putting a scrolling message on the screen',
    'Taking the countdown off the screen',
    'Taking the stopwatch off the screen',
];

describe('a clock asked for in every language', () => {
    test('every package says its words for a clock', () => {
        const lacking = PACKAGE_LIST.filter((code) => {
            return !readWords(code).some(({ key }) => {
                return key === 'time';
            });
        });
        expect(lacking).toEqual([]);
    });

    test.each(PACKAGE_LIST)('%s reads its own clock lines', (code) => {
        const dictionary = readDictionary(code);
        const words = readWords(code);
        const own = (key: string) => {
            return dictionary[key] ?? key;
        };
        for (const key of CLOCK_KEY_LIST) {
            expect(
                readForegroundComponentAsk(dictionary[key], own, words),
                `${key}: ${dictionary[key]}`,
            ).toBe('time');
        }
        // In its own app and in an English one, whose labels are English.
        for (const key of NOT_CLOCK_KEY_LIST) {
            for (const translate of [own, ENGLISH]) {
                expect(
                    readForegroundComponentAsk(
                        dictionary[key],
                        translate,
                        words,
                    ),
                    `${key}: ${dictionary[key]}`,
                ).not.toBe('time');
            }
        }
    });
});

describe('a held-out set, written blind', () => {
    const heldOutList = Object.entries(HELD_OUT_MAP).filter(([code]) => {
        return checkHasLangPackage(code);
    });

    test.each(heldOutList)('%s reads the clock asked for', (code, sample) => {
        const dictionary = readDictionary(code);
        const own = (key: string) => {
            return dictionary[key] ?? key;
        };
        const words = readWords(code);
        for (const line of [sample.put[0], sample.take]) {
            expect(readForegroundComponentAsk(line, own, words), line).toBe(
                'time',
            );
        }
    });

    test.each(heldOutList)(
        '%s, an everyday line is no clock',
        (_code, sample) => {
            for (const line of [
                sample.whatTime,
                sample.startsAt,
                sample.hours,
            ]) {
                expect(
                    readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                    line,
                ).not.toBe('time');
            }
        },
    );
});

// EC-605 (2026-11-13): a message, a countdown or a stopwatch asked for in
// an installed language other than the one the window is shown in named no
// component -- only two packages said a message on the screen, Message
// being an everyday word read by a phrase only -- and went the general
// way, three times the tokens of the foreground's own. Each package says
// "message … screen" in its own words (`foregroundAsks.message`), and its
// countdown and stopwatch labels, the last word a stem. Held to a set
// written BLIND (`foregroundMessageAsksHeldOut.json`): each language reads
// at least what it read when its words were made (`floor`) of three asks
// to put a message up and one to take it off, in its own app and in an
// English one, and of a countdown in an English one; three everyday lines
// -- a message sent, a bright screen, an announcement in the bulletin --
// read as none, in its own app and with every language's words at once.
type MessageHeldOutType = {
    put: string[];
    take: string;
    countdown: string;
    sent: string;
    bright: string;
    bulletin: string;
    floor: { message: number; countdown: number };
};

const MESSAGE_HELD_OUT_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'foregroundMessageAsksHeldOut.json'),
        'utf8',
    ),
) as Record<string, MessageHeldOutType>;

// A set keyed by a script's own tag (Traditional Chinese) is its package's.
function toPackageCode(code: string) {
    return checkHasLangPackage(code) ? code : code.split('-')[0];
}

describe('a message, a countdown and a stopwatch in every language', () => {
    test('every package says a message on the screen', () => {
        const lacking = PACKAGE_LIST.filter((code) => {
            return !readWords(code).some(({ key }) => {
                return key === 'message';
            });
        });
        expect(lacking).toEqual([]);
    });

    const heldOutList = Object.entries(MESSAGE_HELD_OUT_MAP).filter(
        ([code]) => {
            return checkHasLangPackage(toPackageCode(code));
        },
    );

    test.each(heldOutList)(
        '%s reads a message asked for, at its floor',
        (code, sample) => {
            const packageCode = toPackageCode(code);
            const dictionary = readDictionary(packageCode);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(packageCode);
            const readList = [...sample.put, sample.take].filter((line) => {
                return (
                    readForegroundComponentAsk(line, own, words) ===
                        'message' &&
                    readForegroundComponentAsk(line, ENGLISH, words) ===
                        'message'
                );
            });
            expect(readList.length).toBeGreaterThanOrEqual(
                sample.floor.message,
            );
            const countdown = readForegroundComponentAsk(
                sample.countdown,
                ENGLISH,
                words,
            );
            expect(countdown === 'countdown' ? 1 : 0).toBeGreaterThanOrEqual(
                sample.floor.countdown,
            );
        },
    );

    test.each(heldOutList)(
        '%s, an everyday line names nothing',
        (code, sample) => {
            const packageCode = toPackageCode(code);
            const dictionary = readDictionary(packageCode);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(packageCode);
            for (const line of [sample.sent, sample.bright, sample.bulletin]) {
                expect(
                    readForegroundComponentAsk(line, own, words),
                    line,
                ).toBeNull();
                expect(
                    readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                    line,
                ).toBeNull();
            }
        },
    );
});

// EC-620 (2026-11-14): seventeen languages read none of the countdowns of
// the set above -- its words had been the dictionary's two labels, and an
// ask says "count down 5 minutes", not the label -- and nine fewer than
// four of its messages. Their countdown, stopwatch and message words were
// written BLIND, and measured on a SECOND set written blind by another
// reader after them (`foregroundTimerAsksHeldOut.json`, nothing tuned on
// it): three countdowns, two stopwatches and two messages a language, read
// in its own app and in an English one, each language at least at what it
// read then (`floor`) -- 41 of 69 countdowns where 18 had been, 16 of 46
// stopwatches where 7 had -- and three lines that mention a time, a
// message or the screen asking for none, read as none in its own app and
// with every language's words at once.
type TimerHeldOutType = {
    countdown: string[];
    stopwatch: string[];
    message: string[];
    notAsk: string[];
    floor: { countdown: number; stopwatch: number; message: number };
};

const TIMER_HELD_OUT_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'foregroundTimerAsksHeldOut.json'),
        'utf8',
    ),
) as Record<string, TimerHeldOutType>;

const TIMER_KEY_LIST = ['countdown', 'stopwatch', 'message'] as const;

describe('a second held-out set of timers and messages, written blind', () => {
    const heldOutList = Object.entries(TIMER_HELD_OUT_MAP).filter(([code]) => {
        return checkHasLangPackage(code);
    });

    test.each(heldOutList)(
        '%s reads a countdown, a stopwatch and a message, at its floor',
        (code, sample) => {
            const dictionary = readDictionary(code);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(code);
            for (const key of TIMER_KEY_LIST) {
                const readList = sample[key].filter((line) => {
                    return (
                        readForegroundComponentAsk(line, own, words) === key &&
                        readForegroundComponentAsk(line, ENGLISH, words) === key
                    );
                });
                expect(readList.length, key).toBeGreaterThanOrEqual(
                    sample.floor[key],
                );
            }
        },
    );

    test.each(heldOutList)(
        '%s, a line asking for none names nothing',
        (code, sample) => {
            const dictionary = readDictionary(code);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(code);
            for (const line of sample.notAsk) {
                expect(
                    readForegroundComponentAsk(line, own, words),
                    line,
                ).toBeNull();
                expect(
                    readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                    line,
                ).toBeNull();
            }
        },
    );
});

// EC-642 (2026-11-14): a stopwatch asked for by describing it -- "a clock
// that counts up from zero" -- was read as the clock, in an English window
// and in eight languages (live, an Irish ask put a clock on the screen,
// EC-641), and a countdown described as "a clock counting down" as the
// clock or as nothing. Each language's words for a timer DESCRIBED were
// written blind, and measured on a THIRD set written blind by another
// reader at the same time, never shown the words and never tuned on
// (`foregroundTimerDescribedHeldOut.json`): five stopwatches described and
// two named, three countdowns described and three clocks a language, read
// in its own app and in an English one, each at least at what it read then
// (`floor`) -- 42 of 70 stopwatches where 19 had been, 17 of 30 countdowns
// where 10 had -- and four everyday lines about counting, the time, the
// volume or a clock read as no timer, in its own app and with every
// language's words at once. (One of them, a broken church clock, is still
// read as the clock in seven languages whose word for a clock is the clock
// alone: that is the clock's own reading, not a timer's.)
type DescribedHeldOutType = {
    stopwatchDescribed: string[];
    stopwatchNamed: string[];
    countdownDescribed: string[];
    clock: string[];
    none: string[];
    floor: { stopwatch: number; countdown: number; clock: number };
};

const DESCRIBED_HELD_OUT_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'foregroundTimerDescribedHeldOut.json'),
        'utf8',
    ),
) as Record<string, DescribedHeldOutType>;

const TIMER_KEY_SET = new Set(['stopwatch', 'countdown']);

describe('a third held-out set of timers described by a clock, written blind', () => {
    const heldOutList = Object.entries(DESCRIBED_HELD_OUT_MAP).filter(
        ([code]) => {
            return code === 'en' || checkHasLangPackage(code);
        },
    );
    const toReaders = (code: string) => {
        const dictionary = code === 'en' ? {} : readDictionary(code);
        const own = (key: string) => {
            return dictionary[key] ?? key;
        };
        return { own, words: code === 'en' ? [] : readWords(code) };
    };

    test.each(heldOutList)(
        '%s reads a stopwatch, a countdown and a clock, at its floor',
        (code, sample) => {
            const { own, words } = toReaders(code);
            const countRead = (lineList: string[], key: string) => {
                return lineList.filter((line) => {
                    return (
                        readForegroundComponentAsk(line, own, words) === key &&
                        readForegroundComponentAsk(line, ENGLISH, words) === key
                    );
                }).length;
            };
            expect(
                countRead(
                    [...sample.stopwatchDescribed, ...sample.stopwatchNamed],
                    'stopwatch',
                ),
                'stopwatch',
            ).toBeGreaterThanOrEqual(sample.floor.stopwatch);
            expect(
                countRead(sample.countdownDescribed, 'countdown'),
                'countdown',
            ).toBeGreaterThanOrEqual(sample.floor.countdown);
            expect(
                countRead(sample.clock, 'time'),
                'clock',
            ).toBeGreaterThanOrEqual(sample.floor.clock);
        },
    );

    test.each(heldOutList)(
        '%s, a line asking for none names no timer',
        (code, sample) => {
            const { own, words } = toReaders(code);
            for (const line of sample.none) {
                for (const found of [
                    readForegroundComponentAsk(line, own, words),
                    readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                ]) {
                    expect(TIMER_KEY_SET.has(String(found)), line).toBe(false);
                }
            }
        },
    );
});

// EC-643 (2026-11-14): the second set above still read most of its asks as
// nothing in the 23 languages it holds -- 25 of its 46 messages, 22
// stopwatches, 23 countdowns -- their words being the labels and a few
// ways of asking. More everyday ways of asking for each were written blind
// by two readers, and measured on a set written blind by a third at the
// same time, never shown the words and never tuned on
// (`foregroundEverydayAsksHeldOut.json`): three countdowns, three
// stopwatches and three messages a language, read in its own app and in an
// English one, each at least at what it read then (`floor`) -- 61 of 69
// countdowns where 56 had been, 50 of 69 stopwatches where 34 had, 28 of 69
// messages where 15 had -- and four lines that send a message, time a
// sermon past or speak of the screen read as none, in its own app and with
// every language's words at once. Most messages still missed are "show on
// the projector: <text>", which names no message at all.
type EverydayHeldOutType = {
    countdown: string[];
    stopwatch: string[];
    message: string[];
    none: string[];
    floor: { countdown: number; stopwatch: number; message: number };
};

const EVERYDAY_HELD_OUT_MAP = JSON.parse(
    readFileSync(
        path.join(import.meta.dirname, 'foregroundEverydayAsksHeldOut.json'),
        'utf8',
    ),
) as Record<string, EverydayHeldOutType>;

describe('a set of everyday timer and message asks, written blind', () => {
    const heldOutList = Object.entries(EVERYDAY_HELD_OUT_MAP).filter(
        ([code]) => {
            return checkHasLangPackage(code);
        },
    );

    test.each(heldOutList)(
        '%s reads a countdown, a stopwatch and a message, at its floor',
        (code, sample) => {
            const dictionary = readDictionary(code);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(code);
            for (const key of TIMER_KEY_LIST) {
                const readList = sample[key].filter((line) => {
                    return (
                        readForegroundComponentAsk(line, own, words) === key &&
                        readForegroundComponentAsk(line, ENGLISH, words) === key
                    );
                });
                expect(readList.length, key).toBeGreaterThanOrEqual(
                    sample.floor[key],
                );
            }
        },
    );

    test.each(heldOutList)(
        '%s, a line asking for none names nothing',
        (code, sample) => {
            const dictionary = readDictionary(code);
            const own = (key: string) => {
                return dictionary[key] ?? key;
            };
            const words = readWords(code);
            for (const line of sample.none) {
                expect(
                    readForegroundComponentAsk(line, own, words),
                    line,
                ).toBeNull();
                expect(
                    readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                    line,
                ).toBeNull();
            }
        },
    );
});

// EC-640 (2026-11-14): a language's writers put some marks in or leave them
// out as they like -- a vowel sign over a consonant, a doubling sign, a
// stretching stroke -- and the reader matched letters exactly, so a
// countdown typed WITH them read as nothing and went the general way. A
// language lists them (`optionalMarks`), and each of its blind lines reads
// the same typed with them and without them.
describe('a language reads its lines alike with and without its optional marks', () => {
    const HELD_OUT_FILE_LIST = [
        'foregroundAsksHeldOut.json',
        'foregroundMessageAsksHeldOut.json',
        'foregroundTimerAsksHeldOut.json',
    ];
    const collectLines = (value: unknown, lineList: string[]) => {
        if (typeof value === 'string') {
            lineList.push(value);
        } else if (Array.isArray(value)) {
            for (const item of value) {
                collectLines(item, lineList);
            }
        } else if (value !== null && typeof value === 'object') {
            for (const [key, child] of Object.entries(value)) {
                if (key !== 'floor' && key !== 'knownMiss') {
                    collectLines(child, lineList);
                }
            }
        }
    };
    const markedList = PACKAGE_LIST.flatMap((code) => {
        const marks = readOptionalMarks(code);
        return marks === '' ? [] : [[code, marks] as [string, string]];
    });

    test('a language that lists marks lists only marks and strokes', () => {
        for (const [code, marks] of markedList) {
            expect(/^[\p{M}\p{Lm}]+$/u.test(marks), code).toBe(true);
        }
    });

    test.each(markedList)('%s', (code, marks) => {
        const lineList: string[] = [];
        for (const fileName of HELD_OUT_FILE_LIST) {
            const data = JSON.parse(
                readFileSync(path.join(import.meta.dirname, fileName), 'utf8'),
            ) as Record<string, unknown>;
            collectLines(data[code], lineList);
        }
        const markPattern = new RegExp(`[${toCharClassSource(marks)}]`, 'gu');
        for (const line of lineList) {
            const bare = line.normalize('NFC').replace(markPattern, '');
            expect(
                readForegroundComponentAsk(line, ENGLISH, ALL_WORDS),
                line,
            ).toBe(readForegroundComponentAsk(bare, ENGLISH, ALL_WORDS));
        }
    });
});
