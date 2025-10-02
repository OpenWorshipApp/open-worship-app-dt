import { useState } from 'react';
import { useAppEffectAsync } from './../debuggerHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { ensureDataDirectory } from '../../setting/directory-setting/directoryHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsMkDirSync,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { getKJVKeyValue } from './../bible-helpers/serverBibleHelpers';
import { getAnthropicInstance } from './anthropicHelpers';
import BibleItem from '../../bible-list/BibleItem';

const MODEL = 'claude-sonnet-4-20250514';

export class AnthropicBibleCrossReference {
    systemPrompt: string;
    constructor() {
        this.systemPrompt = this.generateSystemPrompt();
    }

    get anthropic() {
        return getAnthropicInstance();
    }

    generateSystemPrompt() {
        return `
You are a Biblical cross-reference assistant with deep knowledge of Protestant Christian theology and Biblical interpretation of King James Version (KJV). Your task is to provide comprehensive cross-references for any given Bible verse in JSON format.

## Instructions:
1. Use the King James Version (KJV) of the Bible for all references.
2. Analyze the theological themes, concepts, doctrines, and key terms in the input verse
3. Find related verses that share these themes, concepts, or direct textual references
4. Group verses by clear thematic categories (typically 5-8 categories)
5. Use full book names (not abbreviations) for clarity
6. Include both Old and New Testament references where applicable
7. Prioritize verses with strong theological, textual, or typological connections

## Output Format:
Return ONLY a valid JSON array where each object contains:
- "title": A descriptive theme/context for the cross-references
- "verses": An array of Bible verse references that relate to the input verse

## Thematic Categories to Consider:
- Direct theological concepts (God's attributes, salvation, etc.)
- Parallel passages or similar language
- Prophetic/typological connections
- Doctrinal themes
- Historical parallels
- Complementary teachings
- Contrasting perspectives (if relevant)

## Quality Guidelines:
- Each category should have 4-8 relevant verses
- Focus on theologically significant connections
- Include verses that echo similar language or concepts
- Balance between direct references and thematic parallels
- Use clear, descriptive titles that explain the connection
- Ensure all verse references are accurate and properly formatted
- Book names should be fully spelled out in King James Version (e.g., "Genesis" not "Gen") and use standard chapter:verse notation (e.g., "John 3:16")

## Example Input:
"John 3:16"


Example format:
[
  {
    "title": "God as Creator",
    "verses": ["Isaiah 44:24", "Nehemiah 9:6", "Psalm 33:6"]
  }
]

Respond ONLY with the JSON array, no additional text or explanation.
`.trim();
    }

    async generateCrossReferences(
        verseReference: string,
        verseText: string | null = null,
    ) {
        try {
            const userPrompt = verseText
                ? `Generate cross-references for: ${verseReference} - "${verseText}"`
                : `Generate cross-references for: ${verseReference}`;

            const anthropic = this.anthropic;
            if (anthropic === null) {
                return {
                    success: false,
                    error: 'Anthropic instance is not available',
                };
            }

            const message = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 2000,
                temperature: 0.3,
                system: this.systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            });

            const content: any = message.content[0];
            if (content.type !== 'text') {
                return {
                    success: false,
                    error: `Unexpected response format from Anthropic, ${JSON.stringify(
                        message,
                    )}`,
                    type: content.type,
                };
            }
            const responseContent = content.text;

            try {
                const crossReferences = JSON.parse(responseContent);
                return {
                    success: true,
                    verse: verseReference,
                    crossReferences: crossReferences,
                    rawResponse: responseContent,
                };
            } catch (parseError: any) {
                return {
                    success: false,
                    error: 'Failed to parse JSON response',
                    rawResponse: responseContent,
                    parseError: parseError.message,
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                type: error.constructor.name,
            };
        }
    }

    delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async generateMultipleCrossReferences(verseReferences: string[]) {
        const results = [];

        for (const verse of verseReferences) {
            console.log(`Processing ${verse}...`);
            const result = await this.generateCrossReferences(verse);
            results.push(result);

            await this.delay(1000);
        }

        return results;
    }
}

export type CrossReferenceType = {
    title: string;
    verses: string[];
};

const instance = new AnthropicBibleCrossReference();

function toBibleCrossRefString(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const kjvKeyValue = getKJVKeyValue();
    const book = kjvKeyValue[bookKey];
    if (book === undefined) {
        return null;
    }
    return `${book} ${chapter}:${verseNum}`;
}

const DATA_DIR_NAME = 'ai-anthropic-data';

async function getBibleCrossRef(
    bookKey: string,
    chapter: number,
    verseNum: number,
): Promise<CrossReferenceType[] | null> {
    const key = toBibleCrossRefString(bookKey, chapter, verseNum);
    if (key === null) {
        return null;
    }
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
                const data = JSON.parse(text) as CrossReferenceType[];
                return data;
            } catch (error) {
                console.error('Error reading cross reference file:', error);
                return null;
            }
        }
        const data = await instance.generateCrossReferences(key);
        if (data === null || data.crossReferences === undefined) {
            return null;
        }
        await fsWriteFile(
            filePath,
            JSON.stringify(data.crossReferences, null, 2),
        );
        return data.crossReferences;
    });
}

export function useGetBibleCrossRefAnthropic(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const [bibleCrossRef, setBibleCrossRef] = useState<
        CrossReferenceType[] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            const data = await getBibleCrossRef(bookKey, chapter, verseNum);
            if (data !== null) {
                for (const crossRef of data) {
                    const verses = await Promise.all(
                        crossRef.verses.map(async (title) => {
                            return BibleItem.bibleTitleToKJVVerseKey(
                                'KJV',
                                title,
                            );
                        }),
                    );
                    crossRef.verses = verses.filter((item) => {
                        return item !== null;
                    });
                }
            }
            methodContext.setBibleCrossRef(data);
        },
        [bookKey, chapter],
        { setBibleCrossRef },
    );
    return bibleCrossRef;
}
