// The song the assistant just drafted, and the two things a user can do with
// it.
//
// `owa_lyric_validate` with `mode: "draft"` turns whatever the user has -- a
// paste, a page that was read, a file they dropped on this window -- into Open
// Lyric notation. This holds the result between the answer arriving and a
// button being pressed, and it is deliberately the SAME shape the prepared
// reports use (`reportHelpers.ts`): the message keeps a short reference, the
// document itself lives in memory and dies with the window.
//
// That is not tidiness. `chatbot-sessions` is read whole and synchronously at
// startup, so a session file with a song in every third message is a slower
// launch on exactly the machines this app is built for -- and the notation is
// the one part of the exchange the user is never shown.

/** The pseudo tool names the two buttons carry. Never sent to a model. */
export const LYRIC_CREATE_TOOL_NAME = 'owa-lyric-create';
export const LYRIC_COPY_TOOL_NAME = 'owa-lyric-copy';
/**
 * The one press under SEVERAL drafted songs that saves every one of them
 * (2026-11-13, EC-589, the user: _Create a lyric file from <link>_ worked
 * for one link, _I wish it could create multiple … also multiple files_).
 * Its `references` are the drafts' own, in the order they were written.
 */
export const LYRIC_CREATE_ALL_TOOL_NAME = 'owa-lyric-create-all';

/**
 * How many songs one ask drafts. The links of a message, the files of a
 * question (`MAX_ATTACHMENT_COUNT` is four too) or the drafts of a model's
 * answer past it are left for another message, said so -- each link is a
 * page read through the firewall's ten-reads budget, and each draft is a
 * song held in memory and a button under the answer (four Creates and the
 * one that saves them all).
 */
export const MAX_SONGS_PER_ASK = 4;

export type DraftedLyricType = {
    reference: string;
    /** The Open Lyric document, exactly as the tool wrote it. */
    content: string;
    /** What to call the file, taken from the song's own Title. */
    name: string;
    /**
     * The face the song is drawn in on every stage, when it came from a
     * document set in one (a PowerPoint's slides): written into the new
     * song's own stage setting on Create. Null for any other draft.
     */
    fontFamily: string | null;
};

/**
 * The `- Title: ...` the drafter wrote, as a file name.
 *
 * Read back off the document rather than carried beside it, because the
 * document is the only thing that crossed the tool boundary -- and a name that
 * disagrees with the song it names is the kind of thing nobody notices until
 * they are looking for the file.
 */
export function toDraftedLyricName(content: string) {
    const title = /^- Title:[ \t]*(.+)$/m.exec(content)?.[1]?.trim() ?? '';
    // Refused rather than cleaned at the disk boundary, so anything that could
    // read as a path goes now. `agentFileName.mjs` is the authority; this only
    // has to stop an obvious title from being turned away.
    const cleaned = title
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .slice(0, 80);
    return cleaned === '' ? 'New Song' : cleaned;
}

/**
 * The first words of the drafter's refusal when a site answered a bot check
 * instead of its page (`BROWSER_CHECK_TEXT` in `openLyricDraft.mjs`). A
 * prefix rather than an import: the drafter is the one heavy module in that
 * package, and the renderer has no use for it beyond this sentence.
 * `lyricDraftHelpers.test.ts` holds the two together.
 */
export const BROWSER_CHECK_REFUSAL_PREFIX =
    'That address answered with a browser check';

export function checkIsBrowserCheckRefusal(text: string) {
    return String(text ?? '').startsWith(BROWSER_CHECK_REFUSAL_PREFIX);
}

/**
 * Is this the tool result of a draft that came out valid?
 *
 * The document is fenced in the result by a line the drafter writes, so it can
 * be lifted without asking the model to repeat it -- which it would sometimes
 * get wrong, and which would cost the whole song in tokens a second time.
 */
