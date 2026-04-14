// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getDefaultScreenDisplayMock } = vi.hoisted(() => ({
    getDefaultScreenDisplayMock: vi.fn(() => ({
        bounds: {
            width: 1920,
            height: 1080,
        },
    })),
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: getDefaultScreenDisplayMock,
}));

import RenderBackgroundWebIframeComp, {
    BackgroundWebPlaceHolderComp,
} from './RenderBackgroundWebIframeComp';

describe('RenderBackgroundWebIframeComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('renders the image placeholder when preview data is available', () => {
        const element = BackgroundWebPlaceHolderComp({
            height: 180,
            imageData: 'data:image/png;base64,abc',
        }) as ReactElement;

        expect(element.type).toBe('img');
        expect(element.props.alt).toBe('web preview');
        expect(element.props.src).toBe('data:image/png;base64,abc');
        expect(element.props.style.height).toBe('180px');
    });

    test('renders the icon placeholder when preview data is missing', () => {
        const element = BackgroundWebPlaceHolderComp({
            height: 120,
        }) as ReactElement;
        const icon = element.props.children as ReactElement;

        expect(element.type).toBe('div');
        expect(icon.type).toBe('i');
        expect(icon.props.className).toContain('bi-filetype-html');
        expect(icon.props.style.fontSize).toBe('60px');
    });

    test('uses the default screen size to scale the iframe when no target is provided', async () => {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <RenderBackgroundWebIframeComp
                    src={{
                        src: '/backgrounds/live.html',
                        fullName: 'live.html',
                    }}
                    width={640}
                    height={480}
                />,
            );
        });

        const iframe = container?.querySelector<HTMLIFrameElement>('iframe');

        expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe?.getAttribute('src')).toBe('/backgrounds/live.html');
        expect(iframe?.getAttribute('title')).toBe('live.html');
        expect(iframe?.style.width).toBe('1920px');
        expect(iframe?.style.height).toBe('1080px');
        expect(iframe?.style.transform).toBe('scale(0.4444444444444444)');
        expect(getDefaultScreenDisplayMock).toHaveBeenCalledTimes(1);
    });

    test('honors explicit target dimensions when scaling the iframe', async () => {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <RenderBackgroundWebIframeComp
                    src={{
                        src: '/backgrounds/custom.html',
                        fullName: 'custom.html',
                    }}
                    width={400}
                    height={150}
                    targetWidth={800}
                    targetHeight={600}
                />,
            );
        });

        const iframe = container?.querySelector<HTMLIFrameElement>('iframe');

        expect(iframe?.style.width).toBe('800px');
        expect(iframe?.style.height).toBe('600px');
        expect(iframe?.style.transform).toBe('scale(0.5)');
    });
});
