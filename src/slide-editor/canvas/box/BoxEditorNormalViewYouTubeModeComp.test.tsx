// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    validate: vi.fn(),
    handleError: vi.fn(),
}));

// The item class sits in the whole canvas-item graph; only its validation
// and embed address are read here.
vi.mock('../CanvasItemYouTube', () => ({
    default: {
        validate: h.validate,
        toEmbedUrl: (url: string) => `embed:${url}`,
    },
}));

vi.mock('../../../helper/errorHelpers', () => ({
    handleError: h.handleError,
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsContext: () => h.props,
}));

vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    BoxEditorNormalViewErrorRenderComp: () => <div data-error="">Error</div>,
}));

import { BoxEditorNormalYouTubeRenderComp } from './BoxEditorNormalViewYouTubeModeComp';
import { SlideThumbnailContext } from './slideThumbnailContext';

let container: HTMLDivElement;
let root: Root;

async function render(isThumbnail: boolean) {
    await act(async () => {
        root.render(
            <SlideThumbnailContext value={isThumbnail}>
                <BoxEditorNormalYouTubeRenderComp />
            </SlideThumbnailContext>,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.validate.mockReset();
    h.handleError.mockReset();
    h.props = { id: 14, url: 'https://www.youtube.com/watch?v=abc123XYZ_-' };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxEditorNormalYouTubeRenderComp', () => {
    test('embeds the player in the editor without stealing the box clicks', async () => {
        await render(false);

        expect(h.validate).toHaveBeenCalledWith(h.props);
        const iframe = container.querySelector('iframe')!;
        expect(iframe.getAttribute('src')).toBe(
            'embed:https://www.youtube.com/watch?v=abc123XYZ_-',
        );
        expect(iframe.title).toBe('youtube-14');
        expect(iframe.getAttribute('referrerpolicy')).toBe(
            'strict-origin-when-cross-origin',
        );
        expect(iframe.getAttribute('allow')).toContain('autoplay');
        expect(iframe.getAttribute('loading')).toBe('lazy');
        const wrapper = iframe.parentElement!;
        expect(wrapper.title).toBe('14');
        expect(wrapper.style.pointerEvents).toBe('none');
        expect(container.querySelector('img')).toBeNull();
    });

    test("a thumbnail shows YouTube's still of the video, never a player", async () => {
        await render(true);

        expect(container.querySelector('iframe')).toBeNull();
        const image = container.querySelector('img')!;
        expect(image.getAttribute('src')).toBe(
            'https://i.ytimg.com/vi/abc123XYZ_-/hqdefault.jpg',
        );
        expect(image.getAttribute('loading')).toBe('lazy');
        // A play mark is drawn over it, and the address is not repeated.
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.textContent).not.toContain('youtube.com');
        expect(container.querySelector<HTMLDivElement>('[title]')!.title).toBe(
            'https://www.youtube.com/watch?v=abc123XYZ_-',
        );
    });

    test('a still that cannot load gives way to the play mark and the address', async () => {
        await render(true);

        await act(async () => {
            container.querySelector('img')!.dispatchEvent(new Event('error'));
        });

        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.textContent).toBe(
            'https://www.youtube.com/watch?v=abc123XYZ_-',
        );
    });

    test('a link with no video id shows the address straight away', async () => {
        h.props = { id: 15, url: 'https://www.youtube.com/@church-channel' };
        await render(true);

        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toBe(
            'https://www.youtube.com/@church-channel',
        );
    });

    test('invalid props fall back to the error view', async () => {
        const error = new Error('bad youtube');
        h.validate.mockImplementation(() => {
            throw error;
        });
        await render(false);

        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(container.querySelector('[data-error]')).not.toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
    });
});
