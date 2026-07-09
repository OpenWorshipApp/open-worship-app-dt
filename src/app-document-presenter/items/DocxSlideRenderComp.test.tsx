import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const htmlSlideRenderCompSpy = vi.fn();

vi.mock('../../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents: vi.fn(),
}));

vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (target: any) => ({ current: target }),
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useVaryAppDocumentContext: () => ({
        showSlideContextMenu: vi.fn(),
    }),
}));

vi.mock('./VarySlideRenderComp', () => ({
    default: ({ children }: any) => (
        <div data-testid="vary-slide">{children}</div>
    ),
}));

vi.mock('./HtmlSlideRenderComp', () => ({
    default: (props: any) => {
        htmlSlideRenderCompSpy(props);
        return <div data-testid="docx-html">{props.html}</div>;
    },
    genHtmlSlideContent: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(() => ({ src: '/slides/page.html' })),
    },
}));

describe('DocxSlideRenderComp', () => {
    beforeEach(() => {
        htmlSlideRenderCompSpy.mockClear();
    });

    test('passes DOCX HTML content and slide dimensions to HtmlSlideRenderComp', async () => {
        const { default: DocxSlideRenderComp } =
            await import('./DocxSlideRenderComp');

        const markup = renderToStaticMarkup(
            <DocxSlideRenderComp
                docxSlide={
                    {
                        id: 7,
                        filePath: '/slides/sample.docx',
                        html: '<p>Page</p>',
                        htmlFilePath: '/slides/page.html',
                        width: 816,
                        height: 1056,
                    } as any
                }
                width={320}
                index={0}
            />,
        );

        expect(htmlSlideRenderCompSpy).toHaveBeenCalledWith({
            html: '<p>Page</p>',
            htmlFilePath: '/slides/page.html',
            width: 816,
            height: 1056,
        });
        expect(markup).toContain('data-testid="docx-html"');
        expect(markup).toContain('&lt;p&gt;Page&lt;/p&gt;');
        expect(markup).toContain('width:816px');
        expect(markup).toContain('height:1056px');
    });
});