export function readDraftedLyric(text: string) {
    if (!text.startsWith('Drafted a song')) {
        return null;
    }
    if (!text.includes('Valid Open Lyric. No problems found.')) {
        // A draft that did not validate is not offered as a file. The model
        // still has the report and can say what went wrong.
        return null;
    }
    const at = text.indexOf('```ol:Config');
    if (at === -1) {
        return null;
    }
    const content = text
        .slice(at)
        .replace(/\n\[\.\.\..*$/s, '')
        .trimEnd();
    return content.length === 0 ? null : content;
}

// In memory only and bounded, for the reasons in the header above: two
// answers' worth of songs, a few kilobytes each.
const draftedLyricMap = new Map<string, DraftedLyricType>();
const MAX_DRAFTED_LYRICS = MAX_SONGS_PER_ASK * 2;
let draftCount = 0;

export function keepDraftedLyric(
    content: string,
    fontFamily: string | null = null,
): DraftedLyricType {
    draftCount += 1;
    const drafted = {
        reference: `lyric-${Date.now().toString(36)}-${draftCount}`,
        content,
        name: toDraftedLyricName(content),
        fontFamily,
    };
    draftedLyricMap.set(drafted.reference, drafted);
    while (draftedLyricMap.size > MAX_DRAFTED_LYRICS) {
        const oldest = draftedLyricMap.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        draftedLyricMap.delete(oldest);
    }
    return drafted;
}

export function takeDraftedLyric(reference: string) {
    return draftedLyricMap.get(reference) ?? null;
}

type DraftActionType = {
    label: string;
    toolName: string;
    args: { reference: string } | { references: string[] };
};

/**
 * The buttons under drafted songs. One song: **Create "…"** and **Copy song
 * text**, as ever. Several: **Create all N songs** first, then each song's
 * own **Create "…"** -- no Copy each, which would be nine buttons under four
 * songs; each song's words are in its preview box above them to select.
 * Labels in English: `DRAFT_ACTION_PATTERN` reads them, and the window
 * translates them where they are drawn.
 */
export function genLyricDraftActions(
    draftedList: readonly DraftedLyricType[],
): DraftActionType[] {
    const createList = draftedList.map((drafted) => {
        return {
            label: `Create "${drafted.name}"`,
            toolName: LYRIC_CREATE_TOOL_NAME,
            args: { reference: drafted.reference },
        };
    });
    if (draftedList.length === 1) {
        return [
            ...createList,
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference: draftedList[0].reference },
            },
        ];
    }
    if (draftedList.length === 0) {
        return [];
    }
    return [
        {
            label: `Create all ${draftedList.length.toString()} songs`,
            toolName: LYRIC_CREATE_ALL_TOOL_NAME,
            args: {
                references: draftedList.map((drafted) => {
                    return drafted.reference;
                }),
            },
        },
        ...createList,
    ];
}

/**
 * The songs a **Create all** press names that this window still holds, in
 * order; the references it no longer holds are counted apart, so the answer
 * can say a reopened window lost them rather than saving fewer in silence.
 */
export function takeDraftedLyricList(references: unknown) {
    const list = Array.isArray(references) ? references : [];
    const heldList: DraftedLyricType[] = [];
    let goneCount = 0;
    for (const reference of list) {
        const drafted =
            typeof reference === 'string' ? takeDraftedLyric(reference) : null;
        if (drafted === null) {
            goneCount += 1;
        } else {
            heldList.push(drafted);
        }
    }
    return { heldList, goneCount };
}

/**
 * The songs a model drafted in one ask, each under the SOURCE it came from:
 * its page's address, else the title it came out with. A source drafted
 * again replaces its draft -- a model that drafts the same page twice has
 * been told the first area was wrong (`from` / `to`), and a song drafted
 * again under the same title is a correction -- and a new source is added
 * after the others, up to `MAX_SONGS_PER_ASK`. Until 2026-11-13 the watch
 * kept ONE draft, the last, so three links drafted in one answer offered
 * the third song's Create alone (EC-589).
 */
export type DraftedSourceType = { key: string; content: string };

export function toDraftedSourceKey(content: string, url: unknown) {
    const address = typeof url === 'string' ? url.trim() : '';
    return address === ''
        ? `title:${toDraftedLyricName(content).toLowerCase()}`
        : `url:${address}`;
}

export function withDraftedSource(
    list: readonly DraftedSourceType[],
    drafted: DraftedSourceType,
): DraftedSourceType[] {
    const at = list.findIndex((one) => {
        return one.key === drafted.key;
    });
    if (at >= 0) {
        return list.map((one, index) => {
            return index === at ? drafted : one;
        });
    }
    return list.length >= MAX_SONGS_PER_ASK ? [...list] : [...list, drafted];
}

/**
 * What a window that has been reopened since has to say instead. One literal,
 * so `tran(DRAFT_GONE_TEXT)` where it is written is a key the coverage test
 * can read.
 */
