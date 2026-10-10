import { useState } from 'react';

import { useAppEffect } from '../appHooks';
import appProvider from '../../server/appProvider';

/**
 * "The assistant is still working on an answer", told to every window.
 *
 * Asked for by the user (2026-10-09): a question to a slow local model can
 * take minutes, and with the help window behind the app nothing said it was
 * still going. Three places now say so -- the busy tab in the help window,
 * the help window's own title, and the 🤖 that opens it -- and the last one
 * lives in ANOTHER window, so the help window says it here and the main
 * process relays it (`all:app:chatbot-busy` in `electronEventListener.ts`).
 *
 * A leaf on purpose: the 🤖 button is in every top-bar window, and nothing
 * here may pull a model SDK or the chatbot into their start-up.
 */
const CHATBOT_BUSY_BROADCAST_CHANNEL = 'all:app:chatbot-busy';
const CHATBOT_BUSY_RENDERER_CHANNEL = 'main:app:chatbot-busy';
const CHATBOT_BUSY_GET_CHANNEL = 'all:app:get-chatbot-busy';

/** Called by the help window whenever whether ANY of its tabs is busy flips. */
export function notifyChatbotBusy(isBusy: boolean) {
    appProvider.messageUtils.sendData(CHATBOT_BUSY_BROADCAST_CHANNEL, {
        isBusy,
    });
}

/**
 * Whether the help window is working on an answer, kept current. Asked once
 * on mount (a window opened or reloaded mid-answer would otherwise show
 * nothing until the next change), then told.
 *
 * Asked ASYNCHRONOUSLY -- main answers on the same channel it relays on, to
 * this window alone. A synchronous ask blocks the whole window until main
 * replies, and froze every window with a 🤖 the one time it went unanswered
 * (a dev window hot-reloaded ahead of its main process); a point of colour
 * is never worth that.
 */
export function useIsChatbotBusy() {
    const [isBusy, setIsBusy] = useState(false);
    useAppEffect(() => {
        const listener = (_event: unknown, data: any) => {
            setIsBusy(data?.isBusy === true);
        };
        appProvider.messageUtils.listenForData(
            CHATBOT_BUSY_RENDERER_CHANNEL,
            listener,
        );
        // Listening first, so the answer cannot arrive before the ear.
        appProvider.messageUtils.sendData(CHATBOT_BUSY_GET_CHANNEL);
        return () => {
            appProvider.messageUtils.removeListener(
                CHATBOT_BUSY_RENDERER_CHANNEL,
                listener,
            );
        };
    }, []);
    return isBusy;
}
