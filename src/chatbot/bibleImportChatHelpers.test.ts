import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        // The language offer's two calls, apart from the Bible tool's queue.
        checkChatLanguage: vi.fn(),
        installChatLanguage: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
        openExternalURL: vi.fn(),
    };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => JSON.parse(text),
    };
});
vi.mock('./langInstallChatHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<object>()),
        checkChatLanguage: mocks.checkChatLanguage,
        installChatLanguage: mocks.installChatLanguage,
    };
});
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => {
    return { requestBibleImport: mocks.requestBibleImport };
});
vi.mock('../setting/settingHelpers', () => {
    return { openBibleSetting: mocks.openBibleSetting };
});
vi.mock('../server/appProvider', () => {
    return {
        default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
    };
});

import {
    BIBLE_IMPORT_MANUAL_ID,
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
    getBibleImportInputContext,
    checkBibleImportReplyNeedsHelp,
    readBibleImportHelpState,
    genBibleImportCheckAnswer,
    genBibleImportOfferAction,
    readBibleImportLanguageAsk,
    readBibleImportLinkAsk,
    readBibleImportTypedReply,
    runBibleImportStep,
    describeBibleImportStep,
    toBibleImportEcho,
    toFileLabel,
    type BibleImportStateType,
} from './bibleImportChatHelpers';
import { checkHasLangPackage } from '../test-setup/langPackageDirs';

const LINK =
    'https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml';

function pressByLabel(
    answer: { actions?: { label: string; args?: any }[] },
    label: string,
) {
    const action = answer.actions?.find((one) => {
        return one.label === label;
    });
    if (action === undefined) {
        throw new Error(
            `no "${label}" in ${answer.actions?.map((one) => one.label)}`,
        );
    }
    return runBibleImportStep(action.args as BibleImportStateType);
}

beforeEach(() => {
    mocks.callTool.mockReset();
    mocks.openExternalURL.mockReset();
    // No language to offer unless a test says so: a check that cannot be
    // made lets the import go on as it was.
    mocks.checkChatLanguage.mockReset().mockResolvedValue(null);
    mocks.installChatLanguage.mockReset().mockResolvedValue(true);
});

describe('readBibleImportLinkAsk', () => {
    it('takes the sample question and keeps the words around the link', () => {
        expect(
            readBibleImportLinkAsk(`Import bible from xml url ${LINK}`),
        ).toEqual({ url: LINK, find: 'Import bible from xml url' });
        expect(
            readBibleImportLinkAsk(
                'please add the Khmer bible from https://github.com/Beblia/Holy-Bible-XML-Format.',
            )?.url,
        ).toBe('https://github.com/Beblia/Holy-Bible-XML-Format');
    });
    it('leaves songs, two links, commands and bare links alone', () => {
        expect(
            readBibleImportLinkAsk('Create a lyric file from https://a.b/c'),
        ).toBeNull();
        expect(
            readBibleImportLinkAsk(`import bible ${LINK} and ${LINK}`),
        ).toBeNull();
        expect(readBibleImportLinkAsk(`/goto import bible ${LINK}`)).toBeNull();
        expect(readBibleImportLinkAsk(LINK)).toBeNull();
        expect(
            readBibleImportLinkAsk('import bible https://user:pw@a.b/x.xml'),
        ).toBeNull();
    });
});

describe('a step by step import, pressed through', () => {
    it('falls back to the file’s own names when the language has none', async () => {
        const step = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            title: 'Thai Standard Version',
            locales: [{ locale: 'th-TH', name: 'Thai' }],
            keys: ['THSV', 'THAI', 'TH-BIBLE'],
            takenKeys: ['THAI'],
        });
        // Thai is not a language this app holds names for: the normal
        // guessing, with no hover to explain an invented name.
        expect(step.actions?.map((one) => one.label)).toEqual([
            'THSV (suggested)',
            'TH-BIBLE',
            'Cancel',
        ]);
        expect(step.actions?.[0].title).toBeUndefined();
    });

    it('does not offer a short name this computer already has', async () => {
        const step = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            keys: ['KSV', 'KM1954', 'KHMER'],
            takenKeys: ['ksv'],
        });
        // Case does not make it a different name, so `ksv` hides `KSV`.
        expect(step.actions?.map((one) => one.label)).toEqual([
            'KM1954 (suggested)',
            'KHMER',
            'Cancel',
        ]);

        const none = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            keys: ['KSV'],
            takenKeys: ['KSV'],
        });
        expect(none.text).toContain(
            'Type one (letters and numbers, no spaces)',
        );
        expect(none.actions?.map((one) => one.label)).toEqual(['Cancel']);
    });

    it('a name already taken at install time goes back to step 1', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'key', message: 'taken' }),
        );
        const answer = await runBibleImportStep({
            step: 'import',
            draftId: 'he10paxbbz64',
            key: 'KSV',
            keys: ['KSV'],
            locale: 'km-KH',
        });
        expect(answer.text).toContain('already have a Bible by that name');
        expect(answer.text).toContain('Step 1');
    });
});

