import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
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
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => {
    return { requestBibleImport: mocks.requestBibleImport };
});
vi.mock('../setting/settingHelpers', () => {
    return { openBibleSetting: mocks.openBibleSetting };
});

import {
    BIBLE_IMPORT_MANUAL_ID,
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
    genBibleImportCheckAnswer,
    genBibleImportOfferAction,
    readBibleImportLanguageAsk,
    readBibleImportLinkAsk,
    readBibleImportTypedReply,
    runBibleImportStep,
    toBibleImportEcho,
    toFileLabel,
    type BibleImportStateType,
} from './bibleImportChatHelpers';

const LINK =
    'https://github.com/Beblia/Holy-Bible-XML-Format/raw/refs/heads/master/KhmerBible.xml';

// The tool's answer for the sample link, as measured live on 2026-10-06.
const CHECKED = {
    kind: 'xml',
    draftId: 'he10paxbbz64',
    title: 'Khmer Standard Version 1954 = Hammond Version',
    books: 66,
    chapters: 1189,
    verses: 31102,
    keys: ['KSV', 'KM1954', 'KHMER', 'KM-BIBLE'],
    takenKeys: ['QA_KHMER_XML'],
    locales: [
        {
            locale: 'km-KH',
            name: 'Khmer (Cambodia)',
            why: 'the file name says so and the verses are written in Khmer script',
        },
    ],
    digits: {
        local: '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩',
        ascii: '0 1 2 3 4 5 6 7 8 9',
    },
    nameLists: [
        {
            id: 'nc4e26c5e',
            label: 'Khmer names (គខប)',
            first: ['លោកុប្បត្តិ', 'និក្ខមនំ', 'លេវីវិន័យ', 'ជនគណនា'],
            matches: 44,
        },
        {
            id: 'n7f91d3cb',
            label: 'Khmer names (អគត)',
            first: ['កំណើតពិភពលោក', 'សេរីភាព', 'លេវីវិន័យ', 'ជំរឿនប្រជាជន'],
            matches: 22,
        },
        {
            id: 'n2cffd0e6',
            label: 'English names (the file has none of its own)',
            first: ['Genesis', 'Exodus', 'Leviticus', 'Numbers'],
            matches: 0,
        },
    ],
};

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
    it('downloads, asks four things, then installs with what was pressed', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(CHECKED));
        const first = await runBibleImportStep({ step: 'check', url: LINK });
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'check',
            url: LINK,
        });
        expect(first.text).toContain(
            'Khmer Standard Version 1954 = Hammond Version',
        );
        expect(first.text).toContain('31,102 verses');
        expect(first.text).toContain('Step 1 of 4');
        expect(first.actions?.map((one) => one.label)).toEqual([
            'KSV (suggested)',
            'KM1954',
            'KHMER',
            'KM-BIBLE',
            'Cancel',
        ]);
        expect(
            first.actions?.every((one) => {
                return one.toolName === BIBLE_IMPORT_STEP_TOOL_NAME;
            }),
        ).toBe(true);

        const second = await pressByLabel(first, 'KSV (suggested)');
        expect(second.text).toContain('Step 2 of 4');
        expect(second.text).toContain('Khmer (Cambodia)');
        expect(second.text).toContain('written in Khmer script');

        const third = await pressByLabel(
            second,
            'Khmer (Cambodia) (suggested)',
        );
        expect(third.text).toContain('Step 3 of 4');
        expect(third.actions?.[0].label).toBe(
            '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ (suggested)',
        );

        const fourth = await pressByLabel(
            third,
            '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ (suggested)',
        );
        expect(fourth.text).toContain('Step 4 of 4');
        expect(fourth.text).toContain('1. Khmer names (គខប): លោកុប្បត្តិ');
        expect(fourth.text).toContain('3. English names');
        expect(fourth.text).toContain('44 of its names are in this Bible');

        const confirm = await pressByLabel(fourth, 'List 1 (suggested)');
        expect(confirm.text).toContain('Name: **KSV**');
        expect(confirm.text).toContain('Numbers: ០ ១ ២');
        expect(confirm.text).toContain('លោកុប្បត្តិ');
        expect(mocks.callTool).toHaveBeenCalledTimes(1);

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                installed: 'KSV',
                undoId: '20261006-173416077-qm5s',
            }),
        );
        const done = await pressByLabel(confirm, 'Install it');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'import',
            draftId: 'he10paxbbz64',
            key: 'KSV',
            locale: 'km-KH',
            digits: 'local',
            bookNames: 'nc4e26c5e',
        });
        expect(done.text).toContain('KSV is installed');

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ undone: 'Installed the Bible “KSV”' }),
        );
        const undone = await pressByLabel(done, 'Undo');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_undo', {
            action: 'undo',
            id: '20261006-173416077-qm5s',
        });
        expect(undone.text).toContain('KSV');
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

