import { describe, expect, it, vi } from 'vitest';

// The import conversation's own module comes along for its first state;
// these keep its app-side imports off a test with no window.
vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => {
    return { requestBibleImport: vi.fn() };
});
vi.mock('../setting/settingHelpers', () => {
    return { openBibleSetting: vi.fn() };
});
vi.mock('../server/appProvider', () => {
    return { default: { browserUtils: { openExternalURL: vi.fn() } } };
});
vi.mock('./mcpClient', () => {
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

import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
} from './bibleImportChatHelpers';
import { NOT_IN_LANGUAGE_REASON } from '../helper/bibleVerseFindHelpers';
import { readVerseFindAsk } from '../helper/ai/verseFindAskHelpers';
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
    readVerseFindThread,
    readVerseFindTypedPick,
    getVerseFindInputChoices,
    runVerseFindStep,
    toVerseFindAsk,
    toShownVerseRef,
    genVerseFindThanksAnswer,
    toVerseWebSearchUrl,
    EVERY_VERSE_LABEL,
    MORE_VERSES_LABEL,
    genHeadStartBrowseAction,
    genVerseBrowseAction,
    genVerseWhereLine,
    readFoundPassages,
} from './verseFindChatHelpers';

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
    it('lists the Bibles, the one in Find first and marked', async () => {
        const call = genCall(BIBLES);
        const answer = await runVerseFindStep(
            { step: 'bible', preferred: 'KHOV', isFromFind: true },
            call,
        );
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {});
        expect(answer.text).toContain('Which Bible should I search?');
        expect(answer.verseFind).toBeUndefined();
        expect(
            answer.actions?.map((action) => {
                return action.label;
            }),
        ).toEqual([
            'KHOV — Khmer Old Version (the one in Find)',
            'KJV — King James Version',
            'LSG — Louis Segond 1910',
        ]);
        expect(answer.actions?.[0]).toMatchObject({
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'remember', bible: 'KHOV' },
        });
    });

    it('marks nothing when Find did not ask', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible', preferred: 'LSG' },
            genCall(BIBLES),
        );
        expect(answer.actions?.[0].label).toBe('LSG — Louis Segond 1910');
    });

    it('goes straight on with the only Bible there is', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall({ bible: 'KJV', bibles: [BIBLES.bibles[0]] }),
        );
        expect(answer.text).toContain('one Bible on this computer');
        expect(answer.text).toContain('What do you remember');
        expect(answer.verseFind).toBe('KJV');
    });

    it('offers the import when no Bible is installed', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall(
                new Error(
                    'No Bible is installed on this computer, so there is ' +
                        'nothing to search.',
                ),
            ),
        );
        expect(answer.actions).toEqual([
            {
                label: 'Import a Bible for me',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: findBibleImportState([], 'Import bible'),
            },
        ]);
    });

    it('says the app could not be read, never the tool’s words', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible' },
            genCall(new Error('The app has no open page matching "x.html"')),
        );
        expect(answer.text).not.toContain('x.html');
        expect(answer.text).toContain('main window');
    });

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

