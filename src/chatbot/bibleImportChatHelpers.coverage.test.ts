import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, routes } = vi.hoisted(() => ({
    mocks: {
        callTool: vi.fn(),
        appError: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
        openExternalURL: vi.fn(),
    },
    // `owa_bible_xml` / `owa_undo` answered by action; an action no test
    // routed THROWS, so an unexpected call fails the test instead of quietly
    // answering nothing.
    routes: {} as Record<string, (args: any) => unknown>,
}));

vi.mock('../helper/loggerHelpers', () => ({ appError: mocks.appError }));
vi.mock('./mcpClient', () => ({
    callTool: mocks.callTool,
    parseToolJson: (text: string) => JSON.parse(text),
}));
vi.mock('../setting/bible-setting/bibleImportRequestHelpers', () => ({
    requestBibleImport: mocks.requestBibleImport,
}));
vi.mock('../setting/settingHelpers', () => ({
    openBibleSetting: mocks.openBibleSetting,
}));
vi.mock('../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
}));

import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    describeBibleImportStep,
    genBibleImportCheckAnswer,
    genBibleImportUnderAnswer,
    readBibleImportHelpState,
    readBibleImportLinkAsk,
    readBibleImportTypedReply,
    runBibleImportStep,
    type BibleImportStateType,
} from './bibleImportChatHelpers';

const URL_A = 'https://example.org/bibles/khmer.xml';
const FIND_RIGHT_LINK_TEXT =
    'To get the right link: open the page in your web browser, find the ' +
    'Bible file (its name ends in .xml), and copy the address of THAT file ' +
    '— on GitHub, open the file and press **Raw**, then copy the address ' +
    'bar. Paste it here.';

// A downloaded Bible as the tool describes it.
function genDownloaded(extra: Record<string, unknown> = {}) {
    return {
        kind: 'xml',
        draftId: 'draft-1',
        title: 'Khmer Test Bible',
        books: 66,
        chapters: 1189,
        verses: 31102,
        keys: ['KTB'],
        takenKeys: [],
        locales: [{ locale: 'km-KH', name: 'Khmer (Cambodia)' }],
        // Symbols stand in for the file's own digits and book names: no
        // case here reads them.
        digits: { local: '０ １ ２', ascii: '0 1 2' },
        nameLists: [
            {
                id: 'n1',
                label: 'Khmer names',
                first: ['☩', '✠'],
                matches: 40,
            },
            {
                id: 'file',
                label: 'The file’s own names',
                first: ['Gen', 'Exo'],
            },
        ],
        ...extra,
    };
}

function labelsOf(answer: { actions?: { label: string }[] }) {
    return (answer.actions ?? []).map((action) => {
        return action.label;
    });
}

function findAction(
    answer: { actions?: { label: string; args?: any }[] },
    label: string,
) {
    const action = answer.actions?.find((one) => {
        return one.label === label;
    });
    if (action === undefined) {
        throw new Error(`no "${label}" in ${labelsOf(answer)}`);
    }
    return action;
}

function stepAction(args: Partial<BibleImportStateType>) {
    return {
        label: 'x',
        toolName: BIBLE_IMPORT_STEP_TOOL_NAME,
        args: args as BibleImportStateType,
    };
}

beforeEach(() => {
    for (const key of Object.keys(routes)) {
        delete routes[key];
    }
    mocks.callTool.mockImplementation(async (name: string, args: any) => {
        const route = routes[`${name}:${args?.action}`];
        if (route === undefined) {
            throw new Error(`unrouted ${name} ${args?.action}`);
        }
        return JSON.stringify(route(args));
    });
});

