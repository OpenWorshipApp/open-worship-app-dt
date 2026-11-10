// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    client: null as any,
    isAvailable: true,
    isKeyAvailable: true,
    fsCheckFileExist: vi.fn(),
    fsCheckDirExist: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsMkDirSync: vi.fn(),
    fsWriteFile: vi.fn(),
    createSpeech: vi.fn(),
    showSimpleToast: vi.fn(),
    handleError: vi.fn(),
    ensureDataDirectory: vi.fn(),
    getBibleInfo: vi.fn(),
    getLangDataFromBibleKey: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: h.fsCheckDirExist,
    fsCheckFileExist: h.fsCheckFileExist,
    fsDeleteFile: h.fsDeleteFile,
    fsMkDirSync: h.fsMkDirSync,
    fsWriteFile: h.fsWriteFile,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./openAIHelpers', () => ({
    getOpenAIInstance: () => h.client,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
// One holder at a time is all these tests need; the real lock's waiting is
// not what is under test here.
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return await callback();
    },
}));
vi.mock('../appHooks', async () => {
    const { useEffect, useState } = await import('react');
    function useAppEffectAsync(
        effectMethod: (context: any) => Promise<void>,
        deps: unknown[],
        methods?: Record<string, unknown>,
    ) {
        useEffect(() => {
            void effectMethod({ ...methods });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, deps);
    }
    return {
        useAppEffectAsync,
        useAppStateAsync: (callee: () => Promise<unknown>, deps: unknown[]) => {
            const [value, setValue] = useState<unknown>(undefined);
            useAppEffectAsync(
                async (context) => {
                    context.setValue(await callee());
                },
                deps,
                { setValue },
            );
            return [value, setValue];
        },
    };
});
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
    checkIsAvailable: () => h.isAvailable,
    DATA_DIR_NAME: 'ai-openai-data',
    useAvailable: () => h.isKeyAvailable,
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

function genSpeech(byteLength = 8) {
    return { arrayBuffer: async () => new ArrayBuffer(byteLength) };
}

beforeEach(() => {
    h.client = { audio: { speech: { create: h.createSpeech } } };
    h.isAvailable = true;
    h.isKeyAvailable = true;
    h.fsCheckFileExist.mockResolvedValue(false);
    h.fsCheckDirExist.mockResolvedValue(true);
    h.fsDeleteFile.mockResolvedValue(undefined);
    h.fsWriteFile.mockResolvedValue(undefined);
    h.createSpeech.mockResolvedValue(genSpeech());
    h.ensureDataDirectory.mockResolvedValue('/data/ai-openai-data');
    h.getBibleInfo.mockResolvedValue({ locale: 'xx-XX' });
    h.getLangDataFromBibleKey.mockResolvedValue({ bibleAudioAvailable: true });
});

describe('textToSpeech', () => {
    test('asks for the calm reading voice in the locale and writes the mp3', async () => {
        expect(await textToSpeech(DATA)).toBe(DATA.filePath);
        expect(h.createSpeech).toHaveBeenCalledTimes(1);
        expect(h.createSpeech).toHaveBeenCalledWith({
            model: 'gpt-4o-mini-tts',
            voice: 'ash',
            input: 'Jesus wept.',
            instructions:
                'Speak in a calm and peace of scripture reading tone. ' +
                'Use en-US accent.',
        });
        const [writtenPath, buffer] = h.fsWriteFile.mock.calls[0];
        expect(writtenPath).toBe(DATA.filePath);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect((buffer as Buffer).byteLength).toBe(8);
    });

    test('a file already on disk is handed back without a paid request', async () => {
        h.fsCheckFileExist.mockResolvedValue(true);
        expect(await textToSpeech(DATA)).toBe(DATA.filePath);
        expect(h.createSpeech).not.toHaveBeenCalled();
        expect(h.fsDeleteFile).not.toHaveBeenCalled();
        expect(h.fsWriteFile).not.toHaveBeenCalled();
    });

    test('a forced call deletes the file on disk and asks again', async () => {
        h.fsCheckFileExist.mockResolvedValue(true);
        expect(await textToSpeech(DATA, true)).toBe(DATA.filePath);
        expect(h.fsDeleteFile).toHaveBeenCalledWith(DATA.filePath);
        expect(h.createSpeech).toHaveBeenCalledTimes(1);
    });

    test('no client means no file and no toast', async () => {
        h.client = null;
        expect(await textToSpeech(DATA)).toBeNull();
        expect(h.fsWriteFile).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a forced call waits for the generation in flight before its own', async () => {
        let finishFirst = (_value: unknown) => {};
        h.createSpeech.mockImplementationOnce(() => {
            return new Promise((resolve) => {
                finishFirst = resolve;
            });
        });
        const first = textToSpeech(DATA);
        await vi.waitFor(() => {
            expect(h.createSpeech).toHaveBeenCalledTimes(1);
        });
        const forced = textToSpeech(DATA, true);
        // Still the one request: the forced call is parked behind it.
        await Promise.resolve();
        await Promise.resolve();
        expect(h.createSpeech).toHaveBeenCalledTimes(1);

        finishFirst(genSpeech(4));
        expect(await first).toBe(DATA.filePath);
        expect(await forced).toBe(DATA.filePath);
        expect(h.createSpeech).toHaveBeenCalledTimes(2);
        // Two writes of the file, one after the other.
        expect(h.fsWriteFile).toHaveBeenCalledTimes(2);
        expect((h.fsWriteFile.mock.calls[0][1] as Buffer).byteLength).toBe(4);
        expect((h.fsWriteFile.mock.calls[1][1] as Buffer).byteLength).toBe(8);
    });
});

describe('bibleTextToSpeech', () => {
    const verse = {
        text: 'In the beginning',
        bibleKey: 'KJV',
        bookKey: 'GEN',
        chapter: 1,
        verse: 3,
    };

    test('does nothing without a client', async () => {
        h.client = null;
        expect(await bibleTextToSpeech(verse)).toBeNull();
        expect(h.getBibleInfo).not.toHaveBeenCalled();
        expect(h.createSpeech).not.toHaveBeenCalled();
    });

    test('says which Bible it could not read', async () => {
        h.getBibleInfo.mockResolvedValue(null);
        expect(await bibleTextToSpeech(verse)).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Bible Text to Speech',
            'Fail to get Bible info for bible key "KJV".',
        );
        expect(h.ensureDataDirectory).not.toHaveBeenCalled();
    });

    test('says when the AI data directory cannot be made', async () => {
        h.ensureDataDirectory.mockResolvedValue(null);
        expect(await bibleTextToSpeech(verse)).toBeNull();
        expect(h.ensureDataDirectory).toHaveBeenCalledWith('ai-openai-data');
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Text to Speech',
            'Fail to ensure data directory for AI data.',
        );
        expect(h.createSpeech).not.toHaveBeenCalled();
    });

    test('files the verse by Bible, book and chapter, in the Bible locale', async () => {
        h.fsCheckDirExist.mockResolvedValue(false);
        const expectedDir = '/data/ai-openai-data/bible-audio/KJV/GEN/1';
        expect(await bibleTextToSpeech(verse)).toBe(`${expectedDir}/3.mp3`);
        expect(h.fsMkDirSync).toHaveBeenCalledWith(expectedDir);
        expect(h.createSpeech.mock.calls[0][0]).toMatchObject({
            input: 'In the beginning',
            instructions: expect.stringContaining('Use xx-XX accent.'),
        });
    });

    test('makes no directory that already exists, and passes the force on', async () => {
        h.fsCheckFileExist.mockResolvedValue(true);
        expect(await bibleTextToSpeech(verse, true)).toBe(
            '/data/ai-openai-data/bible-audio/KJV/GEN/1/3.mp3',
        );
        expect(h.fsMkDirSync).not.toHaveBeenCalled();
        expect(h.fsDeleteFile).toHaveBeenCalledTimes(1);
        expect(h.createSpeech).toHaveBeenCalledTimes(1);
    });
});

