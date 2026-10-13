// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getContent: vi.fn(async (): Promise<string> => ''),
    handleError: vi.fn(),
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: () => {
            return { getContent: mocks.getContent };
        },
    },
}));

// monaco-editor's clipboard contrib (pulled in by open-lyric) probes these at
// module-eval time and jsdom implements neither -- so the module under test,
// which imports open-lyric, is imported dynamically after the patch.
(document as any).queryCommandSupported ??= () => false;
(document as any).execCommand ??= () => false;
// Loaded HERE, before any test: the reader imports open-lyric the first time
// it is called, and that import is several seconds of monaco on its own. Left
// to the first test it is charged to that test's timeout -- which a full-suite
// run, with every worker busy, then fails on.
await import('open-lyric');
const {
    parseLyricLongText,
    readLyricLongText,
    resolveLongTextLanguage,
    toSingAlongText,
} = await import('./foregroundLongTextLyricHelpers');

// The REAL open-lyric reads this: what a part's plain text holds is the
// library's to decide, and a reader written against a guess of it would put
// chords, bars or an error sentence on a projector.
function genSong(structure: string) {
    return [
        '```ol:Config',
        '- Title: Amazing Grace',
        `- Structure: ${structure}`,
        '```',
        '',
        '```ol:Intro',
        '{c: Piano + Pads }',
        '| G | C | G | D |',
        '```',
        '',
        '```ol:Verse 1',
        '// sing softly',
        '|[G]Amazing grace how |[C]sweet the sound',
        '\tព្រះគុណដ៏អស្ចារ្យ',
        'That saved a wretch like me',
        '```',
        '',
        '```ol:Chorus',
        '[G]My chains are gone',
        "[C]I've been set free",
        '```',
        '',
        '```ol:Verse 2',
        'Twas grace that taught',
        '```',
        '',
        '```ol:Outro',
        '{p: #1}',
        '| G | C |',
        'Sung outro | words here',
        '```',
    ].join('\n');
}

describe('a part as words to sing', () => {
    test('loses its directives and bar marks, and the lines that held nothing else', () => {
        expect(
            toSingAlongText(
                '{c: Piano + Pads }\r\n||: Holy | are You :||\n\n  spaced   out  \n{p: #2} still sung',
            ),
        ).toBe('Holy are You\nspaced out\nstill sung');
        expect(toSingAlongText('{c: Strings}')).toBe('');
        expect(toSingAlongText('')).toBe('');
    });
});

describe('a lyric file as a long text', () => {
    test('gives the parts in sung order, a repeat once per time it is sung', async () => {
        const result = await parseLyricLongText(genSong('IV1Cx2V2CO'));
        if ('problem' in result) {
            throw new Error(`unexpected problem: ${result.problem.kind}`);
        }
        expect(result.title).toBe('Amazing Grace');
        expect(result.sections.map(({ partName }) => partName)).toEqual([
            'Intro',
            'Verse 1',
            'Chorus',
            'Chorus',
            'Verse 2',
            'Chorus',
            'Outro',
        ]);
        const [intro, verse1, chorus, chorusAgain, , , outro] = result.sections;
        // Chords only, under a cue: nothing to sing.
        expect(intro.text).toBe('');
        // No chord, no bar mark, no `//` note -- and the translation line
        // under the first line comes with it (open-lyric gives a file's
        // languages no way to be told apart).
        expect(verse1.text).toBe(
            'Amazing grace how sweet the sound\n' +
                'ព្រះគុណដ៏អស្ចារ្យ\n' +
                'That saved a wretch like me',
        );
        expect(chorus.text).toBe("My chains are gone\nI've been set free");
        expect(chorusAgain.text).toBe(chorus.text);
        // The strumming pattern and the progression line are gone; the sung
        // line stays, without the bar that was drawn through it.
        expect(outro.text).toBe('Sung outro words here');
    });

    test('never touches the page: no stylesheet of the preview is injected', async () => {
        const countStyles = () => {
            return document.querySelectorAll('style').length;
        };
        const before = countStyles();
        await parseLyricLongText(genSong('V1C'));
        expect(countStyles()).toBe(before);
        expect(
            document.querySelector('#open-lyric-preview-component-styles'),
        ).toBeNull();
    });

    test('a Structure naming a part the song does not have is a problem, not a line', async () => {
        expect(await parseLyricLongText(genSong('V1B1C'))).toEqual({
            problem: { kind: 'missing-part', partName: 'Bridge 1' },
        });
    });

    test('what is not a song is said to be invalid', async () => {
        expect(await parseLyricLongText('just some words')).toEqual({
            problem: { kind: 'invalid' },
        });
    });

    test('reads a file by its content, and says which way it could not', async () => {
        expect(await readLyricLongText('')).toEqual({
            problem: { kind: 'no-file' },
        });
        expect(mocks.getContent).not.toHaveBeenCalled();

        // A file that is gone reads as nothing.
        mocks.getContent.mockResolvedValueOnce('');
        expect(await readLyricLongText('/docs/gone.owl')).toEqual({
            problem: { kind: 'missing' },
        });
        mocks.getContent.mockRejectedValueOnce(new Error('unreadable'));
        expect(await readLyricLongText('/docs/broken.owl')).toEqual({
            problem: { kind: 'missing' },
        });
        expect(mocks.handleError).toHaveBeenCalledTimes(1);

        mocks.getContent.mockResolvedValueOnce(genSong('V1C'));
        const result = await readLyricLongText('/docs/grace.owl');
        expect('problem' in result).toBe(false);
    });

    test('resolves a language from whichever source it is set to', async () => {
        const language = {
            langCode: 'en',
            source: 'raw' as const,
            title: 'Typed title',
            sections: ['one', 'two'],
            lyricFilePath: '/docs/grace.owl',
        };
        // Typed text is taken as typed, and no file is read for it.
        mocks.getContent.mockClear();
        expect(await resolveLongTextLanguage(language)).toEqual({
            langCode: 'en',
            source: 'raw',
            title: 'Typed title',
            sections: [{ text: 'one' }, { text: 'two' }],
        });
        expect(mocks.getContent).not.toHaveBeenCalled();

        mocks.getContent.mockResolvedValueOnce(genSong('V2C'));
        expect(
            await resolveLongTextLanguage({ ...language, source: 'lyric' }),
        ).toEqual({
            langCode: 'en',
            source: 'lyric',
            title: 'Amazing Grace',
            sections: [
                { partName: 'Verse 2', text: 'Twas grace that taught' },
                {
                    partName: 'Chorus',
                    text: "My chains are gone\nI've been set free",
                },
            ],
        });

        mocks.getContent.mockResolvedValueOnce(genSong('V1B1'));
        expect(
            await resolveLongTextLanguage({ ...language, source: 'lyric' }),
        ).toEqual({
            langCode: 'en',
            source: 'lyric',
            title: '',
            sections: [],
            readProblem: { kind: 'missing-part', partName: 'Bridge 1' },
        });
    });
});
