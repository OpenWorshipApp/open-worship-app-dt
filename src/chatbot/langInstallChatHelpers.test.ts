import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return { callTool: vi.fn() };
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

import {
    LANG_INSTALL_STEP_TOOL_NAME,
    checkChatLanguage,
    checkSaysMoreThanLangOffer,
    describeLangInstallStep,
    findLangInstallTypedPress,
    genLangAskAgainAnswer,
    genLangOfferText,
    genStudyLangOffer,
    readLangInstallAsk,
    readLangOfferReask,
    runLangInstallStep,
    toChatLangLabel,
} from './langInstallChatHelpers';

const MISSING = {
    state: 'missing',
    langCode: 'de',
    name: 'German',
    nativeName: 'Gerlandish',
    size: 14_000_000,
};

beforeEach(() => {
    mocks.callTool.mockReset();
});

describe('readLangInstallAsk', () => {
    it('takes a request to install a language, left with its name', () => {
        expect(readLangInstallAsk('Install the German language')).toEqual({
            step: 'check',
            language: 'German',
        });
        expect(
            readLangInstallAsk('Can you add German language pack for me?'),
        ).toEqual({ step: 'check', language: 'German' });
        expect(
            readLangInstallAsk('download the language Haitian Creole'),
        ).toEqual({ step: 'check', language: 'Haitian Creole' });
    });

    it('leaves a how-to, a Bible, a nameless one and a non-request alone', () => {
        expect(readLangInstallAsk('How do I install a language?')).toBeNull();
        expect(
            readLangInstallAsk('Install a German Bible language'),
        ).toBeNull();
        expect(readLangInstallAsk('Install a language')).toBeNull();
        expect(readLangInstallAsk('German language')).toBeNull();
        expect(readLangInstallAsk('/lang install German')).toBeNull();
    });
});

describe('the offer', () => {
    it('names the language as the Languages tab does, with the size', () => {
        expect(toChatLangLabel(MISSING as any)).toBe('Gerlandish (German)');
        expect(
            toChatLangLabel({
                state: 'missing',
                name: 'Xylo',
                nativeName: 'Xylo',
            }),
        ).toBe('Xylo');
        const text = genLangOfferText(MISSING as any);
        expect(text).toContain(
            '**Gerlandish (German) is not installed in this app yet.**',
        );
        expect(text).toContain('a download of 13 MB');
        expect(text).toContain(
            'does not change the language the app is shown in',
        );
        expect(
            genLangOfferText({ ...(MISSING as any), state: 'turned-off' }),
        ).toContain('is installed but turned off');
    });

    it('a check that cannot be made is null, never a throw', async () => {
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        expect(await checkChatLanguage('German')).toBeNull();
        mocks.callTool.mockResolvedValueOnce('null');
        expect(await checkChatLanguage('German')).toBeNull();
    });
});