describe('the waiting line', () => {
    test('says what a slow step is waiting on, and nothing for a quick one', () => {
        const rowList: [BibleImportStateType['step'], string | null][] = [
            ['check', 'Downloading the Bible file and reading it'],
            [
                'locale-typed',
                'Looking online for Bible book names — this can take a minute',
            ],
            [
                'more-names',
                'Looking online for Bible book names — this can take a minute',
            ],
            [
                'names-url',
                'Looking online for Bible book names — this can take a minute',
            ],
            ['import', 'Installing the Bible'],
            ['kjv-create', 'Creating the provided KJV Bible'],
            ['undo', 'Putting it back'],
            ['key', null],
            ['agree', null],
        ];
        for (const [step, expected] of rowList) {
            expect(describeBibleImportStep({ step }), step).toBe(expected);
        }
    });
});

describe('a link that did not lead to a Bible', () => {
    // Said as what to do next, never the tool's own sentence.
    const RETRY_LIST: [string, string][] = [
        ['busy', 'That website is busy right now. Try again in a few minutes.'],
        [
            'server',
            'That website had a problem sending the file. Try again later.',
        ],
        [
            'unreachable',
            'I could not reach that website. Check the internet connection ' +
                'and the address.',
        ],
        [
            'timeout',
            'The download took too long and I stopped it. The website or the ' +
                'internet may be slow — try again.',
        ],
        [
            'draft-gone',
            'That download is not here any more — downloads are kept for two ' +
                'hours.',
        ],
    ];
    const LINK_LIST: [string, string][] = [
        [
            'denied',
            'That website would not give the file out. It may need a sign-in.',
        ],
        [
            'blocked',
            'I can only download from a public web address that starts with ' +
                'https://.',
        ],
        ['too-large', 'That file is far too large to be a Bible.'],
        ['empty', 'That link gave back an empty file.'],
        [
            'not-bible',
            'I downloaded the file, but there is no Bible in it that this app ' +
                'can read — it may be a different Bible format.',
        ],
        [
            'page-without-files',
            'That link opens a web page, and there is no Bible file on it.',
        ],
        ['something-new', 'That link did not lead to a Bible.'],
    ];

    test('a passing trouble offers Try again on the same link, draft let go', () => {
        for (const [problem, text] of RETRY_LIST) {
            const answer = genBibleImportCheckAnswer(
                { problem },
                { step: 'check', url: URL_A, draftId: 'old' },
            );
            expect(answer.text, problem).toBe(text);
            expect(labelsOf(answer)).toEqual(['Try again']);
            expect(answer.actions?.[0].args).toEqual({
                step: 'check',
                url: URL_A,
                draftId: undefined,
            });
            // With no link to try again, nothing to press.
            expect(
                genBibleImportCheckAnswer({ problem }, { step: 'language' })
                    .actions,
            ).toEqual([]);
        }
    });

    test('no answer at all is a website that could not be reached', () => {
        expect(
            genBibleImportCheckAnswer(null, { step: 'check', url: URL_A }).text,
        ).toBe(RETRY_LIST[2][1]);
        expect(
            genBibleImportCheckAnswer('words', { step: 'check', url: URL_A })
                .text,
        ).toBe(RETRY_LIST[2][1]);
    });

    test('a wrong link says how to find the right one, and waits for it', () => {
        for (const [problem, text] of LINK_LIST) {
            const answer = genBibleImportCheckAnswer(
                { problem },
                { step: 'check', url: URL_A, wantedKey: 'KJV' },
            );
            expect(answer.text, problem).toBe(
                `${text}\n\n${FIND_RIGHT_LINK_TEXT}`,
            );
            expect(answer.actions?.map((action) => action.args)).toEqual([
                { step: 'language', wantedKey: 'KJV' },
                { step: 'cancel', awaits: 'link', wantedKey: 'KJV' },
            ]);
        }
    });
});

