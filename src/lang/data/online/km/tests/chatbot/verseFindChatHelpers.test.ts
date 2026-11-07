import { describe, expect, it, vi } from 'vitest';

// The import conversation's own module comes along for its first state;
// these keep its app-side imports off a test with no window.
vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock(
    '../../../../../../setting/bible-setting/bibleImportRequestHelpers',
    () => {
        return { requestBibleImport: vi.fn() };
    },
);
vi.mock('../../../../../../setting/settingHelpers', () => {
    return { openBibleSetting: vi.fn() };
});
vi.mock('../../../../../../server/appProvider', () => {
    return { default: { browserUtils: { openExternalURL: vi.fn() } } };
});
vi.mock('../../../../../../chatbot/mcpClient', () => {
    return {
        callTool: vi.fn(),
        parseToolJson: (text: string) => {
            try {
                return JSON.parse(text);
            } catch (_error) {
                return null;
            }
        },
    };
});
import { NOT_IN_LANGUAGE_REASON } from '../../../../../../helper/bibleVerseFindHelpers';
import { readVerseFindAsk } from '../../../../../../helper/ai/verseFindAskHelpers';
import {
    SEARCH_ANOTHER_BIBLE_LABEL,
    SHOW_IN_ANOTHER_BIBLE_LABEL,
    VERSE_FIND_STEP_TOOL_NAME,
    VERSE_FIND_TOOL_NAME,
    VERSE_TRANSLATION_MODEL_PATTERN,
    VERSE_WEB_SEARCH_TOOL_NAME,
    answerVerseFindOffline,
    genVerseChangeBibleAction,
    pickNamedVerses,
    toVerseFindSearchAgainAsk,
    checkVerseFindNeedsTranslation,
    genVerseHeadStart,
    genVerseHeadStartAnswer,
    readVerseTranslation,
    toHeadStartFoundVerses,
    toVerseHeadStartAsk,
    toVerseTranslationAsk,
    describeVerseOpened,
    genVerseOpenAction,
    genVerseOpenActions,
    readFoundVerses,
    readVerseFindTypedPick,
    getVerseFindInputChoices,
    runVerseFindStep,
    toShownVerseRef,
    genVerseFindThanksAnswer,
    toVerseWebSearchUrl,
    genHeadStartBrowseAction,
    genVerseBrowseAction,
    genVerseWhereLine,
    readFoundPassages,
} from '../../../../../../chatbot/verseFindChatHelpers';

const BIBLES = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'KHOV', title: 'Khmer Old Version' },
        { key: 'LSG', title: 'Louis Segond 1910' },
    ],
};

function genCall(answer: unknown) {
    return vi.fn(async (_name: string, _args: any) => {
        if (answer instanceof Error) {
            throw answer;
        }
        return JSON.stringify(answer);
    });
}

describe('which Bible', () => {
    it('reads a Bible picked by typing, off the last answer only', async () => {
        const listed = await runVerseFindStep(
            { step: 'bible' },
            genCall(BIBLES),
        );
        const messages = [{ author: 'bot' as const, actions: listed.actions }];
        expect(readVerseFindTypedPick(messages, 'khov')).toMatchObject({
            step: 'remember',
            bible: 'KHOV',
        });
        for (const typed of ['៣', '៣?', '３', '3?']) {
            expect(readVerseFindTypedPick(messages, typed)).toMatchObject({
                bible: 'LSG',
            });
        }
        expect(getVerseFindInputChoices(listed.actions)).toHaveLength(3);
        expect(readVerseFindTypedPick(messages, '3')).toMatchObject({
            bible: 'LSG',
        });
        expect(readVerseFindTypedPick(messages, 'segond')).toMatchObject({
            bible: 'LSG',
        });
        // "version" is in two titles: no guess.
        expect(readVerseFindTypedPick(messages, 'version')).toBeNull();
        expect(readVerseFindTypedPick(messages, '/help')).toBeNull();
        expect(
            readVerseFindTypedPick(
                [...messages, { author: 'bot' as const, actions: [] }],
                'khov',
            ),
        ).toBeNull();
    });
});

