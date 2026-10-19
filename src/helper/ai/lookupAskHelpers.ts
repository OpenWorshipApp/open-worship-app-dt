/**
 * Asking the assistant about what a Lookup Detail panel shows: a person or a
 * place from the names lookup, or a Bible passage.
 *
 * Asked for with a picture of three detail panels -- a verse, Adam, the
 * Garden of Eden -- the left of each title bar circled (2026-10-18): _add
 * robot icon, click to open chatbot, make sure mcp tool provide all
 * information to chatbot session then let user interact_, and the story _as
 * a user I want to ask the chatbot about location/name/bible by opening from
 * the detail panel_.
 *
 * The panel hands over WHICH record it shows, never the record: the chat
 * reads it through `owa_lookup_record` (`src/helper/agentLookupHelpers.ts`),
 * in the window the panel is in, where its ~34MB dataset is already held.
 * What crosses is this request -- a few short fields -- and the same check
 * reads it back in the chat and again off a saved conversation.
 *
 * A leaf with no imports, like `verseFindAskHelpers.ts`: the panel writes
 * the request without pulling the chat's conversation into the Reader.
 */

export type LookupAskKindType = 'name' | 'location' | 'verse';

export type LookupAskType = {
    kind: LookupAskKindType;
    // A record id for a name or a place; a short verse (`GEN 2:19-21`) for a
    // passage -- what the panel itself was opened with.
    target: string;
    // The panel's title as it reads, for the chat to name it by before the
    // record has been read.
    title: string;
    // The Bible a passage is read in; the lookup language a record is read in.
    bibleKey?: string;
    langCode?: string;
    // The address of the window the panel is in.
    page?: string;
};

const KIND_LIST: LookupAskKindType[] = ['name', 'location', 'verse'];
// A Bible's short name, as everywhere a tool takes one: no space, no quote.
const BIBLE_KEY_PATTERN = /^[^\s"“”]{1,24}$/u;
const LANG_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;
// A record id is a slug, a short verse a book code and numbers: nothing
// either carries runs past a line.
const TARGET_PATTERN = /^[^\n\r]{1,200}$/u;
const MAX_TITLE_CHARS = 200;
const MAX_PAGE_CHARS = 600;

/**
 * The request as it may be trusted, or null: every field checked and
 * copied by name, so a hand-edited setting or a saved conversation cannot
 * carry anything else along.
 */
export function toValidLookupAsk(raw: any): LookupAskType | null {
    if (
        !KIND_LIST.includes(raw?.kind) ||
        typeof raw.target !== 'string' ||
        !TARGET_PATTERN.test(raw.target.trim())
    ) {
        return null;
    }
    const title =
        typeof raw.title === 'string'
            ? raw.title.replaceAll(/\s+/g, ' ').trim()
            : '';
    return {
        kind: raw.kind,
        target: raw.target.trim(),
        title: (title.length > 0 ? title : raw.target.trim()).slice(
            0,
            MAX_TITLE_CHARS,
        ),
        ...(typeof raw.bibleKey === 'string' &&
        BIBLE_KEY_PATTERN.test(raw.bibleKey)
            ? { bibleKey: raw.bibleKey }
            : {}),
        ...(typeof raw.langCode === 'string' &&
        LANG_CODE_PATTERN.test(raw.langCode)
            ? { langCode: raw.langCode }
            : {}),
        ...(typeof raw.page === 'string' &&
        raw.page.length > 0 &&
        raw.page.length <= MAX_PAGE_CHARS &&
        !/\s/.test(raw.page)
            ? { page: raw.page }
            : {}),
    };
}

/**
 * A verse's own key as a Bible view stamps it on the verse
 * (`data-verse-key`): `(KJV) GEN 4:1` -> `{ bibleKey: 'KJV', verseKey: 'GEN
 * 4:1' }`. Null for anything else.
 */
export function readBibleVersesKey(text: string) {
    const match = /^\(([^\s"“”()]{1,24})\) ([^\n\r]{1,200})$/u.exec(
        String(text ?? '').trim(),
    );
    return match === null ? null : { bibleKey: match[1], verseKey: match[2] };
}

/**
 * The arguments `owa_lookup_record` reads the request's record with: a
 * passage by its reference in its Bible, a name or place by its id in its
 * language, in the window it was opened in.
 */
export function toLookupToolArgs(ask: LookupAskType) {
    return ask.kind === 'verse'
        ? {
              kind: ask.kind,
              ref: ask.target,
              ...(ask.bibleKey === undefined ? {} : { bible: ask.bibleKey }),
              ...(ask.page === undefined ? {} : { page: ask.page }),
          }
        : {
              kind: ask.kind,
              id: ask.target,
              ...(ask.langCode === undefined ? {} : { lang: ask.langCode }),
              // The Bible a record's verses are quoted in, once one was picked.
              ...(ask.bibleKey === undefined ? {} : { bible: ask.bibleKey }),
              ...(ask.page === undefined ? {} : { page: ask.page }),
          };
}
