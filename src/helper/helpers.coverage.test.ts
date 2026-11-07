// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock } = vi.hoisted(() => ({
    appProviderMock: {
        isPageScreen: false,
        systemUtils: { isMac: false, isDev: false },
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: () => {} }));
vi.mock('./loggerHelpers', () => ({
    appTrace: () => {},
    appWarning: () => {},
    appError: () => {},
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appProvider', () => ({ default: appProviderMock }));

import {
    changeDragEventStyle,
    checkIsSameArrays,
    checkIsSameObjects,
    checkIsSameValues,
    cumulativeOffset,
    getVideoDim,
    isVisible,
    pressElementLikeButton,
} from './helpers';

describe('isVisible', () => {
    const originalElementFromPoint = document.elementFromPoint;
    let element: HTMLElement;
    let style: { display: string; visibility: string; opacity: string };
    let rect: { top: number; left: number; width: number; height: number };
    let size: { width: number; height: number };

    beforeEach(() => {
        style = { display: 'block', visibility: 'visible', opacity: '1' };
        rect = { top: 10, left: 10, width: 100, height: 50 };
        size = { width: 100, height: 50 };
        element = document.createElement('div');
        document.body.appendChild(element);
        Object.defineProperty(element, 'offsetWidth', {
            configurable: true,
            get: () => size.width,
        });
        Object.defineProperty(element, 'offsetHeight', {
            configurable: true,
            get: () => size.height,
        });
        element.getBoundingClientRect = () => rect as DOMRect;
        vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
            () => style as any,
        );
        document.elementFromPoint = () => element;
    });

    afterEach(() => {
        document.elementFromPoint = originalElementFromPoint;
        document.body.innerHTML = '';
    });

    test('a laid-out element on top at its centre is visible', () => {
        expect(isVisible(element)).toBe(true);
    });

    test.each(['hidden', 'collapse'])(
        'visibility %s is not visible',
        (value) => {
            style.visibility = value;
            expect(isVisible(element)).toBe(false);
        },
    );

    test('a transparent element is not visible', () => {
        style.opacity = '0';
        expect(isVisible(element)).toBe(false);
    });

    // Found by UT-75 (2026-11-03): the opacity was read with `parseInt`, so
    // 0.5 and 0.9 were read as 0 and called invisible.
    test.each([
        ['0.5', true],
        ['0.9', true],
        ['0.1', true],
        ['0.05', false],
    ])('opacity %s is read as a fraction', (opacity, isShown) => {
        style.opacity = opacity;
        expect(isVisible(element)).toBe(isShown);
    });

    test('an element with no box is not visible', () => {
        size = { width: 0, height: 0 };
        rect = { top: 10, left: 10, width: 0, height: 0 };
        expect(isVisible(element)).toBe(false);
    });

    test.each([
        ['left of the window', { top: 10, left: -200 }],
        ['right of the window', { top: 10, left: window.innerWidth + 1 }],
        ['above the window', { top: -200, left: 10 }],
        ['below the window', { top: window.innerHeight + 1, left: 10 }],
    ])('an element %s is not visible', (_label, position) => {
        rect = { ...rect, ...position };
        expect(isVisible(element)).toBe(false);
    });

    test('the point may land on a child of the element', () => {
        const child = document.createElement('span');
        element.appendChild(child);
        document.elementFromPoint = () => child;
        expect(isVisible(element)).toBe(true);
    });

    test('covered by something else, it is not visible', () => {
        const overlay = document.createElement('div');
        document.body.appendChild(overlay);
        document.elementFromPoint = () => overlay;
        expect(isVisible(element)).toBe(false);
    });

    test('nothing at the point at all, it is not visible', () => {
        document.elementFromPoint = () => null;
        expect(isVisible(element)).toBe(false);
    });
});

describe('getVideoDim', () => {
    test('a second ask within the cache window does not load the video again', async () => {
        const videos: any[] = [];
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((
            tagName: string,
        ) => {
            if (tagName !== 'video') {
                return originalCreateElement(tagName);
            }
            const video: any = {
                videoWidth: 1280,
                videoHeight: 720,
                listeners: {} as Record<string, () => void>,
                addEventListener(name: string, listener: () => void) {
                    video.listeners[name] = listener;
                },
                removeEventListener(name: string) {
                    delete video.listeners[name];
                },
            };
            videos.push(video);
            return video;
        }) as typeof document.createElement);

        const first = getVideoDim('file:///cached.mp4');
        await vi.waitFor(() => {
            expect(videos).toHaveLength(1);
        });
        videos[0].listeners.loadedmetadata();
        await expect(first).resolves.toEqual([1280, 720]);
        // The metadata listener let itself go.
        expect(videos[0].listeners.loadedmetadata).toBeUndefined();

        await expect(getVideoDim('file:///cached.mp4')).resolves.toEqual([
            1280, 720,
        ]);
        expect(videos).toHaveLength(1);
    });
});

describe('structural comparisons', () => {
    test('anything that is not an array is not the same array', () => {
        expect(checkIsSameArrays([1], 'not an array')).toBe(false);
        expect(checkIsSameArrays({ length: 0 }, [])).toBe(false);
    });

    test('arrays of different lengths differ', () => {
        expect(checkIsSameArrays([1, 2], [1, 2, 3])).toBe(false);
        expect(checkIsSameValues([1, 2, 3], [1, 2])).toBe(false);
    });

    test('an object never equals a primitive', () => {
        expect(checkIsSameObjects({ a: 1 }, 1)).toBe(false);
        expect(checkIsSameObjects('a', { a: 1 })).toBe(false);
    });

    test('a nested object that differs makes the whole differ', () => {
        expect(
            checkIsSameObjects(
                { style: { color: 'red', size: 1 } },
                { style: { color: 'blue', size: 1 } },
            ),
        ).toBe(false);
        expect(
            checkIsSameObjects({ style: { color: 'red' } }, { style: null }),
        ).toBe(false);
        expect(
            checkIsSameObjects(
                { style: { color: 'red' } },
                { style: { color: 'red' } },
            ),
        ).toBe(true);
    });
});

describe('small DOM helpers', () => {
    test('cumulativeOffset of nothing is zero', () => {
        expect(cumulativeOffset(null)).toEqual({ top: 0, left: 0 });
    });

    test('a drag style is only set on an HTML element target', () => {
        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        changeDragEventStyle({ target: svg }, 'opacity', '0.5');
        expect(svg.getAttribute('style')).toBeNull();
        expect(() => {
            changeDragEventStyle({ target: null }, 'opacity', '0.5');
        }).not.toThrow();
    });
});

describe('pressElementLikeButton', () => {
    function genEvent(overrides: Record<string, unknown>) {
        return {
            key: 'Enter',
            preventDefault: vi.fn(),
            currentTarget: null as unknown,
            ...overrides,
        };
    }

    function genButtonLike() {
        const element = document.createElement('div');
        element.getBoundingClientRect = () =>
            ({ left: 10, top: 20, width: 40, height: 10 }) as DOMRect;
        const clicks: MouseEvent[] = [];
        element.addEventListener('click', (event) => {
            clicks.push(event);
        });
        return { element, clicks };
    }

    test.each(['Enter', ' '])('%j clicks at the element centre', (key) => {
        const { element, clicks } = genButtonLike();
        const event = genEvent({ key, currentTarget: element });
        expect(pressElementLikeButton(event)).toBe(true);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(clicks).toHaveLength(1);
        expect([clicks[0].clientX, clicks[0].clientY]).toEqual([30, 25]);
    });

    test('any other key does nothing', () => {
        const { element, clicks } = genButtonLike();
        const event = genEvent({ key: 'a', currentTarget: element });
        expect(pressElementLikeButton(event)).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(clicks).toHaveLength(0);
    });

    test('a held key does not fire over and over', () => {
        const { element, clicks } = genButtonLike();
        const event = genEvent({ repeat: true, currentTarget: element });
        expect(pressElementLikeButton(event)).toBe(false);
        expect(clicks).toHaveLength(0);
    });

    test('no element, or one that cannot be measured, does nothing', () => {
        const nullEvent = genEvent({ currentTarget: null });
        expect(pressElementLikeButton(nullEvent)).toBe(false);
        const plainEvent = genEvent({ currentTarget: {} });
        expect(pressElementLikeButton(plainEvent)).toBe(false);
        expect(plainEvent.preventDefault).not.toHaveBeenCalled();
    });
});