describe('links that do not lead to a Bible', () => {
    it('a page of files offers the files, never the tool’s own words', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 7,
                searchedFor: ['khmer'],
                files: [
                    {
                        name: 'KhmerBible.xml',
                        url: LINK,
                        title: 'Khmer Standard Version 1954 = Hammond Version',
                    },
                    {
                        name: 'Khmer2005Bible.xml',
                        url: LINK.replace('Bible', '2005Bible'),
                    },
                ],
                note: 'This is a page, not a Bible. Let the user pick a file, then call check with its url.',
            }),
        );
        const answer = await runBibleImportStep({
            step: 'check',
            url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
            find: 'khmer',
        });
        expect(answer.text).toContain(
            'Of its **998** Bibles, **7** have “khmer” in the name.',
        );
        // The file's own title, then its name; a file with no title its name.
        expect(answer.text).toContain(
            '1. Khmer Standard Version 1954 = Hammond Version — Khmer Bible',
        );
        expect(answer.text).toContain('2. Khmer 2005 Bible');
        expect(answer.text).not.toContain('call check');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            '1. Khmer Standard Version 1954 = Hammond Version',
            '2. Khmer 2005 Bible',
            'Cancel',
        ]);
        expect(answer.actions?.[0].args.url).toBe(LINK);
    });

    it('a dead link says how to find the right one', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'not-found', message: 'tool words' }),
        );
        const answer = await runBibleImportStep({ step: 'check', url: LINK });
        expect(answer.text).toContain('"not found"');
        expect(answer.text).toContain('press **Raw**');
        expect(answer.text).not.toContain('tool words');
    });

    it('a tool host that is down offers to retry, or the Settings form', async () => {
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        const answer = await runBibleImportStep({ step: 'check', url: LINK });
        expect(answer.text).toContain('Nothing was installed');
        expect(answer.text).not.toContain('host down');
        const settings = await pressByLabel(
            answer,
            'Do it in Settings instead',
        );
        expect(mocks.requestBibleImport).toHaveBeenCalledWith(LINK);
        expect(mocks.openBibleSetting).toHaveBeenCalled();
        expect(settings.text).toContain('Settings → Bible');
    });
});

describe('what is, and is not, somebody asking for a Bible', () => {
    const CATALOG = 'https://github.com/Beblia/Holy-Bible-XML-Format';

    it('a sentence about a verse, a list or the screen is left to the guide', () => {
        // Each of these used to search the collection for its own words.
        for (const text of [
            'add bible verse John 3:16 to my bible list',
            'put the bible verse on the screen',
            'use the bible reader',
            'download bible audio',
            'I want to read the bible',
            'add a bible note',
            'get the bible lookup',
            'load the bible slides',
            // "add" and "want" beside no language: about something else.
            'get bible commentary',
            'I need a bible for sunday',
            // A note's conversation, 2026-11-08: answered "You already have
            // the KJV" with the internet copy offered.
            'I want to change bible of english lines to be kjv',
            'switch the english bible lines to kjv',
            'I want to convert the bible verses to kjv',
        ]) {
            expect([text, readBibleImportLanguageAsk(text)]).toEqual([
                text,
                null,
            ]);
        }
    });

    it('a language beside "want", "need" or "add" is a Bible to look for', () => {
        expect(readBibleImportLanguageAsk('I want a Khmer bible')).toEqual({
            step: 'check',
            url: CATALOG,
            find: 'khmer',
        });
        expect(readBibleImportLanguageAsk('need thai bible')?.find).toBe(
            'thai',
        );
        expect(
            readBibleImportLanguageAsk('please add the French bible')?.find,
        ).toBe('french');
        // Nothing else said at all: which language?
        expect(readBibleImportLanguageAsk('add a bible')).toEqual({
            step: 'language',
        });
        expect(
            readBibleImportLanguageAsk('I want another bible version'),
        ).toEqual({ step: 'language' });
        expect(
            readBibleImportLanguageAsk('download a different bible'),
        ).toEqual({ step: 'language' });
    });

    it('a quoted place and the letters of a version find the language', () => {
        expect(
            readBibleImportLanguageAsk('Import a Bible in "korea"')?.find,
        ).toBe('korea');
        expect(readBibleImportLanguageAsk('import KJV bible')?.find).toBe(
            'english kj',
        );
    });

    // A country names its language through that language's own package
    // (`world.json`), so each runs while the package is on disk.
    it.runIf(checkHasLangPackage('km'))(
        'a country finds the language its package says it speaks',
        () => {
            expect(
                readBibleImportLanguageAsk('Import a Bible in Cambodia')?.find,
            ).toBe('khmer');
        },
    );

    it.runIf(checkHasLangPackage('zh'))(
        'a people finds the language its package says it speaks',
        () => {
            expect(
                readBibleImportLanguageAsk('install bible for China')?.find,
            ).toBe('chinese');
        },
    );

    it('"is there a Korean bible?" is a request; "is there a way…" a question', () => {
        expect(
            readBibleImportLanguageAsk('Do you have a Khmer bible?')?.find,
        ).toBe('khmer');
        expect(
            readBibleImportLanguageAsk('Are there any Thai bibles?')?.find,
        ).toBe('thai');
        expect(
            readBibleImportLanguageAsk('Is there a way to import a bible?'),
        ).toBeNull();
        expect(
            readBibleImportLanguageAsk('Is there a bible verse about love?'),
        ).toBeNull();
    });
});

