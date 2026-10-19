import { appError } from '../helper/loggerHelpers';
import { tran } from './chatTranHelpers';

/**
 * The line under the ask box when pointing at a control, or ringing one a
 * chip names, fails. A tool's own error text never reaches the person: it
 * names page files and open windows, which is the app's insides. The reason
 * goes to the log, as `describeActionError` does for a button under an
 * answer; this row had been printing `error.message` since it was written.
 */
export function describeAttachError(error: unknown, toolName: string): string {
    appError(error, `chatbot attach ${toolName}`);
    return tran('I could not do that just now. Try again in a moment.');
}
