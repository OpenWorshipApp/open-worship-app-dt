// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getInstanceMock = vi.fn();

vi.mock('../../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: vi.fn(),
        useAppCurrentRef: (target: any) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: getInstanceMock,
    },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        isPageScreen: false,
    },
}));

vi.mock('../../server/calcHelpers', () => ({
    pathToFileURL: (filePath: string) => `file://${filePath}`,
}));

vi.mock('../../server/fileHelpers', () => ({
    pathResolve: (...paths: string[]) => path.posix.resolve(...paths),
}));

describe('HtmlSlideRenderComp helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstanceMock.mockImplementation((filePath: string) => {
            return {
                baseDirPath: path.posix.dirname(filePath),
            };
        });
    });

    test('mountHtmlSlideContent rebases HTML resources inside the shadow root', async () => {
        const { mountHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = document.createElement('div');

        mountHtmlSlideContent(
            host,
            `<!DOCTYPE html>
            <html>
                <head>
                    <style>
                        .hero { background-image: url("./image.png"); }
                    </style>
                </head>
                <body>
                    <img src="./photo.jpg" srcset="./photo.jpg 1x, ./photo@2x.jpg 2x" />
                    <a href="./theme.css">Theme</a>
                    <svg><use href="./sprite.svg#icon"></use></svg>
                </body>
            </html>`,
            '/slides/page.html',
        );

        const shadowRoot = host.shadowRoot;
        expect(shadowRoot).not.toBeNull();
        expect(shadowRoot?.querySelector('img')?.getAttribute('src')).toBe(
            'file:///slides/photo.jpg',
        );
        expect(shadowRoot?.querySelector('img')?.getAttribute('srcset')).toBe(
            'file:///slides/photo.jpg 1x, file:///slides/photo@2x.jpg 2x',
        );
        expect(shadowRoot?.querySelector('a')?.getAttribute('href')).toBe(
            'file:///slides/theme.css',
        );
        expect(shadowRoot?.querySelector('use')?.getAttribute('href')).toBe(
            'file:///slides/sprite.svg#icon',
        );
        const styleText = Array.from(
            shadowRoot?.querySelectorAll('style') ?? [],
        )
            .map((style) => style.textContent ?? '')
            .join('\n');
        expect(styleText).toContain('file:///slides/image.png');
    });

    test('genHtmlSlideContent creates a scaled wrapper for full-width rendering', async () => {
        const { genHtmlSlideContent } = await import('./HtmlSlideRenderComp');

        const wrapper = genHtmlSlideContent({
            html: '<html><body><div>slide</div></body></html>',
            htmlFilePath: '/slides/page.html',
            width: 100,
            height: 50,
            parentWidth: 200,
        });

        expect(wrapper.style.position).toBe('relative');
        const host = wrapper.firstElementChild as HTMLDivElement | null;
        expect(host).not.toBeNull();
        expect(host?.style.transform).toBe('scale(2)');
        expect(host?.shadowRoot?.querySelector('div')?.textContent).toBe(
            'slide',
        );
    });
});
