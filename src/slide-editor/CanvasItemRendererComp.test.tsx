import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { canvasItemState } = vi.hoisted(() => ({
    canvasItemState: {
        type: 'image',
    } as { type: string },
}));

vi.mock('./canvas/CanvasItem', () => ({
    useCanvasItemContext: () => canvasItemState,
}));

vi.mock('./canvas/box/BoxEditorNormalViewImageModeComp', () => ({
    BoxEditorNormalImageRender: () => <div>image-render</div>,
}));

vi.mock('./canvas/box/BoxEditorNormalViewVideoModeComp', () => ({
    BoxEditorNormalVideoRender: () => <div>video-render</div>,
}));

vi.mock('./canvas/box/BoxEditorNormalViewHtmlModeComp', () => ({
    BoxEditorNormalHtmlRender: () => <div>html-render</div>,
}));

vi.mock('./canvas/box/BoxEditorNormalViewTextModeComp', () => ({
    BoxEditorNormalTextRender: () => <div>text-render</div>,
}));

vi.mock('./canvas/box/BoxEditorNormalViewBibleModeComp', () => ({
    BoxEditorNormalBibleRender: () => <div>bible-render</div>,
}));

import CanvasItemRendererComp from './CanvasItemRendererComp';

describe('CanvasItemRendererComp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        canvasItemState.type = 'image';
    });

    test('renders the expected editor view for each supported canvas item type', () => {
        const cases = [
            ['image', 'image-render'],
            ['video', 'video-render'],
            ['text', 'text-render'],
            ['html', 'html-render'],
            ['bible', 'bible-render'],
        ] as const;

        for (const [type, expectedText] of cases) {
            canvasItemState.type = type;
            expect(renderToStaticMarkup(<CanvasItemRendererComp />)).toContain(
                expectedText,
            );
        }
    });

    test('returns empty output for unsupported canvas item types', () => {
        canvasItemState.type = 'unknown';

        expect(renderToStaticMarkup(<CanvasItemRendererComp />)).toBe('');
    });
});
