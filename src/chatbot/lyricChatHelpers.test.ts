import { describe, expect, test } from 'vitest';

import type { ChatAttachmentType } from './attachmentHelpers';
import type { AssistantLanguageType } from './chatLangHelpers';
import {
    LYRIC_EDIT_TOOL_NAME,
    LYRIC_SYSTEM_PROMPT,
    LYRIC_UNDO_TOOL_NAME,
    checkIsLyricFileName,
    checkIsLyricTranslateAsk,
    findLyricAskFiles,
    findSongLanguage,
    genLyricOpeningAnswer,
    genLyricTranslateReplies,
    genLyricUndoAction,
    mergeEditedDocument,
    readEditedLyric,
    readLyricTranslateMode,
    resolveLyricEditFile,
    toLyricAsk,
    toLyricFileText,
    toLyricSongText,
    toSongName,
} from './lyricChatHelpers';

// A language as the window knows it: only the names matter here.
function genLanguage(code: string, name: string, nativeName = name) {
    return { code, name, nativeName } as AssistantLanguageType;
}
const ENGLISH = genLanguage('en', 'English');
const SPANISH = genLanguage('es', 'Spanish', 'Native Spanish');
const GERMAN = genLanguage('de', 'German', 'Native German');
const LANGUAGES = [ENGLISH, SPANISH, GERMAN];

function genAttachment(name: string, filePath?: string): ChatAttachmentType {
    return {
        id: name,
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: 10,
        ...(filePath === undefined ? {} : { filePath }),
    } as ChatAttachmentType;
}

describe('which files are songs', () => {
    test('a song is a .owl, named without its folder or extension', () => {
        expect(checkIsLyricFileName('Still.owl')).toBe(true);
        expect(checkIsLyricFileName('Still.OWL ')).toBe(true);
        expect(checkIsLyricFileName('notes.txt')).toBe(false);
        expect(toSongName('C:\\docs\\Still yours.owl')).toBe('Still yours');
        expect(toSongName('/docs/Still.owl')).toBe('Still');
    });

    test('the songs open in a tab are the attached ones with a path, once each', () => {
        expect(
            findLyricAskFiles([
                genAttachment('Still.owl', '/docs/Still.owl'),
                genAttachment('notes.txt', '/docs/notes.txt'),
                genAttachment('Still.owl', '/docs/Still.owl'),
                genAttachment('pasted.owl'),
            ]),
        ).toEqual([{ name: 'Still', filePath: '/docs/Still.owl' }]);
    });

    test('a song file is read as its Open Lyric words, not its JSON', () => {
        expect(
            toLyricFileText(
                JSON.stringify({ metadata: {}, content: '```ol:Config\n```' }),
            ),
        ).toBe('```ol:Config\n```');
        expect(toLyricFileText('not json')).toBeNull();
        expect(toLyricFileText('{"content": 3}')).toBeNull();
    });
});

describe('the song a model names', () => {
    const songs = [
        { name: 'Still', filePath: '/docs/Still.owl' },
        { name: 'Still yours', filePath: '/docs/Still yours.owl' },
    ];

    test('an attached song by its name, with or without .owl, is its path', () => {
        expect(resolveLyricEditFile('still yours', songs)).toEqual({
            filePath: '/docs/Still yours.owl',
        });
        expect(resolveLyricEditFile('Still.owl', songs)).toEqual({
            filePath: '/docs/Still.owl',
        });
    });

    test('no name is the one song attached, and a question when there are two', () => {
        expect(resolveLyricEditFile(undefined, [songs[0]])).toEqual({
            filePath: '/docs/Still.owl',
        });
        expect(
            (resolveLyricEditFile('', songs) as { reason: string }).reason,
        ).toBe('Say which song (`file`): "Still", "Still yours".');
    });

    test('a path written by the model is refused; another name is a Documents song', () => {
        for (const file of ['C:\\Windows\\x.owl', '/etc/x.owl', 'docs/x']) {
            expect(resolveLyricEditFile(file, songs)).toHaveProperty('reason');
        }
        expect(resolveLyricEditFile('Amazing Grace', songs)).toEqual({
            name: 'Amazing Grace',
        });
    });
});

describe('the ask', () => {
    const described = {
        title: 'Still',
        subtitle: 'A song of rest',
        key: 'C',
        tempo: '120bpm',
        locales: null,
        playOrder: ['Verse 1', 'Chorus x2'],
        parts: [
            {
                part: 'Verse 1',
                lines: ['Hide me now', 'Under Your wings'],
                translations: ['first', null],
            },
            {
                part: 'Instrumental 1',
                lines: [],
                holds: 'chords and bars only',
            },
        ],
    };

    test('a song reads as numbered lines, never as notation', () => {
        expect(toLyricSongText(described)).toBe(
            [
                'Title: Still · Subtitle: A song of rest · Key: C · Tempo: 120bpm',
                'Play order: Verse 1 → Chorus x2',
                '',
                '[Verse 1]',
                '1. Hide me now',
                '   translation: first',
                '2. Under Your wings',
                '',
                '[Instrumental 1] (chords and bars only)',
                '(empty)',
            ].join('\n'),
        );
        expect(toLyricSongText(null)).toBeNull();
    });

    test('the question carries each song by the name the tool takes', () => {
        const asked = toLyricAsk('Add a verse', [
            { name: 'Still', text: 'TEXT' },
            { name: 'Gone', text: null },
        ]);
        expect(asked).toContain(
            `(The song "Still" is attached. Change it with ${LYRIC_EDIT_TOOL_NAME}, file "Still". It reads now:\nTEXT)`,
        );
        expect(asked).toContain('call owa_lyric_edit with action "read"');
        expect(asked.startsWith('Add a verse\n\n')).toBe(true);
    });

    test('a pressed choice says which way to translate, so it is never guessed', () => {
        expect(toLyricAsk('x', [], 'replace')).toContain('REPLACE the words');
        expect(toLyricAsk('x', [], 'under')).toContain('KEEP the words');
        expect(toLyricAsk('x', [])).toBe('x');
    });

    test('the prompt asks words of the model and leaves the notation to the app', () => {
        expect(LYRIC_SYSTEM_PROMPT).toContain('Give WORDS only');
        expect(LYRIC_SYSTEM_PROMPT).toContain(
            'OPTIONS: Replace the words | Add it under each line',
        );
        expect(LYRIC_SYSTEM_PROMPT).toContain('never invent the words');
        // The user's word: a translation covers the title and subtitle.
        expect(LYRIC_SYSTEM_PROMPT).toContain(
            'Translate the Title and the Subtitle too',
        );
        expect(toLyricAsk('x', [], 'replace')).toContain(
            '`config` the translated Title',
        );
    });
});

