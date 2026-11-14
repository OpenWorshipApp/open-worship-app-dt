import { describe, expect, it } from 'vitest';

import { BROWSER_CHECK_TEXT } from '../../tools/owa-devtools-mcp/openLyricDraft.mjs';
import {
    formatSongLookup,
    SONG_NOT_FOUND_PREFIX as LOOKUP_NOT_FOUND_PREFIX,
    SONG_YOURS_PREFIX as LOOKUP_YOURS_PREFIX,
} from '../../tools/owa-devtools-mcp/songLookup.mjs';
import {
    checkIsBrowserCheckRefusal,
    checkIsLyricPaste,
    checkIsSongFileAsk,
    checkIsSongSourceFileName,
    countWordsBesideAddresses,
    genLyricDraftActions,
    keepDraftedLyric,
    LYRIC_COPY_TOOL_NAME,
    LYRIC_CREATE_ALL_TOOL_NAME,
    LYRIC_CREATE_TOOL_NAME,
    MAX_SONGS_PER_ASK,
    readDraftedLyric,
    readDraftReport,
    readSongAddress,
    readSongAddressList,
    readSongLinkAsk,
    readSongLookupYours,
    readSongTitleArgument,
    readSongTitleAsk,
    readSongTitleNamed,
    SONG_NOT_FOUND_PREFIX,
    SONG_YOURS_PREFIX,
    takeDraftedLyric,
    takeDraftedLyricList,
    toDraftedLyricName,
    toDraftedSourceKey,
    withDraftedSource,
} from './lyricDraftHelpers';

const SONG_PAGE = 'https://example.com/hymns/amazing-grace';

describe('checkIsBrowserCheckRefusal', () => {
    it("is pinned to the drafter's own sentence", () => {
        // The renderer tests a prefix rather than importing the drafter;
        // this is what stops the two drifting apart.
        expect(checkIsBrowserCheckRefusal(BROWSER_CHECK_TEXT)).toBe(true);
        expect(
            checkIsBrowserCheckRefusal('Drafted a song from the text.'),
        ).toBe(false);
    });
});

describe('readSongLinkAsk', () => {
    it("reads the app's own starter chip", () => {
        expect(
            readSongLinkAsk(`Create a lyric file from ${SONG_PAGE}`),
        ).toEqual([SONG_PAGE]);
    });
    it('reads the address out of other shapes of the ask, punctuation off', () => {
        expect(
            readSongLinkAsk(`make a song from this page ${SONG_PAGE}.`),
        ).toEqual([SONG_PAGE]);
        expect(
            readSongLinkAsk(`${SONG_PAGE} - the lyrics are on here`),
        ).toEqual([SONG_PAGE]);
        expect(
            readSongLinkAsk(`Can you write out the hymn at ${SONG_PAGE}?`),
        ).toEqual([SONG_PAGE]);
        expect(readSongLinkAsk(`chords: (${SONG_PAGE})`)).toEqual([SONG_PAGE]);
    });
    // EC-589: two addresses had been no song link at all.
    it('several links are several songs, in order, each once', () => {
        expect(
            readSongLinkAsk(
                `Create lyric files from ${SONG_PAGE}, ${SONG_PAGE}/2 and ` +
                    `${SONG_PAGE}/3.`,
            ),
        ).toEqual([SONG_PAGE, `${SONG_PAGE}/2`, `${SONG_PAGE}/3`]);
        expect(
            readSongLinkAsk(
                `songs:\n${SONG_PAGE}\n${SONG_PAGE}/2\n${SONG_PAGE}`,
            ),
        ).toEqual([SONG_PAGE, `${SONG_PAGE}/2`]);
        // The words are counted with the links out: ten links are as short
        // an ask as one.
        const many = Array.from({ length: 10 }, (_one, index) => {
            return `${SONG_PAGE}/${index.toString()}-${'x'.repeat(40)}`;
        });
        expect(readSongLinkAsk(`songs ${many.join(' ')}`)).toHaveLength(10);
    });
    it('a bare address is not a song ask', () => {
        // As likely a YouTube link or a Bible XML file: reading a page is
        // rationed and announced, so the words have to say what it is.
        expect(readSongLinkAsk(SONG_PAGE)).toBeNull();
        expect(readSongLinkAsk(`read this for me ${SONG_PAGE}`)).toBeNull();
    });
    it('a command, notation or a long message is left alone', () => {
        expect(readSongLinkAsk(`/song ${SONG_PAGE}`)).toBeNull();
        expect(
            readSongLinkAsk(`song \`\`\`ol:Config\n${SONG_PAGE}`),
        ).toBeNull();
        const long = Array.from({ length: 45 }, () => 'word').join(' ');
        expect(readSongLinkAsk(`song ${long} ${SONG_PAGE}`)).toBeNull();
    });
    it('only https, and never a bare scheme', () => {
        expect(
            readSongLinkAsk('song http://example.com/hymns/amazing-grace'),
        ).toBeNull();
        expect(readSongAddress('song https://')).toBeNull();
    });
});