describe('checkIsAIAudioAvailableForBible', () => {
    test('is the item own switch once the key and the language allow it', async () => {
        expect(
            await checkIsAIAudioAvailableForBible({
                bibleKey: 'KJV',
                isAudioEnabled: true,
            } as any),
        ).toBe(true);
        expect(
            await checkIsAIAudioAvailableForBible({
                bibleKey: 'KJV',
                isAudioEnabled: false,
            } as any),
        ).toBe(false);
        expect(h.getLangDataFromBibleKey).toHaveBeenCalledWith('KJV');
    });

    test('is off without a usable key, never asking the language', async () => {
        h.isAvailable = false;
        expect(
            await checkIsAIAudioAvailableForBible({
                bibleKey: 'KJV',
                isAudioEnabled: true,
            } as any),
        ).toBe(false);
        expect(h.getLangDataFromBibleKey).not.toHaveBeenCalled();
    });

    test('is off for a language with no Bible audio', async () => {
        h.getLangDataFromBibleKey.mockResolvedValue({
            bibleAudioAvailable: false,
        });
        expect(
            await checkIsAIAudioAvailableForBible({
                bibleKey: 'KJV',
                isAudioEnabled: true,
            } as any),
        ).toBe(false);
        h.getLangDataFromBibleKey.mockResolvedValue(null);
        expect(
            await checkIsAIAudioAvailableForBible({
                bibleKey: 'KJV',
                isAudioEnabled: true,
            } as any),
        ).toBe(false);
    });
});

describe('useIsAudioAIEnabled', () => {
    let container: HTMLDivElement;
    let root: Root;

    function ProbeComp({ bibleItem }: Readonly<{ bibleItem: any }>) {
        const { isAvailable, isAudioEnabled } = useIsAudioAIEnabled(bibleItem);
        return (
            <output>{JSON.stringify({ isAvailable, isAudioEnabled })}</output>
        );
    }

    async function renderProbe(bibleItem: any) {
        await act(async () => {
            root.render(<ProbeComp bibleItem={bibleItem} />);
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        return JSON.parse(container.querySelector('output')!.textContent!);
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('is available and enabled for an audio language with a key', async () => {
        expect(
            await renderProbe({ bibleKey: 'KJV', isAudioEnabled: true }),
        ).toEqual({ isAvailable: true, isAudioEnabled: true });
    });

    test('follows the item own switch', async () => {
        expect(
            await renderProbe({ bibleKey: 'KJV', isAudioEnabled: false }),
        ).toEqual({ isAvailable: true, isAudioEnabled: false });
    });

    test('is unavailable for a language with no audio', async () => {
        h.getLangDataFromBibleKey.mockResolvedValue({
            bibleAudioAvailable: false,
        });
        expect(
            await renderProbe({ bibleKey: 'KJV', isAudioEnabled: true }),
        ).toEqual({ isAvailable: false, isAudioEnabled: false });
    });

    test('is unavailable without a key, whatever the language says', async () => {
        h.isKeyAvailable = false;
        expect(
            await renderProbe({ bibleKey: 'KJV', isAudioEnabled: true }),
        ).toEqual({ isAvailable: false, isAudioEnabled: true });
    });
});
