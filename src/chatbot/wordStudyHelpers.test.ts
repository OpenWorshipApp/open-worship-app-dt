import { describe, expect, it } from 'vitest';

import { toAnswerShownInLanguage } from './answerLanguageHelpers';
import {
    LOOKUP_STEP_TOOL_NAME,
    genLookupActions,
    toValidLookupStep,
} from './lookupStepHelpers';
import {
    MAX_STUDY_VERSES,
    MAX_STUDY_WORDS,
    genStudyVersesAnswer,
    genStudyWordsAnswer,
    genWordStudyActions,
    listStudyVerses,
    listStudyWords,
    readAnyDigits,
    readStudyVerse,
    repairStudiedWords,
    toDigitsLike,
    toPassageAnswerKeep,
    toWordSearchUrl,
    toWordStudyContext,
    toWordStudyEcho,
    toWordStudyQuestion,
} from './wordStudyHelpers';

// As `owa_lookup_record` read Genesis 8:1-3 from the GB Bible, 2026-10-23.
const GB_FACTS = {
    kind: 'verse',
    bible: 'GB',
    passages: [
        {
            key: 'GEN 8:1-3',
            ref: 'Genesis 8:1-3',
            text:
                '(1): Καὶ ἐνεθυμήθη ὁ Θεὸς τὸν Νῶε, καὶ πάντα τὰ ζῷα, καὶ ' +
                'πάντα τὰ κτήνη, τὰ μετ᾿ αὐτοῦ ἐν τῇ κιβωτῷ· καὶ διεβίβασεν ' +
                'ὁ Θεὸς ἄνεμον ἐπὶ τὴν γῆν, καὶ τὰ ὕδατα ἐστάθησαν. (2): Καὶ ' +
                'ἐκλείσθησαν αἱ πηγαὶ τῆς ἀβύσσου, καὶ οἱ καταρράκται τοῦ ' +
                'οὐρανοῦ, καὶ ἐκρατήθη ὁ ὑετὸς ἀπὸ τῶν οὐρανῶν. (3): Καὶ ' +
                'ἐσύροντο τὰ ὕδατα ἀπὸ τῆς γῆς κατὰ συνέχειαν· καὶ ' +
                'λιγόστευον τὰ ὕδατα μετὰ τὰς ἑκατὸν πεντήκοντα ἡμέρας.',
        },
    ],
};

// As it read Genesis 8:21-9:2 from ពគប: a heading per chapter, the
// Bible's own digits, zero-width spaces between the words.
const ZW = '\u200B';
const KM_FACTS = {
    kind: 'verse',
    bible: 'ពគប',
    passages: [
        {
            key: 'GEN 8:21-9:2',
            ref: 'Genesis 8:21-9:2',
            title: 'លោកុប្បត្តិ ៨:២១-៩:២',
            text: [
                'លោកុប្បត្តិ ៨:២១-២២',
                `(២១): ព្រះ\u200Cយេហូវ៉ា${ZW}ទ្រង់${ZW}ធុំ${ZW}ក្លិន ` +
                    `(២២): កាល${ZW}នៅ${ZW}មាន${ZW}ផែនដី។`,
                'លោកុប្បត្តិ ៩:១-២',
                `(១): ព្រះ\u200Cទ្រង់${ZW}ក៏${ZW}ប្រទាន${ZW}ពរ ` +
                    `(២): ឯ${ZW}គ្រប់${ZW}ទាំង${ZW}សត្វ`,
            ].join('\n'),
        },
    ],
};

const GB_ASK = {
    kind: 'verse' as const,
    target: 'GEN 8:1-3',
    title: 'Genesis 8:1-3',
    bibleKey: 'GB',
};

function toLabels(actions: { label: string }[]) {
    return actions.map((action) => {
        return action.label;
    });
}

