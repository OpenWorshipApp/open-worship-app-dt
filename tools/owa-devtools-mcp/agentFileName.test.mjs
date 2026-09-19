import { describe, expect, it } from 'vitest';

import { checkAgentFileName } from './agentFileName.mjs';

// The name rules are the containment half of these tools' safety, and they are
// the half a unit test can hold on its own: `createNewFileDetail` still
// carries a `// TODO: verify file name before create`, so nothing downstream
// stops a separator from putting a file wherever it points.
describe('checkAgentFileName', () => {
    it('takes an ordinary song name', () => {
        for (const name of [
            'Amazing Grace',
            'Blessed Assurance (2)',
            'song 159 old - offering',
            'ទ្រង់មានចេស្តា',
            '10,000 Reasons',
        ]) {
            expect(checkAgentFileName(name), name).toBeNull();
        }
    });

    // The one that matters most on this app's main platform.
    it('refuses anything that could leave the folder', () => {
        for (const name of [
            '../evil',
            '../../evil',
            'sub/folder',
            'sub\\folder',
            'C:evil',
        ]) {
            expect(checkAgentFileName(name), name).not.toBeNull();
        }
    });

    it('refuses the characters this platform will not take', () => {
        for (const name of ['a<b', 'a>b', 'a"b', 'a|b', 'a?b', 'a*b']) {
            expect(checkAgentFileName(name), name).not.toBeNull();
        }
    });

    it('refuses a dot name, and a trailing dot', () => {
        for (const name of ['.', '..', '.hidden', 'trailing.']) {
            expect(checkAgentFileName(name), name).not.toBeNull();
        }
    });

    // Reserved whatever the extension: the file cannot be created or opened,
    // so refusing early is a better answer than the failure that follows.
    it('refuses a name this platform reserves', () => {
        for (const name of ['CON', 'con', 'PRN', 'aux', 'COM1', 'lpt9']) {
            expect(checkAgentFileName(name), name).not.toBeNull();
        }
        expect(checkAgentFileName('Console')).toBeNull();
    });

    it('refuses a control character, which would not be visible', () => {
        expect(
            checkAgentFileName(`song${String.fromCharCode(0)}name`),
        ).not.toBeNull();
        expect(
            checkAgentFileName(`song${String.fromCharCode(10)}name`),
        ).not.toBeNull();
    });

    it('refuses nothing, and refuses too much', () => {
        for (const name of [undefined, null, '', '   ', 42, {}]) {
            expect(checkAgentFileName(name)).not.toBeNull();
        }
        expect(checkAgentFileName('a'.repeat(200))).not.toBeNull();
    });

    // Every refusal is a sentence the model can act on, which is what makes a
    // block correct behaviour rather than a dead end it apologises for.
    it('always says why', () => {
        const reason = checkAgentFileName('../evil');
        expect(typeof reason).toBe('string');
        expect(reason.length).toBeGreaterThan(20);
    });
});