describe('readSongAddress', () => {
    it('finds the one address in a command argument', () => {
        expect(readSongAddress(`${SONG_PAGE},`)).toBe(SONG_PAGE);
        expect(
            readSongAddress('Amazing grace\nhow sweet the sound'),
        ).toBeNull();
        // The same page twice is one page; two pages are not ONE address.
        expect(readSongAddress(`${SONG_PAGE} ${SONG_PAGE}`)).toBe(SONG_PAGE);
        expect(readSongAddress(`${SONG_PAGE} ${SONG_PAGE}/2`)).toBeNull();
    });
});

describe('readSongAddressList and countWordsBesideAddresses (EC-589)', () => {
    it('every address once, in order, sentence punctuation off', () => {
        expect(
            readSongAddressList(
                `${SONG_PAGE}/2; ${SONG_PAGE}! (${SONG_PAGE}/2) https://`,
            ),
        ).toEqual([`${SONG_PAGE}/2`, SONG_PAGE]);
        expect(readSongAddressList('no link here')).toEqual([]);
    });
    it('counts the words a message says beside its links', () => {
        expect(countWordsBesideAddresses(`${SONG_PAGE} ${SONG_PAGE}/2`)).toBe(
            0,
        );
        expect(
            countWordsBesideAddresses(`songs from ${SONG_PAGE} and here`),
        ).toBe(4);
    });
});

describe('the song files of an ask (EC-589)', () => {
    it('takes word files and the decks and documents read as words', () => {
        expect(checkIsSongSourceFileName('Amazing Grace.txt')).toBe(true);
        expect(checkIsSongSourceFileName('hymn.MD')).toBe(true);
        expect(checkIsSongSourceFileName('hymn.markdown')).toBe(true);
        // A PowerPoint deck and a Word file: their words are read out.
        expect(checkIsSongSourceFileName('hymn.pptx')).toBe(true);
        expect(checkIsSongSourceFileName('hymn.DOCX')).toBe(true);
        expect(checkIsSongSourceFileName('hymn.pdf')).toBe(false);
        expect(checkIsSongSourceFileName('hymn.owl')).toBe(false);
        // The old binary kinds are no zip of words.
        expect(checkIsSongSourceFileName('hymn.doc')).toBe(false);
        expect(checkIsSongSourceFileName('hymn.ppt')).toBe(false);
    });
    it('reads a short making line with a song word as a file ask', () => {
        expect(checkIsSongFileAsk('Create lyric files from these')).toBe(true);
        expect(checkIsSongFileAsk('make songs from the attached files')).toBe(
            true,
        );
        expect(checkIsSongFileAsk('Add these hymns to my songs')).toBe(true);
    });
    it('turning or converting a file is one too (EC-590)', () => {
        expect(checkIsSongFileAsk('turn this into a lyric')).toBe(true);
        expect(checkIsSongFileAsk('Convert it to a song')).toBe(true);
        expect(checkIsSongFileAsk('turn powerpoint to lyric')).toBe(true);
        // The attached PowerPoint's own card button, in its English.
        expect(checkIsSongFileAsk('Make a song from it')).toBe(true);
        // A song word is still needed: a file turned into nothing said.
        expect(checkIsSongFileAsk('turn this into a picture')).toBe(false);
    });
    it('a question, a title, a link, a command or a paste is not one', () => {
        expect(checkIsSongFileAsk('')).toBe(false);
        expect(checkIsSongFileAsk('can you make songs from these?')).toBe(
            false,
        );
        expect(checkIsSongFileAsk('Create a song called "Amazing Grace"')).toBe(
            false,
        );
        expect(checkIsSongFileAsk(`make songs from ${SONG_PAGE}`)).toBe(false);
        expect(checkIsSongFileAsk('/lyric create songs')).toBe(false);
        expect(checkIsSongFileAsk('create songs\nfrom these')).toBe(false);
        expect(checkIsSongFileAsk('what is in these files')).toBe(false);
        const long = Array.from({ length: 20 }, () => 'song').join(' ');
        expect(checkIsSongFileAsk(`create ${long}`)).toBe(false);
    });
});