describe('runLangInstallStep', () => {
    it('offers a missing language with buttons no model can press', async () => {
        mocks.callTool.mockResolvedValueOnce(JSON.stringify(MISSING));
        const answer = await runLangInstallStep({
            step: 'check',
            language: 'German',
        });
        expect(mocks.callTool).toHaveBeenCalledWith('owa_language', {
            action: 'check',
            language: 'German',
        });
        expect(answer.text).toContain('is not installed in this app yet');
        expect(answer.actions?.map((one) => [one.label, one.toolName])).toEqual(
            [
                ['Install it', LANG_INSTALL_STEP_TOOL_NAME],
                ['Not now', LANG_INSTALL_STEP_TOOL_NAME],
            ],
        );
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ state: 'installed', installed: 'de' }),
        );
        const done = await runLangInstallStep(answer.actions![0].args);
        expect(mocks.callTool).toHaveBeenLastCalledWith('owa_language', {
            action: 'install',
            language: 'de',
        });
        expect(done.text).toBe('**Done — Gerlandish (German) is ready.**');
        expect((await runLangInstallStep(answer.actions![1].args)).text).toBe(
            'Stopped. Nothing was installed.',
        );
    });

    it('a failed install offers it again', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'failed' }),
        );
        const answer = await runLangInstallStep({
            step: 'install',
            language: 'German',
            langCode: 'de',
            label: 'Gerlandish (German)',
        });
        expect(answer.text).toContain(
            'I could not install Gerlandish (German).',
        );
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Install it',
            'Not now',
        ]);
    });

    it('says an installed, an unknown and an unreachable one plainly', async () => {
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({
                state: 'installed',
                name: 'Dutch',
                nativeName: 'Dutch',
            }),
        );
        expect(
            (await runLangInstallStep({ step: 'check', language: 'Dutch' }))
                .text,
        ).toContain('**Dutch is already installed.**');
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ state: 'unknown' }),
        );
        expect(
            (await runLangInstallStep({ step: 'check', language: 'Zorbish' }))
                .text,
        ).toContain('I could not find “Zorbish” in the list of languages.');
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));
        const down = await runLangInstallStep({
            step: 'check',
            language: 'German',
        });
        expect(down.text).toContain('Something went wrong on my side');
        expect(down.text).not.toContain('host down');
    });

    it('says what it is doing while it installs', () => {
        expect(
            describeLangInstallStep({
                step: 'install',
                language: 'German',
                label: 'Gerlandish (German)',
            }),
        ).toBe('Installing Gerlandish (German) — this can take a minute');
        expect(
            describeLangInstallStep({ step: 'check', language: 'German' }),
        ).toBeNull();
    });
});

describe('findLangInstallTypedPress', () => {
    const actions = [
        {
            label: 'Install it',
            toolName: LANG_INSTALL_STEP_TOOL_NAME,
            args: { step: 'install', language: 'German', langCode: 'de' },
        },
        {
            label: 'Not now',
            toolName: LANG_INSTALL_STEP_TOOL_NAME,
            args: { step: 'skip', language: 'German' },
        },
    ];

    it('a yes, a no or the button’s own words press it', () => {
        expect(findLangInstallTypedPress(actions, 'Yes!')?.step).toBe(
            'install',
        );
        expect(findLangInstallTypedPress(actions, 'not now')?.step).toBe(
            'skip',
        );
        expect(findLangInstallTypedPress(actions, 'no')?.step).toBe('skip');
        expect(findLangInstallTypedPress(actions, 'Install it')?.step).toBe(
            'install',
        );
    });

    it('anything else, or another answer’s buttons, is not a press', () => {
        expect(findLangInstallTypedPress(actions, 'what is it?')).toBeNull();
        expect(
            findLangInstallTypedPress(
                [{ label: 'Install it', toolName: 'other', args: {} }],
                'yes',
            ),
        ).toBeNull();
        expect(findLangInstallTypedPress(undefined, 'yes')).toBeNull();
    });
});

