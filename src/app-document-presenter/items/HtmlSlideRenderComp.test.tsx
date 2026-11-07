// @vitest-environment jsdom

import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const getInstanceMock = vi.fn();
const appProviderMock = { isPageScreen: false };

vi.mock('../../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: (effect: () => void, deps?: unknown[]) =>
            React.useEffect(effect, deps),
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
    default: appProviderMock,
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

    test('genHtmlSlideContent without a width to fill is the host itself, at its size', async () => {
        const { genHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = genHtmlSlideContent({
            html: '<html><body><div>slide</div></body></html>',
            width: 100,
            height: 50,
        });
        expect(host.style.width).toBe('100px');
        expect(host.style.height).toBe('50px');
        expect(host.style.transform).toBe('');
        expect(host.shadowRoot?.querySelector('div')?.textContent).toBe(
            'slide',
        );
    });

    test('a path that is not valid percent-encoding is used as written', async () => {
        const { mountHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = document.createElement('div');
        mountHtmlSlideContent(
            host,
            '<html><body><img src="./100%.png" /><img src="./caf%C3%A9.png" /></body></html>',
            '/slides/page.html',
        );
        const sources = Array.from(
            host.shadowRoot!.querySelectorAll('img'),
        ).map((image) => image.getAttribute('src'));
        expect(sources).toEqual([
            'file:///slides/100%.png',
            'file:///slides/caf\u00e9.png',
        ]);
    });

    test('rebases SVG xlink references and inline style urls, and leaves what is not a file', async () => {
        const { mountHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = document.createElement('div');
        mountHtmlSlideContent(
            host,
            `<html><body>
                <svg><image xlink:href="./logo.svg"></image></svg>
                <div id="styled" style="background: url('./bg.png') no-repeat"></div>
                <div id="plain" style="color: red"></div>
                <img id="set" srcset="./a.jpg 1x, , ./b.jpg 2x" />
                <a id="external" href="https://example.com/x.png"></a>
                <a id="anchor" href="#top"></a>
                <img id="inline" src="data:image/png;base64,AAAA" />
            </body></html>`,
            '/slides/page.html',
        );
        const shadowRoot = host.shadowRoot!;
        expect(
            shadowRoot.querySelector('image')?.getAttribute('xlink:href'),
        ).toBe('file:///slides/logo.svg');
        expect(shadowRoot.querySelector('#styled')?.getAttribute('style')).toBe(
            "background: url('file:///slides/bg.png') no-repeat",
        );
        expect(shadowRoot.querySelector('#plain')?.getAttribute('style')).toBe(
            'color: red',
        );
        // An empty candidate keeps its slot rather than becoming a file.
        expect(shadowRoot.querySelector('#set')?.getAttribute('srcset')).toBe(
            'file:///slides/a.jpg 1x, , file:///slides/b.jpg 2x',
        );
        expect(
            shadowRoot.querySelector('#external')?.getAttribute('href'),
        ).toBe('https://example.com/x.png');
        expect(shadowRoot.querySelector('#anchor')?.getAttribute('href')).toBe(
            '#top',
        );
        expect(shadowRoot.querySelector('#inline')?.getAttribute('src')).toBe(
            'data:image/png;base64,AAAA',
        );
    });

    test('without a file to resolve against, the HTML is shown as written', async () => {
        const { mountHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = document.createElement('div');
        mountHtmlSlideContent(
            host,
            '<html><body><img src="./photo.jpg" /></body></html>',
        );
        expect(host.shadowRoot?.querySelector('img')?.getAttribute('src')).toBe(
            './photo.jpg',
        );
        expect(getInstanceMock).not.toHaveBeenCalled();
    });

    test('mounting again replaces the content of the same shadow root', async () => {
        const { mountHtmlSlideContent } = await import('./HtmlSlideRenderComp');
        const host = document.createElement('div');
        mountHtmlSlideContent(host, '<html><body><p>first</p></body></html>');
        const shadowRoot = host.shadowRoot!;
        // No HTML at all: a blank page, not the previous one.
        mountHtmlSlideContent(host);
        expect(host.shadowRoot).toBe(shadowRoot);
        expect(shadowRoot.querySelector('p')).toBeNull();
        expect(shadowRoot.querySelector('body')?.innerHTML).toBe('');
        expect(
            Array.from(shadowRoot.children).map((child) => child.tagName),
        ).toEqual(['STYLE', 'HTML']);
    });
});

describe('HtmlSlideRenderComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getInstanceMock.mockImplementation((filePath: string) => {
            return { baseDirPath: path.posix.dirname(filePath) };
        });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        appProviderMock.isPageScreen = false;
    });

    test('draws the slide at its own size into a shadow root, and redraws on new HTML', async () => {
        const { default: HtmlSlideRenderComp } =
            await import('./HtmlSlideRenderComp');
        await act(async () => {
            root.render(
                <HtmlSlideRenderComp
                    html='<html><body><p>one</p><img src="./a.png" /></body></html>'
                    htmlFilePath="/slides/page.html"
                    width={320}
                    height={180}
                />,
            );
        });
        const host = container.firstElementChild as HTMLDivElement;
        expect(host.style.width).toBe('320px');
        expect(host.style.height).toBe('180px');
        // Only a screen takes clicks; a preview passes them to its card.
        expect(host.style.pointerEvents).toBe('none');
        expect(host.shadowRoot?.querySelector('p')?.textContent).toBe('one');
        expect(host.shadowRoot?.querySelector('img')?.getAttribute('src')).toBe(
            'file:///slides/a.png',
        );

        await act(async () => {
            root.render(
                <HtmlSlideRenderComp
                    html="<html><body><p>two</p></body></html>"
                    htmlFilePath="/slides/page.html"
                    width={320}
                    height={180}
                />,
            );
        });
        expect(container.firstElementChild).toBe(host);
        expect(host.shadowRoot?.querySelector('p')?.textContent).toBe('two');
    });

    test('scales itself to the width it is given, and takes clicks on a screen', async () => {
        appProviderMock.isPageScreen = true;
        const { default: HtmlSlideRenderComp } =
            await import('./HtmlSlideRenderComp');
        await act(async () => {
            root.render(
                <HtmlSlideRenderComp
                    html="<html><body><p>wide</p></body></html>"
                    width={320}
                    height={180}
                    parentWidth={640}
                />,
            );
        });
        const wrapper = container.firstElementChild as HTMLDivElement;
        expect(wrapper.style.position).toBe('relative');
        expect(wrapper.style.width).toBe('100%');
        const host = wrapper.firstElementChild as HTMLDivElement;
        expect(host.style.position).toBe('absolute');
        expect(host.style.transform).toBe('scale(2)');
        expect(host.style.transformOrigin).toBe('top left');
        expect(host.style.pointerEvents).toBe('all');
        expect(host.shadowRoot?.querySelector('p')?.textContent).toBe('wide');
    });
});
