import OpenAI from 'openai';
import { handleError } from './errorHelpers';
import { LocaleType } from '../lang/langHelpers';
import { fsCheckFileExist, fsWriteFile, pathJoin } from '../server/fileHelpers';
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
    key?: string;
};

let openai: OpenAI | null = null;
function getOpenAIInstance() {
    const apiKey = (window as any).openAIAPIKey?.trim();
    if (!apiKey) {
        throw new Error(
            'OpenAI API key is not set. Please set it to `window.openAIAPIKey`',
        );
    }
    if (openai !== null) {
        return openai;
    }
    openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    return openai;
}

export async function textToSpeech({
    text,
    locale,
    key,
}: SpeakableTextDataType) {
    const uuid = key ?? crypto.randomUUID();
    return unlocking(uuid, async () => {
        try {
            const baseDir = await ensureDataDirectory('ai-data');
            if (baseDir === null) {
                showSimpleToast(
                    'Text to Speech',
                    'Fail to ensure data directory for AI data.',
                );
                return null;
            }
            const speechFile = pathJoin(baseDir, `${uuid}.mp3`);
            if (await fsCheckFileExist(speechFile)) {
                return speechFile;
            }
            // voice:
            // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse',
            // 'ballad', 'ash', 'sage', 'marin', and 'cedar'
            const mp3 = await getOpenAIInstance().audio.speech.create({
                model: 'gpt-4o-mini-tts',
                voice: 'ash',
                input: text,
                instructions:
                    `Speak in a calm and peace of scripture reading tone.` +
                    ` Use ${locale} accent.`,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await fsWriteFile(speechFile, buffer);
            return speechFile;
        } catch (error) {
            handleError(error);
        }
        return null;
    });
}

export async function bibleTextToSpeech({
    text,
    bibleKey,
    key,
}: {
    text: string;
    bibleKey: string;
    key?: string;
}) {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        showSimpleToast(
            'Bible Text to Speech',
            `Fail to get Bible info for bible key "${bibleKey}".`,
        );
        return null;
    }
    return textToSpeech({
        text,
        locale: info.locale,
        key,
    });
}
