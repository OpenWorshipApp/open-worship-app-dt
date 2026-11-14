// @vitest-environment jsdom
//
// The model's own calls, kept (2026-11-12, EC-527). The second song set
// (`lyric-edit-asks-2.json` in owa-enhance-chatbot) was asked in the help
// window on the free model, and each call below is copied as the window
// sent it -- its `file` left out -- with the song it was asked on. Two of
// them were WRONG on the code of their day: a phrase changed "in the
// chorus" also changed every verse (`part` written beside `replacements`),
// and one chord moved took the other twelve of its verse. A later change
// that undoes either fix fails here, with no model asked. Every result is
// checked by this package's validator and by open-lyric's `checkMarkdown`.

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import { applyLyricEdit } from './openLyricEdit.mjs';

document.queryCommandSupported ??= () => {
    return false;
};
document.execCommand ??= () => {
    return false;
};
const { EditorOpenLyricPlugin } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();

// From the repository root (vitest's working folder): under jsdom
// `import.meta.url` is not a file address.
const ASK_SET = JSON.parse(
    fs.readFileSync(
        path.resolve(
            '.claude/skills/owa-enhance-chatbot/references/lyric-edit-asks-2.json',
        ),
        'utf8',
    ),
);
const SONG = ASK_SET.song.join('\n');

function edit(request) {
    const result = applyLyricEdit(SONG, request);
    if (result.isError) {
        throw new Error(result.reason);
    }
    expect(validateOpenLyric(result.content).problems).toEqual([]);
    expect(openLyricApi.document.checkMarkdown(result.content)).toBe(true);
    return result.content;
}

function bodyOf(content, partName) {
    const lines = content.split('\n');
    const start = lines.indexOf(`\`\`\`ol:${partName}`);
    if (start === -1) {
        return null;
    }
    const end = lines.indexOf('```', start + 1);
    return lines.slice(start + 1, end).join('\n');
}

function countChords(text) {
    return (text.match(/\[[^\]\s]+\]/g) ?? []).length;
}

const PART_LIST = ['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4', 'Chorus'];

function expectKept(content, partNames) {
    for (const name of partNames) {
        expect(bodyOf(content, name)).toBe(bodyOf(SONG, name));
    }
}

test('the song is the one the set asks on', () => {
    expect(countChords(SONG)).toBe(31);
    expect(countChords(bodyOf(SONG, 'Chorus'))).toBe(5);
    expect(countChords(bodyOf(SONG, 'Verse 1'))).toBe(13);
});

test('H01 "Rename the chorus to Refrain." -- one call', () => {
    const content = edit({
        action: 'rename-section',
        part: 'Chorus',
        to: 'Refrain',
    });
    expect(bodyOf(content, 'Chorus')).toBeNull();
    expect(bodyOf(content, 'Refrain')).toBe(bodyOf(SONG, 'Chorus'));
    expect(content).toMatch(/^- Structure: V1RV2RV3RV4R$/m);
    expectKept(content, ['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4']);
});

test('H03 "Change every F chord to Fmaj7." -- one call', () => {
    const content = edit({
        action: 'replace',
        replacements: [{ find: '[F]', with: '[Fmaj7]' }],
    });
    expect(content).not.toContain('[F]');
    expect(content.split('[Fmaj7]').length - 1).toBe(
        SONG.split('[F]').length - 1,
    );
    expect(countChords(content)).toBe(31);
});

test('H04 "Take the chords out of the chorus."', () => {
    const content = edit({ action: 'remove-chords', part: 'Chorus' });
    expect(countChords(bodyOf(content, 'Chorus'))).toBe(0);
    expect(bodyOf(content, 'Chorus')).toBe(
        bodyOf(SONG, 'Chorus').replace(/\[[^\]\s]+\]/g, ''),
    );
    expect(countChords(content)).toBe(26);
    expectKept(content, ['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4']);
});

test('H14 "In the chorus, change "with my soul" to "with my heart"." -- the chorus alone', () => {
    const content = edit({
        action: 'replace',
        part: 'Chorus',
        replacements: [{ find: 'with my soul', with: 'with my heart' }],
    });
    expect(bodyOf(content, 'Chorus')).toContain('with my [G]heart');
    expect(bodyOf(content, 'Chorus')).not.toMatch(/with my (\[[^\]]+\])?soul/);
    expect(countChords(content)).toBe(31);
    expectKept(content, ['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4']);
});

test('H15 "In verse 1, move the D7 chord onto the word "billows"." -- the other twelve kept', () => {
    const content = edit({
        action: 'set-chords',
        part: 'Verse 1',
        sections: [
            {
                lines: [
                    'When peace like a river attendeth my way,',
                    'When sorrows like sea [D7]billows roll;',
                    'Whatever my lot, Thou hast taught me to say,',
                    'It is well, it is well with my soul.',
                ],
                part: 'Verse 1',
            },
        ],
    });
    const verse = bodyOf(content, 'Verse 1');
    expect(verse).toContain('sea [D7]billows');
    expect(verse).not.toContain('[D7]sea');
    expect(countChords(verse)).toBe(13);
    expect(verse.replace(/\[[^\]\s]+\]/g, '')).toBe(
        bodyOf(SONG, 'Verse 1').replace(/\[[^\]\s]+\]/g, ''),
    );
    expect(countChords(content)).toBe(31);
    expectKept(content, ['Chorus', 'Verse 2', 'Verse 3', 'Verse 4']);
});

test('H16 "Remove all the chords from the song."', () => {
    const content = edit({ action: 'remove-chords' });
    expect(countChords(content)).toBe(0);
    for (const name of PART_LIST) {
        expect(bodyOf(content, name)).toBe(
            bodyOf(SONG, name).replace(/\[[^\]\s]+\]/g, ''),
        );
    }
});
