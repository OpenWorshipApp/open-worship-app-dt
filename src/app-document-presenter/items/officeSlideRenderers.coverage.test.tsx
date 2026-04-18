// @vitest-environment jsdom

import path from 'node:path';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    useScreenVaryAppDocumentManagerEventsMock,
    currentAppDocumentRef,
    varySlideRenderCompSpy,
    appProviderMock,
    PptxSlideMock,
} = vi.hoisted(() => {
    const useScreenVaryAppDocumentManagerEventsMock = vi.fn();
    const currentAppDocumentRef = {
        current: {
            showSlideContextMenu: vi.fn(),
        },
    };
    const varySlideRenderCompSpy = vi.fn();
    const appProviderMock = {
        isPageScreen: false,
    };

    class PptxSlideMock {
        static calcIndex(index: number, subIndex: number) {
            return index * 10 + subIndex + 1;
        }
    }

    return {
        useScreenVaryAppDocumentManagerEventsMock,
        currentAppDocumentRef,
        varySlideRenderCompSpy,
        appProviderMock,
        PptxSlideMock,
    };
});

vi.mock('../../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsMock,
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useVaryAppDocumentContext: () => currentAppDocumentRef.current,
}));

vi.mock('./VarySlideRenderComp', () => ({
    default: (props: any) => {
        varySlideRenderCompSpy(props);
        return (
            <div data-testid={`vary-slide-wrapper-${props.index}`}>
                <button
                    type="button"
                    data-testid={`vary-slide-click-${props.index}`}
                    onClick={(event) => props.onClick?.(event)}
                />
                <button
                    type="button"
                    data-testid={`vary-slide-context-${props.index}`}
                    onClick={(event) => props.onContextMenu?.(event, ['extra'])}
                />
                {props.children}
            </div>
        );
    },
}));

vi.mock('../../helper/debuggerHelpers', async () => {
    const { useEffect } = await import('react');

    return {
        useAppEffect: useEffect,
    };
});

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `file://${filePath}`,
            baseDirPath: path.posix.dirname(filePath),
        }),
    },
}));

vi.mock('../../server/calcHelpers', () => ({
    pathToFileURL: (filePath: string) => `file://${filePath}`,
}));

