import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { getSetting, setSetting } from './settingHelpers';

/**
 * Before the reload question an uncaught error raises: would they like the
 * assistant to report it? (2026-10-13, the user's ask with the Unfixable
 * Error dialog circled: _enhance the error handling: ask user to open chatbot
 * for reporting_.) A volunteer told to reload has no way to say what
 * happened, and the broken window IS the evidence -- so the offer comes
 * first, and a yes leaves the window as it is for the assistant to read.
 *
 * In a module of its own so the rule can be held by a test: the dialog is a
 * person's to press, and no automation may answer it.
 */

const ERROR_REPORT_OFFER_SETTING_NAME = 'error-report-offered-at';
// Made once in this long, across reloads: an error that comes back after
// every reload must not add a question to every round.
export const ERROR_REPORT_OFFER_GAP = 1000 * 60 * 10;

/**
 * Asks, and on a yes opens the assistant on the error (after the 🤖's own
 * two questions). Answers whether the assistant was opened: the caller asks
 * about the reload only when it was not.
 */
export async function offerErrorReporting(error: unknown) {
    const offeredAt = Number.parseInt(
        getSetting(ERROR_REPORT_OFFER_SETTING_NAME) ?? '',
    );
    if (Date.now() - offeredAt < ERROR_REPORT_OFFER_GAP) {
        return false;
    }
    setSetting(ERROR_REPORT_OFFER_SETTING_NAME, Date.now().toString());
    const isReporting = await showAppConfirm(
        tran('Something Went Wrong'),
        tran(
            "The app ran into a problem. The assistant can look into it and write a report for you, with this computer's system information and the app's console log in it. Nothing is sent until you say so. Open the assistant to report it?",
        ),
        {
            confirmButtonLabel: 'Report a Problem',
            cancelButtonLabel: 'Not Now',
        },
    );
    if (!isReporting) {
        return false;
    }
    // Loaded at the press: the assistant's own questions and its window
    // opener have no business in every window's start-up.
    const [{ openChatbotReporting }, { toProblemText }] = await Promise.all([
        import('./ai/chatbotHandoffHelpers'),
        import('./ai/chatbotHandoffStoreHelpers'),
    ]);
    return await openChatbotReporting(
        toProblemText(error, document.title.replace(/^.*? - /, '')),
    );
}