describe('a downloaded Bible with books missing', () => {
    test('says which Testament it holds, or how many books it lacks', () => {
        const textOf = (missingBooks: string[]) => {
            return genBibleImportCheckAnswer(genDownloaded({ missingBooks }), {
                step: 'check',
                url: URL_A,
            }).text;
        };
        expect(textOf(new Array(39).fill('GEN'))).toContain(
            'It has the New Testament only.',
        );
        expect(textOf(new Array(27).fill('MAT'))).toContain(
            'It has the Old Testament only.',
        );
        expect(textOf(['TOB', 'JDT', 'SIR'])).toContain(
            'It is missing 3 of the 66 books.',
        );
        const whole = textOf([]);
        expect(whole).not.toContain('missing');
        expect(whole).not.toContain('Testament only');
        expect(whole).toContain('I downloaded **Khmer Test Bible**');
    });
});

describe('reading what was typed', () => {
    test('a link that is no address is no link', () => {
        expect(
            readBibleImportLinkAsk('import bible from https://)'),
        ).toBeNull();
        // Under "paste the right link here", a broken address is not the
        // Bible they mean -- and not a word to search for either.
        expect(
            readBibleImportTypedReply(
                [stepAction({ step: 'cancel', awaits: 'link' })],
                'https://[',
            ),
        ).toBeNull();
        expect(
            readBibleImportTypedReply(
                [stepAction({ step: 'check', awaits: 'find' })],
                'https://[',
            ),
        ).toBeNull();
    });

    test('a value read for the answer that waits on a link starts from it', () => {
        expect(
            readBibleImportHelpState(
                [
                    stepAction({
                        step: 'cancel',
                        awaits: 'link',
                        wantedKey: 'KJV',
                    }),
                ],
                { kind: 'value', value: URL_A },
            ),
        ).toEqual({ step: 'check', url: URL_A, wantedKey: 'KJV' });
    });

    test('a value with no question waiting for it continues nothing', () => {
        // A finished import's buttons wait for no word.
        expect(
            readBibleImportHelpState([stepAction({ step: 'undo' })], {
                kind: 'value',
                value: 'KJV',
            }),
        ).toBeNull();
        expect(
            readBibleImportHelpState(undefined, { kind: 'value', value: 'x' }),
        ).toBeNull();
        // A saved answer waiting on something this version does not know.
        expect(
            readBibleImportHelpState(
                [stepAction({ step: 'check', awaits: 'colour' as any })],
                { kind: 'value', value: 'blue' },
            ),
        ).toBeNull();
    });
});

