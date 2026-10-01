/**
 * The question the app is asking the operator right now, if an agent's action
 * just made it ask one.
 *
 * An agent tool that presents something reads the screens back and answers
 * "done", but presenting can open one of the app's own popups a moment later
 * -- a Bible list's attached white background raises the text-contrast
 * confirm. The tool used to report success with that question sitting
 * unanswered, and a model told the user the verse was up while the operator's
 * window was blocked on a question. The popup is the operator's to answer
 * (the firewall refuses to press it), so the answer only has to SAY it.
 *
 * A leaf: DOM reads only, so the agent workers can import it lazily beside
 * everything else they pull.
 */

export type AgentPendingQuestionType = {
    title: string;
    text: string;
};

const QUESTION_SELECTOR =
    '#app-confirm-popup, #app-alert-popup, #app-input-popup';
// The popups mount lazily and the contrast confirm follows an event, so the
// question can land a beat after the action resolves.
const WAIT_MILLISECONDS = 600;
const POLL_MILLISECONDS = 50;
const TEXT_LIMIT = 200;

function toFlatText(text: string | null | undefined) {
    const flat = (text ?? '').replace(/\s+/g, ' ').trim();
    return flat.length > TEXT_LIMIT
        ? `${flat.slice(0, TEXT_LIMIT).trimEnd()}…`
        : flat;
}

function readQuestion(): AgentPendingQuestionType | null {
    if (typeof document === 'undefined') {
        return null;
    }
    const popup = document.querySelector(QUESTION_SELECTOR);
    if (popup === null) {
        return null;
    }
    return {
        title: toFlatText(
            popup.querySelector('.app-popup-header-title')?.textContent,
        ),
        text: toFlatText(popup.querySelector('.app-popup-body')?.textContent),
    };
}

export async function waitForPendingAppQuestion(
    waitMilliseconds = WAIT_MILLISECONDS,
): Promise<AgentPendingQuestionType | null> {
    const deadline = Date.now() + waitMilliseconds;
    for (;;) {
        const question = readQuestion();
        if (question !== null || Date.now() >= deadline) {
            return question;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, POLL_MILLISECONDS);
        });
    }
}

export function genPendingQuestionNote(question: AgentPendingQuestionType) {
    const words = [question.title, question.text]
        .filter((part) => part.length > 0)
        .join(' -- ');
    return (
        `The app is now asking the operator a question: "${words}". It is ` +
        'theirs to answer -- tell them it is waiting on their screen; do not ' +
        'answer it for them.'
    );
}
