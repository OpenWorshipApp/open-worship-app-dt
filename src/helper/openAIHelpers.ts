import OpenAI from 'openai';
import { ResponseFormatJSONSchema } from 'openai/resources/shared';
import { handleError } from './errorHelpers';
import { LocaleType } from '../lang/langHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsMkDirSync,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { ensureDataDirectory } from '../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { getBibleInfo } from './bible-helpers/bibleInfoHelpers';
import { unlocking } from '../server/unlockingHelpers';

import { useState } from 'react';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
} from './debuggerHelpers';
import { kjvBibleInfo } from './bible-helpers/serverBibleHelpers';
import BibleItem from '../bible-list/BibleItem';
import { getLangFromBibleKey } from './bible-helpers/serverBibleHelpers2';

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

export type OpenAISettingType = {
    openAIAPIKey: string;
    anthropicAPIKey: string;
    isAutoPlay: boolean;
};
const DATA_DIR_NAME = 'openai-data';
const AI_SETTING_NAME = 'open-ai-setting';
export function getAISetting(): OpenAISettingType {
    const settingStr = localStorage.getItem(AI_SETTING_NAME) || '{}';
    try {
        const data = JSON.parse(settingStr);
        data.openAIAPIKey = (data.openAIAPIKey ?? '').trim();
        data.anthropicAPIKey = (data.anthropicAPIKey ?? '').trim();
        if (!data.openAIAPIKey) {
            data.isAutoPlay = false;
        }
        return data;
    } catch (_error) {
        return {
            openAIAPIKey: '',
            anthropicAPIKey: '',
            isAutoPlay: false,
        };
    }
}
const changingListener = new Set<() => void>();
export function setAISetting(value: OpenAISettingType) {
    localStorage.setItem(AI_SETTING_NAME, JSON.stringify(value));
    changingListener.forEach((listener) => {
        listener();
    });
}
export function useAISetting() {
    const [setting, setSetting] = useState<OpenAISettingType>(getAISetting());
    useAppEffect(() => {
        const listener = () => {
            setSetting(getAISetting());
        };
        changingListener.add(listener);
        return () => {
            changingListener.delete(listener);
        };
    }, []);
    return setting;
}

