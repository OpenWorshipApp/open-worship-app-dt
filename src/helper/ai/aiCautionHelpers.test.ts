// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const h = vi.hoisted(() => ({
    showAppConfirmMock: vi.fn(async () => true),
    popupWidgetManager: {
        openConfirm: null as null | ((_: any) => void),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
    popupWidgetManager: h.popupWidgetManager,
}));

// The hide lives in the browser's own storage (jsdom has one), shared by
// every window of the app; the test reads it back the way a window does.
function readStoredHiddenUntil() {
    return localStorage.getItem(AI_CAUTION_HIDDEN_UNTIL_SETTING);
}

import {
    AI_CAUTION_HIDDEN_UNTIL_SETTING,
    askAiCaution,
    checkIsAiCautionHidden,
    hideAiCautionForAWhile,
    readAiCautionHiddenUntil,
} from './aiCautionHelpers';

const DAY = 24 * 60 * 60 * 1000;

/** The words of the dialog's body, whatever React element carries them. */
function bodyTextOf(callIndex = 0) {
    const [, body] = h.showAppConfirmMock.mock.calls[callIndex] as any;
    return typeof body === 'string' ? body : renderToStaticMarkup(body);
}

beforeEach(() => {
    vi.clearAllMocks();
    h.showAppConfirmMock.mockResolvedValue(true);
    h.popupWidgetManager.openConfirm = vi.fn();
    localStorage.clear();
});

describe('askAiCaution', () => {
    test('asks before either window opens, and passes the answer back', async () => {
        await expect(askAiCaution('assistant')).resolves.toBe(true);
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await expect(askAiCaution('assistant')).resolves.toBe(false);
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(2);
    });

    test('warns about THIS app for the assistant', async () => {
        await askAiCaution('assistant');
        const [title] = h.showAppConfirmMock.mock.calls[0] as any;
        expect(title).toBe('Be careful with AI');
        const body = bodyTextOf();
        expect(body).toContain('AI can be confidently wrong.');
        // The assistant's own risk: it reads this app and can act on it.
        expect(body).toContain('live projector');
        expect(body).not.toContain('leaves this computer');
    });

    test('warns about a stranger site for the AI Chat window', async () => {
        await askAiCaution('aichat');
        const body = bodyTextOf();
        // A different risk entirely -- one warning vague enough to cover both
        // would have warned about neither.
        expect(body).toContain('leaves this computer');
        expect(body).not.toContain('live projector');
    });

    test('offers Open rather than a bare Yes', async () => {
        await askAiCaution('aichat');
        const [, , options] = h.showAppConfirmMock.mock.calls[0] as any;
        expect(options).toMatchObject({
            confirmButtonLabel: 'Open',
            cancelButtonLabel: 'Cancel',
            escToCancel: true,
        });
    });

    // The one that is easy to get wrong. `showAppConfirm` answers `false` when
    // the window has no popup host, which is indistinguishable from Cancel --
    // and Local Web Share and the Lyric Editor have none while still carrying
    // the assistant on Ctrl+Shift+A. Failing closed there would make the
    // shortcut silently do nothing, which reads as a broken app.
    test('fails OPEN in a window that cannot draw a dialog', async () => {
        h.popupWidgetManager.openConfirm = null;
        await expect(askAiCaution('assistant')).resolves.toBe(true);
        expect(h.showAppConfirmMock).not.toHaveBeenCalled();
    });

    // The user's ask, 2026-10-10: "it's annoying for some users, let put any
    // button to hide it for a while, e.g. hide for 30 days".
    test('carries a box that puts the caution away for 30 days, on Open only', async () => {
        await askAiCaution('assistant');
        expect(bodyTextOf()).toContain('Do not show this again for 30 days');
        // The box is ticked on the dialog while it is up: the mock ticks it
        // through the body's own callback before answering.
        const answerTicked = (isOk: boolean) => {
            (h.showAppConfirmMock as any).mockImplementationOnce(
                async (_title: string, body: any) => {
                    body.props.onHideChange(true);
                    return isOk;
                },
            );
        };
        // Ticked, then cancelled: a change of mind, nothing written.
        answerTicked(false);
        await expect(askAiCaution('assistant')).resolves.toBe(false);
        expect(readStoredHiddenUntil()).toBeNull();
        // Ticked and opened: hidden until 30 days from now.
        const before = Date.now();
        answerTicked(true);
        await expect(askAiCaution('assistant')).resolves.toBe(true);
        const until = Number(readStoredHiddenUntil());
        expect(until).toBeGreaterThanOrEqual(before + 30 * DAY);
        expect(until).toBeLessThan(before + 31 * DAY);
        // And the next open does not ask at all.
        await expect(askAiCaution('aichat')).resolves.toBe(true);
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(3);
    });

    test('asks again once the 30 days are up, and on a value that is not a time', async () => {
        localStorage.setItem(
            AI_CAUTION_HIDDEN_UNTIL_SETTING,
            String(Date.now() - 1),
        );
        await askAiCaution('assistant');
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        localStorage.setItem(AI_CAUTION_HIDDEN_UNTIL_SETTING, 'later');
        await askAiCaution('assistant');
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(2);
    });
});

describe('the hidden-until setting', () => {
    test('is read as a time in the future, and nothing else', () => {
        const now = 1_000_000;
        expect(readAiCautionHiddenUntil(null, now)).toBeNull();
        expect(readAiCautionHiddenUntil('', now)).toBeNull();
        expect(readAiCautionHiddenUntil('soon', now)).toBeNull();
        expect(readAiCautionHiddenUntil('999999', now)).toBeNull();
        expect(readAiCautionHiddenUntil('1000001', now)).toBe(1_000_001);
    });

    test('is written 30 days ahead and read back by the chat window', () => {
        const now = 5_000_000;
        expect(checkIsAiCautionHidden(now)).toBe(false);
        expect(hideAiCautionForAWhile(now)).toBe(now + 30 * DAY);
        expect(checkIsAiCautionHidden(now)).toBe(true);
        expect(checkIsAiCautionHidden(now + 30 * DAY)).toBe(false);
    });
});