export const DRAFT_GONE_TEXT =
    'That song is not held any more — this window has been reopened since. Send me the words again and I will write it out afresh.';

// ---------------------------------------------------------------------------
// Reading a paste with no model in the loop
// ---------------------------------------------------------------------------

const SECTION_LABEL_PATTERN =
    /^(?:verse|chorus|bridge|pre-?chorus|intro|outro|ending|tag|refrain|interlude)\b/i;
const MAX_SUNG_LINE_LENGTH = 90;
const MIN_LYRIC_LINE_COUNT = 4;

/**
 * Does this look like the words of a song rather than a question?
 *
 * Measured 2026-09-08 on Kimi's free tier: the paste that the "Can you make a
 * song from words I paste in?" chip invites arrived a minute after the chip's
 * own two rounds, hit the per-minute limit, and fell to the offline bot -- which
 * searched the manual for sixteen lines of Amazing Grace and answered "I could
 * not find that in the app guide", with "How do I change where my documents
 * are stored?" underneath as the thing to ask next. The drafter needs no model,
 * no key and no network, so the offline bot can do the one thing the paste was
 * for.
 *
 * Deliberately a shape test and not a vocabulary one: several short lines, none
 * of them a question, is what sung words look like in every language this app
 * is used in. A Bible passage pasted from a website is long lines and does not
 * pass; a bare question never has four lines. Only ever consulted where the
 * alternative is a manual search for the words, so a paste that merely looks
 * like a song costs a draft OFFERED under a button, never a file written.
 */
export function checkIsLyricPaste(text: string) {
    const trimmed = String(text ?? '').trim();
    if (trimmed.startsWith('/') || trimmed.endsWith('?')) {
        return false;
    }
    if (trimmed.includes('```')) {
        // Already notation, or code: the drafter refuses both and says why.
        return false;
    }
    const lines = trimmed
        .split(/\r?\n/)
        .map((line) => {
            return line.trim();
        })
        .filter((line) => {
            return line.length > 0;
        });
    if (lines.length < MIN_LYRIC_LINE_COUNT) {
        return false;
    }
    const sung = lines.filter((line) => {
        return (
            line.length <= MAX_SUNG_LINE_LENGTH &&
            !line.endsWith('?') &&
            !/^https?:\/\//i.test(line)
        );
    });
    const hasLabel = lines.some((line) => {
        return SECTION_LABEL_PATTERN.test(line) || /^\d{1,2}[.)]?\s/.test(line);
    });
    // Four short lines with a section label over them is a song by anyone's
    // reading; without one, nearly every line has to be short.
    return hasLabel
        ? sung.length >= MIN_LYRIC_LINE_COUNT
        : sung.length >= Math.max(MIN_LYRIC_LINE_COUNT, lines.length * 0.85);
}

// ---------------------------------------------------------------------------
// A song page, named by its address
// ---------------------------------------------------------------------------

