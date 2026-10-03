import type { PublicDomainSongType } from './publicDomainSongsData';
import { publicDomainSongToMarkdown } from './publicDomainSongsHelpers';

// A song asked for by its NAME -- "Create a lyric file from 'Amazing Grace'"
// -- answered out of this plugin's own catalog, so the words a volunteer gets
// are the text **Import From Public Domain Songs** writes, with its source
// link, and never words a model remembered. A remembered hymn is routinely a
// verse short or a line wrong, and a remembered modern song is somebody's
// copyright written out from memory.
//
// Pure: the catalog is handed in, so the caller decides when the 36 hymns are
// loaded (lazily, on an ask) and the matching is testable with no data file.

/** What a title is compared as: case, accents, apostrophes and punctuation off. */
export function toComparableSongTitle(text: string) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’‘`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/^the /, '');
}

// The words a person puts AROUND a title that are not part of it: "the hymn
// Amazing Grace", "Amazing Grace lyrics".
const FILLER_WORD_SET = new Set([
    'song',
    'songs',
    'hymn',
    'hymns',
    'lyric',
    'lyrics',
    'words',
    'the',
]);

function toQueryTokens(comparable: string) {
    return comparable.split(' ').filter((token) => {
        return token.length > 0 && !FILLER_WORD_SET.has(token);
    });
}

/**
 * Every name a song answers to: its title, the title without a bracketed
 * part and the bracketed part alone ("Doxology (Praise God, from Whom All
 * Blessings Flow)" is asked for as either), and its first line -- most hymns
 * are known by their first line as often as by their title.
 */
function genSongNames(song: PublicDomainSongType) {
    const names = [song.title];
    const bracket = /^(.*?)\s*\((.+)\)\s*$/.exec(song.title);
    if (bracket !== null) {
        names.push(bracket[1], bracket[2]);
    }
    const firstLine = (song.verses[0] ?? '').split('\n')[0] ?? '';
    if (firstLine.trim() !== '') {
        names.push(firstLine);
    }
    return names.map(toComparableSongTitle).filter((name) => {
        return name !== '';
    });
}

function scoreSong(song: PublicDomainSongType, query: string) {
    const tokens = toQueryTokens(query);
    if (tokens.length === 0) {
        return 0;
    }
    const joined = tokens.join(' ');
    let best = 0;
    for (const name of genSongNames(song)) {
        if (name === query || name === joined) {
            return 100;
        }
        // "Holy, Holy, Holy" is the start of "Holy, Holy, Holy! Lord God
        // Almighty"; one short word ("love") is the start of too much.
        if (joined.length >= 6 && name.startsWith(`${joined} `)) {
            best = Math.max(best, 80);
            continue;
        }
        const nameTokenSet = new Set(name.split(' '));
        const isEveryToken = tokens.every((token) => {
            return nameTokenSet.has(token);
        });
        if (isEveryToken && tokens.length >= 2) {
            best = Math.max(best, 60);
        }
    }
    return best;
}

/** A song found for a title, as the tools hand it on. */
export type PublicDomainSongFoundType = {
    title: string;
    authors: string[];
    year: string;
    /** The open-lyric document the plugin's own import would write. */
    content: string;
};

export type PublicDomainSongLookupType = {
    found: PublicDomainSongFoundType | null;
    /** Up to five titles that share a word with the ask, best first. */
    nearest: string[];
};

const MIN_FOUND_SCORE = 60;
const MAX_NEAREST = 5;

/**
 * The one song a title names, or null and the nearest few.
 *
 * A tie at the top is NOT a find: two hymns that both answer is a question
 * for the person, and guessing between them would write the wrong song with
 * a confident button under it. "by John Newton" on the end is tried away if
 * the whole ask names nothing.
 */
export function lookupPublicDomainSong(
    catalog: PublicDomainSongType[],
    title: string,
): PublicDomainSongLookupType {
    const asked = toComparableSongTitle(title);
    const tries = [asked];
    const withoutAuthor = asked.replace(/ by .*$/, '').trim();
    if (withoutAuthor !== asked && withoutAuthor !== '') {
        tries.push(withoutAuthor);
    }
    for (const query of tries) {
        const scored = catalog
            .map((song) => {
                return { song, score: scoreSong(song, query) };
            })
            .filter((one) => {
                return one.score >= MIN_FOUND_SCORE;
            })
            .sort((a, b) => {
                return b.score - a.score;
            });
        const [top, second] = scored;
        if (top === undefined) {
            continue;
        }
        if (second !== undefined && second.score === top.score) {
            return {
                found: null,
                nearest: scored
                    .filter((one) => {
                        return one.score === top.score;
                    })
                    .slice(0, MAX_NEAREST)
                    .map((one) => {
                        return one.song.title;
                    }),
            };
        }
        const content = publicDomainSongToMarkdown(top.song);
        if (content === null) {
            break;
        }
        return {
            found: {
                title: top.song.title,
                authors: top.song.authors,
                year: top.song.year,
                content,
            },
            nearest: [],
        };
    }
    return { found: null, nearest: genNearestTitles(catalog, withoutAuthor) };
}

/** Titles sharing a word of four letters or more with the ask. */
function genNearestTitles(catalog: PublicDomainSongType[], query: string) {
    const tokens = toQueryTokens(query).filter((token) => {
        return token.length >= 4;
    });
    if (tokens.length === 0) {
        return [];
    }
    return catalog
        .map((song) => {
            const nameTokenSet = new Set(
                genSongNames(song).join(' ').split(' '),
            );
            const shared = tokens.filter((token) => {
                return nameTokenSet.has(token);
            }).length;
            return { title: song.title, shared };
        })
        .filter((one) => {
            return one.shared > 0;
        })
        .sort((a, b) => {
            return b.shared - a.shared;
        })
        .slice(0, MAX_NEAREST)
        .map((one) => {
            return one.title;
        });
}
