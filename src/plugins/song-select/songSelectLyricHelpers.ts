import { EditorOpenLyricPlugin } from 'open-lyric';

import type { SongSelectLyricsType } from './songSelectApiHelpers';

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
    return sanitized || 'SongSelect Song';
}

// Ground truth probed from open-lyric's own structure module
// (STRUCTURE_TOKEN_DEFINITIONS): every canonical part header, its structure
// code, and whether `<Header> <n>` numbering is allowed.
const PART_DEFINITIONS = {
    Intro: { code: 'I', allowsNumbering: false },
    Verse: { code: 'V', allowsNumbering: true },
    Note: { code: 'N', allowsNumbering: true },
    'Pre-Chorus': { code: 'P', allowsNumbering: true },
    Chorus: { code: 'C', allowsNumbering: true },
    'Post-Chorus': { code: 'X', allowsNumbering: true },
    'Final-Chorus': { code: 'F', allowsNumbering: false },
    Bridge: { code: 'B', allowsNumbering: true },
    Instrumental: { code: 'IS', allowsNumbering: true },
    Interlude: { code: 'L', allowsNumbering: true },
    Breakdown: { code: 'D', allowsNumbering: true },
    Refrain: { code: 'R', allowsNumbering: true },
    Tag: { code: 'T', allowsNumbering: true },
    Turnaround: { code: 'TU', allowsNumbering: true },
    Vamp: { code: 'A', allowsNumbering: false },
    Solo: { code: 'S', allowsNumbering: true },
    Outro: { code: 'O', allowsNumbering: false },
} as const;
type PartHeaderType = keyof typeof PART_DEFINITIONS;

// SongSelect `partType` (normalized: lowercase, separators stripped, trailing
// digits dropped) → canonical open-lyric header. Anything not listed falls
// back to a Breakdown free-text fence carrying the original label.
const PART_TYPE_TO_HEADER: Record<string, PartHeaderType> = {
    verse: 'Verse',
    chorus: 'Chorus',
    prechorus: 'Pre-Chorus',
    postchorus: 'Post-Chorus',
    bridge: 'Bridge',
    middle: 'Bridge',
    intro: 'Intro',
    introduction: 'Intro',
    outro: 'Outro',
    ending: 'Outro',
    end: 'Outro',
    coda: 'Outro',
    finalchorus: 'Final-Chorus',
    lastchorus: 'Final-Chorus',
    refrain: 'Refrain',
    hook: 'Refrain',
    tag: 'Tag',
    vamp: 'Vamp',
    // NOT interlude/instrumental: those fences only accept chord-bar syntax
    // (probed against open-lyric's validator), so SongSelect text for them
    // rides the Breakdown fallback instead.
    solo: 'Solo',
    turnaround: 'Turnaround',
    breakdown: 'Breakdown',
    break: 'Breakdown',
};

function normalizePartType(partType: string) {
    return partType
        .toLowerCase()
        .replace(/[\s\-_.'’]+/g, '')
        .replace(/\d+$/, '');
}

// Lyric fences reject unmatched `[`/`]` (chord annotations) and a line
// starting with ``` would close the fence early; free-text fences only need
// the latter guard.
function sanitizeLyricLines(lyrics: string, isFreeText: boolean) {
    const lines = lyrics
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => {
            let sanitized = line.replace(/^\s*```+/, (match) => {
                return match.replace(/`/g, "'");
            });
            if (!isFreeText) {
                sanitized = sanitized.replace(/\[/g, '(').replace(/\]/g, ')');
            }
            return sanitized.trimEnd();
        });
    while (lines.length > 0 && lines[0].trim() === '') {
        lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }
    return lines;
}

