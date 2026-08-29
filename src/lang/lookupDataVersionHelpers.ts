import { handleError } from '../helper/errorHelpers';

/**
 * Reading ONLY the `version` number out of the head of a lookup dataset file.
 *
 * The dataset is ~34MB and the entire point of the derived index cache is never
 * to read it again, so "has the dataset changed?" must not be answered by
 * fetching it. Both map files carry `"version"` as their FIRST key, so the
 * answer sits in the first few bytes: the response is streamed, only the head is
 * decoded, and the request is aborted the moment the number is found.
 */

// The key is at the very top of the file by construction. A file that does not
// carry one there must not cost more than this to rule out.
const MAXIMUM_HEAD_LENGTH = 1024;
const VERSION_PATTERN = /"version"\s*:\s*(\d+)/;

export async function readJsonFileVersion(url: string): Promise<number | null> {
    const abortController = new AbortController();
    try {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok || response.body === null) {
            return null;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let headText = '';
        try {
            while (headText.length < MAXIMUM_HEAD_LENGTH) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                headText += decoder.decode(value, { stream: true });
                const matched = VERSION_PATTERN.exec(headText);
                if (matched !== null) {
                    return parseInt(matched[1], 10);
                }
            }
            return null;
        } finally {
            // Aborted, not drained: the remainder is tens of megabytes that
            // nothing asked for.
            abortController.abort();
        }
    } catch (error) {
        handleError(error);
        return null;
    }
}
