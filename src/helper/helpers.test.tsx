// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { handleErrorMock, appTraceMock, tranMock, appProviderMock } = vi.hoisted(
    () => ({
        handleErrorMock: vi.fn(),
        appTraceMock: vi.fn(),
        tranMock: vi.fn((value: string) => value),
        appProviderMock: {
            systemUtils: {
                isMac: false,
            },
        },
    }),
);

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./loggerHelpers', () => ({
    appTrace: appTraceMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

import {
    APP_AUTO_HIDE_CLASSNAME,
    APP_FULL_VIEW_CLASSNAME,
    BIBLE_VERSE_TEXT_TITLE,
    HIGHLIGHT_SELECTED_CLASSNAME,
    RECEIVING_DROP_CLASSNAME,
    bringDomToBottomView,
    bringDomToCenterView,
    bringDomToNearestView,
    bringDomToTopView,
    bringDomToView,
    changeDragEventStyle,
    checkIsSameArrays,
    checkIsSameObjects,
    checkIsSameValues,
    checkIsVerticalAtBottom,
    checkIsVerticalPartialInvisible,
    checkIsVerticalPartialVisible,
    cloneJson,
    cumulativeOffset,
    freezeObject,
    genRandomString,
    getHTMLChild,
    getImageDim,
    getMenuTitleRevealFile,
    getRandomColor,
    getRandomUUID,
    getRotationDeg,
    getVideoDim,
    getWindowDim,
    isColor,
    isValidJson,
    isVisible,
    removePX,
    stopDraggingState,
    toMaxId,
} from './helpers';