describe('a study translation waiting for its language (EC-494)', () => {
    const OFFER = { check: MISSING, packageCode: 'de' } as any;
    const QUESTION = 'Translate the study into German and add it under';

    it('draws a model’s words over the offer only when they say more than its one sentence', () => {
        // The sentence it was asked for, live (two sentences, one line).
        for (const said of [
            '',
            'The app cannot translate the content to German because the ' +
                'language is not yet installed; please use the buttons ' +
                'below my answer to install it first.',
            'Serbian is not yet enabled in the app, so the translation ' +
                'cannot be performed. Please turn it on first using the ' +
                'prompt below.',
        ]) {
            expect(checkSaysMoreThanLangOffer(said)).toBe(false);
        }
        // Another part of the question answered beside it.
        expect(
            checkSaysMoreThanLangOffer(
                'All 22 references are right.\n\nGerman is not installed, ' +
                    'so the translation waits.',
            ),
        ).toBe(true);
        expect(checkSaysMoreThanLangOffer(`${'word '.repeat(61)}.`)).toBe(true);
    });

    it('offers to install a missing one, the download said, each button carrying the question', () => {
        const answer = genStudyLangOffer(OFFER, QUESTION);
        expect(answer.text).toBe(
            '**Gerlandish (German) is not installed in this app yet.** ' +
                'Install it first? Then the translation uses the words of ' +
                'the Gerlandish (German) Bible. It is a download of 13 MB ' +
                'from Open Worship. It does not change the language the app ' +
                'is shown in.',
        );
        expect(
            answer.actions?.map((one) => [one.label, one.toolName, one.args]),
        ).toEqual([
            [
                'Install it',
                LANG_INSTALL_STEP_TOOL_NAME,
                {
                    step: 'install',
                    language: 'German',
                    langCode: 'de',
                    label: 'Gerlandish (German)',
                    question: QUESTION,
                    skipLangOffer: 'de',
                },
            ],
            [
                'Not now',
                LANG_INSTALL_STEP_TOOL_NAME,
                {
                    step: 'skip',
                    language: 'German',
                    question: QUESTION,
                    skipLangOffer: 'de',
                },
            ],
        ]);
    });

    it('offers to turn on one turned off, with no download said', () => {
        const answer = genStudyLangOffer(
            { ...OFFER, check: { ...MISSING, state: 'turned-off' } },
            QUESTION,
        );
        expect(answer.text).toBe(
            '**Gerlandish (German) is installed but turned off.** Turn it ' +
                'on first? Then the translation uses the words of the ' +
                'Gerlandish (German) Bible.',
        );
        expect(answer.actions?.[0].label).toBe('Enable');
        expect(answer.actions?.[0].args).toMatchObject({
            step: 'install',
            isTurnOn: true,
            question: QUESTION,
        });
    });

    it('installed: ready, with Ask again carrying the question; a failure keeps it on both buttons', async () => {
        const [install, skip] = genStudyLangOffer(OFFER, QUESTION).actions!;
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ state: 'installed', installed: 'de' }),
        );
        const done = await runLangInstallStep(install.args);
        expect(done.text).toBe(
            '**Done — Gerlandish (German) is ready.** This window refreshes ' +
                'in a moment. Then press **Ask again** to translate the study.',
        );
        expect(done.actions?.map((one) => [one.label, one.args])).toEqual([
            [
                'Ask again',
                { step: 'ask', language: 'German', question: QUESTION },
            ],
        ]);
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ problem: 'failed' }),
        );
        const failed = await runLangInstallStep(install.args);
        expect(failed.actions?.map((one) => one.args)).toEqual([
            install.args,
            skip.args,
        ]);
    });

    it('a press with a question waiting asks it again: Not now going on without the language', () => {
        const [install, skip] = genStudyLangOffer(OFFER, QUESTION).actions!;
        expect(readLangOfferReask(skip.args)).toEqual({
            question: QUESTION,
            skipLangOffer: 'de',
        });
        expect(
            readLangOfferReask(
                genLangAskAgainAnswer('German', QUESTION).actions![0].args,
            ),
        ).toEqual({ question: QUESTION });
        // The install itself, and a language asked for in so many words.
        expect(readLangOfferReask(install.args)).toBeNull();
        expect(
            readLangOfferReask({ step: 'skip', language: 'German' }),
        ).toBeNull();
        expect(
            readLangOfferReask({
                step: 'skip',
                language: 'German',
                question: '  ',
            }),
        ).toBeNull();
    });

    it('typed: a yes presses Install it, a no Not now, and a yes under ready Ask again', () => {
        const actions = genStudyLangOffer(OFFER, QUESTION).actions;
        expect(findLangInstallTypedPress(actions, 'yes')?.step).toBe('install');
        expect(findLangInstallTypedPress(actions, 'not now')).toMatchObject({
            step: 'skip',
            question: QUESTION,
        });
        const askAgain = genLangAskAgainAnswer('German', QUESTION).actions;
        expect(findLangInstallTypedPress(askAgain, 'ok')).toEqual({
            step: 'ask',
            language: 'German',
            question: QUESTION,
        });
        expect(findLangInstallTypedPress(askAgain, 'Ask again')?.step).toBe(
            'ask',
        );
        expect(findLangInstallTypedPress(askAgain, 'no')).toBeNull();
    });
});
