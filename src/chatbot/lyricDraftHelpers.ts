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

export type DraftedLyricType = {
    reference: string;
    /** The Open Lyric document, exactly as the tool wrote it. */
    content: string;
    /** What to call the file, taken from the song's own Title. */
    name: string;
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

// In memory only and bounded, for the reasons in the header above.
const draftedLyricMap = new Map<string, DraftedLyricType>();
const MAX_DRAFTED_LYRICS = 3;
let draftCount = 0;

export function keepDraftedLyric(content: string): DraftedLyricType {
    draftCount += 1;
    const drafted = {
        reference: `lyric-${Date.now().toString(36)}-${draftCount}`,
        content,
        name: toDraftedLyricName(content),
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

/** What a window that has been reopened since has to say instead. */
export const DRAFT_GONE_TEXT =
    'That song is not held any more — this window has been reopened since. ' +
    'Send me the words again and I will write it out afresh.';

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

export type DraftReportType = {
    /** `Song: "Title" by Artist — key C, 120bpm, 4/4` */
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
