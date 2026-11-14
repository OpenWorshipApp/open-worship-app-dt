import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { openForegroundInChatbot } from '../helper/ai/foregroundChatbotMenuHelpers';
import {
    readSessions,
    resolveActiveSessionId,
} from '../media-sessions/mediaSessionData';
import type { ForegroundComponentKeyType } from './foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    toForegroundSessionsTarget,
} from './foregroundComponentRules';

/**
 * The robot in a foreground panel's title bar (2026-11-09, the user picked
 * it beside a session chip's own **Open in Chatbot** and the help window's
 * attach row): the help window opened with the panel's CURRENT session
 * attached -- the one the panel is on at the press, read then, never kept.
 * Camera Show and Screen Show, which have no sessions, attach the component.
 * Drawn only while AI is on, like every other way into the assistant.
 */
export default function ForegroundChatbotButtonComp({
    widgetKey,
}: Readonly<{
    widgetKey: ForegroundComponentKeyType;
}>) {
    const handleClicking = useCallback(() => {
        if (!FOREGROUND_COMPONENT_RULE_MAP[widgetKey].hasSessions) {
            void openForegroundInChatbot({
                widget: widgetKey,
                sessionId: '',
                sessionName: '',
            });
            return;
        }
        const target = toForegroundSessionsTarget(widgetKey);
        const activeId = resolveActiveSessionId(target);
        const session = readSessions(target).find((one) => {
            return one.id === activeId;
        });
        void openForegroundInChatbot({
            widget: widgetKey,
            sessionId: activeId,
            sessionName: session?.name ?? '',
        });
    }, [widgetKey]);
    if (!getIsAIEnabled()) {
        return null;
    }
    const title = tran('Open in Chatbot');
    return (
        <button
            type="button"
            // The title bar's own button shape, like the Transition one.
            className="floating-widget__button"
            title={title}
            aria-label={title}
            onClick={handleClicking}
        >
            <i className="bi bi-robot" />
        </button>
    );
}
