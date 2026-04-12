import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents: vi.fn(),
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useVaryAppDocumentContext: () => ({
        showSlideContextMenu: vi.fn(),
    }),
}));

vi.mock('./VarySlideRenderComp', () => ({
    default: ({ children }: any) => <div data-testid="vary-slide">{children}</div>,
}));

vi.mock('./HtmlSlideRenderComp', () => ({
    default: ({ html }: any) => <div data-testid="docx-html">{html}</div>,
    genHtmlSlideContent: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(() => ({ src: '/slides/page.html' })),
    },
}));

describe('DocxSlideRenderComp', () => {
    test('renders DOCX content on top of the preview background CSS variable', async () => {
        const { default: DocxSlideRenderComp } = await import(
            './DocxSlideRenderComp'
        );

        const markup = renderToStaticMarkup(
            <DocxSlideRenderComp
                docxSlide={{
                    id: 7,
                    filePath: '/slides/sample.docx',
                    html: '<p>Page</p>',
                    htmlFilePath: '/slides/page.html',
                    width: 816,
                    height: 1056,
                } as any}
                width={320}
                index={0}
            />,
        );

        expect(markup).toContain(
            'background-color:var(--app-docx-preview-background, transparent)',
        );
        expect(markup).toContain('width:816px');
        expect(markup).toContain('height:1056px');
    });
});