describe('the verses found', () => {
    const result = JSON.stringify({
        bible: 'KJV',
        verses: [
            { key: 'MAT 5:44', ref: 'Matthew 5:44', text: 'But I say' },
            { key: 'PSA 23:1', ref: 'Psalms 23:1', text: 'The LORD' },
            { key: 'LUK 6:27', ref: 'Luke 6:27', text: 'But I say' },
            { ref: 'broken' },
        ],
    });

    it('reads them off the tool result', () => {
        expect(readFoundVerses(result)).toEqual([
            { key: 'MAT 5:44', ref: 'Matthew 5:44', bible: 'KJV' },
            { key: 'PSA 23:1', ref: 'Psalms 23:1', bible: 'KJV' },
            { key: 'LUK 6:27', ref: 'Luke 6:27', bible: 'KJV' },
        ]);
        expect(readFoundVerses('Tool refused: no')).toEqual([]);
    });

    it('offers a button for each one the answer names, in its order', () => {
        const found = readFoundVerses(result);
        const actions = genVerseOpenActions(
            [...found, ...found],
            'It is **Psalm 23:1** — or maybe Matthew 5 : 44, not Luke 6:2.',
            'KJV',
        );
        expect(actions).toEqual([
            {
                label: 'Open Psalms 23:1 in Bible Lookup',
                toolName: VERSE_FIND_TOOL_NAME,
                args: { bible: 'KJV', open: 'PSA 23:1' },
            },
            {
                label: 'Open Matthew 5:44 in Bible Lookup',
                toolName: VERSE_FIND_TOOL_NAME,
                args: { bible: 'KJV', open: 'MAT 5:44' },
            },
        ]);
        expect(
            genVerseOpenActions(found, 'None of these fits.', 'KJV'),
        ).toEqual([]);
    });

    // Seen live: a Khmer search that also searched the KJV drew every
    // button twice, one per Bible the verse was found in.
    it('opens a verse once, in the Bible the conversation searches', () => {
        const foundInKjv = readFoundVerses(result);
        const readInKhmer = foundInKjv.map((verse) => {
            return { ...verse, bible: 'ពគប' };
        });
        const actions = genVerseOpenActions(
            [...foundInKjv, ...readInKhmer],
            'Matthew 5:44 and Luke 6:27.',
            'ពគប',
        );
        expect(
            actions.map((action) => {
                return action.args;
            }),
        ).toEqual([
            { bible: 'ពគប', open: 'MAT 5:44' },
            { bible: 'ពគប', open: 'LUK 6:27' },
        ]);
    });
});

