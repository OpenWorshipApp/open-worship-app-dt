import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ScreenBackgroundFillComp from './ScreenBackgroundFillComp';

function render(src: string, isMoving: boolean) {
    return renderToStaticMarkup(
        <ScreenBackgroundFillComp src={src} isMoving={isMoving} />,
    );
}

const MOVING_GRID =
    'pattern?name=grid&base=18181B&ink=FFFFFF1A&size=32&motion=slow';
const MOVING_GRADIENT =
    'gradient?shape=linear&angle=120&colors=042F2E-1E3A8A-3B0764&motion=slow';

describe('a screen’s fill background', () => {
    it('paints a colour, a gradient or a pattern', () => {
        expect(render('#123456', true)).toBe(
            '<div style="width:100%;height:100%;background-color:#123456"></div>',
        );
        const gradient = render(
            'gradient?shape=linear&angle=135&colors=1E3A8A-581C87',
            true,
        );
        expect(gradient).toContain(
            'background-image:linear-gradient(135deg, #1E3A8A, #581C87)',
        );
        expect(gradient).not.toContain('app-fill-motion');
    });

    it('draws nothing for what is not a fill', () => {
        expect(render('url(https://example.com/a.png)', true)).toBe(
            '<div style="width:100%;height:100%"></div>',
        );
    });

    it('keeps a moving fill still where it is not presented', () => {
        const html = render(MOVING_GRID, false);
        expect(html).not.toContain('app-fill-motion');
        expect(html).toContain('background-size:32px 32px, 32px 32px');
    });

    it('drifts a pattern one tile on a layer the compositor slides', () => {
        const html = render(MOVING_GRID, true);
        expect(html).toContain('class="app-fill-box"');
        expect(html).toContain('class="app-fill-motion app-fill-drift"');
        expect(html).toContain('--app-fill-seconds:5.33s');
        expect(html).toContain('--app-fill-tile:32px');
    });

    it('sways a gradient, with no tile to drift across', () => {
        const html = render(MOVING_GRADIENT, true);
        expect(html).toContain('class="app-fill-motion app-fill-sway"');
        expect(html).toContain('--app-fill-seconds:24s');
        expect(html).not.toContain('--app-fill-tile');
    });
});