function sanitizeConfigValue(value: string) {
    return value
        .replace(/[`\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

type BuiltPartType = {
    partName: string;
    structureCode: string;
    lines: string[];
    commentLabel: string | null;
};

class PartNameAllocator {
    usedNames = new Set<string>();
    breakdownCount = 0;

    tryTake(partName: string) {
        if (this.usedNames.has(partName)) {
            return false;
        }
        this.usedNames.add(partName);
        return true;
    }

    nextBreakdown() {
        while (true) {
            this.breakdownCount += 1;
            const partName = `Breakdown ${this.breakdownCount}`;
            if (this.tryTake(partName)) {
                return {
                    partName,
                    structureCode: `D${this.breakdownCount}`,
                };
            }
        }
    }
}

function buildPart(
    part: { partLabel: string; header: PartHeaderType | null; number: number },
    countByHeader: Map<PartHeaderType, number>,
    allocator: PartNameAllocator,
    lyrics: string,
): BuiltPartType {
    const { partLabel, header } = part;
    if (header !== null) {
        const { code, allowsNumbering } = PART_DEFINITIONS[header];
        const isNumbered =
            allowsNumbering &&
            ((countByHeader.get(header) ?? 0) > 1 || part.number > 1);
        // On a duplicate numbered name (two "Chorus 1" parts), slide to the
        // next free number instead of dropping to the Breakdown fallback.
        for (
            let number = part.number;
            isNumbered && number < part.number + 100;
            number += 1
        ) {
            const partName = `${header} ${number}`;
            if (allocator.tryTake(partName)) {
                return {
                    partName,
                    structureCode: `${code}${number}`,
                    lines: sanitizeLyricLines(lyrics, header === 'Breakdown'),
                    commentLabel:
                        partLabel && partLabel !== partName ? partLabel : null,
                };
            }
        }
        if (!isNumbered && allocator.tryTake(header)) {
            return {
                partName: header,
                structureCode: code,
                lines: sanitizeLyricLines(lyrics, header === 'Breakdown'),
                commentLabel:
                    partLabel && partLabel !== header ? partLabel : null,
            };
        }
    }
    const { partName, structureCode } = allocator.nextBreakdown();
    return {
        partName,
        structureCode,
        lines: sanitizeLyricLines(lyrics, true),
        commentLabel: partLabel || null,
    };
}

function genConfigFence(
    data: SongSelectLyricsType,
    structure: string,
): string[] {
    const title = sanitizeConfigValue(data.title ?? '') || 'Untitled Song';
    const artist =
        sanitizeConfigValue((data.authors ?? []).join(', ')) ||
        'Unknown Artist';
    const songNumber = sanitizeConfigValue(String(data.songNumber ?? ''));
    const copyright =
        sanitizeConfigValue(
            [
                (data.copyrights ?? []).join(' '),
                songNumber ? `CCLI Song #${songNumber}` : '',
            ]
                .filter(Boolean)
                .join(' '),
        ) || 'Unknown';
    // Key/Tempo/Time are required Config fields open-lyric cannot infer from
    // SongSelect lyrics; these are open-lyric's own plain-text-import
    // defaults.
    return [
        '```ol:Config',
        `- Title: ${title}`,
        `- Artist: ${artist}`,
        `- Copyright: ${copyright}`,
        '- Key: C',
        '- Tempo: 120bpm',
        '- Time: 4/4',
        `- Structure: ${structure}`,
        '```',
    ];
}

function genMarkdown(data: SongSelectLyricsType, parts: BuiltPartType[]) {
    const fences = parts.map((part) => {
        return [
            `\`\`\`ol:${part.partName}`,
            ...(part.commentLabel
                ? [`// ${sanitizeConfigValue(part.commentLabel)}`]
                : []),
            ...part.lines,
            '```',
        ].join('\n');
    });
    const structure = parts.map((part) => part.structureCode).join('');
    const title = sanitizeConfigValue(data.title ?? '') || 'Untitled Song';
    return [
        `# ${title}`,
        '',
        genConfigFence(data, structure).join('\n'),
        '',
        fences.join('\n\n'),
        '',
    ].join('\n');
}

export function checkOpenLyricMarkdown(markdown: string): boolean {
    const api = new EditorOpenLyricPlugin().getOpenLyricApi();
    return api.document.checkMarkdown(markdown);
}

/**
 * Maps a SongSelect lyrics payload onto open-lyric markdown. Returns null
 * when there is nothing to import (every part blank).
 *
 * Tier 1 maps each part onto its canonical open-lyric fence and is gated by
 * open-lyric's own validator; if any input still slips past the sanitizers,
 * tier 2 rebuilds every part as a free-text `Breakdown n` fence (guaranteed
 * parseable) with the original label kept as a `//` comment.
 */
export function songSelectLyricsToMarkdown(
    data: SongSelectLyricsType,
): string | null {
    const rawParts = (data.lyricParts ?? []).filter((part) => {
        return typeof part?.lyrics === 'string' && part.lyrics.trim() !== '';
    });
    if (rawParts.length === 0) {
        return null;
    }
    const typedParts = rawParts.map((part) => {
        const header =
            PART_TYPE_TO_HEADER[
                normalizePartType(String(part.partType ?? ''))
            ] ?? null;
        return {
            partLabel: String(part.partLabel ?? '').trim(),
            header,
            number: Math.max(1, Math.floor(Number(part.partTypeNumber) || 1)),
            lyrics: part.lyrics,
        };
    });
    const countByHeader = new Map<PartHeaderType, number>();
    for (const part of typedParts) {
        if (part.header !== null) {
            countByHeader.set(
                part.header,
                (countByHeader.get(part.header) ?? 0) + 1,
            );
        }
    }
    const allocator = new PartNameAllocator();
    const builtParts = typedParts
        .map((part) => {
            return buildPart(part, countByHeader, allocator, part.lyrics);
        })
        .filter((part) => part.lines.length > 0);
    if (builtParts.length === 0) {
        return null;
    }
    const markdown = genMarkdown(data, builtParts);
    if (checkOpenLyricMarkdown(markdown)) {
        return markdown;
    }
    // Guaranteed-parseable fallback: everything as free-text fences.
    const fallbackAllocator = new PartNameAllocator();
    const fallbackParts = typedParts
        .map((part) => {
            const { partName, structureCode } =
                fallbackAllocator.nextBreakdown();
            return {
                partName,
                structureCode,
                lines: sanitizeLyricLines(part.lyrics, true),
                commentLabel: part.partLabel || null,
            };
        })
        .filter((part) => part.lines.length > 0);
    if (fallbackParts.length === 0) {
        return null;
    }
    return genMarkdown(data, fallbackParts);
}
