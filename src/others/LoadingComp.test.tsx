import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => {
    return {
        tran: (key: string) => {
            return `tr:${key}`;
        },
    };
});

import LoadingComp from './LoadingComp';

describe('LoadingComp', () => {
    test('draws the spinner, named in the app language', () => {
        const html = renderToStaticMarkup(<LoadingComp />);
        expect(html).toContain('class="app-loading-spinner"');
        expect(html).toContain('role="img"');
        expect(html).toContain('aria-label="tr:Loading..."');
        expect(html).not.toContain('<img');
    });

    test('shows the message beside it only when there is one', () => {
        expect(renderToStaticMarkup(<LoadingComp message={null} />)).toBe(
            renderToStaticMarkup(<LoadingComp />),
        );
        const html = renderToStaticMarkup(
            <LoadingComp message="Fetching" style={{ height: '40px' }} />,
        );
        expect(html).toContain('>Fetching</div>');
        expect(html).toContain('height:40px');
    });
});
