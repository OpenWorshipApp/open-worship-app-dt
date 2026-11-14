import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A language asked for in the help window, past the paths the main test
// walks: the install press while the tool host is down, a stored step this
// version does not know, and a step that fails inside -- a key the window's
// dictionary lacks, which the app's strict `tran` throws on in dev. Every
// one answers a plain line and never throws. Codes and names are made up.
const mocks = vi.hoisted(() => {
    return { callTool: vi.fn(), appError: vi.fn() };
});

vi.mock('../helper/loggerHelpers', () => {
    return { appError: mocks.appError };
});
vi.mock('./mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => JSON.parse(text),
    };
});

import { setChatTranslator } from './chatTranHelpers';
import {
    LANG_INSTALL_STEP_TOOL_NAME,
    runLangInstallStep,
} from './langInstallChatHelpers';

const SOMETHING_WRONG =
    'Something went wrong on my side. The app may still be starting — ' +
    'try again in a moment. Nothing was installed.';

beforeEach(() => {
    mocks.callTool.mockReset();
    mocks.appError.mockReset();
});

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('the install press', () => {
    it('with the tool host down says it could not, offers it again, and logs why', async () => {
        const failure = new Error('host down');
        mocks.callTool.mockRejectedValueOnce(failure);

        const answer = await runLangInstallStep({
            step: 'install',
            language: 'Xylo',
            langCode: 'xx',
            label: 'Xylo',
        });

        expect(mocks.callTool).toHaveBeenCalledWith('owa_language', {
            action: 'install',
            language: 'xx',
        });
        expect(mocks.appError).toHaveBeenCalledWith(
            failure,
            'language install',
        );
        expect(answer.text).toContain('I could not install Xylo.');
        expect(answer.text).not.toContain('host down');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Install it',
            'Not now',
        ]);
        // The first button asks the same install again.
        expect(answer.actions?.[0]).toEqual({
            label: 'Install it',
            toolName: LANG_INSTALL_STEP_TOOL_NAME,
            args: {
                step: 'install',
                language: 'Xylo',
                langCode: 'xx',
                label: 'Xylo',
            },
        });
    });

    it('a turned-off one that would not turn on offers Enable again', async () => {
        mocks.callTool.mockRejectedValueOnce(new Error('host down'));

        const answer = await runLangInstallStep({
            step: 'install',
            language: 'Xylo',
            langCode: 'xx',
            label: 'Xylo',
            isTurnOn: true,
        });

        expect(answer.text).toContain('Press **Enable** to try again');
        expect(answer.actions?.map((one) => one.label)).toEqual([
            'Enable',
            'Not now',
        ]);
    });
});

describe('a step that cannot be done', () => {
    it('one this version does not know is said plainly, nothing asked', async () => {
        const answer = await runLangInstallStep({
            step: 'upgrade' as any,
            language: 'Xylo',
        });

        expect(answer).toEqual({ text: 'That step is not one I know.' });
        expect(mocks.callTool).not.toHaveBeenCalled();
    });

    it('one that fails inside answers the plain line, logged, never thrown', async () => {
        const missingKey =
            '**{language} is already installed.** To show the app ' +
            'in it, press its name in **Settings → Languages**.';
        const failure = new Error('Translation not found');
        setChatTranslator(
            (text) => {
                if (text === missingKey) {
                    throw failure;
                }
                return text;
            },
            (text) => text,
        );
        mocks.callTool.mockResolvedValueOnce(
            JSON.stringify({ state: 'installed', name: 'Xylo' }),
        );

        const answer = await runLangInstallStep({
            step: 'check',
            language: 'Xylo',
        });

        expect(answer).toEqual({ text: SOMETHING_WRONG });
        expect(mocks.appError).toHaveBeenCalledWith(
            failure,
            'language install check',
        );
    });
});
