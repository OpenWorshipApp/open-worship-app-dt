// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import {
    genLyricGrowRoomAttr,
    growLyricBoxElements,
    growLyricBoxes,
    LYRIC_GROW_ROOM_ATTR,
    type LyricGrowRoomType,
    parseLyricGrowRoomAttr,
    scheduleLyricBoxGrow,
} from './lyricBoxGrowHelpers';

const BOX_HEIGHT = 187;

type ModelType = {
    // What the section's content reaches below its top, as `scrollHeight`.
    scrollHeight: number;
    // The tile's height once its frozen boxes are let go.
    naturalHeight: number;
    // How far a script's marks ink past the boxes, let go or not.
    inkOverflow?: number;
};

// A song's part as open-lyric draws it -- tile > section > body > lines >
// line -- every box frozen at a px height. jsdom lays nothing out, so the
// three reads the grow makes answer from `model` and the inline heights, as
// a browser would.
function genBox(room: LyricGrowRoomType | null, model: ModelType) {
    const box = document.createElement('div');
    if (room !== null) {
        box.setAttribute(LYRIC_GROW_ROOM_ATTR, genLyricGrowRoomAttr(room));
    }
    box.innerHTML =
        `<div class="ol-song-view__section-tile" style="height: ${BOX_HEIGHT}px; ` +
        `grid-template-rows: ${BOX_HEIGHT - 8}px;">` +
        `<section style="height: ${BOX_HEIGHT - 8}px;">` +
        '<div class="title-row" style="height: 0px;"><h2 style="height: 0px;">V</h2></div>' +
        `<div class="body" style="height: ${BOX_HEIGHT - 20}px;">` +
        '<div class="lines" style="height: 388px;">' +
        '<div class="line" style="height: 90px;"><span style="height: 80px;">la</span></div>' +
        '</div></div></section></div>';
    document.body.append(box);
    const tile = box.firstElementChild as HTMLElement;
    const section = tile.firstElementChild as HTMLElement;
    Object.defineProperty(tile, 'offsetHeight', {
        get: () => {
            return tile.style.height === 'auto'
                ? model.naturalHeight
                : Number.parseFloat(tile.style.height);
        },
    });
    const checkIsLetGo = () => section.style.height === 'auto';
    Object.defineProperty(section, 'clientHeight', {
        get: () => {
            return checkIsLetGo()
                ? model.naturalHeight - 8
                : Number.parseFloat(section.style.height);
        },
    });
    Object.defineProperty(section, 'scrollHeight', {
        get: () => {
            return checkIsLetGo()
                ? model.naturalHeight - 8 + (model.inkOverflow ?? 0)
                : model.scrollHeight;
        },
    });
    const query = (selector: string) => {
        return box.querySelector(selector) as HTMLElement;
    };
    return { box, tile, section, query };
}

// Needs 226px, drawn at 187px; a grow adds a px for rounding: 227px.
const CUT: ModelType = { scrollHeight: 220, naturalHeight: 226 };

afterEach(() => {
    document.body.replaceChildren();
});

describe('genLyricGrowRoomAttr / parseLyricGrowRoomAttr', () => {
    test('round trip, whole px, never below zero', () => {
        expect(genLyricGrowRoomAttr({ up: 747.4, down: -3 })).toBe('747,0');
        expect(parseLyricGrowRoomAttr('747,0')).toEqual({ up: 747, down: 0 });
        expect(parseLyricGrowRoomAttr('-5,10')).toEqual({ up: 0, down: 10 });
    });

    test('anything else is no room at all', () => {
        expect(parseLyricGrowRoomAttr(null)).toBeNull();
        expect(parseLyricGrowRoomAttr('')).toBeNull();
        expect(parseLyricGrowRoomAttr('up,down')).toBeNull();
        expect(parseLyricGrowRoomAttr('12')).toBeNull();
    });
});

