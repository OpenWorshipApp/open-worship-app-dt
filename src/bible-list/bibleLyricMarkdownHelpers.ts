// Turns a Bible passage into an Open Lyric document: one `Verse <n>` part per
// Bible verse, one line per Bible version in it. A leaf on purpose -- no app
// module, so the real open-lyric validator can check its output in a test.

export type BibleLyricVerseType = {
    // The Bible's own verse number; the part is named after it.
    number: number;
    // One line per Bible version, e.g. `16: For God so loved the world`.
    lines: string[];
};

// Verse text is free text and open-lyric's lyric lines are not: `[`/`]` open
// and close chord annotations, `|` is a bar marker, a line led by `//` is a
// comment, one led by three backticks closes the fence, and an indented line
// reads as the line above's translation. A verse is also one line.
export function sanitizeOpenLyricLine(text: string): string {
    let line = text
        .replace(/\s+/g, ' ')
        .replace(/\[/g, '(')
        .replace(/\]/g, ')')
        .replace(/\|/g, '/')
        .trim();
    if (line.startsWith('//')) {
        line = line.replace(/^\/+\s*/, '');
    }
    if (line.startsWith('```')) {
        line = line.replace(/`/g, "'");
    }
    return line;
}

export function genBibleLyricMarkdown(
    title: string,
    verses: BibleLyricVerseType[],
    // The other versions' passages; none, no Subtitle line.
    subtitle = '',
): string {
    const oneLineTitle = title.replace(/\s+/g, ' ').trim();
    const oneLineSubtitle = subtitle.replace(/\s+/g, ' ').trim();
    // A part name is declared once per document. A passage spanning enough
    // chapters to meet a verse number twice is numbered in order instead.
    const numbers = verses.map(({ number }) => number);
    const isNumberUnique = new Set(numbers).size === numbers.length;
    const parts = verses.map(({ number, lines }, index) => {
        const partNumber = isNumberUnique ? number : index + 1;
        return {
            code: `V${partNumber}`,
            name: `Verse ${partNumber}`,
            lines: lines
                .map(sanitizeOpenLyricLine)
                .filter((line) => line !== ''),
        };
    });
    const markdownLines = [
        `# ${oneLineTitle}`,
        '',
        '```ol:Config',
        `- Title: ${oneLineTitle}`,
        ...(oneLineSubtitle === '' ? [] : [`- Subtitle: ${oneLineSubtitle}`]),
        `- Structure: ${parts.map(({ code }) => code).join('')}`,
        '```',
        '',
    ];
    for (const part of parts) {
        markdownLines.push(`\`\`\`ol:${part.name}`, ...part.lines, '```', '');
    }
    return markdownLines.join('\n');
}
