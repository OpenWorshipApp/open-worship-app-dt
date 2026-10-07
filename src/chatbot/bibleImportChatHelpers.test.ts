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
    BIBLE_IMPORT_STEP_TOOL_NAME,
    findBibleImportState,
    genBibleImportCheckAnswer,
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

it('shows a file name as words', () => {
    expect(toFileLabel('Khmer2005Bible.xml')).toBe('Khmer 2005 Bible');
    expect(toFileLabel('EnglishKJBible.xml')).toBe('English KJ Bible');
    expect(toFileLabel('kjv_1611.xml')).toBe('kjv 1611');
});

it('echoes a choice without "(suggested)"', () => {
    expect(toBibleImportEcho('KSV (suggested)')).toBe('KSV');
    expect(toBibleImportEcho('KM1954')).toBe('KM1954');
});