describe('growLyricBoxElements', () => {
    test('a cut part at the bottom grows UP into the room above it', () => {
        const { box, tile, section, query } = genBox({ up: 747, down: 0 }, CUT);
        growLyricBoxElements([box]);
        // 226 needed and a px, 187 drawn: 40 more, all of it above.
        expect(tile.style.height).toBe('227px');
        expect(tile.style.gridTemplateRows).toBe('minmax(0, 1fr)');
        expect(tile.style.transform).toBe('translateY(-20px)');
        // The boxes sized off the tile are let go, down to the lines box.
        expect(section.style.height).toBe('auto');
        expect(query('.title-row').style.height).toBe('auto');
        expect(query('.body').style.height).toBe('auto');
        expect(query('.lines').style.height).toBe('auto');
        // A line, a title and a word keep the height they were drawn at.
        expect(query('.line').style.height).toBe('90px');
        expect(query('h2').style.height).toBe('0px');
        expect(query('span').style.height).toBe('80px');
    });

    test('marks inked past the boxes are room needed too', () => {
        const { box, tile } = genBox(
            { up: 747, down: 0 },
            { ...CUT, inkOverflow: 2 },
        );
        growLyricBoxElements([box]);
        // Twice the ink: a centred part gets only half the growth under it.
        expect(tile.style.height).toBe('231px');
        expect(tile.style.transform).toBe('translateY(-22px)');
    });

    test('at the top it grows DOWN, in the centre both ways', () => {
        const top = genBox({ up: 0, down: 747 }, CUT);
        const centre = genBox({ up: 373, down: 374 }, CUT);
        growLyricBoxElements([top.box, centre.box]);
        expect(top.tile.style.height).toBe('227px');
        expect(top.tile.style.transform).toBe('translateY(20px)');
        expect(centre.tile.style.height).toBe('227px');
        expect(centre.tile.style.transform).toBe('');
    });

    test('never past the edge of the slide', () => {
        const { box, tile } = genBox(
            { up: 10, down: 0 },
            { scrollHeight: 400, naturalHeight: 420 },
        );
        growLyricBoxElements([box]);
        expect(tile.style.height).toBe(`${BOX_HEIGHT + 10}px`);
        expect(tile.style.transform).toBe('translateY(-5px)');
    });

    test('a part that only LOOKED cut (an Atom Mode line) is left as drawn', () => {
        // The lines box keeps the whole part's frozen height around one
        // line: the section scrolls, yet the part needs less than the box.
        const { box, tile, section, query } = genBox(
            { up: 747, down: 0 },
            { scrollHeight: 300, naturalHeight: 120 },
        );
        growLyricBoxElements([box]);
        expect(tile.style.height).toBe(`${BOX_HEIGHT}px`);
        expect(tile.style.gridTemplateRows).toBe(`${BOX_HEIGHT - 8}px`);
        expect(tile.style.transform).toBe('');
        expect(section.style.height).toBe(`${BOX_HEIGHT - 8}px`);
        expect(query('.body').style.height).toBe(`${BOX_HEIGHT - 20}px`);
        expect(query('.lines').style.height).toBe('388px');
    });

    test('a part that fits, or a box with no room, is not touched', () => {
        const fits = genBox(
            { up: 747, down: 0 },
            { scrollHeight: BOX_HEIGHT - 8, naturalHeight: 999 },
        );
        const noRoom = genBox({ up: 0, down: 0 }, CUT);
        const noAttr = genBox(null, CUT);
        growLyricBoxElements([fits.box, noRoom.box, noAttr.box]);
        for (const { tile, section } of [fits, noRoom, noAttr]) {
            expect(tile.style.height).toBe(`${BOX_HEIGHT}px`);
            expect(section.style.height).toBe(`${BOX_HEIGHT - 8}px`);
        }
    });

    test('markup that is not a tile, or a box off the page, is not touched', () => {
        const other = genBox({ up: 747, down: 0 }, CUT);
        other.tile.className = 'look-ahead-frame';
        const detached = genBox({ up: 747, down: 0 }, CUT);
        detached.box.remove();
        growLyricBoxElements([other.box, detached.box]);
        expect(other.tile.style.height).toBe(`${BOX_HEIGHT}px`);
        expect(detached.tile.style.height).toBe(`${BOX_HEIGHT}px`);
    });

    test('grown again, it is measured as open-lyric drew it', () => {
        const { box, tile, query } = genBox({ up: 747, down: 0 }, CUT);
        growLyricBoxElements([box]);
        // The stage was restyled to a centred box; the markup is kept.
        box.setAttribute(
            LYRIC_GROW_ROOM_ATTR,
            genLyricGrowRoomAttr({ up: 373, down: 374 }),
        );
        growLyricBoxElements([box]);
        expect(tile.style.height).toBe('227px');
        expect(tile.style.transform).toBe('');
        // Moved to where the part fits: everything is back as it was drawn.
        box.setAttribute(
            LYRIC_GROW_ROOM_ATTR,
            genLyricGrowRoomAttr({ up: 0, down: 0 }),
        );
        growLyricBoxElements([box]);
        expect(tile.style.height).toBe(`${BOX_HEIGHT}px`);
        expect(tile.style.gridTemplateRows).toBe(`${BOX_HEIGHT - 8}px`);
        expect(query('.lines').style.height).toBe('388px');
    });
});

describe('growLyricBoxes / scheduleLyricBoxGrow', () => {
    test('a slide on a screen: every lyric box under it', () => {
        const first = genBox({ up: 747, down: 0 }, CUT);
        const second = genBox({ up: 0, down: 747 }, CUT);
        growLyricBoxes(document.body);
        expect(first.tile.style.height).toBe('227px');
        expect(second.tile.style.height).toBe('227px');
    });

    test('a pane of cards is grown together once the commit is done', async () => {
        const first = genBox({ up: 747, down: 0 }, CUT);
        const second = genBox({ up: 747, down: 0 }, CUT);
        scheduleLyricBoxGrow(first.box);
        scheduleLyricBoxGrow(second.box);
        // StrictMode runs a layout effect twice: once is enough.
        scheduleLyricBoxGrow(first.box);
        expect(first.tile.style.height).toBe(`${BOX_HEIGHT}px`);
        await Promise.resolve();
        expect(first.tile.style.height).toBe('227px');
        expect(second.tile.style.height).toBe('227px');
    });
});
