// @vitest-environment jsdom
/**
 * The same question goes the same way in every language (2026-10-29).
 * (jsdom: the verse finder's module brings the app's provider along.)
 *
 * The user's three pictures of Noah's card: _what is the size of noah ark_
 * was answered from the record in English and in Khmer, and the same asked
 * in French was sent to the app's guide, which answers no Bible question
 * and said to type `/btw`. Each language's words are data, and nothing held
 * them to each other: the French and Khmer words for a size were the app's
 * work, English had no word for a size at all, while English `save`, `Mark`
 * and `help` took _How did God save Noah?_ to the guide in English alone.
 * The user's Khmer reached the record by its spelling, which no list held;
 * written as the dictionary writes it, it went to the guide as the French
 * did.
 *
 * Every row here is asked in English and in every language package's own
 * words -- `src/lang/data/online/<code>/tests/chatbot/chatLanguageParity.json`,
 * the same rows by their labels -- through the readers the window asks in
 * the order `handleAsking` asks them, and must land where the row says in
 * every one. A word added to one language that moves a row moves it in that
 * language only, and fails here; a package that lacks a row fails too.
 */
import { describe, expect, test } from 'vitest';

import { checkIsHowTo, readBibleReaderAsk } from './bibleReaderChatHelpers';
import {
    checkIsRemovalReply,
    DEFAULT_CHAT_LANG_CODE,
    getAssistantLanguage,
    pickReplyLanguage,
} from './chatLangHelpers';
import {
    checkIsLookupAppAsk,
    checkIsLookupLineageAsk,
    checkIsLookupMapAsk,
    readLookupAskContext,
    readLookupCountAsk,
    readLookupVerseAsk,
    readLookupWordStudyAsk,
    type LookupSubjectType,
} from './lookupChatHelpers';
import {
    checkIsClosingLine,
    readAnyBibleContentAsk,
    readTypedVerseFindAsk,
} from './verseAskLanguageHelpers';
import { readVerseFindThread } from './verseFindChatHelpers';

// A language's own words for every row below, by the row's label.
type LanguageRowFileType = {
    // A card's title in the lookup's own language, by the card's target.
    cardTitles?: Record<string, string>;
    card?: Record<string, string>;
    typed?: Record<string, string>;
    thread?: Record<string, string>;
    reader?: Record<string, string>;
    // A line only this language says, under a card, and where it goes.
    cardExtra?: {
        label: string;
        subject: string;
        text: string;
        expected: string;
    }[];
    // One line each of the readers in `one line read alike` take.
    alike?: Record<string, string>;
    // Bible questions written with this language's "how": no how-do-I.
    notHowTo?: string[];
};
const LANGUAGE_ROW_FILE_MAP = import.meta.glob<LanguageRowFileType>(
    '../lang/data/online/*/tests/chatbot/chatLanguageParity.json',
    { eager: true, import: 'default' },
);
const LANGUAGE_ROW_FILE_LIST = Object.entries(LANGUAGE_ROW_FILE_MAP).map(
    ([filePath, file]) => {
        return { code: filePath.split('/').at(-4) ?? '', file };
    },
);
const LANG_LIST: string[] = [
    DEFAULT_CHAT_LANG_CODE,
    ...LANGUAGE_ROW_FILE_LIST.map(({ code }) => {
        return code;
    }),
];
type SectionType = 'card' | 'typed' | 'thread' | 'reader';

// A row's words in a language: English as the row says, any other from its
// package's file (an empty string when the file lacks it, which the parity
// test below names).
function toAsked(section: SectionType, label: string, english: string) {
    return (lang: string) => {
        if (lang === DEFAULT_CHAT_LANG_CODE) {
            return english;
        }
        const file = LANGUAGE_ROW_FILE_LIST.find(({ code }) => {
            return code === lang;
        })?.file;
        return file?.[section]?.[label] ?? '';
    };
}

