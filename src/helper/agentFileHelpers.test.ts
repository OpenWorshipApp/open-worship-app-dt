import { beforeEach, describe, expect, test, vi } from 'vitest';

// A stand-in for the app's own validator with the two rules this check has
// to get right: the document metadata needs an `initDate`, and a slide needs
// an `id`.
const validateMock = vi.hoisted(() => {
    return vi.fn((json: any) => {
        if (typeof json.metadata?.initDate !== 'string') {
            throw new Error('Invalid data');
        }
        for (const item of json.items) {
            if (typeof item.id !== 'number') {
                throw new Error(
                    `Invalid slide data json:${JSON.stringify(item)}`,
                );
            }
        }
    });
});

const canvas = vi.hoisted(() => {
    // The canvas item classes, cut down to the rule that matters here: a box
    // missing a number field, or a text box missing its text or style, is
    // the red error box.
    class CanvasItemError {}
    const canvasItemFromJson = vi.fn((json: any) => {
        const isBoxOk = [
            'id',
            'top',
            'left',
            'rotate',
            'width',
            'height',
        ].every((key) => {
            return typeof json[key] === 'number';
        });
        const isTextOk =
            json.type !== 'text' ||
            (typeof json.text === 'string' &&
                typeof json.color === 'string' &&
                typeof json.fontSize === 'number');
        const isKnown = ['text', 'image'].includes(json.type);
        return isBoxOk && isTextOk && isKnown ? {} : new CanvasItemError();
    });
    return { CanvasItemError, canvasItemFromJson };
});
const createWithContentMock = vi.hoisted(() => {
    return vi.fn(async () => ({ name: 'created' }));
});

vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        validate: validateMock,
        createWithContent: createWithContentMock,
    },
}));
vi.mock('../slide-editor/canvas/Canvas', () => ({
    default: { canvasItemFromJson: canvas.canvasItemFromJson },
}));
vi.mock('../slide-editor/canvas/CanvasItem', () => ({
    CanvasItemError: canvas.CanvasItemError,
}));
vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        genDefaultItem: () => ({
            toJson: () => ({
                id: -1,
                type: 'text',
                text: 'Open Worship app',
                color: '#FFFFFF',
                fontSize: 60,
                fontFamily: null,
                fontWeight: null,
                top: 279,
                left: 356,
                width: 700,
                height: 400,
                rotate: 0,
                backgroundColor: '#0000008b',
            }),
        }),
    },
}));
vi.mock('../app-document-list/Slide', () => ({
    default: { getDefaultDim: () => ({ width: 1280, height: 720 }) },
}));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('./DirSource', () => ({ default: {} }));
vi.mock('./constants', () => ({ dirSourceSettingNames: {} }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(),
    fsListFilesWithMimetype: vi.fn(),
    getMimetypeExtensions: vi.fn(),
    pathJoin: vi.fn(),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: vi.fn(),
    genUndoField: vi.fn(),
    renameAgentFile: vi.fn(),
    runWithAgentBackup: vi.fn(),
    snapshotAgentEditing: vi.fn(),
    snapshotAgentFileForDelete: vi.fn(),
    trashAgentFile: vi.fn(),
}));
vi.mock('./agentSlideHelpers', async (importOriginal) => {
    // The box a text box is completed from is the pure module's own.
    const actual = await importOriginal<typeof import('./agentSlideHelpers')>();
    return {
        applyAgentSlideAction: vi.fn(),
        checkIsAgentSlideAction: vi.fn(),
        genAgentTextItem: actual.genAgentTextItem,
        readAgentSlideDocument: vi.fn(),
        readAgentSlideRequest: vi.fn(),
    };
});

import { AGENT_FILE_KIND_MAP } from './agentFileHelpers';

const checkContent = AGENT_FILE_KIND_MAP.slide.checkContent;