describe('a Bible asked for by the name the app is looking for', () => {
    const CATALOG = 'https://github.com/Beblia/Holy-Bible-XML-Format';
    // What the Reader's "Bible key "KJV" is not available!" card asks with.
    const ASK = 'Import the Bible called "KJV"';

    it('is looked for by that name, and the name is kept', () => {
        expect(readBibleImportLanguageAsk(ASK)).toEqual({
            step: 'check',
            url: CATALOG,
            find: 'english kj',
            wantedKey: 'KJV',
        });
        // The way the window starts it: with no conversation yet.
        expect(findBibleImportState([], ASK)?.wantedKey).toBe('KJV');
        // In a conversation about one Bible note a typed line starts no
        // import, link or not: it is about the note.
        expect(findBibleImportState([], ASK, { isNoteAsk: true })).toBeNull();
        expect(
            findBibleImportState(
                [],
                'import bible from https://example.com/kjv.xml',
                { isNoteAsk: true },
            ),
        ).toBeNull();
        // A name the collection files nothing under is searched as it is.
        expect(
            readBibleImportLanguageAsk('Import the Bible called "NIV"'),
        ).toEqual({
            step: 'check',
            url: CATALOG,
            find: 'niv',
            wantedKey: 'NIV',
        });
        // One made of nothing to search by asks the language, name in hand.
        expect(
            readBibleImportLanguageAsk('Import the Bible called "NEW"'),
        ).toEqual({ step: 'language', wantedKey: 'NEW' });
        // The name is not what the sentence is about...
        expect(
            readBibleImportLanguageAsk('Import the Bible called "LIST"')
                ?.wantedKey,
        ).toBe('LIST');
        // ...and the rest of it still has to be a request.
        expect(
            readBibleImportLanguageAsk('What is the Bible called "KJV"'),
        ).toBeNull();
        expect(
            readBibleImportLanguageAsk('show the bible called KJV'),
        ).toBeNull();
    });

    it('stays with the import when the collection has no such name', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 0,
                searchedFor: ['niv'],
                files: [],
            }),
        );
        const none = await runBibleImportStep(
            readBibleImportLanguageAsk(
                'Import the Bible called "NIV"',
            ) as BibleImportStateType,
        );
        expect(none.text).toContain('None of them has “niv” in its name');
        // A language typed under that, a link pasted under it, and a dead
        // link's own two buttons all keep the name.
        expect(readBibleImportTypedReply(none.actions, 'Khmer')).toMatchObject({
            step: 'check',
            find: 'Khmer',
            wantedKey: 'NIV',
        });
        expect(readBibleImportTypedReply(none.actions, LINK)).toEqual({
            step: 'check',
            url: LINK,
            find: '',
            wantedKey: 'NIV',
        });
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'not-xml', message: 'tool words' }),
        );
        const dead = await runBibleImportStep({
            step: 'check',
            url: LINK,
            wantedKey: 'NIV',
        });
        expect(dead.actions?.map((one) => one.args.wantedKey)).toEqual([
            'NIV',
            'NIV',
        ]);
        const asked = await pressByLabel(dead, 'Look for a Bible by language');
        expect(
            asked.actions
                ?.filter((one) => one.args.step === 'check')
                .map((one) => one.args.wantedKey),
        ).toEqual(['NIV', 'NIV', 'NIV']);
    });
});