describe('the steps', () => {
    test('a short name too short or too long is refused at step 1, saying why', async () => {
        for (const typed of ['K', 'ABCDEFGHIJKLMNOPQRSTUVWXY']) {
            const answer = await runBibleImportStep({
                step: 'key',
                kjvChecked: true,
                typed,
                draftId: 'draft-1',
                keys: ['KTB'],
                takenKeys: [],
            });
            expect(answer.text.split('\n\n')[0], typed).toBe(
                'A short name is 2 to 24 letters or numbers, like KJV.',
            );
            expect(answer.text).toContain('**Step 1 of 3 — a short name.**');
        }
    });

    test('a book-name list says what only it has', async () => {
        const answer = await runBibleImportStep({
            step: 'names',
            kjvChecked: true,
            locale: 'xx-XX',
            localeName: 'Test language',
            nameLists: [
                {
                    id: 'n1',
                    label: 'Book names',
                    first: ['☩', '✠'],
                    // A name its first ones already show is not said again.
                    own: ['✠', '☧'],
                    matches: 12,
                },
            ],
        });
        expect(answer.text).toContain(
            '1. Book names: ☩, ✠… Only this list says: ' +
                '☧. (12 of its names are in this Bible)',
        );
    });

    test('more lists found online are added once each, the best first', async () => {
        routes['owa_bible_xml:names'] = () => {
            return {
                nameLists: [
                    { id: 'n1', label: 'Again', first: ['A'], matches: 1 },
                    { id: 'n9', label: 'Online', first: ['B'], matches: 30 },
                ],
            };
        };
        const answer = await runBibleImportStep({
            step: 'more-names',
            kjvChecked: true,
            locale: 'km-KH',
            draftId: 'draft-1',
            nameLists: [{ id: 'n1', label: 'Mine', first: ['C'], matches: 5 }],
        });
        expect(answer.text).toContain('I found 1 more online.');
        const lines = answer.text.split('\n');
        const onlineAt = lines.findIndex((line) => {
            return line.startsWith('1. Online');
        });
        expect(onlineAt).not.toBe(-1);
        expect(lines[onlineAt + 1]).toMatch(/^2\. Mine/);
        expect(answer.text).not.toContain('Again');
        expect(mocks.callTool).toHaveBeenCalledWith('owa_bible_xml', {
            action: 'names',
            locale: 'km-KH',
            draftId: 'draft-1',
        });
    });

    test('an install the tool refused is said as the problem, never as done', async () => {
        routes['owa_bible_xml:import'] = () => {
            return { problem: 'draft-gone' };
        };
        const state: BibleImportStateType = {
            step: 'import',
            kjvChecked: true,
            url: URL_A,
            draftId: 'draft-1',
            key: 'KTB',
            locale: 'km-KH',
            digits: 'local',
        };
        const gone = await runBibleImportStep(state);
        expect(gone.text).toBe(
            'That download is not here any more — downloads are kept for two ' +
                'hours.',
        );
        expect(labelsOf(gone)).toEqual(['Try again']);
        routes['owa_bible_xml:import'] = () => {
            return { ok: true };
        };
        const unsure = await runBibleImportStep(state);
        expect(unsure).toEqual({
            text: 'Something went wrong while installing it. Nothing was changed.',
        });
    });

    test('a draft the host could not let go of is still a clean stop', async () => {
        const answer = await runBibleImportStep({
            step: 'cancel',
            draftId: 'draft-1',
        });
        expect(answer).toEqual({ text: 'Stopped. Nothing was installed.' });
        expect(mocks.appError).toHaveBeenCalledWith(
            expect.any(Error),
            'bible import cancel',
        );
    });

    test('a file on this computer opens the Settings form, after the KJV check', async () => {
        routes['owa_bible_xml:list'] = () => {
            return { bibles: [{ key: 'KJV' }] };
        };
        const answer = await runBibleImportStep({ step: 'local-file' });
        expect(answer.text).toBe(
            'I opened **Settings → Bible**. Press **Choose File**, pick the ' +
                'Bible file (its name ends in .xml), then press **Import** ' +
                'below it.',
        );
        expect(mocks.openBibleSetting).toHaveBeenCalledOnce();
        // No link to put in the box.
        expect(mocks.requestBibleImport).not.toHaveBeenCalled();
    });

    test('a step this version does not know is said so', async () => {
        const answer = await runBibleImportStep({
            step: 'teleport' as any,
            kjvChecked: true,
        });
        expect(answer).toEqual({ text: 'That step is not one I know.' });
        expect(mocks.callTool).not.toHaveBeenCalled();
    });
});

