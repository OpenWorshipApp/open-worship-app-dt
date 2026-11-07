// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        captureWebScreenShot: vi.fn(),
        handleError: vi.fn(),
        getDefaultScreenDisplay: vi.fn(),
    };
});

vi.mock('../../helper/capturingHelpers', () => ({
    captureWebScreenShot: mocks.captureWebScreenShot,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('./screenHelpers', () => ({
    getDefaultScreenDisplay: mocks.getDefaultScreenDisplay,
}));

import {
    genWebBackgroundElement,
    genWebScreenShotElement,
    hydrateWebsiteFrames,
} from './screenWebsiteHelpers';
import {
    WEBSITE_IFRAME_REFERRER_POLICY,
    WEBSITE_IFRAME_SANDBOX,
} from '../../helper/constants';

const SHOT = 'data:image/png;base64,shot';

// The static shape a website canvas item ships in.
function genWebsiteFrame(url: string, captureSize?: string) {
    const frame = document.createElement('div');
    frame.setAttribute('data-website-item', '');
    frame.setAttribute('data-website-url', url);
    if (captureSize !== undefined) {
        frame.setAttribute('data-website-capture-size', captureSize);
    }
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-preview-only', '');
    placeholder.textContent = url;
    frame.appendChild(placeholder);
    document.body.appendChild(frame);
    return { frame, placeholder };
}

// The screenshot paths import `capturingHelpers` lazily: a few turns of the
// event loop let that import and the capture settle.
async function flushLazyWork() {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }
}

beforeEach(() => {
    mocks.captureWebScreenShot.mockResolvedValue(SHOT);
    mocks.getDefaultScreenDisplay.mockReturnValue({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    });
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('hydrateWebsiteFrames on the projected screen', () => {
    test('the live page replaces the placeholder, held non-interactive', () => {
        const { frame, placeholder } = genWebsiteFrame('https://a.example/');

        hydrateWebsiteFrames([frame], true);

        const iframes = frame.querySelectorAll('iframe');
        expect(iframes).toHaveLength(1);
        const [iframe] = Array.from(iframes);
        expect(iframe.src).toBe('https://a.example/');
        expect(iframe.title).toBe('https://a.example/');
        expect(iframe.getAttribute('sandbox')).toBe(WEBSITE_IFRAME_SANDBOX);
        expect(iframe.referrerPolicy).toBe(WEBSITE_IFRAME_REFERRER_POLICY);
        expect(iframe.style.pointerEvents).toBe('none');
        expect(iframe.style.position).toBe('absolute');
        // Hidden, not removed: it is the fallback if the page fails.
        expect(placeholder.style.display).toBe('none');
        expect(frame.contains(placeholder)).toBe(true);
        expect(mocks.captureWebScreenShot).not.toHaveBeenCalled();
    });

    test('a frame is hydrated once, and only a marked html frame with a url', () => {
        const { frame } = genWebsiteFrame('https://a.example/');
        const { frame: emptyFrame } = genWebsiteFrame('');
        const svgFrame = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        svgFrame.setAttribute('data-website-url', 'https://svg.example/');

        hydrateWebsiteFrames([frame, emptyFrame, svgFrame], true);
        hydrateWebsiteFrames([frame], true);

        expect(frame.querySelectorAll('iframe')).toHaveLength(1);
        expect(emptyFrame.querySelector('iframe')).toBeNull();
        expect(emptyFrame.dataset.websiteHydrated).toBeUndefined();
        expect(svgFrame.querySelector('iframe')).toBeNull();
    });
});

describe('hydrateWebsiteFrames on the mini screen', () => {
    test('paints the screenshot at the stamped capture size', async () => {
        const { frame, placeholder } = genWebsiteFrame(
            'https://a.example/',
            '640x360',
        );

        hydrateWebsiteFrames([frame], false);
        await flushLazyWork();

        expect(mocks.captureWebScreenShot).toHaveBeenCalledWith(
            'https://a.example/',
            { width: 640, height: 360, delay: 3000 },
        );
        const image = placeholder.querySelector('img');
        expect(image?.getAttribute('src')).toBe(SHOT);
        expect(image?.style.objectFit).toBe('fill');
        expect(placeholder.textContent).toBe('');
        // No live page until the operator hovers it.
        expect(frame.querySelector('iframe')).toBeNull();
    });

    test('no capture size means no screenshot at all', async () => {
        const { frame, placeholder } = genWebsiteFrame('https://a.example/');

        hydrateWebsiteFrames([frame], false);
        await flushLazyWork();

        expect(mocks.captureWebScreenShot).not.toHaveBeenCalled();
        expect(placeholder.textContent).toBe('https://a.example/');
    });

    test('a failed or empty capture keeps the globe-and-url fallback', async () => {
        const { frame: emptyShotFrame, placeholder: emptyShotPlaceholder } =
            genWebsiteFrame('https://empty.example/', '640x360');
        mocks.captureWebScreenShot.mockResolvedValueOnce('');
        hydrateWebsiteFrames([emptyShotFrame], false);
        await flushLazyWork();
        expect(emptyShotPlaceholder.querySelector('img')).toBeNull();
        expect(mocks.handleError).not.toHaveBeenCalled();

        const error = new Error('capture failed');
        const { frame: failingFrame, placeholder: failingPlaceholder } =
            genWebsiteFrame('https://fail.example/', '640x360');
        mocks.captureWebScreenShot.mockRejectedValueOnce(error);
        hydrateWebsiteFrames([failingFrame], false);
        await flushLazyWork();
        expect(failingPlaceholder.querySelector('img')).toBeNull();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });

    test('a placeholder removed before the shot lands gets nothing', async () => {
        const { frame, placeholder } = genWebsiteFrame(
            'https://a.example/',
            '640x360',
        );
        hydrateWebsiteFrames([frame], false);
        placeholder.remove();
        await flushLazyWork();

        expect(frame.querySelector('img')).toBeNull();
    });

    test('the page goes live only after the pointer rests on the box', async () => {
        vi.useFakeTimers();
        const { frame, placeholder } = genWebsiteFrame('https://a.example/');
        hydrateWebsiteFrames([frame], false);

        frame.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(999);
        expect(frame.querySelector('iframe')).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        const iframe = frame.querySelector('iframe')!;
        expect(iframe.style.pointerEvents).toBe('auto');
        expect(placeholder.style.display).toBe('none');

        // Already live: resting there again loads nothing more.
        frame.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(1000);
        expect(frame.querySelectorAll('iframe')).toHaveLength(1);

        // Moving onto the live iframe is not leaving the box.
        frame.dispatchEvent(
            new MouseEvent('mouseout', {
                bubbles: true,
                relatedTarget: iframe,
            }),
        );
        await vi.advanceTimersByTimeAsync(1000);
        expect(frame.querySelector('iframe')).toBe(iframe);

        // Leaving it tears the page down at once.
        frame.dispatchEvent(
            new MouseEvent('mouseout', {
                bubbles: true,
                relatedTarget: document.body,
            }),
        );
        expect(frame.querySelector('iframe')).toBeNull();
        expect(placeholder.style.display).toBe('');
    });

    test('crossing a box on the way past loads nothing', async () => {
        vi.useFakeTimers();
        const { frame } = genWebsiteFrame('https://a.example/');
        hydrateWebsiteFrames([frame], false);

        frame.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(500);
        frame.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(2000);

        expect(frame.querySelector('iframe')).toBeNull();
    });

    test('every box keeps its own hover timer', async () => {
        vi.useFakeTimers();
        const { frame: first } = genWebsiteFrame('https://a.example/');
        const { frame: second } = genWebsiteFrame('https://b.example/');
        hydrateWebsiteFrames([first, second], false);

        first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);
        second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(1000);

        // A shared timer would have cancelled the first box's swap.
        expect(first.querySelector('iframe')?.src).toBe('https://a.example/');
        expect(second.querySelector('iframe')?.src).toBe('https://b.example/');
    });
});

describe('genWebScreenShotElement', () => {
    test('fills itself with one screenshot taken at the asked size', async () => {
        const container = genWebScreenShotElement(
            'https://a.example/',
            async () => {
                return { width: 800, height: 600 };
            },
        );
        expect(container.style.width).toBe('100%');
        expect(container.style.height).toBe('100%');
        expect(container.style.overflow).toBe('hidden');
        expect(container.childElementCount).toBe(0);

        await flushLazyWork();

        expect(mocks.captureWebScreenShot).toHaveBeenCalledWith(
            'https://a.example/',
            { width: 800, height: 600, delay: 3000 },
        );
        const image = container.querySelector('img');
        expect(image?.getAttribute('src')).toBe(SHOT);
        expect(image?.style.objectFit).toBe('cover');
    });

    test('draws nothing when there is no shot, or the size cannot be had', async () => {
        mocks.captureWebScreenShot.mockResolvedValueOnce(null);
        const empty = genWebScreenShotElement('https://a.example/', () => {
            return { width: 800, height: 600 };
        });
        // One at a time: two concurrent dynamic imports of a `vi.mock`ed
        // module make vitest load the REAL module for the second one.
        await flushLazyWork();
        expect(empty.childElementCount).toBe(0);
        expect(mocks.captureWebScreenShot).toHaveBeenCalledTimes(1);

        const error = new Error('no displays');
        const failing = genWebScreenShotElement('https://b.example/', () => {
            throw error;
        });
        await flushLazyWork();

        expect(failing.childElementCount).toBe(0);
        expect(mocks.captureWebScreenShot).toHaveBeenCalledTimes(1);
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });
});

describe('genWebBackgroundElement', () => {
    test('the projected screen gets the live page', () => {
        const element = genWebBackgroundElement('https://bg.example/', true);

        expect(element).toBeInstanceOf(HTMLIFrameElement);
        const iframe = element as HTMLIFrameElement;
        expect(iframe.src).toBe('https://bg.example/');
        expect(iframe.style.width).toBe('100%');
        // Left exactly as it was projected: no sandbox added.
        expect(iframe.hasAttribute('sandbox')).toBe(false);
        expect(mocks.captureWebScreenShot).not.toHaveBeenCalled();
    });

    test('a mini screen gets a screenshot at the display bounds', async () => {
        const element = genWebBackgroundElement('https://bg.example/', false);
        expect(element).toBeInstanceOf(HTMLDivElement);

        await flushLazyWork();

        expect(mocks.getDefaultScreenDisplay).toHaveBeenCalled();
        expect(mocks.captureWebScreenShot).toHaveBeenCalledWith(
            'https://bg.example/',
            { width: 1920, height: 1080, delay: 3000 },
        );
        expect(element.querySelector('img')?.getAttribute('src')).toBe(SHOT);
    });
});
