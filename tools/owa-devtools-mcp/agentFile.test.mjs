import { describe, expect, it } from 'vitest';

import {
    AGENT_FILE_ACTIONS,
    AGENT_FILE_ACTION_TEXT,
    AGENT_FILE_SAFETY_TEXT,
    AGENT_SLIDE_ACTIONS,
    formatAgentFileResult,
    genAgentFileExpression,
} from './agentFile.mjs';

describe('genAgentFileExpression', () => {
    it('carries the request to the app over its own DOM event', () => {
        const expression = genAgentFileExpression({
            kind: 'lyric',
            action: 'create',
            name: 'Amazing Grace',
            content: 'x',
        });
        expect(expression).toContain('owa-agent-file');
        expect(expression).toContain('owa-agent-file-answer');
        expect(expression).toContain('"kind":"lyric"');
        expect(expression).toContain('Amazing Grace');
    });

    // Two calls can be in flight at once (a QA run does not wait), and both
    // answers arrive on the same event. Without a token the first listener
    // takes whichever result lands first.
    it('matches an answer to its own request', () => {
        const expression = genAgentFileExpression({ action: 'list' });
        expect(expression).toContain('detail.token !== request.token');
        expect(expression).toContain('removeEventListener');
    });

    // The relay lives in `domHelpers.ts`, which every app window loads -- but
    // not the chatbot popup. A window that never answers must fail rather than
    // hang, and say which window to ask instead.
    it('fails with somewhere to go when no window answers', () => {
        const expression = genAgentFileExpression({ action: 'list' });
        expect(expression).toContain('did not answer');
        expect(expression).toContain('presenter.html');
    });

    // The request is JSON, never spliced into the source: a name and a song's
    // words are caller-supplied text and this string is evaluated in a page.
    it('cannot be broken out of by a name or by content', () => {
        const expression = genAgentFileExpression({
            action: 'create',
            name: `'); throw new Error("x"); ({('`,
            content: '```ol:Config\n- Title: `+`\n```',
        });
        expect(() => {
            return new Function(`return ${expression}`);
        }).not.toThrow();
    });
});

describe('formatAgentFileResult', () => {
    it('passes a refusal through as the worker wrote it', () => {
        const formatted = formatAgentFileResult({
            isError: true,
            reason: 'A song called "x" is already there.',
        });
        expect(formatted.isError).toBe(true);
        expect(formatted.text).toContain('already there');
    });

    it('hands back a result the model can read', () => {
        const formatted = formatAgentFileResult({
            created: 'Amazing Grace',
            filePath: 'C:/songs/Amazing Grace.owl',
        });
        expect(formatted.isError).toBe(false);
        expect(formatted.text).toContain('Amazing Grace');
    });

    it('says so when the app answered with nothing', () => {
        for (const value of [undefined, null, 'not an object', 42]) {
            expect(formatAgentFileResult(value).isError).toBe(true);
        }
    });
});

describe('the shared wording', () => {
    it('offers exactly the actions the worker implements', () => {
        expect(AGENT_FILE_ACTIONS).toEqual([
            'list',
            'info',
            'create',
            'update',
            'rename',
            'delete',
        ]);
        // A song's slides are made from its words, so only the slide tool
        // offers these.
        expect(AGENT_SLIDE_ACTIONS).toEqual([
            'slides',
            'add-slide',
            'update-slide',
            'delete-slide',
            'move-slide',
            'duplicate-slide',
        ]);
    });

    // The half of the safety sentence the delete added: it went to the trash,
    // and it can be put back.
    it('tells the model a delete can be put back', () => {
        expect(AGENT_FILE_SAFETY_TEXT).toContain('trash');
        expect(AGENT_FILE_SAFETY_TEXT).toContain('owa_undo');
        expect(AGENT_FILE_ACTION_TEXT).toContain('`delete`');
    });

    // The one sentence that keeps a volunteer from discovering their song
    // changed by itself. Both tools' descriptions end on it, and it is the
    // reason `update` is safe to offer at all.
    it('tells the model an update is not saved and must be said', () => {
        expect(AGENT_FILE_SAFETY_TEXT).toContain('UNSAVED');
        expect(AGENT_FILE_SAFETY_TEXT).toContain('Ctrl+Z');
        expect(AGENT_FILE_SAFETY_TEXT).toContain('Ask before');
        expect(AGENT_FILE_ACTION_TEXT).toContain('`update`');
    });
});
