import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getSlidesMock, varyAppDocumentFromFilePathMock } = vi.hoisted(() => {
    const getSlidesMock = vi.fn();
    return {
        getSlidesMock,
        varyAppDocumentFromFilePathMock: vi.fn(() => ({
            getSlides: getSlidesMock,
        })),
    };
});

// The real module pulls in every document kind; only these two are read.
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    checkIsLyricFilePath: (filePath: string) => filePath.endsWith('.owl'),
    varyAppDocumentFromFilePath: varyAppDocumentFromFilePathMock,
}));

vi.mock('../../lyric-list/LyricSlide', () => ({
    LYRIC_SLIDE_TYPE_KEY: 'lyric-slide',
}));

import {
    checkStageLookAheadData,
    genStageLookAheadData,
} from './screenStageLookAheadHelpers';

function genCanvasSlide(id: number, extra: Record<string, unknown> = {}) {
    const json = {
        id,
        type: 'slide',
        metadata: { width: 1920, height: 1080 },
        canvasItems: [
            { id: 0, type: 'text' },
            { id: 1, type: 'video' },
            { id: 2, type: 'image' },
        ],
    };
    return {
        id,
        name: '',
        isDisabled: false,
        ...extra,
        toJson: () => json,
    };
}

describe('genStageLookAheadData', () => {
    beforeEach(() => {
        getSlidesMock.mockReset();
        varyAppDocumentFromFilePathMock.mockClear();
    });

    test('stage 0 costs nothing: no document is opened', async () => {
        const data = await genStageLookAheadData(
            '/docs/a.ows',
            { id: 1 } as any,
            0,
        );
        expect(data).toBeUndefined();
        expect(varyAppDocumentFromFilePathMock).not.toHaveBeenCalled();
    });

    test('a song is rebuilt for its stage instead', async () => {
        expect(
            await genStageLookAheadData(
                '/docs/song.owl',
                { id: 1, type: 'lyric-slide', stage: 0 } as any,
                2,
            ),
        ).toBeUndefined();
        expect(
            await genStageLookAheadData('/docs/song.owl', { id: 1 } as any, 2),
        ).toBeUndefined();
        expect(varyAppDocumentFromFilePathMock).not.toHaveBeenCalled();
    });

    test('stage 2 carries the count and the next slide, media left out', async () => {
        getSlidesMock.mockResolvedValue([
            genCanvasSlide(1),
            genCanvasSlide(2),
            genCanvasSlide(3),
        ]);
        const data = await genStageLookAheadData(
            '/docs/a.ows',
            { id: 2 } as any,
            2,
        );
        expect(data?.stage).toBe(2);
        expect(data?.label).toBe('2/3');
        expect(data?.sideList).toHaveLength(1);
        const side = data?.sideList[0];
        expect(side?.offset).toBe(1);
        expect(side?.label).toBe('3/3');
        expect((side?.itemJson as any).id).toBe(3);
        expect(
            (side?.itemJson as any).canvasItems.map((item: any) => item.type),
        ).toEqual(['text', 'image']);
    });

    test('the last slide has nothing next', async () => {
        getSlidesMock.mockResolvedValue([genCanvasSlide(1), genCanvasSlide(2)]);
        const data = await genStageLookAheadData(
            '/docs/a.ows',
            { id: 2 } as any,
            3,
        );
        expect(data?.sideList).toEqual([null, null]);
    });

    test('stage 4 has no count', async () => {
        getSlidesMock.mockResolvedValue([genCanvasSlide(1), genCanvasSlide(2)]);
        const data = await genStageLookAheadData(
            '/docs/a.ows',
            { id: 1 } as any,
            4,
        );
        expect(data?.label).toBeNull();
        expect(data?.sideList).toHaveLength(1);
        expect(data?.sideList[0]?.label).toBeNull();
    });

    test('a PowerPoint side slide drops its animation steps', async () => {
        const pptxJson = {
            id: 2,
            type: 'pptx-slide',
            subHtmlFilePaths: ['/a.html'],
            subHtmls: ['<p></p>'],
        };
        getSlidesMock.mockResolvedValue([
            genCanvasSlide(1),
            { id: 2, name: '', isDisabled: false, toJson: () => pptxJson },
        ]);
        const data = await genStageLookAheadData(
            '/docs/a.pptx',
            { id: 1 } as any,
            2,
        );
        expect(data?.sideList[0]?.itemJson).toMatchObject({
            subHtmlFilePaths: [],
            subHtmls: [],
        });
    });
});

describe('checkStageLookAheadData', () => {
    test('accepts what the presenter writes', () => {
        const data = {
            stage: 2,
            label: '1/2',
            sideList: [{ offset: 1, itemJson: { id: 2 } }, null],
        };
        expect(checkStageLookAheadData(data)).toBe(data);
    });

    test('accepts a side saved before sides had a count', () => {
        const data = {
            stage: 2,
            label: '1/2',
            sideList: [{ offset: 1, itemJson: { id: 2 } }],
        };
        expect(checkStageLookAheadData(data)).toBe(data);
        expect(
            checkStageLookAheadData({
                ...data,
                sideList: [{ offset: 1, itemJson: { id: 2 }, label: 5 }],
            }),
        ).toBeNull();
    });

    test('rejects anything else, so the slide draws as it is', () => {
        expect(checkStageLookAheadData(undefined)).toBeNull();
        expect(checkStageLookAheadData({ stage: '2' })).toBeNull();
        expect(
            checkStageLookAheadData({ stage: 2, label: 3, sideList: [] }),
        ).toBeNull();
        expect(
            checkStageLookAheadData({
                stage: 2,
                label: null,
                sideList: [{ offset: 1 }],
            }),
        ).toBeNull();
    });
});
