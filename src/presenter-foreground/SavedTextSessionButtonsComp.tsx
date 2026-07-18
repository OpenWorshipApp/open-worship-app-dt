import { useRef, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import type {
    ContextMenuItemType,
    AppContextMenuControlType,
} from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { getRandomUUID } from '../helper/helpers';

type SavedTextSessionType = {
    id: string;
    text: string;
};

// Keep the persisted list bounded so it can never grow without limit on the
// low-spec target machines; the newest sessions are kept.
const MAX_SAVED_SESSIONS = 50;

function loadSavedSessions(settingName: string): SavedTextSessionType[] {
    const raw = getSetting(settingName);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((item): item is SavedTextSessionType => {
            return (
                item !== null &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.text === 'string'
            );
        });
    } catch {
        return [];
    }
}

function persistSavedSessions(
    settingName: string,
    sessions: SavedTextSessionType[],
) {
    setSetting(settingName, JSON.stringify(sessions));
}

function genSessionLabel(session: SavedTextSessionType) {
    // Collapse whitespace so the truncated preview stays on one line; the full
    // text is exposed via the menu item's `title` on hover.
    return session.text.replace(/\s+/g, ' ').trim();
}

export default function SavedTextSessionButtonsComp({
    settingName,
    label,
    text,
    onPickText,
}: Readonly<{
    settingName: string;
    label: string;
    text: string;
    onPickText: (text: string) => void;
}>) {
    // Lazily loaded once on mount so a closed panel holds nothing.
    const [savedSessions, setSavedSessions] = useState<SavedTextSessionType[]>(
        () => loadSavedSessions(settingName),
    );
    const menuControlRef = useRef<AppContextMenuControlType | null>(null);

    const persistSessions = (sessions: SavedTextSessionType[]) => {
        setSavedSessions(sessions);
        persistSavedSessions(settingName, sessions);
    };
    const handleSaveSession = () => {
        if (text.trim() === '') {
            showSimpleToast(
                tran(label),
                tran('Nothing to save: the text is empty'),
            );
            return;
        }
        if (savedSessions[0]?.text === text) {
            showSimpleToast(
                tran(label),
                tran('This text is already the latest saved session'),
            );
            return;
        }
        const newSession: SavedTextSessionType = {
            id: getRandomUUID(),
            text,
        };
        persistSessions(
            [newSession, ...savedSessions].slice(0, MAX_SAVED_SESSIONS),
        );
        showSimpleToast(tran(label), tran('Saved current text'));
    };
    const handleDeleteSession = (id: string) => {
        persistSessions(
            savedSessions.filter((session) => {
                return session.id !== id;
            }),
        );
    };
    const handlePickSession = async (session: SavedTextSessionType) => {
        const isConfirmed = await showAppConfirm(
            tran(label),
            tran(
                'Replace the current text with this saved session? Your ' +
                    'current unsaved text will be lost.',
            ),
        );
        if (!isConfirmed) {
            return;
        }
        onPickText(session.text);
    };
    const handleOpenSavedSessions = (event: any) => {
        if (savedSessions.length === 0) {
            return;
        }
        const items: ContextMenuItemType[] = savedSessions.map((session) => {
            return {
                id: session.id,
                title: session.text,
                childBefore: genContextMenuItemIcon('card-text'),
                menuElement: genSessionLabel(session),
                onSelect: () => {
                    handlePickSession(session);
                },
                childAfter: (
                    <button
                        className="btn btn-sm p-0 ms-1"
                        title={tran('Delete this saved session')}
                        onClick={(event1) => {
                            event1.preventDefault();
                            event1.stopPropagation();
                            menuControlRef.current?.closeMenu();
                            handleDeleteSession(session.id);
                        }}
                    >
                        <i className="bi bi-trash" style={{ color: 'red' }} />
                    </button>
                ),
            };
        });
        menuControlRef.current = showAppContextMenu(event, items, {
            maxHeigh: 400,
        });
    };
    return (
        <>
            <button
                className="btn btn-sm btn-outline-success"
                title={tran('Save the current text as a session')}
                onClick={handleSaveSession}
            >
                <i className="bi bi-floppy" /> {tran('Save')}
            </button>
            <button
                className="btn btn-sm btn-outline-secondary"
                title={tran('Pick a previously saved session')}
                disabled={savedSessions.length === 0}
                onClick={handleOpenSavedSessions}
            >
                <i className="bi bi-clock-history" /> {tran('Saved')}
                {savedSessions.length > 0 ? ` (${savedSessions.length})` : ''}
            </button>
        </>
    );
}
