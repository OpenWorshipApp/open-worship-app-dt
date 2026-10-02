// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
    imageSourceList: [] as string[],
}));

vi.mock('../server/appProvider', () => ({ default: {} }));
vi.mock('../server/appHelpers', () => ({ downloadImageBase64Data: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/printCssHelpers', () => ({ collectFontFaceCss: vi.fn() }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleErrorMock }));

const { buildGraphSvg, PRINT_PALETTE, saveGraphImage } =
    await import('./graphExportHelpers');
const { GRAPH_GEOMETRY } = await import('./core');

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

describe('buildGraphSvg', () => {
    test('a translated name keeps its English name, as the box shows it', () => {
        const svg = buildGraphSvg(genOptions('David'));
        expect(svg).toContain('ដាវីឌ</text>');
        expect(svg).toContain('(David)</text>');
        expect(svg).toContain('King of Israel</text>');
    });

    test('an English record draws no empty brackets', () => {
        const svg = buildGraphSvg(genOptions(''));
        expect(svg).not.toContain('()');
    });
});

// The box keeps this much clear of its right border.
const BOX_RIGHT_PADDING = 8;
const KHMER_COENG = '្';

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

    test('a long English name keeps as much as fits, its brackets counted', () => {
        const advance = 0.6;
        const measure = genMeasure(advance);
        const options = genOptions('Jehoshaphat the son of Asa king of Judah');
        options.measureText = measure;
        const [, kjvLine] = readBoxLineList(buildGraphSvg(options), measure);
        expect(kjvLine.value).toMatch(/^\(Jehoshaphat.*…\)$/);
        expect(kjvLine.width).toBeLessThanOrEqual(kjvLine.room);
        // Tight: one more letter would not have fitted.
        expect(kjvLine.width + kjvLine.fontSize * advance).toBeGreaterThan(
            kjvLine.room - BOX_RIGHT_PADDING,
        );
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

    test('with no measurer a line is still cut by its character count', () => {
        const options = genOptions('');
        options.nodeList[0].view.title = 'x'.repeat(40);
        expect(buildGraphSvg(options)).toContain(`${'x'.repeat(29)}…</text>`);
    });
});

describe('saveGraphImage', () => {
    const fontStyle = document.createElement('style');
    fontStyle.textContent = [
        ['regular', 'normal'],
        ['bold', 'bold'],
        ['light', '300'],
        ['black', '900'],
    ]
        .map(([name, weight]) => {
            return (
                '@font-face { font-family: app-Battambang;' +
                ` src: url("https://fonts.test/${name}.ttf")` +
                ` format("truetype"); font-weight: ${weight}; }`
            );
        })
        .join('\n');

    function addFontStyle() {
        document.head.appendChild(fontStyle);
        // jsdom builds the rule but does not expose its class.
        vi.stubGlobal(
            'CSSFontFaceRule',
            fontStyle.sheet!.cssRules[0].constructor,
        );
    }

    function stubPicture(blobSize = 16) {
        const fetchMock = vi.fn(async (_url: string) => {
            return {
                ok: true,
                blob: async () => {
                    return new Blob([new Uint8Array(blobSize)]);
                },
            };
        });
        vi.stubGlobal('fetch', fetchMock);
        // jsdom loads no images: what the picture was asked to draw is all
        // that is kept.
        vi.stubGlobal(
            'Image',
            class {
                onerror: (() => void) | null = null;
                set src(value: string) {
                    h.imageSourceList.push(value);
                    this.onerror?.();
                }
            },
        );
        return fetchMock;
    }

    function readDrawnSvg() {
        const source = h.imageSourceList.at(-1) ?? '';
        return decodeURIComponent(source.slice(source.indexOf(',') + 1));
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        h.imageSourceList.length = 0;
        h.handleErrorMock.mockClear();
        fontStyle.remove();
    });

    // Drawn through an <img>, the SVG cannot reach this window's fonts: the
    // Khmer fell back to a system face and no longer fit the cut made for
    // Battambang.
    test('carries the export font inside the picture', async () => {
        addFontStyle();
        const fetchMock = stubPicture();
        const svg = buildGraphSvg({
            ...genOptions('David'),
            fontFamily: 'app-Battambang',
        });
        await saveGraphImage(svg, 'app-Battambang');

        // The nearest face to each weight drawn: 400 and 600 (bold).
        expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
            'https://fonts.test/bold.ttf',
            'https://fonts.test/regular.ttf',
        ]);
        const drawnSvg = readDrawnSvg();
        expect(drawnSvg).toContain(
            '<style>@font-face{font-family:"app-Battambang";src:url("data:',
        );
        expect(drawnSvg).toContain('font-weight:normal;}');
        expect(drawnSvg).toContain('font-weight:bold;}');
        expect(drawnSvg).toContain('text{font-family:app-Battambang;}');
        expect(h.handleErrorMock).not.toHaveBeenCalled();
    });

    test('a system font embeds nothing and fetches nothing', async () => {
        addFontStyle();
        const fetchMock = stubPicture();
        const svg = buildGraphSvg(genOptions('David'));
        await saveGraphImage(svg, 'sans-serif');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(readDrawnSvg()).toBe(svg);
    });

    test('a face too big to embed still leaves a picture', async () => {
        addFontStyle();
        stubPicture(600 * 1024);
        const svg = buildGraphSvg({
            ...genOptions('David'),
            fontFamily: 'app-Battambang',
        });
        await saveGraphImage(svg, 'app-Battambang');
        expect(h.handleErrorMock).toHaveBeenCalledTimes(1);
        expect(readDrawnSvg()).toBe(svg);
    });
});
