/**
 * Asking the assistant for a Bible BY ITS SHORT NAME: the words a window
 * leaves for it, and the reading of them in the chat.
 *
 * Asked for with a picture of the Reader on _Bible key "KJV" is not
 * available!_: the card should say the assistant can import it and carry the
 * button that opens the assistant already doing so. The card knows one thing
 * the chat cannot guess -- the name the app is LOOKING for -- and a Bible
 * installed under any other name leaves the card where it was. So the name
 * rides in the request, as a sentence a person could type as well:
 * `Import the Bible called "KJV"`.
 *
 * A leaf with no imports: the card writes the sentence without pulling the
 * chat's import conversation into its window, and that conversation
 * (`src/chatbot/bibleImportChatHelpers.ts`) reads it back. One module, so the
 * two cannot drift; a test holds every name the writer takes to the reader.
 */

// What a name may be made of for the sentence to carry it: no space and no
// quote mark. Whether it can be a Bible's short name at all is the import's
// own question (`genKeyReason`).
const NAME_SOURCE = '[^\\s"“”]{2,24}';
const NAME_PATTERN = new RegExp(`^${NAME_SOURCE}$`, 'u');
// Lazy, so a full stop after the name is the sentence's and not the name's.
const CALLED_PATTERN = new RegExp(
    `\\b(bibles?)\\s+(?:called|named)\\s+["“]?(${NAME_SOURCE}?)["”]?[.!]?$`,
    'iu',
);

/**
 * The sentence that asks for the Bible `bibleKey` names. A name the sentence
 * cannot carry asks for a Bible all the same, and the language is asked first.
 */
export function genBibleImportAsk(bibleKey: string) {
    const name = bibleKey.trim();
    return NAME_PATTERN.test(name)
        ? `Import the Bible called "${name}"`
        : 'Import bible';
}

/**
 * The sentence that asks for a Bible in the language the app is SHOWN in --
 * what a card offering help should say, rather than the key of one missing
 * Bible: the person reads the window in their own language, and an import
 * for that language is the one they can use. The language is named in
 * English because that is how the free collection names its files.
 */
export function genBibleImportLanguageAsk(locale: string) {
    const code = String(locale ?? '')
        .trim()
        .split('-')[0]
        .toLowerCase();
    if (code === '') {
        return 'Import bible';
    }
    let name = code;
    try {
        name =
            new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ??
            code;
    } catch (_error) {
        // A code is still a language the chat knows how to look up.
    }
    return `Import bible for ${name}`;
}

/**
 * The name a sentence asks for a Bible by, and the sentence WITHOUT it -- a
 * Bible called LIST is not a sentence about a list. Null when it names none.
 */
export function readBibleImportAskName(
    text: string,
): { name: string; rest: string } | null {
    const said = text.trim();
    const match = CALLED_PATTERN.exec(said);
    if (match === null) {
        return null;
    }
    return { name: match[2], rest: said.slice(0, match.index) + match[1] };
}
