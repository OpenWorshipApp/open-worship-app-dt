// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    canvasItem: null as any,
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => h.canvasItem,
}));

// Every view is a probe naming itself: this suite is about which one a kind
// of item gets, the views have their own suites.
vi.mock('./BoxEditorNormalViewImageModeComp', () => ({
    BoxEditorNormalImageRenderComp: () => <i>image</i>,
}));
vi.mock('./BoxEditorNormalViewHtmlModeComp', () => ({
    BoxEditorNormalHtmlRenderComp: () => <i>html</i>,
}));
vi.mock('./BoxEditorNormalViewTextModeComp', () => ({
    BoxEditorNormalTextRenderComp: () => <i>text</i>,
}));
vi.mock('./BoxEditorNormalViewBibleModeComp', () => ({
    BoxEditorNormalBibleRenderComp: () => <i>bible</i>,
}));
vi.mock('./BoxEditorNormalViewVideoModeComp', () => ({
    BoxEditorNormalVideoRenderComp: () => <i>video</i>,
}));
vi.mock('./BoxEditorNormalViewAudioModeComp', () => ({
    BoxEditorNormalAudioRenderComp: () => <i>audio</i>,
}));
vi.mock('./BoxEditorNormalViewYouTubeModeComp', () => ({
    BoxEditorNormalYouTubeRenderComp: () => <i>youtube</i>,
}));
vi.mock('./BoxEditorNormalViewWebsiteModeComp', () => ({
    BoxEditorNormalWebsiteRenderComp: () => <i>website</i>,
}));
vi.mock('./BoxEditorNormalViewCameraModeComp', () => ({
    BoxEditorNormalCameraRenderComp: () => <i>camera</i>,
}));
vi.mock('./BoxEditorNormalViewErrorComp', () => ({
    BoxEditorNormalViewErrorRenderComp: () => <i>error</i>,
}));

import BoxEditorCanvasItemRenderComp from './BoxEditorCanvasItemRenderComp';

let container: HTMLDivElement;
let root: Root;

async function renderKind(type: string) {
    h.canvasItem = { id: 1, type };
    await act(async () => root.render(<BoxEditorCanvasItemRenderComp />));
    return container.textContent;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BoxEditorCanvasItemRenderComp', () => {
    test.each([
        'image',
        'video',
        'audio',
        'youtube',
        'website',
        'camera',
        'text',
        'html',
        'bible',
    ])('draws a %s item with its own view', async (type) => {
        expect(await renderKind(type)).toBe(type);
    });

    test.each(['error', 'unknown-kind'])(
        'draws a %s item as the error view',
        async (type) => {
            expect(await renderKind(type)).toBe('error');
        },
    );
});