describe('typed instead of pressed', () => {
    it('a link pasted alone answers "which Bible?" and "paste it here"', async () => {
        const asked = await runBibleImportStep({ step: 'language' });
        expect(asked.text).toContain('paste it here');
        expect(
            findBibleImportState(
                [{ author: 'bot', actions: asked.actions }],
                LINK,
            ),
        ).toEqual({ step: 'check', url: LINK, find: '' });
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'not-xml', message: 'tool words' }),
        );
        const dead = await runBibleImportStep({ step: 'check', url: LINK });
        expect(dead.actions?.map((one) => one.label)).toEqual([
            'Look for a Bible by language',
            'Cancel',
        ]);
        expect(readBibleImportTypedReply(dead.actions, `<${LINK}>.`)).toEqual({
            step: 'check',
            url: LINK,
            find: '',
        });
        // Words under "paste the link" are not a link.
        expect(readBibleImportTypedReply(dead.actions, 'Khmer')).toBeNull();
        expect(
            readBibleImportTypedReply(
                dead.actions,
                'https://user:pw@a.b/x.xml',
            ),
        ).toBeNull();
    });
});

describe('a word the collection has no file for', () => {
    it('offers the languages it is close to, as buttons', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 0,
                searchedFor: ['kmer'],
                suggestions: ['Khmer'],
                files: [],
            }),
        );
        const url = 'https://github.com/Beblia/Holy-Bible-XML-Format';
        const answer = await runBibleImportStep({
            step: 'check',
            url,
            find: 'kmer',
        });
        expect(answer.text).toContain('None of them has “kmer”');
        expect(answer.text).toContain('Did you mean');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Khmer',
            'Cancel',
        ]);
        expect(answer.actions?.[0].args).toMatchObject({
            step: 'check',
            url,
            find: 'Khmer',
        });
        // Typing a language instead searches afresh, without "kmer".
        expect(readBibleImportTypedReply(answer.actions, 'Thai')).toMatchObject(
            { step: 'check', url, find: 'Thai' },
        );
    });

    it('with nothing close, asks again and takes a link', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 0,
                searchedFor: ['vietnamese'],
                files: [],
            }),
        );
        const answer = await runBibleImportStep({
            step: 'check',
            url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
            find: 'vietnamese',
        });
        expect(answer.text).toContain('Type the language');
        expect(answer.actions?.map((one) => one.label)).toEqual(['Cancel']);
        expect(readBibleImportTypedReply(answer.actions, LINK)?.url).toBe(LINK);
    });
});

it('an answer about importing a Bible offers to do it', () => {
    expect(genBibleImportOfferAction()).toEqual({
        label: 'Import a Bible for me',
        toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
        args: { step: 'language' },
    });
    expect(BIBLE_IMPORT_MANUAL_ID).toBe('W-34');
});

it('shows a file name as words', () => {
    expect(toFileLabel('Khmer2005Bible.xml')).toBe('Khmer 2005 Bible');
    expect(toFileLabel('EnglishKJBible.xml')).toBe('English KJ Bible');
    expect(toFileLabel('kjv_1611.xml')).toBe('kjv 1611');
});

it('echoes a choice without "(suggested)"', () => {
    expect(toBibleImportEcho('KSV (suggested)')).toBe('KSV');
    expect(toBibleImportEcho('KM1954')).toBe('KM1954');
});

