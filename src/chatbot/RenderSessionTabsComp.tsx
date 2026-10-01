import type {
    DragEvent as ReactDragEventType,
    MouseEvent as ReactMouseEventType,
} from 'react';
import { useRef, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import {
    checkCanSoloChatSession,
    toClearableChatSessions,
} from './chatSessionHelpers';

/**
 * What a tab has to be for this strip to draw it. Shared by the help chatbot
 * and the AI Chat window, which is why it is not `ChatSessionType`: one holds
 * a conversation with the app's assistant, the other a website, and the strip
 * cares about neither.
 */
export type TabSessionType = {
    id: string;
    isLocked: boolean;
};

// The menu behind a tab's dots, and the width it is drawn at. The width is a
// constant because the menu has to be kept on screen BEFORE there is anything
// to measure: this window is 460px wide, and a menu opened from a tab at the
// right-hand end would otherwise hang off the edge on its first frame.
const TAB_MENU_WIDTH = 182;

type TabMenuStateType = {
    sessionId: string;
    x: number;
    y: number;
};

// A tab being dragged out of the window, as the drag carries it.
const TEAR_OFF_DRAG_TYPE = 'application/x-owa-drag-chat-tab';

/**
 * Whether a drag was let go outside this window. A drop inside it, even on
 * nothing that takes it, lands within the window's own box; an Escape that
 * cancels a drag has it end wherever the pointer was, and is only counted
 * when that is out there too.
 */
function checkIsOutsideWindow(event: { screenX: number; screenY: number }) {
    const { screenX, screenY } = event;
    // Chromium reports a drop it could not place as 0,0 -- not a place.
    if (screenX === 0 && screenY === 0) {
        return false;
    }
    return (
        screenX < window.screenX ||
        screenX > window.screenX + window.outerWidth ||
        screenY < window.screenY ||
        screenY > window.screenY + window.outerHeight
    );
}

// The two actions that take more than one tab at a time, held back until they
// have been asked for twice. Everything else in the menu takes exactly the tab
// it belongs to, and can be undone by reopening the window; these two cannot.
type SweepType =
    | { kind: 'clear' }
    | {
          kind: 'solo';
          sessionId: string;
      };

// The tab strip. Several conversations at once, the way a browser holds
// several pages -- and, unlike a browser, every one of them still there after
// the window is closed and the app restarted.
export default function RenderSessionTabsComp<T extends TabSessionType>({
    sessions,
    activeId,
    onChoose,
    onClose,
    onAdd,
    onRename,
    onTogglingLock,
    onSolo,
    onClearAll,
    genTitle,
    canAdd,
    canClearAll,
    onTearOff,
    onOpenInNewWindow,
    onNewWindow,
    onReorder,
}: Readonly<{
    sessions: T[];
    activeId: string;
    // The strip knows a tab by its id and its lock and nothing else; what
    // it is CALLED, and whether there is anything worth adding or sweeping,
    // is the owning window’s business.
    genTitle: (session: T) => string;
    canAdd: boolean;
    canClearAll: boolean;
    onChoose: (id: string) => void;
    onClose: (id: string) => void;
    onAdd: () => void;
    onRename: (id: string, title: string) => void;
    onTogglingLock: (id: string) => void;
    onSolo: (id: string) => void;
    onClearAll: () => void;
    // Given only by a window that can put a tab in a window of its own (the
    // AI Chat window): a tab dragged and let go OUTSIDE this window is handed
    // over, with where on the screen it was dropped. A drop inside the
    // window does nothing.
    onTearOff?: (id: string, screenX: number, screenY: number) => void;
    // The same, from the tab's menu, for whoever will not think to drag it.
    onOpenInNewWindow?: (id: string) => void;
    // Another window of the same kind, from a button beside `+`.
    onNewWindow?: () => void;
    // A tab dragged along the strip and let go on another: moved to `index`
    // in the list as it will be once the dragged tab is out of it.
    onReorder?: (id: string, index: number) => void;
}>) {
    // Renaming is a state OF THE STRIP, not of a session: it is over the
    // moment the box is left, and nothing about it is worth writing to disk.
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingText, setRenamingText] = useState('');
    // So is which tab has its menu open, and which sweeping action is waiting
    // to be confirmed. That question is asked in this window rather than in
    // the app's confirm popup because this window loads bootstrap and its own
    // sheet and nothing else -- pulling the popup in here would bring `tran()`
    // and a module-scope listener with it (see `openAiSetting`), for one
    // question with two answers.
    const [menuState, setMenuState] = useState<TabMenuStateType | null>(null);
    const [sweep, setSweep] = useState<SweepType | null>(null);
    // The menu belongs to a tab, and that tab can go out from under it -- by
    // way of the menu's own "Close this chat", most of the time.
    const menuSession =
        sessions.find((session) => {
            return session.id === menuState?.sessionId;
        }) ?? null;
    // What the waiting question would actually take. Locked tabs are not in
    // it, which is the whole point of locking one, and a question that would
    // now take nothing is a question with no answer worth pressing: it goes
    // with the tab or the lock that emptied it.
    const sweepingSessions =
        sweep === null
            ? []
            : toClearableChatSessions(sessions).filter((session) => {
                  return sweep.kind === 'clear'
                      ? true
                      : session.id !== sweep.sessionId;
              });
    if (sweep !== null && sweepingSessions.length === 0) {
        setSweep(null);
    }
    // Only the locks worth mentioning: the tab a solo is being run FROM is
    // staying because it is the one being soloed, not because of its lock, and
    // saying "the locked one stays" about the tab in front reads as a warning
    // about the wrong tab.
    const lockedKeptCount =
        sweep === null
            ? 0
            : sessions.filter((session) => {
                  return (
                      session.isLocked &&
                      (sweep.kind === 'clear' || session.id !== sweep.sessionId)
                  );
              }).length;
    // The strip scrolls now instead of shrinking its tabs, so a tab that is
    // chosen (or opened) off the visible end has to be brought back into view.
    const stripRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        stripRef.current
            ?.querySelector('.chat-tab.is-on')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [activeId]);
    const handleRenamingDone = () => {
        if (renamingId !== null) {
            // An emptied box means "go back to being called after the first
            // question", which is a useful thing to be able to undo to.
            onRename(renamingId, renamingText);
        }
        setRenamingId(null);
    };
    const handleOpeningMenu = (
        event: ReactMouseEventType<HTMLElement>,
        sessionId: string,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        // Hung under the control that was pressed rather than at the pointer,
        // so the menu lands in the same place whether it was opened with the
        // dots or by right-clicking the tab -- and shoved back onto the window
        // when that tab is scrolled up against the right-hand end, which a
        // 460px window makes a routine case rather than an edge one.
        const rect = event.currentTarget.getBoundingClientRect();
        setMenuState({
            sessionId,
            x: Math.max(
                4,
                Math.min(rect.left, window.innerWidth - TAB_MENU_WIDTH - 4),
            ),
            y: rect.bottom + 2,
        });
    };
    const handleClosingMenu = () => {
        setMenuState(null);
    };
    // Nothing to move a tab away FROM, or past, when it is the only one, and
    // a tab being renamed is a text box whose words a drag should select.
    const checkCanDrag = (sessionId: string) => {
        return (
            (onTearOff !== undefined || onReorder !== undefined) &&
            sessions.length > 1 &&
            renamingId !== sessionId
        );
    };
    // The tab being dragged out of THIS strip. A drag from another window
    // carries the same type but no tab here, and is not taken.
    const draggingIdRef = useRef<string | null>(null);
    // Where the dragged tab would land: beside which tab, on which side.
    const [dropMark, setDropMark] = useState<{
        id: string;
        isAfter: boolean;
    } | null>(null);
    const handleDraggingOver = (
        event: ReactDragEventType<HTMLElement>,
        sessionId: string,
    ) => {
        const draggingId = draggingIdRef.current;
        if (onReorder === undefined || draggingId === null) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;
        if (
            sessionId === draggingId ||
            (dropMark?.id === sessionId && dropMark.isAfter === isAfter)
        ) {
            if (sessionId === draggingId && dropMark !== null) {
                setDropMark(null);
            }
            return;
        }
        setDropMark({ id: sessionId, isAfter });
    };
    const handleDropping = (
        event: ReactDragEventType<HTMLElement>,
        sessionId: string,
    ) => {
        const draggingId = draggingIdRef.current;
        if (onReorder === undefined || draggingId === null) {
            return;
        }
        event.preventDefault();
        setDropMark(null);
        if (sessionId === draggingId) {
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;
        const others = sessions.filter((session) => {
            return session.id !== draggingId;
        });
        const targetIndex = others.findIndex((session) => {
            return session.id === sessionId;
        });
        if (targetIndex !== -1) {
            onReorder(draggingId, targetIndex + (isAfter ? 1 : 0));
        }
    };
    return (
        <>
            <div
                className="chat-tabs"
                role="tablist"
                aria-label="Chats"
                ref={stripRef}
            >
                {sessions.map((session) => {
                    const title = genTitle(session);
                    const isOn = session.id === activeId;
                    const isMenuOn = session.id === menuSession?.id;
                    return (
                        <div
                            key={session.id}
                            className={
                                'chat-tab' +
                                (isOn ? ' is-on' : '') +
                                (isMenuOn ? ' is-menu-on' : '') +
                                (dropMark?.id === session.id
                                    ? dropMark.isAfter
                                        ? ' is-drop-after'
                                        : ' is-drop-before'
                                    : '')
                            }
                            onContextMenu={(event) => {
                                handleOpeningMenu(event, session.id);
                            }}
                            draggable={checkCanDrag(session.id)}
                            onDragOver={(event) => {
                                handleDraggingOver(event, session.id);
                            }}
                            onDrop={(event) => {
                                handleDropping(event, session.id);
                            }}
                            onDragStart={(event) => {
                                draggingIdRef.current = session.id;
                                // A type of its own, so a site under the
                                // pointer -- the page below is a website --
                                // is handed no text and no link to paste.
                                event.dataTransfer.setData(
                                    TEAR_OFF_DRAG_TYPE,
                                    session.id,
                                );
                                event.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={(event) => {
                                draggingIdRef.current = null;
                                setDropMark(null);
                                if (
                                    onTearOff === undefined ||
                                    !checkIsOutsideWindow(event)
                                ) {
                                    return;
                                }
                                onTearOff(
                                    session.id,
                                    event.screenX,
                                    event.screenY,
                                );
                            }}
                        >
                            {/*
                             * The right-click, spelled out. Nothing on a tab
                             * says a menu is hiding behind it, and the person
                             * this window is written for is not going to try
                             * -- so the dots are always there, dimmed, and
                             * they OPEN the tab: first thing on the left, in
                             * the one spot that does not move as the name
                             * beside it grows, shrinks or is being retyped.
                             */}
                            <button
                                type="button"
                                className="chat-tab-menu"
                                aria-label={`More for ${title}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOn}
                                title="More"
                                onClick={(event) => {
                                    handleOpeningMenu(event, session.id);
                                }}
                            >
                                ⋮
                            </button>
                            {renamingId === session.id ? (
                                <input
                                    className="chat-tab-input"
                                    type="text"
                                    autoFocus
                                    value={renamingText}
                                    aria-label="Name this chat"
                                    onChange={(event) => {
                                        setRenamingText(event.target.value);
                                    }}
                                    onBlur={handleRenamingDone}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleRenamingDone();
                                        } else if (event.key === 'Escape') {
                                            setRenamingId(null);
                                        }
                                    }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isOn}
                                    className="chat-tab-name"
                                    title={`${title} — double-click to rename`}
                                    onClick={() => {
                                        onChoose(session.id);
                                    }}
                                    onDoubleClick={() => {
                                        setRenamingId(session.id);
                                        setRenamingText(title);
                                    }}
                                >
                                    {title}
                                </button>
                            )}
                            {session.isLocked ? (
                                // The close button, replaced by the reason it
                                // is not there. Not a button of its own: a
                                // lock that comes off with one stray press on
                                // the exact spot the close used to be is not a
                                // lock.
                                <span
                                    className="chat-tab-lock"
                                    role="img"
                                    aria-label={`${title} is locked`}
                                    title={
                                        'Locked — unlock it from this tab’s ' +
                                        'menu to close it'
                                    }
                                >
                                    <i className="bi bi-lock-fill" />
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    className="chat-tab-close"
                                    aria-label={`Close ${title}`}
                                    title="Close this chat"
                                    onClick={() => {
                                        onClose(session.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="chat-tab-add"
                    aria-label="New chat"
                    title={
                        canAdd
                            ? 'New chat'
                            : 'Close one of these before starting another'
                    }
                    disabled={!canAdd}
                    onClick={onAdd}
                >
                    +
                </button>
                {onNewWindow === undefined ? null : (
                    <button
                        type="button"
                        className="chat-tab-add chat-tab-window"
                        aria-label="New window"
                        title="New window"
                        onClick={onNewWindow}
                    >
                        <i className="bi bi-window-plus" />
                    </button>
                )}
            </div>
            {sweep === null ? null : (
                // Asked on a line of its own rather than inside the menu, and
                // never done on the first press: these conversations are the
                // only record of what the person at this machine was told.
                <div
                    className="chat-clear-confirm"
                    role="alertdialog"
                    aria-label={
                        sweep.kind === 'clear'
                            ? 'Clear all chats'
                            : 'Close other chats'
                    }
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setSweep(null);
                        }
                    }}
                >
                    <span className="chat-clear-ask">
                        {sweep.kind === 'clear' ? 'Clear ' : 'Close '}
                        {sweepingSessions.length} chat
                        {sweepingSessions.length === 1 ? '' : 's'}?
                        {lockedKeptCount === 0
                            ? ''
                            : ` The locked ${
                                  lockedKeptCount === 1
                                      ? 'one stays'
                                      : 'ones stay'
                              }.`}{' '}
                        This cannot be undone.
                    </span>
                    <button
                        type="button"
                        className="chat-clear-no"
                        autoFocus
                        onClick={() => {
                            setSweep(null);
                        }}
                    >
                        Keep them
                    </button>
                    <button
                        type="button"
                        className="chat-clear-yes"
                        onClick={() => {
                            if (sweep.kind === 'clear') {
                                onClearAll();
                            } else {
                                onSolo(sweep.sessionId);
                            }
                            setSweep(null);
                        }}
                    >
                        {sweep.kind === 'clear' ? 'Clear all' : 'Close them'}
                    </button>
                </div>
            )}
            {menuState === null || menuSession === null ? null : (
                // Drawn OUTSIDE the strip and placed against the window: the
                // strip scrolls, so anything inside it is clipped at its
                // edges, and a clipped menu is a menu with items nobody can
                // reach. The sheet behind it is what closes it on the next
                // press anywhere -- cheaper, and harder to get wrong, than a
                // document listener that has to be taken off again.
                <>
                    <div
                        className="chat-menu-sheet"
                        onPointerDown={handleClosingMenu}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            handleClosingMenu();
                        }}
                    />
                    <div
                        className="chat-menu"
                        role="menu"
                        aria-label={genTitle(menuSession)}
                        style={{
                            left: menuState.x,
                            top: menuState.y,
                            width: TAB_MENU_WIDTH,
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                handleClosingMenu();
                            }
                        }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            autoFocus
                            onClick={() => {
                                handleClosingMenu();
                                setRenamingId(menuSession.id);
                                setRenamingText(genTitle(menuSession));
                            }}
                        >
                            Rename this chat
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            onClick={() => {
                                handleClosingMenu();
                                onTogglingLock(menuSession.id);
                            }}
                        >
                            {menuSession.isLocked
                                ? 'Unlock this chat'
                                : 'Lock this chat'}
                        </button>
                        {onOpenInNewWindow === undefined ? null : (
                            <button
                                type="button"
                                role="menuitem"
                                className="chat-menu-item"
                                onClick={() => {
                                    handleClosingMenu();
                                    onOpenInNewWindow(menuSession.id);
                                }}
                            >
                                Open in new window
                            </button>
                        )}
                        {menuSession.isLocked ? null : (
                            <button
                                type="button"
                                role="menuitem"
                                className="chat-menu-item"
                                onClick={() => {
                                    handleClosingMenu();
                                    onClose(menuSession.id);
                                }}
                            >
                                Close this chat
                            </button>
                        )}
                        {checkCanSoloChatSession(sessions, menuSession.id) ? (
                            <>
                                <div className="chat-menu-line" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="chat-menu-item is-warn"
                                    onClick={() => {
                                        handleClosingMenu();
                                        setSweep({
                                            kind: 'solo',
                                            sessionId: menuSession.id,
                                        });
                                    }}
                                >
                                    Close other chats…
                                </button>
                            </>
                        ) : null}
                        {canClearAll ? (
                            <>
                                {checkCanSoloChatSession(
                                    sessions,
                                    menuSession.id,
                                ) ? null : (
                                    <div className="chat-menu-line" />
                                )}
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="chat-menu-item is-warn"
                                    onClick={() => {
                                        handleClosingMenu();
                                        setSweep({ kind: 'clear' });
                                    }}
                                >
                                    Clear all chats…
                                </button>
                            </>
                        ) : null}
                    </div>
                </>
            )}
        </>
    );
}
