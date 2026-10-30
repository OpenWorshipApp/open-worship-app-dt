// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    fsCheckDirExist: vi.fn(),
    fsCheckFileExist: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsMkDirSync: vi.fn(),
    fsWriteFile: vi.fn(),
    getOpenAIInstance: vi.fn(),
    createSpeech: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
    ensureDataDirectory: vi.fn(),
    getBibleInfo: vi.fn(),
    getLangDataFromBibleKey: vi.fn(),
    checkIsAvailable: vi.fn(),
    useAvailable: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: h.fsCheckDirExist,
    fsCheckFileExist: h.fsCheckFileExist,
    fsDeleteFile: h.fsDeleteFile,
    fsMkDirSync: h.fsMkDirSync,
    fsWriteFile: h.fsWriteFile,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./openAIHelpers', () => ({ getOpenAIInstance: h.getOpenAIInstance }));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: (_key: string, callback: () => Promise<unknown>) => callback(),
}));
// `appHooks` reads these two flags at module load and per effect.
vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../setting/directory-setting/directoryHelpers', () => ({
    ensureDataDirectory: h.ensureDataDirectory,
}));
vi.mock('../bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfo,
}));
vi.mock('../bible-helpers/bibleStyleHelpers', () => ({
    getLangDataFromBibleKey: h.getLangDataFromBibleKey,
}));
vi.mock('./openAIAvailabilityHelpers', () => ({
    checkIsAvailable: h.checkIsAvailable,
    DATA_DIR_NAME: 'ai-openai-data',
    useAvailable: h.useAvailable,
}));

import {
    bibleTextToSpeech,
    checkIsAIAudioAvailableForBible,
    textToSpeech,
    useIsAudioAIEnabled,
} from './openAIAudioHelpers';

const DATA = {
    text: 'Jesus wept.',
    locale: 'en-US' as const,
    filePath: '/data/ai-openai-data/bible-audio/KJV/JHN/11/35.mp3',
};

function genSpeechResponse() {
    return { arrayBuffer: async () => new ArrayBuffer(4) };
}

function genDeferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

beforeEach(() => {
    h.fsCheckFileExist.mockResolvedValue(false);
    h.fsCheckDirExist.mockResolvedValue(true);
    h.fsDeleteFile.mockResolvedValue(undefined);
    h.fsWriteFile.mockResolvedValue(undefined);
    h.createSpeech.mockResolvedValue(genSpeechResponse());
    h.getOpenAIInstance.mockReturnValue({
        audio: { speech: { create: h.createSpeech } },
    });
    h.ensureDataDirectory.mockResolvedValue('/data/ai-openai-data');
    h.getBibleInfo.mockResolvedValue({ locale: 'km' });
    h.getLangDataFromBibleKey.mockResolvedValue({ bibleAudioAvailable: true });
    h.checkIsAvailable.mockReturnValue(true);
    h.useAvailable.mockReturnValue(true);
});

describe('textToSpeech', () => {
    test('a file already on disk is the answer, with no paid request', async () => {
        h.fsCheckFileExist.mockResolvedValue(true);
        expect(await textToSpeech(DATA)).toBe(DATA.filePath);
        expect(h.createSpeech).not.toHaveBeenCalled();
        expect(h.fsDeleteFile).not.toHaveBeenCalled();
        expect(h.fsWriteFile).not.toHaveBeenCalled();
    });

    test('no OpenAI client means no file and no write', async () => {
        h.getOpenAIInstance.mockReturnValue(null);
        expect(await textToSpeech(DATA)).toBeNull();
        expect(h.fsWriteFile).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a forced call waits for the running generation before its own', async () => {
        const firstAnswer = genDeferred<ReturnType<typeof genSpeechResponse>>();
        h.createSpeech.mockReturnValueOnce(firstAnswer.promise);
        const first = textToSpeech(DATA);
        await vi.waitFor(() => {
            expect(h.createSpeech).toHaveBeenCalledTimes(1);
        });

        const forced = textToSpeech(DATA, true);
        await Promise.resolve();
        // Still waiting on the first: nothing of its own has started.
        expect(h.createSpeech).toHaveBeenCalledTimes(1);

        // The first wrote its file, so the forced run deletes it first.
        h.fsCheckFileExist.mockResolvedValue(true);
        firstAnswer.resolve(genSpeechResponse());
        expect(await first).toBe(DATA.filePath);
        expect(await forced).toBe(DATA.filePath);
        expect(h.createSpeech).toHaveBeenCalledTimes(2);
        expect(h.fsDeleteFile).toHaveBeenCalledWith(DATA.filePath);
        expect(h.fsWriteFile).toHaveBeenCalledTimes(2);
    });
});

