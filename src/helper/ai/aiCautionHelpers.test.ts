// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

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

import { askAiCaution } from './aiCautionHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    h.showAppConfirmMock.mockResolvedValue(true);
    h.popupWidgetManager.openConfirm = vi.fn();
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
        const [title, body] = h.showAppConfirmMock.mock.calls[0] as any;
        expect(title).toBe('Be careful with AI');
        expect(body).toContain('AI can be confidently wrong.');
        // The assistant's own risk: it reads this app and can act on it.
        expect(body).toContain('live projector');
        expect(body).not.toContain('leaves this computer');
    });

    test('warns about a stranger site for the AI Chat window', async () => {
        await askAiCaution('aichat');
        const [, body] = h.showAppConfirmMock.mock.calls[0] as any;
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
});