const genSong = (title: string) => {
    return `\`\`\`ol:Config\n- Title: ${title}\n- Structure: V1\n\`\`\``;
};

describe('the buttons under drafted songs (EC-589)', () => {
    it('one song: Create and Copy, as ever', () => {
        const drafted = keepDraftedLyric(genSong('Lantern'));
        expect(genLyricDraftActions([drafted])).toEqual([
            {
                label: 'Create "Lantern"',
                toolName: LYRIC_CREATE_TOOL_NAME,
                args: { reference: drafted.reference },
            },
            {
                label: 'Copy song text',
                toolName: LYRIC_COPY_TOOL_NAME,
                args: { reference: drafted.reference },
            },
        ]);
        expect(genLyricDraftActions([])).toEqual([]);
    });
    it("several: Create all first, then each one's own Create, no Copy", () => {
        const list = ['One', 'Two', 'Three'].map((title) => {
            return keepDraftedLyric(genSong(title));
        });
        const actions = genLyricDraftActions(list);
        expect(
            actions.map((one) => {
                return one.label;
            }),
        ).toEqual([
            'Create all 3 songs',
            'Create "One"',
            'Create "Two"',
            'Create "Three"',
        ]);
        expect(actions[0]).toEqual({
            label: 'Create all 3 songs',
            toolName: LYRIC_CREATE_ALL_TOOL_NAME,
            args: {
                references: list.map((one) => {
                    return one.reference;
                }),
            },
        });
    });
    it('holds two asks of songs and lets older ones go', () => {
        const kept = Array.from(
            { length: MAX_SONGS_PER_ASK * 2 + 1 },
            (_one, index) => {
                return keepDraftedLyric(genSong(`Song ${index.toString()}`));
            },
        );
        expect(takeDraftedLyric(kept[0].reference)).toBeNull();
        expect(takeDraftedLyric(kept[1].reference)?.name).toBe('Song 1');
        const taken = takeDraftedLyricList([
            kept[0].reference,
            kept[8].reference,
            42,
            kept[2].reference,
        ]);
        expect(
            taken.heldList.map((one) => {
                return one.name;
            }),
        ).toEqual(['Song 8', 'Song 2']);
        expect(taken.goneCount).toBe(2);
        expect(takeDraftedLyricList('not a list')).toEqual({
            heldList: [],
            goneCount: 0,
        });
    });
});

describe('the drafts a model made, one per source (EC-589)', () => {
    it('keys a page by its address and words by their title', () => {
        expect(toDraftedSourceKey(genSong('A'), ` ${SONG_PAGE} `)).toBe(
            `url:${SONG_PAGE}`,
        );
        expect(toDraftedSourceKey(genSong('Amazing Grace'), undefined)).toBe(
            'title:amazing grace',
        );
        expect(toDraftedSourceKey(genSong('B'), '')).toBe('title:b');
    });
    it('replaces the same source where it stood and adds a new one last', () => {
        let list = withDraftedSource([], { key: 'a', content: '1' });
        list = withDraftedSource(list, { key: 'b', content: '2' });
        list = withDraftedSource(list, { key: 'a', content: '3' });
        expect(list).toEqual([
            { key: 'a', content: '3' },
            { key: 'b', content: '2' },
        ]);
        for (const key of ['c', 'd', 'e']) {
            list = withDraftedSource(list, { key, content: key });
        }
        expect(
            list.map((one) => {
                return one.key;
            }),
        ).toEqual(['a', 'b', 'c', 'd']);
    });
});

