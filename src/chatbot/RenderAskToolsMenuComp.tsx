import type { KeyboardEvent as ReactKeyboardEventType } from 'react';
import { useRef, useState } from 'react';

import { tran } from './chatTranHelpers';

/**
 * The ask row's tools behind ONE vertical ⋮ (2026-11-10, the user's picture
 * of the five icons left of the box circled: _put those in vertical 3 dots …
 * to save space for input text_). The paperclip, the 📷, the ◎, the foreground
 * session and `/` had taken ~150px of a 412px window from the box; the dots
 * take ~25px. Each row says its job in words beside its icon, so the menu
 * also teaches what the icons alone never said.
 *
 * Mounted only while open -- nothing is drawn or listened to at rest -- and
 * opened UPWARD from the dots, over the conversation, because the ask row is
 * the last thing in the window. The sheet behind it is the "click outside",
 * as on the tab strip's menu (`.chat-menu-sheet`).
 */
export default function RenderAskToolsMenuComp({
    onAttachingFile,
    onSnapping,
    onPicking,
    onAttachingForeground,
    onStartingCommand,
}: Readonly<{
    onAttachingFile: () => void;
    onSnapping: () => void;
    onPicking: () => void;
    onAttachingForeground: () => void;
    onStartingCommand: () => void;
}>) {
    const [place, setPlace] = useState<{ x: number; y: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const handleClosing = (isFocusBack: boolean) => {
        setPlace(null);
        // Back to the dots on Escape only: a row's own job may put the caret
        // somewhere (`/` puts it in the box), and the dots must not take it.
        if (isFocusBack) {
            buttonRef.current?.focus();
        }
    };
    const handleChoosing = (onPress: () => void) => {
        handleClosing(false);
        onPress();
    };
    const handleMenuKeyDown = (
        event: ReactKeyboardEventType<HTMLDivElement>,
    ) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            handleClosing(true);
            return;
        }
        if (event.key === 'Tab') {
            handleClosing(false);
            return;
        }
        const step =
            event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        if (step === 0) {
            return;
        }
        event.preventDefault();
        const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="menuitem"]',
            ),
        ];
        const index = items.indexOf(document.activeElement as HTMLElement);
        // `+ length` before the modulo: `%` keeps the sign.
        items[(index + step + items.length) % items.length]?.focus();
    };
    const isOpen = place !== null;
    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`chat-attach chat-ask-tools${isOpen ? ' is-open' : ''}`}
                aria-label={tran('More Options')}
                title={tran('More Options')}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={(event) => {
                    if (isOpen) {
                        handleClosing(false);
                        return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    setPlace({
                        x: Math.max(4, rect.left),
                        y: Math.max(4, window.innerHeight - rect.top + 4),
                    });
                }}
            >
                <i className="bi bi-three-dots-vertical" aria-hidden="true" />
            </button>
            {place === null ? null : (
                <>
                    <div
                        className="chat-menu-sheet"
                        onPointerDown={() => {
                            handleClosing(false);
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            handleClosing(false);
                        }}
                    />
                    <div
                        className="chat-menu chat-ask-tools-menu"
                        role="menu"
                        aria-label={tran('More Options')}
                        style={{ left: place.x, bottom: place.y }}
                        onKeyDown={handleMenuKeyDown}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            aria-label={tran('Attach a file')}
                            title={tran('Attach a picture or a file')}
                            autoFocus
                            onClick={() => {
                                handleChoosing(onAttachingFile);
                            }}
                        >
                            <i className="bi bi-paperclip" aria-hidden="true" />
                            {tran('Attach a file')}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            aria-label={tran('Attach a picture of the app')}
                            title={tran(
                                'Attach a picture of the app as it looks now',
                            )}
                            onClick={() => {
                                handleChoosing(onSnapping);
                            }}
                        >
                            <i className="bi bi-camera" aria-hidden="true" />
                            {tran('Attach a picture of the app')}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            aria-label={tran('Point at a control in the app')}
                            title={tran('Point at a control in the app window')}
                            onClick={() => {
                                handleChoosing(onPicking);
                            }}
                        >
                            <i className="bi bi-bullseye" aria-hidden="true" />
                            {tran('Point at a control in the app')}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item"
                            aria-label={tran('Attach a foreground session')}
                            title={tran(
                                'Attach a session of a foreground panel that is ' +
                                    'open in the Presenter',
                            )}
                            onClick={() => {
                                handleChoosing(onAttachingForeground);
                            }}
                        >
                            <i className="bi bi-layers" aria-hidden="true" />
                            {tran('Attach a foreground session')}
                        </button>
                        <div className="chat-menu-line" />
                        {/*
                         * It puts `/` in the box and the command list opens,
                         * which is how someone who never read the placeholder
                         * learns what `/` is for.
                         */}
                        <button
                            type="button"
                            role="menuitem"
                            className="chat-menu-item chat-start-command"
                            aria-label={tran('List every command')}
                            title={tran(
                                'Start a command: puts / in the box and lists the commands you can type',
                            )}
                            onClick={() => {
                                handleChoosing(onStartingCommand);
                            }}
                        >
                            <i
                                className="bi bi-slash-square"
                                aria-hidden="true"
                            />
                            {tran('List every command')}
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
