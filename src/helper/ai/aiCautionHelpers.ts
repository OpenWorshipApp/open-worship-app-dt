import { createElement } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    popupWidgetManager,
    showAppConfirm,
} from '../../popup-widget/popupWidgetHelpers';
import AiCautionBodyComp from './AiCautionBodyComp';

/**
 * The caution shown BEFORE either AI window opens, asked for by the user:
 * *when I click the icon I want to see the confirm message of the warning
 * about AI cautious first, then confirm to open*.
 *
 * There is a standing caution inside the assistant's own window already, and
 * it is not the same thing as this one. That one is read once the window is
 * up, by somebody who has already decided to ask; this is the decision
 * itself. A volunteer opening an AI window minutes before a service is
 * exactly the person who needs to be told what it can get wrong, and the
 * moment they can still act on it is before it opens.
 *
 * Two of the three sentences are shared and one is not. The risks genuinely
 * differ -- the assistant can misread THIS app and offer a press that reaches
 * the projector, while the AI Chat window is a stranger's website where the
 * words leave the machine and nothing knows about this app at all -- and one
 * warning vague enough to cover both would have warned about neither.
 *
 * **Either caution can be put away for 30 days** (2026-10-10, the user's ask
 * with both circled in a picture: *it's annoying for some users, let put
 * any button to hide it for a while, e.g. hide for 30 days*). A box on this
 * dialog, a button on the standing one; both write the same setting, the
 * time until which both stay hidden, because somebody who has read one has
 * read the warning. Nothing is hidden for good: the day comes round and the
 * caution is back, which is the point of 30 days rather than a checkbox
 * that means never. The window's own keyless-service warning (where the
 * words GO, not whether an answer is right) hides on a key of its own,
 * `AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING`.
 */
export type AiWindowKindType = 'assistant' | 'aichat';

/** The key: the time (ms since the epoch) until which both cautions stay hidden. */
export const AI_CAUTION_HIDDEN_UNTIL_SETTING = 'ai-caution-hidden-until';
/**
 * The key for the keyless-service warning INSIDE the window (2026-10-20, the
 * user with the notice circled: _shoudl be able to hide it for 30 days_). Its
 * OWN key, not `AI_CAUTION_HIDDEN_UNTIL_SETTING`: the cautions are about
 * whether an answer is RIGHT, this warning about WHERE the words go, and
 * putting the one away says nothing about having read the other. Auto and the
 * free service share the one warning, so one key covers both.
 */
export const AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING =
    'ai-provider-warn-hidden-until';
export const AI_CAUTION_HIDE_DAYS = 30;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

// The browser's own storage, not the app's setting files: this module is
// reached by every window's toolbar and IPC receivers, and the setting store
// drags the file-storage chain (`appLocalStorage` → `storageFileHelpers` →
// `appProvider.pathUtils`) into their static closure -- memory
// `renderer-entry-static-closure` -- which also broke every suite that mocks
// `appProvider` without it. Every page of the app is one origin
// (`https://localhost:3000` in dev, `owa://local` packaged), so a stamp
// written here by the help window is read by the presenter's 🤖. Read and
// written in a try, because the accessor can throw in a private window.
function readHiddenUntilText(key: string): string | null {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    } catch (_error) {
        return null;
    }
}

function writeHiddenUntilText(key: string, value: string) {
    try {
        globalThis.localStorage?.setItem(key, value);
    } catch (_error) {
        // A window that cannot keep it asks again next time, which is safe.
    }
}

function clearHiddenUntilText(key: string) {
    try {
        globalThis.localStorage?.removeItem(key);
    } catch (_error) {
        // Same as above: nothing stored, nothing to clear.
    }
}

/**
 * The time the caution is hidden until, out of the stored value, or null
 * when it is not hidden: nothing stored, a value that is not a time, or one
 * that has passed.
 */
export function readAiCautionHiddenUntil(
    raw: string | null | undefined,
    now = Date.now(),
): number | null {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return null;
    }
    const until = Number(raw);
    return Number.isFinite(until) && until > now ? until : null;
}

export function checkIsAiCautionHidden(now = Date.now()) {
    return (
        readAiCautionHiddenUntil(
            readHiddenUntilText(AI_CAUTION_HIDDEN_UNTIL_SETTING),
            now,
        ) !== null
    );
}

