// The AI Chat window's side of a page that tried to open a window on its own.
//
// A link a site opens goes to the person's own browser, and only when the
// person pressed something in the page first (`decideGuestWindowOpen` in
// `electron/aiChatGuestHelpers.ts`). A page that opens one with nothing
// pressed is refused -- and with no word here, a site that looks something up
// for longer than a press lasts would seem to do nothing at all. So the main
// process tells this window, and the window says so on its own line, for the
// tab in front only: a tab behind is a page nobody is looking at.

// Twin of the channel name in `electron/aiChatGuestHelpers.ts`.
export const AI_CHAT_POPUP_REFUSED_CHANNEL = 'app:ai-chat:popup-refused';

export type AiChatPopupRefusedType = {
    // The guest the page is in, by the id `getWebContentsId` answers.
    guestId: number;
    // The host name of the page it tried to open, e.g. `example.com`.
    hostname: string;
};

// A host name is at most 253 characters, so a page cannot make the line
// longer than that.
const MAX_HOSTNAME_LENGTH = 253;

// Long enough to read once, short enough not to sit over the site for good.
export const POPUP_NOTICE_SHOW_MS = 12000;

/** The notice as the main process sent it, or null when it is not one. */
export function toPopupRefused(data: unknown): AiChatPopupRefusedType | null {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const { guestId, hostname } = data as Record<string, unknown>;
    if (
        typeof guestId !== 'number' ||
        !Number.isSafeInteger(guestId) ||
        typeof hostname !== 'string' ||
        hostname.length === 0 ||
        hostname.length > MAX_HOSTNAME_LENGTH
    ) {
        return null;
    }
    return { guestId, hostname };
}

/** Whether a notice is about the tab in front, the only one worth a line. */
export function checkIsPopupRefusedInFront(
    refusal: AiChatPopupRefusedType,
    frontGuestId: number | null,
) {
    return frontGuestId !== null && refusal.guestId === frontGuestId;
}

export function genPopupRefusedText(hostname: string) {
    return (
        `This site tried to open ${hostname} in your browser without a ` +
        'press, so it was not opened. Press the link again if you meant it.'
    );
}
