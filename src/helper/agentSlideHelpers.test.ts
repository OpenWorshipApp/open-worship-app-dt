import { describe, expect, it } from 'vitest';

import {
    AGENT_SLIDE_LIMITS,
    type AgentCheckedSlideRequestType,
    applyAgentSlideAction,
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
