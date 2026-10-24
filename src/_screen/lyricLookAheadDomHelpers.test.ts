// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The md5 is the preload's; any one-to-one stand-in tells two items apart.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { generateMD5: (text: string) => `md5(${text})` },
    },
}));

import {
    genLookAheadItemsList,
    genLookAheadLayout,
    genPreviousNextLayout,
    genRowArrangement,
    type LookAheadArrangementType,
    PREVIOUS_NEXT_ARRANGEMENT,
} from '../lyric-list/lyricLookAheadHelpers';
import {
    moveLyricLookAhead,
    registerLyricLookAhead,
} from './lyricLookAheadDomHelpers';
import { STAGE_MOVE_MILLISECOND } from './stageMoveHelpers';

const WIDTH = 1920;
const HEIGHT = 1080;
const BOUNDS = { x: 0, y: 0, width: WIDTH, height: HEIGHT };

function genItem(type: string, html?: string) {
    return {
        id: 0,
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        rotate: 0,
        type,
        ...(html === undefined ? {} : { html }),
    } as any;
}

function genVerse(text: string) {
    return [genItem('html', `<p>${text}</p>`)];
}

// A song's stage slides, as `LyricAppDocumentStageLookAhead` lays them out.
function genSlides(
    deck: any[][],
    arrangement: LookAheadArrangementType = genRowArrangement([1]),
): any[][] {
    return genLookAheadItemsList(deck, BOUNDS, arrangement, (box, html) => {
        return {
            ...genItem('html', html),
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
        };
    });
}