describe('translating: the person chooses', () => {
    test('both ways are buttons, for the language or for another one', () => {
        expect(genLyricTranslateReplies('Spanish')).toEqual([
            'Replace the words with Spanish',
            'Add Spanish under each line',
        ]);
        expect(genLyricTranslateReplies(null)).toEqual([
            'Replace the words with another language',
            'Add another language under each line',
        ]);
    });

    test('a pressed button is read back as its way', () => {
        expect(readLyricTranslateMode('Replace the words with Spanish')).toBe(
            'replace',
        );
        expect(
            readLyricTranslateMode('Add another language under each line'),
        ).toBe('under');
        expect(readLyricTranslateMode('Add a section')).toBeNull();
        expect(checkIsLyricTranslateAsk('please translate it')).toBe(true);
        expect(checkIsLyricTranslateAsk('Add Spanish under each line')).toBe(
            true,
        );
        expect(checkIsLyricTranslateAsk('Change the key')).toBe(false);
    });

    test('the song name says the language it is for; else the app’s, never English', () => {
        expect(findSongLanguage('Still spanish.owl', LANGUAGES)).toBe(SPANISH);
        expect(findSongLanguage('Still native german', LANGUAGES)).toBe(GERMAN);
        expect(findSongLanguage('Still english', LANGUAGES)).toBeNull();
    });

    test('the opening card names the song and offers the changes asked most', () => {
        const english = genLyricOpeningAnswer(
            'Still spanish.owl',
            ENGLISH,
            LANGUAGES,
        );
        expect(english.text).toMatch(/^“Still spanish” is attached below\./);
        expect(english.replies).toEqual([
            'Replace the words with Spanish',
            'Add Spanish under each line',
            'Add a section',
            'Add chords',
            'Change the key',
        ]);
        // In a German window, a song that names no language is offered in
        // the window's own, by its own name.
        expect(
            genLyricOpeningAnswer('Still.owl', GERMAN, LANGUAGES).replies[0],
        ).toBe('Replace the words with Native German');
        expect(
            genLyricOpeningAnswer('Still.owl', ENGLISH, LANGUAGES).replies[0],
        ).toBe('Replace the words with another language');
    });
});

describe('after a change', () => {
    test('a change is read off the result; a refusal or a read is not one', () => {
        expect(
            readEditedLyric(
                JSON.stringify({
                    name: 'Still',
                    isChanged: true,
                    undoId: 'u1',
                }),
            ),
        ).toEqual({ name: 'Still', undoId: 'u1' });
        expect(
            readEditedLyric(
                JSON.stringify({ name: 'Still', isChanged: false }),
            ),
        ).toBeNull();
        expect(readEditedLyric('There is no part called "Bridge".')).toBeNull();
    });

    test('the button puts it back by its own id, and no id means no button', () => {
        expect(genLyricUndoAction({ name: 'Still', undoId: 'u1' })).toEqual({
            label: 'Undo this change',
            toolName: LYRIC_UNDO_TOOL_NAME,
            args: { id: 'u1', name: 'Still' },
        });
        expect(genLyricUndoAction({ name: 'Still', undoId: null })).toBeNull();
    });

    test('puts back every change one answer made to the document', () => {
        const slides = { name: 'Talk', undoId: 'u1' };
        const background = { name: 'Talk', undoId: 'u2' };
        const merged = mergeEditedDocument(
            mergeEditedDocument(null, slides),
            background,
        );
        expect(merged).toEqual({
            name: 'Talk',
            undoId: 'u2',
            undoIdList: ['u1', 'u2'],
        });
        expect(genLyricUndoAction(merged)?.args).toEqual({
            id: 'u2',
            name: 'Talk',
            ids: ['u1', 'u2'],
        });
        expect(
            mergeEditedDocument(merged, { name: 'Talk', undoId: 'u3' })
                .undoIdList,
        ).toEqual(['u1', 'u2', 'u3']);
        // Another document starts over; a change with no id keeps the last.
        expect(
            mergeEditedDocument(merged, { name: 'Other', undoId: 'u9' }),
        ).toEqual({ name: 'Other', undoId: 'u9' });
        expect(
            mergeEditedDocument(slides, { name: 'Talk', undoId: null }),
        ).toEqual({ name: 'Talk', undoId: 'u1' });
    });
});
