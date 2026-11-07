import { describe, expect, it } from 'vitest';

import {
    AGENT_SLIDE_LIMITS,
    type AgentCheckedSlideRequestType,
    applyAgentSlideAction,
    checkIsAgentSlideAction,
    genAgentTextItem,
    readAgentSlideDocument,
    readAgentSlideRequest,
} from './agentSlideHelpers';

// The app's own default text box as `CanvasItemText.genDefaultItem` makes it,
// box alignment keys and all -- the ones a write must never carry to disk.
const TEXT_DEFAULTS = {
    type: 'text',
    id: -1,
    text: 'Open Worship app',
    color: '#FFFFFF',
    fontSize: 60,
    fontFamily: null,
    fontWeight: null,
    textHorizontalAlignment: 'center',
    textVerticalAlignment: 'center',
    top: 279,
    left: 356,
    width: 700,
    height: 400,
    rotate: 0,
    backgroundColor: '#0000008b',
    backdropFilter: 0,
    roundSizePercentage: 0,
    roundSizePixel: 0,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
};

const CONTEXT = {
    name: 'Sunday',
    genTextDefaults: () => {
        return structuredClone(TEXT_DEFAULTS);
    },
    getDefaultDim: () => {
        return { width: 1280, height: 720 };
    },
};

function genTextBox(id: number, extra: Record<string, unknown> = {}) {
    return {
        ...TEXT_DEFAULTS,
        id,
        text: `Box ${id}`,
        left: 10,
        top: 20,
        width: 300,
        height: 100,
        ...extra,
    };
}

function genDocument(slideCount = 3) {
    return {
        metadata: { app: 'OpenWorship', fileVersion: 1, initDate: 'x' },
        items: Array.from({ length: slideCount }, (_value, index) => {
            return {
                id: index + 1,
                metadata: { width: 1920, height: 1080 },
                canvasItems: [genTextBox(1), genTextBox(2)],
            };
        }),
    };
}

function check(
    action: Parameters<typeof readAgentSlideRequest>[0],
    request: Record<string, unknown>,
) {
    const checked = readAgentSlideRequest(action, request);
    if (checked.isError === true) {
        throw new Error(checked.reason);
    }
    return checked as AgentCheckedSlideRequestType;
}

describe('readAgentSlideRequest', () => {
    it('takes a well-formed request', () => {
        expect(
            check('update-slide', { slide: 2, items: [{ id: 1, text: 'Hi' }] }),
        ).toEqual({ slide: 2, specs: [{ id: 1, text: 'Hi' }] });
        expect(check('add-slide', {})).toEqual({ specs: [] });
    });

    // Refused before anything is read off the disk, each with what to send.
    it('refuses a malformed one with what to send instead', () => {
        const refusal = (action: any, request: any) => {
            const checked = readAgentSlideRequest(action, request);
            return checked.isError === true ? checked.reason : null;
        };
        expect(refusal('delete-slide', {})).toContain('needs `slide`');
        expect(refusal('update-slide', { slide: 0, items: [] })).toContain(
            'counting from 1',
        );
        expect(refusal('move-slide', { slide: 1 })).toContain('needs `to`');
        expect(refusal('update-slide', { slide: 1 })).toContain(
            'needs `items`',
        );
        expect(
            refusal('update-slide', {
                slide: 1,
                items: [{ id: 1, color: 'red' }],
            }),
        ).toContain('#RRGGBB');
        expect(
            refusal('update-slide', {
                slide: 1,
                items: [{ id: 1, valign: 'middle' }],
            }),
        ).toContain('top, center or bottom');
        expect(
            refusal('update-slide', { slide: 1, items: [{ id: 1 }] }),
        ).toContain('nothing to change');
        expect(
            refusal('update-slide', {
                slide: 1,
                items: [{ id: 1, remove: true, text: 'x' }],
            }),
        ).toContain('both removes');
        expect(
            refusal('add-slide', { items: [{ id: 3, text: 'x' }] }),
        ).toContain('new text boxes only');
        expect(
            refusal('update-slide', { slide: 1, items: [{ id: 1, nope: 1 }] }),
        ).toContain('not a field of a box');
        expect(
            refusal('update-slide', {
                slide: 1,
                items: Array.from(
                    { length: AGENT_SLIDE_LIMITS.itemsPerCall + 1 },
                    () => {
                        return { text: 'x' };
                    },
                ),
            }),
        ).toContain('At most');
    });
});

