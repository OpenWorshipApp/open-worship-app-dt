// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Report: the two presses (ask, then write it up), the investigation the
// window asks a model for, the card that comes back -- a way to put it right
// first, or the report itself -- and the buttons under it: Send, and the
// copies and the email that take it anywhere else. The picture, the evidence,
// the contact address and the report server are the boundaries; the report
// itself is written by the real `reportHelpers`.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    llm: {
        available: ['anthropic', 'free'] as string[],
        chosen: 'anthropic' as string | null,
    },
    askLlmBot: vi.fn(),
    callTool: vi.fn(),
    resolveAutoPicks: vi.fn(),
    collectReportEvidence: vi.fn(),
    postIssueReport: vi.fn(),
    findContactEmail: vi.fn(),
    captureAppWindow: vi.fn(),
    copyImageToClipboard: vi.fn(),
    openExternalURL: vi.fn(),
    sendData: vi.fn(),
    writeText: vi.fn(),
    pictureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        messageUtils: {
            sendData: (...args: any[]) => h.sendData(...args),
            sendDataSync: () => null,
            listenForData: () => {},
            removeListener: () => {},
        },
        browserUtils: {
            openExternalURL: (url: string) => h.openExternalURL(url),
        },
        appUtils: { handleError: () => {} },
        // What a report's subject line and its how-to-send name.
        appInfo: {
            title: 'Open Worship app',
            homepage: 'https://www.openworship.app',
        },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        settingHomePage: '/setting.html',
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    getSettingForce: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../helper/appHooks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/appHooks')>()),
    // Startup subscriptions do not run: every test presses Report.
    useAppEffect: () => {},
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => h.askLlmBot(...args),
    getAvailableLlmProviders: () => [...h.llm.available],
    getLlmProvider: () => h.llm.chosen,
    getIsLlmAuto: () => false,
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => h.callTool(...args),
}));
vi.mock('./questionHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./questionHelpers')>()),
    findKnownQuestion: async () => null,
    findTemplateAsk: async () => null,
    readKnownQuestionPage: async () => null,
    genFollowUpQuestions: async () => [],
    suggestQuestions: async () => [],
}));
vi.mock('./autoAssistantSourceHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./autoAssistantSourceHelpers')>()),
    resolveAutoPicks: (...args: any[]) => h.resolveAutoPicks(...args),
    resolveHandOnPicks: async () => null,
    clearAutoAwayServers: () => {},
}));
vi.mock('./reportHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./reportHelpers')>()),
    collectReportEvidence: (...args: any[]) => h.collectReportEvidence(...args),
    postIssueReport: (...args: any[]) => h.postIssueReport(...args),
}));
vi.mock('../server/appHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../server/appHelpers')>()),
    findContactEmail: () => h.findContactEmail(),
}));
vi.mock('../helper/appCaptureHelpers', () => ({
    captureAppWindow: () => h.captureAppWindow(),
}));
vi.mock('./attachmentHelpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./attachmentHelpers')>();
    return {
        ...actual,
        // jsdom decodes no picture: the bytes are kept as they came, in the
        // window's own store, where the report reads them back.
        genImageAttachment: async (
            source: Blob | string,
            name: string,
            filePath?: string,
        ) => {
            const id = actual.genAttachmentId();
            actual.putAttachmentData(
                id,
                typeof source === 'string' ? source : h.pictureDataUrl,
            );
            return {
                id,
                kind: 'image' as const,
                name,
                mimeType: 'image/png',
                byteSize: 68,
                ...(filePath ? { filePath } : {}),
            };
        },
        copyImageToClipboard: (dataUrl: string) =>
            h.copyImageToClipboard(dataUrl),
    };
});

import ChatbotAppComp from './ChatbotAppComp';
import { AskCancelledError } from './cancelHelpers';
import {
    REPORT_COPY_EMAIL_TOOL_NAME,
    REPORT_COPY_IMAGE_TOOL_NAME,
    REPORT_COPY_SUBJECT_TOOL_NAME,
    REPORT_COPY_TOOL_NAME,
    REPORT_EMAIL_TOOL_NAME,
    REPORT_FIXED_TOOL_NAME,
    REPORT_NOTE,
    REPORT_SEND_TOOL_NAME,
    REPORT_START_TOOL_NAME,
    REPORT_STILL_TOOL_NAME,
    genPreparedReport,
    keepPreparedReport,
    type ReportEvidenceType,
} from './reportHelpers';