const AMAZING_GRACE = [
    'Amazing Grace',
    '',
    'Verse 1',
    'Amazing grace! how sweet the sound,',
    'That saved a wretch like me!',
    'I once was lost, but now am found,',
    'Was blind, but now I see.',
    '',
    'Chorus',
    'My chains are gone, I have been set free',
    'My God, my Savior has ransomed me',
].join('\n');

describe('checkIsLyricPaste', () => {
    it('reads a labelled paste as the words of a song', () => {
        expect(checkIsLyricPaste(AMAZING_GRACE)).toBe(true);
    });
    it('reads four short unlabelled lines as a song', () => {
        expect(
            checkIsLyricPaste(
                [
                    'Amazing grace how sweet the sound',
                    'that saved a wretch like me',
                    'I once was lost but now am found',
                    'was blind but now I see',
                ].join('\n'),
            ),
        ).toBe(true);
    });
    it('reads numbered stanzas as a song', () => {
        expect(
            checkIsLyricPaste(
                [
                    '1 Amazing grace how sweet the sound',
                    'that saved a wretch like me',
                    '2 Twas grace that taught my heart to fear',
                    'and grace my fears relieved',
                ].join('\n'),
            ),
        ).toBe(true);
    });
    it.each([
        'How do I present a Bible verse?',
        '/screen-show',
        'Can you make a song from words I paste in?',
        // Three lines is a note, not a song.
        'Amazing grace\nhow sweet the sound\nthat saved a wretch like me',
        // A pasted passage of prose: long lines.
        [
            'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
            'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
            'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.',
            'And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil.',
        ].join('\n'),
        // Already notation: the drafter refuses it and says so.
        '```ol:Config\n- Title: x\n```\n```ol:Verse 1\nla\nla\nla\n```',
    ])('does not read %j as a song', (text) => {
        expect(checkIsLyricPaste(text)).toBe(false);
    });
});

const DRAFT_RESULT = [
    'Drafted a song from the text.',
    '',
    'Valid Open Lyric. No problems found.',
    '',
    'Song: "Amazing Grace"',
    'Sections (2): Verse 1 (4 lines), Chorus (2 lines)',
    'Play order: Verse 1 → Chorus',
    '',
    'Guessed, and worth telling them:',
    '- the text gave no key, tempo, time, so the song has none set -- worth adding by hand if the band needs it',
    '- nobody is named as the artist',
    '',
    'The song itself is below. Do NOT paste it into your answer -- the buttons under your answer create the file and copy the text.',
    '# Amazing Grace',
    '',
    '```ol:Config',
    '- Title: Amazing Grace',
    '- Structure: V1',
    '```',
    '',
    '```ol:Verse 1',
    'Amazing grace! how sweet the sound,',
    '```',
].join('\n');

describe('readDraftReport', () => {
    it('lifts the lines a person is told, in the drafter’s own words', () => {
        const report = readDraftReport(DRAFT_RESULT);
        expect(report.song).toBe('Song: "Amazing Grace"');
        expect(report.sections).toBe(
            'Sections (2): Verse 1 (4 lines), Chorus (2 lines)',
        );
        expect(report.playOrder).toBe('Play order: Verse 1 → Chorus');
        expect(report.guessed).toEqual([
            'the text gave no key, tempo, time, so the song has none set -- worth adding by hand if the band needs it',
            'nobody is named as the artist',
        ]);
    });
    it('reads nothing off a refusal', () => {
        const report = readDraftReport('That is not a song.');
        expect(report.song).toBeNull();
        expect(report.guessed).toEqual([]);
    });
    it('never reads a bullet out of the song itself', () => {
        // `- Title:` inside the Config fence is a bullet too.
        const report = readDraftReport(
            DRAFT_RESULT.replace(
                'Guessed, and worth telling them:\n- the text gave no key, tempo, time, so the song has none set -- worth adding by hand if the band needs it\n- nobody is named as the artist\n\n',
                '',
            ),
        );
        expect(report.guessed).toEqual([]);
    });
});

describe('readDraftedLyric and the file name', () => {
    it('lifts the document and names the file after its title', () => {
        const content = readDraftedLyric(DRAFT_RESULT);
        expect(content?.startsWith('```ol:Config')).toBe(true);
        expect(toDraftedLyricName(content ?? '')).toBe('Amazing Grace');
    });
});

