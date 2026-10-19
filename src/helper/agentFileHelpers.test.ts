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
});