describe('the provided KJV', () => {
    test('a create the tool answered with a problem offers to try again', async () => {
        routes['owa_bible_xml:create-kjv'] = () => {
            return { problem: 'exists' };
        };
        const state: BibleImportStateType = {
            step: 'kjv-create',
            kjvChecked: true,
            kjvNext: 'check',
            url: URL_A,
        };
        const answer = await runBibleImportStep(state);
        expect(answer.text).toBe(
            'I could not create the KJV Open Worship provides. Nothing was ' +
                'installed. In **Settings → Bible**, press **Create KJV Bible ' +
                'XML**, or try again here.',
        );
        expect(answer.actions?.map((action) => action.args)).toEqual([
            { ...state, step: 'kjv-create' },
            { step: 'cancel' },
        ]);
        // Nor is anything else answered as a success.
        routes['owa_bible_xml:create-kjv'] = () => {
            return { isError: true };
        };
        expect((await runBibleImportStep(state)).text).toBe(answer.text);
    });

    test('created, a draft the host cannot let go of does not stop the import', async () => {
        routes['owa_bible_xml:create-kjv'] = () => {
            return { created: 'KJV' };
        };
        routes['owa_bible_xml:check'] = (args) => {
            expect(args).toEqual({ action: 'check', url: URL_A });
            return genDownloaded({ hasKjv: true });
        };
        const answer = await runBibleImportStep({
            step: 'kjv-create',
            kjvChecked: true,
            kjvNext: 'check',
            url: URL_A,
            draftId: 'draft-old',
        });
        expect(mocks.appError).toHaveBeenCalledWith(
            expect.any(Error),
            'bible import cancel after KJV',
        );
        // The import started again from its first step: the source notice.
        expect(answer.text).toContain('I downloaded **Khmer Test Bible**');
        expect(labelsOf(answer)).toContain('I agree');
    });

    test('a downloaded KJV on a computer that has it says so first', async () => {
        routes['owa_bible_xml:check'] = () => {
            return genDownloaded({
                title: 'English King James Version',
                keys: ['EKJV'],
                hasKjv: true,
            });
        };
        const answer = await runBibleImportStep({ step: 'check', url: URL_A });
        expect(answer.text.split('\n\n')[0]).toBe(
            '**You already have the KJV Open Worship provides**, installed as ' +
                '**KJV**. There is no need to import this file. To use the ' +
                'file anyway, press a choice below.',
        );
        // The file can still be chosen.
        expect(labelsOf(answer)).toContain('I agree');
    });
});

describe('the buttons under a MODEL’s own check', () => {
    test('a page of files, with no KJV here: the offer above its choices', () => {
        const result = {
            kind: 'page',
            hasKjv: false,
            files: [{ name: 'KhmerBible.xml', url: URL_A }],
            matched: 1,
        };
        const under = genBibleImportUnderAnswer(result, URL_A);
        expect(under.notice).toContain(
            '**Before another Bible: Open Worship provides the KJV Bible**',
        );
        expect(under.links).toEqual([]);
        expect(labelsOf(under)[0]).toBe('Create the provided KJV');
        expect(findAction(under, 'Create the provided KJV').args).toMatchObject(
            { step: 'kjv-create', kjvChecked: true, kjvNext: 'check' },
        );
        // Every choice that goes on without it is marked checked.
        for (const action of (under.actions ?? []).slice(1)) {
            expect(action.args).toMatchObject({ kjvChecked: true });
        }
    });

    test('a downloaded Bible, with no KJV here: the offer, then the notice', () => {
        const under = genBibleImportUnderAnswer(
            genDownloaded({ hasKjv: false, source: URL_A }),
            URL_A,
        );
        const [offer] = String(under.notice).split(
            '**Before you install it, please read this:**',
        );
        expect(offer).toContain(
            '**Before another Bible: Open Worship provides the KJV Bible**',
        );
        expect(under.notice).toContain('**It is not from Open Worship.**');
        expect(under.links).toEqual([URL_A]);
        expect(labelsOf(under)).toEqual([
            'Create the provided KJV',
            'I agree',
            'Cancel',
        ]);
    });

    test('a KJV asked for by name is the KJV, whatever the file is called', () => {
        const under = genBibleImportUnderAnswer(
            genDownloaded({ hasKjv: false }),
            URL_A,
            'the KJV please',
        );
        expect(under.notice).toContain(
            '**Open Worship provides the KJV Bible** — the recommended King ' +
                'James Version',
        );
        expect(findAction(under, 'Create the provided KJV').args).toMatchObject(
            { wantsKjv: true },
        );
    });

    test('a downloaded KJV on a computer that has it: said before the notice', () => {
        const under = genBibleImportUnderAnswer(
            genDownloaded({ title: 'King James Version', hasKjv: true }),
            URL_A,
        );
        expect(String(under.notice).split('\n\n')[0]).toBe(
            '**You already have the KJV Open Worship provides**, installed as ' +
                '**KJV**. There is no need to import this file. To use the ' +
                'file anyway, press a choice below.',
        );
        expect(labelsOf(under)).toEqual(['I agree', 'Cancel']);
    });
});
