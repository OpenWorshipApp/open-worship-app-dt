import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { SlideStageContext, useSlideStage } from './documentStageContexts';

// Which stage a slide list draws: what a Stage Previewer pane hands down, and
// stage 0 -- the slide as it is -- everywhere else.
function StageProbeComp() {
    return <b>{useSlideStage()}</b>;
}

describe('useSlideStage', () => {
    test('a list outside every Stage Previewer pane draws stage 0', () => {
        expect(renderToStaticMarkup(<StageProbeComp />)).toBe('<b>0</b>');
    });

    test('a pane hands its stage to the lists under it, the nearest pane winning', () => {
        expect(
            renderToStaticMarkup(
                <SlideStageContext value={3}>
                    <StageProbeComp />
                    <SlideStageContext value={5}>
                        <StageProbeComp />
                    </SlideStageContext>
                </SlideStageContext>,
            ),
        ).toBe('<b>3</b><b>5</b>');
    });
});