describe('words in another script', () => {
    it('knows which words have to be put into English', () => {
        expect(checkVerseFindNeedsTranslation('ព្រះយេស៊ូសួរពេត្រុស')).toBe(
            true,
        );
        expect(checkVerseFindNeedsTranslation('jesus asked peter')).toBe(false);
        expect(checkVerseFindNeedsTranslation('Éternel, berger')).toBe(false);
        expect(checkVerseFindNeedsTranslation('John 3:16 — 愛')).toBe(true);
        expect(VERSE_TRANSLATION_MODEL_PATTERN.test('google/gemma-4-e4b')).toBe(
            true,
        );
        expect(VERSE_TRANSLATION_MODEL_PATTERN.test('gemma3:4b')).toBe(false);
    });

    it('asks for KJV wording and reads the English back', () => {
        expect(toVerseTranslationAsk(' ព្រះយេស៊ូ ')).toMatch(
            /^ព្រះយេស៊ូ\n\n\(Put the words above into English/,
        );
        expect(
            readVerseTranslation('Translation: "Jesus asked Peter"\nmore'),
        ).toBe('Jesus asked Peter');
        expect(readVerseTranslation('\n\n**Lovest thou me**')).toBe(
            'Lovest thou me',
        );
        // An answer in the words it was given translated nothing.
        expect(readVerseTranslation('ព្រះយេស៊ូ')).toBeNull();
        expect(readVerseTranslation('   ')).toBeNull();
        expect(readVerseTranslation('x'.repeat(500))).toHaveLength(200);
    });
});

describe('the head start', () => {
    const khmerResult = {
        bible: 'ពគប',
        verses: [{ key: 'LUK 8:45', ref: 'Luke 8:45', text: 'ព្រះយេស៊ូវ…' }],
    };
    const englishResult = {
        bible: 'ពគប',
        searchedIn: 'KJV',
        verses: [
            { key: 'JHN 21:17', ref: 'John 21:17', text: 'រួចទ្រង់មាន…' },
            { key: 'JHN 21:15', ref: 'John 21:15', text: 'កាលគេបាន…' },
        ],
    };

    it('searches their words, and the English when there is one', async () => {
        const call = vi.fn(async (_name: string, args: any) => {
            return JSON.stringify(
                args.words === 'Jesus asked Peter lovest thou me'
                    ? englishResult
                    : khmerResult,
            );
        });
        const parts = await genVerseHeadStart(
            'ព្រះយេស៊ូសួរពេត្រុស',
            'ពគប',
            'Jesus asked Peter lovest thou me',
            call,
        );
        expect(call).toHaveBeenCalledTimes(2);
        expect(parts.map((part) => part.what)).toEqual([
            'ពគប, for their own words',
            'ពគប, for their words put into English: “Jesus asked Peter ' +
                'lovest thou me” (searched in KJV, quoted from ពគប)',
        ]);
        expect(toHeadStartFoundVerses(parts, 'ពគប')).toEqual([
            { key: 'LUK 8:45', ref: 'Luke 8:45', bible: 'ពគប' },
            { key: 'JHN 21:17', ref: 'John 21:17', bible: 'ពគប' },
            { key: 'JHN 21:15', ref: 'John 21:15', bible: 'ពគប' },
        ]);
        const ask = toVerseHeadStartAsk(parts);
        expect(ask).toContain('The app has already searched');
        expect(ask).toContain('  John 21:17 — រួចទ្រង់មាន…');
        expect(ask).not.toContain('JHN 21:17');
        expect(toVerseHeadStartAsk([])).toBe('');
    });

    it('is the answer when no assistant answered', () => {
        const answer = genVerseHeadStartAnswer(
            [
                toTestPart('ពគប, for their own words', khmerResult.verses),
                toTestPart('in English', englishResult.verses),
            ],
            'ព្រះយេស៊ូសួរពេត្រុស',
            'ពគប',
        );
        expect(answer?.text).toContain('**ពគប, for their own words:**');
        expect(answer?.text).toContain('- **John 21:17** — រួចទ្រង់មាន…');
        expect(answer?.text).toContain('search Google for it');
        expect(
            answer?.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual([
            'Open Luke 8:45 in Bible Lookup',
            'Open John 21:17 in Bible Lookup',
            'Open John 21:15 in Bible Lookup',
            'Show in another Bible',
            'Search Google for it',
        ]);
        expect(answer?.actions?.[3].args).toEqual({
            step: 'bible',
            current: 'ពគប',
            words: 'ព្រះយេស៊ូសួរពេត្រុស',
            verses: [
                { key: 'LUK 8:45', ref: 'Luke 8:45' },
                { key: 'JHN 21:17', ref: 'John 21:17' },
                { key: 'JHN 21:15', ref: 'John 21:15' },
            ],
        });
        expect(answer?.verseFind).toBe('ពគប');
        expect(
            genVerseHeadStartAnswer([toTestPart('x', [])], 'w', 'KJV'),
        ).toBeNull();
    });
});

function toTestPart(
    what: string,
    verses: { key: string; ref: string; text: string }[],
) {
    return { what, verses };
}

describe('with no assistant', () => {
    // Seen live: English words under the Khmer Bible were answered "make
    // sure the main window is open".
    it('says words in another language are not in that Bible', async () => {
        const answer = await answerVerseFindOffline(
            'like jesus ask peter many times',
            'ពគប',
            genCall(
                new Error(
                    `${NOT_IN_LANGUAGE_REASON} ពគប is written in "km": put ` +
                        'the words they remember into that language.',
                ),
            ),
        );
        expect(answer.text).toContain('not written in the language of ពគប');
        expect(answer.text).toContain('**Search another Bible** below');
        expect(answer.text).not.toContain('main window');
        expect(answer.actions).toEqual([
            {
                label: 'Search another Bible',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'bible',
                    current: 'ពគប',
                    words: 'like jesus ask peter many times',
                },
            },
            {
                label: 'Search Google for it',
                toolName: VERSE_WEB_SEARCH_TOOL_NAME,
                args: {
                    words: 'like jesus ask peter many times',
                    bible: 'ពគប',
                },
            },
        ]);
        const url =
            'https://www.google.com/search?q=bible+verse+like+jesus+ask+peter+many+times';
        expect(answer.text).toContain(`search Google for it: \`${url}\``);
        expect(answer.links).toEqual([url]);
        expect(answer.verseFind).toBe('ពគប');
    });

    // The user's own example: `https://www.google.com/search?q=jesus+ask+peter`.
    it('builds the Google search from the words alone', () => {
        expect(toVerseWebSearchUrl('  jesus  ask peter\n3 times ')).toBe(
            'https://www.google.com/search?q=bible+verse+jesus+ask+peter+3+times',
        );
        expect(toVerseWebSearchUrl('ព្រះយេស៊ូ & co')).toBe(
            'https://www.google.com/search?q=bible+verse+%E1%9E%96%E1%9F%92%E1%9E%9A%E1%9F%87%E1%9E%99%E1%9F%81%E1%9E%9F%E1%9F%8A%E1%9E%BC+%26+co',
        );
        expect(toVerseWebSearchUrl({ url: 'https://evil.example' })).toBe(
            'https://www.google.com/search?q=bible+verse',
        );
        // Short enough to be drawn as a link (`chatLinkHelpers`: 600).
        expect(toVerseWebSearchUrl('x'.repeat(900)).length).toBeLessThan(600);
    });
});

// The user's ask, 2026-10-17: "I'm looking in khmer then I should be able to
// change to english".
describe('changing the Bible', () => {
    const FOUND = [
        { key: 'JHN 14:6', ref: 'John 14:6' },
        { key: 'JHN 21:17', ref: 'John 21:17' },
    ];

    it('says what the button is, by whether verses were found', () => {
        // Held to the words `chatTranLabels.test.ts` checks the packs for.
        expect(SEARCH_ANOTHER_BIBLE_LABEL).toBe('Search another Bible');
        expect(SHOW_IN_ANOTHER_BIBLE_LABEL).toBe('Show in another Bible');
        expect(genVerseChangeBibleAction('ពគប', 'ផ្លូវ', FOUND)).toEqual({
            label: 'Show in another Bible',
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: {
                step: 'bible',
                current: 'ពគប',
                words: 'ផ្លូវ',
                verses: FOUND,
            },
        });
        expect(genVerseChangeBibleAction('KJV', '  ')).toEqual({
            label: 'Search another Bible',
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'bible', current: 'KJV' },
        });
    });

    it('shows the verses found, read from the Bible picked', async () => {
        const call = genCall({
            bible: 'KJV',
            verses: [
                {
                    key: 'JHN 14:6',
                    ref: 'John 14:6',
                    text: 'Jesus saith unto him, I am the way',
                },
            ],
            unread: ['John 21:17'],
        });
        const answer = await runVerseFindStep(
            {
                step: 'remember',
                bible: 'KJV',
                title: 'King James Version',
                words: 'the way',
                verses: FOUND,
            },
            call,
        );
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            refs: 'John 14:6; John 21:17',
        });
        expect(answer.text).toContain('From **KJV — King James Version**:');
        expect(answer.text).toContain(
            '- **John 14:6** — Jesus saith unto him, I am the way',
        );
        expect(answer.text).toContain('KJV does not have John 21:17.');
        expect(answer.text).toContain('I will search KJV.');
        expect(answer.actions).toEqual([
            {
                label: 'Open John 14:6 in Bible Lookup',
                toolName: VERSE_FIND_TOOL_NAME,
                args: { bible: 'KJV', open: 'JHN 14:6' },
            },
            {
                label: 'Show in another Bible',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'bible',
                    current: 'KJV',
                    words: 'the way',
                    verses: [FOUND[0]],
                },
            },
        ]);
        expect(answer.verseFind).toBe('KJV');
    });

    it('searches the same words again when none was found', () => {
        const ask = toVerseFindSearchAgainAsk({
            step: 'remember',
            bible: 'KJV',
            words: 'lover your enemy',
        });
        expect(ask).toBe(
            'Help me find a Bible verse in "KJV": lover your enemy',
        );
        expect(readVerseFindAsk(ask ?? '')).toEqual({
            bibleKey: 'KJV',
            remembered: 'lover your enemy',
        });
        // Verses found are shown, not searched for.
        expect(
            toVerseFindSearchAgainAsk({
                step: 'remember',
                bible: 'KJV',
                words: 'the way',
                verses: FOUND,
            }),
        ).toBeNull();
        expect(
            toVerseFindSearchAgainAsk({ step: 'remember', bible: 'KJV' }),
        ).toBeNull();
        expect(
            toVerseFindSearchAgainAsk({ step: 'bible', words: 'the way' }),
        ).toBeNull();
        // A short name the line cannot carry is no search of that Bible.
        expect(
            toVerseFindSearchAgainAsk({
                step: 'remember',
                bible: 'King James',
                words: 'the way',
            }),
        ).toBeNull();
    });

    it('carries the verses the assistant named, in its order', () => {
        const found = [
            { key: 'JHN 14:6', ref: 'John 14:6', bible: 'KJV' },
            { key: 'PSA 23:1', ref: 'Psalms 23:1', bible: 'KJV' },
        ];
        expect(
            pickNamedVerses(found, 'Psalm 23:1, then John 14:6.', 'ពគប'),
        ).toEqual([
            { key: 'PSA 23:1', ref: 'Psalms 23:1', bible: 'ពគប' },
            { key: 'JHN 14:6', ref: 'John 14:6', bible: 'ពគប' },
        ]);
    });
});

