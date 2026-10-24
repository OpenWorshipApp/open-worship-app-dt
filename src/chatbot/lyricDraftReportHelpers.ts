// The tool reports in English for both callers. The built-in answer has no
// model to translate it. Keep titles, authors, part names and source quotes
// as data, and translate the report's fixed wording at the display boundary.
import { fillWords, tran } from './chatTranHelpers';
import type { DraftReportType } from './lyricDraftHelpers';

function translateFields(fields: string) {
    return fields
        .split(', ')
        .map((field) => {
            if (field === 'key') return tran('Musical key');
            if (field === 'tempo') return tran('Tempo');
            if (field === 'time') return tran('Time signature');
            return field;
        })
        .join(', ');
}

export function translateDraftGuess(line: string): string {
    switch (line) {
        case 'there was no title in the text, so it is "Untitled"':
            return tran('there was no title in the text, so it is "Untitled"');
        case 'nobody was named as the author':
            return tran('nobody was named as the author');
        case 'the address the words came from is kept with the song, in its attachments, so whoever opens the file can see where they came from':
            return tran(
                'the address the words came from is kept with the song, in its attachments, so whoever opens the file can see where they came from',
            );
        case 'the text had no section labels, so each block of lines was read as a verse':
            return tran(
                'the text had no section labels, so each block of lines was read as a verse',
            );
        case 'a block that came round again word for word was written once and played each time it appeared -- check that is really the chorus':
            return tran(
                'a block that came round again word for word was written once and played each time it appeared -- check that is really the chorus',
            );
        case 'the sections could not be worked out, so every block was kept as free text with its own label above it -- the words are all there, and the section names may want setting by hand':
            return tran(
                'the sections could not be worked out, so every block was kept as free text with its own label above it -- the words are all there, and the section names may want setting by hand',
            );
    }
    const missing =
        /^the text gave no (.+), so the song has none set -- worth adding by hand if the band needs it$/.exec(
            line,
        );
    if (missing)
        return fillWords(
            tran('The text did not specify {fields}; add them if needed.'),
            { fields: translateFields(missing[1]) },
        );
    const refused =
        /^the (.+) the text gave is not one open-lyric has a name for, so it was left out -- worth setting by hand$/.exec(
            line,
        );
    if (refused)
        return fillWords(
            tran(
                'The supplied {fields} were not recognized and were left out; set them by hand.',
            ),
            { fields: translateFields(refused[1]) },
        );
    const heading =
        /^(\d+) lines? above the first numbered verse read as a heading, not as words to sing, and were left out$/.exec(
            line,
        );
    if (heading)
        return fillWords(
            tran(
                '{count} heading lines above the first numbered verse were left out.',
            ),
            { count: heading[1] },
        );
    const translations =
        /^(\d+) lines were in a second language under the line they translate, and were kept as translations of it$/.exec(
            line,
        );
    if (translations)
        return fillWords(
            tran(
                '{count} lines in another language were kept as translations of the lines above them.',
            ),
            { count: translations[1] },
        );
    const region =
        /^that was a page rather than plain words, so the song was taken from the part running "(.*?)" to "(.*?)"(?:, leaving out (\d+) lines of menus, chord charts and links)?( -- if that took in too much or too little, say where the song starts and ends)?$/.exec(
            line,
        );
    if (region) {
        const parts = [
            fillWords(
                tran(
                    'The song was taken from "{first}" to "{last}" on the page.',
                ),
                { first: region[1], last: region[2] },
            ),
        ];
        if (region[3])
            parts.push(
                fillWords(
                    tran(
                        '{count} lines of menus, chord charts and links were left out.',
                    ),
                    { count: region[3] },
                ),
            );
        if (region[4])
            parts.push(
                tran(
                    'If that includes too much or too little, say where the song starts and ends.',
                ),
            );
        return parts.join(' ');
    }
    const furniture =
        /^left out above the song, as the page's own buttons rather than words to sing: (.+)$/.exec(
            line,
        );
    if (furniture)
        return fillWords(tran('Page buttons left out of the song: {words}'), {
            words: furniture[1],
        });
    const credit =
        /^left out of the song, as a credit rather than words to sing: (.+)$/.exec(
            line,
        );
    if (credit)
        return fillWords(tran('Credits left out of the sung words: {words}'), {
            words: credit[1],
        });
    const free =
        /^(.+) could not be a section of its own, so it was kept as free text$/.exec(
            line,
        );
    if (free)
        return fillWords(
            tran(
                '{parts} could not form separate sections and were kept as free text.',
            ),
            { parts: free[1] },
        );
    // Retain an unfamiliar tool warning instead of silently hiding it.
    return line;
}

export function translateDraftReport(report: DraftReportType): DraftReportType {
    let song = report.song;
    if (song !== null) {
        const match = /^Song: (".*?")(?: by (.*?))?(?: — (.*))?$/.exec(song);
        if (match) {
            song = fillWords(tran('Song: {title}'), { title: match[1] });
            if (match[2])
                song +=
                    ' ' + fillWords(tran('by {author}'), { author: match[2] });
            if (match[3])
                song +=
                    ' — ' +
                    match[3]
                        .split(', ')
                        .map((fact) => {
                            if (fact.startsWith('key '))
                                return fillWords(tran('key {key}'), {
                                    key: fact.slice(4),
                                });
                            const tempo = /^(\d+)bpm$/.exec(fact);
                            return tempo
                                ? fillWords(tran('{tempo} beats/min'), {
                                      tempo: tempo[1],
                                  })
                                : fact;
                        })
                        .join(', ');
        }
    }
    const sections = report.sections?.replace(
        /^Sections \((\d+)\): (.*)$/,
        (_whole, count: string, names: string) => {
            return fillWords(tran('Sections ({count}): {sections}'), {
                count,
                sections: names.replace(
                    /\((\d+) (lines?)\)/g,
                    (_part, n: string, unit: string) => {
                        return (
                            '(' +
                            fillWords(
                                unit === 'line'
                                    ? tran('{count} line')
                                    : tran('{count} lines'),
                                { count: n },
                            ) +
                            ')'
                        );
                    },
                ),
            });
        },
    );
    const playOrder = report.playOrder?.replace(
        /^Play order: (.*)$/,
        (_whole, order: string) =>
            fillWords(tran('Play order: {order}'), { order }),
    );
    return {
        song,
        sections: sections ?? null,
        playOrder: playOrder ?? null,
        guessed: report.guessed.map(translateDraftGuess),
    };
}