describe('typing instead of pressing', () => {
    function lastActions() {
        return genBibleImportCheckAnswer(CHECKED, {
            step: 'check',
            url: LINK,
        }).actions;
    }

    it('a short name of their own is the key; a taken one is asked again', async () => {
        const state = readBibleImportTypedReply(lastActions(), 'KSV2005');
        expect(state?.step).toBe('key');
        const next = await runBibleImportStep(state as BibleImportStateType);
        expect(next.text).toContain('Step 2 of 4');
        const again = await runBibleImportStep(
            readBibleImportTypedReply(
                lastActions(),
                'qa_khmer_xml',
            ) as BibleImportStateType,
        );
        expect(again.text).toContain('already have a Bible called');
        expect(again.text).toContain('Step 1 of 4');
        const spaced = await runBibleImportStep(
            readBibleImportTypedReply(
                lastActions(),
                'my bible',
            ) as BibleImportStateType,
        );
        expect(spaced.text).toContain('has a space in it');
    });

    it('a question or a link is not an answer to the step', () => {
        expect(
            readBibleImportTypedReply(lastActions(), 'what is a key?'),
        ).toBeNull();
        expect(readBibleImportTypedReply(lastActions(), LINK)).toBeNull();
        expect(readBibleImportTypedReply(undefined, 'KSV')).toBeNull();
    });

    it('only the LAST answer in the tab is continued', () => {
        const messages = [
            { author: 'bot', actions: lastActions() },
            { author: 'you' },
            { author: 'bot', actions: [] },
        ];
        expect(findBibleImportState(messages, 'KSV2')).toBeNull();
        expect(findBibleImportState(messages.slice(0, 1), 'KSV2')?.step).toBe(
            'key',
        );
        expect(
            findBibleImportState(messages, `Import bible from xml url ${LINK}`)
                ?.step,
        ).toBe('check');
    });

    it('a language by name is looked up, and a wrong one asked again', async () => {
        const atLocale = {
            ...lastActions()![0].args,
            awaits: 'locale',
        } as BibleImportStateType;
        mocks.callTool.mockRejectedValueOnce(new Error('unknown'));
        const unknown = await runBibleImportStep(
            readBibleImportTypedReply(
                [
                    {
                        label: 'x',
                        toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                        args: atLocale,
                    },
                ],
                'Klingon',
            ) as BibleImportStateType,
        );
        expect(unknown.text).toContain('I do not know the language “Klingon”');
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ locale: 'fr-FR', nameLists: [] }),
        );
        const french = await runBibleImportStep(
            readBibleImportTypedReply(
                [
                    {
                        label: 'x',
                        toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                        args: atLocale,
                    },
                ],
                'French',
            ) as BibleImportStateType,
        );
        // French writes 0-9: no digits question, straight to the names.
        expect(french.text).toContain('Step 3 of 3 — book names');
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

    it('asking for a Bible by language searches the catalog, or asks which language', async () => {
        expect(readBibleImportLanguageAsk('Import bible for khmer')).toEqual({
            step: 'check',
            url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
            find: 'khmer',
        });
        expect(readBibleImportLanguageAsk('install a ខ្មែរ bible')?.find).toBe(
            'khmer',
        );
        expect(readBibleImportLanguageAsk('Import bible')).toEqual({
            step: 'language',
        });
        // A request with a question mark is still a request...
        expect(
            readBibleImportLanguageAsk('Can you install a Bible for me?'),
        ).toEqual({ step: 'language' });
        // ...and the corpus template, with its example language.
        expect(
            readBibleImportLanguageAsk('Import a Bible in "Khmer"')?.find,
        ).toBe('khmer');
        expect(
            readBibleImportLanguageAsk('import a bible from my computer'),
        ).toEqual({ step: 'local-file' });
        // A question is answered from the guide; a link is the link's.
        expect(
            readBibleImportLanguageAsk('How do I import a bible?'),
        ).toBeNull();
        expect(readBibleImportLanguageAsk(`import bible ${LINK}`)).toBeNull();
        const asked = await runBibleImportStep({ step: 'language' });
        expect(asked.text).toContain('Which language');
        expect(asked.actions?.map((one) => one.label)).toEqual([
            'Khmer',
            'English',
            'French',
            'A file on this computer',
        ]);
        // A language TYPED under that question searches the catalog for it.
        const typed = findBibleImportState(
            [{ author: 'bot', actions: asked.actions }],
            'Thai',
        );
        expect(typed).toMatchObject({ step: 'check', find: 'Thai' });
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 0,
                searchedFor: ['thai'],
                files: [],
            }),
        );
        await runBibleImportStep(typed as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'check',
            url: 'https://github.com/Beblia/Holy-Bible-XML-Format',
            find: 'Thai',
        });
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

    it('a country, a people and the letters of a version find the language', () => {
        expect(
            readBibleImportLanguageAsk('Import a Bible in Cambodia')?.find,
        ).toBe('khmer');
        expect(
            readBibleImportLanguageAsk('Import a Bible in "korea"')?.find,
        ).toBe('korea');
        expect(
            readBibleImportLanguageAsk('install bible for China')?.find,
        ).toBe('chinese');
        expect(readBibleImportLanguageAsk('import KJV bible')?.find).toBe(
            'english kj',
        );
    });

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
    const ENGLISH = {
        ...CHECKED,
        title: 'English King James Version',
        keys: ['EKJV', 'EN1769', 'KJ'],
        takenKeys: ['KSV'],
    };

    it('is looked for by that name, and the name is kept', () => {
        expect(readBibleImportLanguageAsk(ASK)).toEqual({
            step: 'check',
            url: CATALOG,
            find: 'english kj',
            wantedKey: 'KJV',
        });
        // The way the window starts it: with no conversation yet.
        expect(findBibleImportState([], ASK)?.wantedKey).toBe('KJV');
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

    it('is the first short name offered, and the answer says why', async () => {
        const state = readBibleImportLanguageAsk(ASK) as BibleImportStateType;
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 1,
                searchedFor: ['english', 'kj'],
                files: [{ name: 'EnglishKJBible.xml', url: LINK }],
            }),
        );
        const page = await runBibleImportStep(state);
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'check',
            url: CATALOG,
            find: 'english kj',
        });

        // Through the list of files, to the file.
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(ENGLISH));
        const first = await pressByLabel(page, '1. English KJ Bible');
        expect(first.actions?.map((one) => one.label)).toEqual([
            'KJV (suggested)',
            'EKJV',
            'EN1769',
            'KJ',
            'Cancel',
        ]);
        expect(first.text).toContain(
            'The app is looking for a Bible called **KJV**',
        );

        const second = await pressByLabel(first, 'KJV (suggested)');
        expect(second.actions?.[0].args.key).toBe('KJV');
        // "yes" is the suggested one: the name the app is waiting for.
        expect(readBibleImportTypedReply(first.actions, 'yes')).toMatchObject({
            step: 'locale',
            key: 'KJV',
        });
    });

    it('is offered once, however the file spells it', () => {
        const answer = genBibleImportCheckAnswer(
            { ...ENGLISH, keys: ['EKJV', 'kjv', 'KJ'] },
            { step: 'check', url: LINK, wantedKey: 'KJV' },
        );
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'KJV (suggested)',
            'EKJV',
            'KJ',
            'Cancel',
        ]);
    });

    it('is not offered when it is taken, or cannot be a short name', () => {
        const taken = genBibleImportCheckAnswer(
            { ...ENGLISH, takenKeys: ['kjv'] },
            { step: 'check', url: LINK, wantedKey: 'KJV' },
        );
        expect(taken.actions?.[0].label).toBe('EKJV (suggested)');
        expect(taken.text).not.toContain('The app is looking for');

        const unusable = genBibleImportCheckAnswer(ENGLISH, {
            step: 'check',
            url: LINK,
            wantedKey: 'K.J/V',
        });
        expect(unusable.actions?.[0].label).toBe('EKJV (suggested)');
        expect(unusable.text).not.toContain('The app is looking for');

        // A Bible they already have is found by choosing ITS name: the two
        // sentences would say opposite things.
        const owned = genBibleImportCheckAnswer(
            { ...ENGLISH, installedAs: 'EKJ' },
            { step: 'check', url: LINK, wantedKey: 'KJV' },
        );
        expect(owned.text).toContain('You already have this Bible');
        expect(owned.text).not.toContain('The app is looking for');
        // An ordinary import says nothing of it.
        expect(
            genBibleImportCheckAnswer(ENGLISH, { step: 'check', url: LINK })
                .text,
        ).not.toContain('The app is looking for');
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
    const PAGE = {
        kind: 'page',
        total: 998,
        matched: 2,
        searchedFor: ['khmer'],
        files: [
            { name: 'KhmerBible.xml', url: LINK, title: 'Khmer Standard' },
            {
                name: 'Khmer2005Bible.xml',
                url: LINK.replace('Bible', '2005Bible'),
                title: 'Khmer 2005',
                installedAs: 'គខប',
            },
        ],
    };
    const CATALOG = 'https://github.com/Beblia/Holy-Bible-XML-Format';

    function pageActions() {
        return genBibleImportCheckAnswer(PAGE, {
            step: 'check',
            url: CATALOG,
            find: 'khmer',
        }).actions;
    }

    it('the number of a choice is that choice', async () => {
        expect(readBibleImportTypedReply(pageActions(), '2')).toMatchObject({
            step: 'check',
            url: LINK.replace('Bible', '2005Bible'),
        });
        expect(readBibleImportTypedReply(pageActions(), 'number 1.')?.url).toBe(
            LINK,
        );
        // A number no choice has narrows the search of the PAGE, as any
        // word does.
        expect(readBibleImportTypedReply(pageActions(), '2016')).toMatchObject({
            step: 'check',
            pageUrl: CATALOG,
            find: 'khmer 2016',
        });
        // "list 2" under the book names.
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(CHECKED));
        const first = await runBibleImportStep({ step: 'check', url: LINK });
        const names = await runBibleImportStep({
            ...(first.actions?.[0].args as BibleImportStateType),
            step: 'names',
            locale: 'km-KH',
            digits: 'local',
        });
        expect(
            readBibleImportTypedReply(names.actions, 'list 2'),
        ).toMatchObject({ step: 'confirm', bookNames: 'n7f91d3cb' });
    });

    it('"yes" takes what was suggested, "cancel" stops, a label is its button', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(CHECKED));
        const first = await runBibleImportStep({ step: 'check', url: LINK });
        // Not a Bible named "yes".
        expect(readBibleImportTypedReply(first.actions, 'yes')).toMatchObject({
            step: 'locale',
            key: 'KSV',
        });
        expect(readBibleImportTypedReply(first.actions, 'Cancel')?.step).toBe(
            'cancel',
        );
        expect(
            readBibleImportTypedReply(first.actions, 'km1954'),
        ).toMatchObject({ step: 'locale', key: 'KM1954' });
        const confirm = await runBibleImportStep({
            ...(first.actions?.[0].args as BibleImportStateType),
            step: 'confirm',
            key: 'KSV',
            locale: 'km-KH',
            digits: 'local',
            bookNames: 'nc4e26c5e',
        });
        expect(readBibleImportTypedReply(confirm.actions, 'ok')?.step).toBe(
            'import',
        );
        // Under a list of files "yes" says nothing about which: the list is
        // looked up again and drawn again, never the first file taken.
        expect(readBibleImportTypedReply(pageActions(), 'yes')).toMatchObject({
            step: 'check',
            pageUrl: CATALOG,
            find: 'khmer yes',
        });
    });

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

