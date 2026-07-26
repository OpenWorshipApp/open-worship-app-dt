import './KeyboardScreencastComp.scss';

import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import {
    appendKeystroke,
    toKeystrokeLabel,
    KEYSTROKE_HIDE_DELAY_MS,
    type KeystrokeType,
} from './keyboardScreencastHelpers';

// The screencast strip itself. Lazy-loaded by `PresentingControlComp`, so an
// operator who never turns it on pays for nothing but the menu entry — and while
// it IS on, the whole cost is one passive listener plus a handful of DOM nodes
// that only exist during the second or so after a key.
export default function KeyboardScreencastComp() {
    const [keystrokes, setKeystrokes] = useState<KeystrokeType[]>([]);
    useAppEffect(() => {
        let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
        const handleKeyDown = (event: KeyboardEvent) => {
            // A leaned-on key auto-repeats ~30 times a second; the strip only
            // ever wants the press.
            if (event.repeat) {
                return;
            }
            const label = toKeystrokeLabel(event);
            if (label === null) {
                return;
            }
            setKeystrokes((oldKeystrokes) => {
                return appendKeystroke(oldKeystrokes, label);
            });
            if (hideTimeoutId !== null) {
                clearTimeout(hideTimeoutId);
            }
            hideTimeoutId = setTimeout(() => {
                hideTimeoutId = null;
                setKeystrokes([]);
            }, KEYSTROKE_HIDE_DELAY_MS);
        };
        // Capture, so a key a component swallows (`preventDefault`, or a
        // `stopPropagation` on the way up) is still SHOWN — the audience is
        // watching what was pressed, not what the app decided to do with it.
        // Passive: this listener must never be able to delay a keystroke.
        document.addEventListener('keydown', handleKeyDown, {
            capture: true,
            passive: true,
        });
        return () => {
            document.removeEventListener('keydown', handleKeyDown, {
                capture: true,
            });
            if (hideTimeoutId !== null) {
                clearTimeout(hideTimeoutId);
            }
        };
    }, []);

    // Nothing in the DOM at all between bursts, rather than an empty box kept
    // around: the overlay is `position: fixed` over every window in the app.
    if (keystrokes.length === 0) {
        return null;
    }

    return (
        // Hidden from assistive tech on purpose: a screen reader user already
        // knows which key they pressed, and this would echo every one of them.
        <div id="keyboard-screencast" aria-hidden="true">
            {keystrokes.map(({ label, count }, index) => {
                return (
                    <span
                        key={`${index}-${label}`}
                        className="keyboard-screencast-key"
                    >
                        {label}
                        {count > 1 ? (
                            <small className="keyboard-screencast-count">
                                {`×${count}`}
                            </small>
                        ) : null}
                    </span>
                );
            })}
        </div>
    );
}
