import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
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
    genBibleImportContextHint,
    checkBibleImportReplyNeedsHelp,
    readBibleImportHelpState,
    genBibleImportCheckAnswer,
    genBibleImportOfferAction,
    genBibleImportUnderAnswer,
    readBibleImportLanguageAsk,
    readBibleImportLinkAsk,
    readBibleImportTypedReply,
    runBibleImportStep,
    describeBibleImportStep,
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

// Past the notice a downloaded Bible opens on, to step 1.
function agreeTo(answer: { actions?: { label: string; args?: any }[] }) {
    return pressByLabel(answer, 'I agree');
}

beforeEach(() => {
    mocks.callTool.mockReset();
    mocks.openExternalURL.mockReset();
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
        const notice = await runBibleImportStep({ step: 'check', url: LINK });
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'check',
            url: LINK,
        });
        expect(notice.text).toContain(
            'Khmer Standard Version 1954 = Hammond Version',
        );
        expect(notice.text).toContain('31,102 verses');
        // Agreed to before any question.
        expect(notice.text).not.toContain('Step 1');
        expect(notice.actions?.[0].label).toBe('I agree');
        const first = await agreeTo(notice);
        expect(first.text).toContain('Step 1 of 4');
        // The options are the names KHMER knows a Bible by, not the file's.
        expect(first.actions?.map((one) => one.label)).toEqual([
            'ពគប (suggested)',
            'គខប',
            'គកស១៦',
            'អគត',
            'Cancel',
        ]);
        expect(
            first.actions?.every((one) => {
                return one.toolName === BIBLE_IMPORT_STEP_TOOL_NAME;
            }),
        ).toBe(true);

        const second = await pressByLabel(first, 'ពគប (suggested)');
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
        expect(confirm.text).toContain('Name: **ពគប**');
        expect(confirm.text).toContain('Numbers: ០ ១ ២');
        expect(confirm.text).toContain('លោកុប្បត្តិ');
        expect(mocks.callTool).toHaveBeenCalledTimes(1);

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                installed: 'ពគប',
                undoId: '20261006-173416077-qm5s',
            }),
        );
        const done = await pressByLabel(confirm, 'Install it');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'import',
            draftId: 'he10paxbbz64',
            key: 'ពគប',
            locale: 'km-KH',
            digits: 'local',
            bookNames: 'nc4e26c5e',
        });
        expect(done.text).toContain('ពគប is installed');
        expect(done.actions?.map((one) => one.label)).toEqual([
            'Undo',
            'Add another Bible',
        ]);

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ undone: 'Installed the Bible “ពគប”' }),
        );
        const undone = await pressByLabel(done, 'Undo');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_undo', {
            action: 'undo',
            id: '20261006-173416077-qm5s',
        });
        expect(undone.text).toContain('ពគប');

        // A service often needs more than one Bible: the finished import
        // offers another, started clean at the language question.
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ bibles: [{ key: 'KJV' }] }),
        );
        const another = await pressByLabel(done, 'Add another Bible');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'list',
        });
        expect(another.text).toContain(
            'Which language do you want the Bible in',
        );
        expect(another.actions?.map((one) => one.label)).toEqual([
            'Khmer',
            'English',
            'French',
            'A file on this computer',
        ]);
    });

    it('offers the names the BIBLE’s language knows, named on hover', async () => {
        const step = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            title: 'Khmer 2012 (Khmer Christian Bible)',
            locales: [{ locale: 'km-KH', name: 'Khmer (Cambodia)' }],
            keys: ['KM2012', 'KHMER2012', 'KHMER'],
            takenKeys: [],
        });
        // The language's own keys are the options -- KCB first because the
        // file's title names it -- never the file's invented ones.
        expect(step.actions?.map((one) => one.label)).toEqual([
            'KCB (suggested)',
            'ពគប',
            'គខប',
            'គកស១៦',
            'Cancel',
        ]);
        expect(step.actions?.[0].title).toBe('Khmer Christian Bible');
        expect(step.actions?.[1].title).toBe('ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤');
        // Cancel is not a Bible name at all.
        expect(step.actions?.at(-1)?.title).toBeUndefined();
    });

    it('offers the language’s key even when the file title names nothing', async () => {
        const step = await runBibleImportStep({
            step: 'key',
            draftId: 'he10paxbbz64',
            title: 'French (NBS) 2002 (Nouvelle Bible Segond)',
            locales: [{ locale: 'fr-FR', name: 'French (France)' }],
            keys: ['NBS', 'FRNBS'],
            takenKeys: [],
        });
        expect(step.actions?.map((one) => one.label)).toEqual([
            'LSG (suggested)',
            'Cancel',
        ]);
        expect(step.actions?.[0].title).toBe('La Sainte Bible, Louis Segond');
    });

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