describe('readAgentSlideDocument', () => {
    it('lists every slide with its boxes and their style, in words', () => {
        const read = readAgentSlideDocument(
            genDocument(2),
            'Sunday',
            check('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        expect(read.slideDocument).toMatchObject({
            name: 'Sunday',
            slideCount: 2,
            width: 1920,
            height: 1080,
        });
        expect(read.slideDocument.slides[0].items[0]).toMatchObject({
            id: 1,
            type: 'text',
            text: 'Box 1',
            align: 'center',
            valign: 'center',
        });
    });

    // A path carries the account name; a picture embedded inline is megabytes.
    it('names a file by its name only and says nothing of inline data', () => {
        const json = genDocument(1);
        json.items[0].canvasItems = [
            {
                ...genTextBox(1),
                type: 'video',
                filePath: 'C:\\Users\\racky\\a b.mp4',
            } as any,
            {
                ...genTextBox(2),
                type: 'image',
                srcData: 'data:image/png;base64,AAAA',
            } as any,
        ];
        const read = readAgentSlideDocument(
            json,
            'Sunday',
            check('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        const [video, image] = read.slideDocument.slides[0].items;
        expect(video.file).toBe('a b.mp4');
        expect(JSON.stringify(read)).not.toContain('racky');
        expect(image).not.toHaveProperty('file');
        expect(JSON.stringify(image)).not.toContain('base64');
    });

    it('cuts a long text and says it did', () => {
        const json = genDocument(1);
        json.items[0].canvasItems[0].text = 'x'.repeat(1000);
        const read = readAgentSlideDocument(
            json,
            'Sunday',
            check('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        expect(read.slideDocument.slides[0].items[0].isTextCut).toBe(true);
    });

    it('pages a long document and says where the next page starts', () => {
        const read = readAgentSlideDocument(
            genDocument(AGENT_SLIDE_LIMITS.listedSlides + 5),
            'Sunday',
            check('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        expect(read.slideDocument.isTruncated).toBe(true);
        expect(read.slideDocument.note).toContain('slide:');
    });
});

describe('applyAgentSlideAction', () => {
    it('adds a slide where asked, the size of the others, boxes centred', () => {
        const change = applyAgentSlideAction(
            'add-slide',
            genDocument(2),
            check('add-slide', { slide: 1, items: [{ text: 'Welcome' }] }),
            CONTEXT,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        const added = change.json.items[0];
        expect(change.result).toMatchObject({ added: 1, id: 3, slideCount: 3 });
        expect(added.metadata).toEqual({ width: 1920, height: 1080 });
        const [box] = added.canvasItems;
        expect(box).toMatchObject({
            text: 'Welcome',
            width: 1536,
            height: 324,
            left: 192,
            top: 378,
            fontSize: 60,
        });
        // Never the app's own name on a congregation's screen, and never a
        // one-off layout instruction written into the file.
        expect(box).not.toHaveProperty('horizontalAlignment');
        expect(change.checkItems).toHaveLength(1);
        // The document it was given is left as it was.
        expect(change.json).not.toBe(genDocument(2));
    });

    it('gives a first slide the default size when there is nothing to copy', () => {
        const change = applyAgentSlideAction(
            'add-slide',
            { ...genDocument(0) },
            check('add-slide', {}),
            CONTEXT,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        expect(change.json.items[0].metadata).toEqual({
            width: 1280,
            height: 720,
        });
    });

    it('changes, adds and removes boxes in one change', () => {
        const document = genDocument(1);
        const change = applyAgentSlideAction(
            'update-slide',
            document,
            check('update-slide', {
                slide: 1,
                items: [
                    { id: 1, fontSize: 90, color: '#FFD700', valign: 'top' },
                    { id: 2, remove: true },
                    { text: 'New box' },
                ],
            }),
            CONTEXT,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        const [changed, added] = change.json.items[0].canvasItems;
        expect(changed).toMatchObject({
            id: 1,
            text: 'Box 1',
            fontSize: 90,
            color: '#FFD700',
            textVerticalAlignment: 'start',
        });
        expect(added).toMatchObject({ id: 3, text: 'New box' });
        expect(change.json.items[0].canvasItems).toHaveLength(2);
        expect(change.summary).toBe('Changed slide 1 of “Sunday”');
        // The caller's copy is the state the backup was taken from.
        expect(document.items[0].canvasItems).toHaveLength(2);
    });

    it('refuses what it cannot do, and says what is there', () => {
        const document = genDocument(1);
        (document.items[0].canvasItems[1] as any).locked = true;
        (document.items[0].canvasItems as any).push({
            ...genTextBox(3),
            type: 'image',
        });
        const refusal = (items: any[]) => {
            const change = applyAgentSlideAction(
                'update-slide',
                document,
                check('update-slide', { slide: 1, items }),
                CONTEXT,
            );
            return change.isError === true ? change.reason : null;
        };
        expect(refusal([{ id: 9, text: 'x' }])).toContain(
            'Its boxes are 1, 2, 3',
        );
        expect(refusal([{ id: 2, text: 'x' }])).toContain('locked');
        expect(refusal([{ id: 3, text: 'x' }])).toContain('no text to change');
        expect(refusal([{ id: 3, fontSize: 40 }])).toContain(
            'only apply to a text box',
        );
        expect(refusal([{ id: 3, left: 40 }])).toBeNull();
    });

    // A model echoes back the shortened text it was shown; written, that
    // would keep the first 300 characters of the box and lose the rest.
    it('refuses the shortened text the list showed as a new text', () => {
        const document = genDocument(1);
        document.items[0].canvasItems[0].text = 'y'.repeat(1000);
        const change = applyAgentSlideAction(
            'update-slide',
            document,
            check('update-slide', {
                slide: 1,
                items: [{ id: 1, text: `${'y'.repeat(300)}…` }],
            }),
            CONTEXT,
        );
        expect(change.isError).toBe(true);
    });

    it('writes nothing when the values are already there', () => {
        const change = applyAgentSlideAction(
            'update-slide',
            genDocument(1),
            check('update-slide', {
                slide: 1,
                items: [{ id: 1, text: 'Box 1' }],
            }),
            CONTEXT,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        expect(change.didChange).toBe(false);
        expect(change.note).toContain('already');
    });

    it('removes, moves and copies slides, and refuses one past the end', () => {
        const removed = applyAgentSlideAction(
            'delete-slide',
            genDocument(1),
            check('delete-slide', { slide: 1 }),
            CONTEXT,
        );
        if (removed.isError === true) {
            throw new Error(removed.reason);
        }
        // The editor's own Delete keeps no minimum, and neither does this.
        expect(removed.json.items).toHaveLength(0);
        expect(removed.note).toContain('no slides left');

        const moved = applyAgentSlideAction(
            'move-slide',
            genDocument(3),
            check('move-slide', { slide: 1, to: 99 }),
            CONTEXT,
        );
        if (moved.isError === true) {
            throw new Error(moved.reason);
        }
        expect(
            moved.json.items.map((one: any) => {
                return one.id;
            }),
        ).toEqual([2, 3, 1]);

        const copied = applyAgentSlideAction(
            'duplicate-slide',
            genDocument(2),
            check('duplicate-slide', { slide: 1 }),
            CONTEXT,
        );
        if (copied.isError === true) {
            throw new Error(copied.reason);
        }
        expect(
            copied.json.items.map((one: any) => {
                return one.id;
            }),
        ).toEqual([1, 3, 2]);

        const missing = applyAgentSlideAction(
            'delete-slide',
            genDocument(2),
            check('delete-slide', { slide: 5 }),
            CONTEXT,
        );
        expect(missing.isError === true && missing.reason).toContain(
            'numbered 1 to 2',
        );
    });
});

describe('genAgentTextItem', () => {
    it('centres a new box on the slide and takes what the spec says', () => {
        const item = genAgentTextItem(
            structuredClone(TEXT_DEFAULTS),
            { text: 'Hi', width: 200, height: 100, align: 'left' },
            7,
            { width: 1000, height: 500 },
        );
        expect(item).toMatchObject({
            id: 7,
            text: 'Hi',
            left: 400,
            top: 200,
            textHorizontalAlignment: 'left',
        });
        expect(item).not.toHaveProperty('locked');
    });
});

describe('checkIsAgentSlideAction', () => {
    it('knows the six slide actions and nothing else', () => {
        for (const action of [
            'slides',
            'add-slide',
            'update-slide',
            'delete-slide',
            'move-slide',
            'duplicate-slide',
        ]) {
            expect(checkIsAgentSlideAction(action)).toBe(true);
        }
        for (const action of ['list', 'update', 'SLIDES', '', undefined, 3]) {
            expect(checkIsAgentSlideAction(action)).toBe(false);
        }
    });
});

describe('readAgentSlideRequest field and shape rules', () => {
    const refusal = (action: any, request: any) => {
        const checked = readAgentSlideRequest(action, request);
        return checked.isError === true ? checked.reason : null;
    };

    it.each([
        ['id', { id: 1.5, text: 'x' }, '`id` is the number of a box'],
        ['remove', { id: 1, remove: 'yes' }, '`remove` is true or false'],
        ['text type', { id: 1, text: 5 }, '`text` is the words, as a string'],
        [
            'text length',
            { id: 1, text: 'x'.repeat(5001) },
            '`text` is at most 5000 characters',
        ],
        ['fontSize', { id: 1, fontSize: 0 }, '`fontSize` is pixels, from 1'],
        [
            'fontFamily',
            { id: 1, fontFamily: 7 },
            '`fontFamily` is a name, or "" for the default',
        ],
        [
            'fontWeight',
            { id: 1, fontWeight: 'w'.repeat(201) },
            '`fontWeight` is a name, or "" for the default',
        ],
        [
            'backgroundColor',
            { id: 1, backgroundColor: '#12345' },
            '`backgroundColor` is a color written #RRGGBB',
        ],
        [
            'align',
            { id: 1, align: 'justify' },
            '`align` is left, center or right',
        ],
        [
            'left',
            { id: 1, left: 100001 },
            "`left` is pixels from the slide's left edge",
        ],
        [
            'top',
            { id: 1, top: Number.NaN },
            "`top` is pixels from the slide's top edge",
        ],
        ['width', { id: 1, width: 0 }, '`width` is pixels, at least 1'],
        ['height', { id: 1, height: 100001 }, '`height` is pixels, at least 1'],
        [
            'rotate',
            { id: 1, rotate: -361 },
            '`rotate` is degrees, from -360 to 360',
        ],
    ])(
        'refuses a box with a bad %s, saying what to write',
        (_label, item, expected) => {
            const reason = refusal('update-slide', { slide: 1, items: [item] });
            expect(reason?.startsWith('Box 1 of `items`: ')).toBe(true);
            expect(reason).toContain(expected);
        },
    );

    it('takes every field at its bound', () => {
        const spec = {
            id: 1,
            text: 'x'.repeat(5000),
            fontSize: 1000,
            rotate: 360,
            left: -100000,
            top: 100000,
            width: 1,
            height: 100000,
            fontFamily: '',
            fontWeight: '',
            color: '#FFFFFF80',
            backgroundColor: '#000000',
            align: 'right',
            valign: 'bottom',
        };
        expect(check('update-slide', { slide: 1, items: [spec] })).toEqual({
            slide: 1,
            specs: [spec],
        });
    });

    it('refuses items that are not boxes, or that say too little or too much', () => {
        expect(
            refusal('delete-slide', { slide: 1, items: [{ text: 'x' }] }),
        ).toBe(
            '`items` is for add-slide and update-slide; delete-slide does ' +
                'not take any.',
        );
        expect(
            refusal('update-slide', { slide: 1, items: { text: 'x' } }),
        ).toBe('`items` is a list of boxes.');
        expect(refusal('update-slide', { slide: 1, items: [] })).toBe(
            'update-slide needs at least one box in `items`.',
        );
        // A new slide with an empty list is a bare slide, not a mistake.
        expect(check('add-slide', { items: [] })).toEqual({ specs: [] });
        expect(refusal('add-slide', { items: ['Welcome'] })).toContain(
            'Box 1 of `items` is not a box',
        );
        expect(refusal('add-slide', { items: [{ text: 'a' }, [1]] })).toContain(
            'Box 2 of `items` is not a box',
        );
        expect(
            refusal('update-slide', { slide: 1, items: [{ remove: true }] }),
        ).toBe(
            'Box 1 of `items`: `remove` needs the `id` of the box to take off.',
        );
        // A field given as undefined says nothing at all.
        expect(
            refusal('add-slide', { items: [{ text: undefined }] }),
        ).toContain('Box 1 of `items` is empty');
        expect(
            refusal('update-slide', {
                slide: 1,
                items: [
                    { id: 1, text: 'a' },
                    { id: 1, color: '#FFFFFF' },
                ],
            }),
        ).toBe(
            'Box 2 of `items` names box 1 a second time -- give each box one ' +
                'entry.',
        );
    });

    it('refuses a `to` that is not a position, or is not for the action', () => {
        const notPosition = '`to` is a position, counting from 1 -- like 2.';
        expect(refusal('move-slide', { slide: 1, to: 0 })).toBe(notPosition);
        expect(refusal('move-slide', { slide: 1, to: 1.5 })).toBe(notPosition);
        expect(refusal('add-slide', { to: 2 })).toBe(
            '`to` is for move-slide -- add-slide takes the position for the ' +
                'new slide as `slide`.',
        );
        expect(refusal('delete-slide', { slide: 1, to: 2 })).toBe(
            '`to` is for move-slide; delete-slide does not take it.',
        );
        expect(check('move-slide', { slide: 2, to: 1 })).toEqual({
            slide: 2,
            to: 1,
            specs: [],
        });
        // No request at all reads as the whole list.
        expect(readAgentSlideRequest('slides', null)).toEqual({ specs: [] });
    });
});

describe('readAgentSlideDocument edges', () => {
    const read = (json: unknown, request: AgentCheckedSlideRequestType) => {
        const result = readAgentSlideDocument(json, 'Sunday', request);
        if (result.isError === true) {
            throw new Error(result.reason);
        }
        return result.slideDocument;
    };
    const refusalOf = (json: unknown, slide: number) => {
        const result = readAgentSlideDocument(json, 'Sunday', {
            slide,
            specs: [],
        });
        return result.isError === true ? result.reason : null;
    };

    it('refuses a slide past the end, counting what is there', () => {
        expect(refusalOf({ items: [] }, 1)).toBe(
            '"Sunday" has no slides yet, so there is no slide 1 -- add one ' +
                'with action "add-slide".',
        );
        expect(refusalOf(genDocument(1), 2)).toBe(
            'There is no slide 2 in "Sunday": it has 1 slide, numbered 1.',
        );
        expect(refusalOf(genDocument(3), 4)).toBe(
            'There is no slide 4 in "Sunday": it has 3 slides, numbered 1 to 3.',
        );
    });

    it('lists from a later slide and says which part is listed', () => {
        const document = read(genDocument(3), { slide: 2, specs: [] });
        expect(
            document.slides.map((one) => {
                return one.number;
            }),
        ).toEqual([2, 3]);
        expect(document).not.toHaveProperty('isTruncated');
        expect(document.note).toBe('Slides 2 to 3 of 3 are listed.');
    });

    it('reads what is not a document as no slides, and a broken slide as an empty one', () => {
        expect(read('not a document', { specs: [] })).toEqual({
            name: 'Sunday',
            slideCount: 0,
            width: null,
            height: null,
            slides: [],
        });
        const document = read(
            { items: ['broken', { id: 9, canvasItems: 'none' }] },
            { specs: [] },
        );
        expect(document.slides).toEqual([
            { number: 1, items: [] },
            { number: 2, id: 9, items: [] },
        ]);
    });

    it('says a slide size only where it differs from the first slide', () => {
        const json = genDocument(3);
        json.items[2].metadata = { width: 1280, height: 720 };
        const sized = read(json, { specs: [] });
        expect(sized).toMatchObject({ width: 1920, height: 1080 });
        expect(sized.slides[1]).not.toHaveProperty('width');
        expect(sized.slides[2]).toMatchObject({ width: 1280, height: 720 });

        // A first slide with no usable size gives the document none, so
        // every sized slide says its own.
        json.items[0].metadata = { width: 0, height: 1080 };
        const unsized = read(json, { specs: [] });
        expect(unsized).toMatchObject({ width: null, height: null });
        expect(unsized.slides[0]).not.toHaveProperty('width');
        expect(unsized.slides[1]).toMatchObject({ width: 1920, height: 1080 });
    });

    it('shows each kind of box by what it holds, and a file by its name only', () => {
        const json = genDocument(1);
        json.items[0].canvasItems = [
            {
                id: 1,
                type: 'website',
                url: 'https://example.com/clock',
                left: 0,
                top: 0,
                width: 10,
                height: 10,
            },
            {
                id: 2,
                type: 'youtube',
                url: `https://youtu.be/${'v'.repeat(300)}`,
            },
            { id: 3, type: 'audio', filePath: '/home/racky/Music/hymn.mp3' },
            {
                id: 4,
                type: 'image',
                srcData:
                    'file:///C:/Users/racky/My%20Pictures/Cross%20Light.png?v=2#top',
                locked: true,
            },
            {
                id: 5,
                type: 'video',
                filePath: 'file:///C:/Users/racky/bad%E0%A4%A.mp4',
            },
            { id: 6, type: 'shape' },
            { id: 7, type: 'website', url: 42 },
        ] as any;
        const document = read(json, { specs: [] });
        const [website, youtube, audio, image, video, shape, broken] =
            document.slides[0].items;
        expect(website).toEqual({
            id: 1,
            type: 'website',
            left: 0,
            top: 0,
            width: 10,
            height: 10,
            url: 'https://example.com/clock',
        });
        expect(youtube.url).toBe(
            `${`https://youtu.be/${'v'.repeat(300)}`.slice(0, 200)}…`,
        );
        expect(audio).toMatchObject({ file: 'hymn.mp3' });
        // A file link is read as the name a person sees, query and all off.
        expect(image).toMatchObject({ file: 'Cross Light.png', locked: true });
        // One that cannot be decoded is named as it is written.
        expect(video.file).toBe('bad%E0%A4%A.mp4');
        expect(shape).toEqual({
            id: 6,
            type: 'shape',
            left: null,
            top: null,
            width: null,
            height: null,
        });
        expect(broken).not.toHaveProperty('url');
        expect(JSON.stringify(document)).not.toContain('racky');
    });

    it("reads a text box's style in the words a request uses", () => {
        const json = genDocument(1);
        json.items[0].canvasItems = [
            genTextBox(1, {
                textHorizontalAlignment: 'right',
                textVerticalAlignment: 'end',
                rotate: undefined,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                left: 279.33333333333337,
            }),
            genTextBox(2, {
                textHorizontalAlignment: 'middle',
                textVerticalAlignment: 'start',
                color: 5,
                backgroundColor: null,
                text: 7,
            }),
            genTextBox(3, { textVerticalAlignment: 'baseline' }),
        ] as any;
        const [first, second, third] = read(json, { specs: [] }).slides[0]
            .items;
        expect(first).toMatchObject({
            align: 'right',
            valign: 'bottom',
            rotate: 0,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            left: 279.33,
        });
        expect(second).toMatchObject({
            text: '',
            align: null,
            valign: 'top',
            color: null,
            backgroundColor: null,
        });
        expect(third.valign).toBeNull();
    });

    it('never cuts a character in two', () => {
        const json = genDocument(1);
        json.items[0].canvasItems[0].text = `${'x'.repeat(299)}😀 and more`;
        const [box] = read(json, { specs: [] }).slides[0].items;
        expect(box.text).toBe(`${'x'.repeat(299)}…`);
        expect(box.isTextCut).toBe(true);
    });

    it('lists at most thirty boxes of a slide and counts the rest', () => {
        const json = genDocument(1);
        json.items[0].canvasItems = Array.from({ length: 32 }, (_v, index) => {
            return genTextBox(index + 1);
        });
        const [slide] = read(json, { specs: [] }).slides;
        expect(slide.items).toHaveLength(AGENT_SLIDE_LIMITS.listedItems);
        expect(slide.itemCount).toBe(32);
    });
});

describe('applyAgentSlideAction edges', () => {
    const refusalOf = (
        action: Parameters<typeof applyAgentSlideAction>[0],
        json: any,
        request: AgentCheckedSlideRequestType,
    ) => {
        const change = applyAgentSlideAction(action, json, request, CONTEXT);
        return change.isError === true ? change.reason : null;
    };
    const changeOf = (
        action: Parameters<typeof applyAgentSlideAction>[0],
        json: any,
        request: AgentCheckedSlideRequestType,
    ) => {
        const change = applyAgentSlideAction(action, json, request, CONTEXT);
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        return change;
    };

    it('refuses a change with no slide, no boxes, no place, or a slide it cannot read', () => {
        expect(refusalOf('delete-slide', genDocument(2), { specs: [] })).toBe(
            'delete-slide needs `slide`: the number of the slide, counting ' +
                'from 1.',
        );
        expect(
            refusalOf(
                'duplicate-slide',
                { items: ['broken'] },
                {
                    slide: 1,
                    specs: [],
                },
            ),
        ).toBe('Slide 1 of "Sunday" could not be read, so it was not changed.');
        expect(
            refusalOf('update-slide', genDocument(1), { slide: 1, specs: [] }),
        ).toBe('update-slide needs at least one box in `items`.');
        expect(
            refusalOf('move-slide', genDocument(2), { slide: 1, specs: [] }),
        ).toBe(
            'move-slide needs `to`: the position to move the slide to, ' +
                'counting from 1.',
        );
    });

    it('moves nothing onto the place a slide already has', () => {
        const document = genDocument(3);
        const change = changeOf('move-slide', document, {
            slide: 3,
            to: 99,
            specs: [],
        });
        expect(change.didChange).toBe(false);
        expect(change.json).toBe(document);
        expect(change.result).toEqual({ moved: 3, to: 3, slideCount: 3 });
        expect(change.note).toBe(
            'Slide 3 is already at position 3, so nothing was moved.',
        );
    });

    it('names the boxes there are when a box id is not one of them', () => {
        const json = genDocument(1);
        delete (json.items[0] as any).canvasItems;
        expect(
            refusalOf('update-slide', json, {
                slide: 1,
                specs: [{ id: 1, text: 'x' }],
            }),
        ).toBe(
            'Box 1 of `items`: slide 1 has no box with id 1. It has no boxes ' +
                '-- one without an `id` is added as a new text box.',
        );
        const crowded = genDocument(1);
        crowded.items[0].canvasItems = Array.from(
            { length: 31 },
            (_v, index) => {
                return genTextBox(index + 1);
            },
        );
        const shownIds = Array.from({ length: 30 }, (_v, index) => {
            return index + 1;
        });
        expect(
            refusalOf('update-slide', crowded, {
                slide: 1,
                specs: [{ id: 99, text: 'x' }],
            }),
        ).toContain(
            `Its boxes are ${shownIds.join(', ')}, … -- action "slides" says ` +
                'which is which.',
        );
    });

    it('places a new box on its own slide, else the first slide, else the default size', () => {
        const unsized = changeOf(
            'update-slide',
            { items: [{ id: 1 }] },
            { slide: 1, specs: [{ text: 'Hello' }] },
        );
        expect(unsized.json.items[0].canvasItems).toEqual([
            expect.objectContaining({
                id: 1,
                text: 'Hello',
                width: 1024,
                height: 216,
                left: 128,
                top: 252,
            }),
        ]);
        expect(unsized.checkItems).toHaveLength(1);

        const json = genDocument(2);
        delete (json.items[1] as any).metadata;
        const borrowed = changeOf('update-slide', json, {
            slide: 2,
            specs: [{ text: 'Hello' }],
        });
        expect(borrowed.json.items[1].canvasItems[2]).toMatchObject({
            id: 3,
            width: 1536,
            height: 324,
        });
    });

    it('writes alignment and fonts the way the editor stores them', () => {
        const change = changeOf('update-slide', genDocument(1), {
            slide: 1,
            specs: [
                {
                    id: 1,
                    align: 'left',
                    valign: 'bottom',
                    fontFamily: '',
                    fontWeight: 'bold',
                },
                {
                    id: 2,
                    valign: 'center',
                    fontWeight: '',
                    fontFamily: 'Khmer OS',
                    backgroundColor: '#00000080',
                    rotate: 15,
                },
            ],
        });
        const [first, second] = change.json.items[0].canvasItems;
        expect(first).toMatchObject({
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'end',
            fontFamily: null,
            fontWeight: 'bold',
        });
        expect(second).toMatchObject({
            textVerticalAlignment: 'center',
            fontWeight: null,
            fontFamily: 'Khmer OS',
            backgroundColor: '#00000080',
            rotate: 15,
        });
        // A one-off layout instruction never reaches the file.
        expect(first).not.toHaveProperty('horizontalAlignment');
        expect(
            change.checkItems.map((one) => {
                return one.before?.id;
            }),
        ).toEqual([1, 2]);
    });

    it('names the kind of a box that holds no text', () => {
        const json = genDocument(1);
        json.items[0].canvasItems = [
            { ...genTextBox(1), type: 'video' },
            { ...genTextBox(2), type: undefined },
        ] as any;
        expect(
            refusalOf('update-slide', json, {
                slide: 1,
                specs: [{ id: 1, color: '#FFFFFF' }],
            }),
        ).toBe(
            'Box 1 of `items`: box 1 is a video box, and color only apply to ' +
                'a text box -- its left, top, width, height, rotate and ' +
                'backgroundColor can change.',
        );
        expect(
            refusalOf('update-slide', json, {
                slide: 1,
                specs: [{ id: 2, text: 'x' }],
            }),
        ).toBe(
            'Box 1 of `items`: box 2 is an unknown box, which has no text to ' +
                'change.',
        );
    });
});
