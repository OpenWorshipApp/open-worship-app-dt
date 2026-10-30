// @vitest-environment jsdom
/**
 * The same question goes the same way in every language (2026-10-29).
 * (jsdom: the verse finder's module brings the app's provider along.)
 *
 * The user's three pictures of Noah's card: _what is the size of noah ark_
 * was answered from the record in English and in Khmer, and _Quelle est la
 * taille de l'arche de Noé_ was sent to the app's guide, which answers no
 * Bible question and said to type `/btw`. Each language's words are data,
 * and nothing held them to each other: French `taille` and Khmer `ទំហំ`
 * were the app's work, English had no word for a size at all, while
 * English `save`, `Mark` and `help` took _How did God save Noah?_ to the
 * guide in English alone. The user's Khmer reached the record by its
 * spelling (`ទំ់ហុំ`, which no list held); written `ទំហំ` it went to the
 * guide as the French did.
 *
 * Every row here is asked in English, Khmer and French, through the
 * readers the window asks in the order `handleAsking` asks them, and must
 * land where the row says in all three. A word added to one language that
 * moves a row moves it in that language only, and fails here.
 */
import { describe, expect, test } from 'vitest';

import frQuestionText from '../../tools/owa-devtools-mcp/questions/i18n/fr.json';
import kmQuestionText from '../../tools/owa-devtools-mcp/questions/i18n/km.json';
import { checkIsHowTo, readBibleReaderAsk } from './bibleReaderChatHelpers';
import { checkIsRemovalReply, pickReplyLanguage } from './chatLangHelpers';
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
    readTypedVerseContentAsk,
    readTypedVerseFindAsk,
} from './verseAskLanguageHelpers';
import { readVerseFindThread } from './verseFindChatHelpers';

type LangType = 'en' | 'km' | 'fr';
type AskedType = Record<LangType, string>;

const LANG_LIST: LangType[] = ['en', 'km', 'fr'];

// A card is titled in the lookup's own language.
function genNameCard(title: string): LookupSubjectType {
    return { kind: 'name', target: 'noah', title, facts: '{"kjvName":"Noah"}' };
}
const NOAH: Record<LangType, LookupSubjectType> = {
    en: genNameCard('Noah'),
    km: genNameCard('ណូអេ'),
    fr: genNameCard('Noé'),
};
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

type CardRowType = [
    string,
    AskedType,
    LookupSubjectType | Record<LangType, LookupSubjectType>,
    string,
];