describe('typing instead of pressing', () => {
    // Step 1's buttons, past the notice.
    async function lastActions() {
        return (
            await agreeTo(
                genBibleImportCheckAnswer(CHECKED, {
                    step: 'check',
                    url: LINK,
                }),
            )
        ).actions;
    }

    it('a short name of their own is the key; a taken one is asked again', async () => {
        const state = readBibleImportTypedReply(await lastActions(), 'KSV2005');
        expect(state?.step).toBe('key');
        const next = await runBibleImportStep(state as BibleImportStateType);
        expect(next.text).toContain('Step 2 of 4');
        const again = await runBibleImportStep(
            readBibleImportTypedReply(
                await lastActions(),
                'qa_khmer_xml',
            ) as BibleImportStateType,
        );
        expect(again.text).toContain('already have a Bible called');
        expect(again.text).toContain('Step 1 of 4');
        const spaced = await runBibleImportStep(
            readBibleImportTypedReply(
                await lastActions(),
                'my bible',
            ) as BibleImportStateType,
        );
        expect(spaced.text).toContain('has a space in it');
    });

    it('a question or a link is not an answer to the step', async () => {
        expect(
            readBibleImportTypedReply(await lastActions(), 'what is a key?'),
        ).toBeNull();
        expect(readBibleImportTypedReply(await lastActions(), LINK)).toBeNull();
        expect(readBibleImportTypedReply(undefined, 'KSV')).toBeNull();
    });

    it('only the LAST answer in the tab is continued', async () => {
        const messages = [
            { author: 'bot', actions: await lastActions() },
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
            ...(await lastActions())![0].args,
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
        locales: [
            {
                locale: 'en-US',
                name: 'English (United States)',
                why: 'the file name says so',
            },
        ],
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
        // The app's own KJV is missing: the provided one is offered before
        // any file is downloaded. The internet copy is still allowed.
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ bibles: [], downloaded: [] }),
        );
        const offer = await runBibleImportStep(state);
        expect(offer.text).toContain('Open Worship provides the KJV Bible');
        expect(offer.actions?.map((one) => one.label)).toEqual([
            'Create the provided KJV',
            'Use the internet copy anyway',
            'Cancel',
        ]);

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 998,
                matched: 1,
                searchedFor: ['english', 'kj'],
                files: [{ name: 'EnglishKJBible.xml', url: LINK }],
            }),
        );
        const page = await pressByLabel(offer, 'Use the internet copy anyway');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'check',
            url: CATALOG,
            find: 'english kj',
        });

        // Through the list of files, to the file, past where it came from.
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(ENGLISH));
        const notice = await pressByLabel(page, '1. English KJ Bible');
        // Said beside the question it answers, not over the notice.
        expect(notice.text).not.toContain('The app is looking for');
        const first = await agreeTo(notice);
        // The names ENGLISH knows a Bible by, the one asked for first --
        // never the file's own EKJV / EN1769 / KJ.
        expect(first.actions?.map((one) => one.label)).toEqual([
            'KJV (suggested)',
            'NKJV',
            'NIV',
            'ESV',
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

    it('is offered once, however the file spells it', async () => {
        const answer = await agreeTo(
            genBibleImportCheckAnswer(
                { ...ENGLISH, keys: ['EKJV', 'kjv', 'KJ'] },
                { step: 'check', url: LINK, wantedKey: 'KJV' },
            ),
        );
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'KJV (suggested)',
            'NKJV',
            'NIV',
            'ESV',
            'Cancel',
        ]);
    });

    it('is not offered when it is taken, or cannot be a short name', async () => {
        const taken = await agreeTo(
            genBibleImportCheckAnswer(
                { ...ENGLISH, takenKeys: ['kjv'] },
                { step: 'check', url: LINK, wantedKey: 'KJV' },
            ),
        );
        expect(taken.actions?.[0].label).toBe('NKJV (suggested)');
        expect(taken.text).not.toContain('The app is looking for');

        const unusable = await agreeTo(
            genBibleImportCheckAnswer(ENGLISH, {
                step: 'check',
                url: LINK,
                wantedKey: 'K.J/V',
            }),
        );
        expect(unusable.actions?.[0].label).toBe('KJV (suggested)');
        expect(unusable.text).not.toContain('The app is looking for');

        // A Bible they already have is found by choosing ITS name: the two
        // sentences would say opposite things.
        const ownedNotice = genBibleImportCheckAnswer(
            { ...ENGLISH, installedAs: 'EKJ' },
            { step: 'check', url: LINK, wantedKey: 'KJV' },
        );
        expect(ownedNotice.text).toContain('You already have this Bible');
        const owned = await agreeTo(ownedNotice);
        expect(owned.text).toContain('You already have this Bible as **EKJ**');
        expect(owned.text).not.toContain('The app is looking for');
        // An ordinary import says nothing of it.
        expect(
            (
                await agreeTo(
                    genBibleImportCheckAnswer(ENGLISH, {
                        step: 'check',
                        url: LINK,
                    }),
                )
            ).text,
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
        const notice = await runBibleImportStep({ step: 'check', url: LINK });
        // Under the notice, "yes" is agreeing -- and so is saying so.
        for (const said of ['yes', 'I agree', 'agree.', 'ok']) {
            expect([
                said,
                readBibleImportTypedReply(notice.actions, said)?.step,
            ]).toEqual([said, 'agree']);
        }
        expect(readBibleImportTypedReply(notice.actions, 'no')?.step).toBe(
            'cancel',
        );
        const first = await agreeTo(notice);
        // Not a Bible named "yes".
        expect(readBibleImportTypedReply(first.actions, 'yes')).toMatchObject({
            step: 'locale',
            key: 'ពគប',
        });
        expect(readBibleImportTypedReply(first.actions, 'Cancel')?.step).toBe(
            'cancel',
        );
        // A key of the language's list, typed instead of pressed.
        expect(readBibleImportTypedReply(first.actions, 'គខប')).toMatchObject({
            step: 'locale',
            key: 'គខប',
        });
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
        const first = await agreeTo(checked);
        expect(first.text).toContain('Step 1 of 4');
        expect(first.text).toContain('To keep a second copy anyway');
        expect(
            genBibleImportCheckAnswer(CHECKED, { step: 'check', url: LINK })
                .text,
        ).not.toContain('already have');
    });
});

