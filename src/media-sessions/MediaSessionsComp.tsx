import './mediaSessions.scss';

import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import { subscribeSlideAutoPlayState } from '../slide-auto-play/slideAutoPlayRuleHelpers';
import {
    getSetting,
    removeSetting,
    useStateSettingString,
} from '../helper/settingHelpers';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../popup-widget/popupWidgetHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    type MediaSessionType,
    DEFAULT_SESSION_ID,
    DEFAULT_SESSION_NAME,
    addMediaSession,
    genMediaSessionId,
    notifyMediaSessionStrips,
    pickActiveSession,
    readSessions,
    subscribeMediaSessionStrips,
    toActiveSettingName,
    toDefaultList,
    toListSettingName,
} from './mediaSessionData';

function genSessionNameInput(
    name: string,
    onChange: (newName: string) => void,
) {
    return (
        <input
            type="text"
            autoFocus
            className="form-control"
            defaultValue={name}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
    );
}

// The stored half lives in its own module so a model or an editor's boot can
// read the active session without this UI; re-exported for existing callers.
export {
    type MediaSessionType,
    DEFAULT_SESSION_ID,
    toSessionSuffix,
    readSessions,
    genMediaSessionId,
    addMediaSession,
    resolveActiveSessionId,
    notifyMediaSessionStrips,
} from './mediaSessionData';

// What a session is called on screen. The built-in one is read through
// `tran()` while it still carries the name the app gave it, so a window in
// another language does not show "Default"; a name the user typed is shown
// as typed.
export function toSessionLabel(session: MediaSessionType) {
    if (
        session.id === DEFAULT_SESSION_ID &&
        session.name === DEFAULT_SESSION_NAME
    ) {
        return tran('Default');
    }
    return session.name;
}

export function useMediaSessions(target: string) {
    const [rawList, setRawList] = useStateSettingString(
        toListSettingName(target),
        JSON.stringify(toDefaultList()),
    );
    const [activeId, setActiveId] = useStateSettingString(
        toActiveSettingName(target),
        DEFAULT_SESSION_ID,
    );
    useAppEffect(() => {
        // Read back, not written: whoever changed the list already wrote it.
        return subscribeMediaSessionStrips(target, () => {
            setRawList(getSetting(toListSettingName(target)) ?? '', true);
            setActiveId(
                getSetting(toActiveSettingName(target)) ?? DEFAULT_SESSION_ID,
                true,
            );
        });
    }, [target]);
    const sessions = readSessions(target);
    const activeSession = pickActiveSession(sessions, activeId);
    // Every write tells the target's OTHER mounted strips too: a list mounted
    // twice in one window must never show one session and list another.
    const writeList = (list: MediaSessionType[]) => {
        setRawList(JSON.stringify(list));
        notifyMediaSessionStrips(target);
    };
    const writeActiveId = (sessionId: string) => {
        setActiveId(sessionId);
        notifyMediaSessionStrips(target);
    };
    return {
        sessions,
        activeSession,
        activeId: activeSession.id,
        setActiveId: writeActiveId,
        rawList,
        addSession: () => {
            addMediaSession(target, {
                id: genMediaSessionId(),
                name: `${tran('Session')} ${sessions.length + 1}`,
            });
        },
        renameSession: (sessionId: string, name: string) => {
            writeList(
                sessions.map((session) => {
                    return session.id === sessionId
                        ? { ...session, name }
                        : session;
                }),
            );
        },
        removeSession: (sessionId: string) => {
            const list = sessions.filter((session) => {
                return session.id !== sessionId;
            });
            if (activeId === sessionId) {
                setActiveId(list[0]?.id ?? DEFAULT_SESSION_ID);
            }
            writeList(list.length === 0 ? toDefaultList() : list);
        },
    };
}

/**
 * Clears the settings a removed session wrote. Only the keys that panel owns
 * for that id, and only on an explicit removal -- a session is a set-up the
 * user built by hand.
 *
 * REMOVED rather than blanked. A setting is a FILE named after its key, so
 * writing an empty string leaves one behind per key -- and, for a key the
 * session never happened to write, CREATES one that never existed.
 */
function forgetSessionSettings(settingNames: string[]) {
    for (const settingName of settingNames) {
        removeSetting(settingName);
    }
}

/**
 * Redraws the strip when ANY show starts, stops or ends itself.
 *
 * The chips are drawn by the panel, the play button by `SlideAutoPlayComp`,
 * and pressing it only re-renders that button -- so without this the ▶ on a
 * chip appeared whenever something else next happened to redraw the panel,
 * which for the Background tabs is "when a background goes up or comes off".
 * A show that has ended is the sharper case: nothing else about the app
 * changes at that moment at all.
 */
export function useMediaSessionAutoPlayRefresh() {
    const [, setLastChangeTime] = useState(0);
    useAppEffect(() => {
        return subscribeSlideAutoPlayState(() => {
            setLastChangeTime(Date.now());
        });
    }, []);
}

export type MediaSessionStateType = {
    isOnScreen: boolean;
    isAutoPlaying: boolean;
};