describe('readSongTitleAsk', () => {
    it("reads the app's own starter chip", () => {
        expect(
            readSongTitleAsk('Create a lyric file for song "Amazing Grace"'),
        ).toBe('Amazing Grace');
    });

    it('reads the ask in the shapes people type it', () => {
        expect(
            readSongTitleAsk('Create a lyric file from "Amazing Grace"'),
        ).toBe('Amazing Grace');
        expect(readSongTitleAsk('make a song called “Be Thou My Vision”')).toBe(
            'Be Thou My Vision',
        );
        expect(
            readSongTitleAsk('Create a lyric file for song Amazing Grace'),
        ).toBe('Amazing Grace');
        expect(
            readSongTitleAsk('add the lyrics of It Is Well with My Soul.'),
        ).toBe('It Is Well with My Soul');
    });

    it('leaves alone what names no song', () => {
        expect(
            readSongTitleAsk('Can you make a song from words I paste in?'),
        ).toBe(null);
        expect(readSongTitleAsk('make a song from words I paste in')).toBe(
            null,
        );
        expect(readSongTitleAsk('Create a lyric file from this')).toBe(null);
        expect(readSongTitleAsk('How do I make a new song?')).toBe(null);
        expect(readSongTitleAsk(`Create a lyric file from ${SONG_PAGE}`)).toBe(
            null,
        );
        expect(readSongTitleAsk('/lyric Amazing Grace')).toBe(null);
        // A quoted phrase with no song word and no making verb.
        expect(readSongTitleAsk('What does "Clear All" do')).toBe(null);
    });
});

describe('readSongTitleArgument', () => {
    it('takes one short line as a title, quotes off', () => {
        expect(readSongTitleArgument('Amazing Grace')).toBe('Amazing Grace');
        expect(readSongTitleArgument('"Amazing Grace"')).toBe('Amazing Grace');
    });

    it('leaves addresses and pasted verses to the other paths', () => {
        expect(readSongTitleArgument(SONG_PAGE)).toBe(null);
        expect(readSongTitleArgument('line one\nline two')).toBe(null);
        expect(readSongTitleArgument('')).toBe(null);
    });
});

describe('the song lookup prefixes', () => {
    it("are pinned to the lookup's own words", () => {
        expect(SONG_NOT_FOUND_PREFIX).toBe(LOOKUP_NOT_FOUND_PREFIX);
        expect(SONG_YOURS_PREFIX).toBe(LOOKUP_YOURS_PREFIX);
    });

    it("reads the user's own songs off a lookup", () => {
        const raw = formatSongLookup({
            asked: 'Way Maker',
            yours: ['Way Maker', 'Way Maker (acoustic)'],
            found: null,
            nearest: [],
            collectionSize: 36,
        });
        expect(readSongLookupYours(raw)).toEqual([
            'Way Maker',
            'Way Maker (acoustic)',
        ]);
        expect(readSongLookupYours('Drafted a song from the text.')).toEqual(
            [],
        );
    });
});

describe('readSongTitleNamed (EC-517)', () => {
    it('reads the title named before the words', () => {
        expect(
            readSongTitleNamed(
                'Create a song called Morning Praise with these words: ' +
                    'Verse 1: We lift our eyes, Chorus: Holy, holy.',
            ),
        ).toBe('Morning Praise');
        expect(
            readSongTitleNamed(
                'Make a new hymn titled "Grace: Again" from these lines',
            ),
        ).toBe('Grace: Again');
        expect(
            readSongTitleNamed(
                'Write a lyric file named Hope Rising:\nVerse 1',
            ),
        ).toBe('Hope Rising');
        expect(
            readSongTitleNamed('Make a song called It Is Well with My Soul'),
        ).toBe('It Is Well with My Soul');
        expect(
            readSongTitleNamed(
                'Create a song for Sunday called Light in the Dark using these words',
            ),
        ).toBe('Light in the Dark');
    });

    it('names nothing without a song word before it, or from a lyric', () => {
        for (const text of [
            'Create a slide called Welcome',
            'Verse 1: a name named above all, Chorus: holy',
            'Make a song with these words: a love called grace',
            'Create a song called these words',
            '/lyric called Hope',
            '',
        ]) {
            expect(readSongTitleNamed(text)).toBeNull();
        }
    });
});