// A Bible not in English carries each verse's reference as it writes it
// (`title`, from `owa_find_verse`), for a person who reads no English
// (2026-10-17, the elder-persona run).
describe('the reference as their Bible writes it', () => {
    const result = JSON.stringify({
        bible: 'ពគប',
        verses: [
            {
                key: 'MAT 5:44',
                ref: 'Matthew 5:44',
                title: 'ម៉ាថាយ ៥:៤៤',
                text: 'ប៉ុន្តែខ្ញុំប្រាប់ថា ត្រូវស្រឡាញ់ពួកខ្មាំងសត្រូវ',
            },
        ],
    });

    it('rides from the result to the button', () => {
        const found = readFoundVerses(result);
        expect(found).toEqual([
            {
                key: 'MAT 5:44',
                ref: 'Matthew 5:44',
                bible: 'ពគប',
                title: 'ម៉ាថាយ ៥:៤៤',
            },
        ]);
        expect(genVerseOpenActions(found, 'ម៉ាថាយ ៥:៤៤', 'ពគប')).toEqual([
            {
                label: 'Open Matthew 5:44 in Bible Lookup',
                toolName: VERSE_FIND_TOOL_NAME,
                args: { bible: 'ពគប', open: 'MAT 5:44', title: 'ម៉ាថាយ ៥:៤៤' },
            },
        ]);
    });

    it('names a verse in an answer that writes only the title', () => {
        const found = readFoundVerses(result);
        expect(
            pickNamedVerses(found, 'ខគម្ពីរនោះគឺ **ម៉ាថាយ ៥:៤៤**។', 'ពគប'),
        ).toHaveLength(1);
        // ...in 0-9 too.
        expect(
            pickNamedVerses(found, 'ខគម្ពីរនោះគឺ ម៉ាថាយ 5:44។', 'ពគប'),
        ).toHaveLength(1);
    });

    it('is shown in a window not in English, and the English otherwise', () => {
        const verse = { ref: 'Matthew 5:44', title: 'ម៉ាថាយ ៥:៤៤' };
        vi.stubGlobal('document', { documentElement: { lang: 'en' } });
        expect(toShownVerseRef(verse)).toBe('Matthew 5:44');
        vi.stubGlobal('document', { documentElement: { lang: 'km' } });
        expect(toShownVerseRef(verse)).toBe('ម៉ាថាយ ៥:៤៤');
        expect(toShownVerseRef({ ref: 'John 3:16' })).toBe('John 3:16');
        expect(
            describeVerseOpened(
                JSON.stringify({
                    opened: 'Matthew 5:44',
                    title: 'ម៉ាថាយ ៥:៤៤',
                    bible: 'ពគប',
                }),
            ),
        ).toContain('ម៉ាថាយ ៥:៤៤ (ពគប)');
        vi.unstubAllGlobals();
    });
});

