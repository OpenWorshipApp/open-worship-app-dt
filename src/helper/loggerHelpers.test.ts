import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { sendDataMock, providerMock } = vi.hoisted(() => ({
    sendDataMock: vi.fn(),
    providerMock: {
        isPagePresenter: false,
        isPageAppDocumentEditor: false,
        isPageReader: false,
        isPageExperiment: false,
        currentHomePage: 'dashboard',
        messageUtils: {
            sendData: vi.fn(),
        },
    },
}));

providerMock.messageUtils.sendData = sendDataMock;

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

import { appError, appLog, appTrace, appWarning } from './loggerHelpers';

describe('loggerHelpers', () => {
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        trace: console.trace,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        providerMock.isPagePresenter = false;
        providerMock.isPageAppDocumentEditor = false;
        providerMock.isPageReader = false;
        providerMock.isPageExperiment = false;
        console.log = vi.fn();
        console.error = vi.fn();
        console.warn = vi.fn();
        console.trace = vi.fn();
    });

    test('logs appLog messages to the console and event channel', () => {
        appLog('hello', 1);

        expect(console.log).toHaveBeenCalledWith('hello', 1);
        expect(sendDataMock).toHaveBeenCalledWith('all:app:log', [
            ':dashboard:',
            'hello',
            1,
        ]);
    });

    test('logs warnings without forwarding them to the message channel', () => {
        appWarning('careful');

        expect(console.warn).toHaveBeenCalledWith('careful');
        expect(sendDataMock).not.toHaveBeenCalled();
    });

    test('still logs errors on presenter pages without mirroring them remotely', () => {
        providerMock.isPagePresenter = true;

        appError('boom');

        expect(console.error).toHaveBeenCalledWith('boom');
        expect(sendDataMock).not.toHaveBeenCalled();
    });

    test('traces are mirrored when the current page allows it', () => {
        appTrace('trace', { ok: true });

        expect(console.trace).toHaveBeenCalledWith('trace', { ok: true });
        expect(sendDataMock).toHaveBeenCalledWith('all:app:log', [
            ':dashboard:',
            'trace',
            { ok: true },
        ]);
    });

    afterEach(() => {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.trace = originalConsole.trace;
    });
});
