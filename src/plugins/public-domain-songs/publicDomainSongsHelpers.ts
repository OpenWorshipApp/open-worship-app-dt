import type {
    PublicDomainSongSourceType,
    PublicDomainSongType,
} from './publicDomainSongsData';

// Windows-illegal characters plus control chars; the rest of the name is kept
// as typed so the document row still reads like the song title.
export function sanitizeFileName(name: string): string {
    const sanitized = name
        .replace(/[<>:"/\\|?*]/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '')
        .slice(0, 120)
        .trim();
    return sanitized || 'Public Domain Song';
}

// The texts are curated, but they were fetched from the web — keep the same
// light sanitation the SongSelect import applies so a stray bracket or fence
// can never invalidate the generated document.
function sanitizeLyricLines(lyrics: string): string {
    return lyrics
        .replace(/\r\n?/g, '\n')
        .replace(/\[/g, '(')
        .replace(/\]/g, ')')
        .split('\n')
        .map((line) => {
            let sanitized = line.trimEnd();
            if (sanitized.trimStart().startsWith('```')) {
                sanitized = sanitized.replace(/`/g, "'");
            }
            if (sanitized.trimStart().startsWith('//')) {
                sanitized = sanitized.trimStart().replace(/^\/+\s*/, '');
            }
            return sanitized;
        })
        .join('\n')
        .trim();
}

type SongPartType = {
    name: string;
    code: string;
    lyrics: string;
};

// Verses become `Verse n` fences (a lone verse stays bare `Verse`); the
// refrain becomes a single `Chorus` fence. The structure repeats the chorus
// after every verse — the traditional singing order of a refrain hymn — which
// open-lyric's structure grammar allows (probed live 2026-08-24).
export function genPublicDomainSongParts(song: PublicDomainSongType): {
    parts: SongPartType[];
    structure: string;
} {
    const verses = song.verses
        .map(sanitizeLyricLines)
        .filter((lyrics) => lyrics !== '');
    const refrain =
        song.refrain === null ? '' : sanitizeLyricLines(song.refrain);
    const parts: SongPartType[] = [];
    const structureCodes: string[] = [];
    verses.forEach((lyrics, index) => {
        const isSingle = verses.length === 1;
        const code = isSingle ? 'V' : `V${index + 1}`;
        parts.push({
            name: isSingle ? 'Verse' : `Verse ${index + 1}`,
            code,
            lyrics,
        });
        structureCodes.push(code);
        if (refrain !== '') {
            structureCodes.push('C');
        }
    });
    if (refrain !== '') {
        // Declared once, referenced after every verse.
        parts.splice(1, 0, { name: 'Chorus', code: 'C', lyrics: refrain });
    }
    return { parts, structure: structureCodes.join('') };
}

// open-lyric's Config `Attachments` takes one link per line: the first sits on
// the `- Attachments:` line itself and every further one is a tab-indented
// continuation. Each line is either a bare URL or a Markdown link whose target
// is a protocol-based URL - anything else fails `checkMarkdown`, so a source
// that cannot be written as one of those two shapes is dropped rather than
// risking the whole document.
const PROTOCOL_URL_REGEX = /^[a-z][a-z0-9+.-]*:\/\/\S*$/i;

export function genPublicDomainSongAttachmentLines(
    sources: PublicDomainSongSourceType[],
): string[] {
    const lines: string[] = [];
    for (const { title, url } of sources) {
        const link = url.trim();
        if (!PROTOCOL_URL_REGEX.test(link)) {
            continue;
        }
        // Brackets and parentheses would close the Markdown link early; a
        // label left empty by that stripping falls back to the bare URL, which
        // open-lyric titles from the URL itself.
        const label = title
            .replace(/[[\]()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        lines.push(label === '' ? link : `[${label}](${link})`);
    }
    return lines;
}

export function publicDomainSongToMarkdown(
    song: PublicDomainSongType,
): string | null {
    const { parts, structure } = genPublicDomainSongParts(song);
    if (parts.length === 0) {
        return null;
    }
    const lines: string[] = [
        `# ${song.title}`,
        '',
        '```ol:Config',
        `- Title: ${song.title}`,
        `- Artist: ${song.authors.join(', ') || 'Unknown Artist'}`,
        `- Copyright: Public Domain${song.year ? ` (${song.year})` : ''}`,
        // The texts carry no key/tempo/time; these are open-lyric's own
        // plain-text-import defaults, same as the SongSelect import.
        '- Key: C',
        '- Tempo: 120bpm',
        '- Time: 4/4',
        `- Structure: ${structure}`,
    ];
    const attachmentLines = genPublicDomainSongAttachmentLines(song.sources);
    if (attachmentLines.length > 0) {
        const [firstLink, ...restLinks] = attachmentLines;
        lines.push(`- Attachments: ${firstLink}`);
        for (const link of restLinks) {
            // Continuation lines MUST be indented; an unindented one reads as
            // a new Config field.
            lines.push(`\t${link}`);
        }
    }
    lines.push('```', '');
    for (const part of parts) {
        lines.push(`\`\`\`ol:${part.name}`, part.lyrics, '```', '');
    }
    return lines.join('\n');
}

export function filterPublicDomainSongs(
    songs: PublicDomainSongType[],
    query: string,
): PublicDomainSongType[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return songs;
    }
    return songs.filter((song) => {
        const haystack =
            `${song.title} ${song.authors.join(' ')}`.toLowerCase();
        return tokens.every((token) => {
            return haystack.includes(token);
        });
    });
}
