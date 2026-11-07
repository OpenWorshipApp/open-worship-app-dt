/**
 * A conversation about one of the user's SONGS, attached to the tab -- from
 * a Documents row's **Open in Chatbot**, the Lyric Editor's 🤖, the
 * paperclip or a drop.
 *
 * Asked for 2026-11-06 (the user, with `Still khmer` circled in the
 * Documents list: _add lyric context menu `Open In Chatbot`, make chatbot to
 * support lyric files attached, when lyric files attached the chatbot should
 * provide all operations related to lyric modification_ -- add a section,
 * translate it, change its words, its key).
 *
 * How it goes: a question asked while a `.owl` is open in the tab is a
 * `lyric` ask. The window reads each attached song as it stands NOW through
 * `owa_lyric_edit read` (unsaved edits included -- the attachment's own words
 * are a snapshot from when it was attached, stale after the first change)
 * and puts it under the question (`toLyricAsk`); the ask goes out under a
 * short prompt of its own with `owa_lyric_edit` -- offered to no other
 * question -- and the model hands over WORDS, the app writing the notation
 * (memory `model-cannot-write-open-lyric`). The model names a song; the
 * window turns the name into the attached file's path
 * (`resolveLyricEditFile`), so no path ever reaches it or comes from it.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    type AssistantLanguageType,
} from './chatLangHelpers';
import { fillWords, tran } from './chatTranHelpers';

export const LYRIC_ASK_KIND = 'lyric';
export const LYRIC_EDIT_TOOL_NAME = 'owa_lyric_edit';
// A read, a change or two, and the answer: a translation is one call.
export const LYRIC_MAX_TOOL_ROUNDS = 6;
/** The most songs one question reads and may change. */
export const MAX_LYRIC_ASK_FILES = 4;
// What one song may cost the question it rides on. A long hymn with a
// translation under every line is ~6 000 characters.
const MAX_SONG_TEXT_CHARS = 9000;

const LYRIC_FILE_PATTERN = /\.owl$/i;
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;

/** Whether a file is one of the app's songs, by its name. */
export function checkIsLyricFileName(name: string) {
    return LYRIC_FILE_PATTERN.test(String(name ?? '').trim());
}

/** A song's name as the Documents list shows it: no folder, no `.owl`. */
export function toSongName(fileName: string) {
    const base =
        String(fileName ?? '')
            .split(/[\\/]/)
            .pop() ?? '';
    return base.replace(LYRIC_FILE_PATTERN, '');
}

/**
 * A song FILE's words: a `.owl` is JSON with the Open Lyric text in its
 * `content`, and an attachment that carried the JSON as it stands showed a
 * model escaped newlines and the app's metadata. Null when it is not one.
 */
export function toLyricFileText(fileText: string) {
    try {
        const json = JSON.parse(fileText);
        return typeof json?.content === 'string' ? json.content : null;
    } catch (_error) {
        return null;
    }
}

export type LyricAskFileType = { name: string; filePath: string };

/**
 * The songs among a tab's open files -- each a file from disk with its path,
 * once, the first `MAX_LYRIC_ASK_FILES`.
 */
export function findLyricAskFiles(
    attachments: readonly ChatAttachmentType[],
): LyricAskFileType[] {
    const out: LyricAskFileType[] = [];
    for (const attachment of attachments) {
        const filePath = attachment.filePath;
        if (
            typeof filePath !== 'string' ||
            !checkIsLyricFileName(filePath) ||
            out.some((one) => {
                return one.filePath === filePath;
            })
        ) {
            continue;
        }
        out.push({ name: toSongName(filePath), filePath });
    }
    return out.slice(0, MAX_LYRIC_ASK_FILES);
}

