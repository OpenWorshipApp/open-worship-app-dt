// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    autoHidden: [] as HTMLElement[],
    rangeProps: null as any,
}));

vi.mock('../../helper/domHelpers', () => ({
    handleAutoHide: (element: HTMLElement) => {
        h.autoHidden.push(element);
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../others/AppRangeComp', () => ({
    default: (props: any) => {
        h.rangeProps = props;
        return <div data-stub="range" />;
    },
}));
vi.mock('../../screen-setting/BibleCustomStyleFloatingToggleComp', () => ({
    default: () => <div data-stub="bible-style-toggle" />,
}));

import MiniScreenFooterComp, {
    DEFAULT_PREVIEW_SIZE,
    defaultRangeSize,
} from './MiniScreenFooterComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.autoHidden.length = 0;
    h.rangeProps = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('MiniScreenFooterComp', () => {
    test('auto-hides its own footer and drives the preview scale', async () => {
        const setPreviewSizeScale = vi.fn();
        await act(async () => {
            root.render(
                <MiniScreenFooterComp
                    previewSizeScale={12}
                    setPreviewSizeScale={setPreviewSizeScale}
                />,
            );
        });
        const footer = container.querySelector('.card-footer')!;
        expect(h.autoHidden).toEqual([footer]);
        expect(h.rangeProps.value).toBe(12);
        expect(h.rangeProps.title).toBe('Preview Size Scale');
        expect(h.rangeProps.defaultSize).toBe(defaultRangeSize);
        h.rangeProps.setValue(13);
        expect(setPreviewSizeScale).toHaveBeenCalledWith(13);
        expect(
            container.querySelector('[data-stub="bible-style-toggle"]'),
        ).not.toBe(null);
    });

    test('the default preview geometry', () => {
        expect(DEFAULT_PREVIEW_SIZE).toBe(50);
        expect(defaultRangeSize).toEqual({ size: 9, min: 1, max: 30, step: 1 });
    });
});