describe('where a downloaded Bible came from, agreed to first', () => {
    const CATALOG = 'https://github.com/Beblia/Holy-Bible-XML-Format';

    it('says it was found on the internet, where, and whose it is', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ ...CHECKED, source: LINK }),
        );
        const notice = await runBibleImportStep({
            step: 'check',
            url: LINK,
            sourcePage: CATALOG,
        });
        expect(notice.text).toContain(
            'I found it on the internet, in a free collection of Bible files ' +
                `that someone shared on GitHub (Beblia): \`${CATALOG}\``,
        );
        expect(notice.text).toContain(`- **The file:** \`${LINK}\``);
        expect(notice.text).toContain('**It is not from Open Worship.**');
        expect(notice.text).toContain(
            '**You are responsible to its publisher.**',
        );
        expect(notice.actions?.map((one) => one.label)).toEqual([
            'I agree',
            'Open the website',
            'Cancel',
        ]);
        // Nothing asked, nothing installed: the one call is the download.
        expect(mocks.callTool).toHaveBeenCalledTimes(1);
        // Both addresses are the app's own words, so both open.
        expect(notice.links).toEqual([CATALOG, LINK]);

        const opened = await pressByLabel(notice, 'Open the website');
        expect(mocks.openExternalURL).toHaveBeenCalledWith(CATALOG);
        expect(opened.text).toContain('in your web browser');
        expect(opened.links).toEqual([CATALOG]);
        expect(opened.actions?.map((one) => one.label)).toEqual([
            'I agree',
            'Cancel',
        ]);
        expect((await agreeTo(opened)).text).toContain('Step 1 of 4');

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ cancelled: true }),
        );
        const stopped = await pressByLabel(notice, 'Cancel');
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'cancel',
            draftId: 'he10paxbbz64',
        });
        expect(stopped.text).toContain('Nothing was installed');
    });

    it('a file off another web page names that page, and opens it', async () => {
        const pageUrl = 'https://example.org/bibles/';
        const fileUrl = 'https://example.org/bibles/thai.xml';
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                kind: 'page',
                total: 1,
                matched: 1,
                searchedFor: [],
                files: [{ name: 'thai.xml', url: fileUrl }],
            }),
        );
        const page = await runBibleImportStep({ step: 'check', url: pageUrl });
        expect(page.actions?.[0].args.sourcePage).toBe(pageUrl);
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ ...CHECKED, source: fileUrl }),
        );
        const notice = await pressByLabel(page, '1. thai');
        expect(notice.text).toContain(
            `I found it on the internet, on this web page: \`${pageUrl}\``,
        );
        expect(notice.text).toContain(`- **The file:** \`${fileUrl}\``);
        expect(notice.links).toEqual([pageUrl, fileUrl]);
        await pressByLabel(notice, 'Open the website');
        expect(mocks.openExternalURL).toHaveBeenCalledWith(pageUrl);
    });

    it('a link to the file itself shows its address, and opens nothing', async () => {
        const fileUrl = 'https://example.org/my/bible.xml';
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ ...CHECKED, source: fileUrl }),
        );
        const notice = await runBibleImportStep({
            step: 'check',
            url: fileUrl,
        });
        expect(notice.text).toContain(
            '**Where it is from:** the internet, at the address below.',
        );
        expect(notice.text).toContain(`- **The file:** \`${fileUrl}\``);
        expect(notice.actions?.map((one) => one.label)).toEqual([
            'I agree',
            'Cancel',
        ]);
        expect(notice.links).toEqual([fileUrl]);
        // A press made by hand opens no page there is none of, nor one
        // that is no web address.
        const agreed = notice.actions![0].args as BibleImportStateType;
        const none = await runBibleImportStep({ ...agreed, step: 'source' });
        await runBibleImportStep({
            ...agreed,
            step: 'source',
            sourcePage: 'file:///C:/Windows/win.ini',
        });
        expect(mocks.openExternalURL).not.toHaveBeenCalled();
        expect(none.actions?.map((one) => one.label)).toEqual([
            'I agree',
            'Cancel',
        ]);
    });

    it('under a model’s answer: the same buttons, and the notice they are for', () => {
        // A model's link straight into the collection is the collection's.
        const under = genBibleImportUnderAnswer(CHECKED, LINK);
        expect(under.actions.map((one) => one.label)).toEqual([
            'I agree',
            'Open the website',
            'Cancel',
        ]);
        expect(under.notice).toContain(`(Beblia): \`${CATALOG}\``);
        expect(under.notice).toContain(`- **The file:** \`${LINK}\``);
        expect(under.notice).toContain('Press **I agree** to go on');
        // The model said what it is; only what it is agreed to is added.
        expect(under.notice).not.toContain('I downloaded');
        expect(under.links).toEqual([CATALOG, LINK]);
        // A page of files, or a link that led nowhere, is agreed to nothing.
        expect(
            genBibleImportUnderAnswer(
                {
                    kind: 'page',
                    total: 1,
                    matched: 1,
                    searchedFor: [],
                    files: [{ name: 'KhmerBible.xml', url: LINK }],
                },
                CATALOG,
            ).notice,
        ).toBeNull();
        expect(
            genBibleImportUnderAnswer({ problem: 'not-found' }, LINK).notice,
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
    const localeState: BibleImportStateType = {
        step: 'locale',
        key: 'QA_INPUT',
        draftId: CHECKED.draftId,
        locales: CHECKED.locales,
        digitChoices: CHECKED.digits,
        nameLists: CHECKED.nameLists,
    };

    it.each([
        'use Thai please',
        'សូមប្រើភាសាថៃ',
        'quelle langue choisir ?',
        'what languages can I use?',
    ])(
        'interprets the language reply %s with the original field',
        async (typed) => {
            const question = await runBibleImportStep(localeState);
            const context = getBibleImportInputContext(question);
            expect(context?.valueKind).toBe('language');
            // Unspaced Khmer can try the literal language first; it still
            // carries awaits:locale when that read cannot recognize it.
            if (/\s|[?？]/u.test(typed))
                expect(checkBibleImportReplyNeedsHelp(question, typed)).toBe(
                    true,
                );
            expect(
                readBibleImportHelpState(question.actions, {
                    kind: 'value',
                    value: 'th',
                }),
            ).toMatchObject({
                step: 'locale-typed',
                typed: 'th',
                key: 'QA_INPUT',
                draftId: CHECKED.draftId,
            });
        },
    );

    it('the real Thai reply overrides detected Khmer and asks for Thai digits', async () => {
        const question = await runBibleImportStep(localeState);
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ locale: 'th', nameLists: [] }),
        );
        const state = readBibleImportHelpState(question.actions, {
            kind: 'value',
            value: 'th',
        });
        const answer = await runBibleImportStep(state!);
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'names',
            locale: 'th',
            draftId: CHECKED.draftId,
        });
        expect(answer.actions?.[0].args).toMatchObject({
            locale: 'th',
            key: 'QA_INPUT',
        });
        expect(answer.actions?.[0].label).toContain('๐ ๑ ๒');
    });

    it.each(['ខ្មែរ', 'ភាសាខ្មែរ', 'Khmer?', 'km-KH'])(
        'the explicit language %s overrides a detected Spanish file without a model',
        async (typed) => {
            const question = await runBibleImportStep({
                ...localeState,
                locales: [{ locale: 'es-ES', name: 'European Spanish' }],
                nameLists: [
                    { id: 'spanish', label: 'Spanish', first: ['Génesis'] },
                ],
            });
            expect(checkBibleImportReplyNeedsHelp(question, typed)).toBe(false);
            const next = readBibleImportTypedReply(question.actions, typed);
            expect(next).toMatchObject({
                step: 'locale-typed',
                typed: typed === 'km-KH' ? 'km-KH' : 'km',
            });
            mocks.callTool.mockResolvedValueOnce(
                JSON.stringify({
                    locale: 'km-KH',
                    nameLists: CHECKED.nameLists.slice(0, 1),
                }),
            );
            const digits = await runBibleImportStep(next!);
            expect(digits.actions?.[0].args).toMatchObject({
                locale: 'km-KH',
                nameLists: CHECKED.nameLists.slice(0, 1),
            });
            expect(digits.actions?.[0].label).toContain('០ ១ ២');
            const names = await runBibleImportStep(
                digits.actions![0].args as BibleImportStateType,
            );
            expect(names.text).not.toContain('Génesis');
            expect(names.text).toContain('Khmer');
            mocks.callTool.mockResolvedValueOnce(
                JSON.stringify({ nameLists: [] }),
            );
            await pressByLabel(names, 'Find more lists online');
            expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
                action: 'names',
                locale: 'km-KH',
                draftId: CHECKED.draftId,
            });
        },
    );

    it('language corrections at review discard old names and numbers while cancel still wins', async () => {
        const review = await runBibleImportStep({
            ...localeState,
            step: 'confirm',
            locale: 'es-ES',
            digits: 'ascii',
            bookNames: 'spanish',
        });
        expect(readBibleImportTypedReply(review.actions, 'no')?.step).toBe(
            'cancel',
        );
        const next = readBibleImportTypedReply(review.actions, 'ខ្មែរ');
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ locale: 'km-KH', nameLists: CHECKED.nameLists }),
        );
        const answer = await runBibleImportStep(next!);
        expect(answer.actions![0].args.bookNames).toBeUndefined();
        expect(answer.actions![0].args.locale).toBe('km-KH');
    });

    it('a link at name selection looks up that source with the selected language and retains the draft', async () => {
        const names = await runBibleImportStep({
            ...localeState,
            step: 'names',
            locale: 'km-KH',
            digits: 'local',
        });
        const url = 'https://www.bible.com/bible/4783/JHN.1.KH';
        const next = readBibleImportTypedReply(names.actions, url);
        expect(next).toMatchObject({
            step: 'names-url',
            namesUrl: url,
            locale: 'km-KH',
            draftId: CHECKED.draftId,
            digits: 'local',
        });
        expect(checkBibleImportReplyNeedsHelp(names, `Please use ${url}`)).toBe(
            true,
        );
        expect(getBibleImportInputContext(names)?.acceptsLink).toBe(true);
        expect(
            readBibleImportHelpState(names.actions, {
                kind: 'value',
                value: url,
            }),
        ).toEqual(next);
        const found = {
            id: 'provided',
            label: 'Khmer 1954',
            first: ['លោកុប្បត្តិ'],
        };
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                requestedUrl: url,
                nameLists: [found],
                sources: [{ url: 'https://www.bible.com/versions/4783' }],
            }),
        );
        const answer = await runBibleImportStep(next!);
        expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
            'owa_bible_xml',
            { action: 'names', url, locale: 'km-KH', draftId: CHECKED.draftId },
        );
        expect(answer.actions![0].args).toMatchObject({
            step: 'confirm',
            bookNames: 'provided',
            locale: 'km-KH',
        });
        expect(answer.links).toContain('https://www.bible.com/versions/4783');
        expect(answer.text).toContain('`https://www.bible.com/versions/4783`');
        expect(answer.text).toContain('លោកុប្បត្តិ');
    });

    it('an incomplete or wrong-language source preserves the current choices', async () => {
        const names = await runBibleImportStep({
            ...localeState,
            step: 'names',
            locale: 'km-KH',
            digits: 'local',
        });
        const next = readBibleImportTypedReply(
            names.actions,
            'https://example.org/books',
        );
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                requestedUrl: next!.namesUrl,
                problem: 'names-language',
                nameLists: [],
            }),
        );
        const answer = await runBibleImportStep(next!);
        expect(answer.text).toContain('do not match your selected language');
        expect(answer.actions![0].args.nameLists).toEqual(
            localeState.nameLists,
        );
        expect(answer.actions![0].args.locale).toBe('km-KH');
    });

    it.each(['old host', 'offline'])(
        '%s preserves choices instead of passing off a catalog as the pasted source',
        async (failure) => {
            const names = await runBibleImportStep({
                ...localeState,
                step: 'names',
                locale: 'km-KH',
                digits: 'local',
            });
            const next = readBibleImportTypedReply(
                names.actions,
                'https://example.org/books',
            );
            if (failure === 'offline')
                mocks.callTool.mockRejectedValueOnce(new Error('offline'));
            else
                mocks.callTool.mockResolvedValueOnce(
                    JSON.stringify({
                        nameLists: [
                            {
                                id: 'unrelated',
                                label: 'Wrong source',
                                first: [],
                            },
                        ],
                    }),
                );
            const answer = await runBibleImportStep(next!);
            expect(answer.text).toContain(
                'previous choices are still available',
            );
            expect(answer.text).not.toContain('Wrong source');
            expect(answer.actions![0].args.nameLists).toEqual(
                localeState.nameLists,
            );
        },
    );

    it('context distinguishes selected Khmer from detected Spanish and excludes internal arguments', async () => {
        const answer = await runBibleImportStep({
            ...localeState,
            step: 'names',
            locale: 'km-KH',
            localeName: 'Khmer',
            digits: 'local',
            locales: [{ locale: 'es-ES', name: 'European Spanish' }],
            title: 'Test Bible',
            summary: '66 books',
            sourcePage: LINK,
        });
        const context = getBibleImportInputContext(answer)!;
        expect(context.facts).toEqual(
            expect.arrayContaining([
                { label: 'Selected language', value: 'Khmer (km-KH)' },
                {
                    label: 'Detected languages (suggestions only)',
                    value: 'European Spanish (es-ES)',
                },
                { label: 'Current step', value: 'book names' },
                { label: 'Short name', value: 'QA_INPUT' },
                { label: 'Selected numbers', value: 'local' },
            ]),
        );
        const prompt = genBibleImportContextHint(answer)!;
        expect(prompt).toContain('action names with url');
        expect(prompt).toContain('km-KH');
        expect(prompt).not.toContain(CHECKED.draftId);
        expect(prompt).not.toContain('nc4e26c5e');
        const question = await runBibleImportStep(localeState);
        expect(
            getBibleImportInputContext(question)?.facts?.some(
                (fact) => fact.label === 'Selected language',
            ),
        ).toBe(false);
    });

    it('uses only the original allowed choice and leaves help and unrelated replies waiting', async () => {
        const question = await runBibleImportStep(localeState);
        expect(
            readBibleImportHelpState(question.actions, {
                kind: 'choice',
                choice: 1,
            }),
        ).toBe(question.actions?.[0].args);
        expect(
            readBibleImportHelpState(question.actions, {
                kind: 'choice',
                choice: 2,
            }),
        ).toBeNull(); // Cancel needs a press.
        expect(
            readBibleImportHelpState(question.actions, {
                kind: 'help',
                reply: 'Which language?',
            }),
        ).toBeNull();
        expect(
            readBibleImportHelpState(question.actions, { kind: 'unrelated' }),
        ).toBeNull();
        const repeated = { ...question, note: 'Choose the language you want.' };
        expect(getBibleImportInputContext(repeated)).toEqual(
            getBibleImportInputContext(question),
        );
    });

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

    it.each(['១', '១?', '１', '1?', '១។'])(
        'reads a listed file number: %s',
        (typed) => {
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
        },
    );

    it('does not confuse local and ASCII digit buttons', () => {
        const actions = [
            {
                label: '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ (suggested)',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: { step: 'names', digits: 'local' },
            },
            {
                label: '0 1 2 3 4 5 6 7 8 9',
                toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
                args: { step: 'names', digits: 'ascii' },
            },
        ];
        expect(
            readBibleImportTypedReply(actions, '0 1 2 3 4 5 6 7 8 9')?.digits,
        ).toBe('ascii');
        expect(
            readBibleImportTypedReply(actions, '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩')?.digits,
        ).toBe('local');
    });

    it.each([
        ['១', 'local'],
        ['1?', 'local'],
        ['២', 'ascii'],
        ['２', 'ascii'],
    ])('reads a digit-format choice by position: %s', (typed, digits) => {
        const actions = ['local', 'ascii'].map((value) => ({
            label:
                value === 'local'
                    ? '០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩'
                    : '0 1 2 3 4 5 6 7 8 9',
            toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
            args: { step: 'names', locale: 'km-KH', digits: value },
        }));
        expect(readBibleImportTypedReply(actions, typed)).toMatchObject({
            step: 'names',
            locale: 'km-KH',
            digits,
        });
        expect(
            checkBibleImportReplyNeedsHelp(
                { text: 'Which numbers?', actions },
                typed,
            ),
        ).toBe(false);
    });

    it.each(['huh', '๒'])(
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

    it('offers it over a downloaded Bible and still allows that file', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ ...CHECKED, hasKjv: false }),
        );
        const offer = await runBibleImportStep({ step: 'check', url: LINK });
        expect(offer.text).toContain('Before another Bible');
        expect(offer.actions?.[0].label).toBe('Create the provided KJV');
        expect(offer.actions?.map((one) => one.label)).toContain('I agree');

        // Creating it lets the downloaded draft go, then starts over.
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ created: true, installed: true, key: 'KJV' }),
        );
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ cancelled: true }),
        );
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ ...CHECKED, hasKjv: true }),
        );
        const again = await pressByLabel(offer, 'Create the provided KJV');
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'cancel',
            draftId: CHECKED.draftId,
        });
        expect(again.text).toContain(
            'Khmer Standard Version 1954 = Hammond Version',
        );
    });

    it('steers an internet KJV to the provided one, and finishes when created', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                ...CHECKED,
                title: 'English King James Version',
                keys: ['EKJV', 'EN1769', 'KJ'],
                hasKjv: false,
            }),
        );
        const offer = await runBibleImportStep({ step: 'check', url: LINK });
        expect(offer.text).toContain('Open Worship provides the KJV Bible');
        expect(offer.actions?.[0].label).toBe('Create the provided KJV');
        expect(offer.actions?.map((one) => one.label)).toContain('I agree');

        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ created: true, installed: true, key: 'KJV' }),
        );
        const done = await pressByLabel(offer, 'Create the provided KJV');
        expect(done.text).toContain(
            'the KJV Open Worship provides is installed',
        );
        expect(done.actions?.map((one) => one.label)).toEqual([
            'Add another Bible',
        ]);
        // The internet copy is still there for them to choose instead.
        expect(mocks.callTool).not.toHaveBeenCalledWith(
            'owa_bible_xml',
            expect.objectContaining({ action: 'cancel' }),
        );
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

