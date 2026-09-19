import { useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import appProvider from '../server/appProvider';
import {
    AI_CHAT_POPUP_REFUSED_CHANNEL,
    checkIsPopupRefusedInFront,
    genPopupRefusedText,
    POPUP_NOTICE_SHOW_MS,
    toPopupRefused,
} from './aiChatPopupHelpers';

type ShownNoticeType = { hostname: string; sessionId: string };

/**
 * The line that says a page was not opened. It is not a question: nothing
 * here opens the page, because the address is the site's word and the way to
 * open it is the person's own press on the link. So it takes no focus from
 * the site, and it goes away on its own and with the tab it was about.
 */
export default function RenderAiChatPopupNoticeComp({
    activeId,
    getFrontGuestId,
}: Readonly<{
    activeId: string;
    getFrontGuestId: () => number | null;
}>) {
    const [notice, setNotice] = useState<ShownNoticeType | null>(null);
    const activeIdRef = useAppCurrentRef(activeId);
    const getFrontGuestIdRef = useAppCurrentRef(getFrontGuestId);
    useAppEffect(() => {
        const { messageUtils } = appProvider;
        const handleRefused = (_event: unknown, data: unknown) => {
            const refusal = toPopupRefused(data);
            if (
                refusal === null ||
                !checkIsPopupRefusedInFront(
                    refusal,
                    getFrontGuestIdRef.current(),
                )
            ) {
                return;
            }
            setNotice({
                hostname: refusal.hostname,
                sessionId: activeIdRef.current,
            });
        };
        messageUtils.listenForData(
            AI_CHAT_POPUP_REFUSED_CHANNEL,
            handleRefused,
        );
        return () => {
            messageUtils.removeListener(
                AI_CHAT_POPUP_REFUSED_CHANNEL,
                handleRefused,
            );
        };
    }, []);
    useAppEffect(() => {
        if (notice === null) {
            return;
        }
        if (notice.sessionId !== activeId) {
            setNotice(null);
            return;
        }
        const timer = setTimeout(() => {
            setNotice(null);
        }, POPUP_NOTICE_SHOW_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [notice, activeId]);
    if (notice === null) {
        return null;
    }
    return (
        <div
            className="chat-clear-confirm"
            role="status"
            aria-label="Page not opened"
        >
            <span className="chat-clear-ask">
                {genPopupRefusedText(notice.hostname)}
            </span>
            <button
                type="button"
                className="chat-clear-no"
                onClick={() => {
                    setNotice(null);
                }}
            >
                Close
            </button>
        </div>
    );
}
