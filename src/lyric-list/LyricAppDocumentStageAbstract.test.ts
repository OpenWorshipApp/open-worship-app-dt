import { describe, expect, test, vi } from 'vitest';

// Only the attachment → canvas-item dispatch is under test here, so the heavy
// half of the module graph (`AppDocument`, the open-lyric previewer, the
// element-map cache) is stubbed out. The canvas item classes are stubbed too:
// their `genCanvasItemPropsFromLink` factories are covered for real in
// `CanvasItemModels.test.ts`, and stubbing them keeps this a node-env test.
const mocks = vi.hoisted(() => ({
    imagePropsMock: vi.fn(() => ({ type: 'image' })),
    videoPropsMock: vi.fn(() => ({ type: 'video' })),
    audioPropsMock: vi.fn(() => ({ type: 'audio' })),
    youtubePropsMock: vi.fn(() => ({ type: 'youtube' })),
    websitePropsMock: vi.fn(() => ({ type: 'website' })),
}));

vi.mock('./LyricAppDocument', () => ({
    OPEN_LYRIC_NONE_KEY: 'None',
    default: class {},
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: vi.fn(),
    unlockingCacher: vi.fn(),
}));

vi.mock('../others/CacheManager', () => ({
    default: class {},
}));

vi.mock('./lyricHelpers', () => ({
    DEFAULT_OPEN_LYRIC_FONT_SIZE: 16,
    getOpenLyricFontSetting: vi.fn(),
}));

vi.mock('../slide-editor/canvas/CanvasItemImage', () => ({
    default: { genCanvasItemPropsFromLink: mocks.imagePropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemVideo', () => ({
    default: { genCanvasItemPropsFromLink: mocks.videoPropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemAudio', () => ({
    default: { genCanvasItemPropsFromLink: mocks.audioPropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemYouTube', () => ({
    default: { genCanvasItemPropsFromLink: mocks.youtubePropsMock },
}));

vi.mock('../slide-editor/canvas/CanvasItemWebsite', () => ({
    default: { genCanvasItemPropsFromLink: mocks.websitePropsMock },
}));

import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';

const BOX_PROPS = {
    id: -1,
    top: 19,
    left: 19,
    rotate: 0,
    width: 1882,
    height: 1042,
    backgroundColor: '#00000000',
    backdropFilter: 0,
    roundSizePercentage: 0,
    roundSizePixel: 0,
    locked: true,
};

const CANVAS_ITEM_BOUNDS = { x: 19, y: 19, width: 1882, height: 1042 };

// The method reaches `this.genCanvasItemBoundsProps` (on `LyricAppDocument`,
// stubbed above), so it is called against a minimal `this` rather than a real
// document instance.
function genPropsFromAttachment(attachment: any) {
    const genCanvasItemBoundsProps = vi.fn(() => BOX_PROPS);
    const result =
        LyricAppDocumentStageAbstract.prototype.genCanvasItemPropsFromAttachment.call(
            { genCanvasItemBoundsProps } as any,
            attachment,
            CANVAS_ITEM_BOUNDS as any,
        );
    return { result, genCanvasItemBoundsProps };
}

describe('LyricAppDocumentStageAbstract attachments', () => {
    test('gives every attachment kind the whole slide as its box', () => {
        const { result, genCanvasItemBoundsProps } = genPropsFromAttachment({
            title: 'Backing track',
            type: 'audio',
            link: 'https://www.openworship.app/shared/audios/Doxology.mp3',
        });

        expect(result).toEqual({ type: 'audio' });
        // id -1, LOCKED, and the bounds handed in rather than re-read.
        expect(genCanvasItemBoundsProps).toHaveBeenCalledWith(
            -1,
            true,
            CANVAS_ITEM_BOUNDS,
        );
        expect(mocks.audioPropsMock).toHaveBeenCalledWith(
            'https://www.openworship.app/shared/audios/Doxology.mp3',
            BOX_PROPS,
        );
    });

    test('dispatches each attachment type to its own canvas item class', () => {
        const cases = [
            ['youtube', 'https://www.youtube.com/watch?v=abc', 'youtube'],
            ['image', 'https://a.com/chart.png', 'image'],
            ['video', 'https://a.com/clip.mp4', 'video'],
            ['audio', 'https://a.com/track.mp3', 'audio'],
            // Anything else that IS a url becomes the page it is.
            ['other', 'https://a.com/lyrics', 'website'],
        ] as const;

        for (const [type, link, expectedType] of cases) {
            const { result } = genPropsFromAttachment({
                title: 't',
                type,
                link,
            });
            expect(result).toEqual({ type: expectedType });
        }
    });

    test('a `file://` attachment is dispatched like any other url', () => {
        // How a chart or a backing track on the operator's own machine travels
        // with the song; open-lyric writes it as a url, not as a path.
        const { result } = genPropsFromAttachment({
            title: 'Chart',
            type: 'image',
            link: 'file:///C:/songs/chart.png',
        });
        expect(result).toEqual({ type: 'image' });
        expect(mocks.imagePropsMock).toHaveBeenCalledWith(
            'file:///C:/songs/chart.png',
            BOX_PROPS,
        );
    });

    test('refuses a pdf and anything whose link is not a url', () => {
        // A pdf link is a real url but has no canvas item yet.
        expect(
            genPropsFromAttachment({
                title: 'Handout',
                type: 'pdf',
                link: 'https://a.com/handout.pdf',
            }).result,
        ).toBeNull();

        // open-lyric falls back to `other` with the RAW TEXT as `link` when the
        // line does not parse as a url. Without the gate this would become a
        // website iframe pointed at a relative path, on a projected screen.
        for (const attachment of [
            { title: 'Note', type: 'other', link: 'see the songbook' },
            { title: 'Old', type: 'other', link: 'ftp://a.com/x.mp3' },
            { title: 'Inline', type: 'image', link: 'data:image/png;base64,a' },
            { title: 'Path', type: 'audio', link: 'C:\\songs\\track.mp3' },
            { title: 'Empty', type: 'video', link: '' },
        ]) {
            expect(genPropsFromAttachment(attachment).result).toBeNull();
        }

        expect(mocks.websitePropsMock).not.toHaveBeenCalled();
        expect(mocks.imagePropsMock).not.toHaveBeenCalled();
        expect(mocks.audioPropsMock).not.toHaveBeenCalled();
        expect(mocks.videoPropsMock).not.toHaveBeenCalled();
    });
});