describe('ordinary replies keep the waiting import state', () => {
    it('the model cannot agree, install, undo or open a window', () => {
        for (const step of [
            'agree',
            'import',
            'undo',
            'settings',
            'local-file',
            'source',
        ] as const) {
            const actions = [
                {
                    label: step,
                    toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                    args: { step },
                },
            ];
            expect(
                readBibleImportHelpState(actions, {
                    kind: 'choice',
                    choice: 1,
                }),
            ).toBeNull();
            expect(
                getBibleImportInputContext({ text: step, actions })?.choices[0]
                    .requiresPress ?? true,
            ).toBe(true);
        }
    });

    it.each(['１', '1?'])('reads a listed file number: %s', (typed) => {
        const actions = [
            {
                label: '1. Thai Bible',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: { step: 'check', url: LINK },
            },
        ];
        expect(readBibleImportTypedReply(actions, typed)).toEqual(
            actions[0].args,
        );
        expect(
            checkBibleImportReplyNeedsHelp(
                { text: 'Pick a file', actions },
                typed,
            ),
        ).toBe(false);
    });

    it.each(['huh'])(
        'interprets the short reply %s under choices that also allow a language correction',
        (typed) => {
            const actions = [
                {
                    label: 'List 1',
                    toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                    args: { step: 'confirm', locale: 'km-KH' },
                },
            ];
            expect(
                getBibleImportInputContext({ text: 'Which names?', actions })
                    ?.valueKind,
            ).toBe('language');
            expect(
                checkBibleImportReplyNeedsHelp(
                    { text: 'Which names?', actions },
                    typed,
                ),
            ).toBe(true);
        },
    );

    it('reads a short name from a polite reply without naming it after the sentence', () => {
        const actions = [
            {
                label: 'KJV2',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: {
                    step: 'locale',
                    awaits: 'key',
                    draftId: 'held',
                    wantedKey: 'KJV',
                },
            },
        ];
        expect(
            checkBibleImportReplyNeedsHelp(
                { text: 'Which short name?', actions },
                'call it THAI2',
            ),
        ).toBe(true);
        expect(
            readBibleImportHelpState(actions, {
                kind: 'value',
                value: 'THAI2',
            }),
        ).toMatchObject({
            step: 'key',
            typed: 'THAI2',
            draftId: 'held',
            wantedKey: 'KJV',
        });
    });
});

describe('the KJV Open Worship provides comes first', () => {
    const LIST_WITHOUT_KJV = { bibles: [], downloaded: [] };
    const LIST_WITH_KJV = {
        bibles: [{ key: 'KJV', title: 'King James Version' }],
        downloaded: [],
    };

    it('offers it before the language question, and going on still asks it', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(LIST_WITHOUT_KJV));
        const offer = await runBibleImportStep({ step: 'language' });
        expect(offer.text).toContain('Before another Bible');
        expect(offer.actions?.map((one) => one.label)).toEqual([
            'Create the provided KJV',
            'Import another Bible anyway',
            'Cancel',
        ]);
        const asked = await pressByLabel(offer, 'Import another Bible anyway');
        expect(asked.text).toContain('Which language do you want the Bible in');
    });

    it('creates it, then starts the import again from its first step', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(LIST_WITHOUT_KJV));
        const offer = await runBibleImportStep({ step: 'language' });
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ created: true, installed: true, key: 'KJV' }),
        );
        const after = await pressByLabel(offer, 'Create the provided KJV');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'create-kjv',
        });
        expect(after.text).toContain('Which language do you want the Bible in');
    });

    it('says they already have it when the KJV is installed', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(LIST_WITH_KJV));
        const answer = await runBibleImportStep({
            step: 'check',
            url: LINK,
            wantedKey: 'KJV',
        });
        expect(answer.text).toContain(
            'already have the KJV Open Worship provides',
        );
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Use the internet copy anyway',
        ]);
    });

    it('a failed creation offers Try again and changes nothing', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(LIST_WITHOUT_KJV));
        const offer = await runBibleImportStep({ step: 'language' });
        mocks.callTool.mockRejectedValueOnce(new Error('the host is away'));
        const failed = await pressByLabel(offer, 'Create the provided KJV');
        expect(failed.text).toContain('could not create the KJV');
        expect(failed.actions?.map((one) => one.label)).toEqual([
            'Try again',
            'Cancel',
        ]);
    });
});

