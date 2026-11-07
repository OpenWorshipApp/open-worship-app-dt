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
    describeLangInstallStep,
    findLangInstallTypedPress,
    genLangOfferText,
    readLangInstallAsk,
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
