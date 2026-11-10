import { describe, expect, it } from 'vitest';

import {
    AGENT_SLIDE_ADD_BATCH_ACTION,
    AGENT_SLIDE_BATCH_ACTION,
    AGENT_SLIDE_LIMITS,
    type AgentCheckedSlideBatchType,
    applyAgentSlideBatch,
    checkIsAgentSlideAction,
    checkIsAgentSlideBatchAction,
    readAgentSlideBatchRequest,
    readAgentSlideDocument,
    toRealLineBreaks,
} from './agentSlideHelpers';

// `update-slides` and `add-slides` (`owa_slide_edit`): many slides in one
// call and one history entry, by the one-slide actions' own rules.

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

function checkBatch(
    changes: unknown,
    action:
        | typeof AGENT_SLIDE_BATCH_ACTION
        | typeof AGENT_SLIDE_ADD_BATCH_ACTION = AGENT_SLIDE_BATCH_ACTION,
): AgentCheckedSlideBatchType {
    const checked = readAgentSlideBatchRequest(changes, action);
    if (checked.isError === true) {
        throw new Error(checked.reason);
    }
    return checked;
}

function refusalOf(
    changes: unknown,
    action:
        | typeof AGENT_SLIDE_BATCH_ACTION
        | typeof AGENT_SLIDE_ADD_BATCH_ACTION = AGENT_SLIDE_BATCH_ACTION,
) {
    const checked = readAgentSlideBatchRequest(changes, action);
    return checked.isError === true ? checked.reason : null;
}

describe('which actions are the batch ones', () => {
    it('are not one-slide actions, so owa_slide_file never names them', () => {
        for (const action of ['update-slides', 'add-slides']) {
            expect(checkIsAgentSlideBatchAction(action)).toBe(true);
            expect(checkIsAgentSlideAction(action)).toBe(false);
        }
        expect(checkIsAgentSlideBatchAction('update-slide')).toBe(false);
    });
});