describe('slide document content check', () => {
    beforeEach(() => {
        validateMock.mockClear();
    });

    test('does not judge a partial document metadata it never writes', async () => {
        const content = JSON.stringify({
            metadata: { app: 'OpenWorship', fileVersion: 1 },
            items: [{ id: 1, canvasItems: [] }],
        });

        expect(await checkContent(content)).toBeNull();
    });

    test('names the slide the app refused', async () => {
        const content = JSON.stringify({
            items: [{ id: 1, canvasItems: [] }, { canvasItems: [] }],
        });

        const refusal = await checkContent(content);

        expect(refusal).toMatch(/^This app refused that document at slide 2: /);
    });

    test('still explains a missing items array before validating', async () => {
        expect(await checkContent('{"metadata":{}}')).toMatch(
            /There is no `items` array/,
        );
        expect(validateMock).not.toHaveBeenCalled();
    });
});

// T1 (robot run 2026-10-16): `create` wrote boxes missing canvas fields as
// given, and each rendered as the canvas's red error box.
describe('slide document boxes', () => {
    const slideOf = (canvasItems: unknown[]) => {
        return {
            id: 1,
            metadata: { width: 1920, height: 1080 },
            canvasItems,
        };
    };

    beforeEach(() => {
        canvas.canvasItemFromJson.mockClear();
        createWithContentMock.mockClear();
    });

    test('completes a text box written with only its words', async () => {
        const content = JSON.stringify({
            items: [slideOf([{ type: 'text', text: 'Amazing grace' }])],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);

        const items = (createWithContentMock.mock.calls[0] as any[])[2];
        const box = items[0].canvasItems[0];
        expect(box).toMatchObject({
            id: 1,
            type: 'text',
            text: 'Amazing grace',
            color: '#FFFFFF',
            fontFamily: null,
            backgroundColor: '#0000008b',
            // Centred on THIS slide, as add-slide places a new box.
            width: 1536,
            height: 324,
            left: 192,
            top: 378,
        });
    });

    test('keeps every field the caller wrote and numbers new boxes after the old', async () => {
        const content = JSON.stringify({
            items: [
                slideOf([
                    {
                        type: 'text',
                        text: 'Kept',
                        id: 4,
                        fontSize: 90,
                        left: 5,
                    },
                    { text: 'No type, still words' },
                ]),
            ],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);

        const [first, second] = (
            createWithContentMock.mock.calls[0] as any[]
        )[2][0].canvasItems;
        expect(first).toMatchObject({ id: 4, fontSize: 90, left: 5 });
        expect(second).toMatchObject({ id: 5, type: 'text' });
    });

    test('refuses a field written with the wrong type, by name', async () => {
        const content = JSON.stringify({
            items: [
                slideOf([]),
                slideOf([{ type: 'text', text: 'Hi', fontSize: 'big' }]),
            ],
        });

        const refusal = await checkContent(content);

        expect(refusal).toMatch(/^Box 1 of slide 2 \(type "text"\)/);
        expect(refusal).toContain('fontSize (a number)');
        expect(refusal).not.toContain('top (a number)');
    });

    test('refuses a picture box missing its place on the slide', async () => {
        const content = JSON.stringify({
            items: [slideOf([{ type: 'image', id: 1 }])],
        });

        const refusal = await checkContent(content);

        expect(refusal).toMatch(/^Box 1 of slide 1 \(type "image"\)/);
        expect(refusal).toContain('top (a number), left (a number)');
    });

    test('leaves complete boxes alone and reads no canvas class for none', async () => {
        const complete = {
            id: 1,
            type: 'text',
            text: 'Ready',
            color: '#000000',
            fontSize: 40,
            fontFamily: 'Arial',
            fontWeight: null,
            top: 0,
            left: 0,
            rotate: 0,
            width: 100,
            height: 50,
            backgroundColor: null,
            extra: 'kept as it was',
        };
        expect(
            await checkContent(
                JSON.stringify({ items: [slideOf([complete])] }),
            ),
        ).toBeNull();
        expect(canvas.canvasItemFromJson).toHaveBeenCalledExactlyOnceWith(
            complete,
        );

        canvas.canvasItemFromJson.mockClear();
        expect(
            await checkContent(JSON.stringify({ items: [slideOf([])] })),
        ).toBeNull();
        expect(canvas.canvasItemFromJson).not.toHaveBeenCalled();
    });

    test('a slide with no size of its own centres its new box on the app’s default slide', async () => {
        const content = JSON.stringify({
            items: [{ id: 1, canvasItems: [{ type: 'text', text: 'Hi' }] }],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);

        const box = (createWithContentMock.mock.calls[0] as any[])[2][0]
            .canvasItems[0];
        // 1280x720, the mocked `Slide.getDefaultDim()`.
        expect(box).toMatchObject({
            width: 1024,
            height: 216,
            left: 128,
            top: 252,
        });
    });

    test('only the partial boxes are completed; other slides and boxes are left as written', async () => {
        const complete = {
            id: 2,
            type: 'image',
            top: 1,
            left: 2,
            rotate: 0,
            width: 30,
            height: 40,
            backgroundColor: null,
        };
        const content = JSON.stringify({
            items: [
                { id: 1, canvasItems: [] },
                // No boxes at all: nothing to complete on it.
                { id: 2, metadata: { width: 1920, height: 1080 } },
                slideOf([complete, { type: 'text', text: 'New words' }]),
            ],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);

        const items = (createWithContentMock.mock.calls[0] as any[])[2];
        expect(items[0]).toEqual({ id: 1, canvasItems: [] });
        expect(items[1]).toEqual({
            id: 2,
            metadata: { width: 1920, height: 1080 },
        });
        expect(items[2].canvasItems[0]).toEqual(complete);
        // Numbered after the highest id already on the slide.
        expect(items[2].canvasItems[1]).toMatchObject({
            id: 3,
            type: 'text',
            text: 'New words',
        });
    });

    test('a slide that is not an object is left for the app’s validator to refuse', async () => {
        const refusal = await checkContent(
            JSON.stringify({
                items: [slideOf([{ type: 'text', text: 'Hi' }]), 'not a slide'],
            }),
        );

        expect(refusal).toMatch(/^This app refused that document at slide 2: /);
    });

    test('a text box with every field written, but of the wrong kinds, is refused by each field', async () => {
        const refusal = await checkContent(
            JSON.stringify({
                items: [
                    slideOf([
                        {
                            type: 'text',
                            id: 1,
                            top: 0,
                            left: 0,
                            rotate: 0,
                            width: 100,
                            height: 50,
                            backgroundColor: 7,
                            text: 7,
                            color: 255,
                            fontSize: 40,
                            fontFamily: 3,
                            fontWeight: false,
                        },
                    ]),
                ],
            }),
        );

        expect(refusal).toContain(
            'it needs backgroundColor (a colour like "#00000080", or null), ' +
                'text (a string), color (a colour like "#FFFFFF"), ' +
                'fontFamily (a string, or null), fontWeight (a string, or ' +
                'null).',
        );
    });

    test('a box of a kind the app does not draw, or no box at all, is named as unknown', async () => {
        const unknownKind = await checkContent(
            JSON.stringify({
                items: [
                    slideOf([
                        {
                            type: 'video-wall',
                            id: 1,
                            top: 0,
                            left: 0,
                            rotate: 0,
                            width: 1,
                            height: 1,
                            backgroundColor: null,
                        },
                    ]),
                ],
            }),
        );
        expect(unknownKind).toMatch(
            /^Box 1 of slide 1 \(type "video-wall"\) would not open .*Its type is not one this app draws/,
        );

        const notABox = await checkContent(
            JSON.stringify({ items: [slideOf(['just words'])] }),
        );
        expect(notABox).toMatch(/^Box 1 of slide 1 \(type "unknown"\)/);
    });
});

describe('slide document content edges', () => {
    beforeEach(() => {
        validateMock.mockClear();
        canvas.canvasItemFromJson.mockClear();
        createWithContentMock.mockClear();
    });

    const createdItems = () => {
        return (createWithContentMock.mock.calls[0] as any[])[2];
    };

    test('refuses content that is not JSON, naming the shape it wants', async () => {
        expect(await checkContent('{"items": [')).toMatch(
            /^That is not valid JSON\. Slide content is the document as JSON, with an `items` array/,
        );
        expect(validateMock).not.toHaveBeenCalled();
    });

    test('completes a box on a slide with no usable size at the default size', async () => {
        const content = JSON.stringify({
            items: [
                {
                    id: 1,
                    metadata: { width: 'wide', height: 1080 },
                    canvasItems: [{ type: 'text', text: 'Hi' }],
                },
            ],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);
        expect(createdItems()[0].canvasItems[0]).toMatchObject({
            id: 1,
            text: 'Hi',
            width: 1024,
            height: 216,
            left: 128,
            top: 252,
        });
    });

    test('leaves a slide with no boxes, and a box already whole, as they were', async () => {
        const whole = {
            id: 4,
            type: 'text',
            text: 'Ready',
            color: '#000000',
            fontSize: 40,
            fontFamily: 'Arial',
            fontWeight: null,
            top: 0,
            left: 0,
            rotate: 0,
            width: 100,
            height: 50,
            backgroundColor: null,
        };
        const bare = { id: 2, metadata: { width: 1920, height: 1080 } };
        const content = JSON.stringify({
            items: [
                {
                    id: 1,
                    metadata: { width: 1920, height: 1080 },
                    canvasItems: [whole, { type: 'text', text: 'New' }],
                },
                bare,
            ],
        });

        expect(await checkContent(content)).toBeNull();
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', content);
        const [first, second] = createdItems();
        expect(first.canvasItems[0]).toEqual(whole);
        // Numbered after the boxes already there.
        expect(first.canvasItems[1]).toMatchObject({
            id: 5,
            type: 'text',
            text: 'New',
        });
        expect(second).toEqual(bare);
    });

    test('never hands the app a missing slide list, whatever it was given', async () => {
        await AGENT_FILE_KIND_MAP.slide.create('/docs', 'Hymn', 'not json');
        await AGENT_FILE_KIND_MAP.slide.create(
            '/docs',
            'Hymn',
            '{"title":"no slides"}',
        );
        expect(createWithContentMock.mock.calls).toEqual([
            ['/docs', 'Hymn', []],
            ['/docs', 'Hymn', []],
        ]);
    });

    test('names every field of a text box written with the wrong type', async () => {
        const content = JSON.stringify({
            items: [
                {
                    id: 1,
                    canvasItems: [
                        {
                            id: 1,
                            type: 'text',
                            top: 0,
                            left: 0,
                            rotate: 0,
                            width: 10,
                            height: 10,
                            backgroundColor: 5,
                            text: 5,
                            color: 7,
                            fontSize: 40,
                            fontFamily: 3,
                            fontWeight: true,
                        },
                    ],
                },
            ],
        });

        expect(await checkContent(content)).toContain(
            'Box 1 of slide 1 (type "text") would not open in this app, so ' +
                'nothing was written: it needs backgroundColor (a colour like ' +
                '"#00000080", or null), text (a string), color (a colour like ' +
                '"#FFFFFF"), fontFamily (a string, or null), fontWeight (a ' +
                'string, or null).',
        );
    });

    test('names a box that is not an object by no type at all', async () => {
        const content = JSON.stringify({
            items: [{ id: 1, canvasItems: [5] }],
        });

        expect(await checkContent(content)).toMatch(
            /^Box 1 of slide 1 \(type "unknown"\) would not open in this app, so nothing was written\. Its type is not one this app draws/,
        );
        expect(canvas.canvasItemFromJson).not.toHaveBeenCalled();
    });
});