// The answers a step gives when the tool answers otherwise: every problem a
// download can come back with, an install or a KJV that did not happen, a
// cancel the tool could not finish, and the KJV offer under a model's answer.
describe('when the tool answers otherwise', () => {
    const STATE = { step: 'check', url: LINK } as BibleImportStateType;

    it('says each problem a link can have in its own sentence', () => {
        const cases: [string, string][] = [
            ['not-found', 'the website answered "not found"'],
            ['denied', 'It may need a sign-in.'],
            ['busy', 'That website is busy right now.'],
            ['server', 'That website had a problem sending the file.'],
            ['blocked', 'a public web address that starts with https://'],
            ['unreachable', 'I could not reach that website.'],
            ['timeout', 'The download took too long and I stopped it.'],
            ['too-large', 'That file is far too large to be a Bible.'],
            ['empty', 'That link gave back an empty file.'],
            ['not-xml', 'A Bible file ends in .xml.'],
            ['not-bible', 'there is no Bible in it that this app can read'],
            ['page-without-files', 'there is no Bible file on it'],
            ['draft-gone', 'downloads are kept for two hours'],
            ['something-new', 'That link did not lead to a Bible.'],
        ];
        for (const [problem, words] of cases) {
            const answer = genBibleImportCheckAnswer({ problem }, STATE);
            expect(answer.text, problem).toContain(words);
        }
        // No answer at all is the website not being reached.
        expect(genBibleImportCheckAnswer(null, STATE).text).toContain(
            'I could not reach that website.',
        );
    });

    it('a problem worth trying again offers that; the rest say how to find the file', () => {
        const busy = genBibleImportCheckAnswer({ problem: 'busy' }, STATE);
        expect(busy.actions?.map((one) => one.label)).toEqual(['Try again']);
        expect(busy.actions?.[0].args).toMatchObject({
            step: 'check',
            url: LINK,
        });
        expect(busy.text).not.toContain('**Raw**');
        // Nothing to try again with.
        expect(
            genBibleImportCheckAnswer({ problem: 'timeout' }, {
                step: 'check',
            } as BibleImportStateType).actions,
        ).toEqual([]);
        const notXml = genBibleImportCheckAnswer({ problem: 'not-xml' }, STATE);
        expect(notXml.text).toContain('press **Raw**');
        expect(notXml.actions?.[0].label).toBe('Look for a Bible by language');
    });

    it('the steps that take a while say what they are waiting on', () => {
        const said = (step: string) => {
            return describeBibleImportStep({ step } as BibleImportStateType);
        };
        expect(said('check')).toBe('Downloading the Bible file and reading it');
        for (const step of ['locale-typed', 'more-names', 'names-url']) {
            expect(said(step), step).toBe(
                'Looking online for Bible book names — this can take a minute',
            );
        }
        expect(said('import')).toBe('Installing the Bible');
        expect(said('kjv-create')).toBe('Creating the provided KJV Bible');
        expect(said('undo')).toBe('Putting it back');
        expect(said('key')).toBeNull();
    });

    it('a file on this computer opens the Settings form; a step it does not know is said', async () => {
        // The installed list could not be read: the import is not held up.
        mocks.callTool.mockResolvedValueOnce('null');
        const local = await runBibleImportStep({
            step: 'local-file',
        } as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'list',
        });
        expect(mocks.openBibleSetting).toHaveBeenCalledTimes(1);
        expect(mocks.requestBibleImport).not.toHaveBeenCalled();
        expect(local.text).toContain('I opened **Settings → Bible**');
        expect(local.text).toContain('**Choose File**');

        const odd = await runBibleImportStep({
            step: 'nonsense',
            kjvChecked: true,
        } as unknown as BibleImportStateType);
        expect(odd.text).toBe('That step is not one I know.');
    });

    it('a cancel whose download cannot be let go still says nothing was installed', async () => {
        mocks.callTool.mockRejectedValueOnce(new Error('host gone'));
        const answer = await runBibleImportStep({
            step: 'cancel',
            draftId: 'd1',
        } as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'cancel',
            draftId: 'd1',
        });
        expect(answer.text).toBe('Stopped. Nothing was installed.');
    });

    it('an install the tool refused is said, and one with no answer changes nothing', async () => {
        const state = {
            step: 'import',
            url: LINK,
            draftId: 'd1',
            key: 'KSV',
            locale: 'km-KH',
            digits: 'local',
            kjvChecked: true,
        } as BibleImportStateType;
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'draft-gone' }),
        );
        const gone = await runBibleImportStep(state);
        expect(gone.text).toContain('downloads are kept for two hours');
        expect(gone.actions?.[0].label).toBe('Try again');

        mocks.callTool.mockResolvedValueOnce(JSON.stringify({}));
        const odd = await runBibleImportStep(state);
        expect(odd.text).toBe(
            'Something went wrong while installing it. Nothing was changed.',
        );
    });

    it('a KJV the app could not create offers to try again', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify({ isError: true }));
        const failed = await runBibleImportStep({
            step: 'kjv-create',
            wantsKjv: true,
        } as BibleImportStateType);
        expect(failed.text).toContain(
            'I could not create the KJV Open Worship provides',
        );
        expect(failed.actions?.map((one) => one.label)).toEqual([
            'Try again',
            'Cancel',
        ]);
        expect(failed.actions?.[0].args.step).toBe('kjv-create');
    });

    it('nothing typed, or a command, is no reply to a step', () => {
        expect(readBibleImportTypedReply([], '   ')).toBeNull();
        expect(readBibleImportTypedReply([], '/screen')).toBeNull();
    });

    it('a value for a step that waits for words or a link goes on with it', () => {
        const findAction = {
            label: 'Cancel',
            toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
            args: { step: 'cancel', awaits: 'find', wantedKey: 'KSV' },
        };
        expect(
            readBibleImportHelpState([findAction], {
                kind: 'value',
                value: 'Thai',
            }),
        ).toMatchObject({ step: 'check', find: 'Thai', wantedKey: 'KSV' });
        const linkAction = {
            ...findAction,
            args: { step: 'cancel', awaits: 'link', wantedKey: 'KSV' },
        };
        expect(
            readBibleImportHelpState([linkAction], {
                kind: 'value',
                value: LINK,
            }),
        ).toEqual({ step: 'check', url: LINK, wantedKey: 'KSV' });
        // Nothing waits for a value: there is no step to put it into.
        expect(
            readBibleImportHelpState(
                [{ ...findAction, args: { step: 'cancel' } }],
                { kind: 'value', value: 'Thai' },
            ),
        ).toBeNull();
        // A step waiting for a kind of value it has no step for.
        expect(
            readBibleImportHelpState(
                [{ ...findAction, args: { step: 'cancel', awaits: 'other' } }],
                { kind: 'value', value: 'Thai' },
            ),
        ).toBeNull();
    });

    it('more book names found online are added to the list, best first', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                nameLists: [
                    { id: 'n1', label: 'Known', first: ['Genesis'] },
                    {
                        id: 'n2',
                        label: 'Online',
                        first: ['Gen', 'Exo'],
                        own: ['Gen', 'Lev'],
                        matches: 5,
                    },
                ],
            }),
        );
        const answer = await runBibleImportStep({
            step: 'more-names',
            locale: 'km-KH',
            draftId: 'd1',
            kjvChecked: true,
            nameLists: [{ id: 'n1', label: 'Known', first: ['Genesis'] }],
        } as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'names',
            locale: 'km-KH',
            draftId: 'd1',
        });
        expect(answer.text).toContain('I found 1 more online.');
        // The new list leads: it matches more of this Bible's words, and
        // says the names only it has.
        expect(answer.text).toContain(
            '1. Online: Gen, Exo… Only this list says: Lev. (5 of its names ' +
                'are in this Bible)',
        );
        expect(answer.text).toContain('2. Known: Genesis…');
    });
});