let openai: OpenAI | null = null;
function getOpenAIInstance() {
    const { openAIAPIKey } = getAISetting();
    if (!openAIAPIKey) {
        showSimpleToast(
            'Fail to get OpenAI instance',
            'Missing OpenAI API Key.',
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
    return textToSpeech({
        text,
        locale: info.locale,
        filePath,
    });
}

function toTitleCase(str: string) {
    return str.toLocaleLowerCase().replace(/\b\w/g, (char) => {
        return char.toUpperCase();
    });
}
const map = Object.entries(kjvBibleInfo.kjvKeyValue)
    .map(([key, value]) => `${toTitleCase(value)}:${key}`)
    .join(', ');

function genPrompt(verseKey: string) {
    return `
    You are a Bible cross-reference lookup tool.

    Task:
    Given a Bible verse key (example: GEN 1:1 for Genesis chapter 1 verse 1), return a JSON array of related cross-reference verses in the Bible.

    Rules:
    - Use only the following abbreviation map for book names:
    ${map}

    Output format:
    - JSON only, no explanations.
    - Each reference must follow this format: "BOOK ABBR CHAPTER:VERSE[-VERSE]".
    - Example output: ["JHN 1:1-3","HEB 11:3","PSA 33:6"]

    Now, return cross-references for: ${verseKey}
    `;
}

const response_format: ResponseFormatJSONSchema = {
    type: 'json_schema',
    json_schema: {
        name: 'BibleCrossReference',
        description:
            'A schema for the response format of Bible cross-reference lookups.',
        schema: {
            type: 'object',
            properties: {
                result: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
            required: ['result'],
            additionalProperties: false,
        },
        strict: true,
    },
};

type CrossRefResultType = { result: string[] };

/*
gpt-4.1-mini
 Fast, cheaper, and very reliable for JSON compliance.
 Great if you want low latency and cost while keeping accuracy.
 Best balance for production use.
gpt-4.1
 More powerful reasoning, handles complex prompts better.
 Slightly slower and more expensive.
 Best if you need very accurate, nuanced references.
gpt-5 (if available on your plan)
 Strongest overall, especially for structured and knowledge-heavy tasks.
 But may cost more, so best if precision is critical.
 */
export async function getCrossRefs(
    verseKey: string,
): Promise<CrossRefResultType | null> {
    try {
        const client = getOpenAIInstance();
        if (client === null) {
            return null;
        }
        const content = genPrompt(verseKey);
        const response = await client.chat.completions.create({
            model: 'gpt-5',
            messages: [{ role: 'user', content }],
            response_format,
        });

        const raw = response.choices?.[0]?.message?.content;
        if (!raw) {
            return null;
        }
        // Guard: ensure we have valid JSON (strip code fences if any)
        const cleaned = raw
            .trim()
            .replace(/^```json/i, '')
            .replace(/^```/, '')
            .replace(/```$/, '')
            .trim();
        const data = JSON.parse(cleaned) as CrossRefResultType;
        if (!Array.isArray(data.result)) {
            return { result: [] };
        }
        return data;
    } catch (error) {
        console.error('Error in getCrossRefs:', error);
        showSimpleToast(
            'Cross References',
            'Failed to get cross references. ' +
                'Please check your OpenAI API Key and network connection.',
        );
        handleError(error);
        return null;
    }
}

async function getBibleRef(
    bookKey: string,
    chapter: number,
    verseNum: number,
): Promise<string[] | null> {
    if (getOpenAIInstance() === null) {
        return null;
    }
    const key = `${bookKey} ${chapter}:${verseNum}`;
    return unlocking(key, async () => {
        const baseDir = await ensureDataDirectory(DATA_DIR_NAME);
        if (baseDir === null) {
            showSimpleToast(
                'Text to Speech',
                'Fail to ensure data directory for AI data.',
            );
            return null;
        }
        const containingDir = pathJoin(baseDir, 'bible-cross-refs');
        if ((await fsCheckDirExist(containingDir)) === false) {
            fsMkDirSync(containingDir);
        }
        const fileFullName = `${key}.json`;
        const filePath = pathJoin(containingDir, fileFullName);
        if (await fsCheckFileExist(filePath)) {
            try {
                const text = await fsReadFile(filePath);
                const data = JSON.parse(text) as CrossRefResultType;
                if (!Array.isArray(data.result)) {
                    return [];
                }
                return data.result;
            } catch (error) {
                console.error('Error reading cross reference file:', error);
                return null;
            }
        }
        const data = await getCrossRefs(key);
        if (data === null) {
            return null;
        }
        await fsWriteFile(filePath, JSON.stringify(data, null, 2));
        return data.result;
    });
}

export function useGetBibleRefOpenAI(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const aiSetting = useAISetting();
    useAppEffect(() => {
        openai = null;
    }, [aiSetting.openAIAPIKey]);
    const [bibleRef, setBibleRef] = useState<string[] | null | undefined>(
        undefined,
    );
    useAppEffectAsync(
        async (methodContext) => {
            const data = await getBibleRef(bookKey, chapter, verseNum);
            methodContext.setBibleRef(data);
        },
        [bookKey, chapter],
        { setBibleRef },
    );
    return bibleRef;
}

export async function checkIsAIAudioAvailableForBible(bibleItem: BibleItem) {
    const aiSetting = getAISetting();
    if (!aiSetting.openAIAPIKey) {
        return false;
    }
    const langData = await getLangFromBibleKey(bibleItem.bibleKey);
    if (langData === null || !langData.bibleAudioAvailable) {
        return false;
    }
    return bibleItem.isAudioEnabled;
}

export function useIsAudioAIEnabled(bibleItem: BibleItem) {
    const [isAvailable] = useAppStateAsync(async () => {
        const langData = await getLangFromBibleKey(bibleItem.bibleKey);
        if (langData === null || !langData.bibleAudioAvailable) {
            return false;
        }
        return true;
    }, [bibleItem.bibleKey]);
    const aiSetting = useAISetting();
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
        isAvailable: aiSetting.openAIAPIKey && isAvailable,
        isAudioEnabled,
    };
}
