// @vitest-environment jsdom

// The question an uncaught error raises, with its REAL dialog: the popup
// host, the confirm it draws and the button a person presses. On the running
// app that press is a person's and no automation may make it, so this is
// where it is made -- the whole way from the error to the assistant being
// handed the problem, with only the window-opening end stubbed.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { store, openChatbotReportingMock } = vi.hoisted(() => {
    return {
        store: new Map<string, string>(),
        openChatbotReportingMock: vi.fn(async (_problem: string) => {
            return true;
        }),
    };
});

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../app-modal/PrimitiveModalComp', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
    POPUP_KEYBOARD_LAYER: 'popup',
}));
vi.mock('../popup-widget/HeaderAlertPopupComp', () => ({
    default: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: vi.fn(),
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('./appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (name: string) => store.get(name) ?? null,
    getSettingForce: (name: string) => store.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        store.set(name, value);
    },
    removeSetting: (name: string) => {
        store.delete(name);
    },
}));
// The one end that is not real: it asks the 🤖's two questions and opens a
// window.
vi.mock('./ai/chatbotHandoffHelpers', () => ({
    openChatbotReporting: openChatbotReportingMock,
}));

import HandleAlertComp from '../popup-widget/HandleAlertComp';
import { offerErrorReporting } from './errorReportOfferHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

function findButton(words: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return (button.textContent ?? '').trim() === words;
    });
}

// The dialog is a lazy chunk and the slot it opens in is taken with an
// await, so it is looked for until it is there.
async function waitForDialog() {
    for (let attempt = 0; attempt < 50; attempt++) {
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });
        });
        if (container.querySelector('#app-confirm-popup') !== null) {
            return;
        }
    }
    throw new Error('the dialog never came up');
}

beforeEach(async () => {
    store.clear();
    openChatbotReportingMock.mockClear();
    document.title = 'Open Worship app - Reader (📖)';
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        root = createRoot(container);
        root.render(<HandleAlertComp />);
    });
});

afterEach(async () => {
    await act(async () => {
        root?.unmount();
    });
    root = null;
    container.remove();
});

describe('the dialog an uncaught error raises', () => {
    test('says what a report carries, and Report a Problem hands the error to the assistant', async () => {
        const asking = offerErrorReporting(
            new ReferenceError('notDefinedAnywhere is not defined'),
        );
        await waitForDialog();
        const dialog = container.querySelector('#app-confirm-popup')!;
        expect(dialog.getAttribute('role')).toBe('alertdialog');
        expect(dialog.textContent).toContain('Something Went Wrong');
        // Said before anything is looked at: what goes into a report, and
        // that nothing is sent by this press.
        expect(dialog.textContent).toContain(
            "this computer's system information and the app's console log",
        );
        expect(dialog.textContent).toContain(
            'Nothing is sent until you say so.',
        );
        expect(findButton('Not Now')).toBeDefined();
        const report = findButton('Report a Problem');
        expect(report).toBeDefined();
        // Nothing has happened yet: the question is only asked.
        expect(openChatbotReportingMock).not.toHaveBeenCalled();

        await act(async () => {
            report!.click();
        });
        await expect(asking).resolves.toBe(true);
        // The dialog is gone and the assistant has the error: its kind and
        // message and the window it happened in -- never the stack.
        expect(container.querySelector('#app-confirm-popup')).toBeNull();
        expect(openChatbotReportingMock).toHaveBeenCalledTimes(1);
        expect(openChatbotReportingMock).toHaveBeenCalledWith(
            'The app showed an error in the Reader (📖) window: ' +
                'ReferenceError: notDefinedAnywhere is not defined',
        );
    });

    test('Not Now opens nothing, and the caller goes on to its reload question', async () => {
        const asking = offerErrorReporting(new Error('boom'));
        await waitForDialog();
        await act(async () => {
            findButton('Not Now')!.click();
        });
        await expect(asking).resolves.toBe(false);
        expect(openChatbotReportingMock).not.toHaveBeenCalled();
        expect(container.querySelector('#app-confirm-popup')).toBeNull();
    });

    // An error that comes back after every reload must not ask every time.
    test('is not raised again inside ten minutes', async () => {
        const first = offerErrorReporting(new Error('boom'));
        await waitForDialog();
        await act(async () => {
            findButton('Not Now')!.click();
        });
        await first;
        await expect(offerErrorReporting(new Error('boom'))).resolves.toBe(
            false,
        );
        expect(container.querySelector('#app-confirm-popup')).toBeNull();
        expect(openChatbotReportingMock).not.toHaveBeenCalled();
    });
});
