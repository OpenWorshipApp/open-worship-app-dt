// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    genPendingQuestionNote,
    waitForPendingAppQuestion,
} from './agentPendingQuestionHelpers';

function mountPopup(
    id: string,
    { title, body }: { title?: string; body?: string } = {},
) {
    const popup = document.createElement('div');
    popup.id = id;
    if (title !== undefined) {
        const header = document.createElement('div');
        header.className = 'app-popup-header-title';
        header.textContent = title;
        popup.appendChild(header);
    }
    if (body !== undefined) {
        const content = document.createElement('div');
        content.className = 'app-popup-body';
        content.textContent = body;
        popup.appendChild(content);
    }
    document.body.appendChild(popup);
    return popup;
}

afterEach(() => {
    // The no-document case stubs `document` away: put it back first.
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    vi.useRealTimers();
});

describe('waitForPendingAppQuestion', () => {
    test('reads a confirm already on screen at once, as flat text', async () => {
        mountPopup('app-confirm-popup', {
            title: '  Text  contrast\n',
            body: 'The background is\n\n white.   Keep it?',
        });
        await expect(waitForPendingAppQuestion(0)).resolves.toEqual({
            title: 'Text contrast',
            text: 'The background is white. Keep it?',
        });
    });

    test.each(['app-alert-popup', 'app-input-popup'])(
        'reads the %s too',
        async (id) => {
            mountPopup(id, { title: 'Asked', body: 'Answer me' });
            await expect(waitForPendingAppQuestion(0)).resolves.toEqual({
                title: 'Asked',
                text: 'Answer me',
            });
        },
    );

    test('a popup with no header or body reads as empty words', async () => {
        mountPopup('app-alert-popup');
        await expect(waitForPendingAppQuestion(0)).resolves.toEqual({
            title: '',
            text: '',
        });
    });

    test('a long question is cut at 200 characters with an ellipsis', async () => {
        // A space right at the cut is trimmed before the ellipsis.
        const body = `${'a'.repeat(199)} ${'b'.repeat(50)}`;
        mountPopup('app-confirm-popup', { title: 'Long', body });
        const question = await waitForPendingAppQuestion(0);
        expect(question?.text).toBe(`${'a'.repeat(199)}…`);
        expect(question?.title).toBe('Long');
    });

    test('a question that lands a beat later is waited for', async () => {
        vi.useFakeTimers();
        let settled: unknown = 'pending';
        const waiting = waitForPendingAppQuestion().then((question) => {
            settled = question;
        });
        await vi.advanceTimersByTimeAsync(120);
        expect(settled).toBe('pending');
        mountPopup('app-confirm-popup', { title: 'Late', body: 'Here now' });
        await vi.advanceTimersByTimeAsync(50);
        await waiting;
        expect(settled).toEqual({ title: 'Late', text: 'Here now' });
    });

    test('no question by the deadline answers null', async () => {
        vi.useFakeTimers();
        let settled: unknown = 'pending';
        const waiting = waitForPendingAppQuestion(200).then((question) => {
            settled = question;
        });
        await vi.advanceTimersByTimeAsync(150);
        expect(settled).toBe('pending');
        await vi.advanceTimersByTimeAsync(100);
        await waiting;
        expect(settled).toBeNull();
    });

    test('with no document (a worker with no DOM) there is no question', async () => {
        vi.stubGlobal('document', undefined);
        await expect(waitForPendingAppQuestion(0)).resolves.toBeNull();
    });
});

describe('genPendingQuestionNote', () => {
    test('names the question and leaves the answer to the operator', () => {
        const note = genPendingQuestionNote({
            title: 'Text contrast',
            text: 'Keep it?',
        });
        expect(note).toContain('"Text contrast -- Keep it?"');
        expect(note).toContain('do not answer it for them');
    });

    test('an empty part is left out of the quoted words', () => {
        expect(genPendingQuestionNote({ title: 'Saved', text: '' })).toContain(
            'question: "Saved". It is',
        );
    });
});
