/**
 * Asking the assistant to help find a verse somebody half-remembers: the
 * words the Find panel's 🤖 leaves for it, and the reading of them in the
 * chat.
 *
 * Asked for with a picture of the Reader's **Find** panel (2026-10-16): _add
 * robot icon somewhere in `Find`, when I click it open tab in chatbot by ask
 * for bible key (list to choose) then follow up with whatever that user can
 * remember about the verse_. The panel knows one thing the chat cannot guess
 * -- the Bible it is searching -- so that rides in the request, as a sentence
 * a person could type as well: `Help me find a Bible verse in "KJV"`.
 *
 * A leaf with no imports, like `bibleImportAskHelpers.ts`: the panel writes
 * the sentence without pulling the chat's verse-finding conversation into the
 * Reader, and that conversation (`src/chatbot/verseFindChatHelpers.ts`)
 * reads it back. One module, so the two cannot drift; a test holds every key
 * the writer takes to the reader.
 */

// What a Bible's short name may be for the sentence to carry it: no space
// and no quote mark.
const KEY_SOURCE = '[^\\s"“”]{1,24}';
const KEY_PATTERN = new RegExp(`^${KEY_SOURCE}$`, 'u');
// "Help me find a Bible verse", "find a verse I forgot", "Please help me
// find the verse I can't remember in "KJV"" -- the ask and nothing more. A
// verse asked for by what it SAYS ("find me a verse about hope") is the
// guide's Bible Find answer (`bibleContentAskHelpers.ts`) and is left alone.
const ASK_PATTERN = new RegExp(
    '^(?:please\\s+)?(?:can\\s+you\\s+)?(?:help\\s+me\\s+)?find\\s+' +
        '(?:a\\s+|the\\s+|my\\s+)?(?:bible\\s+)?verse' +
        "(?:\\s+(?:that\\s+)?i\\s+(?:forgot|forget|(?:can't|cannot|can\\s+not|don't|do\\s+not)\\s+remember|half[-\\s]remember))?" +
        `(?:\\s+in\\s+["“]?(${KEY_SOURCE}?)["”]?)?` +
        // ...and, after a colon, what they remember, in one line:
        // `Help me find a Bible verse in "KJV": love your enemies`.
        '(?:\\s*[:：]\\s*([\\s\\S]+?))?\\s*[.!?]*$',
    'iu',
);

/** The sentence that asks for help finding a verse in the Bible `bibleKey`. */
export function genVerseFindAsk(bibleKey: string | null) {
    const key = (bibleKey ?? '').trim();
    return KEY_PATTERN.test(key)
        ? `Help me find a Bible verse in "${key}"`
        : 'Help me find a Bible verse';
}

/**
 * Whether the words ask for help finding a verse, the Bible they name and
 * what they remember after a colon (null for either not given). Null when
 * they ask anything else.
 */
export function readVerseFindAsk(
    text: string,
): { bibleKey: string | null; remembered: string | null } | null {
    const match = ASK_PATTERN.exec(text.trim());
    if (match === null) {
        return null;
    }
    const key = match[1] ?? '';
    const remembered = (match[2] ?? '').trim();
    return {
        bibleKey: key.length > 0 ? key : null,
        remembered: remembered.length > 0 ? remembered : null,
    };
}
