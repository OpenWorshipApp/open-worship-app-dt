/**
 * The slide-action rules the sibling suite leaves out: every field's bound,
 * the malformed-`items` refusals, the alignment words both ways, a box's
 * source named without its path, a cut that never splits a character, and
 * the guards each change keeps when it is called with less than a checked
 * request gives it. Pure: no app, no document class.
 */
import { describe, expect, test } from 'vitest';

import {
    AGENT_SLIDE_LIMITS,
    type AgentCheckedSlideRequestType,
    applyAgentSlideAction,
    checkIsAgentSlideAction,
    readAgentSlideDocument,
    readAgentSlideRequest,
} from './agentSlideHelpers';

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
};

const CONTEXT = {
    name: 'Sunday',
    genTextDefaults: () => structuredClone(TEXT_DEFAULTS),
    getDefaultDim: () => ({ width: 1280, height: 720 }),
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

function genDocument(slides: unknown[]) {
    return {
        metadata: { app: 'OpenWorship', fileVersion: 1, initDate: 'x' },
        items: slides,
    };
}

function genSlide(id: number, canvasItems: unknown[], withSize = true) {
    return {
        id,
        ...(withSize ? { metadata: { width: 1920, height: 1080 } } : {}),
        canvasItems,
    };
}

function refusalOf(action: any, request: Record<string, unknown>) {
    const checked = readAgentSlideRequest(action, request);
    return checked.isError === true ? checked.reason : null;
}

function checked(action: any, request: Record<string, unknown>) {
    const result = readAgentSlideRequest(action, request);
    if (result.isError === true) {
        throw new Error(result.reason);
    }
    return result as AgentCheckedSlideRequestType;
}

function changeOf(
    action: any,
    json: any,
    request: AgentCheckedSlideRequestType,
) {
    const change = applyAgentSlideAction(action, json, request, CONTEXT);
    if (change.isError === true) {
        throw new Error(change.reason);
    }
    return change;
}

test('only the six slide actions are slide actions', () => {
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
    for (const action of ['list', 'update', undefined, 3]) {
        expect(checkIsAgentSlideAction(action)).toBe(false);
    }
});

describe('a box field outside what the app can hold is refused, by name', () => {
    test.each([
        ['text', 7, '`text` is the words, as a string'],
        [
            'text',
            'x'.repeat(AGENT_SLIDE_LIMITS.textChars + 1),
            `\`text\` is at most ${AGENT_SLIDE_LIMITS.textChars} characters`,
        ],
        [
            'fontSize',
            AGENT_SLIDE_LIMITS.fontSizeMax + 1,
            '`fontSize` is pixels',
        ],
        ['fontFamily', 12, '`fontFamily` is a name, or "" for the default'],
        [
            'fontWeight',
            'b'.repeat(AGENT_SLIDE_LIMITS.fontNameChars + 1),
            '`fontWeight` is a name',
        ],
        [
            'backgroundColor',
            'blue',
            '`backgroundColor` is a color written #RRGGBB',
        ],
        ['align', 'justify', '`align` is left, center or right'],
        [
            'left',
            AGENT_SLIDE_LIMITS.boxMax + 1,
            "`left` is pixels from the slide's left edge",
        ],
        ['top', Number.NaN, "`top` is pixels from the slide's top edge"],
        ['width', 0, '`width` is pixels, at least 1'],
        [
            'height',
            AGENT_SLIDE_LIMITS.boxMax + 1,
            '`height` is pixels, at least 1',
        ],
        ['rotate', AGENT_SLIDE_LIMITS.rotateMax + 1, '`rotate` is degrees'],
        ['id', 1.5, '`id` is the number of a box'],
        ['remove', 'yes', '`remove` is true or false'],
    ])('%s: %o', (key, value, says) => {
        expect(
            refusalOf('update-slide', {
                slide: 1,
                items: [{ id: 1, [key]: value }],
            }),
        ).toContain(says);
    });

    test('values at the edges of the bounds are taken', () => {
        expect(
            checked('update-slide', {
                slide: 1,
                items: [
                    {
                        id: 1,
                        fontSize: AGENT_SLIDE_LIMITS.fontSizeMax,
                        width: 1,
                        rotate: -AGENT_SLIDE_LIMITS.rotateMax,
                        left: -AGENT_SLIDE_LIMITS.boxMax,
                        fontFamily: '',
                        backgroundColor: '#00000080',
                    },
                ],
            }).specs,
        ).toHaveLength(1);
    });
});

describe('a malformed request is refused before the document is read', () => {
    test.each([
        [
            'delete-slide',
            { slide: 1, items: [{ id: 1 }] },
            '`items` is for add-slide and update-slide; delete-slide does not take any.',
        ],
        [
            'update-slide',
            { slide: 1, items: { id: 1 } },
            '`items` is a list of boxes.',
        ],
        [
            'update-slide',
            { slide: 1, items: [] },
            'update-slide needs at least one box in `items`.',
        ],
        [
            'add-slide',
            { items: ['Welcome'] },
            'Box 1 of `items` is not a box: each one is an object like {"text": "Welcome"}.',
        ],
        [
            'update-slide',
            { slide: 1, items: [{ remove: true }] },
            'Box 1 of `items`: `remove` needs the `id` of the box to take off.',
        ],
        [
            'add-slide',
            { items: [{ text: undefined }] },
            'Box 1 of `items` is empty -- a new text box needs at least one field, such as its `text`.',
        ],
        [
            'update-slide',
            {
                slide: 1,
                items: [
                    { id: 2, text: 'a' },
                    { id: 2, text: 'b' },
                ],
            },
            'Box 2 of `items` names box 2 a second time -- give each box one entry.',
        ],
        [
            'move-slide',
            { slide: 1, to: 0 },
            '`to` is a position, counting from 1 -- like 2.',
        ],
        [
            'add-slide',
            { slide: 1, to: 2 },
            '`to` is for move-slide -- add-slide takes the position for the new slide as `slide`.',
        ],
        [
            'delete-slide',
            { slide: 1, to: 2 },
            '`to` is for move-slide; delete-slide does not take it.',
        ],
    ])('%s %o', (action, request, reason) => {
        expect(refusalOf(action, request)).toBe(reason);
    });

    test('a request that is not there at all is a request with nothing in it', () => {
        expect(readAgentSlideRequest('slides', null)).toEqual({ specs: [] });
        expect(refusalOf('duplicate-slide', undefined as never)).toContain(
            'duplicate-slide needs `slide`',
        );
    });
});

describe('what `slides` says', () => {
    test('a document with no slides, or a slide past its end, is refused with what there is', () => {
        expect(
            readAgentSlideDocument(
                genDocument([]),
                'Sunday',
                checked('slides', { slide: 1 }),
            ),
        ).toEqual({
            isError: true,
            reason:
                '"Sunday" has no slides yet, so there is no slide 1 -- add one ' +
                'with action "add-slide".',
        });
        expect(
            readAgentSlideDocument(
                genDocument([genSlide(1, [])]),
                'Sunday',
                checked('slides', { slide: 3 }),
            ),
        ).toEqual({
            isError: true,
            reason: 'There is no slide 3 in "Sunday": it has 1 slide, numbered 1.',
        });
    });

    test('alignment is said in a person’s words, and a value the editor does not use is said as none', () => {
        const read = readAgentSlideDocument(
            genDocument([
                genSlide(1, [
                    genTextBox(1, {
                        textVerticalAlignment: 'end',
                        textHorizontalAlignment: 'right',
                    }),
                    genTextBox(2, {
                        textVerticalAlignment: 'start',
                        textHorizontalAlignment: 'middle',
                    }),
                    genTextBox(3, { textVerticalAlignment: 'baseline' }),
                ]),
            ]),
            'Sunday',
            checked('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        expect(
            read.slideDocument.slides[0].items.map((item: any) => [
                item.align,
                item.valign,
            ]),
        ).toEqual([
            ['right', 'bottom'],
            [null, 'top'],
            ['center', null],
        ]);
    });

    test('a box’s source is a web address as it is, or a file’s name only', () => {
        const read = readAgentSlideDocument(
            genDocument([
                genSlide(1, [
                    {
                        ...genTextBox(1),
                        type: 'youtube',
                        url: 'https://www.youtube.com/watch?v=abc',
                    },
                    {
                        ...genTextBox(2),
                        type: 'audio',
                        filePath: 'file:///C:/Users/racky/My%20Hymn.mp3?t=1#x',
                    },
                    {
                        ...genTextBox(3),
                        type: 'video',
                        // A broken escape is shown as it was written.
                        filePath: 'file:///C:/Users/racky/Bad%E0%A4%A.mp4',
                    },
                    { ...genTextBox(4), type: 'website', url: '' },
                ]),
            ]),
            'Sunday',
            checked('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        const [youtube, audio, video, website] =
            read.slideDocument.slides[0].items;
        expect(youtube).toMatchObject({
            url: 'https://www.youtube.com/watch?v=abc',
        });
        expect(audio).toMatchObject({ file: 'My Hymn.mp3' });
        expect(video).toMatchObject({ file: 'Bad%E0%A4%A.mp4' });
        expect(website).not.toHaveProperty('url');
        expect(JSON.stringify(read)).not.toContain('racky');
    });

    test('a long text is never cut through the middle of a character', () => {
        const limit = AGENT_SLIDE_LIMITS.shownTextChars;
        const read = readAgentSlideDocument(
            genDocument([
                genSlide(1, [
                    genTextBox(1, {
                        text: `${'x'.repeat(limit - 1)}😀 and more`,
                    }),
                ]),
            ]),
            'Sunday',
            checked('slides', {}),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        const [box] = read.slideDocument.slides[0].items;
        expect(box.text).toBe(`${'x'.repeat(limit - 1)}…`);
        expect(box.isTextCut).toBe(true);
    });

    test('a page asked from the middle says which slides it lists', () => {
        const read = readAgentSlideDocument(
            genDocument([genSlide(1, []), genSlide(2, []), 'not a slide']),
            'Sunday',
            checked('slides', { slide: 2 }),
        );
        if (read.isError === true) {
            throw new Error(read.reason);
        }
        expect(read.slideDocument.slides).toEqual([
            { number: 2, id: 2, items: [] },
            { number: 3, items: [] },
        ]);
        expect(read.slideDocument.note).toBe('Slides 2 to 3 of 3 are listed.');
    });
});

describe('changing a slide', () => {
    test('a box with an id on a slide with no boxes says the slide has none', () => {
        const change = applyAgentSlideAction(
            'update-slide',
            genDocument([genSlide(1, [])]),
            checked('update-slide', {
                slide: 1,
                items: [{ id: 4, text: 'x' }],
            }),
            CONTEXT,
        );
        expect(change).toEqual({
            isError: true,
            reason:
                'Box 1 of `items`: slide 1 has no box with id 4. It has no ' +
                'boxes -- one without an `id` is added as a new text box.',
        });
    });

    test('alignment is written as the editor reads it, and "" is the default font', () => {
        const change = changeOf(
            'update-slide',
            genDocument([
                genSlide(1, [
                    genTextBox(1, { fontFamily: 'Arial', fontWeight: 'bold' }),
                ]),
            ]),
            checked('update-slide', {
                slide: 1,
                items: [
                    {
                        id: 1,
                        align: 'left',
                        valign: 'bottom',
                        fontFamily: '',
                        fontWeight: '',
                    },
                ],
            }),
        );
        expect(change.didChange).toBe(true);
        expect(change.json.items[0].canvasItems[0]).toMatchObject({
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'end',
            fontFamily: null,
            fontWeight: null,
        });
        expect(change.checkItems[0].before).toMatchObject({
            fontFamily: 'Arial',
        });
    });

    test('a new box on a slide of no size of its own takes the first slide’s, then the app’s default', () => {
        const sized = changeOf(
            'update-slide',
            genDocument([genSlide(1, []), genSlide(2, [], false)]),
            checked('update-slide', { slide: 2, items: [{ text: 'Hi' }] }),
        );
        expect(sized.json.items[1].canvasItems[0]).toMatchObject({
            width: 1536,
            height: 324,
        });
        const unsized = changeOf(
            'update-slide',
            genDocument([genSlide(1, [], false)]),
            checked('update-slide', { slide: 1, items: [{ text: 'Hi' }] }),
        );
        expect(unsized.json.items[0].canvasItems[0]).toMatchObject({
            width: 1024,
            height: 216,
            left: 128,
            top: 252,
        });
    });

    test('moving a slide to where it already is changes nothing, and says so', () => {
        const json = genDocument([genSlide(1, []), genSlide(2, [])]);
        const change = changeOf(
            'move-slide',
            json,
            checked('move-slide', { slide: 2, to: 5 }),
        );
        expect(change).toEqual({
            didChange: false,
            json,
            summary: 'Moved slide 2 of “Sunday” to 2',
            checkItems: [],
            result: { moved: 2, to: 2, slideCount: 2 },
            note: 'Slide 2 is already at position 2, so nothing was moved.',
        });
    });

    test('called with less than a checked request gives, each change still refuses', () => {
        const json = genDocument([genSlide(1, [genTextBox(1)]), 'broken']);
        expect(
            applyAgentSlideAction('delete-slide', json, { specs: [] }, CONTEXT),
        ).toEqual({
            isError: true,
            reason: 'delete-slide needs `slide`: the number of the slide, counting from 1.',
        });
        expect(
            applyAgentSlideAction(
                'update-slide',
                json,
                { slide: 1, specs: [] },
                CONTEXT,
            ),
        ).toEqual({
            isError: true,
            reason: 'update-slide needs at least one box in `items`.',
        });
        expect(
            applyAgentSlideAction(
                'move-slide',
                json,
                { slide: 1, specs: [] },
                CONTEXT,
            ),
        ).toEqual({
            isError: true,
            reason:
                'move-slide needs `to`: the position to move the slide to, ' +
                'counting from 1.',
        });
        expect(
            applyAgentSlideAction(
                'duplicate-slide',
                json,
                { slide: 2, specs: [] },
                CONTEXT,
            ),
        ).toEqual({
            isError: true,
            reason: 'Slide 2 of "Sunday" could not be read, so it was not changed.',
        });
    });
});
