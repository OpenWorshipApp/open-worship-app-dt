// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

import type { ConfirmDataType } from './popupWidgetHelpers';
import {
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
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