// 2026-11-05, the user: _user input for french so chatbot should take a
// moment to help user install french first before proceed further step_.
describe("the Bible's language, installed first", () => {
    const CATALOG = 'https://github.com/Beblia/Holy-Bible-XML-Format';
    const MISSING = {
        state: 'missing',
        langCode: 'de',
        name: 'German',
        nativeName: 'Germanish',
        version: '0.0.6',
        size: 220_000,
    };
    const PAGE = JSON.stringify({
        kind: 'page',
        total: 998,
        matched: 1,
        searchedFor: ['german'],
        files: [{ name: 'GermanBible.xml', url: `${CATALOG}/German.xml` }],
    });

    it('a search of the collection by a language not installed asks first', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const answer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        expect(mocks.checkChatLanguage).toHaveBeenCalledWith('German');
        // Nothing downloaded or searched before the person has answered.
        expect(mocks.callTool).not.toHaveBeenCalled();
        expect(answer.text).toContain(
            '**Germanish (German) is not installed in this app yet.**',
        );
        expect(answer.text).toContain('a download of 0.2 MB');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Install it',
            'Not now',
        ]);
    });

    it('**Install it** installs, then searches as it was going to', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const offer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        mocks.callTool.mockResolvedValueOnce(PAGE);
        const done = await pressByLabel(offer, 'Install it');
        expect(mocks.installChatLanguage).toHaveBeenCalledWith('de');
        expect(done.text).toMatch(
            /^\*\*Done — Germanish \(German\) is ready\.\*\*/,
        );
        expect(done.text).toContain('“german” in the name');
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'check',
            url: CATALOG,
            find: 'German',
        });
        // Asked once: the file chosen next is not asked about again.
        expect(done.actions?.[0].args.langChecked).toBe('de');
        expect(mocks.checkChatLanguage).toHaveBeenCalledTimes(1);
    });

    it('**Not now** searches without it, and does not ask again', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const offer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        mocks.callTool.mockResolvedValueOnce(PAGE);
        const page = await pressByLabel(offer, 'Not now');
        expect(mocks.installChatLanguage).not.toHaveBeenCalled();
        expect(page.text).toContain('“german” in the name');
        expect(mocks.checkChatLanguage).toHaveBeenCalledTimes(1);
    });

    it('a language turned off is offered to turn on', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce({
            ...MISSING,
            state: 'turned-off',
        });
        const answer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        expect(answer.text).toContain('is installed but turned off');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Enable',
            'Not now',
        ]);
    });

    it('an installed language, or one nobody can check, asks nothing', async () => {
        for (const check of [{ state: 'installed', langCode: 'de' }, null]) {
            mocks.checkChatLanguage.mockResolvedValueOnce(check);
            mocks.callTool.mockResolvedValueOnce(PAGE);
            const answer = await runBibleImportStep({
                step: 'check',
                url: CATALOG,
                find: 'German',
            });
            expect(answer.text).toContain('“german” in the name');
        }
    });

    it('a failed install says so and keeps both ways on', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const offer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        mocks.installChatLanguage.mockResolvedValueOnce(false);
        const failed = await pressByLabel(offer, 'Install it');
        expect(failed.text).toContain(
            'I could not install Germanish (German). Nothing was changed.',
        );
        expect(failed.text).toContain('Press **Install it** to try again');
        expect(failed.actions?.map((one) => one.label)).toEqual([
            'Install it',
            'Not now',
        ]);
        expect(mocks.callTool).not.toHaveBeenCalled();
    });

    it('a typed yes or no under the offer is its press', async () => {
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const offer = await runBibleImportStep({
            step: 'check',
            url: CATALOG,
            find: 'German',
        });
        expect(readBibleImportTypedReply(offer.actions, 'yes')?.step).toBe(
            'lang-install',
        );
        expect(readBibleImportTypedReply(offer.actions, 'no')).toMatchObject({
            step: 'check',
            langChecked: 'de',
        });
    });

    it('a language chosen at step 2 is offered before the numbers', async () => {
        const digitsState: BibleImportStateType = {
            step: 'digits',
            draftId: 'he10paxbbz64',
            key: 'GER',
            locale: 'de-DE',
            localeName: 'German',
            nameLists: [],
        };
        mocks.checkChatLanguage.mockResolvedValueOnce(MISSING);
        const offer = await runBibleImportStep(digitsState);
        expect(mocks.checkChatLanguage).toHaveBeenCalledWith('de-DE');
        expect(offer.text).toContain('is not installed in this app yet');
        // Installed: the book-name lists are read again, now with its own.
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ locale: 'de-DE', nameLists: [] }),
        );
        const installed = await pressByLabel(offer, 'Install it');
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'names',
            locale: 'de-DE',
            draftId: 'he10paxbbz64',
        });
        expect(installed.text).toContain('is ready.**');
        expect(mocks.checkChatLanguage).toHaveBeenCalledTimes(1);
        // Not now: straight on to the numbers, not asked again.
        const skipped = await pressByLabel(offer, 'Not now');
        expect(skipped.text).not.toContain('is not installed');
        expect(mocks.checkChatLanguage).toHaveBeenCalledTimes(1);
    });

    it('English is never offered', async () => {
        const answer = await runBibleImportStep({
            step: 'digits',
            locale: 'en-US',
            localeName: 'English',
            nameLists: [],
        });
        expect(mocks.checkChatLanguage).not.toHaveBeenCalled();
        expect(answer.text).not.toContain('is not installed');
    });

    it('says what it is doing while the language downloads', () => {
        expect(
            describeBibleImportStep({
                step: 'lang-install',
                langCode: 'de',
                langLabel: 'Germanish (German)',
            }),
        ).toBe('Installing Germanish (German) — this can take a minute');
    });
});

describe('the KJV offer, answered once', () => {
    it('a language pressed after **Import another Bible anyway** is not asked again', async () => {
        const answer = await runBibleImportStep({
            step: 'language',
            kjvChecked: true,
        });
        for (const action of (answer.actions ?? []).slice(0, 3)) {
            expect(action.args.kjvChecked, action.label).toBe(true);
        }
        const fresh = await runBibleImportStep({
            step: 'language',
            kjvChecked: true,
        });
        expect(fresh.text).toContain(
            'Which language do you want the Bible in?',
        );
    });
});
