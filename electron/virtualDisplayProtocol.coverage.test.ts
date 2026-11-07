import { describe, expect, test } from 'vitest';

import {
    checkIsVirtualDisplayDevViewerFile,
    readBasicAuthPassword,
    readScreenMessageCameras,
    readVirtualDisplayViewerFeedback,
    toVirtualDisplayCameraId,
} from './virtualDisplayProtocol';

// What a browser viewer of a virtual display may send back, and what a screen
// message says about cameras: everything here arrives from a page this
// computer does not control, so each check is a door.

describe('readVirtualDisplayViewerFeedback', () => {
    test('a verse tapped on the viewer is passed on, rebuilt', () => {
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'bible-screen-view-selected-index',
                data: { selectedKJVVerseKey: 'JHN 3:16', extra: 'dropped' },
            }),
        ).toEqual({
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'JHN 3:16' },
        });
        // Nothing selected is an answer too.
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'bible-screen-view-selected-index',
                data: { selectedKJVVerseKey: null },
            }),
        ).toEqual({
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: null },
        });
    });

    test('a verse key that is no verse key is refused', () => {
        for (const selectedKJVVerseKey of [
            '<img src=x onerror=alert(1)>',
            'x'.repeat(65),
            '',
            42,
            undefined,
        ]) {
            expect(
                readVirtualDisplayViewerFeedback({
                    type: 'bible-screen-view-selected-index',
                    data: { selectedKJVVerseKey },
                }),
            ).toBeNull();
        }
    });

    test('a scroll of a screen container is passed on, sub-pixel kept', () => {
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'sync-scroll-percentage',
                data: {
                    domSelector: '.screen-bible-container-scroll',
                    scroll: { x: 0, y: 0.5, z: 9 },
                    isSubPixel: true,
                },
            }),
        ).toEqual({
            type: 'sync-scroll-percentage',
            data: {
                domSelector: '.screen-bible-container-scroll',
                scroll: { x: 0, y: 0.5 },
                isSubPixel: true,
            },
        });
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'sync-scroll-percentage',
                data: {
                    domSelector: '.screen-bible-column-12',
                    scroll: { x: 1, y: 1 },
                    isSubPixel: 'yes',
                },
            }),
        ).toEqual({
            type: 'sync-scroll-percentage',
            data: {
                domSelector: '.screen-bible-column-12',
                scroll: { x: 1, y: 1 },
            },
        });
    });

    test('a scroll of anything else, or past the ends, is refused', () => {
        const scrollOf = (domSelector: unknown, scroll: unknown) => {
            return readVirtualDisplayViewerFeedback({
                type: 'sync-scroll-percentage',
                data: { domSelector, scroll },
            });
        };
        expect(scrollOf('body', { x: 0, y: 0 })).toBeNull();
        expect(scrollOf('.screen-bible-column-123', { x: 0, y: 0 })).toBeNull();
        expect(scrollOf(7, { x: 0, y: 0 })).toBeNull();
        expect(scrollOf('.half-scale-container', null)).toBeNull();
        expect(scrollOf('.half-scale-container', 'down')).toBeNull();
        expect(scrollOf('.half-scale-container', { x: -0.1, y: 0 })).toBeNull();
        expect(scrollOf('.half-scale-container', { x: 0, y: 1.5 })).toBeNull();
        expect(
            scrollOf('.half-scale-container', { x: 0, y: Number.NaN }),
        ).toBeNull();
        expect(scrollOf('.half-scale-container', { x: '0', y: 0 })).toBeNull();
    });

    test('what is not a feedback message at all is refused', () => {
        expect(readVirtualDisplayViewerFeedback(null)).toBeNull();
        expect(readVirtualDisplayViewerFeedback('visible')).toBeNull();
        expect(
            readVirtualDisplayViewerFeedback({ type: 'visible', data: null }),
        ).toBeNull();
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'sync-scroll-percentage',
                data: 'scroll',
            }),
        ).toBeNull();
        // `visible` would hide the operator's screen; it is never passed on.
        expect(
            readVirtualDisplayViewerFeedback({
                type: 'visible',
                data: { isShowing: false },
            }),
        ).toBeNull();
    });
});

describe('readScreenMessageCameras', () => {
    test('a foreground names the cameras of its overlay, and only real ones', () => {
        expect(
            readScreenMessageCameras({
                type: 'foreground',
                data: {
                    cameraDataList: [
                        { id: 'cam-1', label: 'Front' },
                        { id: 'cam-2', label: 42 },
                        { id: '', label: 'empty id' },
                        { id: 'x'.repeat(513), label: 'too long' },
                        null,
                        { label: 'no id' },
                    ],
                },
            }),
        ).toEqual({
            layer: 'foreground',
            cameras: [
                { id: 'cam-1', label: 'Front' },
                { id: 'cam-2', label: '' },
            ],
        });
    });

    test('a foreground with no camera list puts no camera up', () => {
        expect(
            readScreenMessageCameras({ type: 'foreground', data: {} }),
        ).toEqual({ layer: 'foreground', cameras: [] });
        expect(
            readScreenMessageCameras({
                type: 'foreground',
                data: { cameraDataList: 'cam-1' },
            }),
        ).toEqual({ layer: 'foreground', cameras: [] });
        expect(readScreenMessageCameras({ type: 'foreground' })).toEqual({
            layer: 'foreground',
            cameras: [],
        });
    });

    test('a camera background names its camera; another background none', () => {
        expect(
            readScreenMessageCameras({
                type: 'background',
                data: { type: 'camera', src: 'cam-9', label: 'Stage' },
            }),
        ).toEqual({
            layer: 'background',
            cameras: [{ id: 'cam-9', label: 'Stage' }],
        });
        expect(
            readScreenMessageCameras({
                type: 'background',
                data: { type: 'image', src: '/slide.png' },
            }),
        ).toEqual({ layer: 'background', cameras: [] });
        expect(
            readScreenMessageCameras({
                type: 'background',
                data: { type: 'camera', src: '' },
            }),
        ).toEqual({ layer: 'background', cameras: [] });
        expect(readScreenMessageCameras({ type: 'background' })).toEqual({
            layer: 'background',
            cameras: [],
        });
    });

    test('any other message says nothing about cameras', () => {
        expect(
            readScreenMessageCameras({ type: 'slide', data: { cameras: [] } }),
        ).toBeNull();
        expect(readScreenMessageCameras({})).toBeNull();
    });

    test('a viewer names a camera in Screen Mirror’s remote form', () => {
        expect(toVirtualDisplayCameraId('host-1', 'cam-9')).toBe(
            'mirror-camera:host-1:cam-9',
        );
    });
});

describe('the doors a browser knocks on', () => {
    test('a Basic header that is base64 in form but not in fact gives no code', () => {
        // One character: the shape passes, decoding it does not.
        expect(readBasicAuthPassword('Basic A')).toBeNull();
    });

    test('a dev viewer address that cannot be decoded is refused', () => {
        expect(
            checkIsVirtualDisplayDevViewerFile(
                new URL('http://192.168.1.5:39240/src/%E0%A4%A.ts'),
                '/repo',
            ),
        ).toBe(false);
    });
});