describe('a Bible they already have', () => {
    it('is marked in the list, and said before the first question', async () => {
        const page = genBibleImportCheckAnswer(
            {
                kind: 'page',
                total: 998,
                matched: 2,
                searchedFor: ['khmer'],
                files: [
                    { name: 'KhmerBible.xml', url: LINK, title: 'Khmer 1954' },
                    {
                        name: 'Khmer2005Bible.xml',
                        url: LINK.replace('Bible', '2005Bible'),
                        title: 'Khmer 2005',
                        installedAs: 'គខប',
                    },
                ],
            },
            {
                step: 'check',
                url: 'https://github.com/Beblia/x',
                find: 'khmer',
            },
        );
        expect(page.text).toContain('1. Khmer 1954 — Khmer Bible\n');
        expect(page.text).toContain(
            '2. Khmer 2005 — Khmer 2005 Bible — **you already have this one** (គខប)',
        );
        const checked = genBibleImportCheckAnswer(
            { ...CHECKED, installedAs: 'គខប' },
            { step: 'check', url: LINK },
        );
        expect(checked.text).toContain('**You already have this Bible**');
        expect(checked.text).toContain('installed as **គខប**');
        // ...and still a choice: a second copy under another name.
        expect(checked.text).toContain('Step 1 of 4');
        expect(
            genBibleImportCheckAnswer(CHECKED, { step: 'check', url: LINK })
                .text,
        ).not.toContain('already have');
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