const EVIDENCE: ReportEvidenceType = {
    collectedAt: '2026-10-28 10:00',
    appLine: 'Open Worship 2026.10 on Windows x64 (packaged build)',
    machineLine: 'Machine: Windows 11, Electron 40',
    windowLine: 'Window: Presenter',
    selectionLines: ['Selected: Amazing Grace'],
    screenLine: 'Screens: 1, showing',
    screenLines: ['Screen 1: a slide'],
    displayLines: ['Display 1: 1920x1080'],
    consoleLines: ['error: something broke'],
    turns: [],
};

const REPORT_ANSWER = [
    'The screen went blank because the slide had no background.',
    '',
    'REPORT:',
    'TITLE: Projector goes blank',
    'WHAT HAPPENED: The projector turned black after pressing a slide.',
    'STEPS: unknown',
].join('\n');

const FIX_ANSWER = [
    'It looks like the screen was hidden.',
    '',
    'TRY THIS:',
    'Press Show on the Mini Screen.',
    '',
    'REPORT:',
    'TITLE: Screen hidden',
].join('\n');

const SENT = {
    isSent: true,
    isQueued: false,
    sentFileNames: [],
    unsentFiles: [],
    failure: null,
    sendFailure: null,
};

describe('reporting a problem with the app', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.settings.clear();
        h.llm.available = ['anthropic', 'free'];
        h.llm.chosen = 'anthropic';
        h.askLlmBot.mockResolvedValue({ text: REPORT_ANSWER });
        h.callTool.mockRejectedValue(new Error('no tool host here'));
        h.resolveAutoPicks.mockResolvedValue([]);
        h.collectReportEvidence.mockResolvedValue(EVIDENCE);
        h.findContactEmail.mockResolvedValue({
            email: 'help@openworship.app',
            source: 'help page',
        });
        h.captureAppWindow.mockResolvedValue(h.pictureDataUrl);
        h.copyImageToClipboard.mockResolvedValue(undefined);
        h.postIssueReport.mockImplementation(async (report: any) => {
            return {
                ...SENT,
                reference: report.reference,
                filePath: `/downloads/${report.reference}.md`,
                imageFilePath: `/downloads/${report.reference}.png`,
            };
        });
        h.writeText.mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: (text: string) => h.writeText(text) },
        });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        h.settings.clear();
        delete (navigator as any).clipboard;
        vi.unstubAllGlobals();
    });

    function seedSession(
        messages: Record<string, any>[] = [],
        overrides: Record<string, any> = {},
    ) {
        h.settings.set(
            'chatbot-sessions',
            JSON.stringify({
                activeId: 'tab',
                sessions: [
                    {
                        id: 'tab',
                        title: '',
                        messages: messages.map((message, index) => {
                            return { id: index + 1, ...message };
                        }),
                        draft: '',
                        focus: 'presenter',
                        isFocusChosen: true,
                        provider: 'anthropic',
                        model: 'claude-opus-5',
                        isLocked: false,
                        ...overrides,
                    },
                ],
            }),
        );
    }

    function render() {
        act(() => root.render(<ChatbotAppComp />));
    }

    async function settle() {
        for (let index = 0; index < 2; index += 1) {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
        }
    }

    function typeQuestion(value: string) {
        const box =
            container.querySelector<HTMLTextAreaElement>('.chat-input')!;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    function botTexts() {
        return [...container.querySelectorAll('.cue-bot')].map((one) => {
            return one.textContent ?? '';
        });
    }

    function lastBot() {
        return [...container.querySelectorAll('.cue-bot')].at(-1)!;
    }

    function findButton(text: string, scope: ParentNode = container) {
        return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
            (button) => {
                return button.textContent?.trim() === text;
            },
        );
    }

    async function press(text: string, scope: ParentNode = container) {
        const button = findButton(text, scope);
        expect(button, `a button reading "${text}"`).toBeDefined();
        await act(async () => {
            button!.click();
        });
        await settle();
    }

    async function pressReport() {
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-report')!.click();
        });
        await settle();
    }

    // Typed, Report, Report it: the investigation runs and the card lands.
    async function reportTyped(complaint: string) {
        typeQuestion(complaint);
        await pressReport();
        await press('Report it');
    }

    describe('the first press asks, the second writes it up', () => {
        test('with nothing typed and nothing asked, Report asks for one line first', async () => {
            seedSession();
            render();
            await pressReport();
            expect(lastBot().textContent).toContain(
                'Tell me what went wrong first',
            );
            expect(container.querySelector('[role="alertdialog"]')).toBeNull();
            expect(h.collectReportEvidence).not.toHaveBeenCalled();
        });

        test('with an empty box the complaint is the last question asked', async () => {
            seedSession([
                { author: 'you', text: 'Why is the projector blank?' },
                { author: 'bot', text: 'Check the screen is shown.' },
            ]);
            render();
            await pressReport();
            expect(
                container.querySelector('[role="alertdialog"]')?.textContent,
            ).toContain('Why is the projector blank?');
        });

        test('Escape on the question puts it away without reporting', async () => {
            seedSession();
            render();
            typeQuestion('The projector is blank');
            await pressReport();
            const confirm = container.querySelector<HTMLElement>(
                '[role="alertdialog"]',
            )!;
            await act(async () => {
                confirm.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Escape',
                        bubbles: true,
                    }),
                );
            });
            expect(container.querySelector('[role="alertdialog"]')).toBeNull();
            expect(h.collectReportEvidence).not.toHaveBeenCalled();
        });

        test('Report it takes the picture first, reads the app, asks the model and prepares the report', async () => {
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            expect(h.captureAppWindow).toHaveBeenCalledTimes(1);
            expect(h.collectReportEvidence).toHaveBeenCalledTimes(1);
            // Asked directly, with the evidence, in their language.
            const [asked, , provider, model, , , extra] =
                h.askLlmBot.mock.calls[0];
            expect(asked).toContain('The projector goes blank');
            expect(asked).toContain('error: something broke');
            expect(provider).toBe('anthropic');
            expect(model).toBe('claude-opus-5');
            expect(extra.replyLang).toBe('en');
            // The transcript: their words, marked as a report.
            const said = container.querySelector('.cue-you')!;
            expect(said.querySelector('.cue-note')?.textContent).toBe(
                REPORT_NOTE,
            );
            expect(said.querySelector('.cue-said')?.textContent).toBe(
                'The projector goes blank',
            );
            // The card: the account, the title, and nothing sent yet.
            const card = lastBot();
            expect(card.textContent).toContain(
                'The screen went blank because the slide had no background.',
            );
            expect(card.textContent).toContain(
                'I have written this up as "Projector goes blank".',
            );
            expect(findButton('Send report', card)).toBeDefined();
            expect(findButton('Copy report', card)).toBeDefined();
            expect(card.querySelector('.chat-clip')?.textContent).toContain(
                'app screen',
            );
            expect(h.postIssueReport).not.toHaveBeenCalled();
        });

        test('with no assistant the report carries what the window saw for itself', async () => {
            h.llm.available = [];
            h.llm.chosen = null;
            seedSession([], { provider: null, model: '' });
            render();
            await reportTyped('The projector goes blank');
            expect(h.askLlmBot).not.toHaveBeenCalled();
            const card = lastBot();
            expect(card.querySelector('.cue-note')?.textContent).toBe(
                'No assistant is set up here, so this is what the window could see for itself.',
            );
            expect(card.textContent).toContain(
                'I have written this up as "The projector goes blank".',
            );
        });

        test('an assistant that cannot investigate costs the report its diagnosis, not the report', async () => {
            h.askLlmBot.mockRejectedValue(
                Object.assign(new Error('the key was refused'), {
                    cause: { status: 401 },
                }),
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            const card = lastBot();
            expect(card.querySelector('.cue-note')?.textContent).toBe(
                'I could not look into it — the key was refused. The report ' +
                    'still carries what the window could see for itself.',
            );
            expect(findButton('Send report', card)).toBeDefined();
            expect(findButton('Open Claude API keys', card)).toBeDefined();
        });

        test('a report that cannot be put together says why', async () => {
            h.collectReportEvidence.mockRejectedValue(
                new Error('the app could not be read'),
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            expect(lastBot().textContent).toContain(
                'I could not put a report together: the app could not be read',
            );
            expect(h.askLlmBot).not.toHaveBeenCalled();
        });

        test('a report with no picture to take is still a report', async () => {
            h.captureAppWindow.mockRejectedValue(new Error('no frame'));
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            const card = lastBot();
            expect(findButton('Send report', card)).toBeDefined();
            expect(card.querySelector('.chat-clip')).toBeNull();
        });

        test('on Auto the report is investigated by Auto’s first pick', async () => {
            h.resolveAutoPicks.mockResolvedValue([
                {
                    provider: 'free',
                    model: 'nvidia/nemotron-3.5-super-vl:free',
                    serverId: null,
                    label: 'Free · Nemotron Super VL',
                    modelName: 'nvidia/nemotron-3.5-super-vl:free',
                    canSeeImages: true,
                },
            ]);
            seedSession([], {
                provider: 'free',
                model: 'nvidia/nemotron-3.5-super-vl:free',
                isAuto: true,
            });
            render();
            await reportTyped('The projector goes blank');
            expect(h.resolveAutoPicks).toHaveBeenCalledTimes(1);
            const [, , provider, model] = h.askLlmBot.mock.calls[0];
            expect(provider).toBe('free');
            expect(model).toBe('nvidia/nemotron-3.5-super-vl:free');
        });

        test('Stop while it is being written says so and puts no card up', async () => {
            h.askLlmBot.mockImplementation(
                (
                    _q: string,
                    _f: string,
                    _p: string,
                    _m: string,
                    _t: any,
                    signal: AbortSignal,
                ) => {
                    return new Promise((_resolve, reject) => {
                        signal.addEventListener('abort', () => {
                            reject(new AskCancelledError());
                        });
                    });
                },
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await settle();
            expect(lastBot().textContent).toContain(
                'Stopped. I did not finish writing the report, and nothing was sent',
            );
            expect(findButton('Send report')).toBeUndefined();
        });

        test('words added while it is being written start it again with them', async () => {
            let calls = 0;
            h.askLlmBot.mockImplementation(
                (
                    _q: string,
                    _f: string,
                    _p: string,
                    _m: string,
                    _t: any,
                    signal: AbortSignal,
                ) => {
                    calls += 1;
                    if (calls === 1) {
                        return new Promise((_resolve, reject) => {
                            signal.addEventListener('abort', () => {
                                reject(new AskCancelledError());
                            });
                        });
                    }
                    return Promise.resolve({ text: REPORT_ANSWER });
                },
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            typeQuestion('It happens after the second slide');
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-add')!
                    .click();
            });
            await settle();
            expect(h.askLlmBot).toHaveBeenCalledTimes(2);
            const asked = h.askLlmBot.mock.calls[1][0];
            expect(asked).toContain('The projector goes blank');
            expect(asked).toContain('It happens after the second slide');
            expect(findButton('Send report', lastBot())).toBeDefined();
        });

        test('more typed in a report thread and Report pressed goes straight into it', async () => {
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            typeQuestion('It was the second slide');
            await pressReport();
            // No second question: they are in the middle of it.
            expect(container.querySelector('[role="alertdialog"]')).toBeNull();
            expect(h.askLlmBot).toHaveBeenCalledTimes(2);
            expect(h.askLlmBot.mock.calls[1][0]).toContain(
                'It was the second slide',
            );
        });
    });

    describe('a way to put it right first', () => {
        test('the fix card comes first; That fixed it closes the report unsent', async () => {
            h.askLlmBot.mockResolvedValue({ text: FIX_ANSWER });
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            const card = lastBot();
            expect(card.textContent).toContain('Try this first:');
            expect(card.textContent).toContain(
                'Press Show on the Mini Screen.',
            );
            await press('That fixed it', card);
            expect(lastBot().textContent).toContain(
                'Good. Nothing was sent, and this report is closed.',
            );
            expect(h.postIssueReport).not.toHaveBeenCalled();
        });

        test('Still a problem puts the prepared report up to read and send', async () => {
            h.askLlmBot.mockResolvedValue({ text: FIX_ANSWER });
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Still a problem — report it', lastBot());
            const card = lastBot();
            expect(card.textContent).toContain(
                'I have written this up as "Screen hidden".',
            );
            expect(findButton('Send report', card)).toBeDefined();
        });

        test('Still a problem on a report this window no longer holds asks for it again', async () => {
            seedSession([
                { author: 'you', text: 'The projector goes blank' },
                {
                    author: 'bot',
                    text: 'Try this first: press Show.',
                    actions: [
                        {
                            label: 'That fixed it',
                            toolName: REPORT_FIXED_TOOL_NAME,
                            args: { reference: 'OWA-261028-dead' },
                        },
                        {
                            label: 'Still a problem — report it',
                            toolName: REPORT_STILL_TOOL_NAME,
                            args: { reference: 'OWA-261028-dead' },
                        },
                    ],
                },
            ]);
            render();
            await press('Still a problem — report it');
            expect(lastBot().textContent).toContain(
                'That report is not prepared any more',
            );
        });
    });

    describe('sending it', () => {
        test('Send posts it, says it was sent, and offers every way to pass it on', async () => {
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Send report', lastBot());
            expect(h.postIssueReport).toHaveBeenCalledTimes(1);
            const [posted, signal] = h.postIssueReport.mock.calls[0];
            expect(posted.title).toBe('Projector goes blank');
            expect(signal).toBeInstanceOf(AbortSignal);
            const card = lastBot();
            expect(card.textContent).toContain(
                `Sent. Report ${posted.reference} went to the report server`,
            );
            for (const label of [
                'Copy report',
                'Copy subject',
                'Copy picture',
                'Copy email address',
                'Email it',
            ]) {
                expect(findButton(label, card), label).toBeDefined();
            }
            // The two saved files are chips that open them.
            expect(card.textContent).toContain(`${posted.reference}.md`);
            expect(card.textContent).toContain(`${posted.reference}.png`);
        });

        test('a Send for a report this window no longer holds says so', async () => {
            seedSession([
                {
                    author: 'bot',
                    text: 'I have written this up.',
                    actions: [
                        {
                            label: 'Send report',
                            toolName: REPORT_SEND_TOOL_NAME,
                            args: { reference: 'OWA-261028-gone' },
                        },
                    ],
                },
            ]);
            render();
            await press('Send report');
            expect(h.postIssueReport).not.toHaveBeenCalled();
            expect(lastBot().textContent).toContain(
                'That report is not prepared any more',
            );
        });

        test('Stop while it is sending waits to hear: not sent, and a copy is in Downloads', async () => {
            h.postIssueReport.mockImplementation(
                async (report: any, signal: AbortSignal) => {
                    await new Promise((resolve) => {
                        signal.addEventListener('abort', resolve);
                    });
                    return {
                        ...SENT,
                        isSent: false,
                        reference: report.reference,
                        filePath: `/downloads/${report.reference}.md`,
                        imageFilePath: null,
                    };
                },
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Send report', lastBot());
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await settle();
            const said = lastBot().textContent ?? '';
            expect(said).toContain('Stopped. The report was not sent');
            expect(said).toContain('A copy is in your Downloads folder.');
            expect(botTexts().join('\n')).not.toContain('Sent. Report');
        });

        test('Stop as the server took it says it had already gone', async () => {
            h.postIssueReport.mockImplementation(
                async (report: any, signal: AbortSignal) => {
                    await new Promise((resolve) => {
                        signal.addEventListener('abort', resolve);
                    });
                    return {
                        ...SENT,
                        reference: report.reference,
                        filePath: null,
                        imageFilePath: null,
                    };
                },
            );
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Send report', lastBot());
            await act(async () => {
                container
                    .querySelector<HTMLButtonElement>('.chat-stop')!
                    .click();
            });
            await settle();
            expect(lastBot().textContent).toContain(
                'It had already gone when you pressed Stop.',
            );
        });
    });

    describe('the buttons under a saved report', () => {
        async function prepareAndSend() {
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Send report', lastBot());
            return h.postIssueReport.mock.calls[0][0];
        }

        test('Copy report puts the whole document on the clipboard and says where to send it', async () => {
            const report = await prepareAndSend();
            await press('Copy report', lastBot());
            expect(h.writeText).toHaveBeenCalledWith(report.markdown);
            expect(lastBot().textContent).toContain(
                'Copied the whole report. Paste it into an email to ' +
                    'help@openworship.app, and attach ' +
                    `${report.reference}.png from your Downloads folder.`,
            );
        });

        test('Copy subject puts the subject line on the clipboard', async () => {
            const report = await prepareAndSend();
            await press('Copy subject', lastBot());
            expect(h.writeText).toHaveBeenCalledWith(report.subject);
            expect(lastBot().textContent).toContain(
                `Copied the subject line ${report.subject}.`,
            );
        });

        test('Copy picture copies the picture taken when Report was pressed', async () => {
            await prepareAndSend();
            await press('Copy picture', lastBot());
            expect(h.copyImageToClipboard).toHaveBeenCalledWith(
                h.pictureDataUrl,
            );
            expect(lastBot().textContent).toContain(
                'Copied the picture. Paste it into the email to help@openworship.app',
            );
        });

        test('Copy picture says so when the clipboard refuses it', async () => {
            h.copyImageToClipboard.mockRejectedValue(new Error('denied'));
            await prepareAndSend();
            await press('Copy picture', lastBot());
            expect(lastBot().textContent).toContain(
                'I could not put the picture on the clipboard.',
            );
        });

        test('Copy email address copies the address and says where it was read', async () => {
            await prepareAndSend();
            await press('Copy email address', lastBot());
            expect(h.writeText).toHaveBeenCalledWith('help@openworship.app');
            expect(lastBot().textContent).toContain(
                "Copied help@openworship.app (from the app's help page). " +
                    'Paste it into the To line of your email.',
            );
        });

        test('Copy email address with no clipboard shows the address to copy by hand', async () => {
            await prepareAndSend();
            h.writeText.mockRejectedValue(new Error('denied'));
            await press('Copy email address', lastBot());
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard. The address is ' +
                    'help@openworship.app',
            );
        });

        test('Email it opens the mail app with the address and subject, the report on the clipboard', async () => {
            const report = await prepareAndSend();
            await press('Email it', lastBot());
            expect(h.writeText).toHaveBeenCalledWith(report.markdown);
            expect(h.openExternalURL).toHaveBeenCalledTimes(1);
            const url: string = h.openExternalURL.mock.calls[0][0];
            expect(url.startsWith('mailto:help@openworship.app')).toBe(true);
            const said = lastBot().textContent ?? '';
            expect(said).toContain(
                'Opening your email app with help@openworship.app and the ' +
                    'subject filled in.',
            );
            expect(said).toContain(
                'The report is on your clipboard — paste it into the message, ' +
                    `and attach ${report.reference}.png`,
            );
        });

        test('Email it with no clipboard says to press Copy report', async () => {
            await prepareAndSend();
            h.writeText.mockRejectedValue(new Error('denied'));
            await press('Email it', lastBot());
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard, so press Copy report',
            );
        });

        test('Copy report and Copy subject say so when the clipboard refuses', async () => {
            await prepareAndSend();
            h.writeText.mockRejectedValue(new Error('denied'));
            await press('Copy report', lastBot());
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard. Open the report file',
            );
            await press(
                'Copy subject',
                [...container.querySelectorAll('.cue-bot')].at(-2)!,
            );
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard. The subject line is',
            );
        });
    });

    describe('a report with no contact address, or no longer held', () => {
        test('with no address the email buttons are not offered, and the copies say who to give it to', async () => {
            h.findContactEmail.mockResolvedValue(null);
            h.captureAppWindow.mockRejectedValue(new Error('no frame'));
            seedSession();
            render();
            await reportTyped('The projector goes blank');
            await press('Send report', lastBot());
            const card = lastBot();
            expect(findButton('Email it', card)).toBeUndefined();
            expect(findButton('Copy picture', card)).toBeUndefined();
            await press('Copy report', card);
            expect(lastBot().textContent).toContain(
                'Copied the whole report. Paste it into your message.',
            );
        });

        test('saved buttons whose report is gone answer each in their own words', async () => {
            h.findContactEmail.mockResolvedValue(null);
            const args = { reference: 'not-a-reference' };
            seedSession([
                {
                    author: 'bot',
                    text: 'Report saved.',
                    actions: [
                        {
                            label: 'Copy report',
                            toolName: REPORT_COPY_TOOL_NAME,
                            args,
                        },
                        {
                            label: 'Copy subject',
                            toolName: REPORT_COPY_SUBJECT_TOOL_NAME,
                            args,
                        },
                        {
                            label: 'Copy picture',
                            toolName: REPORT_COPY_IMAGE_TOOL_NAME,
                            args,
                        },
                        {
                            label: 'Copy email address',
                            toolName: REPORT_COPY_EMAIL_TOOL_NAME,
                            args,
                        },
                        {
                            label: 'Email it',
                            toolName: REPORT_EMAIL_TOOL_NAME,
                            args,
                        },
                    ],
                },
            ]);
            render();
            const card = container.querySelector('.cue-bot')!;
            await press('Copy report', card);
            expect(lastBot().textContent).toContain(
                'I no longer have that report',
            );
            await press('Copy subject', card);
            expect(lastBot().textContent).toContain(
                'I no longer have that report',
            );
            await press('Copy picture', card);
            expect(lastBot().textContent).toContain(
                'I no longer have that picture',
            );
            await press('Copy email address', card);
            expect(lastBot().textContent).toContain(
                'This build carries no contact address',
            );
            expect(h.writeText).not.toHaveBeenCalled();
            expect(h.copyImageToClipboard).not.toHaveBeenCalled();
        });

        test('Email it on a report with no address copies it and says who to pass it to', async () => {
            h.findContactEmail.mockResolvedValue(null);
            const report = genPreparedReport({
                complaint: 'The projector goes blank',
                answerText: REPORT_ANSWER,
                evidence: EVIDENCE,
                imageDataUrl: null,
                contact: null,
            });
            keepPreparedReport(report);
            seedSession([
                {
                    author: 'bot',
                    text: 'Report saved.',
                    actions: [
                        {
                            label: 'Email it',
                            toolName: REPORT_EMAIL_TOOL_NAME,
                            args: { reference: report.reference },
                        },
                    ],
                },
            ]);
            render();
            await press('Email it');
            expect(h.writeText).toHaveBeenCalledWith(report.markdown);
            expect(h.openExternalURL).not.toHaveBeenCalled();
            expect(lastBot().textContent).toContain(
                'This build carries no contact address',
            );
        });

        test('a kept report found again keeps the address it was written with', async () => {
            h.findContactEmail.mockResolvedValue(null);
            const report = genPreparedReport({
                complaint: 'The projector goes blank',
                answerText: REPORT_ANSWER,
                evidence: EVIDENCE,
                imageDataUrl: null,
                contact: { email: 'team@church.example', source: 'app' },
            });
            keepPreparedReport(report);
            seedSession([
                {
                    author: 'bot',
                    text: 'Report saved.',
                    actions: [
                        {
                            label: 'Email it',
                            toolName: REPORT_EMAIL_TOOL_NAME,
                            args: { reference: report.reference },
                        },
                        {
                            label: 'Copy report',
                            toolName: REPORT_COPY_TOOL_NAME,
                            args: { reference: report.reference },
                        },
                    ],
                },
            ]);
            render();
            const card = container.querySelector('.cue-bot')!;
            await press('Email it', card);
            expect(h.openExternalURL.mock.calls[0][0]).toMatch(
                /^mailto:team@church\.example\?/,
            );
            // No picture: nothing to attach.
            expect(lastBot().textContent).toContain(
                'The report is on your clipboard — paste it into the message.',
            );
            h.writeText.mockRejectedValue(new Error('denied'));
            await press('Email it', card);
            expect(lastBot().textContent).toContain(
                'I could not reach the clipboard, so press Copy report and ' +
                    'paste it into the message.',
            );
            h.writeText.mockResolvedValue(undefined);
            await press('Copy report', card);
            expect(lastBot().textContent).toContain(
                'Copied the whole report. Paste it into an email to ' +
                    'team@church.example.',
            );
        });
    });

    describe('a report offered by another window', () => {
        test('Report on an offer card looks into the problem it names, with what was typed', async () => {
            seedSession([
                {
                    author: 'bot',
                    text: 'Something went wrong in the app.',
                    actions: [
                        {
                            label: 'Report',
                            toolName: REPORT_START_TOOL_NAME,
                            args: { complaint: 'TypeError: x is undefined' },
                        },
                    ],
                },
            ]);
            render();
            typeQuestion('I pressed the second slide');
            await press('Report', container.querySelector('.cue-bot')!);
            expect(h.askLlmBot).toHaveBeenCalledTimes(1);
            const asked = h.askLlmBot.mock.calls[0][0];
            expect(asked).toContain('TypeError: x is undefined');
            expect(asked).toContain('I pressed the second slide');
        });

        test('an offer card that only asked what went wrong goes the ordinary way', async () => {
            seedSession([
                {
                    author: 'bot',
                    text: 'What went wrong?',
                    actions: [
                        {
                            label: 'Report',
                            toolName: REPORT_START_TOOL_NAME,
                            args: {},
                        },
                    ],
                },
            ]);
            render();
            await press('Report', container.querySelector('.cue-bot')!);
            expect(h.collectReportEvidence).not.toHaveBeenCalled();
            expect(lastBot().textContent).toContain(
                'Tell me what went wrong first',
            );
        });
    });
});