const CARD_ROW_LIST: CardRowType[] = [
    // What the record answers, whatever word of the app rides along.
    [
        'the size of the ark (the user’s three pictures)',
        {
            en: 'what is the size of noah ark',
            km: 'តើទូកណូអេមានទំហំយ៉ាងដូចម្តេច',
            fr: "Quelle est la taille de l'arche de Noé",
        },
        NOAH,
        'record',
    ],
    [
        'saved by God',
        {
            en: 'How did God save Noah from the flood?',
            km: 'តើព្រះសង្គ្រោះណូអេពីទឹកជំនន់យ៉ាងដូចម្តេច?',
            fr: 'Comment Dieu a-t-il sauvé Noé du déluge ?',
        },
        NOAH,
        'record',
    ],
    [
        'Mark the gospel',
        {
            en: 'Does Mark mention Noah?',
            km: 'តើម៉ាកុសនិយាយពីណូអេទេ?',
            fr: 'Est-ce que Marc parle de Noé ?',
        },
        NOAH,
        'record',
    ],
    [
        'help to understand',
        {
            en: 'Help me understand why God sent the flood',
            km: 'ជួយខ្ញុំយល់ពីមូលហេតុដែលព្រះបញ្ជូនទឹកជំនន់',
            fr: 'Aide-moi à comprendre pourquoi Dieu a envoyé le déluge',
        },
        NOAH,
        'record',
    ],
    [
        'fond, and the bottom of the ark',
        {
            en: 'Was Noah fond of his sons?',
            km: 'តើមានអ្វីនៅបាតទូក?',
            fr: "Qu'y avait-il au fond de l'arche ?",
        },
        NOAH,
        'record',
    ],
    [
        'the sound of the rain',
        {
            en: 'Did Noah hear the sound of the rain?',
            km: 'តើណូអេបានឮសំឡេងភ្លៀងទេ?',
            fr: 'Noé a-t-il entendu le bruit de la pluie ?',
        },
        NOAH,
        'record',
    ],
    [
        'the ark’s window',
        {
            en: 'Why did Noah open the window of the ark?',
            km: 'ហេតុអ្វីណូអេបើកបង្អួចទូក?',
            fr: "Pourquoi Noé a-t-il ouvert la fenêtre de l'arche ?",
        },
        NOAH,
        'record',
    ],
    [
        'a name’s meaning',
        {
            en: 'What does the name Noah mean?',
            km: 'តើឈ្មោះណូអេមានន័យដូចម្តេច?',
            fr: 'Que signifie le nom Noé ?',
        },
        NOAH,
        'record',
    ],
    [
        'a mountain’s size',
        {
            en: 'How big is Mount Ararat?',
            km: 'តើភ្នំអារ៉ារ៉ាតមានទំហំប៉ុណ្ណា?',
            fr: 'Quelle est la taille du mont Ararat ?',
        },
        ARARAT,
        'record',
    ],
    // The card's own readers.
    [
        'how many children',
        {
            en: 'How many children did Noah have?',
            km: 'តើណូអេមានកូនប៉ុន្មាននាក់?',
            fr: "Combien d'enfants Noé avait-il ?",
        },
        NOAH,
        'count:children',
    ],
    [
        'the family line',
        {
            en: "Show Noah's family line to Jesus",
            km: 'បង្ហាញពូជពង្សរបស់ណូអេដល់ព្រះយេស៊ូវ',
            fr: 'Montre la lignée de Noé jusqu’à Jésus',
        },
        NOAH,
        'lineage',
    ],
    [
        'a map',
        {
            en: 'Show Ararat on a map',
            km: 'បង្ហាញអារ៉ារ៉ាតលើផែនទី',
            fr: "Montre l'Ararat sur une carte",
        },
        ARARAT,
        'map',
    ],
    [
        'other versions',
        {
            en: 'What do other versions say?',
            km: 'តើពុម្ពផ្សេងនិយាយយ៉ាងដូចម្តេច?',
            fr: 'Que disent les autres versions ?',
        },
        GENESIS_8,
        'card:anotherBible',
    ],
    [
        'save it',
        {
            en: 'Save this to my list',
            km: 'រក្សាទុកវគ្គនេះក្នុងបញ្ជី',
            fr: 'Enregistrer ce passage dans ma liste',
        },
        GENESIS_8,
        'card:save',
    ],
    [
        'the next chapter',
        {
            en: 'Next chapter',
            km: 'ជំពូកបន្ទាប់',
            fr: 'Chapitre suivant',
        },
        GENESIS_8,
        'card:near',
    ],
    [
        'every word',
        {
            en: 'Explain each word of verse 1',
            km: 'ពន្យល់ពាក្យនីមួយៗក្នុងខ ១',
            fr: 'Explique chaque mot du verset 1',
        },
        GENESIS_8,
        'words',
    ],
    [
        'a verse by number',
        {
            en: 'What does verse 20 mean?',
            km: 'តើខ ២០ មានន័យអ្វី?',
            fr: 'Que signifie le verset 20 ?',
        },
        GENESIS_8,
        'record:GEN 8:20',
    ],
    [
        'a length of time',
        {
            en: 'How long was Noah in the ark?',
            km: 'តើណូអេនៅក្នុងទូករយៈពេលប៉ុន្មាន?',
            fr: "Combien de temps Noé est-il resté dans l'arche ?",
        },
        GENESIS_8,
        'record:before+after',
    ],
    [
        'who is in it',
        {
            en: 'Who is in this passage?',
            km: 'តើមាននរណាខ្លះក្នុងវគ្គនេះ?',
            fr: 'Qui est dans ce passage ?',
        },
        GENESIS_8,
        'record:names',
    ],
    // The app's work, to the app's guide.
    [
        'the screen',
        {
            en: "How do I put Noah's verses on the screen?",
            km: 'តើខ្ញុំដាក់ខគម្ពីររបស់ណូអេលើអេក្រង់ដោយរបៀបណា?',
            fr: "Comment mettre les versets de Noé à l'écran ?",
        },
        NOAH,
        'guide',
    ],
    [
        'the text size',
        {
            en: 'How do I change the text size?',
            km: 'តើខ្ញុំប្តូរទំហំអក្សរដោយរបៀបណា?',
            fr: 'Comment changer la taille du texte ?',
        },
        NOAH,
        'guide',
    ],
    [
        'bigger words',
        {
            en: 'How do I make the words bigger?',
            km: 'តើខ្ញុំធ្វើឲ្យអក្សរធំជាងនេះដោយរបៀបណា?',
            fr: 'Comment agrandir le texte ?',
        },
        NOAH,
        'guide',
    ],
    [
        'deleting',
        {
            en: 'How do I delete this chat?',
            km: 'តើខ្ញុំលុបការសន្ទនានេះដោយរបៀបណា?',
            fr: 'Comment supprimer cette conversation ?',
        },
        NOAH,
        'guide',
    ],
    [
        'saving, in a how-do-I',
        {
            en: 'How can I save this?',
            km: 'តើខ្ញុំរក្សាទុកវាដោយរបៀបណា?',
            fr: 'Comment est-ce que je peux le sauvegarder ?',
        },
        NOAH,
        'guide',
    ],
    [
        'the settings',
        {
            en: 'Where are the settings?',
            km: 'តើការកំណត់នៅឯណា?',
            fr: 'Où sont les paramètres ?',
        },
        NOAH,
        'guide',
    ],
    [
        'the background',
        {
            en: 'How do I change the background?',
            km: 'តើខ្ញុំប្តូរផ្ទៃខាងក្រោយដោយរបៀបណា?',
            fr: "Comment changer l'arrière-plan ?",
        },
        NOAH,
        'guide',
    ],
    [
        'undoing',
        {
            en: 'How do I undo that?',
            km: 'តើខ្ញុំត្រឡប់វិញដោយរបៀបណា?',
            fr: 'Comment annuler cela ?',
        },
        NOAH,
        'guide',
    ],
    [
        'a keyboard shortcut',
        {
            en: 'What is the keyboard shortcut?',
            km: 'តើផ្លូវកាត់ក្តារចុចគឺអ្វី?',
            fr: 'Quel est le raccourci clavier ?',
        },
        NOAH,
        'guide',
    ],
    [
        'a passage on the screen',
        {
            en: 'Put this passage on the screen',
            km: 'ដាក់វគ្គនេះលើអេក្រង់',
            fr: "Mettre ce passage à l'écran",
        },
        GENESIS_8,
        'guide',
    ],
];