describe('the verses of a passage a card read', () => {
    it('reads each verse off its marker, with its key and reference', () => {
        const verses = listStudyVerses(GB_FACTS);
        expect(
            verses.map((verse) => {
                return [verse.key, verse.ref, verse.title, verse.isWhole];
            }),
        ).toEqual([
            ['GEN 8:1', 'Genesis 8:1', 'Genesis 8:1', true],
            ['GEN 8:2', 'Genesis 8:2', 'Genesis 8:2', true],
            ['GEN 8:3', 'Genesis 8:3', 'Genesis 8:3', true],
        ]);
        expect(verses[1].text).toBe(
            'Καὶ ἐκλείσθησαν αἱ πηγαὶ τῆς ἀβύσσου, καὶ οἱ καταρράκται τοῦ ' +
                'οὐρανοῦ, καὶ ἐκρατήθη ὁ ὑετὸς ἀπὸ τῶν οὐρανῶν.',
        );
    });

    it('follows a passage over chapters, in the Bible’s own digits', () => {
        const verses = listStudyVerses(KM_FACTS);
        expect(
            verses.map((verse) => {
                return [verse.key, verse.shownNumber, verse.title];
            }),
        ).toEqual([
            ['GEN 8:21', '២១', 'លោកុប្បត្តិ ៨:២១'],
            ['GEN 8:22', '២២', 'លោកុប្បត្តិ ៨:២២'],
            ['GEN 9:1', '១', 'លោកុប្បត្តិ ៩:១'],
            ['GEN 9:2', '២', 'លោកុប្បត្តិ ៩:២'],
        ]);
        expect(verses[2].ref).toBe('Genesis 9:1');
    });

    // A long passage's record is cut at 6 000 characters with an ellipsis.
    it('lists every verse of the span, reading again what was cut', () => {
        const verses = listStudyVerses({
            passages: [
                {
                    key: 'GEN 8:21-24',
                    ref: 'Genesis 8:21-24',
                    title: 'លោកុប្បត្តិ ៨:២១-២៤',
                    text: '(២១): ព្រះ ទ្រង់ (២២): កាល នៅ…',
                },
            ],
        });
        expect(
            verses.map((verse) => {
                return [verse.shownNumber, verse.text, verse.isWhole];
            }),
        ).toEqual([
            ['២១', 'ព្រះ ទ្រង់', true],
            ['២២', 'កាល នៅ', false],
            ['២៣', '', false],
            ['២៤', '', false],
        ]);
        expect(readStudyVerse({ passages: [] }, 'GEN 8:1')).toBeNull();
        expect(readStudyVerse(GB_FACTS, 'GEN 8:2')?.number).toBe(2);
    });

    it('reads and writes digits of any script', () => {
        expect(readAnyDigits('២២')).toBe(22);
        expect(readAnyDigits('१२')).toBe(12);
        expect(readAnyDigits('x')).toBeNaN();
        expect(toDigitsLike(23, '២១')).toBe('២៣');
        expect(toDigitsLike(23, '21')).toBe('23');
        expect(toDigitsLike(5, '')).toBe('5');
    });
});

