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

vi.mock('../../../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../../../chatbot/mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => JSON.parse(text),
    };
});
vi.mock(
    '../../../../../../chatbot/langInstallChatHelpers',
    async (importOriginal) => {
        return {
            ...(await importOriginal<object>()),
            checkChatLanguage: mocks.checkChatLanguage,
            installChatLanguage: mocks.installChatLanguage,
        };
    },
);
vi.mock(
    '../../../../../../setting/bible-setting/bibleImportRequestHelpers',
    () => {
        return { requestBibleImport: mocks.requestBibleImport };
    },
);
vi.mock('../../../../../../setting/settingHelpers', () => {
    return { openBibleSetting: mocks.openBibleSetting };
});
vi.mock('../../../../../../server/appProvider', () => {
    return {
        default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
    };
});

import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
    getBibleImportInputContext,
    genBibleImportContextHint,
    checkBibleImportReplyNeedsHelp,
    readBibleImportHelpState,
    genBibleImportCheckAnswer,
    genBibleImportUnderAnswer,
    readBibleImportLanguageAsk,
    readBibleImportLinkAsk,
    readBibleImportTypedReply,
    runBibleImportStep,
    type BibleImportStateType,
} from '../../../../../../chatbot/bibleImportChatHelpers';

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
    // Khmer is the language these imports are in: installed, nothing to offer.
    mocks.checkChatLanguage.mockReset().mockResolvedValue(null);
    mocks.installChatLanguage.mockReset().mockResolvedValue(true);
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
        // The Khmer row's own example is the language in Khmer
        // (2026-11-05), asked as its English with that word in it.
        expect(
            readBibleImportLanguageAsk('Import a Bible in "ខ្មែរ"')?.find,
        ).toBe('khmer');
        expect(readBibleImportLanguageAsk('Import a Bible in "ថៃ"')?.find).toBe(
            'thai',
        );
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

    it.each(['១', '១?', '១។'])('reads a listed file number: %s', (typed) => {
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
});

describe('the KJV Open Worship provides comes first', () => {
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
});
