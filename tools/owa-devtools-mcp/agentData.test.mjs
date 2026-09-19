import { describe, expect, it } from 'vitest';

import {
    AGENT_BIBLE_ITEM_ACTIONS,
    AGENT_NOTE_ACTIONS,
    AGENT_REMOVING_ACTIONS,
    AGENT_UNDO_ACTIONS,
    AGENT_UNDO_TEXT,
    formatAgentDataResult,
    genAgentDataExpression,
} from './agentData.mjs';
import { AGENT_FILE_ACTIONS, AGENT_SLIDE_ACTIONS } from './agentFile.mjs';

describe('genAgentDataExpression', () => {
    it('carries the request and its domain over the data event', () => {
        const expression = genAgentDataExpression('note', {
            action: 'add',
            title: 'Sermon ideas',
        });
        expect(expression).toContain('owa-agent-data');
        expect(expression).toContain('owa-agent-data-answer');
        expect(expression).toContain('"domain":"note"');
        expect(expression).toContain('Sermon ideas');
    });

    // The tool decides which worker it talks to, never the arguments: an
    // `owa_bible_note` call carrying `domain: "undo"` is still a note call.
    it('does not let a request choose another worker', () => {
        const expression = genAgentDataExpression('note', {
            domain: 'undo',
            action: 'list',
        });
        expect(expression).toContain('"domain":"note"');
        expect(expression).not.toContain('"domain":"undo"');
    });

    it('matches an answer to its own request', () => {
        const expression = genAgentDataExpression('undo', { action: 'list' });
        expect(expression).toContain('detail.token !== request.token');
        expect(expression).toContain('removeEventListener');
    });

    it('fails with somewhere to go when no window answers', () => {
        const expression = genAgentDataExpression('undo', { action: 'list' });
        expect(expression).toContain('did not answer');
        expect(expression).toContain('presenter.html');
    });

    // A title and a note's words are caller-supplied text, and this string is
    // evaluated in a page.
    it('cannot be broken out of by what a caller writes', () => {
        const expression = genAgentDataExpression('note', {
            action: 'add',
            title: `'); throw new Error("x"); ({('`,
            text: '`${document.cookie}`</script>',
        });
        expect(() => {
            return new Function(`return ${expression}`);
        }).not.toThrow();
    });
});

describe('formatAgentDataResult', () => {
    it('passes a refusal through as the worker wrote it', () => {
        const formatted = formatAgentDataResult({
            isError: true,
            reason: 'There is no note with the id 7.',
        });
        expect(formatted).toEqual({
            isError: true,
            text: 'There is no note with the id 7.',
        });
    });

    it('says so when the app answered with nothing', () => {
        for (const value of [undefined, null, 'x', 42]) {
            expect(formatAgentDataResult(value).isError).toBe(true);
        }
    });
});

describe('the removal vocabulary', () => {
    const everyActionSet = new Set([
        ...AGENT_FILE_ACTIONS,
        ...AGENT_SLIDE_ACTIONS,
        ...AGENT_BIBLE_ITEM_ACTIONS,
        ...AGENT_NOTE_ACTIONS,
        ...AGENT_UNDO_ACTIONS,
    ]);

    // The firewall's removal budget reads this list. An action that deletes
    // and is missing from it is a removal nobody counts.
    it('names every action that takes something away', () => {
        for (const action of everyActionSet) {
            if (/^delete/.test(action) || action === 'undo') {
                expect(AGENT_REMOVING_ACTIONS, action).toContain(action);
            }
        }
        for (const action of AGENT_REMOVING_ACTIONS) {
            expect(everyActionSet.has(action), action).toBe(true);
        }
        expect(AGENT_REMOVING_ACTIONS).not.toContain('list');
    });

    it('tells the model a change can be put back, and to say so', () => {
        expect(AGENT_UNDO_TEXT).toContain('trash');
        expect(AGENT_UNDO_TEXT).toContain('owa_undo');
        expect(AGENT_UNDO_TEXT).toContain('can be undone');
    });
});
