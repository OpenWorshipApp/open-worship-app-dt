import { genLyricPlaySteps } from '../lyric-list/lyricStructureHelpers';
import { handleError } from '../helper/errorHelpers';
import type {
    LongTextLanguageType,
    LongTextReadProblemType,
    LongTextResolvedLanguageType,
    LongTextSectionTextType,
} from './foregroundLongTextHelpers';
import { toRawResolvedLanguage } from './foregroundLongTextHelpers';

// A lyric file as the words Long Text Show puts up: its title, and each part
// of the song in the order it is SUNG. Everything heavy -- `open-lyric`, and
// `Lyric`, which imports it -- is imported only when a card actually points at
// a lyric file, so a session of typed text never loads either.

export type LyricLongTextType = {
    title: string;
    sections: LongTextSectionTextType[];
};
export type LyricLongTextProblemType = {
    kind: LongTextReadProblemType;
    partName?: string;
};
export type LyricLongTextResultType =
    LyricLongTextType | { problem: LyricLongTextProblemType };

// A cue or a strumming pattern: `{c: Piano + Pads }`, `{p: #2}`. Notation for
// the band, which the plain text of a part still carries.
const DIRECTIVE_REGEX = /\{[pc]:[^}]*\}/g;
// `||:` `|:` `:||` `:|` `|` -- the bars a lyric line may be aligned with.
const BAR_TOKEN_REGEX = /\|\|:|:\|\||\|:|:\||\|/g;

/**
 * A part's plain text as words to sing: open-lyric has already taken the
 * chords out, and this takes the rest of the notation -- directives and bar
 * marks -- and the lines that held nothing else.
 */
export function toSingAlongText(text: string) {
    return text
        .split(/\r?\n/)
        .map((line) => {
            return line
                .replaceAll(DIRECTIVE_REGEX, ' ')
                .replaceAll(BAR_TOKEN_REGEX, ' ')
                .replaceAll(/\s+/g, ' ')
                .trim();
        })
        .filter((line) => {
            return line !== '';
        })
        .join('\n');
}

/**
 * An Open Lyric document as its title and its parts in sung order.
 *
 * A throwaway `OpenLyric`: never mounted, no stylesheet injected, destroyed
 * before this returns. Its text reader parses and renders nothing. The parts
 * come from `genLyricPlaySteps`, the same walk of the Structure the slides are
 * built from, so a Chorus sung twice is here twice and `Cx3` three times.
 */
export async function parseLyricLongText(
    content: string,
): Promise<LyricLongTextResultType> {
    const { OpenLyric } = await import('open-lyric');
    const openLyric = new OpenLyric({
        value: content,
        isSkipStyleInjection: true,
    });
    try {
        const info = openLyric.getInfo();
        if (info === null) {
            return { problem: { kind: 'invalid' } };
        }
        const steps = genLyricPlaySteps(openLyric);
        const textMap = await openLyric.getElementMap({
            type: 'text',
            isWithInfo: false,
        });
        const sections: LongTextSectionTextType[] = [];
        for (const { key } of steps) {
            const text = textMap[key];
            // A Structure step with no part behind it: open-lyric answers
            // with a sentence about it, which is not a line to put up.
            if (
                text === undefined ||
                text === `Missing declared part for ${key}.`
            ) {
                return { problem: { kind: 'missing-part', partName: key } };
            }
            sections.push({ partName: key, text: toSingAlongText(text) });
        }
        return { title: info.title, sections };
    } catch (error) {
        handleError(error);
        return { problem: { kind: 'invalid' } };
    } finally {
        openLyric.destroy();
    }
}

/**
 * A lyric file of the Documents folder, read the way its own previewer reads
 * it: `getContent` answers from the editing history's head, so a song being
 * edited is the song as it stands, saved or not.
 */
export async function readLyricLongText(
    filePath: string,
): Promise<LyricLongTextResultType> {
    if (filePath === '') {
        return { problem: { kind: 'no-file' } };
    }
    let content = '';
    try {
        const { default: Lyric } = await import('../lyric-list/Lyric');
        content = await Lyric.getInstance(filePath).getContent();
    } catch (error) {
        handleError(error);
    }
    if (content.trim() === '') {
        return { problem: { kind: 'missing' } };
    }
    return parseLyricLongText(content);
}

/** One language as its words, whichever source it is set to. */
export async function resolveLongTextLanguage(
    language: LongTextLanguageType,
): Promise<LongTextResolvedLanguageType> {
    if (language.source === 'raw') {
        return toRawResolvedLanguage(language);
    }
    const result = await readLyricLongText(language.lyricFilePath);
    if ('problem' in result) {
        return {
            langCode: language.langCode,
            source: 'lyric',
            title: '',
            sections: [],
            readProblem: result.problem,
        };
    }
    return {
        langCode: language.langCode,
        source: 'lyric',
        title: result.title,
        sections: result.sections,
    };
}
