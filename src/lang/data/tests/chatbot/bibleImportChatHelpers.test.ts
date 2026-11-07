import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        callTool: vi.fn(),
        requestBibleImport: vi.fn(),
        openBibleSetting: vi.fn(),
        openExternalURL: vi.fn(),
    };
});

vi.mock('../../../../helper/loggerHelpers', () => {
    return { appError: vi.fn() };
});
vi.mock('../../../../chatbot/mcpClient', () => {
    return {
        callTool: mocks.callTool,
        parseToolJson: (text: string) => JSON.parse(text),
    };
});
vi.mock('../../../../setting/bible-setting/bibleImportRequestHelpers', () => {
    return { requestBibleImport: mocks.requestBibleImport };
});
vi.mock('../../../../setting/settingHelpers', () => {
    return { openBibleSetting: mocks.openBibleSetting };
});
vi.mock('../../../../server/appProvider', () => {
    return {
        default: { browserUtils: { openExternalURL: mocks.openExternalURL } },
    };
});

import {
    BIBLE_IMPORT_STEP_TOOL_NAME,
    getBibleImportInputContext,
    checkBibleImportReplyNeedsHelp,
} from '../../../../chatbot/bibleImportChatHelpers';

beforeEach(() => {
    mocks.callTool.mockReset();
    mocks.openExternalURL.mockReset();
});

describe('ordinary replies keep the waiting import state', () => {
    it.each(['๒'])(
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
});
