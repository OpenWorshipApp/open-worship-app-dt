import { describe, expect, it } from 'vitest';

import {
    checkIsAgentSlideBackgroundAction,
    describeAttachedBackground,
    findBackgroundCandidates,
    findBackgroundFileName,
    genSlideBackgroundSummary,
    readAgentSlideBackgroundRequest,
    toSlideIdList,
} from './agentSlideBackgroundRules';

describe('reading a set-background request', () => {
    it('takes a fill, a name or none, for some slides or all', () => {
        expect(checkIsAgentSlideBackgroundAction('set-background')).toBe(true);
        expect(checkIsAgentSlideBackgroundAction('update-slides')).toBe(false);
        expect(
            readAgentSlideBackgroundRequest({ background: ' #1A2B3C ' }),
        ).toEqual({
            wanted: { kind: 'fill', src: '#1A2B3C' },
            slides: null,
        });
        expect(
            readAgentSlideBackgroundRequest({
                background: '#1a2b3c80',
                slides: [2, 1, 2],
            }),
        ).toEqual({
            wanted: { kind: 'fill', src: '#1A2B3C80' },
            slides: [2, 1],
        });
        // A gradient or a pattern as the Fills tab writes one, in its one
        // form whichever way it came.
        expect(
            readAgentSlideBackgroundRequest({
                background: 'gradient?colors=1e3a8a-581c87&angle=135',
            }),
        ).toEqual({
            wanted: {
                kind: 'fill',
                src: 'gradient?shape=linear&angle=135&colors=1E3A8A-581C87',
            },
            slides: null,
        });
        expect(
            readAgentSlideBackgroundRequest({
                background: 'pattern?name=dots&base=172554&ink=FFFFFF26',
            }),
        ).toMatchObject({
            wanted: {
                kind: 'fill',
                src: 'pattern?name=dots&base=172554&ink=FFFFFF26&size=32',
            },
        });
        expect(readAgentSlideBackgroundRequest({ background: 'None' })).toEqual(
            { wanted: { kind: 'none' }, slides: null },
        );
        expect(
            readAgentSlideBackgroundRequest({ background: 'sunrise.jpg' }),
        ).toEqual({
            wanted: { kind: 'file', name: 'sunrise.jpg' },
            slides: null,
        });
    });

    it('refuses what cannot be a background or a slide list', () => {
        for (const request of [
            {},
            { background: '   ' },
            { background: 7 },
            { background: '#12345' },
            { background: 'x'.repeat(201) },
            { background: 'none', slides: [] },
            { background: 'none', slides: [0] },
            { background: 'none', slides: [1.5] },
            { background: 'none', slides: '1' },
            {
                background: 'none',
                slides: Array.from({ length: 101 }, (_one, i) => {
                    return i + 1;
                }),
            },
        ]) {
            expect(readAgentSlideBackgroundRequest(request)).toMatchObject({
                isError: true,
            });
        }
        expect(
            readAgentSlideBackgroundRequest({ background: '#12345' }),
        ).toMatchObject({ reason: expect.stringMatching(/#RRGGBB/) });
    });
});

describe('finding a background by its name', () => {
    const names = ['Sunrise.JPG', 'hills.png', 'hills.webp', 'waves.mp4'];

    it('matches the full name, else a stem only one file has', () => {
        expect(findBackgroundFileName(names, 'sunrise.jpg')).toBe(
            'Sunrise.JPG',
        );
        expect(findBackgroundFileName(names, 'SUNRISE')).toBe('Sunrise.JPG');
        expect(findBackgroundFileName(names, 'waves')).toBe('waves.mp4');
        // Two files share the stem: a guess would be a coin toss.
        expect(findBackgroundFileName(names, 'hills')).toBe(null);
        expect(findBackgroundFileName(names, 'hills.webp')).toBe('hills.webp');
        expect(findBackgroundFileName(names, 'forest')).toBe(null);
    });
});

describe('finding backgrounds by a word of their name', () => {
    const names = [
        'wp_mountain_reflection.jpg',
        'wp_beach_sunrise.jpg',
        'wp_easter_sunrise_cross.jpg',
        'Cross with Grass and Sunrise Background.mp4',
    ];

    it('keeps every name holding all the words asked', () => {
        expect(findBackgroundCandidates(names, 'mountain')).toEqual([
            'wp_mountain_reflection.jpg',
        ]);
        expect(findBackgroundCandidates(names, 'Sunrise')).toHaveLength(3);
        expect(findBackgroundCandidates(names, 'sunrise cross')).toEqual([
            'wp_easter_sunrise_cross.jpg',
            'Cross with Grass and Sunrise Background.mp4',
        ]);
        expect(findBackgroundCandidates(names, 'beach_sunrise')).toEqual([
            'wp_beach_sunrise.jpg',
        ]);
        // Words too short to tell anything apart find nothing.
        expect(findBackgroundCandidates(names, 'wp a')).toEqual([]);
        expect(findBackgroundCandidates(names, 'forest')).toEqual([]);
    });
});

describe('slide numbers to the ids the sidecar keys', () => {
    it('maps them, and refuses a slide that is not there', () => {
        const slides = [{ id: 11 }, { id: 'b' }, {}];
        expect(toSlideIdList(slides, [2, 1], 'Talk')).toEqual(['b', 11]);
        expect(toSlideIdList(slides, [4, 5], 'Talk')).toMatchObject({
            isError: true,
            reason: expect.stringMatching(/has 3 slides.*no slide 4, 5/),
        });
        expect(toSlideIdList(slides, [3], 'Talk')).toMatchObject({
            reason: expect.stringMatching(/Slide 3 .* no id/),
        });
    });
});

describe('saying what a background is', () => {
    it('names its kind and its file', () => {
        expect(describeAttachedBackground(null)).toBe(null);
        expect(describeAttachedBackground(undefined)).toBe(null);
        expect(
            describeAttachedBackground({ type: 'bg-fill', item: '#000000' }),
        ).toBe('colour #000000');
        // Saved before the Fills tab had its name.
        expect(
            describeAttachedBackground({ type: 'bg-color', item: '#abc' }),
        ).toBe('colour #AABBCC');
        expect(
            describeAttachedBackground({
                type: 'bg-fill',
                item: 'gradient?shape=linear&angle=135&colors=1E3A8A-581C87',
            }),
        ).toBe('linear 135° gradient #1E3A8A → #581C87');
        expect(
            describeAttachedBackground({
                type: 'bg-fill',
                item: 'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow',
            }),
        ).toBe('grid pattern, #FFFFFF1A on #18181B, 32px tiles, moving slow');
        expect(
            describeAttachedBackground({ type: 'bg-fill', item: 'url(x)' }),
        ).toBe('fill');
        expect(
            describeAttachedBackground({
                type: 'bg-animation',
                item: 'css?name=snow&colors=052E16-FFFFFF&speed=slow&density=high',
            }),
        ).toBe(
            'snowfall CSS animation, #052E16 → #FFFFFF, slow speed, high density',
        );
        expect(
            describeAttachedBackground({
                type: 'bg-animation',
                item: 'css?name=snow',
            }),
        ).toBe('animation');
        expect(
            describeAttachedBackground({
                type: 'bg-image',
                item: 'C:\\bg\\sunrise.jpg',
            }),
        ).toBe('picture sunrise.jpg');
        expect(
            describeAttachedBackground({
                type: 'bg-video',
                item: { fullName: 'waves.mp4' },
            }),
        ).toBe('video waves.mp4');
        expect(
            describeAttachedBackground({ type: 'bg-camera', item: {} }),
        ).toBe('camera');
        expect(describeAttachedBackground({ type: 'other' })).toBe(
            'background',
        );
    });

    it('says where it went in the change line', () => {
        expect(genSlideBackgroundSummary('Talk', 'colour #000000', null)).toBe(
            'Put the colour #000000 behind every slide of “Talk”',
        );
        expect(genSlideBackgroundSummary('Talk', 'picture a.jpg', [2])).toBe(
            'Put the picture a.jpg behind slide 2 of “Talk”',
        );
        expect(genSlideBackgroundSummary('Talk', null, [1, 2])).toBe(
            'Took the background off 2 slides of “Talk”',
        );
    });
});