// A card is titled in the lookup's own language.
function genNameCard(title: string): LookupSubjectType {
    return { kind: 'name', target: 'noah', title, facts: '{"kjvName":"Noah"}' };
}
function toNoahCard(lang: string) {
    const file = LANGUAGE_ROW_FILE_LIST.find(({ code }) => {
        return code === lang;
    })?.file;
    return genNameCard(file?.cardTitles?.noah ?? 'Noah');
}
const NOAH = 'noah-by-language';
const ARARAT: LookupSubjectType = {
    kind: 'location',
    target: 'ararat',
    title: 'Ararat',
    facts: '',
};
const GENESIS_8: LookupSubjectType = {
    kind: 'verse',
    target: 'GEN 8:1-22',
    title: 'Genesis 8:1-22',
    bibleKey: 'KJV',
    facts: JSON.stringify({
        passages: [
            {
                key: 'GEN 8:1-22',
                title: 'Genesis 8:1-22',
                text:
                    'And God remembered Noah, and every living thing, and ' +
                    'all the cattle that was with him in the ark',
            },
        ],
    }),
};

// Where a typed line under a card goes: the card's own readers first, then
// the app's guide for the app's work, else the record's conversation.
function routeUnderCard(text: string, subject: LookupSubjectType) {
    const isAppAsk = checkIsLookupAppAsk(text);
    if (!isAppAsk && readLookupWordStudyAsk(text, subject) !== null) {
        return 'words';
    }
    const verseAsk = readLookupVerseAsk(text, subject);
    if (verseAsk !== null) {
        return verseAsk.kind === 'action'
            ? `card:${verseAsk.step}`
            : `card:${verseAsk.kind}`;
    }
    if (checkIsLookupMapAsk(text, subject)) {
        return 'map';
    }
    if (checkIsLookupLineageAsk(text, subject)) {
        return 'lineage';
    }
    const countField = readLookupCountAsk(text, subject);
    if (countField !== null) {
        return `count:${countField}`;
    }
    if (isAppAsk) {
        return 'guide';
    }
    const context = readLookupAskContext(text, subject);
    if (context === null) {
        return 'record';
    }
    if (context.verseKeys.length > 0) {
        return `record:${context.verseKeys.join(',')}`;
    }
    return context.isNames === true
        ? 'record:names'
        : `record:${context.sides.join('+')}`;
}

type CardRowType = [string, string, LookupSubjectType | typeof NOAH, string];

const CARD_ROW_LIST: CardRowType[] = [
    // What the record answers, whatever word of the app rides along.
    [
        'the size of the ark (the user’s three pictures)',
        'what is the size of noah ark',
        NOAH,
        'record',
    ],
    ['saved by God', 'How did God save Noah from the flood?', NOAH, 'record'],
    ['Mark the gospel', 'Does Mark mention Noah?', NOAH, 'record'],
    [
        'help to understand',
        'Help me understand why God sent the flood',
        NOAH,
        'record',
    ],
    [
        'fond, and the bottom of the ark',
        'Was Noah fond of his sons?',
        NOAH,
        'record',
    ],
    [
        'the sound of the rain',
        'Did Noah hear the sound of the rain?',
        NOAH,
        'record',
    ],
    [
        'the ark’s window',
        'Why did Noah open the window of the ark?',
        NOAH,
        'record',
    ],
    ['a name’s meaning', 'What does the name Noah mean?', NOAH, 'record'],
    ['a mountain’s size', 'How big is Mount Ararat?', ARARAT, 'record'],
    // The card's own readers.
    [
        'how many children',
        'How many children did Noah have?',
        NOAH,
        'count:children',
    ],
    ['the family line', "Show Noah's family line to Jesus", NOAH, 'lineage'],
    ['a map', 'Show Ararat on a map', ARARAT, 'map'],
    [
        'other versions',
        'What do other versions say?',
        GENESIS_8,
        'card:anotherBible',
    ],
    ['save it', 'Save this to my list', GENESIS_8, 'card:save'],
    ['the next chapter', 'Next chapter', GENESIS_8, 'card:near'],
    ['every word', 'Explain each word of verse 1', GENESIS_8, 'words'],
    [
        'a verse by number',
        'What does verse 20 mean?',
        GENESIS_8,
        'record:GEN 8:20',
    ],
    [
        'a length of time',
        'How long was Noah in the ark?',
        GENESIS_8,
        'record:before+after',
    ],
    ['who is in it', 'Who is in this passage?', GENESIS_8, 'record:names'],
    // The app's work, to the app's guide.
    ['the screen', "How do I put Noah's verses on the screen?", NOAH, 'guide'],
    ['the text size', 'How do I change the text size?', NOAH, 'guide'],
    ['bigger words', 'How do I make the words bigger?', NOAH, 'guide'],
    ['deleting', 'How do I delete this chat?', NOAH, 'guide'],
    ['saving, in a how-do-I', 'How can I save this?', NOAH, 'guide'],
    ['the settings', 'Where are the settings?', NOAH, 'guide'],
    ['the background', 'How do I change the background?', NOAH, 'guide'],
    ['undoing', 'How do I undo that?', NOAH, 'guide'],
    ['a keyboard shortcut', 'What is the keyboard shortcut?', NOAH, 'guide'],
    [
        'a passage on the screen',
        'Put this passage on the screen',
        GENESIS_8,
        'guide',
    ],
];