// EC-300: a thank-you under a found verse is the window's to answer.
describe('genVerseFindThanksAnswer', () => {
    const found = [
        { author: 'you' as const },
        { author: 'bot' as const, verseFind: 'ពគប' },
    ];

    it('thanks back under a verse search', () => {
        expect(genVerseFindThanksAnswer(found, 'អរគុណច្រើន 🙏')).toContain(
            'You are welcome',
        );
    });

    it('leaves more words of the verse, and other answers, alone', () => {
        expect(
            genVerseFindThanksAnswer(
                found,
                'អត់មែនទេ ខ្ញុំគិតថានៅក្នុងគម្ពីរលូកាវិញ',
            ),
        ).toBeNull();
        expect(
            genVerseFindThanksAnswer(
                [{ author: 'you' as const }, { author: 'bot' as const }],
                'thank you',
            ),
        ).toBeNull();
    });
});

describe('where a search’s words gather', () => {
    // `owa_find_verse` for Noah and the dove in the Khmer Bible, 2026-10-22.
    const result = {
        bible: 'ពគប',
        total: 74,
        verses: [
            {
                key: 'GEN 8:11',
                ref: 'Genesis 8:11',
                text: 'ព្រាប​នោះ',
                title: 'លោកុប្បត្តិ ៨:១១',
            },
        ],
        next: 8,
        passages: [
            {
                ref: 'Genesis 7-9',
                key: 'GEN 8',
                verses: 30,
                title: 'លោកុប្បត្តិ ៧-៩',
                keyTitle: 'លោកុប្បត្តិ ៨',
            },
            { ref: 'broken', key: 'nothing' },
        ],
        byBook: [
            { book: 'Genesis', key: 'GEN', verses: 9, title: 'លោកុប្បត្តិ' },
            { book: 'Isaiah', key: 'ISA', verses: 2 },
        ],
    };

    it('reads a passage as the chapter its key opens', () => {
        expect(readFoundPassages(result, 'ពគប')).toEqual([
            {
                key: 'GEN 8',
                ref: 'Genesis 8',
                bible: 'ពគប',
                title: 'លោកុប្បត្តិ ៨',
                passage: {
                    ref: 'Genesis 7-9',
                    title: 'លោកុប្បត្តិ ៧-៩',
                    from: 7,
                    to: 9,
                },
            },
        ]);
        // The passages come first: a story is the place it is told.
        expect(
            readFoundVerses(JSON.stringify(result)).map((one) => {
                return one.key;
            }),
        ).toEqual(['GEN 8', 'GEN 8:11']);
    });

    it('gives a passage its button when the answer names a chapter of it', () => {
        const found = readFoundVerses(JSON.stringify(result));
        for (const answer of [
            'The flood is told in **Genesis 7-9**.',
            'Read Genesis 7 first.',
            'នៅក្នុង **លោកុប្បត្តិ ៦ ដល់ ៩**',
        ]) {
            expect(
                pickNamedVerses(found, answer, 'ពគប').map((one) => {
                    return one.key;
                }),
                answer,
            ).toEqual(['GEN 8']);
        }
        // A verse of it is the verse's button, not the passage's.
        expect(
            pickNamedVerses(found, 'See Genesis 8:11.', 'ពគប').map((one) => {
                return one.key;
            }),
        ).toEqual(['GEN 8:11']);
        // A chapter outside it is no name of it.
        expect(pickNamedVerses(found, 'Genesis 12 is Abram.', 'ពគប')).toEqual(
            [],
        );
    });

    it('gives a chapter named whole its button when a verse found is in it', () => {
        // The after-run of 2026-10-22: "told in: Luke 10", and a button for
        // Luke 10:33-34 alone.
        const found = readFoundVerses(
            JSON.stringify({
                bible: 'ពគប',
                verses: [
                    {
                        key: 'LUK 10:33',
                        ref: 'Luke 10:33',
                        text: 'សាសន៍​សាម៉ារី',
                        title: 'លូកា ១០:៣៣',
                    },
                ],
            }),
        );
        const named = pickNamedVerses(
            found,
            'The story is told in **លូកា ១០**. **លូកា ១០:៣៣** — …',
            'ពគប',
        );
        expect(
            named.map((one) => {
                return [one.key, one.title];
            }),
        ).toEqual([
            ['LUK 10', 'លូកា ១០'],
            ['LUK 10:33', 'លូកា ១០:៣៣'],
        ]);
        expect(genVerseOpenAction(named[0]).args).toEqual({
            bible: 'ពគប',
            open: 'LUK 10',
            title: 'លូកា ១០',
        });
    });

    it('says where they gather and how many each book holds', () => {
        expect(genVerseWhereLine(result, 'ពគប')).toBe(
            'These words gather in **Genesis 7-9**. By book: Genesis 9, ' +
                'Isaiah 2.',
        );
        expect(genVerseWhereLine({ bible: 'KJV', verses: [] }, 'KJV')).toBe('');
    });
});