// What `genSlideHtml` makes of canvas items: a box per item, in their order,
// with the item's own markup one element down.
const build = vi.fn((items: any[]) => {
    const content = document.createElement('div');
    for (const item of items) {
        const node = document.createElement('div');
        Object.assign(node.style, {
            position: 'absolute',
            left: `${item.left}px`,
            top: `${item.top}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
        });
        const body = document.createElement('div');
        if (item.type === 'html') {
            body.innerHTML = item.html;
        } else {
            body.appendChild(
                document.createElement(item.type === 'image' ? 'img' : 'video'),
            );
        }
        node.appendChild(body);
        content.appendChild(node);
    }
    return content;
});

// `items` drawn and on screen, taken in for the next slide to move from.
function genRoot(items: any[]) {
    const root = build(items);
    document.body.appendChild(root);
    expect(registerLyricLookAhead(root, items, WIDTH, HEIGHT)).toBe(true);
    build.mockClear();
    return root;
}

function move(root: HTMLElement, items: any[]) {
    return moveLyricLookAhead(root, items, WIDTH, HEIGHT, build);
}

// The drawn item holding the verse `text`.
function findNode(root: HTMLElement, text: string) {
    return (Array.from(root.children).find((node) => {
        return node.querySelector('p')?.textContent === text;
    }) ?? null) as HTMLElement | null;
}

function toFrames(root: HTMLElement) {
    return Array.from(root.children).filter((node) => {
        return node.querySelector('.lyric-look-ahead-frame') !== null;
    });
}

function getScale(node: HTMLElement) {
    return node.querySelector<HTMLElement>('.lyric-look-ahead-box > div')!.style
        .transform;
}

describe('moveLyricLookAhead', () => {
    const layout = genLookAheadLayout(BOUNDS, 1);
    const slides = genSlides([
        genVerse('Verse 1'),
        genVerse('Chorus'),
        genVerse('Verse 2'),
    ]);

    beforeEach(() => {
        build.mockClear();
        vi.useFakeTimers();
        document.body.replaceChildren();
    });

    test('the coming verse becomes the current one by a change of style alone', () => {
        const root = genRoot(slides[0]);
        const coming = findNode(root, 'Chorus')!;
        const verse = coming.querySelector('p');
        expect(coming.style.top).toBe(`${layout.sideList[0].y}px`);
        expect(getScale(coming)).toBe(`scale(${layout.sideScale})`);
        expect(coming.style.transition).toContain('all');

        expect(move(root, slides[1])).toBe(true);

        // The very same elements, now where the verse being sung sits.
        expect(findNode(root, 'Chorus')).toBe(coming);
        expect(coming.querySelector('p')).toBe(verse);
        expect(coming.style.top).toBe('0px');
        expect(coming.style.width).toBe(`${layout.current.width}px`);
        expect(getScale(coming)).toBe(`scale(${layout.currentScale})`);
        // Nothing was drawn for it.
        expect(build).not.toHaveBeenCalled();
    });

    test('what leaves is gone before the move, what comes is added after it', () => {
        const root = genRoot(slides[0]);
        const frames = toFrames(root);
        expect(frames).toHaveLength(2);

        expect(move(root, slides[1])).toBe(true);

        // Verse 1 left at once; Verse 2 is not there yet.
        expect(findNode(root, 'Verse 1')).toBeNull();
        expect(findNode(root, 'Verse 2')).toBeNull();

        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);

        // Only the verse that was not on screen was drawn, and it went in
        // under the frames, which never left.
        expect(build).toHaveBeenCalledTimes(1);
        expect(build.mock.calls[0][0]).toHaveLength(1);
        const coming = findNode(root, 'Verse 2')!;
        expect(coming.style.top).toBe(`${layout.sideList[0].y}px`);
        expect(toFrames(root)).toEqual(frames);
        const nodes = Array.from(root.children);
        expect(nodes.indexOf(coming)).toBeLessThan(nodes.indexOf(frames[0]));
        expect(nodes).toHaveLength(4);
    });

    // What an item is told from another by, on the element itself.
    test('every item carries the md5 of what it draws as its id', () => {
        const root = genRoot(slides[0]);
        const toIds = () => {
            return Array.from(root.children).map((node) => {
                return (node as HTMLElement).dataset.renderId;
            });
        };
        const ids = toIds();
        expect(ids.every((id) => id?.startsWith('md5('))).toBe(true);
        // Two verses, each its own; two frames, drawn the same.
        expect(new Set(ids).size).toBe(3);
        const comingId = findNode(root, 'Chorus')!.dataset.renderId;

        move(root, slides[1]);
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);

        // Where a verse is and how big is its style, never its id.
        expect(findNode(root, 'Chorus')!.dataset.renderId).toBe(comingId);
        expect(toIds().every((id) => id?.startsWith('md5('))).toBe(true);
        expect(toIds()).not.toContain(ids[0]);
    });

    test('a second press before the move is over still moves the verse', () => {
        const root = genRoot(slides[0]);
        move(root, slides[1]);

        // Verse 2 is due but not added yet -- and it is the one that moves now.
        expect(move(root, slides[2])).toBe(true);

        expect(findNode(root, 'Chorus')).toBeNull();
        expect(findNode(root, 'Verse 2')!.style.top).toBe('0px');
        // The last slide has no coming verse, and so one frame.
        expect(toFrames(root)).toHaveLength(1);
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);
        expect(root.children).toHaveLength(2);
    });

    test('a verse edited since is drawn again', () => {
        const root = genRoot(slides[0]);
        const coming = findNode(root, 'Chorus')!;
        const edited = genSlides([
            genVerse('Verse 1'),
            genVerse('Chorus, edited'),
            genVerse('Verse 2'),
        ]);

        expect(move(root, edited[1])).toBe(true);

        // Nothing had anywhere to go, so there was nothing to wait for.
        expect(coming.isConnected).toBe(false);
        expect(findNode(root, 'Chorus, edited')!.style.top).toBe('0px');
        expect(findNode(root, 'Verse 2')).not.toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('going back, the verse being sung shrinks into the coming box', () => {
        const root = genRoot(slides[1]);
        const current = findNode(root, 'Chorus')!;

        expect(move(root, slides[0])).toBe(true);

        expect(findNode(root, 'Chorus')).toBe(current);
        expect(current.style.top).toBe(`${layout.sideList[0].y}px`);
        expect(getScale(current)).toBe(`scale(${layout.sideScale})`);
        expect(findNode(root, 'Verse 2')).toBeNull();
        expect(findNode(root, 'Verse 1')).toBeNull();
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);
        const previous = findNode(root, 'Verse 1')!;
        expect(previous.style.top).toBe('0px');
        const nodes = Array.from(root.children);
        expect(nodes.indexOf(previous)).toBeLessThan(
            nodes.indexOf(toFrames(root)[0]),
        );
    });

    // Two things drawn the same share an id; the one already where it is
    // wanted stays there.
    test('a chorus sung twice running is not swapped with itself', () => {
        const repeated = genSlides([
            genVerse('Chorus'),
            genVerse('Chorus'),
            genVerse('Verse 2'),
        ]);
        const root = genRoot(repeated[0]);
        const [current, coming] = Array.from(root.children) as HTMLElement[];

        expect(move(root, repeated[1])).toBe(true);

        expect(current.isConnected).toBe(true);
        expect(current.style.top).toBe('0px');
        expect(coming.isConnected).toBe(false);
        expect(findNode(root, 'Verse 2')).not.toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('previous and next: the verse sung goes to the previous box as the next one comes up', () => {
        const stageLayout = genPreviousNextLayout(BOUNDS);
        const [previousBox] = stageLayout.sideList;
        // The song's First slide is a picture of the whole song.
        const stageSlides = genSlides(
            [
                [genItem('image')],
                genVerse('Verse 1'),
                genVerse('Chorus'),
                genVerse('Verse 2'),
            ],
            PREVIOUS_NEXT_ARRANGEMENT,
        );
        const root = genRoot(stageSlides[0]);
        const picture = root.firstElementChild as HTMLElement;
        const verse = findNode(root, 'Verse 1')!;

        expect(move(root, stageSlides[1])).toBe(true);

        // Both stay: one shrinks to the top left, the other grows beside it.
        expect(picture.isConnected).toBe(true);
        expect(picture.style.left).toBe(`${previousBox.x}px`);
        expect(picture.style.width).toBe(`${previousBox.width}px`);
        expect(verse.style.left).toBe(`${stageLayout.current.x}px`);
        expect(getScale(verse)).toBe(`scale(${stageLayout.currentScale})`);
        expect(findNode(root, 'Chorus')).toBeNull();
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);
        expect(findNode(root, 'Chorus')).not.toBeNull();
        expect(toFrames(root)).toHaveLength(3);
    });

    test('a slide that is not one of these is left to a cut', () => {
        const root = genRoot(slides[0]);
        const html = root.innerHTML;

        // An attachment slide of the song, a slide of another size, a slide
        // holding something that plays.
        expect(move(root, [genItem('video')])).toBe(false);
        expect(
            moveLyricLookAhead(root, slides[1], WIDTH, HEIGHT + 1, build),
        ).toBe(false);
        expect(move(root, [...slides[1], genItem('video')])).toBe(false);
        // Nor from a slide that was never taken in.
        expect(move(build(slides[0]), slides[1])).toBe(false);
        expect(
            registerLyricLookAhead(
                build(genVerse('Verse 1')),
                genVerse('Verse 1'),
                WIDTH,
                HEIGHT,
            ),
        ).toBe(false);

        expect(root.innerHTML).toBe(html);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a slide cut away meanwhile is not added to', () => {
        const root = genRoot(slides[0]);
        move(root, slides[1]);
        root.remove();

        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);

        expect(findNode(root, 'Verse 2')).toBeNull();
        expect(build).not.toHaveBeenCalled();
    });
});