describe('the words of a verse', () => {
    it('lists each Greek word once, in order, without its punctuation', () => {
        const words = listStudyWords(GB_FACTS.passages[0].text.slice(5, 120));
        expect(words.slice(0, 8)).toEqual([
            'Καὶ',
            'ἐνεθυμήθη',
            'ὁ',
            'Θεὸς',
            'τὸν',
            'Νῶε',
            'πάντα',
            'τὰ',
        ]);
        // A word again, in another case, is the same word; the mark of a
        // letter left off stays with its word.
        expect(listStudyWords('Καὶ καὶ μετ᾿ αὐτοῦ· 12')).toEqual([
            'Καὶ',
            'μετ᾿',
            'αὐτοῦ',
        ]);
    });

    // HebrewTD's Genesis 1:7, 2026-10-23: the maqaf had joined two words
    // into one button, and a word chanted with another accent was listed
    // again -- 17 buttons for 14 words.
    it('splits Hebrew at the maqaf and lists a word once whatever its accent', () => {
        const words = listStudyWords(
            'וַיַּ֣עַשׂ אֱלֹהִים֮ אֶת־הָרָקִיעַ֒ וַיַּבְדֵּ֗ל בֵּ֤ין הַמַּ֨יִם֙ ' +
                'אֲשֶׁר֙ מִתַּ֣חַת לָרָקִ֔יעַ וּבֵ֣ין הַמַּ֔יִם אֲשֶׁ֖ר מֵעַ֣ל ' +
                'לָרָקִ֑יעַ וַֽיְהִי־כֵֽן׃',
        );
        expect(words).toEqual([
            'וַיַּ֣עַשׂ',
            'אֱלֹהִים֮',
            'אֶת',
            'הָרָקִיעַ֒',
            'וַיַּבְדֵּ֗ל',
            'בֵּ֤ין',
            'הַמַּ֨יִם֙',
            'אֲשֶׁר֙',
            'מִתַּ֣חַת',
            'לָרָקִ֔יעַ',
            'וּבֵ֣ין',
            'מֵעַ֣ל',
            'וַֽיְהִי',
            'כֵֽן',
        ]);
        // A vowel is part of the word: אֵת and אַתְּ ("you") are two.
        expect(listStudyWords('אֵ֥ת אַתְּ')).toEqual(['אֵ֥ת', 'אַתְּ']);
    });

    it('keeps the mark of an elided Greek word and joins grave and acute', () => {
        // GREEKGNT's John 3:16 types the elision as ’, a punctuation mark.
        expect(
            listStudyWords('μὴ ἀπόληται ἀλλ’ ἔχῃ ζωὴν αἰώνιον. Θεὸς Θεός'),
        ).toEqual(['μὴ', 'ἀπόληται', 'ἀλλ’', 'ἔχῃ', 'ζωὴν', 'αἰώνιον', 'Θεὸς']);
        // A closing quote after an English word is not an elision.
        expect(listStudyWords('‘said’ he')).toEqual(['said', 'he']);
    });

    it('splits Khmer at its zero-width spaces and keeps a joined word', () => {
        expect(
            listStudyWords(`ព្រះ\u200Cយេហូវ៉ា${ZW}ទ្រង់${ZW}ធុំ${ZW}ទ្រង់។`),
        ).toEqual(['ព្រះ\u200Cយេហូវ៉ា', 'ទ្រង់', 'ធុំ']);
    });

    it('cuts a long run with no spaces into words', () => {
        const words = listStudyWords(
            'ព្រះយេហូវ៉ាទ្រង់ធុំក្លិនឈ្ងុយរួចទ្រង់សំរេច',
        );
        expect(words.length).toBeGreaterThan(3);
        expect(words).toContain('ទ្រង់');
    });
});

