import OpenAI from 'openai';
import { handleError } from './errorHelpers';
import { LocaleType } from '../lang/langHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsMkDirSync,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { ensureDataDirectory } from '../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { getBibleInfo } from './bible-helpers/bibleInfoHelpers';
import { unlocking } from '../server/unlockingHelpers';

export type BibleTextDataType = {
    text: string;
    bibleKey: string;
    key?: string;
};
export type SpeakableTextDataType = {
    text: string;
    locale: LocaleType;
    filePath: string;
};

export type AudioAISettingType = {
    openAIAPIKey: string;
    isAutoPlay: boolean;
};
const AUDIO_AI_SETTING_NAME = 'audio-ai-setting';
export function getAudioAISetting(): AudioAISettingType {
    const settingStr = localStorage.getItem(AUDIO_AI_SETTING_NAME) || '{}';
    try {
        const data = JSON.parse(settingStr);
        data.openAIAPIKey = (data.openAIAPIKey ?? '').trim();
        return data;
    } catch (_error) {
        return {
            openAIAPIKey: '',
            isAutoPlay: false,
        };
    }
}
export function setAudioAISetting(value: AudioAISettingType) {
    localStorage.setItem(AUDIO_AI_SETTING_NAME, JSON.stringify(value));
}

let openai: OpenAI | null = null;
function getOpenAIInstance() {
    const { openAIAPIKey } = getAudioAISetting();
    if (!openAIAPIKey) {
        showSimpleToast(
            'OpenAI API Key',
            'Please set OpenAI API Key in Audio AI Setting first.',
        );
        return null;
    }
    if (openai !== null) {
        return openai;
    }
    openai = new OpenAI({
        apiKey: openAIAPIKey,
        dangerouslyAllowBrowser: true,
    });
    return openai;
}

export async function textToSpeech({
    text,
    locale,
    filePath,
}: SpeakableTextDataType) {
    return unlocking(filePath, async () => {
        try {
            // voice:
            // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse',
            // 'ballad', 'ash', 'sage', 'marin', and 'cedar'
            if (await fsCheckFileExist(filePath)) {
                return filePath;
            }
            const openAIInstance = getOpenAIInstance();
            if (openAIInstance === null) {
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
            const mp3 = await openAIInstance.audio.speech.create(apiData);
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

export async function bibleTextToSpeech({
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
}) {
    if (getOpenAIInstance() === null) {
        return null;
    }
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        showSimpleToast(
            'Bible Text to Speech',
            `Fail to get Bible info for bible key "${bibleKey}".`,
        );
        return null;
    }
    const baseDir = await ensureDataDirectory('ai-data');
    if (baseDir === null) {
        showSimpleToast(
            'Text to Speech',
            'Fail to ensure data directory for AI data.',
        );
        return null;
    }
    const containingDir = pathJoin(
        baseDir,
        bibleKey,
        bookKey,
        chapter.toString(),
    );
    const fileFullName = `${verse}.mp3`;
    if ((await fsCheckDirExist(containingDir)) === false) {
        fsMkDirSync(containingDir);
    }
    const filePath = pathJoin(containingDir, fileFullName);
    return textToSpeech({
        text,
        locale: info.locale,
        filePath,
    });
}
