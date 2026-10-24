/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fsCheckFileExist: vi.fn(async () => false),
    fsDeleteFile: vi.fn(async () => {}),
    fsWriteFile: vi.fn(async () => {}),
    createSpeech: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: vi.fn(async () => true),
    fsCheckFileExist: mocks.fsCheckFileExist,
    fsDeleteFile: mocks.fsDeleteFile,
    fsMkDirSync: vi.fn(),
    fsWriteFile: mocks.fsWriteFile,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./openAIHelpers', () => ({
    getOpenAIInstance: () => ({
        audio: { speech: { create: mocks.createSpeech } },
    }),
}));
vi.mock('../errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../appHooks', () => ({
    useAppEffectAsync: () => {},
    useAppStateAsync: () => [false],
}));
vi.mock('../../setting/directory-setting/directoryHelpers', () => ({
    ensureDataDirectory: vi.fn(async () => '/data'),
}));
vi.mock('../bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: vi.fn(async () => null),
}));
vi.mock('../bible-helpers/bibleStyleHelpers', () => ({
    getLangDataFromBibleKey: vi.fn(async () => null),
}));
vi.mock('./openAIAvailabilityHelpers', () => ({
    checkIsAvailable: () => true,
    DATA_DIR_NAME: 'ai-openai-data',
    useAvailable: () => true,
}));

import { textToSpeech } from './openAIAudioHelpers';

const DATA = {
    text: 'In the beginning God created the heaven and the earth.',
    locale: 'en-US' as const,
    filePath: '/data/ai/bible-audio/NIV/GEN/1/1.mp3',
};

function genSpeechResponse() {
    return { arrayBuffer: async () => new ArrayBuffer(8) };
}

describe('textToSpeech', () => {
    beforeEach(() => {
        mocks.fsCheckFileExist.mockReset();
        mocks.fsCheckFileExist.mockResolvedValue(false);
        mocks.fsDeleteFile.mockClear();
        mocks.fsWriteFile.mockReset();
        // Written once, then it is on disk -- which is what a forced call
        // finds and deletes.
        mocks.fsWriteFile.mockImplementation(async () => {
            mocks.fsCheckFileExist.mockResolvedValue(true);
        });
        mocks.createSpeech.mockReset();
        mocks.createSpeech.mockResolvedValue(genSpeechResponse());
        mocks.showSimpleToast.mockClear();
        mocks.handleError.mockClear();
    });

    test('callers for the same file share one paid request', async () => {
        // Every call for one verse used to enter the lock body on its own; the
        // ones that arrived during a generation waited 60 s and then ran
        // concurrently with it. A double-click fires several at once.
        const first = textToSpeech(DATA);
        const second = textToSpeech(DATA);
        const third = textToSpeech({ ...DATA });
        await vi.waitFor(() => {
            expect(mocks.createSpeech).toHaveBeenCalledTimes(1);
        });

        expect(await first).toBe(DATA.filePath);
        expect(await second).toBe(DATA.filePath);
        expect(await third).toBe(DATA.filePath);
        expect(mocks.createSpeech).toHaveBeenCalledTimes(1);
        expect(mocks.fsWriteFile).toHaveBeenCalledTimes(1);
    });

    test('the in-flight entry is released once the file is written', async () => {
        // The map must not become a cache: a later voice change or a deleted
        // file has to reach the provider again.
        expect(await textToSpeech(DATA)).toBe(DATA.filePath);
        expect(mocks.createSpeech).toHaveBeenCalledTimes(1);

        // The file is gone again (a regenerated voice, a cleaned data dir), so
        // the provider has to be reached once more.
        mocks.fsCheckFileExist.mockResolvedValue(false);
        expect(await textToSpeech(DATA)).toBe(DATA.filePath);
        expect(mocks.createSpeech).toHaveBeenCalledTimes(2);
    });

    test('a forced call waits for the running one and then regenerates', async () => {
        const first = textToSpeech(DATA);
        await vi.waitFor(() => {
            expect(mocks.createSpeech).toHaveBeenCalledTimes(1);
        });
        const forced = textToSpeech(DATA, true);

        expect(await first).toBe(DATA.filePath);
        expect(await forced).toBe(DATA.filePath);
        // Two generations of the same file, one after the other -- never two
        // writing it at once, and never a forced press that silently did
        // nothing.
        expect(mocks.createSpeech).toHaveBeenCalledTimes(2);
        expect(mocks.fsDeleteFile).toHaveBeenCalledTimes(1);
    });

    test('a failure is reported once and returns null', async () => {
        mocks.createSpeech.mockRejectedValue(new Error('no network'));
        expect(await textToSpeech(DATA)).toBeNull();
        expect(mocks.handleError).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledTimes(1);
    });
});