describe('every verse with their words', () => {
    it('is offered under a search that found more than it shows', () => {
        expect(
            genHeadStartBrowseAction(
                [{ what: 'KJV', verses: [], total: 74 }],
                'shepherd',
                'KJV',
            ),
        ).toEqual([genVerseBrowseAction('KJV', 'shepherd')]);
        expect(
            genHeadStartBrowseAction(
                [
                    {
                        what: 'KJV',
                        verses: [{ key: 'A', ref: 'B', text: 'C' }],
                        total: 1,
                    },
                ],
                'x',
                'KJV',
            ),
        ).toEqual([]);
        expect(genHeadStartBrowseAction([], 'x', 'KJV')).toEqual([]);
    });
});

describe('a found verse of a one-chapter book named in an answer', () => {
    it('is named by the title its Bible gives it', () => {
        const found = [
            {
                key: 'JUD 1:3',
                ref: 'Jude 3',
                bible: 'ពគប',
                title: 'យូដាស ៣',
            },
        ];
        expect(
            pickNamedVerses(found, 'សូមអាន យូដាស ៣ ម្ដងទៀត។', 'ពគប'),
        ).toEqual([found[0]]);
        expect(pickNamedVerses(found, 'សូមអាន ម៉ាថាយ ៥។', 'ពគប')).toEqual([]);
    });
});
