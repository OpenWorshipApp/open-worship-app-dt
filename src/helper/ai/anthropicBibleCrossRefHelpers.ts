import { DATA_DIR_NAME, getAnthropicInstance } from './anthropicHelpers';
import {
    CrossReferenceType,
    useGetBibleCrossRef,
} from './bibleCrossRefHelpers';

// 'claude-sonnet-4-20250514';
const MODEL = 'claude-sonnet-4-5-20250929';

export class AnthropicBibleCrossReference {
    get anthropic() {
        return getAnthropicInstance();
    }

    generateSystemPrompt(additionalData?: CrossReferenceType[]) {
        const extraContext =
            additionalData === null
                ? ''
                : `
    8. Consider these existing cross-references for additional context: ${JSON.stringify(additionalData, null, 2)}
    9. Use them to enhance the relevance and depth of your references.
    `;
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
${extraContext}

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


## Example format:
[
  {
    "title": "God as Creator",
    "verses": ["Isaiah 44:24", "Nehemiah 9:6", "Psalm 33:6"]
  }
]

Respond ONLY with the JSON array, no additional text or explanation.
`.trim();
    }

    async getBibleCrossResponse(
        bibleTitle: string,
        additionalData?: CrossReferenceType[],
    ) {
        try {
            const userPrompt = `Generate cross-references for: ${bibleTitle}`;
            const anthropic = this.anthropic;
            if (anthropic === null) {
                return {
                    success: false,
                    error: 'Anthropic instance is not available',
                };
            }
            const systemPrompt = this.generateSystemPrompt(additionalData);
            const message = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 8000,
                temperature: 0.3,
                system: systemPrompt,
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
            let responseContent = content.text;

            try {
                responseContent = responseContent.replace('```json', '');
                responseContent = responseContent.replace('```', '');
                responseContent = responseContent.trim();
                const crossReferences = JSON.parse(responseContent);
                return {
                    success: true,
                    verse: bibleTitle,
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

    async generateCrossReferences(bibleTitle: string) {
        const result = await this.getBibleCrossResponse(bibleTitle);
        if (result.success) {
            return result.crossReferences as CrossReferenceType[];
        }
        return null;
    }
}

const instance = new AnthropicBibleCrossReference();

export function getCrossRefs(bibleTitle: string) {
    return instance.generateCrossReferences(bibleTitle);
}

export function useGetBibleCrossRefAnthropic(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    return useGetBibleCrossRef(
        {
            bookKey,
            chapter,
            verseNum,
            dataDir: DATA_DIR_NAME,
        },
        getCrossRefs,
    );
}
