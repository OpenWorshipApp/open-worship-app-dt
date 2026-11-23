// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
    listPptxSlideImageUses,
    multiplyPptxMatrix,
    parsePptxTransform,
    toPptxSlideCanvasItems,
} from './pptxSlideDocumentRules';

// The page the converter writes, round a slide layer's own markup.
function genSlideHtml(layerMarkup: string, defsMarkup = '') {
    return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="width:1280px;height:720px;overflow:hidden;margin:0;">' +
        '<style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>' +
        '<div class="slide">' +
        '<svg class="pptx-slide-layer" xmlns="http://www.w3.org/2000/svg" ' +
        'width="1280" height="720" viewBox="0 0 1280 720">' +
        `<defs>${defsMarkup}</defs>${layerMarkup}</svg></div></body></html>`
    );
}

const TEXT_GROUP =
    '<g data-id="2-2" data-pptx-id="2" transform="translate(72,-12)">' +
    '<rect width="205.0" height="85.1" fill="none" stroke="none"/>' +
    '<foreignObject x="0" y="0" width="205.0" height="85.1" overflow="visible">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;' +
    'padding:4.8px 9.6px;">' +
    '<p style="text-align:center;font-size:44.0pt;margin-top:3.8pt;">' +
    '<span style="color:#FFFFFF;font-family:\'Kh Battambang\',sans-serif">' +
    'Verse 1</span></p></div></foreignObject></g>';

function genOptions(resolved: Record<string, string> = {}) {
    return {
        width: 1280,
        height: 720,
        idPrefix: 'p-',
        resolveImage: (href: string) => {
            const src = resolved[href];
            return src === undefined ? null : { src, width: 64, height: 32 };
        },
    };
}

function parseItemHtml(html: string) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

describe('parsePptxTransform', () => {
    it('reads the converter`s moves and turns into one matrix', () => {
        expect(parsePptxTransform('translate(72,-12)')).toEqual([
            1, 0, 0, 1, 72, -12,
        ]);
        expect(parsePptxTransform(null)).toEqual([1, 0, 0, 1, 0, 0]);
        const turned = parsePptxTransform(
            'translate(0,-7) translate(640.0,221.9) rotate(180.00) ' +
                'translate(-640.0,-221.9)',
        ) as number[];
        // A half turn round the box's centre, then 7 px up.
        expect(turned.map((one) => Math.round(one * 10) / 10)).toEqual([
            -1, 0, -0, -1, 1280, 436.8,
        ]);
    });

    it('reads a rotation about a point the same as its three moves', () => {
        const short = parsePptxTransform('rotate(30, 10, 20)') as any;
        const long = parsePptxTransform(
            'translate(10,20) rotate(30) translate(-10,-20)',
        ) as any;
        short.forEach((one: number, index: number) => {
            expect(one).toBeCloseTo(long[index], 6);
        });
    });

    it('says null for what it does not read', () => {
        expect(parsePptxTransform('perspective(3)')).toBeNull();
        expect(parsePptxTransform('translate(1,2) junk')).toBeNull();
        expect(parsePptxTransform('matrix(1,2,3)')).toBeNull();
    });

    it('multiplies left to right as svg applies them', () => {
        expect(
            multiplyPptxMatrix([1, 0, 0, 1, 5, 0], [2, 0, 0, 2, 0, 0]),
        ).toEqual([2, 0, 0, 2, 5, 0]);
    });
});

describe('listPptxSlideImageUses', () => {
    it('lists each picture once, at the largest size it is drawn', () => {
        const html = genSlideHtml(
            '<g data-id="1-1" transform="translate(0,0)">' +
                '<image href="images/a.jpg" width="100" height="50" ' +
                'preserveAspectRatio="none"/></g>' +
                '<g data-id="1-2" transform="translate(5,5) scale(2)">' +
                '<image href="images/a.jpg" width="100" height="50"/></g>' +
                '<g data-id="1-3"><image href="../secret.png" width="9" ' +
                'height="9"/></g>',
        );
        expect(listPptxSlideImageUses(html)).toEqual([
            { href: 'images/a.jpg', width: 200, height: 100 },
        ]);
    });
});

