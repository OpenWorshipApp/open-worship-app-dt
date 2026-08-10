import '../others/appInit.scss';
import '../others/theme-override-dark.scss';
import '../others/theme-override-light.scss';
import './FinderAppComp.scss';
// Must stay last -- see the note at the top of `interaction.scss`.
import '../others/interaction.scss';

import type { ChangeEvent, KeyboardEvent, PointerEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useThemeSource } from '../others/themeHelpers';
import FindPanelBodyComp from './FindPanelBodyComp';
import type { FoundInPageResult, LookupOptions } from './finderHelpers';
import {
    closeFinder,
    findString,
    listenFocusFinder,
    listenFoundInPage,
    startFinderDragging,
    stopFinderDragging,
} from './finderHelpers';

/**
 * Chrome-style find bar. It renders in its OWN `WebContentsView`, pinned by the
 * main process to the top-right of the window it searches -- see
 * `electron/finderOverlayHelpers.ts` for why it cannot live in that window's
 * page. Everything it does to the page goes out over IPC.
 */
export default function FinderAppComp() {
    const [queryText, setQueryText] = useState('');
    const [isMatchCase, setIsMatchCase] = useState(false);
    const [foundResult, setFoundResult] = useState<FoundInPageResult | null>(
        null,
    );
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { theme } = useThemeSource();

    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(250);
    }, []);

    const isMatchCaseRef = useAppCurrentRef(isMatchCase);
    const queryTextRef = useAppCurrentRef(queryText);

    const runFind = useCallback(
        (text: string, options: LookupOptions = {}, isImmediate = false) => {
            attemptTimeout(() => {
                if (!text) {
                    setFoundResult(null);
                    findString('');
                    return;
                }
                findString(text, {
                    matchCase: isMatchCaseRef.current,
                    ...options,
                });
            }, isImmediate);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const runFindRef = useAppCurrentRef(runFind);

    useAppEffect(() => {
        return listenFoundInPage(setFoundResult);
    }, []);

    const focusQuery = useCallback(() => {
        const input = inputRef.current;
        input?.focus();
        input?.select();
    }, []);

    // Pressing the shortcut again while the bar is open re-selects the query,
    // the way a browser does, instead of opening a second bar.
    useAppEffect(() => {
        return listenFocusFinder(() => {
            focusQuery();
            if (queryTextRef.current) {
                runFindRef.current(queryTextRef.current, {}, true);
            }
        });
    }, []);

    const handleClosing = useCallback(() => {
        closeFinder();
    }, []);

    const handleStepping = useCallback((isForward: boolean) => {
        const text = queryTextRef.current;
        if (!text) {
            return;
        }
        runFindRef.current(
            text,
            { forward: isForward, findNext: true },
            // Immediate, so it also cancels the pending "new search" a fast
            // typist left behind -- that one would reset the active match to 1.
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePreviousClicking = useCallback(() => {
        handleStepping(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNextClicking = useCallback(() => {
        handleStepping(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleQueryChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setQueryText(text);
            runFindRef.current(text, {}, !text);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleMatchCaseToggling = useCallback(() => {
        const newIsMatchCase = !isMatchCaseRef.current;
        // Set the ref too: `runFind` reads it synchronously below, before the
        // re-render this `setState` schedules.
        isMatchCaseRef.current = newIsMatchCase;
        setIsMatchCase(newIsMatchCase);
        runFindRef.current(queryTextRef.current, {}, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSteppingRef = useAppCurrentRef(handleStepping);
    const handleKeyDowning = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeFinder();
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSteppingRef.current(!event.shiftKey);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Dragging is measured and applied by the main process: the bar is only as
    // wide as itself, so the moment the pointer leaves it the moves land on the
    // page underneath instead. Only the grab offset travels from here.
    const handleGripPointerDowning = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startFinderDragging(event.clientX);
        },
        [],
    );
    const handleGripPointerUping = useCallback(() => {
        stopFinderDragging();
    }, []);

    // Safety net: a release that lands outside this small view, or the window
    // losing focus mid-drag, must not leave the main process polling the cursor
    // forever. Stopping when nothing is being dragged is a no-op.
    useAppEffect(() => {
        const handleDraggingStop = () => {
            stopFinderDragging();
        };
        globalThis.addEventListener('pointerup', handleDraggingStop);
        globalThis.addEventListener('pointercancel', handleDraggingStop);
        globalThis.addEventListener('blur', handleDraggingStop);
        return () => {
            globalThis.removeEventListener('pointerup', handleDraggingStop);
            globalThis.removeEventListener('pointercancel', handleDraggingStop);
            globalThis.removeEventListener('blur', handleDraggingStop);
        };
    }, []);

    return (
        <div className="app finder-container" data-bs-theme={theme}>
            <FindPanelBodyComp
                inputRef={inputRef}
                queryText={queryText}
                isMatchCase={isMatchCase}
                matchCount={foundResult?.matches ?? 0}
                activeMatchOrdinal={foundResult?.activeMatchOrdinal ?? 0}
                onQueryChanging={handleQueryChanging}
                onKeyDowning={handleKeyDowning}
                onPreviousClicking={handlePreviousClicking}
                onNextClicking={handleNextClicking}
                onMatchCaseToggling={handleMatchCaseToggling}
                onClosing={handleClosing}
                onGripPointerDowning={handleGripPointerDowning}
                onGripPointerUping={handleGripPointerUping}
            />
        </div>
    );
}