describe('helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appProviderMock.systemUtils.isMac = false;
    });

    test('exports the expected helper constants', () => {
        expect(APP_FULL_VIEW_CLASSNAME).toBe('app-full-view');
        expect(APP_AUTO_HIDE_CLASSNAME).toBe('app-auto-hide');
        expect(RECEIVING_DROP_CLASSNAME).toBe('receiving-data-drop');
        expect(HIGHLIGHT_SELECTED_CLASSNAME).toBe('app-highlight-selected');
        expect(BIBLE_VERSE_TEXT_TITLE).toContain('Click on verse');
    });

    test('generates deterministic random helper output when randomness is mocked', () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

        expect(getRandomColor()).toBe('#000000');
        expect(genRandomString(4)).toBe('AAAA');
        expect(getRandomUUID()).toBe('kf12oi');

        randomSpy.mockRestore();
        nowSpy.mockRestore();
    });

    test('clones, freezes, and compares nested JSON structures', () => {
        const original = {
            nested: { value: 1 },
            items: [1, { ok: true }],
        };
        const cloned = cloneJson(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.nested).not.toBe(original.nested);

        freezeObject(cloned);
        expect(Object.isFrozen(cloned)).toBe(true);
        expect(Object.isFrozen(cloned.nested)).toBe(true);
        expect(Object.isFrozen(cloned.items)).toBe(true);

        expect(checkIsSameArrays([{ ok: true }], [{ ok: true }])).toBe(true);
        expect(checkIsSameArrays([1], [2])).toBe(false);
        expect(
            checkIsSameObjects({ a: { b: 1 } }, { a: { b: 1 }, extra: true }),
        ).toBe(true);
        expect(checkIsSameObjects({ a: 1 }, { a: 2 })).toBe(false);
        expect(checkIsSameValues([{ ok: true }], [{ ok: true }])).toBe(true);
        expect(checkIsSameValues('a', 'b')).toBe(false);
    });

    test('extracts numeric and geometric helper values', () => {
        expect(getRotationDeg('transform: rotate(180deg)')).toBe(180);
        expect(getRotationDeg('transform:none')).toBe(0);
        expect(removePX('24px')).toBe(24);
        expect(toMaxId([3, 9, 1])).toBe(9);
        expect(toMaxId([])).toBe(0);
    });

    test('reads viewport dimensions and menu labels', () => {
        Object.defineProperty(globalThis, 'innerWidth', {
            configurable: true,
            value: 1280,
        });
        Object.defineProperty(globalThis, 'innerHeight', {
            configurable: true,
            value: 720,
        });

        expect(getWindowDim()).toEqual({ width: 1280, height: 720 });
        expect(getMenuTitleRevealFile()).toBe('Reveal in File Explorer');
        appProviderMock.systemUtils.isMac = true;
        expect(getMenuTitleRevealFile()).toBe('Reveal in Finder');
    });

    test('loads image and video dimensions and rejects failed media', async () => {
        const originalCreateElement = document.createElement.bind(document);
        const createdImages: any[] = [];
        const createdVideos: any[] = [];
        const createElementSpy = vi
            .spyOn(document, 'createElement')
            .mockImplementation(((tagName: string) => {
                const normalizedTagName = tagName.toLowerCase();
                if (normalizedTagName === 'img') {
                    const imageElement: any = {
                        naturalWidth: 640,
                        naturalHeight: 480,
                        onload: null,
                        onerror: null,
                    };
                    createdImages.push(imageElement);
                    return imageElement;
                }
                if (normalizedTagName === 'video') {
                    const videoElement: any = {
                        videoWidth: 1920,
                        videoHeight: 1080,
                        onerror: null,
                        addEventListener: (
                            eventName: string,
                            callback: (event: Event) => void,
                        ) => {
                            if (eventName === 'loadedmetadata') {
                                videoElement.loadedMetadata = callback;
                            }
                        },
                        removeEventListener: vi.fn(),
                    };
                    createdVideos.push(videoElement);
                    return videoElement;
                }
                return originalCreateElement(tagName);
            }) as typeof document.createElement);

        const goodImage = getImageDim('good.png');
        createdImages[0].onload?.(new Event('load'));
        await expect(goodImage).resolves.toEqual([640, 480]);

        const goodVideo = getVideoDim('good.mp4');
        createdVideos[0].loadedMetadata?.(new Event('loadedmetadata'));
        await expect(goodVideo).resolves.toEqual([1920, 1080]);

        const badImage = getImageDim('bad.png');
        createdImages[1].onerror?.(new Event('error'));
        await expect(badImage).rejects.toThrow('Fail to load image:bad.png');

        const badVideo = getVideoDim('bad.mp4');
        createdVideos[1].onerror?.(new Event('error'));
        await expect(badVideo).rejects.toThrow('Fail to load video:bad.mp4');

        createElementSpy.mockRestore();
    });

    test('validates JSON strings and reports invalid values', () => {
        expect(isValidJson('{"ok":true}')).toEqual({ ok: true });
        expect(isValidJson('', false)).toBe(false);
        expect(handleErrorMock).not.toHaveBeenCalled();
        expect(appTraceMock).not.toHaveBeenCalled();

        expect(isValidJson('bad-json', true)).toBe(false);
        expect(handleErrorMock).toHaveBeenCalledTimes(1);
        expect(appTraceMock).not.toHaveBeenCalled();
    });

    test('checks CSS colors and element visibility', () => {
        expect(isColor('red')).toBe(true);
        expect(isColor('not-a-real-color')).toBe(false);

        const visibleElement = document.createElement('div');
        Object.defineProperty(visibleElement, 'offsetWidth', {
            configurable: true,
            value: 100,
        });
        Object.defineProperty(visibleElement, 'offsetHeight', {
            configurable: true,
            value: 50,
        });
        visibleElement.getBoundingClientRect = () =>
            ({ top: 10, left: 10, width: 100, height: 50 }) as DOMRect;

        const computedStyleSpy = vi
            .spyOn(globalThis, 'getComputedStyle')
            .mockReturnValue({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
            } as any);
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: vi.fn(() => visibleElement),
        });

        expect(isVisible(visibleElement)).toBe(true);

        computedStyleSpy.mockReturnValue({
            display: 'none',
            visibility: 'visible',
            opacity: '1',
        } as any);
        expect(isVisible(visibleElement)).toBe(false);

        computedStyleSpy.mockRestore();
    });

    test('finds HTML children and computes element offsets', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '<span class="target"></span>';

        expect(getHTMLChild<HTMLSpanElement>(parent, '.target').className).toBe(
            'target',
        );
        expect(() => getHTMLChild(parent, '.missing')).toThrow('Invalid child');

        const root = document.createElement('div');
        const child = document.createElement('div');
        Object.defineProperty(root, 'offsetTop', {
            configurable: true,
            value: 10,
        });
        Object.defineProperty(root, 'offsetLeft', {
            configurable: true,
            value: 20,
        });
        Object.defineProperty(root, 'offsetParent', {
            configurable: true,
            value: null,
        });
        Object.defineProperty(child, 'offsetTop', {
            configurable: true,
            value: 5,
        });
        Object.defineProperty(child, 'offsetLeft', {
            configurable: true,
            value: 7,
        });
        Object.defineProperty(child, 'offsetParent', {
            configurable: true,
            value: root,
        });

        expect(cumulativeOffset(child)).toEqual({ top: 15, left: 27 });
    });

    test('updates drag styles and scrolling helpers', () => {
        const target = document.createElement('div');
        const dragEvent = {
            target,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as any;

        changeDragEventStyle(dragEvent, 'opacity', '0.5');
        expect(target.style.opacity).toBe('0.5');

        stopDraggingState(dragEvent);
        expect(dragEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(dragEvent.stopPropagation).toHaveBeenCalledTimes(1);
        expect(target.style.opacity).toBe('1');

        const scrollIntoView = vi.fn();
        const element = { scrollIntoView } as any;
        bringDomToView(element, 'center');
        bringDomToNearestView(element);
        bringDomToTopView(element);
        bringDomToCenterView(element);
        bringDomToBottomView(element);
        expect(scrollIntoView).toHaveBeenCalledTimes(5);
    });

    test('checks element visibility within vertical containers', () => {
        const container = document.createElement('div');
        const target = document.createElement('div');
        container.getBoundingClientRect = () =>
            ({ top: 0, bottom: 100 }) as DOMRect;
        target.getBoundingClientRect = () =>
            ({ top: 10, bottom: 90 }) as DOMRect;

        expect(checkIsVerticalPartialInvisible(container, target)).toBe(false);
        expect(checkIsVerticalPartialVisible(container, target)).toBe(true);
        expect(checkIsVerticalAtBottom(container, target)).toBe(false);

        target.getBoundingClientRect = () =>
            ({ top: -5, bottom: 120 }) as DOMRect;
        expect(checkIsVerticalPartialInvisible(container, target)).toBe(true);
        expect(checkIsVerticalAtBottom(container, target)).toBe(true);
    });
});
