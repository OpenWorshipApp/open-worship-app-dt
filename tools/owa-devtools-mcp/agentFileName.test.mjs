import { describe, expect, it } from 'vitest';

import { checkAgentFileName } from './agentFileName.mjs';

// The name rules are the containment half of these tools' safety, and they are
// the half a unit test can hold on its own. Both the tool and the app's disk
// boundary use this module to refuse unsafe names before doing any work.
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
        const devices = [
            'CON',
            'con',
            'PRN',
            'aux',
            'NUL',
            ...Array.from({ length: 10 }, (_, digit) => `COM${digit}`),
            ...Array.from({ length: 10 }, (_, digit) => `lpt${digit}`),
            ...['¹', '²', '³'].flatMap((digit) => [
                `COM${digit}`,
                `LPT${digit}`,
            ]),
        ];
        for (const device of devices) {
            for (const suffix of ['', '.old', '.tar.gz']) {
                const name = `${device}${suffix}`;
                expect(checkAgentFileName(name), name).toBe(
                    `"${name}" is a name this computer reserves for itself.`,
                );
            }
        }
        expect(checkAgentFileName('  nul.old  ')).toBe(
            '"nul.old" is a name this computer reserves for itself.',
        );
    });

    it('allows ordinary names sharing a device prefix or extension', () => {
        for (const name of [
            'Console',
            'Console.backup',
            'NUL song',
            'COM10',
            'COM10.old',
            'lpt99.backup',
            'COM¹ song',
            'song.NUL',
            'Grace.old',
        ]) {
            expect(checkAgentFileName(name), name).toBeNull();
        }
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