// https only: the app's own address policy refuses everything else, so an
// `http://` link would only ever be read back as a refusal.
const HTTPS_ADDRESS_PATTERN = /https:\/\/[^\s<>"'`)\]]+/g;
// The words that make a link a SONG link. "Read this page for me" with an
// address is a question about the world outside the app, which the offline
// bot cannot answer and must not pretend to by drafting a menu as a hymn.
const SONG_WORD_PATTERN =
    /\b(?:songs?|lyrics?|hymns?|chords?|chord\s+sheets?|worship)\b/i;
// Past this many words around the address it is a message with a link IN
// it, not an ask about the link.
const MAX_SONG_LINK_ASK_WORDS = 40;

/**
 * Every https address in a piece of text, in the order written, each once,
 * with the punctuation a sentence hangs on its end taken off. A list of
 * links is pages to read one after another (EC-589); the drafter reads one
 * page a call.
 */
export function readSongAddressList(text: string): string[] {
    const addresses = String(text ?? '').match(HTTPS_ADDRESS_PATTERN) ?? [];
    const addressList: string[] = [];
    for (const one of addresses) {
        const address = one.replace(/[.,;:!?]+$/, '');
        if (
            address.length > 'https://'.length &&
            !addressList.includes(address)
        ) {
            addressList.push(address);
        }
    }
    return addressList;
}

/** How many words a piece of text says beside its https addresses. */
export function countWordsBesideAddresses(text: string) {
    return String(text ?? '')
        .replace(HTTPS_ADDRESS_PATTERN, ' ')
        .split(/\s+/)
        .filter((word) => {
            return word.length > 0;
        }).length;
}

/**
 * The one https address in a piece of text -- or null when there is none, or
 * more than one.
 */
export function readSongAddress(text: string): string | null {
    const addressList = readSongAddressList(text);
    return addressList.length === 1 ? addressList[0] : null;
}

/**
 * The addresses of song pages in an ask, in order, or null.
 *
 * "Create a lyric file from https://…" is the app's own starter chip, and
 * measured 2026-10-09 with the assistant paused (no key, no credit or a 429
 * all land here) the offline bot searched the manual for the ADDRESS and
 * answered with how to make an empty file. The drafter reads the page
 * itself (`owa_lyric_validate` with `url`), so the one thing the link was for
 * needs no model at all -- and a song is only ever OFFERED under a button,
 * never written, so a page that merely mentions a hymn costs nothing.
 *
 * A song word beside one https address or more, in a short message -- the
 * words counted with the addresses taken out, so a list of five links is as
 * short as a list of one. A bare address is not enough: on its own it is as
 * likely a YouTube link or a Bible XML file, and reading a page is rationed
 * and announced in the app window.
 *
 * Several links are several songs (2026-11-13, EC-589, the user: _it work
 * for only one url, I wish it could create multiple_): two addresses had
 * been read as no song link at all, and the guide searched the manual for
 * them.
 */
export function readSongLinkAsk(text: string): string[] | null {
    const trimmed = String(text ?? '').trim();
    if (trimmed.startsWith('/') || trimmed.includes('```')) {
        return null;
    }
    const addressList = readSongAddressList(trimmed);
    if (addressList.length === 0) {
        return null;
    }
    if (!SONG_WORD_PATTERN.test(trimmed.replace(HTTPS_ADDRESS_PATTERN, ' '))) {
        return null;
    }
    return countWordsBesideAddresses(trimmed) > MAX_SONG_LINK_ASK_WORDS
        ? null
        : addressList;
}

// The files a song can be drafted from with no model beside plain words:
// a plain text file, or a PowerPoint deck's or a Word file's words, which
// the window reads out when they are attached (`documentWordsHelpers.ts`).
// Documents attached alone -- a slide document, a deck, a Word file, a PDF
// -- are read the way the app reads their kind (`toSongDocumentFiles`);
// these are for words files beside them. A song (`.owl`) is its own
// conversation's.
const SONG_SOURCE_FILE_PATTERN = /\.(txt|text|md|markdown|pptx|docx)$/i;

export function checkIsSongSourceFileName(name: string) {
    return SONG_SOURCE_FILE_PATTERN.test(String(name ?? ''));
}

const MAX_SONG_FILE_ASK_WORDS = 16;

/**
 * Is this the words a person types over ATTACHED files to have them made
 * into songs -- _Create lyric files from these_, _make songs from the
 * attached files_ -- (EC-589)? A song word and a making verb in one short
 * line that names no title and no address; the files are the caller's to
 * check. A question, a command or a paste is somebody else's.
 */
export function checkIsSongFileAsk(text: string) {
    const trimmed = String(text ?? '').trim();
    if (
        trimmed === '' ||
        trimmed.startsWith('/') ||
        trimmed.endsWith('?') ||
        trimmed.includes('```') ||
        trimmed.includes('\n') ||
        /https?:\/\//i.test(trimmed)
    ) {
        return false;
    }
    return (
        trimmed.split(/\s+/).length <= MAX_SONG_FILE_ASK_WORDS &&
        SONG_WORD_PATTERN.test(trimmed) &&
        (SONG_MAKE_VERB_PATTERN.test(trimmed) ||
            SONG_TURN_VERB_PATTERN.test(trimmed)) &&
        // A song NAMED is a song to find, not the files beside it -- a
        // quoted title, or one _called_ so. Not `readSongTitleAsk`, which
        // reads "the attached files" after "from" as a title.
        !QUOTED_TITLE_PATTERN.test(trimmed) &&
        readSongTitleNamed(trimmed) === null
    );
}

export type DraftReportType = {
    /** `Song: "Title" by Artist — key C, 120bpm, 4/4`, each part only when set */
    song: string | null;
    /** `Sections (3): Verse 1 (4 lines), …` */
    sections: string | null;
    /** `Play order: Verse 1 → Chorus` */
    playOrder: string | null;
    /** What the drafter had to guess, one per line, without the dash. */
    guessed: string[];
};

/**
 * The parts of a draft report a person is told, read off the tool's own text.
 *
 * Read rather than re-derived so the offline answer describes the song in the
 * same words the drafter used for the model -- two descriptions of one song
 * that disagree is how a volunteer stops trusting either.
 */
export function readDraftReport(text: string): DraftReportType {
    const head = String(text ?? '').split('```ol:Config')[0] ?? '';
    const lines = head.split(/\r?\n/).map((line) => {
        return line.trim();
    });
    const findLine = (prefix: string) => {
        return (
            lines.find((line) => {
                return line.startsWith(prefix);
            }) ?? null
        );
    };
    const guessedAt = lines.findIndex((line) => {
        return line.startsWith('Guessed, and worth telling them:');
    });
    const guessed: string[] = [];
    if (guessedAt !== -1) {
        for (const line of lines.slice(guessedAt + 1)) {
            if (!line.startsWith('- ')) {
                break;
            }
            guessed.push(line.slice(2).trim());
        }
    }
    return {
        song: findLine('Song: '),
        sections: findLine('Sections ('),
        playOrder: findLine('Play order: '),
        guessed,
    };
}

// ---------------------------------------------------------------------------
// A song, named by its title
// ---------------------------------------------------------------------------

// What a person does to a song when they want one made: "Create a lyric file
// from 'Amazing Grace'", "make a song for Amazing Grace", "add the hymn …".
const SONG_MAKE_VERB_PATTERN =
    /\b(?:create|make|add|write|draft|import|get|find|look\s*up|need)\b/i;
// What a person does to an attached FILE to have its song: _turn this into a
// lyric_, _convert it to a song_ (2026-11-13, `EC-590`). Read by the file
// ask only -- "turn" before a title is no title.
const SONG_TURN_VERB_PATTERN =
    /\b(?:turn|convert|change|transform|extract|generate|build)\b/i;
// Straight, curly and guillemet quotes around the title.
const QUOTED_TITLE_PATTERN = /["“”«»]([^"“”«»\n]{2,80})["“”«»]/;
// A title said after the word that introduces it, to the end of the line.
const TRAILING_TITLE_PATTERN =
    /\b(?:songs?|lyrics?|hymns?|lyric\s+files?|song\s+files?)\s+(?:files?\s+)?(?:from|for|of|called|named|titled)\s+(?:the\s+)?(?:(?:song|hymn)\s+(?:called\s+|named\s+|titled\s+)?)?(.{2,80})$/i;
// Words that make the "title" an ask about something else: the starter chip
// "Can you make a song from words I paste in?", a song from "a file".
// Read from the START of the title only, so "It Is Well with My Soul" is
// still a title while "it" alone is not.
const NOT_A_TITLE_PATTERN =
    // A document is no title either: "a song from my PowerPoint" is a song
    // made out of a file (`lyricDocumentChatHelpers.ts`), not a hymn called
    // "my PowerPoint".
    /^(?:(?:a|an|the|my|our|your|this|these|that|those|some)\s+)*(?:(?:words?|text|lyrics?|paste[ds]?|pasting|clipboard|files?|links?|pages?|sites?|websites?|address|url|scratch|attachments?|power\s*points?|pptx?|presentations?|slides?|docx?|word\s+(?:files?|documents?)|pdfs?|documents?)\b|(?:this|these|that|those|it|them|below|above)$)/i;
const MAX_SONG_TITLE_ASK_WORDS = 16;

/**
 * The title in "Create a lyric file from 'Amazing Grace'", or null.
 *
 * The app's own starter is *Create a lyric file for song "Amazing Grace"*.
 * Reported 2026-10-03 with a picture of exactly that ask typed into the box
 * under the app's own *Create a lyric file from https://…* chip. A title is
 * asked of the app (`owa_lyric_validate` with `mode: "find"`), which looks in
 * the user's own songs and the public-domain hymn collection -- no model, no
 * network -- so with the assistant paused the offline bot can still do it.
 *
 * Narrow on purpose: a song word, a making verb, and the title either QUOTED
 * or said after *from / for / called* at the end. A question mark, an
 * address, a paste or notation is somebody else's job; "a song from words I
 * paste in" names no song.
 */
export function readSongTitleAsk(text: string): string | null {
    const trimmed = String(text ?? '').trim();
    if (
        trimmed === '' ||
        trimmed.startsWith('/') ||
        trimmed.endsWith('?') ||
        trimmed.includes('```') ||
        trimmed.includes('\n') ||
        /https?:\/\//i.test(trimmed)
    ) {
        return null;
    }
    const wordCount = trimmed.split(/\s+/).length;
    if (
        wordCount > MAX_SONG_TITLE_ASK_WORDS ||
        !SONG_WORD_PATTERN.test(trimmed) ||
        !SONG_MAKE_VERB_PATTERN.test(trimmed)
    ) {
        return null;
    }
    const quoted = QUOTED_TITLE_PATTERN.exec(trimmed)?.[1];
    const title = (quoted ?? TRAILING_TITLE_PATTERN.exec(trimmed)?.[1] ?? '')
        .replace(/[.!,;:]+$/, '')
        .trim();
    if (
        title.length < 2 ||
        (quoted === undefined && NOT_A_TITLE_PATTERN.test(title))
    ) {
        return null;
    }
    return title;
}

// "called Morning Praise", "titled 'Grace Again'": the title, quoted or up to
// the words that hand the song over or a stop. Only those words: a bare
// "with" or "in" ends "It Is Well with My Soul" and "Light in the Dark".
const NAMED_TITLE_PATTERN =
    /\b(?:called|named|titled|entitled)\s+(?:["“”«»‘’']([^"“”«»‘’'\n]{2,80})["“”«»‘’']|([^\n:,.;!?"“”«»]{2,80}?)(?=\s+(?:(?:with|from|and|using)\s+(?:these|this|the|its|my)\s+(?:words?|lyrics?|text|lines?|verses?)|with\s+(?:words|lyrics)|using)\b|\s*[:,.;!?\n]|\s+[—–-]\s|\s*$))/i;

/**
 * The title a person NAMED for a song whose words they give, or null.
 *
 * 2026-11-12, `EC-517`: _Create a song called Morning Praise with these
 * words: Verse 1: …_ was drafted as "Untitled" -- the model handed the words
 * to the drafter and left the title out. The window puts it in
 * (`runMcpToolCall`). Read on the ask's FIRST line only, after a song word,
 * so a lyric that says "named" names nothing.
 */
export function readSongTitleNamed(text: string): string | null {
    const firstLine = String(text ?? '').split('\n')[0] ?? '';
    if (firstLine.trim().startsWith('/')) {
        return null;
    }
    const matched = NAMED_TITLE_PATTERN.exec(firstLine);
    const head = matched === null ? '' : firstLine.slice(0, matched.index);
    // Past a colon are the words themselves: "with these words: … called
    // grace" names nothing.
    if (
        matched === null ||
        !SONG_WORD_PATTERN.test(head) ||
        head.includes(':')
    ) {
        return null;
    }
    const quoted = matched[1];
    const title = (quoted ?? matched[2] ?? '').trim();
    if (
        title.length < 2 ||
        (quoted === undefined && NOT_A_TITLE_PATTERN.test(title))
    ) {
        return null;
    }
    return title;
}

/**
 * A title the user typed after `/lyric` -- one short line that is neither an
 * address nor the words of a song. Quotes around it are taken off.
 */
export function readSongTitleArgument(text: string): string | null {
    const trimmed = String(text ?? '').trim();
    if (
        trimmed === '' ||
        trimmed.includes('\n') ||
        trimmed.length > 80 ||
        /https?:\/\//i.test(trimmed)
    ) {
        return null;
    }
    const title = trimmed.replace(/^["“”'«»]+|["“”'«»]+$/g, '').trim();
    return title.length >= 2 ? title : null;
}

// The first words of `songLookup.mjs`'s two lines a person is told about. A
// prefix rather than an import, as with the browser check: the renderer has
// no other use for that module, and `lyricDraftHelpers.test.ts` holds the two
// together.
export const SONG_NOT_FOUND_PREFIX = 'No song called';
export const SONG_YOURS_PREFIX = 'Already in their songs:';

/** The user's own song names off a lookup's `Already in their songs:` line. */
export function readSongLookupYours(raw: string): string[] {
    const line = String(raw ?? '')
        .split(/\r?\n/)
        .find((one) => {
            return one.startsWith(SONG_YOURS_PREFIX);
        });
    if (line === undefined) {
        return [];
    }
    return Array.from(line.matchAll(/"([^"]+)"/g), (match) => {
        return match[1];
    });
}
