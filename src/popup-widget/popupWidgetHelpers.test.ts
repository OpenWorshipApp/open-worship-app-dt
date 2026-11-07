// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import type { ConfirmDataType } from './popupWidgetHelpers';
import {
    attemptLocking,
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
    showAppInput,
} from './popupWidgetHelpers';

describe('a popup gives the keyboard back', () => {
    let pendingConfirm: ConfirmDataType | null = null;
    let closeAlert: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML =
            '<button id="player">player</button><input id="other" />';
        popupWidgetManager.openConfirm = (data) => {
            pendingConfirm = data;
            // The popup takes focus while it is open.
            (document.activeElement as HTMLElement | null)?.blur();
        };
        popupWidgetManager.openAlert = (data) => {
            closeAlert = data?.onClose ?? null;
            (document.activeElement as HTMLElement | null)?.blur();
        };
    });

    afterEach(() => {
        popupWidgetManager.openConfirm = null;
        popupWidgetManager.openAlert = null;
        pendingConfirm = null;
        closeAlert = null;
        vi.useRealTimers();
    });

    test('to what held it when the popup opened', async () => {
        const player = document.getElementById('player') as HTMLElement;
        player.focus();
        const answer = showAppConfirm('Title', 'Body');
        expect(document.activeElement).toBe(document.body);

        pendingConfirm?.onConfirm(true);
        await expect(answer).resolves.toBe(true);
        vi.runAllTimers();
        expect(document.activeElement).toBe(player);
    });

    test('but not over a field the answer moved the caret into', async () => {
        const player = document.getElementById('player') as HTMLElement;
        const other = document.getElementById('other') as HTMLElement;
        player.focus();
        const closed = showAppAlert('Title', 'Message');
        other.focus();
        closeAlert?.();
        await closed;
        vi.runAllTimers();
        expect(document.activeElement).toBe(other);
    });

    test('and resolves as before when no popup host is mounted', async () => {
        popupWidgetManager.openConfirm = null;
        await expect(showAppConfirm('Title', 'Body')).resolves.toBe(false);
    });
});

describe('one popup at a time', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('a second popup waits for the first to give the slot back', async () => {
        await attemptLocking('confirm', false);
        let isAlertIn = false;
        const alertIn = attemptLocking('alert', false).then(() => {
            isAlertIn = true;
        });
        await vi.advanceTimersByTimeAsync(3000);
        expect(isAlertIn).toBe(false);

        await attemptLocking('confirm', true);
        await vi.advanceTimersByTimeAsync(1000);
        await alertIn;
        expect(isAlertIn).toBe(true);
        await attemptLocking('alert', true);
    });

    test('releasing a slot another popup holds waits, and gives up once it is free', async () => {
        await attemptLocking('alert', false);
        let isDone = false;
        const release = attemptLocking('confirm', true).then(() => {
            isDone = true;
        });
        await vi.advanceTimersByTimeAsync(2000);
        expect(isDone).toBe(false);
        await attemptLocking('alert', true);
        await vi.advanceTimersByTimeAsync(1000);
        await release;
        expect(isDone).toBe(true);
        // Nothing is held any more: the next popup goes straight in.
        let isNextIn = false;
        const next = attemptLocking('input', false).then(() => {
            isNextIn = true;
        });
        await Promise.resolve();
        await next;
        expect(isNextIn).toBe(true);
        await attemptLocking('input', true);
    });

    test('with no popup host an input answers no and an alert just returns', async () => {
        popupWidgetManager.openInput = null;
        popupWidgetManager.openAlert = null;
        await expect(showAppInput('Title', null as any)).resolves.toBe(false);
        await expect(showAppAlert('Title', 'Message')).resolves.toBeUndefined();
    });
});