describe('a line typed under a card', () => {
    describe.each(CARD_ROW_LIST)('%s', (_label, asked, subject, expected) => {
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            const card =
                'kind' in subject
                    ? (subject as LookupSubjectType)
                    : (subject as Record<LangType, LookupSubjectType>)[lang];
            expect(routeUnderCard(asked[lang], card)).toBe(expected);
        });
    });

    test('the user’s own Khmer, as they spelled it', () => {
        expect(routeUnderCard('តើទូកណូអេមានទំ់ហុំយ៉ាងដូចម្តេច', NOAH.km)).toBe(
            'record',
        );
    });
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

const TYPED_ROW_LIST: [string, AskedType, string][] = [
    [
        'a verse by what it says',
        {
            en: 'Which verse says do not worry about tomorrow?',
            km: 'ខគម្ពីរណាដែលនិយាយថាកុំខ្វល់ពីថ្ងៃស្អែក?',
            fr: 'Quel verset dit de ne pas s’inquiéter du lendemain ?',
        },
        'verse',
    ],
    [
        'what the Bible says about',
        {
            en: 'What does the Bible say about forgiveness?',
            km: 'តើព្រះគម្ពីរចែងអំពីការអភ័យទោសយ៉ាងដូចម្តេច?',
            fr: 'Que dit la Bible sur le pardon ?',
        },
        'verse',
    ],
    [
        'where the Bible says it',
        {
            en: 'Where does the Bible say God is love?',
            km: 'ព្រះគម្ពីរចែងថាព្រះជាសេចក្តីស្រឡាញ់នៅឯណា?',
            fr: 'Où la Bible dit-elle que Dieu est amour ?',
        },
        'verse',
    ],
    [
        'a story by its name',
        {
            en: 'Where in the Bible is the story of the flood?',
            km: 'តើរឿងទឹកជំនន់នៅក្នុងគម្ពីរណា?',
            fr: "Où se trouve l'histoire du déluge dans la Bible ?",
        },
        'verse',
    ],
    [
        'find me a verse',
        {
            en: 'Find me a verse about hope',
            km: 'សូមរកខគម្ពីរអំពីសេចក្តីសង្ឃឹម',
            fr: 'Trouve-moi un verset sur l’espérance',
        },
        'verse',
    ],
    [
        'verses about',
        {
            en: 'Verses about patience',
            km: 'ខគម្ពីរអំពីការអត់ធ្មត់',
            fr: 'Des versets sur la patience',
        },
        'verse',
    ],
    [
        'is there a verse',
        {
            en: 'Is there a verse about anger?',
            km: 'តើមានខគម្ពីរណាដែលនិយាយអំពីកំហឹងទេ?',
            fr: 'Y a-t-il un verset sur la colère ?',
        },
        'verse',
    ],
    [
        'a song the Bible sings',
        {
            en: 'Which verse says sing a new song to the Lord?',
            km: 'ខគម្ពីរណាដែលនិយាយថាច្រៀងចម្រៀងថ្មីថ្វាយព្រះ?',
            fr: 'Quel verset dit de chanter un chant nouveau ?',
        },
        'verse',
    ],
    [
        'the verse finder, nothing remembered yet',
        {
            en: 'Help me find a Bible verse',
            km: 'ជួយរកខគម្ពីរមួយផង',
            fr: 'Aide-moi à trouver un verset biblique',
        },
        'find',
    ],
    [
        'the verse finder with its words',
        {
            en: 'Help me find a verse: love your enemies',
            km: 'ជួយរកខគម្ពីរ៖ ស្រឡាញ់ខ្មាំងសត្រូវ',
            fr: 'Aide-moi à trouver un verset : aimez vos ennemis',
        },
        'find+words',
    ],
    [
        'a verse forgotten',
        {
            en: 'Can you help me find a verse I forgot?',
            km: 'ជួយរកខគម្ពីរដែលខ្ញុំភ្លេចផង',
            fr: "Peux-tu m'aider à trouver un verset que j'ai oublié ?",
        },
        'find',
    ],
    [
        'a verse for the screen is the app’s work',
        {
            en: 'Show me a verse about love on the screen',
            km: 'បង្ហាញខគម្ពីរអំពីសេចក្ដីស្រឡាញ់លើអេក្រង់',
            fr: "Montre-moi un verset sur l'amour à l'écran",
        },
        'ordinary',
    ],
    [
        'present, a Bible word (Romans 12:1)',
        {
            en: 'Which verse says present your bodies a living sacrifice?',
            km: 'ខគម្ពីរណាដែលនិយាយថាចូរថ្វាយរូបកាយជាយញ្ញបូជារស់?',
            fr: 'Quel verset dit de présenter vos corps comme un sacrifice vivant ?',
        },
        'verse',
    ],
    // Knowledge about the Bible: with no assistant, the way to one, never a
    // manual page that does not answer (EC-444).
    [
        'who wrote a book',
        {
            en: 'Who wrote the book of Psalms?',
            km: 'តើនរណាជាអ្នកសរសេរគម្ពីរទំនុកតម្កើង?',
            fr: 'Qui a écrit le livre des Psaumes ?',
        },
        'knowledge',
    ],
    [
        'how many books',
        {
            en: 'How many books are in the Bible?',
            km: 'តើព្រះគម្ពីរមានប៉ុន្មានគម្ពីរ?',
            fr: 'Combien de livres y a-t-il dans la Bible ?',
        },
        'knowledge',
    ],
    [
        'when Jesus was born',
        {
            en: 'When was Jesus born?',
            km: 'តើព្រះយេស៊ូប្រសូតនៅពេលណា?',
            fr: 'Quand Jésus est-il né ?',
        },
        'knowledge',
    ],
    [
        'who was — the names lookup’s',
        {
            en: 'Who was Moses?',
            km: 'តើម៉ូសេជានរណា?',
            fr: 'Qui était Moïse ?',
        },
        'ordinary',
    ],
    [
        'what is open — the app’s own state',
        {
            en: 'Who wrote this passage I am reading?',
            km: 'តើនរណាសរសេរគម្ពីរនេះ?',
            fr: 'Qui a écrit ce passage que je lis ?',
        },
        'ordinary',
    ],
];