describe('reading an update-slides request', () => {
    it('takes one {slide, items} a slide, each read by update-slide', () => {
        expect(
            checkBatch([
                { slide: 1, items: [{ id: 1, text: 'Hello' }] },
                { slide: 3, items: [{ id: 2, fontSize: 80 }] },
            ]),
        ).toEqual({
            changes: [
                { slide: 1, specs: [{ id: 1, text: 'Hello' }] },
                { slide: 3, specs: [{ id: 2, fontSize: 80 }] },
            ],
        });
    });

    it('refuses an empty list, a slide named twice and a bad box', () => {
        expect(refusalOf([])).toMatch(/needs `changes`/);
        expect(refusalOf(undefined)).toMatch(/needs `changes`/);
        expect(refusalOf(['x'])).toMatch(/is not a change/);
        expect(refusalOf([{ items: [{ id: 1, text: 'a' }] }])).toMatch(
            /`slide` is the number of a slide/,
        );
        expect(
            refusalOf([
                { slide: 2, items: [{ id: 1, text: 'a' }] },
                { slide: 2, items: [{ id: 2, text: 'b' }] },
            ]),
        ).toMatch(/names slide 2 a second time/);
        expect(refusalOf([{ slide: 1, items: [] }])).toMatch(
            /\(slide 1\): update-slide needs at least one box/,
        );
        expect(
            refusalOf([{ slide: 1, items: [{ id: 1, color: 'red' }] }]),
        ).toMatch(/#RRGGBB/);
    });

    it('holds one call to the batch limit', () => {
        const changes = Array.from(
            { length: AGENT_SLIDE_LIMITS.slidesPerBatch + 1 },
            (_value, index) => {
                return { slide: index + 1, items: [{ id: 1, text: 'a' }] };
            },
        );
        expect(refusalOf(changes)).toMatch(/send the rest in another/);
    });
});

describe('applying update-slides', () => {
    it('changes every slide named, as one document, saying how many', () => {
        const json = genDocument(3);
        const change = applyAgentSlideBatch(
            json,
            checkBatch([
                { slide: 1, items: [{ id: 1, text: 'Good morning' }] },
                { slide: 3, items: [{ id: 2, text: 'Goodbye', fontSize: 42 }] },
            ]),
            CONTEXT,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        expect(change.didChange).toBe(true);
        expect(change.summary).toBe('Changed 2 slides of “Sunday”');
        expect(change.result).toEqual({ updated: [1, 3], slideCount: 3 });
        expect(change.json.items[0].canvasItems[0].text).toBe('Good morning');
        expect(change.json.items[2].canvasItems[1]).toMatchObject({
            text: 'Goodbye',
            fontSize: 42,
        });
        // Untouched slides are carried as they were, and the input is not
        // changed: it is the state the backup was taken from.
        expect(change.json.items[1]).toBe(json.items[1]);
        expect(json.items[0].canvasItems[0].text).toBe('Box 1');
        expect(change.checkItems).toHaveLength(2);
    });

    it('refuses the lot when one slide is refused, writing nothing', () => {
        const json = genDocument(2);
        const missingSlide = applyAgentSlideBatch(
            json,
            checkBatch([
                { slide: 1, items: [{ id: 1, text: 'a' }] },
                { slide: 5, items: [{ id: 1, text: 'b' }] },
            ]),
            CONTEXT,
        );
        expect(missingSlide).toMatchObject({ isError: true });
        expect((missingSlide as any).reason).toMatch(
            /no slide 5.*Nothing was changed/,
        );
        const missingBox = applyAgentSlideBatch(
            json,
            checkBatch([{ slide: 2, items: [{ id: 9, text: 'b' }] }]),
            CONTEXT,
        );
        expect((missingBox as any).reason).toMatch(
            /^Slide 2: .*no box with id 9.*Nothing was changed/,
        );
        const locked = genDocument(1);
        (locked.items[0].canvasItems[0] as any).locked = true;
        expect(
            (
                applyAgentSlideBatch(
                    locked,
                    checkBatch([{ slide: 1, items: [{ id: 1, text: 'x' }] }]),
                    CONTEXT,
                ) as any
            ).reason,
        ).toMatch(/locked/);
    });

    it('refuses a "new" box carrying a box’s words, naming its id', () => {
        // gemma4:cloud, 2026-11-07: the English and the other language's words
        // sent with no id, which would have put those words on the slide twice.
        const json = genDocument(1);
        json.items[0].canvasItems[0].text = 'Worship in truth';
        const refused = applyAgentSlideBatch(
            json,
            checkBatch([
                {
                    slide: 1,
                    items: [{ text: 'TITLE\nWorship in truth', fontSize: 50 }],
                },
            ]),
            CONTEXT,
        );
        expect((refused as any).reason).toMatch(
            /no `id`.*words of box 1.*"id": 1/,
        );
        // A new box with words of its own is still a new box.
        const added = applyAgentSlideBatch(
            json,
            checkBatch([{ slide: 1, items: [{ text: 'A new line' }] }]),
            CONTEXT,
        ) as any;
        expect(added.didChange).toBe(true);
        expect(added.json.items[0].canvasItems).toHaveLength(3);
    });

    it('refuses new words that repeat another box of the slide', () => {
        // gemma4:cloud, 2026-11-07: "What is Faith" put over a slide's
        // other words when the box under them already said it.
        const json = genDocument(1);
        json.items[0].canvasItems[0].text = 'Line in another script';
        json.items[0].canvasItems[1].text = 'What is Faith';
        const repeating = [
            { id: 1, text: 'What is Faith\nLine in another script' },
        ];
        expect(
            (
                applyAgentSlideBatch(
                    json,
                    checkBatch([{ slide: 1, items: repeating }]),
                    CONTEXT,
                ) as any
            ).reason,
        ).toMatch(/repeat box 2's \("What is Faith"\).*leave slide 1 out/);
        // Merging the two boxes -- the other one taken off -- is allowed.
        const merged = applyAgentSlideBatch(
            json,
            checkBatch([
                { slide: 1, items: [...repeating, { id: 2, remove: true }] },
            ]),
            CONTEXT,
        ) as any;
        expect(merged.didChange).toBe(true);
        expect(merged.json.items[0].canvasItems).toHaveLength(1);
    });

    it('says nothing changed when every value already was so', () => {
        const json = genDocument(2);
        const change = applyAgentSlideBatch(
            json,
            checkBatch([{ slide: 2, items: [{ id: 1, text: 'Box 1' }] }]),
            CONTEXT,
        );
        expect(change).toMatchObject({
            didChange: false,
            json,
            result: { updated: [], slideCount: 2 },
        });
    });
});

describe('add-slides', () => {
    it('reads new slides, each where it goes or at the end', () => {
        expect(
            checkBatch(
                [{ items: [{ text: 'Welcome' }] }, { slide: 1, items: [] }],
                AGENT_SLIDE_ADD_BATCH_ACTION,
            ),
        ).toEqual({
            changes: [
                { specs: [{ text: 'Welcome' }] },
                { slide: 1, specs: [] },
            ],
        });
        expect(
            refusalOf(
                [{ items: [{ id: 1, text: 'x' }] }],
                AGENT_SLIDE_ADD_BATCH_ACTION,
            ),
        ).toMatch(/new slide has no boxes yet/);
        expect(
            refusalOf([{ slide: 0, items: [] }], AGENT_SLIDE_ADD_BATCH_ACTION),
        ).toMatch(/where the new slide goes/);
        expect(refusalOf([], AGENT_SLIDE_ADD_BATCH_ACTION)).toMatch(
            /add-slides needs `changes`/,
        );
        // Styled as words and given none (gemma4:cloud, 2026-11-07); a
        // background box, a colour and no font, is fine.
        expect(
            refusalOf(
                [{ items: [{ fontSize: 80, fontWeight: 'bold', top: 10 }] }],
                AGENT_SLIDE_ADD_BATCH_ACTION,
            ),
        ).toMatch(/styled as words \(a font\) but has no `text`/);
        expect(
            refusalOf(
                [{ items: [{ left: 0, top: 0, backgroundColor: '#000033' }] }],
                AGENT_SLIDE_ADD_BATCH_ACTION,
            ),
        ).toBe(null);
    });

    it('adds every slide drawn after a picture as one document', () => {
        const json = genDocument(1);
        const change = applyAgentSlideBatch(
            json,
            checkBatch(
                [
                    {
                        items: [
                            // A background: a box filling the slide.
                            {
                                left: 0,
                                top: 0,
                                width: 1920,
                                height: 1080,
                                backgroundColor: '#123456',
                            },
                            {
                                text: 'Welcome',
                                fontSize: 120,
                                fontWeight: 'bold',
                                color: '#FFD700',
                            },
                        ],
                    },
                    { slide: 1, items: [{ text: 'First' }] },
                ],
                AGENT_SLIDE_ADD_BATCH_ACTION,
            ),
            CONTEXT,
            AGENT_SLIDE_ADD_BATCH_ACTION,
        );
        if (change.isError === true) {
            throw new Error(change.reason);
        }
        expect(change.summary).toBe('Added 2 slides to “Sunday”');
        // Each new slide where it ended up, with its boxes' ids and words,
        // so a call after it changes the box it means: "Welcome" went in
        // second, and "First" then went in front of it.
        expect(change.result).toEqual({
            added: [2, 1],
            slideCount: 3,
            slides: [
                {
                    slide: 3,
                    boxes: [
                        { id: 1, text: '(no words)' },
                        { id: 2, text: 'Welcome' },
                    ],
                },
                { slide: 1, boxes: [{ id: 1, text: 'First' }] },
            ],
        });
        const [first, old, welcome] = change.json.items;
        expect(first.canvasItems[0].text).toBe('First');
        expect(old).toBe(json.items[0]);
        // The document's own slide size, never the default.
        expect(welcome.metadata).toEqual({ width: 1920, height: 1080 });
        expect(welcome.canvasItems[0]).toMatchObject({
            id: 1,
            text: '',
            left: 0,
            width: 1920,
            backgroundColor: '#123456',
        });
        expect(welcome.canvasItems[1]).toMatchObject({
            id: 2,
            text: 'Welcome',
            fontWeight: 'bold',
        });
        // Every slide a new id, and every box written checked.
        expect(new Set([first.id, old.id, welcome.id]).size).toBe(3);
        expect(change.checkItems).toHaveLength(3);
    });
});

describe('reading a document whole', () => {
    it('cuts a box at 300 characters unless whole words are asked for', () => {
        const json = genDocument(1);
        const longText = 'word '.repeat(200).trim();
        json.items[0].canvasItems[0].text = longText;
        const cut = readAgentSlideDocument(json, 'Sunday', {
            specs: [],
        }) as any;
        expect(cut.slideDocument.slides[0].items[0]).toMatchObject({
            isTextCut: true,
        });
        const whole = readAgentSlideDocument(
            json,
            'Sunday',
            { specs: [] },
            AGENT_SLIDE_LIMITS.fullTextChars,
        ) as any;
        expect(whole.slideDocument.slides[0].items[0].text).toBe(longText);
        expect(whole.slideDocument.slides[0].items[0].isTextCut).toBe(
            undefined,
        );
    });
});

describe('rounded corners', () => {
    it('are written as the editor rounds a box, and read back', () => {
        // A picture's rounded band had come out square (2026-11-07).
        const json = genDocument(1);
        (json.items[0].canvasItems[0] as any).roundSizePercentage = 40;
        const change = applyAgentSlideBatch(
            json,
            checkBatch([{ slide: 1, items: [{ id: 1, round: 24 }] }]),
            CONTEXT,
        ) as any;
        expect(change.json.items[0].canvasItems[0]).toMatchObject({
            roundSizePixel: 24,
            roundSizePercentage: 0,
        });
        const read = readAgentSlideDocument(change.json, 'Sunday', {
            specs: [],
        }) as any;
        expect(read.slideDocument.slides[0].items[0].round).toBe(24);
        expect(read.slideDocument.slides[0].items[1].round).toBe(undefined);
        expect(
            refusalOf([{ slide: 1, items: [{ id: 1, round: -1 }] }]),
        ).toMatch(/`round` is the corner rounding in pixels/);
    });
});

describe('a line break written out', () => {
    it('is the line break it meant, in every box a request writes', () => {
        expect(toRealLineBreaks('One\\nTwo\\r\\nThree')).toBe(
            'One\nTwo\nThree',
        );
        expect(toRealLineBreaks('Plain\nalready')).toBe('Plain\nalready');
        // As a model wrote it (gemma4:cloud, 2026-11-07): the JSON's own
        // escaping copied inside the words.
        expect(
            checkBatch([
                {
                    slide: 1,
                    items: [{ id: 1, text: 'Worship\\nin truth' }],
                },
            ]).changes[0].specs[0].text,
        ).toBe('Worship\nin truth');
    });
});
