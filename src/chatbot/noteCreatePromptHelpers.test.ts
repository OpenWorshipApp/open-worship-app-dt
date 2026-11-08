import { describe, expect, test } from 'vitest';

import { NOTE_CREATE_PROMPT } from './noteCreatePromptHelpers';
import { BIBLE_READER_SYSTEM_PROMPT } from './bibleReaderChatHelpers';
import { RESOURCES_SYSTEM_PROMPT } from './resourcesChatHelpers';

// 2026-11-08, the user's goal: _chatbot can put a lesson to a new bible note
// for user_. Every conversation that teaches is told to MAKE the note --
// a Reader chat had handed over words to copy and paste.
describe('the conversations that teach make a note when asked', () => {
    test('one sentence, the tool and its action, never words to copy', () => {
        expect(NOTE_CREATE_PROMPT).toContain('owa_bible_note action "add"');
        expect(NOTE_CREATE_PROMPT).toContain('a lesson given whole');
        expect(NOTE_CREATE_PROMPT).toContain('never hand them words to copy');
        // Seen live: told only that it could, the model asked what to write.
        expect(NOTE_CREATE_PROMPT).toContain('Never ask what to write');
    });

    test('the Bible Reader and the Resources prompts carry it', () => {
        expect(BIBLE_READER_SYSTEM_PROMPT).toContain(NOTE_CREATE_PROMPT);
        expect(RESOURCES_SYSTEM_PROMPT).toContain(NOTE_CREATE_PROMPT);
    });
});