function toComparableName(text: string) {
    return toSongName(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * What a model's `file` turns into: the attached song's own path, a song of
 * the Documents folder by its name, or a `reason` to refuse with.
 *
 * A model names a song; it never hands over a path. One written as one --
 * a prompt injected into a song's words could ask for any file -- is
 * refused, and with one song attached no name at all means that song.
 */
export function resolveLyricEditFile(
    file: unknown,
    songs: readonly LyricAskFileType[],
): { filePath: string } | { name: string } | { reason: string } {
    const text = typeof file === 'string' ? file.trim() : '';
    if (ABSOLUTE_PATH_PATTERN.test(text) || /[\\/]/.test(text)) {
        return {
            reason:
                'Name the song as it is attached, by its name -- never a ' +
                'path.',
        };
    }
    if (text === '') {
        return songs.length === 1
            ? { filePath: songs[0].filePath }
            : {
                  reason:
                      'Say which song (`file`): ' +
                      songs
                          .map((one) => {
                              return `"${one.name}"`;
                          })
                          .join(', ') +
                      '.',
              };
    }
    const asked = toComparableName(text);
    const attached = songs.find((one) => {
        return toComparableName(one.name) === asked;
    });
    if (attached !== undefined) {
        return { filePath: attached.filePath };
    }
    // Another of their songs, by its Documents name: the app checks it is
    // there, and every change is backed up like any other.
    return { name: toSongName(text) };
}

type DescribedPartType = {
    part?: unknown;
    lines?: unknown;
    holds?: unknown;
    translations?: unknown;
};

/**
 * One song as the model reads it: its Config line, its play order, then
 * every part with its lines numbered and a translation beside the line it
 * belongs to. Words, never notation -- the notation is the app's to write.
 */
export function toLyricSongText(described: any) {
    if (described === null || typeof described !== 'object') {
        return null;
    }
    const facts = [
        ['Title', described.title],
        ['Subtitle', described.subtitle],
        ['Artist', described.artist],
        ['Key', described.key],
        ['Tempo', described.tempo],
        ['Time', described.time],
        ['Languages', described.locales],
    ]
        .filter(([, value]) => {
            return typeof value === 'string' && value !== '';
        })
        .map(([name, value]) => {
            return `${name}: ${value}`;
        });
    const lines = [facts.join(' · ')];
    const playOrder = Array.isArray(described.playOrder)
        ? described.playOrder.filter((one: unknown) => {
              return typeof one === 'string';
          })
        : [];
    if (playOrder.length > 0) {
        lines.push(`Play order: ${playOrder.join(' → ')}`);
    }
    if (typeof described.playOrderNote === 'string') {
        lines.push(described.playOrderNote);
    }
    const parts: DescribedPartType[] = Array.isArray(described.parts)
        ? described.parts
        : [];
    for (const part of parts) {
        if (typeof part?.part !== 'string') {
            continue;
        }
        const holds = typeof part.holds === 'string' ? ` (${part.holds})` : '';
        lines.push('', `[${part.part}]${holds}`);
        const partLines = Array.isArray(part.lines) ? part.lines : [];
        const translations = Array.isArray(part.translations)
            ? part.translations
            : [];
        if (partLines.length === 0) {
            lines.push('(empty)');
        }
        partLines.forEach((line: unknown, index: number) => {
            lines.push(`${index + 1}. ${String(line)}`);
            const translation = translations[index];
            if (typeof translation === 'string' && translation !== '') {
                lines.push(`   translation: ${translation}`);
            }
        });
    }
    const text = lines.join('\n').trim();
    return text.length > MAX_SONG_TEXT_CHARS
        ? `${text.slice(0, MAX_SONG_TEXT_CHARS)}\n[... the rest of this song was not included; owa_lyric_edit read gives it whole]`
        : text;
}

/**
 * The question as the model is asked it: what they typed, then each attached
 * song as it reads now, named as `file` takes it.
 */
export function toLyricAsk(
    asked: string,
    songs: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
) {
    const shown = songs.map((song) => {
        return (
            `(The song "${song.name}" is attached. Change it with ` +
            `${LYRIC_EDIT_TOOL_NAME}, file "${song.name}". It reads now:\n` +
            `${song.text ?? `(it could not be read just now; call ${LYRIC_EDIT_TOOL_NAME} with action "read")`})`
        );
    });
    return [
        asked,
        ...(translateMode === null
            ? []
            : [LYRIC_TRANSLATE_HINT_MAP[translateMode]]),
        ...shown,
    ].join('\n\n');
}

/**
 * The two ways a song is translated, the PERSON's choice (2026-11-06, the
 * user: _should have options: replace or append the translation under the
 * line_): its words replaced by the translation, or the translation added as
 * a line under each line, the words kept -- a bilingual song.
 */
export type LyricTranslateModeType = 'replace' | 'under';

// Said to the model under a pressed choice, so which way is never its guess.
const LYRIC_TRANSLATE_HINT_MAP: Record<LyricTranslateModeType, string> = {
    replace:
        '(They chose to REPLACE the words with the translation: set-lines on ' +
        'every sung part, with `locales` naming the new language and ' +
        '`config` the translated Title (and Subtitle, when it has one). When ' +
        'no language is named, ask which first, with OPTIONS naming two or ' +
        'three languages -- never the two ways again.)',
    under:
        '(They chose to KEEP the words and add the translation as a line ' +
        'under each sung line: add-translation, with `locales` naming both ' +
        'languages and `config` the Title (and Subtitle, when it has one) ' +
        'as "<original> / <translation>". When no language is named, ask ' +
        'which first, with OPTIONS naming two or three languages -- never ' +
        'the two ways again.)',
};

function checkMatchesTemplate(text: string, template: string) {
    const [before, after] = template.split('{language}');
    if (after === undefined) {
        return text === template;
    }
    return (
        text.length > before.length + after.length &&
        text.startsWith(before) &&
        text.endsWith(after)
    );
}

/**
 * Which way a pressed translate button asks for, in the window's own words,
 * or null for anything else -- a typed request says it in its own words, and
 * the model asks when it does not.
 */
export function readLyricTranslateMode(
    asked: string,
): LyricTranslateModeType | null {
    const text = String(asked ?? '').trim();
    if (
        text === tran('Replace the words with another language') ||
        checkMatchesTemplate(text, tran('Replace the words with {language}'))
    ) {
        return 'replace';
    }
    if (
        text === tran('Add another language under each line') ||
        checkMatchesTemplate(text, tran('Add {language} under each line'))
    ) {
        return 'under';
    }
    return null;
}

/**
 * The two translate buttons -- replace the words, or add the translation
 * under each line -- for the language the song is for, or for "another
 * language" when none is known (the assistant then asks which).
 */
export function genLyricTranslateReplies(languageName: string | null) {
    return languageName === null
        ? [
              tran('Replace the words with another language'),
              tran('Add another language under each line'),
          ]
        : [
              fillWords(tran('Replace the words with {language}'), {
                  language: languageName,
              }),
              fillWords(tran('Add {language} under each line'), {
                  language: languageName,
              }),
          ];
}

/**
 * The system prompt of such a conversation: what the tool takes, and the one
 * rule that matters -- words from the model, notation from the app.
 */
export const LYRIC_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer change a song they attached. ' +
    'Each attached song is given under their message as it reads now: its ' +
    'key and play order, then every part with its lines numbered. Change it ' +
    `with ${LYRIC_EDIT_TOOL_NAME}, naming the song in \`file\` exactly as ` +
    'it is given. Give WORDS only: never write song notation -- no ``` ' +
    'fences, no ol: headers, no Structure codes -- the app writes it and ' +
    'refuses a change that would break the song. Make the change asked for, ' +
    'all of it in one call where one call can do it: every part in ONE ' +
    'set-lines or add-translation call. TRANSLATING has two ways and the ' +
    'person chooses: REPLACE the words with the translation (set-lines, ' +
    'every sung part, with `locales` naming that language, e.g. ' +
    '["es-ES"]) or ADD the translation as a line under each line, keeping ' +
    'the words (add-translation, with `locales` naming both, e.g. ' +
    '["en-US","es-ES"]). Unless their words already say which ("replace", ' +
    '"instead of" is replace; "under each line", "bilingual", "keep the ' +
    'English" is add), ask which way first and end with OPTIONS: Replace ' +
    'the words | Add it under each line. Once the way is known and the ' +
    'language is not, ask which language, with OPTIONS naming two or three ' +
    "languages. Either way keep each part's number of lines, " +
    'write natural lines a congregation can sing, in the target ' +
    "language's own script, and give names (God, Jesus, Lord) the way that " +
    'language says them. Translate the Title and the Subtitle too, in the ' +
    'same call through `config`: replacing, {"Title": "<translation>"}; ' +
    'under each line, {"Title": "<original> / <translation>"} -- and the ' +
    'Subtitle the same way when the song has one. Parts that hold chords ' +
    'and bars only take no translation. CHORDS: set-chords gives the same ' +
    'words with [chords] ' +
    'placed before syllables, e.g. "[G]Amazing [C]grace"; an Instrumental ' +
    'part takes chords and bars only, e.g. "| G | D | Em | C |". KEY: to ' +
    'change the key of a song with chords, transpose; with no chords, ' +
    'set-config Key. A key is one of C Db D Eb E F F# Gb G Ab A Bb B or a ' +
    'minor such as Am. A NEW PART: add-section with `part` "Verse" (it takes ' +
    'the next number), "Chorus", "Bridge" ... and its `lines`, `after` the ' +
    'part it follows; a note for the band is part "Note". Ask for the words ' +
    'when they gave none -- never invent the words of a song. Remove at ' +
    'most one part in an answer, and only one they named. When the tool ' +
    'refuses, read its reason, fix the call and try once more; then say ' +
    'plainly what went wrong. After a change, say in a sentence or two what ' +
    'changed, that it is NOT saved yet (a * shows beside its name; Save in ' +
    'the Lyric Editor keeps it) and that Undo this change puts it back. ' +
    'Never write the song or its notation out in your answer. End with ' +
    'OPTIONS: two or three next changes they might want.';

/**
 * The language a song's NAME says it is for -- `Still khmer` is the copy of
 * `Still` to be put into Khmer -- among the languages this computer knows.
 */
export function findSongLanguage(
    songName: string,
    languages: readonly AssistantLanguageType[],
) {
    const words = new Set(
        toSongName(songName)
            .toLowerCase()
            .split(/[^\p{L}]+/u)
            .filter(Boolean),
    );
    return (
        languages.find((language) => {
            return (
                language.code !== DEFAULT_CHAT_LANG_CODE &&
                (words.has(language.name.toLowerCase()) ||
                    words.has(language.nativeName.toLowerCase()))
            );
        }) ?? null
    );
}

/**
 * The language a translation chip offers: the one the song's name says, or
 * the language the app is shown in -- never English, which is what most of
 * the songs here are already in. Null: offer "another language".
 */
export function pickTranslateLanguage(
    songName: string,
    appLanguage: AssistantLanguageType,
    languages: readonly AssistantLanguageType[],
) {
    return (
        findSongLanguage(songName, languages) ??
        (appLanguage.code === DEFAULT_CHAT_LANG_CODE ? null : appLanguage)
    );
}

/**
 * The card a song opens its tab with, written by the window with no model:
 * that it is attached, everything that can be done to it, and the changes
 * asked for most as buttons. Every button is a question pressed, answered by
 * the assistant with `owa_lyric_edit`.
 */
export function genLyricOpeningAnswer(
    fileName: string,
    appLanguage: AssistantLanguageType,
    languages: readonly AssistantLanguageType[],
) {
    const name = toSongName(fileName);
    const target = pickTranslateLanguage(name, appLanguage, languages);
    // Named as the reader of THIS window says it: its own word in a window
    // shown in English, the language's own name in any other.
    const targetName =
        target === null
            ? null
            : appLanguage.code === DEFAULT_CHAT_LANG_CODE
              ? target.name
              : target.nativeName;
    return {
        text: fillWords(
            tran(
                '“{name}” is attached below. I can change this song for ' +
                    'you: add a verse or another part, change its words, ' +
                    'translate it, add chords, change its key, or reorder ' +
                    'or remove its parts. Press one, or say what you want.',
            ),
            { name },
        ),
        // Both ways of translating are buttons of their own: which one is
        // the person's to say, never the assistant's to guess.
        replies: [
            ...genLyricTranslateReplies(targetName),
            tran('Add a section'),
            tran('Add chords'),
            tran('Change the key'),
        ],
        translateLanguage: target,
    };
}

/**
 * Whether a question asks for the song in another language -- the card's
 * own buttons in the window's words, or "translate" typed in English -- so
 * Auto can put it to a Gemma 4 model first.
 */
export function checkIsLyricTranslateAsk(asked: string) {
    return (
        /\btranslat/i.test(String(asked ?? '')) ||
        readLyricTranslateMode(asked) !== null
    );
}

/** What the window keeps of a change the model made: the button that undoes it. */
export type EditedLyricType = { name: string; undoId: string | null };

/**
 * A change `owa_lyric_edit` made, off its RESULT -- a refusal is prose and
 * changed nothing, and a read changes nothing either.
 */
export function readEditedLyric(text: string): EditedLyricType | null {
    try {
        const result = JSON.parse(text);
        if (result?.isChanged !== true || typeof result.name !== 'string') {
            return null;
        }
        return {
            name: result.name,
            undoId:
                typeof result.undoId === 'string' && result.undoId !== ''
                    ? result.undoId
                    : null,
        };
    } catch (_error) {
        return null;
    }
}

/**
 * The button under a changed song: the window puts the change back itself
 * (`owa_undo` with the change's id) and says so in a sentence -- the tool's
 * own JSON is nothing a volunteer reads. Registered nowhere, like the
 * report's Send. Its label is stored English and drawn in the window's
 * language.
 */
export const LYRIC_UNDO_TOOL_NAME = 'lyric-undo';
export const LYRIC_UNDO_LABEL = 'Undo this change';

/** The button that undoes `edited`, or null when the change left no id. */
export function genLyricUndoAction(edited: EditedLyricType) {
    return edited.undoId === null
        ? null
        : {
              label: LYRIC_UNDO_LABEL,
              toolName: LYRIC_UNDO_TOOL_NAME,
              args: { id: edited.undoId, name: edited.name },
          };
}
