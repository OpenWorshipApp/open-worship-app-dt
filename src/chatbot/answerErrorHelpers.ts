import { appError } from '../helper/loggerHelpers';
import { fillWords, tran } from './chatTranHelpers';

// What a bug in the window's own code throws, never a sentence for a person.
const CODE_ERROR_TYPE_LIST = [
    TypeError,
    ReferenceError,
    SyntaxError,
    RangeError,
    EvalError,
    URIError,
];

/**
 * The line a question that failed is answered with. A provider's refusal, a
 * key that is missing, a server that is down come as sentences written for
 * the person (`describeLlmError`) and are said after "I could not answer
 * that:". A bug in this window's own code is not one: seen 2026-10-17 as
 * _ខ្ញុំមិនអាចឆ្លើយសំណួរនោះបានទេ៖ DO_ON_ASK_TOOL_SET is not defined_ under
 * 26 Khmer answers, a half-saved edit hot-reloaded into a dev window (EC-324).
 * That goes to the log, and the person reads what to do.
 */
export function describeAnswerError(error: unknown): string {
    if (
        CODE_ERROR_TYPE_LIST.some((type) => {
            return error instanceof type;
        })
    ) {
        appError(error, 'chatbot answer');
        return tran(
            'Something went wrong inside the app while answering that. Ask it again, or press Report to tell the people who make the app.',
        );
    }
    return fillWords(tran('I could not answer that: {reason}'), {
        reason: error instanceof Error ? error.message : String(error),
    });
}