describe('toPptxSlideCanvasItems', () => {
    it('makes a plain colour background a locked box of that colour', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml('<rect width="1280" height="720" fill="#FFF"/>'),
            genOptions(),
        );
        expect(result?.canvasItems).toEqual([
            expect.objectContaining({
                id: 0,
                type: 'html',
                html: '',
                left: 0,
                top: 0,
                width: 1280,
                height: 720,
                locked: true,
                backgroundColor: '#ffffff',
            }),
        ]);
    });

    it('puts a drawn background on white, as PowerPoint paints a slide', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<rect width="1280" height="720" fill="url(#grad1)"/>' +
                    TEXT_GROUP,
                '<radialGradient id="grad1"><stop offset="0" ' +
                    'stop-color="#EFFAFC" stop-opacity="0.380"/>' +
                    '</radialGradient>',
            ),
            genOptions(),
        );
        expect(result?.canvasItems[0]).toMatchObject({
            locked: true,
            backgroundColor: '#ffffff',
        });
        expect((result?.canvasItems[1] as any).backgroundColor).toBe(
            '#00000000',
        );
    });

    it('places a text box where the shape is and keeps its markup', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(TEXT_GROUP),
            genOptions(),
        );
        const item = result?.canvasItems[0] as any;
        expect(item).toMatchObject({
            type: 'html',
            left: 72,
            top: -12,
            width: 205,
            height: 85.1,
            rotate: 0,
        });
        const div = parseItemHtml(item.html);
        // No foreignObject: the sanitizer would take it out with the words.
        expect(div.querySelector('foreignObject')).toBeNull();
        const words = Array.from(div.querySelectorAll('p')).at(0);
        expect(words?.textContent).toBe('Verse 1');
        // The converter page's reset first, the slide's own margin after it.
        expect(words?.getAttribute('style')).toMatch(
            /^margin:0;padding:0;box-sizing:border-box;.*margin-top:3.8pt/,
        );
        expect(item.html).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
    });

    it('turns a box by its own rotate, round the same centre', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-3" transform="translate(0,-7) ' +
                    'translate(640.0,221.9) rotate(180.00) ' +
                    'translate(-640.0,-221.9)">' +
                    '<path d="M0.0 170.3 L1280.0 0.0 L1280.0 443.9 Z" ' +
                    'fill="#ccc"/>' +
                    '<foreignObject x="0" y="0" width="1280.0" ' +
                    'height="443.9"><div><p>x</p></div></foreignObject></g>',
            ),
            genOptions(),
        );
        // The converter wrote the centre to a tenth (221.9 of 221.95).
        expect(result?.canvasItems[0]).toMatchObject({
            left: 0,
            top: -7.1,
            width: 1280,
            height: 443.9,
            rotate: 180,
        });
    });

    it('makes a picture alone a picture box, and names one not drawn', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-1" transform="translate(10,20)">' +
                    '<image href="images/a.jpg" width="300" height="200" ' +
                    'preserveAspectRatio="none"/></g>' +
                    '<g data-id="1-2" transform="translate(0,0)">' +
                    '<image href="images/gone.png" width="30" height="20" ' +
                    'preserveAspectRatio="none"/></g>',
            ),
            genOptions({ 'images/a.jpg': 'data:image/jpeg;base64,AAAA' }),
        );
        expect(result?.canvasItems).toEqual([
            expect.objectContaining({
                type: 'image',
                left: 10,
                top: 20,
                width: 300,
                height: 200,
                srcData: 'data:image/jpeg;base64,AAAA',
                mediaWidth: 64,
                mediaHeight: 32,
            }),
        ]);
        expect(result?.missingImages).toEqual(['images/gone.png']);
    });

    it('gives a shape the definitions it uses under ids of its own', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-4" transform="translate(42,215)">' +
                    '<g filter="url(#glow1)"><image href="images/a.jpg" ' +
                    'width="100" height="50" preserveAspectRatio="none"/></g>' +
                    '<rect width="100" height="50" fill="url(#grad1)"/></g>',
                '<filter id="glow1"><feGaussianBlur stdDeviation="2"/></filter>' +
                    '<linearGradient id="grad1" href="#grad0"/>' +
                    '<linearGradient id="grad0"><stop offset="0"/>' +
                    '</linearGradient><filter id="unused"/>',
            ),
            genOptions({ 'images/a.jpg': 'data:image/jpeg;base64,BBBB' }),
        );
        const item = result?.canvasItems[0] as any;
        const div = parseItemHtml(item.html);
        const idList = Array.from(div.querySelectorAll('[id]')).map((one) => {
            return one.id;
        });
        expect(idList.sort()).toEqual(['p-0-glow1', 'p-0-grad0', 'p-0-grad1']);
        expect(item.html).toContain('url(#p-0-glow1)');
        expect(item.html).toContain('url(#p-0-grad1)');
        expect(item.html).toContain('href="#p-0-grad0"');
        expect(item.html).toContain('data:image/jpeg;base64,BBBB');
        expect(item.html).not.toContain('images/a.jpg');
    });

    it('keeps the stacking order of drawing after a text box', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-1" transform="translate(0,0)">' +
                    '<rect width="10" height="10" fill="red"/>' +
                    '<foreignObject x="0" y="0" width="10" height="10">' +
                    '<div><p>t</p></div></foreignObject>' +
                    '<rect width="10" height="10" fill="blue"/></g>',
            ),
            genOptions(),
        );
        const div = parseItemHtml((result?.canvasItems[0] as any).html);
        const layerList = Array.from(div.firstElementChild!.children).map(
            (one) => {
                return one.tagName.toLowerCase();
            },
        );
        expect(layerList).toEqual(['svg', 'div', 'svg']);
        const fillList = Array.from(div.querySelectorAll('rect')).map((one) => {
            return one.getAttribute('fill');
        });
        expect(fillList).toEqual(['red', 'blue']);
    });

    it('carries a filter round a text box onto its words', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-4" transform="translate(42,215)">' +
                    '<g style="filter:drop-shadow(17px 17px 20px #000);">' +
                    '<rect width="100" height="50" fill="none"/>' +
                    '<foreignObject x="0" y="0" width="100" height="50">' +
                    '<div><p>Welcome</p></div></foreignObject></g></g>',
            ),
            genOptions(),
        );
        const div = parseItemHtml((result?.canvasItems[0] as any).html);
        const words = div.querySelector('p')?.parentElement?.parentElement;
        expect(words?.getAttribute('style')).toContain(
            'filter:drop-shadow(17px 17px 20px #000)',
        );
    });

    it('splits a group of shapes into a box a shape', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-1" transform="translate(100,100)">' +
                    '<g data-id="1-2" transform="translate(10,0)">' +
                    '<rect width="20" height="20" fill="red"/></g>' +
                    '<g data-id="1-3" transform="translate(0,30)">' +
                    '<rect width="40" height="10" fill="red"/></g></g>',
            ),
            genOptions(),
        );
        expect(
            result?.canvasItems.map((one) => {
                return [one.left, one.top, one.width, one.height];
            }),
        ).toEqual([
            [110, 100, 20, 20],
            [100, 130, 40, 10],
        ]);
    });

    it('keeps a stretched shape`s own matrix in a box the size of the slide', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="1-1" transform="translate(10,10) scale(-1,1)">' +
                    '<rect width="20" height="20" fill="red"/></g>',
            ),
            genOptions(),
        );
        const item = result?.canvasItems[0] as any;
        expect(item).toMatchObject({ left: 0, top: 0, width: 1280 });
        expect(item.html).toContain('transform="matrix(-1,0,0,1,10,10)"');
    });

    // A build step's shape is `display:none` on the slide's first look
    // (worship deck, slide 47): drawn, it put the words up a click early.
    it('leaves out a shape and a part the page does not draw', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                TEXT_GROUP.replace(
                    'data-pptx-id="2"',
                    'data-pptx-id="2" style="display:none;"',
                ) +
                    '<g data-id="2-3" transform="translate(5,5)">' +
                    '<rect width="20" height="20" fill="red"/>' +
                    '<rect width="10" height="10" fill="blue" ' +
                    'style="visibility: hidden"/>' +
                    '<g display="none"><foreignObject width="9" height="9">' +
                    '<div xmlns="http://www.w3.org/1999/xhtml">Later</div>' +
                    '</foreignObject></g></g>',
            ),
            genOptions(),
        );
        expect(result?.canvasItems).toHaveLength(1);
        const html = (result?.canvasItems[0] as any).html;
        expect(html).toContain('fill="red"');
        expect(html).not.toContain('fill="blue"');
        expect(html).not.toContain('Later');
        expect(html).not.toContain('Verse 1');
    });

    it('takes the slide, not the one before it a transition draws under it', () => {
        const page = genSlideHtml(
            '<g data-id="31-1"><rect width="20" height="20" fill="blue"/></g>',
        ).replace(
            '</div></body>',
            '<svg class="pptx-slide-layer" xmlns="http://www.w3.org/2000/svg" ' +
                'width="1280" height="720" viewBox="0 0 1280 720" ' +
                'style="z-index:1;animation:pptxCover 2s both">' +
                '<g data-id="32-1"><rect width="20" height="20" fill="red"/>' +
                '<image href="images/now.png" width="40" height="30" ' +
                'preserveAspectRatio="none"/></g></svg>' +
                // A curtain's strip draws the slide before it again.
                '<div class="pptx-curtain"><div class="pptx-curtain-cloth">' +
                '<svg class="pptx-slide-layer" width="1280" height="720">' +
                '<g data-id="31-1"><rect width="20" height="20" fill="blue"/>' +
                '</g></svg></div></div></div></body>',
        );
        const html = (
            toPptxSlideCanvasItems(page, genOptions())?.canvasItems[0] as any
        ).html;
        expect(html).toContain('fill="red"');
        expect(html).not.toContain('fill="blue"');
        expect(listPptxSlideImageUses(page)).toEqual([
            { href: 'images/now.png', width: 40, height: 30 },
        ]);
    });

    // A build step's motion path is the shape's CSS transform, over the
    // move the shape had (worship deck, slide 44's second step).
    it('places a shape where its motion path left it', () => {
        const result = toPptxSlideCanvasItems(
            genSlideHtml(
                '<g data-id="44_2-2" data-pptx-id="6" ' +
                    'style="--pptx-motion-to-x:4.0px;transform:translate(609.7px,1.7px);' +
                    'transform-box:fill-box;transform-origin:center center;' +
                    'animation:pptxMotionPath 2s both;">' +
                    '<g transform="translate(-596,229)">' +
                    '<rect width="576.4" height="242.3" fill="none"/>' +
                    '<rect width="20" height="20" fill="red"/>' +
                    '<foreignObject width="576.4" height="242.3">' +
                    '<div xmlns="http://www.w3.org/1999/xhtml">Preacher</div>' +
                    '</foreignObject></g></g>',
            ),
            genOptions(),
        );
        const item = result?.canvasItems[0] as any;
        expect(item).toMatchObject({
            left: 13.7,
            top: 230.7,
            width: 576.4,
            height: 242.3,
        });
        expect(item.html).toContain('Preacher');
        expect(item.html).not.toContain('609.7');
        expect(item.html).not.toContain('pptxMotionPath');
    });

    it('answers null for a page with no slide drawn', () => {
        expect(
            toPptxSlideCanvasItems('<html><body>nothing</body></html>', {
                ...genOptions(),
            }),
        ).toBeNull();
    });
});