vi.mock('../../server/fileHelpers', () => ({
    pathResolve: (...paths: string[]) => path.posix.resolve(...paths),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../app-document-list/PptxSlide', () => ({
    default: PptxSlideMock,
}));

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('office slide renderer coverage', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        currentAppDocumentRef.current = {
            showSlideContextMenu: vi.fn(),
        };
        appProviderMock.isPageScreen = false;
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
            await flushAsyncEvents();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('generates PDF preview images and forwards click and context-menu actions', async () => {
        const { default: PdfSlideRenderComp, genPdfSlide } = await import(
            './PdfSlideRenderComp'
        );
        const pdfSlide = {
            id: 1,
            filePath: '/slides/sample.pdf',
            pdfPreviewSrc: '/slides/page.png',
        } as any;
        const onClick = vi.fn();

        const previewImage = genPdfSlide('/slides/page.png');
        const fullWidthImage = genPdfSlide('/slides/page.png', true);

        expect(previewImage.tagName).toBe('IMG');
        expect(previewImage.style.objectFit).toBe('contain');
        expect(fullWidthImage.style.width).toBe('100%');
        expect(fullWidthImage.style.objectFit).toBe('');

        await act(async () => {
            root.render(
                <PdfSlideRenderComp
                    pdfSlide={pdfSlide}
                    width={320}
                    index={2}
                    onClick={onClick}
                />,
            );
            await flushAsyncEvents();
        });

        expect(useScreenVaryAppDocumentManagerEventsMock).toHaveBeenCalledWith([
            'update',
        ]);
        expect(container.querySelector('img[alt="pdf-image"]')).not.toBeNull();

        await act(async () => {
            container
                .querySelector('[data-testid="vary-slide-click-2"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            container
                .querySelector('[data-testid="vary-slide-context-2"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(onClick).toHaveBeenCalledWith(expect.any(Object), 2, pdfSlide);
        expect(
            currentAppDocumentRef.current.showSlideContextMenu,
        ).toHaveBeenCalledWith(expect.any(Object), pdfSlide, ['extra']);

        await act(async () => {
            root.render(
                <PdfSlideRenderComp
                    pdfSlide={{ ...pdfSlide, pdfPreviewSrc: null }}
                    width={320}
                    index={3}
                />,
            );
            await flushAsyncEvents();
        });

        expect(container.textContent).toContain('Unable to preview right now');
    });

    test('generates DOCX iframe and HTML slides for full-width and regular rendering', async () => {
        const { default: DocxSlideRenderComp, genDocxSlide } = await import(
            './DocxSlideRenderComp'
        );
        const onClick = vi.fn();
        const docxSlide = {
            id: 7,
            filePath: '/slides/sample.docx',
            html: undefined,
            htmlFilePath: '/slides/page.html',
            width: 400,
            height: 300,
        } as any;

        const iframeSlide = genDocxSlide(
            undefined,
            '/slides/page.html',
            400,
            300,
            800,
        );
        const fullWidthIframeSlide = genDocxSlide(
            undefined,
            '/slides/page.html',
            400,
            300,
            800,
            true,
        );
        const htmlSlide = genDocxSlide(
            '<html><body><p>Docx</p></body></html>',
            '/slides/page.html',
            400,
            300,
            800,
            true,
        );

        expect(iframeSlide.style.height).toBe('100%');
        expect(
            iframeSlide.querySelector('iframe[title="docx-slide"]')?.getAttribute(
                'src',
            ),
        ).toBe('file:///slides/page.html');
        expect(fullWidthIframeSlide.style.height).toBe('auto');
        expect(
            fullWidthIframeSlide.querySelector('iframe[title="docx-slide"]')
                ?.style.transform,
        ).toBe('scale(2)');
        expect(htmlSlide.style.height).toBe('auto');
        expect(htmlSlide.firstElementChild).not.toBeNull();

        await act(async () => {
            root.render(
                <DocxSlideRenderComp
                    docxSlide={docxSlide}
                    width={320}
                    index={4}
                    onClick={onClick}
                />,
            );
            await flushAsyncEvents();
        });

        expect(container.querySelector('iframe[title="docx-slide"]')).not.toBeNull();

        await act(async () => {
            container
                .querySelector('[data-testid="vary-slide-click-4"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            container
                .querySelector('[data-testid="vary-slide-context-4"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(onClick).toHaveBeenCalledWith(expect.any(Object), 4, docxSlide);
        expect(
            currentAppDocumentRef.current.showSlideContextMenu,
        ).toHaveBeenCalledWith(expect.any(Object), docxSlide, ['extra']);
    });

    test('generates PPTX slides and renders main and subslide entries with forwarded events', async () => {
        const { default: PptxSlideRenderComp, genPptxSlide } = await import(
            './PptxSlideRenderComp'
        );
        const onClick = vi.fn();
        const subSlide = {
            id: 12,
            filePath: '/slides/sample.pptx',
            html: '<html><body><p>Sub</p></body></html>',
            htmlFilePath: '/slides/sub.html',
            width: 200,
            height: 120,
            isDisabled: false,
        };
        const pptxSlide = {
            id: 11,
            filePath: '/slides/sample.pptx',
            html: undefined,
            htmlFilePath: '/slides/main.html',
            width: 400,
            height: 240,
            subSlides: [subSlide],
            isDisabled: false,
        } as any;

        const iframeSlide = genPptxSlide(
            undefined,
            '/slides/main.html',
            400,
            240,
        );
        const htmlSlide = genPptxSlide(
            '<html><body><p>Main</p></body></html>',
            '/slides/main.html',
            400,
            240,
        );

        expect(
            iframeSlide.querySelector('iframe[title="pptx-slide"]')?.getAttribute(
                'src',
            ),
        ).toBe('file:///slides/main.html');
        expect(htmlSlide.firstElementChild).not.toBeNull();

        await act(async () => {
            root.render(
                <PptxSlideRenderComp
                    pptxSlide={pptxSlide}
                    width={360}
                    index={4}
                    onClick={onClick}
                />,
            );
            await flushAsyncEvents();
        });

        expect(varySlideRenderCompSpy).toHaveBeenCalledTimes(2);
        expect(container.querySelector('[data-testid="vary-slide-wrapper-4"]')).not.toBeNull();
        expect(
            container.querySelector('[data-testid="vary-slide-wrapper-41"]'),
        ).not.toBeNull();
        expect(container.querySelector('iframe[title="pptx-slide"]')).not.toBeNull();

        await act(async () => {
            container
                .querySelector('[data-testid="vary-slide-click-4"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            container
                .querySelector('[data-testid="vary-slide-click-41"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            container
                .querySelector('[data-testid="vary-slide-context-41"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(onClick).toHaveBeenNthCalledWith(
            1,
            expect.any(Object),
            4,
            pptxSlide,
        );
        expect(onClick).toHaveBeenNthCalledWith(
            2,
            expect.any(Object),
            41,
            subSlide,
        );
        expect(
            currentAppDocumentRef.current.showSlideContextMenu,
        ).toHaveBeenCalledWith(expect.any(Object), pptxSlide, ['extra']);
    });
});
