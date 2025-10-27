import ReactDOMServer from 'react-dom/server';

export function toIframe(html: string, title: string) {
    html = html.replaceAll(
        /background-color:\s*[^;]+;/g,
        'background-color: transparent;',
    );
    html = ReactDOMServer.renderToStaticMarkup(
        <iframe
            srcDoc={html}
            title={title}
            style={{
                colorScheme: 'normal',
                border: 'none',
                backgroundColor: 'transparent',
                width: '100%',
                height: '100%',
                overflowY: 'auto',
            }}
        />,
    );
    return html;
}
