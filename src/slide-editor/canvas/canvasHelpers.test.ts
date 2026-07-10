import { beforeEach, describe, expect, test, vi } from 'vitest';

const { isSupportedMimetypeMock } = vi.hoisted(() => ({
    isSupportedMimetypeMock: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: isSupportedMimetypeMock,
}));

import {
    canvasItemList,
    checkIsSupportMediaType,
    cleanupProps,
    genTextDefaultBoxStyle,
    hAlignmentList,
    tooling2BoxProps,
    vAlignmentList,
    validateMediaProps,
} from './canvasHelpers';

describe('canvasHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isSupportedMimetypeMock.mockReturnValue(true);
    });

    test('validates media props and exports supported item and alignment lists', () => {
        expect(hAlignmentList).toEqual(['left', 'center', 'right']);
        expect(vAlignmentList).toEqual(['start', 'center', 'end']);
        expect(canvasItemList).toEqual([
            'text',
            'html',
            'image',
            'video',
            'bible',
            'error',
        ]);

        expect(() =>
            validateMediaProps({
                srcData: 'data:image/png;base64,image',
                mediaWidth: 320,
                mediaHeight: 180,
            }),
        ).not.toThrow();

        expect(() =>
            validateMediaProps({ mediaWidth: 320, mediaHeight: 180 }),
        ).toThrow('Invalid canvas item media data');
        expect(() =>
            validateMediaProps({
                srcData: 'data:image/png;base64,image',
                mediaWidth: '320',
                mediaHeight: 180,
            }),
        ).toThrow('Invalid canvas item media data');
        expect(() =>
            validateMediaProps({
                srcData: 'data:image/png;base64,image',
                mediaWidth: 320,
                mediaHeight: '180',
            }),
        ).toThrow('Invalid canvas item media data');
    });

    test('removes alignment tooling fields and preserves other properties', () => {
        const props = {
            top: 10,
            left: 20,
            horizontalAlignment: 'center',
            verticalAlignment: 'end',
            keep: 'value',
        };

        cleanupProps(props);

        expect(props).toEqual({
            top: 10,
            left: 20,
            keep: 'value',
        });
    });

    test('converts tooling alignment data into box positions', () => {
        const state = {
            parentWidth: 1000,
            parentHeight: 800,
            width: 200,
            height: 100,
        };

        expect(tooling2BoxProps({}, state)).toEqual({
            top: 0,
            left: 0,
        });
        expect(
            tooling2BoxProps(
                {
                    top: 12,
                    left: 34,
                    verticalAlignment: 'start',
                    horizontalAlignment: 'left',
                },
                state,
            ),
        ).toEqual({
            top: 0,
            left: 0,
        });
        expect(
            tooling2BoxProps(
                {
                    verticalAlignment: 'center',
                    horizontalAlignment: 'center',
                },
                state,
            ),
        ).toEqual({
            top: 350,
            left: 400,
        });
        expect(
            tooling2BoxProps(
                {
                    verticalAlignment: 'end',
                    horizontalAlignment: 'right',
                },
                state,
            ),
        ).toEqual({
            top: 700,
            left: 800,
        });
    });

    test('generates default text box styles and delegates media support checks', () => {
        expect(genTextDefaultBoxStyle()).toEqual({
            id: -1,
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
        });
        expect(genTextDefaultBoxStyle(320, 180)).toEqual(
            expect.objectContaining({
                width: 320,
                height: 180,
            }),
        );

        // Falls through the image check to accept supported video types.
        isSupportedMimetypeMock.mockImplementation(
            (_fileType: string, mimetypeName: string) => {
                return mimetypeName === 'video';
            },
        );
        expect(checkIsSupportMediaType('video/mp4')).toBe(true);
        expect(isSupportedMimetypeMock).toHaveBeenCalledWith(
            'video/mp4',
            'image',
        );
        expect(isSupportedMimetypeMock).toHaveBeenCalledWith(
            'video/mp4',
            'video',
        );

        isSupportedMimetypeMock.mockReturnValue(false);
        expect(checkIsSupportMediaType('application/pdf')).toBe(false);
    });
});
