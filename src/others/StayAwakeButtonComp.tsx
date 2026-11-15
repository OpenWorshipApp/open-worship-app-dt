import type { MouseEvent } from 'react';
import { useCallback, useState } from 'react';

import {
    STAY_AWAKE_SETTING_NAME,
    toIsStayAwake,
    toStayAwakeTimerDelay,
    toStayAwakeUntil,
    toStayAwakeValueForMinutes,
} from '../../electron/stayAwakeProtocol';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getCurrentLocale, tran } from '../lang/langHelpers';
import { toStopwatchHistoryWhenText } from '../presenter-foreground/stopwatchHistoryHelpers';
import { appHomeStorage } from '../server/appHomeStorage';

// `10:42 AM` today, `Nov 16, 1:42 AM` past midnight -- in the app's own
// language, the way the stopwatch's history says when.
function toUntilText(until: number, now: number) {
    return toStopwatchHistoryWhenText(until, now, getCurrentLocale());
}

function genCheckIcon(isActive: boolean) {
    return genContextMenuItemIcon('check2', { opacity: isActive ? 1 : 0 });
}

// Every label a literal key (EN-20), so the coverage test can read them.
function genStayAwakeMenuItems(
    value: string | null,
    now: number,
    setValue: (newValue: string) => void,
): ContextMenuItemType[] {
    const isStayAwake = toIsStayAwake(value, now);
    // When a running timer ends; null while on until switched off, or off.
    const timedUntil = isStayAwake ? toStayAwakeUntil(value) : null;
    const genTimedItem = (label: string, minutes: number) => {
        return {
            childBefore: genCheckIcon(false),
            menuElement: label,
            onSelect: () => {
                setValue(toStayAwakeValueForMinutes(minutes));
            },
        };
    };
    return [
        // A running timer is a choice of its own, ticked: which length it
        // was chosen with is not kept, only when it ends. Choosing it keeps
        // it as it is -- a row with no `onSelect` is drawn disabled.
        ...(timedUntil !== null
            ? [
                  {
                      childBefore: genCheckIcon(true),
                      menuElement: tran('Until {time}').replace(
                          '{time}',
                          toUntilText(timedUntil, now),
                      ),
                      onSelect: () => {},
                  },
              ]
            : []),
        {
            childBefore: genCheckIcon(isStayAwake && timedUntil === null),
            menuElement: tran('Until I turn it off'),
            onSelect: () => {
                setValue('true');
            },
        },
        genTimedItem(tran('For 30 minutes'), 30),
        genTimedItem(tran('For 1 hour'), 60),
        genTimedItem(tran('For 2 hours'), 120),
        genTimedItem(tran('For 4 hours'), 240),
        {
            childBefore: genCheckIcon(!isStayAwake),
            menuElement: tran('Off'),
            onSelect: () => {
                setValue('false');
            },
            style: { borderTop: '1px solid var(--bs-border-color)' },
        },
    ];
}

/**
 * Whether this computer is kept from sleeping while the main window is on the
 * Presenter or on the Screen Mirror page -- the two left alone for a whole
 * service. On unless switched off; pressed, it offers to stay awake until
 * switched off, for a while (30 minutes to 4 hours), or not at all. The main
 * process holds the OS request (`keepAwakeOnPresentingPages` in
 * `electron/ElectronMainController.ts`), acts on the very write this button
 * makes and lets go by itself when a timed choice runs out, so there is no
 * second message to send and nothing here to release. The one timer here only
 * turns the cup off at that moment.
 *
 * Off does not let a service go dark: a showing screen keeps the display awake
 * by itself (`ElectronScreenController`), whatever this says.
 *
 * A file of its own rather than one more button in `commonButtons`: the Screen
 * Mirror page mounts it too, and that page loads none of the app header's
 * modules.
 */
export default function StayAwakeButtonComp({
    className,
}: Readonly<{ className?: string }>) {
    const [value, setValue] = useState(() => {
        return appHomeStorage.getItem(STAY_AWAKE_SETTING_NAME);
    });
    // When the value was last judged: moved on only when it is written and
    // when a timer runs out, so the idle header never re-renders.
    const [now, setNow] = useState(() => Date.now());
    const until = toStayAwakeUntil(value);
    const isStayAwake = toIsStayAwake(value, now);
    const timedUntil = isStayAwake ? until : null;
    useAppEffect(() => {
        if (until === null || until <= now) {
            return;
        }
        const timeoutId = setTimeout(
            () => {
                setNow(Date.now());
            },
            toStayAwakeTimerDelay(until, now),
        );
        return () => {
            clearTimeout(timeoutId);
        };
    }, [until, now]);
    const valueRef = useAppCurrentRef(value);
    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        // Hung under the button, not at the pointer: a press from the
        // keyboard carries no coordinates, and the menu would open in the
        // window's top-left corner.
        const { right, bottom } = event.currentTarget.getBoundingClientRect();
        const setNewValue = (newValue: string) => {
            appHomeStorage.setItem(STAY_AWAKE_SETTING_NAME, newValue);
            setValue(newValue);
            setNow(Date.now());
        };
        showAppContextMenu(
            event as any,
            genStayAwakeMenuItems(valueRef.current, Date.now(), setNewValue),
            { coord: { x: right, y: bottom } },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    let stateText = tran(
        'turned off, this computer may sleep when no screen is showing',
    );
    if (timedUntil !== null) {
        stateText = tran(
            'this computer will not sleep while this page is open, until {time}',
        ).replace('{time}', toUntilText(timedUntil, now));
    } else if (isStayAwake) {
        stateText = tran(
            'this computer will not sleep while this page is open',
        );
    }
    let iconName = 'cup';
    if (timedUntil !== null) {
        iconName = 'cup-hot';
    } else if (isStayAwake) {
        iconName = 'cup-hot-fill';
    }
    return (
        <button
            type="button"
            className={
                `btn btn-outline-${isStayAwake ? 'info' : 'secondary'}` +
                (className ? ` ${className}` : '')
            }
            title={`${tran('Stay Awake')} — ${stateText}`}
            // The name stays put and `aria-pressed` carries the state, so a
            // screen reader says "Stay Awake, pressed" rather than a sentence
            // that changes under it.
            aria-label={tran('Stay Awake')}
            aria-pressed={isStayAwake}
            aria-haspopup="menu"
            onClick={handleClick}
        >
            <i className={`bi bi-${iconName}`} aria-hidden="true" />
        </button>
    );
}
