import { useCallback, useMemo, useRef, useState } from 'react';

import { genThrottleAttempt } from '../../helper/timeoutHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { useScreenLongTextManagerEvents } from '../managers/screenEventHelpers';
import ScreenLongTextManager from '../managers/ScreenLongTextManager';
import { toBibleTextStyleView } from '../bibleTextStyleHelpers';

// A slider fires per pixel, and every change that reaches the manager is a
// synchronous setting write, a message to every screen and a repaint of a
// whole screen of outlined text. The projector should still FOLLOW the drag,
// so changes go out at most this often, the last one always among them.
const COMMIT_WINDOW_MILLISECOND = 80;

/**
 * The on-screen Bible text style, for the panel that edits it: what to draw
 * the controls from, and how to change it.
 *
 * The controls draw from a local copy, changed the moment a control moves,
 * while the change itself goes out behind it. Drawn from the manager instead,
 * a thumb being dragged jumped back to the value the previous commit carried.
 * A style changed anywhere else -- Ctrl+wheel on a mini screen, the contrast
 * fix a colour background makes -- still moves the panel with it.
 */
export function useBibleTextStyleEditing() {
    const [textStyle, setTextStyle] = useState(() => {
        return ScreenLongTextManager.textStyle;
    });
    // What was changed here and has not gone out yet.
    const pendingRef = useRef<AnyObjectType | null>(null);
    useScreenLongTextManagerEvents(['text-style'], undefined, () => {
        // While something is waiting, the copy here is the newer one: the
        // broadcast is an earlier commit of this same drag.
        if (pendingRef.current !== null) {
            return;
        }
        setTextStyle(ScreenLongTextManager.textStyle);
    });
    // Per instance: a module-level one would let a panel that closed swallow
    // the last change of the one that opened after it.
    const attemptCommit = useMemo(() => {
        return genThrottleAttempt(COMMIT_WINDOW_MILLISECOND);
    }, []);
    const applyStyle = useCallback(
        (patch: AnyObjectType) => {
            pendingRef.current = { ...pendingRef.current, ...patch };
            setTextStyle((oldTextStyle) => {
                return { ...oldTextStyle, ...patch };
            });
            attemptCommit(() => {
                const pending = pendingRef.current;
                pendingRef.current = null;
                if (pending !== null) {
                    ScreenLongTextManager.applyTextStyle(pending);
                }
            });
        },
        [attemptCommit],
    );
    const view = useMemo(() => {
        return toBibleTextStyleView(textStyle);
    }, [textStyle]);
    return [view, applyStyle] as const;
}
