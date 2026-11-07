import { describe, expect, it } from 'vitest';
import {
    genLookupActions,
    toValidLookupStep,
} from '../../../../chatbot/lookupStepHelpers';
import {
    MAX_STUDY_VERSES,
    genStudyVersesAnswer,
    genWordStudyActions,
    listStudyVerses,
    listStudyWords,
} from '../../../../chatbot/wordStudyHelpers';
import { checkHasLangPackage } from '../../../../test-setup/langPackageDirs';

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
    // Hebrew's own marks come from its package: with it not installed the
    // study is plain (`language-packages.md`).
    it.runIf(checkHasLangPackage('he'))(
        'splits Hebrew at the maqaf and lists a word once whatever its accent',
        () => {
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
        },
    );

    it('keeps the mark of an elided Greek word and joins grave and acute', () => {
        // GREEKGNT's John 3:16 types the elision as ’, a punctuation mark.
        expect(
            listStudyWords('μὴ ἀπόληται ἀλλ’ ἔχῃ ζωὴν αἰώνιον. Θεὸς Θεός'),
        ).toEqual(['μὴ', 'ἀπόληται', 'ἀλλ’', 'ἔχῃ', 'ζωὴν', 'αἰώνιον', 'Θεὸς']);
        // A closing quote after an English word is not an elision.
        expect(listStudyWords('‘said’ he')).toEqual(['said', 'he']);
    });
});

describe('studying the words, step by step', () => {
    const verses = listStudyVerses(GB_FACTS);

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

// A Thai verse -- whose first "words" are one long run -- under **Study the
// words**. Genesis 1:1 as a Thai Bible writes it: no space inside the
// sentence.
const THAI_VERSE = 'ในปฐมกาลพระเจ้าทรงเนรมิตสร้างฟ้าและแผ่นดิน';
const THAI_ASK = {
    kind: 'verse' as const,
    target: 'GEN 1:1-2',
    title: 'ปฐมกาล 1:1-2',
    bibleKey: 'TH1971',
};

describe('a script written with no spaces', () => {
    it('with no word segmenter, a long run stays one word to study, once', () => {
        const saved = (Intl as any).Segmenter;
        (Intl as any).Segmenter = undefined;
        try {
            expect(listStudyWords(`${THAI_VERSE} ${THAI_VERSE}`)).toEqual([
                THAI_VERSE,
            ]);
        } finally {
            (Intl as any).Segmenter = saved;
        }
    });

    it('a verse whose first words run long is cut on its button', () => {
        const verses = listStudyVerses({
            kind: 'verse',
            bible: 'TH1971',
            passages: [
                {
                    key: 'GEN 1:1-2',
                    ref: 'Genesis 1:1-2',
                    title: 'ปฐมกาล 1:1-2',
                    text: `(1): ${THAI_VERSE} (2): แผ่นดินนั้นก็ร้างเปล่าอยู่`,
                },
            ],
        });
        const answer = genStudyVersesAnswer(THAI_ASK, verses);
        expect(
            answer.actions.map((action) => {
                return action.label;
            }),
        ).toEqual([
            '1 · ในปฐมกาลพระเจ้าทรงเนรมิตสร้างฟ้า…',
            // Short enough to be shown whole.
            '2 · แผ่นดินนั้นก็ร้างเปล่าอยู่',
        ]);
    });
});
