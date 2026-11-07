import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { openLyricInChatbot } from '../helper/ai/lyricChatbotMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import type { LyricEditorSyncType } from './lyricEditorChatbotSync';

/**
 * The 🤖 in the Lyric Editor's top bar, left of Reset / Save (2026-11-06,
 * the user, with that spot circled: _on lyric editor add robot icon to click
 * for `Open In Chatbot`_). Pressed, what the editor shows goes into the
 * song's editing history first -- the assistant changes the song as it is on
 * screen, not as it was opened -- and the help window opens with the song
 * attached.
 *
 * Beside it, only while the assistant has changed the song under the
 * person's own typing: a line saying so and the press that loads the change
 * (`lyricEditorChatbotSync.ts`). Their typing is never replaced without it.
 */
export default function LyricEditorChatbotButtonComp({
    sync,
    filePath,
}: Readonly<{
    sync: LyricEditorSyncType;
    filePath: string;
}>) {
    const [hasPending, setHasPending] = useState(
        sync.getPendingHead() !== null,
    );
    useAppEffect(() => {
        return sync.subscribe(() => {
            setHasPending(sync.getPendingHead() !== null);
        });
    }, [sync]);
    if (!getIsAIEnabled()) {
        return null;
    }
    const handleOpening = async () => {
        try {
            await sync.writeShownToHead();
            await openLyricInChatbot(filePath);
        } catch (error) {
            handleError(error);
        }
    };
    const label = tran('Open in Chatbot');
    return (
        <div className="d-flex align-items-center gap-1 me-1">
            {hasPending ? (
                <>
                    <span className="small text-warning text-nowrap">
                        {tran('The assistant changed this song.')}
                    </span>
                    <button
                        type="button"
                        className="btn btn-outline-warning btn-sm text-nowrap"
                        onClick={() => {
                            sync.applyPending();
                        }}
                    >
                        {tran('Load the change')}
                    </button>
                </>
            ) : null}
            <button
                type="button"
                className="btn btn-outline-info btn-sm topbar-document-action-btn"
                title={label}
                aria-label={label}
                onClick={() => {
                    void handleOpening();
                }}
            >
                <i className="bi bi-robot" aria-hidden="true" />
            </button>
        </div>
    );
}
