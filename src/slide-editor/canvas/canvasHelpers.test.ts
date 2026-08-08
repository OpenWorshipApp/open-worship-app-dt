import { beforeEach, describe, expect, test, vi } from 'vitest';

const { isSupportedMimetypeMock, isSupportedExtMock } = vi.hoisted(() => ({
    isSupportedMimetypeMock: vi.fn(),
    isSupportedExtMock: vi.fn(),
}));

vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: isSupportedMimetypeMock,
    isSupportedExt: isSupportedExtMock,
}));

import {
    canvasItemList,
    checkIsSupportCanvasMediaType,
    checkIsSupportMediaType,
    cleanupProps,
    getRemoteMediaMimetypeName,
    genTextDefaultBoxStyle,
    hAlignmentList,
    tooling2BoxProps,
    vAlignmentList,
    validateCameraProps,
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
            'audio',
            'youtube',
            'website',
            'bible',
            'camera',
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

    test('accepts a camera identified by either its id or its label', () => {
        // Either half alone is enough: the id resolves now, the label still
        // resolves after Chromium has rotated the id.
        expect(() => {
            validateCameraProps({ deviceId: 'device-1', label: 'HD Webcam' });
        }).not.toThrow();
        expect(() => {
            validateCameraProps({ deviceId: 'device-1', label: '' });
        }).not.toThrow();
        expect(() => {
            validateCameraProps({ deviceId: '', label: 'HD Webcam' });
        }).not.toThrow();

        expect(() => {
            validateCameraProps({ deviceId: '', label: '' });
        }).toThrow('Invalid canvas item camera data');
        expect(() => {
            validateCameraProps({ label: 'HD Webcam' });
        }).toThrow('Invalid canvas item camera data');
        expect(() => {
            validateCameraProps({ deviceId: 42, label: 'HD Webcam' });
        }).toThrow('Invalid canvas item camera data');
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

    test('accepts audio only for the canvas-specific media check', () => {
        isSupportedMimetypeMock.mockImplementation(
            (_fileType: string, mimetypeName: string) => {
                return mimetypeName === 'audio';
            },
        );
        expect(checkIsSupportMediaType('audio/mpeg')).toBe(false);
        expect(checkIsSupportCanvasMediaType('audio/mpeg')).toBe(true);
    });

    test('resolves a link kind from its path extension alone', () => {
        isSupportedExtMock.mockImplementation(
            (fileFullName: string, mimetypeName: string) => {
                return fileFullName.endsWith(`.${mimetypeName}-ext`);
            },
        );
        expect(
            getRemoteMediaMimetypeName('https://a.com/x/song.audio-ext'),
        ).toBe('audio');
        // The name is url-decoded first, so a spaced file name still matches.
        expect(
            getRemoteMediaMimetypeName(
                'https://www.openworship.app/shared/videos/Pink%20motion.video-ext',
            ),
        ).toBe('video');
        expect(getRemoteMediaMimetypeName('https://a.com/x/doc.pdf')).toBe(
            null,
        );
        expect(getRemoteMediaMimetypeName('not a url')).toBe(null);
    });
});