describe('bibleTextToSpeech', () => {
    const VERSE = {
        text: 'ព្រះយេស៊ូទ្រង់ព្រះកន្សែង',
        bibleKey: 'KHOV',
        bookKey: 'JHN',
        chapter: 11,
        verse: 35,
    };

    test('asks nothing when there is no OpenAI client', async () => {
        h.getOpenAIInstance.mockReturnValue(null);
        expect(await bibleTextToSpeech(VERSE)).toBeNull();
        expect(h.getBibleInfo).not.toHaveBeenCalled();
    });

    test('says so when the Bible cannot be read', async () => {
        h.getBibleInfo.mockResolvedValue(null);
        expect(await bibleTextToSpeech(VERSE)).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Bible Text to Speech',
            'Fail to get Bible info for bible key "KHOV".',
        );
        expect(h.createSpeech).not.toHaveBeenCalled();
    });

    test('says so when the data folder cannot be made', async () => {
        h.ensureDataDirectory.mockResolvedValue(null);
        expect(await bibleTextToSpeech(VERSE)).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Text to Speech',
            'Fail to ensure data directory for AI data.',
        );
        expect(h.ensureDataDirectory).toHaveBeenCalledWith('ai-openai-data');
    });

    test('files the verse under its Bible, book and chapter, read in its language', async () => {
        h.fsCheckDirExist.mockResolvedValue(false);
        const filePath = await bibleTextToSpeech(VERSE);

        const chapterDir = '/data/ai-openai-data/bible-audio/KHOV/JHN/11';
        expect(h.fsMkDirSync).toHaveBeenCalledWith(chapterDir);
        expect(filePath).toBe(`${chapterDir}/35.mp3`);
        expect(h.createSpeech).toHaveBeenCalledWith(
            expect.objectContaining({
                input: VERSE.text,
                instructions: expect.stringContaining('Use km accent.'),
            }),
        );
        expect(h.fsWriteFile).toHaveBeenCalledWith(
            `${chapterDir}/35.mp3`,
            expect.any(Buffer),
        );
    });

    test('an existing chapter folder is not made again', async () => {
        await bibleTextToSpeech({ ...VERSE, verse: 36 });
        expect(h.fsMkDirSync).not.toHaveBeenCalled();
    });
});

describe('checkIsAIAudioAvailableForBible', () => {
    const bibleItem = { bibleKey: 'KJV', isAudioEnabled: true } as any;

    test('is false without an OpenAI key, before reading the Bible', async () => {
        h.checkIsAvailable.mockReturnValue(false);
        expect(await checkIsAIAudioAvailableForBible(bibleItem)).toBe(false);
        expect(h.getLangDataFromBibleKey).not.toHaveBeenCalled();
    });

    test('is false for a language with no Bible audio', async () => {
        h.getLangDataFromBibleKey.mockResolvedValue({
            bibleAudioAvailable: false,
        });
        expect(await checkIsAIAudioAvailableForBible(bibleItem)).toBe(false);
        h.getLangDataFromBibleKey.mockResolvedValue(null);
        expect(await checkIsAIAudioAvailableForBible(bibleItem)).toBe(false);
    });

    test('otherwise follows the item’s own switch', async () => {
        expect(await checkIsAIAudioAvailableForBible(bibleItem)).toBe(true);
        expect(
            await checkIsAIAudioAvailableForBible({
                ...bibleItem,
                isAudioEnabled: false,
            }),
        ).toBe(false);
        expect(h.getLangDataFromBibleKey).toHaveBeenCalledWith('KJV');
    });
});

describe('useIsAudioAIEnabled', () => {
    let host: HTMLDivElement;
    let root: Root;
    let seen: {
        isAvailable: boolean | null | undefined;
        isAudioEnabled: boolean;
    }[];

    function ProbeComp({ bibleItem }: Readonly<{ bibleItem: any }>) {
        seen.push(useIsAudioAIEnabled(bibleItem));
        return null;
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        seen = [];
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    test('is available and on for an audio Bible with a key and the switch on', async () => {
        await act(async () =>
            root.render(
                <ProbeComp
                    bibleItem={{ bibleKey: 'KJV', isAudioEnabled: true }}
                />,
            ),
        );
        expect(seen.at(-1)).toEqual({
            isAvailable: true,
            isAudioEnabled: true,
        });
    });

    test('is unavailable without a key, whatever the language says', async () => {
        h.useAvailable.mockReturnValue(false);
        h.checkIsAvailable.mockReturnValue(false);
        await act(async () =>
            root.render(
                <ProbeComp
                    bibleItem={{ bibleKey: 'KJV', isAudioEnabled: true }}
                />,
            ),
        );
        expect(seen.at(-1)).toEqual({
            isAvailable: false,
            isAudioEnabled: false,
        });
    });

    test('is unavailable for a language with no Bible audio', async () => {
        h.getLangDataFromBibleKey.mockResolvedValue({
            bibleAudioAvailable: false,
        });
        await act(async () =>
            root.render(
                <ProbeComp
                    bibleItem={{ bibleKey: 'XYZ', isAudioEnabled: true }}
                />,
            ),
        );
        expect(seen.at(-1)).toEqual({
            isAvailable: false,
            isAudioEnabled: false,
        });
    });

    test('follows the item when its switch is turned off', async () => {
        await act(async () =>
            root.render(
                <ProbeComp
                    bibleItem={{ bibleKey: 'KJV', isAudioEnabled: true }}
                />,
            ),
        );
        expect(seen.at(-1)?.isAudioEnabled).toBe(true);
        await act(async () =>
            root.render(
                <ProbeComp
                    bibleItem={{ bibleKey: 'KJV', isAudioEnabled: false }}
                />,
            ),
        );
        expect(seen.at(-1)).toEqual({
            isAvailable: true,
            isAudioEnabled: false,
        });
    });
});
