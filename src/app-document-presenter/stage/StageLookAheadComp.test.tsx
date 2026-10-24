import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

// The real one renders every kind of slide; which slide it is given is what
// matters here.
vi.mock('./VarySlideSideContentComp', () => ({
    default: ({ varySlide }: any) => <b data-side-id={varySlide.id} />,
}));

import StageLookAheadComp from './StageLookAheadComp';
import {
    SlideStageDeckContext,
    useSlideStageView,
    type SlideStageViewType,
} from './documentStageContexts';
import {
    getDocumentStageDefinition,
    toStageDeck,
} from './documentStageHelpers';

function genSlide(id: number, name = ''): any {
    return {
        id,
        name,
        isDisabled: false,
        width: 1920,
        height: 1080,
        toJson: () => ({ id }),
    };
}

// A frame is the box drawn with a solid border; the corner count is not.
const FRAME_PATTERN = /border:\d+px solid/g;

function renderView(view: SlideStageViewType) {
    return renderToStaticMarkup(
        <StageLookAheadComp width={1920} height={1080} view={view}>
            <i className="current-slide" />
        </StageLookAheadComp>,
    );
}

describe('StageLookAheadComp', () => {
    test('stage 1: the slide full size with the count', () => {
        const html = renderView({
            definition: getDocumentStageDefinition(1)!,
            label: '2/5',
            sides: [],
        });
        expect(html).toContain('current-slide');
        expect(html).toContain('scale(1)');
        expect(html).toContain('stage-look-ahead-index');
        expect(html).toContain('2/5');
        expect(html.match(FRAME_PATTERN)).toBeNull();
    });

    test('stage 2: the next slide at full opacity under the slide, both framed', () => {
        const html = renderView({
            definition: getDocumentStageDefinition(2)!,
            label: '1/2',
            sides: [{ offset: 1, varySlide: genSlide(2), label: '2/2' }],
        });
        expect(html).toContain('data-side-id="2"');
        // The coming slide carries its own count, as the current one does.
        expect(html.match(/stage-look-ahead-index/g)).toHaveLength(2);
        expect(html).toContain('2/2');
        expect(html).not.toContain('opacity');
        expect(html.match(FRAME_PATTERN)).toHaveLength(2);
    });

    test('nothing next: no side box and no frame for it', () => {
        const html = renderView({
            definition: getDocumentStageDefinition(2)!,
            label: '2/2',
            sides: [{ offset: 1, varySlide: null, label: null }],
        });
        expect(html).not.toContain('data-side-id');
        expect(html.match(FRAME_PATTERN)).toHaveLength(1);
    });

    test('no count when the stage shows none', () => {
        const html = renderView({
            definition: getDocumentStageDefinition(4)!,
            label: null,
            sides: [{ offset: 1, varySlide: genSlide(2), label: null }],
        });
        expect(html).not.toContain('stage-look-ahead-index');
    });
});

function ViewProbeComp({ varySlide }: { varySlide: any }) {
    const view = useSlideStageView(varySlide);
    return (
        <pre>
            {JSON.stringify(
                view === null
                    ? null
                    : {
                          label: view.label,
                          sides: view.sides.map((side) => {
                              return [side.offset, side.varySlide?.id ?? null];
                          }),
                      },
            )}
        </pre>
    );
}

describe('useSlideStageView', () => {
    test('nothing outside a stage pane', () => {
        const html = renderToStaticMarkup(
            <ViewProbeComp varySlide={genSlide(1)} />,
        );
        expect(html).toBe('<pre>null</pre>');
    });

    test('a card in a stage 5 pane finds the slides either side of it', () => {
        const slides = [genSlide(1), genSlide(2, 'Hymn'), genSlide(3)];
        const html = renderToStaticMarkup(
            <SlideStageDeckContext
                value={{
                    definition: getDocumentStageDefinition(5)!,
                    deck: toStageDeck(slides),
                }}
            >
                <ViewProbeComp varySlide={slides[1]} />
            </SlideStageDeckContext>,
        );
        expect(html).toContain(
            JSON.stringify({
                label: 'Hymn · 2/3',
                sides: [
                    [-1, 1],
                    [1, 3],
                ],
            }).replaceAll('"', '&quot;'),
        );
    });
});
