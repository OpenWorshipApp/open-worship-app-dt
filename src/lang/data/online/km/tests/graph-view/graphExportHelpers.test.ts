// @vitest-environment jsdom
// Khmer in a graph box (`src/graph-view/graphExportHelpers.ts`): a long
// description cut by its drawn width, and a cut that never leaves the
// subscript sign (an invisible stacker, `src/helper/scriptClusterHelpers.ts`) dangling.
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../../../../../server/appProvider', () => ({ default: {} }));
vi.mock('../../../../../../server/appHelpers', () => ({
    downloadImageBase64Data: vi.fn(),
}));
vi.mock('../../../../../../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));
vi.mock('../../../../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../../../../../helper/printCssHelpers', () => ({
    collectFontFaceCss: vi.fn(),
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

const { buildGraphSvg, PRINT_PALETTE } =
    await import('../../../../../../graph-view/graphExportHelpers');
const { GRAPH_GEOMETRY } = await import('../../../../../../graph-view/core');

const KHMER_COENG = '្';

function genOptions(kjvName: string) {
    return {
        title: 'Graph',
        nodeList: [
            {
                node: { key: 'a', recordId: 'a', name: 'ដាវីឌ', x: 0, y: 0 },
                view: {
                    name: 'ដាវីឌ',
                    kjvName,
                    title: 'King of Israel',
                    caption: '',
                    iconClass: '',
                    typeKey: 'person',
                    verseList: [],
                    labelHint: '',
                },
                typeColor: '#000',
            },
        ],
        edgeList: [],
        resolveEdge: () => ({ label: '', isDirected: false }),
        pathEdgeKeySet: new Set<string>(),
        palette: PRINT_PALETTE,
        fontFamily: 'sans-serif',
    } as any;
}

/**
 * Code points times an advance per pixel of font size: crude, and Khmer
 * deliberately as wide as Latin, but the SAME numbers decide the cut and
 * check it, which is all this needs.
 */
function genMeasure(advance: number) {
    return (text: string, fontSize: number) => {
        return Array.from(text).length * fontSize * advance;
    };
}

/** Every line a box draws, with the room the box leaves it. */
function readBoxLineList(svg: string, measure: ReturnType<typeof genMeasure>) {
    const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return Array.from(svgDocument.querySelectorAll('g')).flatMap((group) => {
        const box = group.querySelector('rect')!;
        const boxRight =
            Number(box.getAttribute('x')) + GRAPH_GEOMETRY.NODE_WIDTH;
        return Array.from(group.querySelectorAll('text'), (text) => {
            const value = text.textContent ?? '';
            const fontSize = Number(text.getAttribute('font-size'));
            return {
                value,
                fontSize,
                width: measure(value, fontSize),
                room: boxRight - Number(text.getAttribute('x')),
            };
        });
    });
}

describe('buildGraphSvg', () => {
    test('a translated name keeps its English name, as the box shows it', () => {
        const svg = buildGraphSvg(genOptions('David'));
        expect(svg).toContain('ដាវីឌ</text>');
        expect(svg).toContain('(David)</text>');
    });
});

describe('buildGraphSvg with a measurer', () => {
    // Measured live (robot run 20261001-1149): a Khmer description cut to 30
    // CHARACTERS drew ~11px past its box's right border in the saved PNG.
    test('a long Khmer description is cut to the box by its drawn width', () => {
        const measure = genMeasure(0.75);
        const options = genOptions('David');
        options.nodeList[0].view.title =
            'ព្រះមហាក្សត្រនៃសាសន៍អ៊ីស្រាអែល ដែលបានគ្រងរាជ្យនៅក្រុងយេរូសាឡិម';
        options.measureText = measure;
        const lineList = readBoxLineList(buildGraphSvg(options), measure);
        expect(lineList.map((line) => line.value)).toEqual([
            'ដាវីឌ',
            '(David)',
            expect.stringMatching(/^ព្រះមហាក្សត្រ.*…$/),
        ]);
        for (const line of lineList) {
            expect(line.width).toBeLessThanOrEqual(line.room);
        }
    });

    test('a cut never leaves a Khmer COENG dangling before the ellipsis', () => {
        const options = genOptions('');
        // Every other grapheme cluster here ENDS on a coeng (ក្ | ស | ត្ | រ).
        options.nodeList[0].view.title = 'ក្សត្រ'.repeat(20);
        for (let step = 30; step <= 120; step++) {
            const measure = genMeasure(step / 100);
            options.measureText = measure;
            const caption = readBoxLineList(buildGraphSvg(options), measure)
                .filter((line) => {
                    return line.fontSize === 10;
                })
                .at(0)!;
            expect(caption.value.endsWith('…')).toBe(true);
            expect(caption.value.endsWith(`${KHMER_COENG}…`)).toBe(false);
            expect(caption.width).toBeLessThanOrEqual(caption.room);
        }
    });
});