export default function MediaSessionsComp({
    target,
    sessions,
    activeId,
    onChoose,
    onAdd,
    onRename,
    onRemove,
    genRemovedSettingNames,
    genSessionState,
    genExtraMenuItems,
}: Readonly<{
    target: string;
    sessions: MediaSessionType[];
    activeId: string;
    onChoose: (id: string) => void;
    onAdd: () => void;
    onRename: (id: string, name: string) => void;
    onRemove: (id: string) => void;
    genRemovedSettingNames: (id: string) => string[];
    /**
     * Whether that session has something on a screen and whether its slide
     * show is advancing. Only ONE session is rendered at a time, so without
     * this the strip is the one place a live overlay -- or a show that is
     * still running behind the session in front -- leaves no mark at all.
     */
    genSessionState: (id: string) => MediaSessionStateType;
    /**
     * Rows of a strip's own at the end of a chip's menu -- a foreground
     * session's **Open in Chatbot**. Left out by the Background tabs and the
     * file lists, whose sessions are folders.
     */
    genExtraMenuItems?: (session: MediaSessionType) => ContextMenuItemType[];
}>) {
    const onRenameRef = useAppCurrentRef(onRename);
    const onRemoveRef = useAppCurrentRef(onRemove);
    const genRemovedSettingNamesRef = useAppCurrentRef(genRemovedSettingNames);
    const genExtraMenuItemsRef = useAppCurrentRef(genExtraMenuItems);
    const sessionsRef = useAppCurrentRef(sessions);
    const handleMenuOpening = useCallback(
        (event: any, session: MediaSessionType) => {
            event.stopPropagation();
            // Default is never offered for removal, whatever else is in the
            // list. Its id is the empty string, so its settings ARE the
            // panel's own base keys -- the folder Path Settings names, the
            // documents folder every "save to the list" falls back on -- and
            // removing it used to delete exactly those.
            const isUnremovable =
                session.id === DEFAULT_SESSION_ID ||
                sessionsRef.current.length <= 1;
            showAppContextMenu(event, [
                {
                    childBefore: genContextMenuItemIcon('pencil-square'),
                    menuElement: tran('Rename Session'),
                    onSelect: async () => {
                        let name = toSessionLabel(session);
                        const isOk = await showAppInput(
                            tran('Rename Session'),
                            genSessionNameInput(name, (newName) => {
                                name = newName;
                            }),
                            { escToCancel: false, enterToOk: false },
                        );
                        if (isOk && name.trim().length > 0) {
                            onRenameRef.current(session.id, name.trim());
                        }
                    },
                },
                ...(isUnremovable
                    ? []
                    : [
                          {
                              childBefore: genContextMenuItemIcon('x-circle'),
                              menuElement: tran('Remove Session'),
                              onSelect: async () => {
                                  const isOk = await showAppConfirm(
                                      tran('Remove Session'),
                                      `${tran('Remove')} "${toSessionLabel(session)}"?`,
                                  );
                                  if (!isOk) {
                                      return;
                                  }
                                  forgetSessionSettings(
                                      genRemovedSettingNamesRef.current(
                                          session.id,
                                      ),
                                  );
                                  onRemoveRef.current(session.id);
                              },
                          },
                      ]),
                ...(genExtraMenuItemsRef.current?.(session) ?? []),
            ]);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div
            // One segmented group, not a row of separate buttons: picking a
            // session is ONE choice, and per-chip borders said otherwise
            // while costing two edges each. The active chip drops its border
            // and takes the bar's own fill, so the controls beside it read as
            // belonging to it -- which is exactly what they do.
            className="media-sessions"
            role="group"
            aria-label={tran('Session')}
            data-media-sessions={target}
        >
            {sessions.map((session) => {
                const isActive = session.id === activeId;
                const { isOnScreen, isAutoPlaying } = genSessionState(
                    session.id,
                );
                const stateWords = [
                    toSessionLabel(session),
                    isOnScreen ? tran('On Screen') : null,
                    isAutoPlaying ? tran('Slide show is running') : null,
                ]
                    .filter((word) => {
                        return word !== null;
                    })
                    .join(' — ');
                return (
                    <button
                        key={session.id}
                        type="button"
                        className={
                            'media-session' +
                            (isActive ? ' media-session-on' : '')
                        }
                        aria-pressed={isActive}
                        title={stateWords}
                        aria-label={stateWords}
                        onClick={() => {
                            onChoose(session.id);
                        }}
                        onContextMenu={(event) => {
                            handleMenuOpening(event, session);
                        }}
                    >
                        <span className={isOnScreen ? 'app-on-screen' : ''}>
                            {toSessionLabel(session)}
                        </span>
                        {isAutoPlaying ? (
                            <i className="bi bi-play-fill text-info" />
                        ) : null}
                        {/* Only on the session being worked on. Rename and
                            remove are things you do to the one you are ON, a
                            column of dots beside every chip is noise, and a
                            hover-reveal would either reserve the width anyway
                            (opacity) or make the rail jitter (width). Right-
                            click opens the same menu on any chip. */}
                        {isActive ? (
                            <i
                                className={
                                    'bi bi-three-dots-vertical' +
                                    ' media-session-menu'
                                }
                                onClick={(event) => {
                                    handleMenuOpening(event, session);
                                }}
                            />
                        ) : null}
                    </button>
                );
            })}
            <button
                type="button"
                className="media-session media-session-add"
                title={tran('Add Session')}
                aria-label={tran('Add Session')}
                onClick={onAdd}
            >
                <i className="bi bi-plus-lg" />
            </button>
        </div>
    );
}