function toCard(subject: LookupSubjectType | typeof NOAH, lang: string) {
    return subject === NOAH ? toNoahCard(lang) : subject;
}

describe('a line typed under a card', () => {
    describe.each(CARD_ROW_LIST)('%s', (label, english, subject, expected) => {
        const asked = toAsked('card', label, english);
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            expect(routeUnderCard(asked(lang), toCard(subject, lang))).toBe(
                expected,
            );
        });
    });

    // A line only one language says, as a person spelled it.
    const extraList = LANGUAGE_ROW_FILE_LIST.flatMap(({ code, file }) => {
        return (file.cardExtra ?? []).map((row) => {
            return { ...row, code };
        });
    });
    test.each(extraList)(
        '$code: $label',
        ({ code, subject, text, expected }) => {
            expect(subject).toBe('noah');
            expect(routeUnderCard(text, toNoahCard(code))).toBe(expected);
        },
    );
});

// Where a line typed in any tab goes: the verse finder's own sentence, a
// verse asked for by what it says, or the ordinary assistant.
function routeTyped(text: string) {
    const find = readTypedVerseFindAsk(text);
    if (find !== null) {
        return find.remembered === null ? 'find' : 'find+words';
    }
    // The window takes a verse; the guide, with no assistant, takes
    // knowledge about the Bible too.
    return readAnyBibleContentAsk(text)?.kind ?? 'ordinary';
}

const TYPED_ROW_LIST: [string, string, string][] = [
    [
        'a verse by what it says',
        'Which verse says do not worry about tomorrow?',
        'verse',
    ],
    [
        'what the Bible says about',
        'What does the Bible say about forgiveness?',
        'verse',
    ],
    [
        'where the Bible says it',
        'Where does the Bible say God is love?',
        'verse',
    ],
    [
        'a story by its name',
        'Where in the Bible is the story of the flood?',
        'verse',
    ],
    ['find me a verse', 'Find me a verse about hope', 'verse'],
    ['verses about', 'Verses about patience', 'verse'],
    ['is there a verse', 'Is there a verse about anger?', 'verse'],
    [
        'a song the Bible sings',
        'Which verse says sing a new song to the Lord?',
        'verse',
    ],
    [
        'the verse finder, nothing remembered yet',
        'Help me find a Bible verse',
        'find',
    ],
    [
        'the verse finder with its words',
        'Help me find a verse: love your enemies',
        'find+words',
    ],
    ['a verse forgotten', 'Can you help me find a verse I forgot?', 'find'],
    [
        'a verse for the screen is the app’s work',
        'Show me a verse about love on the screen',
        'ordinary',
    ],
    [
        'present, a Bible word (Romans 12:1)',
        'Which verse says present your bodies a living sacrifice?',
        'verse',
    ],
    // Knowledge about the Bible: with no assistant, the way to one, never a
    // manual page that does not answer (EC-444).
    ['who wrote a book', 'Who wrote the book of Psalms?', 'knowledge'],
    ['how many books', 'How many books are in the Bible?', 'knowledge'],
    ['when Jesus was born', 'When was Jesus born?', 'knowledge'],
    ['who was — the names lookup’s', 'Who was Moses?', 'ordinary'],
    [
        'what is open — the app’s own state',
        'Who wrote this passage I am reading?',
        'ordinary',
    ],
];