describe('studying the words, step by step', () => {
    const verses = listStudyVerses(GB_FACTS);

    it('asks which verse, a button each with its first words', () => {
        const answer = genStudyVersesAnswer(GB_ASK, verses);
        expect(answer.text).toContain('Which verse of Genesis 8:1-3');
        expect(toLabels(answer.actions)).toEqual([
            '1 · Καὶ ἐνεθυμήθη ὁ Θεὸς…',
            '2 · Καὶ ἐκλείσθησαν αἱ πηγαὶ…',
            '3 · Καὶ ἐσύροντο τὰ ὕδατα…',
        ]);
        expect(answer.actions[0]).toEqual({
            label: '1 · Καὶ ἐνεθυμήθη ὁ Θεὸς…',
            toolName: LOOKUP_STEP_TOOL_NAME,
            args: {
                step: 'words',
                ask: GB_ASK,
                verse: 'GEN 8:1',
                ref: 'Genesis 8:1',
            },
            // Drawn as written, never in capitals or through the dictionary.
            isData: true,
        });
    });

    it('pages a long passage', () => {
        const many = Array.from({ length: 30 }, (_, index) => {
            return { ...verses[0], key: `PSA 119:${index + 1}` };
        });
        const first = genStudyVersesAnswer(GB_ASK, many);
        expect(first.actions).toHaveLength(MAX_STUDY_VERSES + 1);
        expect(first.actions[MAX_STUDY_VERSES].label).toBe('More verses');
        expect(first.actions[MAX_STUDY_VERSES].args.from).toBe(
            MAX_STUDY_VERSES,
        );
        expect(
            genStudyVersesAnswer(GB_ASK, many, MAX_STUDY_VERSES).actions,
        ).toHaveLength(30 - MAX_STUDY_VERSES);
    });

    it('lists a verse’s words, All words first, the verse above', () => {
        const answer = genStudyWordsAnswer(GB_ASK, verses[1], verses.length);
        expect(answer.text).toContain('**Genesis 8:2**');
        expect(answer.text).toContain('Καὶ ἐκλείσθησαν αἱ πηγαὶ');
        expect(toLabels(answer.actions)).toEqual([
            'All words',
            'Καὶ',
            'ἐκλείσθησαν',
            'αἱ',
            'πηγαὶ',
            'τῆς',
            'ἀβύσσου',
            'οἱ',
            'καταρράκται',
            'τοῦ',
            'οὐρανοῦ',
            'ἐκρατήθη',
            'ὁ',
            'ὑετὸς',
            'ἀπὸ',
            'τῶν',
            'οὐρανῶν',
            'Another verse',
        ]);
        expect(answer.actions[0].args).toEqual({
            step: 'verseWords',
            ask: GB_ASK,
            verse: 'GEN 8:2',
            ref: 'Genesis 8:2',
        });
        expect(answer.actions[2].args).toEqual({
            step: 'word',
            ask: GB_ASK,
            verse: 'GEN 8:2',
            ref: 'Genesis 8:2',
            word: 'ἐκλείσθησαν',
        });
        expect(answer.actions[2].isData).toBe(true);
        expect(answer.actions[0].isData).toBeUndefined();
        // One verse: no other verse to go to.
        expect(
            toLabels(genStudyWordsAnswer(GB_ASK, verses[1], 1).actions),
        ).not.toContain('Another verse');
    });

    it('pages a verse of many words', () => {
        const text = Array.from({ length: 40 }, (_, index) => {
            return `word${String.fromCharCode(97 + (index % 26))}${index}`;
        }).join(' ');
        const answer = genStudyWordsAnswer(GB_ASK, { ...verses[0], text }, 1);
        expect(answer.actions).toHaveLength(MAX_STUDY_WORDS + 2);
        expect(answer.actions[MAX_STUDY_WORDS + 1].label).toBe('More words');
        expect(answer.actions[MAX_STUDY_WORDS + 1].args.from).toBe(
            MAX_STUDY_WORDS,
        );
    });

    it('goes on from a word: the next one, the list, Google', () => {
        const actions = genWordStudyActions(GB_ASK, verses, verses[0], 'ὁ');
        expect(toLabels(actions)).toEqual([
            'Next word: Θεὸς',
            'Choose a word',
            'Search Google for ὁ',
        ]);
        expect(actions[0].args).toMatchObject({
            step: 'word',
            word: 'Θεὸς',
            verse: 'GEN 8:1',
        });
        expect(actions[2].args).toMatchObject({
            step: 'wordWeb',
            word: 'ὁ',
            ref: 'Genesis 8:1',
        });
        // The verse's last word has no next one.
        expect(
            toLabels(
                genWordStudyActions(GB_ASK, verses, verses[0], 'ἐστάθησαν'),
            ),
        ).toEqual(['Choose a word', 'Search Google for ἐστάθησαν']);
        // A word pressed in another accent than the list's is still found.
        expect(
            toLabels(genWordStudyActions(GB_ASK, verses, verses[0], 'Θεός'))[0],
        ).toBe('Next word: τὸν');
    });

    it('goes on from a whole verse: one word, the next verse, another', () => {
        expect(
            toLabels(genWordStudyActions(GB_ASK, verses, verses[0], null)),
        ).toEqual(['Choose a word', 'Next verse', 'Another verse']);
        expect(
            toLabels(genWordStudyActions(GB_ASK, verses, verses[2], null)),
        ).toEqual(['Choose a word', 'Another verse']);
    });

    it('asks the assistant briefly, the verse and the way to teach under it', () => {
        expect(toWordStudyQuestion(verses[0], 'ἐνεθυμήθη')).toBe(
            'Teach me the word “ἐνεθυμήθη” in Genesis 8:1.',
        );
        expect(toWordStudyQuestion(verses[0], null)).toBe(
            'Teach me every word of Genesis 8:1, one by one.',
        );
        const context = toWordStudyContext(verses[0], 'ἐνεθυμήθη', 'GB');
        expect(context).toContain('as the Bible "GB" writes it (Genesis 8:1)');
        expect(context).toContain('Καὶ ἐνεθυμήθη ὁ Θεὸς');
        expect(context).toContain('dictionary form');
        expect(toWordStudyContext(verses[0], null, null)).toContain(
            'A word that comes again is taught once.',
        );
        // 2026-10-23, EC-433: the form a word's language has, named in the
        // answer's own words; no label word in a line of "All words".
        expect(context).toContain('its case, number and gender');
        expect(context).toContain('Every label and every grammar word');
        expect(toWordStudyContext(verses[0], null, 'GB')).toContain(
            'with no label words',
        );
        const hebrew = { ...verses[0], text: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים' };
        expect(toWordStudyContext(hebrew, 'בָּרָ֣א', 'HebrewTD')).toContain(
            'its stem (קַל',
        );
        // A Khmer verse in a Khmer window needs no way to say it: two lessons
        // in two had romanised the word (_Srolanh_).
        const khmerAnswer = { isLatinScript: false, scriptPattern: /[ក-៹]/u };
        const khmer = { ...verses[0], text: 'ដ្បិត\u200Bព្រះ\u200Bស្រឡាញ់' };
        expect(
            toWordStudyContext(khmer, 'ស្រឡាញ់', 'ពគប', khmerAnswer),
        ).not.toContain('how to say it');
        expect(toWordStudyContext(verses[0], 'ὁ', 'GB', khmerAnswer)).toContain(
            'how to say it',
        );
        expect(toWordStudyEcho(verses[0], 'ὁ')).toBe('Teach me the word ὁ');
        expect(toWordStudyEcho(verses[0], null)).toBe(
            'Teach me every word of Genesis 8:1',
        );
    });

    // 2026-10-23, the user, with Google's overview of Genesis 1:1 up for
    // "Θεὸς Genesis 1:1 meaning": _I'd like to learn the word not the verse_.
    // Both "All words" answers about HebrewTD's Genesis 1:1, 2026-10-23.
    it('puts back a verse word copied with another script’s letter', () => {
        const verse =
            'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
        // A Khmer ro (U+179A) where the verse has a Hebrew resh.
        expect(repairStudiedWords('הָאָֽ\u179Aֶץ — אֶרֶץ — ផែនដី', verse)).toBe(
            'הָאָֽרֶץ — אֶרֶץ — ផែនដី',
        );
        // Words written right, and a Khmer line, are left alone; so is a run
        // no word of the verse fits.
        const right = 'הָאָֽרֶץ — ផែនដី\nבָּרָ֣א — បានបង្កើត';
        expect(repairStudiedWords(right, verse)).toBe(right);
        expect(repairStudiedWords('ש\u179Aש', verse)).toBe('ש\u179Aש');
        // A verse in no script it repairs: as it was.
        expect(repairStudiedWords('ស\u05E8', 'For God so loved')).toBe(
            'ស\u05E8',
        );
    });

    it('searches the WORD, in its dictionary accent and its language', () => {
        const search = (word: string) => {
            return decodeURIComponent(
                toWordSearchUrl(word).replace(
                    'https://www.google.com/search?q=',
                    '',
                ),
            );
        };
        expect(toWordSearchUrl('ὁ')).toMatch(
            /^https:\/\/www\.google\.com\/search\?q=/,
        );
        // No verse in it; the grave of a word inside a sentence is its acute.
        expect(search('Θεὸς')).toBe('"Θεός" biblical Greek word meaning');
        expect(search('καὶ')).toBe('"καί" biblical Greek word meaning');
        expect(search('ἐνεθυμήθη')).toBe(
            '"ἐνεθυμήθη" biblical Greek word meaning',
        );
        // Greek with no mark of the old texts is Greek.
        expect(search('Θεός')).toBe('"Θεός" Greek word meaning');
        expect(search('אֱלֹהִים')).toBe(
            '"אֱלֹהִים" biblical Hebrew word meaning',
        );
        // As a lexicon writes it: the vowels kept, the chant's accents not.
        expect(search('אֱלֹהִ֑ים')).toBe(
            '"אֱלֹהִים" biblical Hebrew word meaning',
        );
        expect(search('הָאָֽרֶץ')).toBe(
            '"הָאָרֶץ" biblical Hebrew word meaning',
        );
        // A Khmer word without the joiners it carries in the Bible's text.
        expect(search('ព្រះ\u200Cយេហូវ៉ា')).toBe(
            '"ព្រះយេហូវ៉ា" Khmer word meaning',
        );
        // A word in Latin letters names no language.
        expect(search('remembered')).toBe('"remembered" meaning');
    });
});

describe('the card and its buttons', () => {
    it('offers Study the words for a passage with words', () => {
        expect(toLabels(genLookupActions(GB_ASK, GB_FACTS))[0]).toBe(
            'Study the words',
        );
        expect(toLabels(genLookupActions(GB_ASK, null))).not.toContain(
            'Study the words',
        );
    });

    it('trusts a saved study button only as far as its fields go', () => {
        expect(
            toValidLookupStep({
                step: 'word',
                ask: GB_ASK,
                verse: 'GEN 8:1',
                word: 'ὁ',
                ref: 'Genesis 8:1',
            }),
        ).toEqual({
            step: 'word',
            ask: GB_ASK,
            verse: 'GEN 8:1',
            word: 'ὁ',
            ref: 'Genesis 8:1',
        });
        // A word with no verse, a verse that is no key.
        expect(
            toValidLookupStep({ step: 'word', ask: GB_ASK, word: 'ὁ' }),
        ).toBe(null);
        expect(
            toValidLookupStep({
                step: 'verseWords',
                ask: GB_ASK,
                verse: '8:1',
            }),
        ).toBeNull();
        // What is not a field of its kind is left off.
        expect(
            toValidLookupStep({
                step: 'words',
                ask: GB_ASK,
                from: -3,
                ref: '<script>',
                word: 'x'.repeat(200),
            }),
        ).toEqual({ step: 'words', ask: GB_ASK });
        expect(
            toValidLookupStep({ step: 'words', ask: GB_ASK, from: 24 }),
        ).toEqual({ step: 'words', ask: GB_ASK, from: 24 });
    });
});

describe('what an answer about the passage keeps', () => {
    const translateLabel = (label: string) => {
        return label === 'Help' ? 'ជំនួយ' : label;
    };
    const answer =
        'ពាក្យ **ἐνεθυμήθη** មានន័យថា «នឹកឃើញ» ក្នុង «Καὶ ἐνεθυμήθη ὁ Θεὸς»';

    // Measured 2026-10-23: the Greek of a Khmer answer about the GB Bible
    // was taken out letter by letter, quotes left empty.
    it('keeps the passage’s own letters in a Khmer answer', () => {
        const unkept = toAnswerShownInLanguage(answer, 'km', translateLabel);
        expect(/\p{Script=Greek}/u.test(unkept)).toBe(false);
        expect(unkept).toContain('ពាក្យ ****');
        expect(
            toAnswerShownInLanguage(
                answer,
                'km',
                translateLabel,
                toPassageAnswerKeep(GB_FACTS),
            ),
        ).toBe(answer);
        // A fourth script slipped in is still taken out.
        expect(
            toAnswerShownInLanguage(
                `${answer}预览`,
                'km',
                translateLabel,
                toPassageAnswerKeep(GB_FACTS),
            ),
        ).toBe(answer);
    });

    it('keeps English words only for a lesson on an English verse', () => {
        const kjv = 'And God remembered Noah, and every living thing';
        expect(toPassageAnswerKeep(null, kjv)).toEqual({
            scriptText: kjv,
            isLatinKept: true,
        });
        expect(
            toPassageAnswerKeep(null, 'Καὶ ἐνεθυμήθη ὁ Θεὸς')?.isLatinKept,
        ).toBe(false);
        expect(
            toPassageAnswerKeep({
                passages: [{ text: kjv }],
            })?.isLatinKept,
        ).toBeUndefined();
        expect(toPassageAnswerKeep({ passages: [] })).toBeUndefined();
        const lesson = 'ពាក្យ remembered (Help) មានន័យថា នឹកឃើញ';
        expect(
            toAnswerShownInLanguage(lesson, 'km', translateLabel, {
                scriptText: kjv,
                isLatinKept: true,
            }),
        ).toBe(lesson);
        // An ordinary answer about the KJV still loses the stray English.
        expect(toAnswerShownInLanguage(lesson, 'km', translateLabel)).toBe(
            'ពាក្យ មានន័យថា នឹកឃើញ',
        );
    });
});
