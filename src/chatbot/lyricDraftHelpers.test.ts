import { describe, expect, it } from 'vitest';

import {
    checkIsLyricPaste,
    readDraftedLyric,
    readDraftReport,
    toDraftedLyricName,
} from './lyricDraftHelpers';

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
    'Song: "Amazing Grace" by Unknown Artist — key C, 120bpm, 4/4',
    'Sections (2): Verse 1 (4 lines), Chorus (2 lines)',
    'Play order: Verse 1 → Chorus',
    '',
    'Guessed, and worth telling them:',
    '- the text gave no key, tempo, time -- used C, 120bpm, 4/4',
    '- nobody is named as the artist',
    '',
    'The song itself is below. Do NOT paste it into your answer -- the buttons under your answer create the file and copy the text.',
    '# Amazing Grace',
    '',
    '```ol:Config',
    '- Title: Amazing Grace',
    '- Artist: Unknown Artist',
    '```',
    '',
    '```ol:Verse 1',
    'Amazing grace! how sweet the sound,',
    '```',
].join('\n');

describe('readDraftReport', () => {
    it('lifts the lines a person is told, in the drafter’s own words', () => {
        const report = readDraftReport(DRAFT_RESULT);
        expect(report.song).toBe(
            'Song: "Amazing Grace" by Unknown Artist — key C, 120bpm, 4/4',
        );
        expect(report.sections).toBe(
            'Sections (2): Verse 1 (4 lines), Chorus (2 lines)',
        );
        expect(report.playOrder).toBe('Play order: Verse 1 → Chorus');
        expect(report.guessed).toEqual([
            'the text gave no key, tempo, time -- used C, 120bpm, 4/4',
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
                'Guessed, and worth telling them:\n- the text gave no key, tempo, time -- used C, 120bpm, 4/4\n- nobody is named as the artist\n\n',
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
