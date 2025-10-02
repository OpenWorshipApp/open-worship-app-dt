import { useState } from 'react';

import { ResponseFormatJSONSchema } from 'openai/resources/shared';
import { handleError } from '../errorHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsMkDirSync,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { ensureDataDirectory } from '../../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { unlocking } from '../../server/unlockingHelpers';

import { useAppEffectAsync } from '../debuggerHelpers';
import { DATA_DIR_NAME, getOpenAIInstance } from './openAIHelpers';
import BibleItem from '../../bible-list/BibleItem';

function genPrompt(bibleTitle: string) {
    return `
    You are a Bible cross-reference lookup tool.

    Task:
    Given a Bible verse key (example: Genesis 1:1 for Genesis chapter 1 verse 1), return a JSON array of related cross-reference verses in the Bible.

    Rules:
    - Book names should be fully spelled out in King James Version (e.g., "Genesis" not "Gen") and use standard chapter:verse notation (e.g., "John 3:16")

    Output format:
    - JSON only, no explanations.
    - Each reference must follow this format: "BOOK CHAPTER:VERSE[-VERSE]".
    - Example output: ["John 1:1-3","Hebrews 11:3","Psalm 33:6"]

    Now, return cross-references for: ${bibleTitle}
    `.trim();
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
    bibleTitle: string,
): Promise<CrossRefResultType | null> {
    try {
        const client = getOpenAIInstance();
        if (client === null) {
            return null;
        }
        const content = genPrompt(bibleTitle);
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

async function getBibleCrossRef(
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

export function useGetBibleCrossRefOpenAI(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const [bibleCrossRef, setBibleCrossRef] = useState<
        string[] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            let data = await getBibleCrossRef(bookKey, chapter, verseNum);
            if (data !== null) {
                data = (
                    await Promise.all(
                        data.map(async (title) => {
                            return await BibleItem.bibleTitleToKJVVerseKey(
                                'KJV',
                                title,
                            );
                        }),
                    )
                ).filter((item) => {
                    return item !== null;
                });
            }
            methodContext.setBibleCrossRef(data);
        },
        [bookKey, chapter],
        { setBibleCrossRef: setBibleCrossRef },
    );
    return bibleCrossRef;
}