// The questions the app is prepared to be asked, in every language: none
// may be read as a Bible question, or the guide refuses its own row.
const TRANSLATED_QUESTION_LIST = [frQuestionText, kmQuestionText].flatMap(
    (file) => {
        return Object.values(
            (
                file as {
                    questions: Record<string, { en: string; text: string }>;
                }
            ).questions,
        ).flatMap((row) => {
            return [row.en, row.text];
        });
    },
);

describe('a line typed in any tab', () => {
    test('takes none of the questions the app is prepared to be asked', () => {
        // The whole list, both languages, not an empty one read wrong.
        expect(TRANSLATED_QUESTION_LIST.length).toBeGreaterThan(1600);
        const taken = TRANSLATED_QUESTION_LIST.filter((text) => {
            return readAnyBibleContentAsk(text) !== null;
        });
        expect(taken).toEqual([]);
    });

    describe.each(TYPED_ROW_LIST)('%s', (_label, asked, expected) => {
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            expect(routeTyped(asked[lang])).toBe(expected);
        });
    });

    test('the verse finder keeps the words as they were written', () => {
        expect(
            readTypedVerseFindAsk(
                'Aide-moi à trouver un verset biblique dans « KJV » : aimez vos ennemis',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'aimez vos ennemis' });
        expect(
            readTypedVerseContentAsk('Que dit la Bible sur le pardon ?'),
        ).toEqual({ kind: 'verse', words: 'le pardon' });
        expect(
            readTypedVerseContentAsk(
                "Où se trouve l'histoire du déluge dans la Bible ?",
            ),
        ).toEqual({ kind: 'verse', words: "l'histoire du déluge" });
    });
});