it('returning to detected Khmer after a Thai override reloads its digits and names', async () => {
    const question = await runBibleImportStep({
        step: 'locale',
        draftId: CHECKED.draftId,
        locales: CHECKED.locales,
        locale: 'th',
        digitChoices: { local: '๐ ๑ ๒ ๓', ascii: '0 1 2 3' },
        nameLists: [],
    });
    expect(question.actions?.[0].args).toMatchObject({
        step: 'locale-typed',
        typed: 'km-KH',
    });
    mocks.callTool.mockResolvedValueOnce(
        JSON.stringify({ locale: 'km-KH', nameLists: CHECKED.nameLists }),
    );
    const digits = await runBibleImportStep(
        question.actions![0].args as BibleImportStateType,
    );
    expect(digits.actions?.[0].label).toContain('០ ១ ២');
    expect(digits.actions?.[0].args.locale).toBe('km-KH');
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

    it('a downloaded Bible with books missing says which half it holds', () => {
        const cases: [number, string][] = [
            [39, 'It has the New Testament only.'],
            [27, 'It has the Old Testament only.'],
            [5, 'It is missing 5 of the 66 books.'],
        ];
        for (const [count, words] of cases) {
            const answer = genBibleImportCheckAnswer(
                {
                    ...CHECKED,
                    missingBooks: Array.from({ length: count }, (_x, index) => {
                        return `B${index}`;
                    }),
                },
                STATE,
            );
            expect(answer.text, String(count)).toContain(words);
        }
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

    it('a download that cannot be let go after the KJV is made does not stop the import', async () => {
        mocks.callTool
            .mockResolvedValueOnce(JSON.stringify({ created: 'KJV' }))
            .mockRejectedValueOnce(new Error('host gone'))
            .mockResolvedValueOnce(JSON.stringify(CHECKED));
        const answer = await runBibleImportStep({
            step: 'kjv-create',
            url: LINK,
            draftId: 'd1',
        } as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenNthCalledWith(2, 'owa_bible_xml', {
            action: 'cancel',
            draftId: 'd1',
        });
        // The import they wanted starts again from its first step.
        expect(mocks.callTool).toHaveBeenNthCalledWith(3, 'owa_bible_xml', {
            action: 'check',
            url: LINK,
        });
        expect(answer.actions?.[0].label).toBe('I agree');
    });

    it('a KJV file downloaded where the provided KJV is installed says there is no need', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                ...CHECKED,
                title: 'King James Version',
                hasKjv: true,
            }),
        );
        const answer = await runBibleImportStep({
            step: 'check',
            url: LINK,
        } as BibleImportStateType);
        expect(answer.text).toContain(
            '**You already have the KJV Open Worship provides**',
        );
        expect(answer.text).toContain('King James Version');
        expect(answer.actions?.[0].label).toBe('I agree');
    });

    it('under a model answer, the KJV is offered first when it is not there', () => {
        const page = {
            kind: 'page',
            total: 1,
            matched: 1,
            searchedFor: [],
            files: [{ name: 'KhmerBible.xml', url: LINK }],
            hasKjv: false,
        };
        const underPage = genBibleImportUnderAnswer(page, LINK);
        expect(underPage.notice).toContain(
            '**Before another Bible: Open Worship provides the KJV Bible**',
        );
        expect(underPage.actions.at(-1)?.label).toBe('Cancel');
        expect(underPage.links).toEqual([]);

        const underDownload = genBibleImportUnderAnswer(
            { ...CHECKED, hasKjv: false },
            LINK,
        );
        expect(underDownload.notice).toContain('Creating it needs no internet');
        expect(underDownload.notice).toContain('Press **I agree** to go on');
        expect(underDownload.links.length).toBeGreaterThan(0);

        const kjvAgain = genBibleImportUnderAnswer(
            { ...CHECKED, title: 'King James Version', hasKjv: true },
            LINK,
        );
        expect(kjvAgain.notice).toContain(
            '**You already have the KJV Open Worship provides**',
        );
        expect(kjvAgain.actions[0].label).toBe('I agree');
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

    it('a request that names the KJV is offered the provided one before the file', async () => {
        mocks.callTool
            // The installed list could not be read: the check goes on.
            .mockResolvedValueOnce('null')
            .mockResolvedValueOnce(
                JSON.stringify({ ...CHECKED, hasKjv: false }),
            );
        const answer = await runBibleImportStep({
            step: 'check',
            url: LINK,
            find: 'kjv',
        } as BibleImportStateType);
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_bible_xml', {
            action: 'check',
            url: LINK,
            find: 'kjv',
        });
        expect(answer.text).toContain(
            '**Open Worship provides the KJV Bible** — the recommended King ' +
                'James Version, and it is not installed yet.',
        );
    });

    it('a link that is no address is no request and no pasted link', async () => {
        expect(
            readBibleImportLinkAsk('import bible https://exa%mple.com/x.xml'),
        ).toBeNull();
        const keyStep = await agreeTo(
            genBibleImportCheckAnswer(CHECKED, { step: 'check', url: LINK }),
        );
        // Nothing to interpret: the step takes it as typed.
        expect(
            checkBibleImportReplyNeedsHelp(
                keyStep,
                'https://exa%mple.com/x.xml',
            ),
        ).toBe(false);
        // A new request is a new request, not a reply to this step.
        expect(
            checkBibleImportReplyNeedsHelp(
                keyStep,
                `Import bible from xml url ${LINK}`,
            ),
        ).toBe(false);
        // An answer that is not an import step waits for nothing.
        expect(
            checkBibleImportReplyNeedsHelp(
                { text: 'Hello', actions: [] },
                'hi',
            ),
        ).toBe(false);
    });

    it('a short name of one letter, or of too many, is asked again', async () => {
        const keyStep = await agreeTo(
            genBibleImportCheckAnswer(CHECKED, { step: 'check', url: LINK }),
        );
        const typed = readBibleImportTypedReply(keyStep.actions, 'KSV2005');
        for (const name of ['K', 'K'.repeat(25)]) {
            const again = await runBibleImportStep({
                ...(typed as BibleImportStateType),
                typed: name,
            });
            expect(again.text, name).toContain(
                'A short name is 2 to 24 letters or numbers, like KJV.',
            );
            expect(again.text).toContain('Step 1 of 4');
        }
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