describe('what they remember', () => {
    it('asks it with the Bible stamped on the answer', async () => {
        const answer = await runVerseFindStep({
            step: 'remember',
            bible: 'KJV',
            title: 'King James Version',
        });
        expect(answer.text).toContain('**KJV — King James Version**');
        expect(answer.verseFind).toBe('KJV');
        expect(answer.actions).toEqual([
            {
                label: 'Search another Bible',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: { step: 'bible', current: 'KJV' },
            },
        ]);
    });

    it('keeps the tab searching until the line is about the app', () => {
        const messages = [
            { author: 'bot' as const, verseFind: 'KJV' },
            {
                author: 'bot' as const,
                isFollowUp: true as const,
            },
        ];
        expect(readVerseFindThread(messages, 'love enemies pray')).toBe('KJV');
        expect(
            readVerseFindThread(messages, 'no, it is a verse about sheep'),
        ).toBe('KJV');
        expect(
            readVerseFindThread(messages, 'put it on the screen'),
        ).toBeNull();
        expect(readVerseFindThread(messages, 'How do I save it?')).toBeNull();
        expect(readVerseFindThread(messages, '/commands')).toBeNull();
        expect(
            readVerseFindThread(
                [...messages, { author: 'bot' as const }],
                'love enemies',
            ),
        ).toBeNull();
    });

    it('asks the model with the Bible named in the ask', () => {
        const ask = toVerseFindAsk('  love enemies ', 'KHOV');
        expect(ask.startsWith('love enemies\n\n')).toBe(true);
        expect(ask).toContain('"KHOV"');
        expect(ask).toContain(VERSE_FIND_TOOL_NAME);
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

    it('says what a press opened, in words', () => {
        expect(
            describeVerseOpened(
                JSON.stringify({ opened: 'John 3:16', bible: 'KJV' }),
            ),
        ).toBe(
            '**Look at the app window.** John 3:16 (KJV) is open in the ' +
                'Bible Lookup. Nothing went on a screen.',
        );
        expect(describeVerseOpened('nope')).toContain('could not open');
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

    it('leaves out a search that failed', async () => {
        const parts = await genVerseHeadStart(
            'love enemies',
            'KJV',
            null,
            genCall(new Error('The app did not answer.')),
        );
        expect(parts).toEqual([]);
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
    it('searches the words and offers each verse', async () => {
        const call = genCall({
            bible: 'KJV',
            of: 2,
            total: 40,
            verses: [
                {
                    key: 'MAT 5:44',
                    ref: 'Matthew 5:44',
                    text: 'Love your enemies',
                    hits: 2,
                },
            ],
        });
        const answer = await answerVerseFindOffline(
            'love enemies',
            'KJV',
            call,
        );
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            words: 'love enemies',
        });
        expect(answer.text).toContain(
            '- **Matthew 5:44** _(2 of 2 words)_ — Love your enemies',
        );
        expect(answer.text).toContain('40 verses have some of them');
        expect(answer.text).toContain('search by meaning');
        expect(answer.actions?.[0].args).toEqual({
            bible: 'KJV',
            open: 'MAT 5:44',
        });
        expect(answer.verseFind).toBe('KJV');
    });

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

    it('names the words the Bible does not have, and the Google link', async () => {
        const answer = await answerVerseFindOffline(
            'lover enemy',
            'KJV',
            genCall({ bible: 'KJV', verses: [], notInBible: ['lover'] }),
        );
        expect(answer.text).toContain('No verse in KJV');
        expect(answer.text).toContain('not in it at all: lover');
        expect(answer.links).toEqual([
            'https://www.google.com/search?q=bible+verse+lover+enemy',
        ]);
        expect(answer.actions?.[0]).toMatchObject({
            label: 'Search another Bible',
            args: { step: 'bible', current: 'KJV', words: 'lover enemy' },
        });
        expect(answer.verseFind).toBe('KJV');
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

    it('carries only what a search can take, once, five at most', () => {
        const action = genVerseChangeBibleAction('KJV', 'x'.repeat(500), [
            ...FOUND,
            FOUND[0],
            { key: 'X'.repeat(40), ref: 'Long 1:1' },
            { key: 'PSA 23:1' } as any,
            { key: 'PSA 23:2', ref: 'Psalms 23:2', text: 'He maketh' },
            { key: 'PSA 23:3', ref: 'Psalms 23:3' },
            { key: 'PSA 23:4', ref: 'Psalms 23:4' },
            { key: 'PSA 23:5', ref: 'Psalms 23:5' },
        ]);
        expect(action.args.words).toHaveLength(200);
        expect(action.args.verses).toEqual([
            ...FOUND,
            { key: 'PSA 23:2', ref: 'Psalms 23:2' },
            { key: 'PSA 23:3', ref: 'Psalms 23:3' },
            { key: 'PSA 23:4', ref: 'Psalms 23:4' },
        ]);
    });

    it('lists every Bible but the one searched, carrying it all', async () => {
        const answer = await runVerseFindStep(
            {
                step: 'bible',
                current: 'KHOV',
                words: 'the way',
                verses: [FOUND[0]],
            },
            genCall(BIBLES),
        );
        expect(answer.text).toContain(
            'Which Bible should I show the verse in?',
        );
        expect(answer.actions).toEqual([
            {
                label: 'KJV — King James Version',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'remember',
                    bible: 'KJV',
                    title: 'King James Version',
                    words: 'the way',
                    verses: [FOUND[0]],
                },
            },
            {
                label: 'LSG — Louis Segond 1910',
                toolName: VERSE_FIND_STEP_TOOL_NAME,
                args: {
                    step: 'remember',
                    bible: 'LSG',
                    title: 'Louis Segond 1910',
                    words: 'the way',
                    verses: [FOUND[0]],
                },
            },
        ]);
        // Words typed instead of a pick go on searching the Khmer one.
        expect(answer.verseFind).toBe('KHOV');
        // And a typed pick carries the same.
        expect(
            readVerseFindTypedPick(
                [{ author: 'bot' as const, actions: answer.actions }],
                'lsg',
            ),
        ).toMatchObject({ bible: 'LSG', verses: [FOUND[0]] });
        const several = await runVerseFindStep(
            { step: 'bible', current: 'KJV', verses: FOUND },
            genCall(BIBLES),
        );
        expect(several.text).toContain(
            'Which Bible should I show the verses in?',
        );
        const none = await runVerseFindStep(
            { step: 'bible', current: 'KJV', words: 'the way' },
            genCall(BIBLES),
        );
        expect(none.text).toContain('Which Bible should I search?');
    });

    it('offers the import when the one searched is all there is', async () => {
        const answer = await runVerseFindStep(
            { step: 'bible', current: 'KJV', verses: FOUND },
            genCall({ bible: 'KJV', bibles: [BIBLES.bibles[0]] }),
        );
        expect(answer.text).toContain('KJV is the only Bible on this computer');
        expect(answer.actions).toEqual([
            {
                label: 'Import a Bible for me',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: findBibleImportState([], 'Import bible'),
            },
        ]);
        expect(answer.verseFind).toBe('KJV');
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

    it('asks what they remember when the verses cannot be read', async () => {
        const answer = await runVerseFindStep(
            { step: 'remember', bible: 'LSG', verses: FOUND },
            genCall(new Error('The app did not answer.')),
        );
        expect(answer.text).toContain('I could not read those verses in LSG.');
        expect(answer.text).toContain('What do you remember');
        expect(answer.verseFind).toBe('LSG');
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
    const page = (from: number, next?: number) => {
        return {
            bible: 'KJV',
            total: 10,
            ...(from > 0 ? { from } : {}),
            verses: Array.from({ length: from === 0 ? 8 : 2 }, (_, index) => {
                const verse = from + index + 1;
                return {
                    key: `JHN 10:${verse}`,
                    ref: `John 10:${verse}`,
                    text: 'the shepherd',
                };
            }),
            ...(next === undefined ? {} : { next }),
            passages: [{ ref: 'John 10', key: 'JHN 10', verses: 10 }],
        };
    };

    it('is a step of its own, a page at a time, with no model', async () => {
        const action = genVerseBrowseAction('KJV', ' shepherd ');
        expect(action).toEqual({
            label: EVERY_VERSE_LABEL,
            toolName: VERSE_FIND_STEP_TOOL_NAME,
            args: { step: 'more', bible: 'KJV', words: 'shepherd', from: 0 },
        });
        const call = genCall(page(0, 8));
        const answer = await runVerseFindStep(action.args as any, call);
        expect(call).toHaveBeenCalledWith(VERSE_FIND_TOOL_NAME, {
            bible: 'KJV',
            words: 'shepherd',
            from: 0,
        });
        expect(answer.text).toContain(
            'Verses 1 to 8 of 10 in KJV that have your words:',
        );
        expect(answer.text).toContain('These words gather in **John 10**.');
        expect(answer.verseFind).toBe('KJV');
        const more = answer.actions?.find((one) => {
            return one.label === MORE_VERSES_LABEL;
        });
        expect(more?.args).toEqual({
            step: 'more',
            bible: 'KJV',
            words: 'shepherd',
            from: 8,
        });
        // Five buttons to open, then the next page, then another Bible.
        expect(answer.actions).toHaveLength(7);
    });

    it('says when that was every verse, or all a search reaches', async () => {
        const last = await runVerseFindStep(
            { step: 'more', bible: 'KJV', words: 'shepherd', from: 8 },
            genCall(page(8)),
        );
        expect(last.text).toContain('Verses 9 to 10 of 10');
        expect(last.text).toContain(
            'That is every verse in KJV with those words.',
        );
        expect(
            last.actions?.some((one) => {
                return one.label === MORE_VERSES_LABEL;
            }),
        ).toBe(false);
        const none = await runVerseFindStep(
            { step: 'more', bible: 'KJV', words: 'shepherd', from: 300 },
            genCall({ bible: 'KJV', total: 400, verses: [] }),
        );
        expect(none.text).toBe('No more verses in KJV have those words.');
    });

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
