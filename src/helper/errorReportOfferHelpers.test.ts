// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, showAppConfirmMock, openChatbotReportingMock } = vi.hoisted(
    () => {
        return {
            store: new Map<string, string>(),
            showAppConfirmMock: vi.fn(
                async (..._args: any[]): Promise<boolean> => {
                    return true;
                },
            ),
            openChatbotReportingMock: vi.fn(
                async (_problem: string): Promise<boolean> => {
                    return true;
                },
            ),
        };
    },
);

vi.mock('../lang/langHelpers', () => {
    return { tran: (key: string) => key };
});
vi.mock('../popup-widget/popupWidgetHelpers', () => {
    return { showAppConfirm: showAppConfirmMock };
});
vi.mock('./settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return store.get(key) ?? null;
        },
        setSetting: (key: string, value: string) => {
            store.set(key, value);
        },
        getSettingForce: (key: string) => {
            return store.get(key) ?? null;
        },
        removeSetting: (key: string) => {
            store.delete(key);
        },
    };
});
vi.mock('./ai/chatbotHandoffHelpers', () => {
    return { openChatbotReporting: openChatbotReportingMock };
});

import {
    ERROR_REPORT_OFFER_GAP,
    offerErrorReporting,
} from './errorReportOfferHelpers';

describe('offerErrorReporting', () => {
    beforeEach(() => {
        vi.useRealTimers();
        store.clear();
        showAppConfirmMock.mockClear();
        showAppConfirmMock.mockResolvedValue(true);
        openChatbotReportingMock.mockClear();
        openChatbotReportingMock.mockResolvedValue(true);
        document.title = 'Open Worship app - Presenter (🖥️)';
    });

    // The press nothing automated may make: what it does is held here.
    it('asks first, and on a yes opens the assistant on the error', async () => {
        const isOpened = await offerErrorReporting(
            new ReferenceError('a is not defined'),
        );
        expect(isOpened).toBe(true);
        expect(showAppConfirmMock).toHaveBeenCalledTimes(1);
        const [title, body, options] = showAppConfirmMock.mock.calls[0];
        expect(title).toBe('Something Went Wrong');
        // Said before they agree: what a report carries, and that nothing
        // is sent by agreeing.
        expect(body).toContain("this computer's system information");
        expect(body).toContain("the app's console log");
        expect(body).toContain('Nothing is sent until you say so');
        expect(options).toEqual({
            confirmButtonLabel: 'Report a Problem',
            cancelButtonLabel: 'Not Now',
        });
        // The window, the kind and the message; never a stack.
        expect(openChatbotReportingMock).toHaveBeenCalledWith(
            'The app showed an error in the Presenter (🖥️) window: ' +
                'ReferenceError: a is not defined',
        );
    });

    it('opens nothing on Not Now, so the reload question follows', async () => {
        showAppConfirmMock.mockResolvedValueOnce(false);
        expect(await offerErrorReporting(new Error('boom'))).toBe(false);
        expect(openChatbotReportingMock).not.toHaveBeenCalled();
    });

    // AI switched off, or the caution declined: the assistant did not open.
    it('says the assistant was not opened when its own questions said no', async () => {
        openChatbotReportingMock.mockResolvedValueOnce(false);
        expect(await offerErrorReporting(new Error('boom'))).toBe(false);
        expect(openChatbotReportingMock).toHaveBeenCalledTimes(1);
    });

    // An error that comes back after every reload must not ask every time.
    it('asks once in ten minutes, whatever the answer was, across reloads', async () => {
        vi.useFakeTimers();
        showAppConfirmMock.mockResolvedValueOnce(false);
        await offerErrorReporting(new Error('first'));
        expect(await offerErrorReporting(new Error('second'))).toBe(false);
        vi.advanceTimersByTime(ERROR_REPORT_OFFER_GAP - 1000);
        expect(await offerErrorReporting(new Error('third'))).toBe(false);
        expect(showAppConfirmMock).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(2000);
        expect(await offerErrorReporting(new Error('fourth'))).toBe(true);
        expect(showAppConfirmMock).toHaveBeenCalledTimes(2);
        expect(openChatbotReportingMock).toHaveBeenCalledTimes(1);
    });

    it('asks of a rejection with nothing in it too', async () => {
        document.title = 'Reader';
        await offerErrorReporting(undefined);
        expect(openChatbotReportingMock).toHaveBeenCalledWith(
            'The app showed an error in the Reader window',
        );
    });
});
