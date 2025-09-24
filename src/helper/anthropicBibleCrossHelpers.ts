import Anthropic from '@anthropic-ai/sdk';
import { getAISetting, useAISetting } from './aiHelpers';
import { useState } from 'react';
import { useAppEffect, useAppEffectAsync } from './debuggerHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { ensureDataDirectory } from '../setting/directory-setting/directoryHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsMkDirSync,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { getKJVKeyValue } from './bible-helpers/serverBibleHelpers';
import { extractBibleTitle } from './bible-helpers/serverBibleHelpers2';

const MODEL = 'claude-sonnet-4-20250514';

export class AnthropicBibleCrossReference {
    anthropic: any;
    systemPrompt: string;
    constructor(apiKey: string) {
        this.anthropic = new Anthropic({
            apiKey,
            dangerouslyAllowBrowser: true,
        });
        this.systemPrompt = this.generateSystemPrompt();
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

            const message = await this.anthropic.messages.create({
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

            const responseContent = message.content[0].text;

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

    async generateContextualCrossReferences(
        verseReference: string,
        context: string | null = null,
    ) {
        try {
            let userPrompt = `Generate cross-references for: ${verseReference}`;

            if (context) {
                userPrompt += `\n\nAdditional context: ${context}`;
                userPrompt +=
                    '\n\nConsider this context when selecting and categorizing cross-references.';
            }

            const message = await this.anthropic.messages.create({
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

            const responseContent = message.content[0].text;
            const crossReferences = JSON.parse(responseContent);

            return {
                success: true,
                verse: verseReference,
                context: context,
                crossReferences: crossReferences,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async generateThematicCrossReferences(
        verseReference: string,
        themes: string | string[],
    ) {
        try {
            const themesList = Array.isArray(themes)
                ? themes.join(', ')
                : themes;
            const userPrompt = `Generate cross-references for: ${verseReference}

Focus specifically on these themes: ${themesList}

Organize the cross-references around these themes and related concepts.`;

            const message = await this.anthropic.messages.create({
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

            const responseContent = message.content[0].text;
            const crossReferences = JSON.parse(responseContent);

            return {
                success: true,
                verse: verseReference,
                focusThemes: themes,
                crossReferences: crossReferences,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

export type CrossReferenceType = {
    title: string;
    verses: string[];
};

type ResultType =
    | {
          success: boolean;
          verse: string;
          crossReferences: CrossReferenceType[];
          rawResponse: any;
          error?: any;
          parseError?: any;
          type?: any;
      }
    | {
          success: boolean;
          error: string;
          rawResponse: any;
          parseError: any;
          verse?: any;
          crossReferences?: CrossReferenceType[];
          type?: any;
      }
    | {
          success: boolean;
          error: any;
          type: any;
          verse?: any;
          crossReferences?: CrossReferenceType[];
          rawResponse?: any;
          parseError?: any;
      };
export class BibleCrossReferenceAPI {
    generator: AnthropicBibleCrossReference;
    constructor(apiKey: string) {
        this.generator = new AnthropicBibleCrossReference(apiKey);
    }

    async getCrossReferences(verseReference: string): Promise<ResultType> {
        const result =
            await this.generator.generateCrossReferences(verseReference);

        return result;
    }
}

export async function demonstrateAPI(verseReference: string) {
    const setting = getAISetting();
    const API_KEY = setting.anthropicAPIKey;
    if (!API_KEY) {
        console.error(
            'No API key provided for Anthropic API, please set to window.anthropicAPIKey',
        );
        return;
    }
    const bibleAPI = new BibleCrossReferenceAPI(API_KEY);

    try {
        // Generate cross-references for a single verse
        console.log(
            `----------Generating cross-references for ${verseReference}...----------`,
        );
        const result = await bibleAPI.getCrossReferences(verseReference);
        console.log(JSON.stringify(result, null, 2));

        // Generate thematic cross-references
        console.log(
            `\n----------Generating thematic cross-references for ${verseReference}...----------`,
        );
        const thematicResult =
            await bibleAPI.generator.generateThematicCrossReferences(
                verseReference,
                ["God's love", 'salvation', 'eternal life'],
            );
        console.log(JSON.stringify(thematicResult, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

let instance: BibleCrossReferenceAPI | null = null;
function getAnthropicInstance() {
    const { anthropicAPIKey } = getAISetting();
    if (!anthropicAPIKey) {
        showSimpleToast(
            'Fail to get Anthropic instance',
            'Missing Anthropic API Key.',
        );
        return null;
    }
    if (instance !== null) {
        return instance;
    }
    instance = new BibleCrossReferenceAPI(anthropicAPIKey);
    return instance;
}

function toBibleRefString(bookKey: string, chapter: number, verseNum: number) {
    const kjvKeyValue = getKJVKeyValue();
    const book = kjvKeyValue[bookKey];
    if (book === undefined) {
        return null;
    }
    return `${book} ${chapter}:${verseNum}`;
}

async function getBibleRef(
    bookKey: string,
    chapter: number,
    verseNum: number,
): Promise<CrossReferenceType[] | null> {
    if (getAnthropicInstance() === null) {
        return null;
    }
    const key = toBibleRefString(bookKey, chapter, verseNum);
    if (key === null) {
        return null;
    }
    return unlocking(key, async () => {
        const baseDir = await ensureDataDirectory('anthropic-data');
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
        const data = await getAnthropicInstance()!.getCrossReferences(key);
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

export function useGetBibleRefAnthropic(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const aiSetting = useAISetting();
    useAppEffect(() => {
        instance = null;
    }, [aiSetting.anthropicAPIKey]);
    const [bibleRef, setBibleRef] = useState<
        CrossReferenceType[] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            const data = await getBibleRef(bookKey, chapter, verseNum);
            if (data !== null) {
                for (const crossRef of data) {
                    const verses = await Promise.all(
                        crossRef.verses.map(async (title) => {
                            const extractedData = await extractBibleTitle(
                                'KJV',
                                title,
                            );
                            const { bibleItem } = extractedData.result;
                            if (bibleItem === null) {
                                return null;
                            }
                            const { target } = bibleItem;
                            return `${target.bookKey} ${target.chapter}:${target.verseStart}${
                                target.verseEnd !== target.verseStart
                                    ? `-${target.verseEnd}`
                                    : ''
                            }`;
                        }),
                    );
                    crossRef.verses = verses.filter((item) => {
                        return item !== null;
                    });
                }
            }
            methodContext.setBibleRef(data);
        },
        [bookKey, chapter],
        { setBibleRef },
    );
    return bibleRef;
}