// The questions the app is prepared to be asked, in every language: none
// may be read as a Bible question, or the guide refuses its own row.
const QUESTION_FILE_MAP = import.meta.glob<{
    questions: Record<string, { en: string; text: string }>;
}>('../lang/data/online/*/questions.json', {
    eager: true,
    import: 'default',
});
const TRANSLATED_QUESTION_LIST = Object.values(QUESTION_FILE_MAP).flatMap(
    (file) => {
        return Object.values(file.questions).flatMap((row) => {
            return [row.en, row.text];
        });
    },
);

describe('a line typed in any tab', () => {
    test('takes none of the questions the app is prepared to be asked', () => {
        // The whole list, every language, not an empty one read wrong.
        expect(TRANSLATED_QUESTION_LIST.length).toBe(
            Object.values(QUESTION_FILE_MAP).reduce((total, file) => {
                return total + Object.keys(file.questions).length * 2;
            }, 0),
        );
        const taken = TRANSLATED_QUESTION_LIST.filter((text) => {
            return readAnyBibleContentAsk(text) !== null;
        });
        expect(taken).toEqual([]);
    });

    describe.each(TYPED_ROW_LIST)('%s', (label, english, expected) => {
        const asked = toAsked('typed', label, english);
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            expect(routeTyped(asked(lang))).toBe(expected);
        });
    });
});

// A line typed under a verse-finding answer: more of the search, or the
// app's own work that ends it (EC-443). A Bible word is a verse's.
const THREAD_ROW_LIST: [string, string, 'search' | 'end'][] = [
    ['a new song', 'a verse about singing a new song', 'search'],
    ['in his image', 'God made man in his own image', 'search'],
    [
        'he keeps his people',
        'he shall save his people from their sins',
        'search',
    ],
    ['on the screen', 'put it on the screen', 'end'],
    ['save it', 'save it', 'end'],
    ['how do I', 'How do I save it?', 'end'],
];

describe('a line typed under a verse-finding answer', () => {
    const messageList = [
        { author: 'you' as const },
        { author: 'bot' as const, verseFind: 'KJV' },
    ];
    describe.each(THREAD_ROW_LIST)('%s', (label, english, expected) => {
        const asked = toAsked('thread', label, english);
        test.each(LANG_LIST)(`%s: ${expected}`, (lang) => {
            const bible = readVerseFindThread(messageList, asked(lang));
            expect(bible === null ? 'end' : 'search').toBe(expected);
        });
    });
});

const READER_ROW_LIST: [string, string, string][] = [
    ['the names in a chapter', 'What names are in Genesis chapter 4?', 'names'],
    ['a verse by its reference', 'What does John 3:16 say?', 'reference'],
    [
        'a size in a verse',
        'What is the size of the ark in Genesis 6:15?',
        'reference',
    ],
    ['Mark’s gospel', 'What does Mark 4:39 say?', 'reference'],
    [
        'how Jesus saved (no how-do-I)',
        'How did Jesus save Peter in Matthew 14:30?',
        'reference',
    ],
    ['a how-do-I is the app’s', 'How do I open John 3:16?', 'none'],
    ['the screen is the app’s', 'Put John 3:16 on the screen', 'none'],
];