/** Hides both cautions for `AI_CAUTION_HIDE_DAYS` from now; answers the time they come back. */
export function hideAiCautionForAWhile(now = Date.now()) {
    const until = now + AI_CAUTION_HIDE_DAYS * DAY_MILLISECONDS;
    writeHiddenUntilText(AI_CAUTION_HIDDEN_UNTIL_SETTING, String(until));
    return until;
}

/** Whether the window's keyless-service warning is put away right now. */
export function checkIsAiProviderWarnHidden(now = Date.now()) {
    return (
        readAiCautionHiddenUntil(
            readHiddenUntilText(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING),
            now,
        ) !== null
    );
}

/** Puts that warning away for `AI_CAUTION_HIDE_DAYS` from now; answers the time it is back. */
export function hideAiProviderWarnForAWhile(now = Date.now()) {
    const until = now + AI_CAUTION_HIDE_DAYS * DAY_MILLISECONDS;
    writeHiddenUntilText(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING, String(until));
    return until;
}

/**
 * The time a hide runs out, for the Settings → General list of what was put
 * away (2026-10-20, the user's ask: _everything that can be hidden for 30
 * days should be seen in setting general … to be able to restore_).
 */
export function readAiCautionHiddenTime(now = Date.now()) {
    return readAiCautionHiddenUntil(
        readHiddenUntilText(AI_CAUTION_HIDDEN_UNTIL_SETTING),
        now,
    );
}

export function readAiProviderWarnHiddenTime(now = Date.now()) {
    return readAiCautionHiddenUntil(
        readHiddenUntilText(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING),
        now,
    );
}

/** Back before the 30 days are up, from that list. */
export function showAiCautionAgain() {
    clearHiddenUntilText(AI_CAUTION_HIDDEN_UNTIL_SETTING);
}

export function showAiProviderWarnAgain() {
    clearHiddenUntilText(AI_PROVIDER_WARN_HIDDEN_UNTIL_SETTING);
}

export async function askAiCaution(kind: AiWindowKindType) {
    // Fails OPEN, deliberately. `showAppConfirm` answers `false` when the
    // window has no popup host mounted, which is indistinguishable from the
    // user pressing Cancel -- and `lwShare` and `lyricEditor` have none, yet
    // both carry the assistant on Ctrl+Shift+A. Gating on a dialog that
    // cannot be drawn there would make the shortcut silently do nothing,
    // which reads as a broken app rather than as a warning. A window that
    // cannot ask is a window that opens.
    if (popupWidgetManager.openConfirm === null) {
        return true;
    }
    // Put away for a while by the user: the window opens as though it had
    // been answered Open. Read fresh, because the chat window writes it too.
    if (checkIsAiCautionHidden()) {
        return true;
    }
    // Each kind carries its own risk AND its own closing advice. "Read a step
    // before you press it" is the right thing to tell somebody about to be
    // handed steps, and means nothing about a website; a single closer broad
    // enough for both said nothing useful to either.
    const risk =
        kind === 'aichat'
            ? tran(
                  "This opens a company's own chat website: whatever you type" +
                      ' there leaves this computer, and it knows nothing about' +
                      ' this app. Check anything that matters before a' +
                      ' service.',
              )
            : tran(
                  'It can misread the app or describe a button that is not' +
                      ' there, and what it offers to do can reach a live' +
                      ' projector. Check anything that matters before a' +
                      ' service, and read a step yourself before you press it.',
              );
    let isHideTicked = false;
    const isOk = await showAppConfirm(
        tran('Be careful with AI'),
        createElement(AiCautionBodyComp, {
            text: `${tran('AI can be confidently wrong.')} ${risk}`,
            onHideChange: (isHidden: boolean) => {
                isHideTicked = isHidden;
            },
        }),
        {
            escToCancel: true,
            cancelButtonLabel: 'Cancel',
            confirmButtonLabel: 'Open',
        },
    );
    // Only an Open hides it: a box ticked and then cancelled was a change
    // of mind, not a request.
    if (isOk && isHideTicked) {
        hideAiCautionForAWhile();
    }
    return isOk;
}