// A line typed under a verse-finding answer: more of the search, or the
// app's own work that ends it (EC-443). A Bible word is a verse's.
const THREAD_ROW_LIST: [string, AskedType, 'search' | 'end'][] = [
    [
        'a new song',
        {
            en: 'a verse about singing a new song',
            km: 'ខដែលនិយាយអំពីការច្រៀងចម្រៀងថ្មី',
            fr: 'un verset sur chanter un chant nouveau',
        },
        'search',
    ],
    [
        'in his image',
        {
            en: 'God made man in his own image',
            km: 'ព្រះបង្កើតមនុស្សតាមរូបភាពរបស់ទ្រង់',
            fr: "Dieu créa l'homme à son image",
        },
        'search',
    ],
    [
        'he keeps his people',
        {
            en: 'he shall save his people from their sins',
            km: 'ទ្រង់នឹងរក្សាទុកប្រជារាស្ត្ររបស់ទ្រង់',
            fr: 'il sauvera son peuple de ses péchés',
        },
        'search',
    ],
    [
        'on the screen',
        {
            en: 'put it on the screen',
            km: 'ដាក់វាលើអេក្រង់',
            fr: "mets-le à l'écran",
        },
        'end',
    ],
    [
        'save it',
        { en: 'save it', km: 'រក្សាទុកវា', fr: 'enregistre-le' },
        'end',
    ],
    [
        'how do I',
        {
            en: 'How do I save it?',
            km: 'តើខ្ញុំរក្សាទុកវាដោយរបៀបណា?',
            fr: "Comment puis-je l'enregistrer ?",
        },
        'end',
    ],
];

describe('a line typed under a verse-finding answer', () => {
    const messageList = [
        { author: 'you' as const },
        { author: 'bot' as const, verseFind: 'KJV' },
    ];
    describe.each(THREAD_ROW_LIST)('%s', (_label, asked, expected) => {
        test.each(LANG_LIST)(`%s: ${expected}`, (lang) => {
            const bible = readVerseFindThread(messageList, asked[lang]);
            expect(bible === null ? 'end' : 'search').toBe(expected);
        });
    });
});

