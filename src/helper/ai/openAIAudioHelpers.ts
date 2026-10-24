import { useState } from 'react';

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

import { useAppEffectAsync, useAppStateAsync } from '../appHooks';
import type BibleItem from '../../bible-list/BibleItem';
import type { LocaleType } from '../../lang/langHelpers';
import { tran } from '../../lang/langHelpers';
// Availability and the folder name come from the light module: this file is
// reached by components that only DRAW an audio control (AudioAIEnablingComp,
// and through it the bible view's title row), and importing `openAIHelpers`
// here put the OpenAI SDK in their chunk -- which is how the Presenter came to
// fetch it on a cold boot with no key set. The SDK is loaded below, at the two
// places that actually call it.
import {
    checkIsAvailable,
    DATA_DIR_NAME,
    useAvailable,
} from './openAIAvailabilityHelpers';
import { getLangDataFromBibleKey } from '../bible-helpers/bibleStyleHelpers';

export type SpeakableTextDataType = {
    text: string;
    locale: LocaleType;
    filePath: string;
};

/**
 * One generation in flight per audio file, joined by every later caller.
 *
 * `unlocking` below serializes the WRITE, but a caller that arrives while the
 * file is being generated waits for the lock, gives up when `unlocking`'s
 * escape hatch opens, and then runs its own paid request CONCURRENTLY with the
 * first. A double-click on a verse fires several of these calls at once, which
 * is how one verse was billed three times while two callers sat under a 60 s
 * spinner and the console logged `still locked after 600 attempts`.
 *
 * Short-lived by construction: an entry exists only while the request is on the
 * wire and is dropped in the `finally`, so nothing accumulates as verses are
 * played.
 */
const inFlightMap = new Map<string, Promise<string | null>>();

async function generateSpeech(
    { text, locale, filePath }: SpeakableTextDataType,
    isForce: boolean,
) {
    return unlocking('tts-' + filePath, async () => {
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
            const { getOpenAIInstance } = await import('./openAIHelpers');
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
                tran('Text to Speech'),
                'Fail to convert text to speech. Please check your OpenAI ' +
                    'API Key and network connection.',
            );
            handleError(error);
        }
        return null;
    });
}

export async function textToSpeech(
    data: SpeakableTextDataType,
    isForce = false,
) {
    const key = 'tts-' + data.filePath;
    while (true) {
        const inFlight = inFlightMap.get(key);
        if (inFlight === undefined) {
            break;
        }
        if (!isForce) {
            // The same file is already being written, which is all this caller
            // wants; its own request would only race the running one.
            return inFlight;
        }
        // A regeneration waits for the run it would otherwise race and then
        // does its own -- two concurrent writes to one file is what the lock
        // could not prevent once it gave up waiting.
        await inFlight;
    }
    const promise = generateSpeech(data, isForce);
    inFlightMap.set(key, promise);
    try {
        return await promise;
    } finally {
        inFlightMap.delete(key);
    }
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
    const { getOpenAIInstance } = await import('./openAIHelpers');
    if (getOpenAIInstance() === null) {
        return null;
    }
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        showSimpleToast(
            tran('Bible Text to Speech'),
            `Fail to get Bible info for bible key "${bibleKey}".`,
        );
        return null;
    }
    const baseDir = await ensureDataDirectory(DATA_DIR_NAME);
    if (baseDir === null) {
        showSimpleToast(
            tran('Text to Speech'),
            tran('Fail to ensure data directory for AI data.'),
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
    if (!langData?.bibleAudioAvailable) {
        return false;
    }
    return bibleItem.isAudioEnabled;
}

export function useIsAudioAIEnabled(bibleItem: BibleItem) {
    const [isAvailable] = useAppStateAsync(async () => {
        const langData = await getLangDataFromBibleKey(bibleItem.bibleKey);
        if (!langData?.bibleAudioAvailable) {
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
