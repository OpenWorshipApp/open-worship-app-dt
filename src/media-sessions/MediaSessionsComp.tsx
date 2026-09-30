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
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../popup-widget/popupWidgetHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

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

/**
 * A **session** is one saved set-up of a media list: its own folder, plus
 * whatever else the panel keys by it -- a foreground widget adds its
 * Properties (size, place, blend mode) and its slide show, a Background tab
 * its view mode, its sort and its slide show. Several of them let one panel
 * hold, say, this Sunday's pictures in one folder and the standing set in
 * another, and switch between them without re-pointing the folder every time.
 *
 * The id is what every one of those settings is keyed by, so it must never
 * change once used. The FIRST session's id is the empty string on purpose:
 * that keeps the keys a panel already wrote before sessions existed -- which
 * is also why a Background tab's Default session is still the folder the Path
 * Settings page points at.
 */
export type MediaSessionType = {
    id: string;
    name: string;
};

export const DEFAULT_SESSION_ID = '';

/**
 * `target` is the whole settings namespace, not a bare kind: the foreground
 * widgets pass `foreground-image`, the Background tabs `background-image`, and
 * the two never share a list.
 */
function toListSettingName(target: string) {
    return `${target}-sessions`;
}
function toActiveSettingName(target: string) {
    return `${target}-active-session`;
}

export function toSessionSuffix(sessionId: string) {
    return sessionId === DEFAULT_SESSION_ID ? '' : `-${sessionId}`;
}

function toDefaultList(): MediaSessionType[] {
    return [{ id: DEFAULT_SESSION_ID, name: 'Default' }];
}

export function readSessions(target: string): MediaSessionType[] {
    try {
        const raw = getSetting(toListSettingName(target));
        if (!raw) {
            return toDefaultList();
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return toDefaultList();
        }
        const list = parsed.filter((item: any) => {
            return (
                item !== null &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.name === 'string'
            );
        });
        // A hand-edited file must never leave the panel with nothing to show.
        return list.length === 0 ? toDefaultList() : list;
    } catch {
        return toDefaultList();
    }
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
    const sessions = readSessions(target);
    const activeSession =
        sessions.find((session) => {
            return session.id === activeId;
        }) ?? sessions[0];
    const writeList = (list: MediaSessionType[]) => {
        setRawList(JSON.stringify(list));
    };
    return {
        sessions,
        activeSession,
        activeId: activeSession.id,
        setActiveId,
        rawList,
        addSession: () => {
            // Ids are never reused: every setting a removed session wrote is
            // keyed by its id, and a recycled one would inherit them.
            const id = `s${Date.now().toString(36)}`;
            writeList([
                ...sessions,
                { id, name: `${tran('Session')} ${sessions.length + 1}` },
            ]);
            setActiveId(id);
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
            writeList(list.length === 0 ? toDefaultList() : list);
            if (activeId === sessionId) {
                setActiveId(list[0]?.id ?? DEFAULT_SESSION_ID);
            }
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
}>) {
    const onRenameRef = useAppCurrentRef(onRename);
    const onRemoveRef = useAppCurrentRef(onRemove);
    const genRemovedSettingNamesRef = useAppCurrentRef(genRemovedSettingNames);
    const sessionsRef = useAppCurrentRef(sessions);
    const handleMenuOpening = useCallback(
        (event: any, session: MediaSessionType) => {
            event.stopPropagation();
            const isLast = sessionsRef.current.length <= 1;
            showAppContextMenu(event, [
                {
                    childBefore: genContextMenuItemIcon('pencil-square'),
                    menuElement: tran('Rename Session'),
                    onSelect: async () => {
                        let name = session.name;
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
                ...(isLast
                    ? []
                    : [
                          {
                              childBefore: genContextMenuItemIcon('x-circle'),
                              menuElement: tran('Remove Session'),
                              onSelect: async () => {
                                  const isOk = await showAppConfirm(
                                      tran('Remove Session'),
                                      `${tran('Remove')} "${session.name}"?`,
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
                    session.name,
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
                            {session.name}
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
