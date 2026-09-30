import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import ForegroundLayoutComp from './ForegroundLayoutComp';

test('keeps foreground content in the panel body without adding a nested scroll card', () => {
    const html = renderToStaticMarkup(
        <ForegroundLayoutComp
            target="message"
            extraBodyClassName="custom"
            extraBodyStyle={{ color: 'red' }}
        >
            <span>Notice</span>
        </ForegroundLayoutComp>,
    );
    expect(html).toContain('data-foreground-target="message"');
    expect(html).toContain('class="w-100 custom"');
    expect(html).toContain('style="color:red"');
    expect(html).toContain('<span>Notice</span>');
});
