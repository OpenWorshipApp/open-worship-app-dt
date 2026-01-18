import { handleError } from '../errorHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsDeleteFile,
    fsMkDirSync,
    fsWriteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { ensureDataDirectory } from '../../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getBibleInfo } from '../bible-helpers/bibleInfoHelpers';
import { unlocking } from '../../server/unlockingHelpers';

import { useState } from 'react';
import { useAppEffectAsync, useAppStateAsync } from '../debuggerHelpers';
import BibleItem from '../../bible-list/BibleItem';
import { getLangDataFromBibleKey } from '../bible-helpers/bibleLogicHelpers2';
import { LocaleType } from '../../lang/langHelpers';
import {
    checkIsAvailable,
    DATA_DIR_NAME,
    getOpenAIInstance,
    useAvailable,
} from './openAIHelpers';

export type SpeakableTextDataType = {
    text: string;
    locale: LocaleType;
    filePath: string;
};

export async function textToSpeech(
    { text, locale, filePath }: SpeakableTextDataType,
    isForce = false,
) {
    return unlocking(filePath, async () => {
        try {
            // voice:
            // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse',
            // 'ballad', 'ash', 'sage', 'marin', and 'cedar'
            if (await fsCheckFileExist(filePath)) {
                if (!isForce) {
                    return filePath;
                }
                await fsDeleteFile(filePath);
            }
            const client = getOpenAIInstance();
            if (client === null) {
                return null;
            }
            const apiData = {
                model: 'gpt-4o-mini-tts',
                voice: 'ash',
                input: text,
                instructions:
                    `Speak in a calm and peace of scripture reading tone.` +
                    ` Use ${locale} accent.`,
            };
            const mp3 = await client.audio.speech.create(apiData);
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await fsWriteFile(filePath, buffer);
            return filePath;
        } catch (error) {
            showSimpleToast(
                'Text to Speech',
                'Fail to convert text to speech. Please check your OpenAI ' +
                    'API Key and network connection.',
            );
            handleError(error);
        }
        return null;
    });
}

export async function bibleTextToSpeech(
    {
        text,
        bibleKey,
        bookKey,
        chapter,
        verse,
    }: {
        text: string;
        bibleKey: string;
        bookKey: string;
        chapter: number;
        verse: number;
    },
    isForce?: boolean,
) {
    if (getOpenAIInstance() === null) {
        return null;
    }
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        showSimpleToast(
            'Bible Text to Speech',
            `Fail to get Bible info for bible key "${bibleKey}".`,
        );
        return null;
    }
    const baseDir = await ensureDataDirectory(DATA_DIR_NAME);
    if (baseDir === null) {
        showSimpleToast(
            'Text to Speech',
            'Fail to ensure data directory for AI data.',
        );
        return null;
    }
    const containingDir = pathJoin(
        baseDir,
        'bible-audio',
        bibleKey,
        bookKey,
        chapter.toString(),
    );
    const fileFullName = `${verse}.mp3`;
    if ((await fsCheckDirExist(containingDir)) === false) {
        fsMkDirSync(containingDir);
    }
    const filePath = pathJoin(containingDir, fileFullName);
    return textToSpeech(
        {
            text,
            locale: bibleInfo.locale,
            filePath,
        },
        isForce,
    );
}

export async function checkIsAIAudioAvailableForBible(bibleItem: BibleItem) {
    if (!checkIsAvailable()) {
        return false;
    }
    const langData = await getLangDataFromBibleKey(bibleItem.bibleKey);
    if (langData === null || !langData.bibleAudioAvailable) {
        return false;
    }
    return bibleItem.isAudioEnabled;
}

export function useIsAudioAIEnabled(bibleItem: BibleItem) {
    const [isAvailable] = useAppStateAsync(async () => {
        const langData = await getLangDataFromBibleKey(bibleItem.bibleKey);
        if (langData === null || !langData.bibleAudioAvailable) {
            return false;
        }
        return true;
    }, [bibleItem.bibleKey]);
    const isAPIKeyAvailable = useAvailable();
    const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
    useAppEffectAsync(
        async (methodContext) => {
            const isAudioEnabled =
                await checkIsAIAudioAvailableForBible(bibleItem);
            methodContext.setIsAudioEnabled(isAudioEnabled);
        },
        [bibleItem.isAudioEnabled, bibleItem.bibleKey],
        { setIsAudioEnabled },
    );
    return {
        isAvailable: isAPIKeyAvailable && isAvailable,
        isAudioEnabled,
    };
}
