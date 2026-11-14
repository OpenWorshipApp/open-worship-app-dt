/**
 * A background VIDEO or a track from a LINK, asked for in an ordinary chat
 * (2026-11-12, EC-518; the user's goal: _chatbot will be very smart to help
 * user create … background resoures_). _Add this video as a background:
 * https://youtu.be/…_ had been answered, on Auto, with the five steps of the
 * Videos tab's **Download From URL** -- the link left for the person to copy.
 *
 * The download is the person's to press: it fetches from the internet into
 * their folders and, the first time, installs the download tools behind a
 * box of its own (W-21). So the window does what it can without pressing it:
 * it copies the link -- that box fills itself from the clipboard -- says in
 * one line where to press, and offers W-21's walkthrough to ring each control.
 *
 * English in code (EC-516). Pure: no store, no tool call, no model.
 */

export type BackgroundLinkKindType = 'video' | 'audio';

export type BackgroundLinkAskType = {
    kind: BackgroundLinkKindType;
    url: string;
};

/** The recipe the walkthrough walks: the Videos / Audios tab's download. */
export const BACKGROUND_LINK_RECIPE_ID = 'W-21';
export const BACKGROUND_LINK_FIND = 'Download From URL';

const MAX_ASK_LENGTH = 600;
const MAX_URL_LENGTH = 600;

const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|who|is there|are there|is it|does|do i|can i|could i|should i|may i)\b/i;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const REQUEST_PATTERN =
    /\b(?:add|use|put|make|download|get|save|set|grab|fetch|import|bring|i\s+(?:want|need|would\s+like))\b/i;
// A song's WORDS from a page are the song drafter's (`agent-songs.md`).
const LYRIC_PATTERN =
    /\b(?:lyrics?|words|chords|song\s+(?:file|page|sheet)|open\s*lyric|slides?|verses?)\b/i;
const VIDEO_PATTERN = /\b(?:videos?|clips?|movies?|backgrounds?)\b/i;
const AUDIO_PATTERN =
    /\b(?:mp3|audios?|music|soundtracks?|sound|tracks?|audio\s+files?)\b/i;

/**
 * Whether a line asks to bring a video or a track in from a link, and which.
 * Null for anything else: a how-to, a link to read, a song's words from a
 * page, two links at once.
 */
export function readBackgroundLinkAsk(
    text: string,
): BackgroundLinkAskType | null {
    const line = String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (
        line === '' ||
        line.startsWith('/') ||
        line.length > MAX_ASK_LENGTH ||
        HOW_TO_PATTERN.test(line)
    ) {
        return null;
    }
    const urls = line.match(URL_PATTERN) ?? [];
    if (urls.length !== 1) {
        return null;
    }
    const url = urls[0].replace(/[.,;:!?)\]]+$/, '');
    if (url.length > MAX_URL_LENGTH) {
        return null;
    }
    const words = line.replace(URL_PATTERN, ' ');
    if (!REQUEST_PATTERN.test(words) || LYRIC_PATTERN.test(words)) {
        return null;
    }
    const isVideo = VIDEO_PATTERN.test(words);
    const isAudio =
        AUDIO_PATTERN.test(words) ||
        // "Download this song" is its sound: its words were ruled out above.
        (/\bsongs?\b/i.test(words) && /\bdownload\b/i.test(words));
    if (isAudio && !/\bvideos?\b/i.test(words)) {
        return { kind: 'audio', url };
    }
    return isVideo ? { kind: 'video', url } : null;
}