describe('a line typed in a Bible Reader tab', () => {
    describe.each(READER_ROW_LIST)('%s', (label, english, expected) => {
        const asked = toAsked('reader', label, english);
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            const ask = readBibleReaderAsk(asked(lang), () => true);
            expect(ask?.intent ?? 'none').toBe(expected);
        });
    });
});

describe('one line read alike', () => {
    test.each([
        ['a thank-you', checkIsClosingLine, 'Thank you so much'],
        ['a removal chip', checkIsRemovalReply, 'Delete everything'],
        ['a how-do-I', checkIsHowTo, 'How do I open the Bible?'],
    ] as const)('%s', (label, check, english) => {
        expect(check(english)).toBe(true);
        for (const { code, file } of LANGUAGE_ROW_FILE_LIST) {
            expect(file.alike?.[label], `${code}: ${label}`).toBeTruthy();
            expect(check(file.alike?.[label] ?? ''), code).toBe(true);
        }
    });

    test.each([
        'How did God save Noah?',
        ...LANGUAGE_ROW_FILE_LIST.flatMap(({ file }) => {
            return file.notHowTo ?? [];
        }),
    ])('%s asks about the Bible, not a how-do-I', (asked) => {
        expect(checkIsHowTo(asked)).toBe(false);
    });
});

// A question is answered in the language it was ASKED in, whatever the app
// is shown in (2026-10-29): _Which verse says present your bodies a living
// sacrifice?_ typed in a French window was answered in French, its words
// holding none of English's little words. A line of four words or more of
// every row above, asked in each language under each other app language.
describe('the language a typed line is answered in', () => {
    const rowList: ((lang: string) => string)[] = [
        ...CARD_ROW_LIST.map((row) => toAsked('card', row[0], row[1])),
        ...TYPED_ROW_LIST.map((row) => toAsked('typed', row[0], row[1])),
        ...THREAD_ROW_LIST.map((row) => toAsked('thread', row[0], row[1])),
        ...READER_ROW_LIST.map((row) => toAsked('reader', row[0], row[1])),
    ];
    const toWordCount = (text: string) => {
        return text.split(/\s+/).filter(Boolean).length;
    };
    test.each(LANG_LIST)('a line asked in %s', (lang) => {
        const wrongList = rowList.flatMap((asked) => {
            const text = asked(lang);
            // A language written without spaces is told by its script.
            if (
                getAssistantLanguage(lang).isLatinScript &&
                toWordCount(text) < 4
            ) {
                return [];
            }
            return LANG_LIST.filter((appLangCode) => {
                return appLangCode !== lang;
            }).flatMap((appLangCode) => {
                const picked = pickReplyLanguage(text, { appLangCode });
                return picked === lang ? [] : [`${appLangCode}: ${text}`];
            });
        });
        expect(wrongList).toEqual([]);
    });
});

describe('every language package says every row', () => {
    const sectionMap: Record<SectionType, { label: string }[]> = {
        card: CARD_ROW_LIST.map(([label]) => ({ label })),
        typed: TYPED_ROW_LIST.map(([label]) => ({ label })),
        thread: THREAD_ROW_LIST.map(([label]) => ({ label })),
        reader: READER_ROW_LIST.map(([label]) => ({ label })),
    };
    // One test over every package there is, so a checkout with English
    // alone still has a test here (an empty table is no test at all).
    test('each says them all, and nothing else', () => {
        for (const { code, file } of LANGUAGE_ROW_FILE_LIST) {
            for (const [section, rowList] of Object.entries(sectionMap)) {
                const words = file[section as SectionType] ?? {};
                expect(
                    rowList
                        .filter(({ label }) => {
                            return !(words[label] ?? '').trim();
                        })
                        .map(({ label }) => label),
                    `${code} ${section}`,
                ).toEqual([]);
                expect(Object.keys(words).sort(), `${code} ${section}`).toEqual(
                    rowList.map(({ label }) => label).sort(),
                );
            }
        }
    });
});
