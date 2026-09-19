import { tran } from '../../lang/langHelpers';
import {
    popupWidgetManager,
    showAppConfirm,
} from '../../popup-widget/popupWidgetHelpers';

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
 */
export type AiWindowKindType = 'assistant' | 'aichat';

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
    return await showAppConfirm(
        tran('Be careful with AI'),
        `${tran('AI can be confidently wrong.')} ${risk}`,
        {
            escToCancel: true,
            cancelButtonLabel: 'Cancel',
            confirmButtonLabel: 'Open',
        },
    );
}
