import { ResponseFormatJSONSchema } from 'openai/resources/shared';
import { handleError } from '../errorHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';

import { DATA_DIR_NAME, getOpenAIInstance } from './openAIHelpers';
import { bibleCrossRefSchemaJson } from './aiHelpers';
import {
    CrossReferenceType,
    useGetBibleCrossRef,
} from './bibleCrossRefHelpers';
import { cloneJson } from '../helpers';

function genPrompt(bibleTitle: string, additionalData?: CrossReferenceType[]) {
    const extraContext =
        additionalData === null
            ? ''
            : `
    - Consider these existing cross-references for additional context: ${JSON.stringify(additionalData, null, 2)}
    - Use them to enhance the relevance and depth of your references.
    `;
    return `
    You are a Bible cross-reference lookup tool.

    Task:
    Given a Bible verse key (example: Genesis 1:1 for Genesis chapter 1 verse 1), return a JSON array of related cross-reference verses in the Bible.

    Rules:
    - Book names should be fully spelled out in King James Version (e.g., "Genesis" not "Gen") and use standard chapter:verse notation (e.g., "John 3:16")
    - Include both Old and New Testament references where applicable
    - Group references by thematic relevance
    ${extraContext}

    Thematic Categories to Consider:
    - Direct theological concepts (God's attributes, salvation, etc.)
    - Parallel passages or similar language
    - Prophetic/typological connections
    - Doctrinal themes
    - Historical parallels
    - Complementary teachings
    - Contrasting perspectives (if relevant)

    Output format:
    - JSON only, no explanations.
    - Each reference must follow this format: "BOOK CHAPTER:VERSE[-VERSE]".
    - Example output: [{"title":"God as creator", "verses": ["John 1:1-3","Hebrews 11:3","Psalm 33:6"]}]

    Now, return cross-references for: ${bibleTitle}
    `.trim();
}

const clonedBibleCrossRefSchema = cloneJson(bibleCrossRefSchemaJson);
delete (clonedBibleCrossRefSchema as any).$schema;
const responseFormat: ResponseFormatJSONSchema = {
    type: 'json_schema',
    json_schema: {
        name: 'BibleCrossReference',
        description:
            'A schema for the response format of Bible cross-reference lookups.',
        schema: {
            type: 'object',
            properties: {
                result: clonedBibleCrossRefSchema,
            },
            required: ['result'],
            additionalProperties: false,
        },
        strict: true,
    },
};

type CrossRefResultType = { result: CrossReferenceType[] };

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
    additionalData?: CrossReferenceType[],
): Promise<CrossReferenceType[] | null> {
    try {
        const client = getOpenAIInstance();
        if (client === null) {
            return null;
        }
        const content = genPrompt(bibleTitle, additionalData);

        const response = await client.chat.completions.create({
            model: 'gpt-5',
            messages: [{ role: 'user', content }],
            response_format: responseFormat,
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
        return data.result;
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

export function useGetBibleCrossRefOpenAI(
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