const READER_ROW_LIST: [string, AskedType, string][] = [
    [
        'the names in a chapter',
        {
            en: 'What names are in Genesis chapter 4?',
            km: 'តើមានឈ្មោះអ្វីខ្លះក្នុងលោកុប្បត្តិ ជំពូក ៤?',
            fr: 'Quels noms sont dans Genèse chapitre 4 ?',
        },
        'names',
    ],
    [
        'a verse by its reference',
        {
            en: 'What does John 3:16 say?',
            km: 'តើយ៉ូហាន ៣:១៦ និយាយអ្វី?',
            fr: 'Que dit Jean 3:16 ?',
        },
        'reference',
    ],
    [
        'a size in a verse',
        {
            en: 'What is the size of the ark in Genesis 6:15?',
            km: 'តើទំហំទូកក្នុងលោកុប្បត្តិ ៦:១៥ ប៉ុន្មាន?',
            fr: "Quelle est la taille de l'arche dans Genèse 6:15 ?",
        },
        'reference',
    ],
    [
        'Mark’s gospel',
        {
            en: 'What does Mark 4:39 say?',
            km: 'តើម៉ាកុស ៤:៣៩ និយាយអ្វី?',
            fr: 'Que dit Marc 4:39 ?',
        },
        'reference',
    ],
    [
        'how Jesus saved (no how-do-I)',
        {
            en: 'How did Jesus save Peter in Matthew 14:30?',
            km: 'តើព្រះយេស៊ូវសង្គ្រោះពេត្រុសយ៉ាងដូចម្តេចក្នុងម៉ាថាយ ១៤:៣០?',
            fr: 'Comment Jésus a-t-il sauvé Pierre dans Matthieu 14:30 ?',
        },
        'reference',
    ],
    [
        'a how-do-I is the app’s',
        {
            en: 'How do I open John 3:16?',
            km: 'តើខ្ញុំបើកយ៉ូហាន ៣:១៦ ដោយរបៀបណា?',
            fr: 'Comment ouvrir Jean 3:16 ?',
        },
        'none',
    ],
    [
        'the screen is the app’s',
        {
            en: 'Put John 3:16 on the screen',
            km: 'ដាក់យ៉ូហាន ៣:១៦ លើអេក្រង់',
            fr: "Mettre Jean 3:16 à l'écran",
        },
        'none',
    ],
];

describe('a line typed in a Bible Reader tab', () => {
    describe.each(READER_ROW_LIST)('%s', (_label, asked, expected) => {
        test.each(LANG_LIST)(`%s goes to ${expected}`, (lang) => {
            const ask = readBibleReaderAsk(asked[lang], () => true);
            expect(ask?.intent ?? 'none').toBe(expected);
        });
    });
});

describe('one line read alike', () => {
    test.each([
        [
            'a thank-you',
            checkIsClosingLine,
            { en: 'Thank you so much', km: 'អរគុណច្រើន', fr: 'Merci beaucoup' },
        ],
        [
            'a removal chip',
            checkIsRemovalReply,
            { en: 'Delete everything', km: 'លុបទាំងអស់', fr: 'Tout supprimer' },
        ],
        [
            'a how-do-I',
            checkIsHowTo,
            {
                en: 'How do I open the Bible?',
                km: 'តើខ្ញុំបើកព្រះគម្ពីរដោយរបៀបណា?',
                fr: 'Comment ouvrir la Bible ?',
            },
        ],
    ] as const)('%s', (_label, check, asked) => {
        for (const lang of LANG_LIST) {
            expect(check(asked[lang])).toBe(true);
        }
    });

    test.each([
        'Comment Dieu a-t-il sauvé Noé ?',
        'Comment Pierre a-t-il renié Jésus ?',
        'Comment notre Seigneur est-il mort ?',
        'តើព្រះសង្គ្រោះណូអេយ៉ាងដូចម្តេច?',
        'How did God save Noah?',
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
    const rowList: AskedType[] = [
        ...CARD_ROW_LIST.map((row) => row[1]),
        ...TYPED_ROW_LIST.map((row) => row[1]),
        ...THREAD_ROW_LIST.map((row) => row[1]),
        ...READER_ROW_LIST.map((row) => row[1]),
    ];
    const toWordCount = (text: string) => {
        return text.split(/\s+/).filter(Boolean).length;
    };
    test.each(LANG_LIST)('a line asked in %s', (lang) => {
        const wrongList = rowList.flatMap((asked) => {
            const text = asked[lang];
            // Khmer is written without spaces: its script decides.
            if (lang !== 'km' && toWordCount(text) < 4) {
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
