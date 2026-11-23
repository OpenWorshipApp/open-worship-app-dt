import { describe, expect, test } from 'vitest';

import { concatBytes, toZipBytes } from './officeZipHelpers';
import {
    type OfficeAskedChangeType,
    type OfficeReplaceType,
    applyOfficeChanges,
    readOfficeDocument,
    toOfficeReadResult,
} from './officePackageEditHelpers';
import {
    openOfficePackage,
    writeOfficePackage,
} from './officePackageIoHelpers';

// The slide master's and the layouts' own shapes -- a church's name and
// logo on every slide, a note on every slide of one layout -- read and
// changed as a slide's boxes are (2026-11-21, the goal "chatbot can change
// do everything on a given pptx": the master's own shapes had been
// PowerPoint's).

const REL =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const NS =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const GROUP =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
    '</p:nvGrpSpPr><p:grpSpPr/>';
// a PNG's head with its size, 400 by 300
function genPng() {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(bytes.buffer).setUint32(16, 400);
    new DataView(bytes.buffer).setUint32(20, 300);
    return bytes;
}
const PNG = genPng();

function genRels(rels: [string, string, string][]) {
    return (
        HEADER +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        rels
            .map(([id, type, target]) => {
                return `<Relationship Id="${id}" Type="${REL}${type}" Target="${target}"/>`;
            })
            .join('') +
        '</Relationships>'
    );
}

function genTextBox(
    id: number,
    name: string,
    words: string,
    ph = '',
    place = '<a:xfrm><a:off x="0" y="6000000"/><a:ext cx="3000000" cy="500000"/></a:xfrm>',
) {
    return (
        `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/>` +
        `<p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${place}` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
        '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>' +
        `<a:t>${words}</a:t></a:r></a:p></p:txBody></p:sp>`
    );
}

const LOGO =
    '<p:pic><p:nvPicPr><p:cNvPr id="5" name="Logo" descr="logo.png"/>' +
    '<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>' +
    '<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm>' +
    '<a:off x="11000000" y="100000"/><a:ext cx="900000" cy="600000"/>' +
    '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';

function genSlide(title: string) {
    return (
        `${HEADER}<p:sld ${NS}><p:cSld><p:spTree>${GROUP}` +
        genTextBox(2, 'Title 1', title, '<p:ph type="title"/>', '') +
        '</p:spTree></p:cSld></p:sld>'
    );
}

async function genDeckBytes(masterExtra = '', firstTitle = 'Sunday') {
    return await toZipBytes([
        {
            fileName: '[Content_Types].xml',
            data:
                HEADER +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Default Extension="png" ContentType="image/png"/>' +
                '<Override PartName="/ppt/presentation.xml" ContentType="p"/>' +
                '</Types>',
        },
        {
            fileName: '_rels/.rels',
            data: genRels([['rId1', 'officeDocument', 'ppt/presentation.xml']]),
        },
        {
            fileName: 'ppt/presentation.xml',
            data:
                HEADER +
                `<p:presentation ${NS}><p:sldMasterIdLst>` +
                '<p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
                '<p:sldIdLst><p:sldId id="256" r:id="rId2"/>' +
                '<p:sldId id="257" r:id="rId3"/></p:sldIdLst>' +
                '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
        },
        {
            fileName: 'ppt/_rels/presentation.xml.rels',
            data: genRels([
                ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
                ['rId2', 'slide', 'slides/slide1.xml'],
                ['rId3', 'slide', 'slides/slide2.xml'],
            ]),
        },
        {
            fileName: 'ppt/slideMasters/slideMaster1.xml',
            data:
                `${HEADER}<p:sldMaster ${NS}><p:cSld><p:spTree>${GROUP}` +
                genTextBox(
                    2,
                    'Title Placeholder 1',
                    'Click to edit Master title style',
                    '<p:ph type="title"/>',
                ) +
                genTextBox(4, 'Church Name', 'Grace Church') +
                LOGO +
                masterExtra +
                '</p:spTree></p:cSld><p:txStyles/></p:sldMaster>',
        },
        {
            fileName: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
            data: genRels([
                ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
                ['rId2', 'image', '../media/image1.png'],
            ]),
        },
        { fileName: 'ppt/media/image1.png', data: PNG },
        {
            fileName: 'ppt/slideLayouts/slideLayout1.xml',
            data:
                `${HEADER}<p:sldLayout ${NS}><p:cSld name="Title Only">` +
                `<p:spTree>${GROUP}` +
                genTextBox(
                    2,
                    'Title 1',
                    'Click to edit',
                    '<p:ph type="title"/>',
                ) +
                genTextBox(3, 'Welcome Note', 'Welcome home') +
                '</p:spTree></p:cSld></p:sldLayout>',
        },
        {
            fileName: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
            data: genRels([
                ['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'],
            ]),
        },
        { fileName: 'ppt/slides/slide1.xml', data: genSlide(firstTitle) },
        { fileName: 'ppt/slides/slide2.xml', data: genSlide('Prayer') },
        ...[1, 2].map((n) => {
            return {
                fileName: `ppt/slides/_rels/slide${n}.xml.rels`,
                data: genRels([
                    ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
                ]),
            };
        }),
    ]);
}

async function readDeck(bytes: Uint8Array) {
    const opened = openOfficePackage(bytes);
    if ('reason' in opened) {
        throw new Error(opened.reason);
    }
    const document = await readOfficeDocument(opened.pkg, 'pptx');
    if ('reason' in document || document.kind !== 'pptx') {
        throw new Error('not a deck');
    }
    return { opened, document };
}

async function runOnDeck(
    changes: OfficeAskedChangeType[],
    replaces: OfficeReplaceType[] = [],
    masterExtra = '',
    firstTitle?: string,
) {
    const { opened, document } = await readDeck(
        await genDeckBytes(masterExtra, firstTitle),
    );
    const result = await applyOfficeChanges(
        opened.pkg,
        document,
        changes,
        replaces,
        new Map([['/pictures/cross.png', PNG]]),
    );
    if ('reason' in result) {
        return { reason: result.reason };
    }
    const chunks: Uint8Array[] = [];
    await writeOfficePackage(opened, result.parts, (chunk) => {
        chunks.push(chunk);
    });
    const after = await readDeck(concatBytes(chunks));
    return {
        changed: result.changed,
        master:
            (await after.opened.pkg.readText(
                'ppt/slideMasters/slideMaster1.xml',
            )) ?? '',
        layout:
            (await after.opened.pkg.readText(
                'ppt/slideLayouts/slideLayout1.xml',
            )) ?? '',
        slide1:
            (await after.opened.pkg.readText('ppt/slides/slide1.xml')) ?? '',
        document: after.document,
    };
}

async function runOk(
    changes: OfficeAskedChangeType[],
    replaces: OfficeReplaceType[] = [],
) {
    const out = await runOnDeck(changes, replaces);
    if ('reason' in out) {
        throw new Error(out.reason);
    }
    return out;
}

describe('the slide master and the layouts, read', () => {
    test('their own shapes and words are read; never a placeholder', async () => {
        const { document } = await readDeck(await genDeckBytes());
        const read = toOfficeReadResult(document);
        expect(read).toMatchObject({
            slideCount: 2,
            masters: [
                {
                    slide: 'master',
                    on: 'every slide',
                    boxes: [
                        { name: 'Church Name' },
                        { name: 'Logo', kind: 'picture' },
                    ],
                    lines: [
                        {
                            id: '10001.2',
                            box: 'Church Name',
                            text: 'Grace Church',
                        },
                    ],
                },
                {
                    slide: 'layout: Title Only',
                    on: 'slides 1-2',
                    boxes: [{ name: 'Welcome Note' }],
                    lines: [{ text: 'Welcome home' }],
                },
            ],
        });
        expect(JSON.stringify(read)).not.toContain('Click to edit');
    });

    test('a later part of a long deck does not repeat them', async () => {
        const { document } = await readDeck(await genDeckBytes());
        expect(toOfficeReadResult(document, 2)).not.toHaveProperty('masters');
    });
});

describe('the slide master and the layouts, changed', () => {
    test("the master's words by id, said as the slide master's", async () => {
        const out = await runOk([{ id: '10001.2', text: 'Hope Church' }]);
        expect(out.master).toContain('<a:t>Hope Church</a:t>');
        expect(out.master).not.toContain('Grace Church');
        expect(out.changed).toEqual([
            "The slide master's line 10001.2 now reads “Hope Church”.",
        ]);
    });

    test("a look on the master's box, named as the slide master", async () => {
        const out = await runOk([
            { slide: 'master', box: 'Church Name', color: 'red', bold: true },
        ]);
        expect(out.master).toMatch(
            /<a:rPr lang="en-US" b="1"><a:solidFill><a:srgbClr val="FF0000"\/>/,
        );
        expect(out.slide1).not.toContain('FF0000');
        expect(out.changed.join(' ')).toContain('the slide master');
        expect(out.changed.join(' ')).not.toMatch(/1000\d/);
    });

    test("the master's logo taken off, and the master's background", async () => {
        const out = await runOk([
            { slide: 'the slide master', removeBox: 'Logo' },
            { slide: 'master', background: 'navy' },
        ]);
        expect(out.master).not.toContain('name="Logo"');
        expect(out.master).toMatch(/<p:cSld><p:bg>[\s\S]*000080/);
        expect(out.document.shared?.[0].boxes.map((box) => box.name)).toEqual([
            'Church Name',
        ]);
    });

    test("a layout's own box, by the layout's name", async () => {
        const out = await runOk([
            { slide: 'Layout: title only', removeBox: 'Welcome Note' },
        ]);
        expect(out.layout).not.toContain('Welcome Note');
        expect(out.master).toContain('Grace Church');
    });

    test('a text box added to the master is on every slide', async () => {
        const out = await runOk([
            {
                slide: 'master',
                textBox: 'Pray without ceasing',
                at: [5, 90, 50, 8],
            },
        ]);
        expect(out.master).toContain('<a:t>Pray without ceasing</a:t>');
        expect(out.slide1).not.toContain('Pray without ceasing');
    });

    test("the master's logo swapped for an attached picture", async () => {
        const out = await runOk([
            { slide: 'master', box: 'Logo', picture: '/pictures/cross.png' },
        ]);
        expect(out.master).toMatch(/name="Logo"[\s\S]*r:embed="rId3"/);
        expect(out.changed.join(' ')).toContain('the slide master');
    });

    test('a word replaced everywhere reaches the master', async () => {
        const out = await runOk(
            [],
            [{ from: 'Grace Church', to: 'Hope Church' }],
        );
        expect(out.master).toContain('<a:t>Hope Church</a:t>');
    });

    test("a background behind the master's curtain: how to take it off", async () => {
        const curtain =
            '<p:pic><p:nvPicPr><p:cNvPr id="9" name="Curtain"/><p:cNvPicPr/>' +
            '<p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>' +
            '</p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/>' +
            '<a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr></p:pic>';
        const out = await runOnDeck(
            [{ slide: 1, background: 'navy' }],
            [],
            curtain,
        );
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        expect(out.changed.join(' ')).toContain(
            '"Curtain" on its master on slide 1. Say so; ' +
                '{"slide":"master","removeBox":"Curtain"} takes it off every ' +
                'slide that shows it, and the colour shows there.',
        );
    });

    test("a footer of the master's own words points at its box", async () => {
        expect(
            await runOnDeck([
                { footer: 'Grace Church', color: 'green', bold: true },
            ]),
        ).toEqual({
            reason:
                '"Grace Church" is already on every slide: the slide ' +
                'master\'s box "Church Name" (id 10001.2). Change it there ' +
                '-- {id: "10001.2", text} for its words, {slide: "master", ' +
                'box: "Church Name", color, bold, …} for its look -- never ' +
                'as a footer.',
        });
    });

    test("words given a look everywhere are the master's too", async () => {
        const out = await runOk([
            { words: 'Grace Church', color: 'green', bold: true },
        ]);
        expect(out.master).toMatch(
            /<a:rPr lang="en-US" b="1"><a:solidFill><a:srgbClr val="008000"\/><\/a:solidFill><\/a:rPr><a:t>Grace Church<\/a:t>/,
        );
        // never the placeholder's prompt words
        expect(out.master).toMatch(
            /<a:rPr lang="en-US"\/><a:t>Click to edit Master title style/,
        );
        const every = await runOk([{ color: 'red' }]);
        expect(every.master).toMatch(/FF0000[^]*Grace Church/);
        expect(every.slide1).toContain('FF0000');
    });

    // seen live in Khmer: "the church's name at the bottom of every slide"
    // sent as those words everywhere greened a title saying them too, and
    // "every Grace Church in the file" sent the same way
    test('words on every slide AND on a slide: sent again by what was said', async () => {
        expect(
            await runOnDeck(
                [{ words: 'Grace Church', color: 'green', bold: true }],
                [],
                '',
                'Welcome to Grace Church',
            ),
        ).toEqual({
            reason:
                '“Grace Church” is the slide master\'s box "Church Name", on ' +
                'every slide, and is also written on slide 1 itself ' +
                '(“Welcome to Grace Church”). Send it again now, not asked, ' +
                'by one test: did their question WRITE “Grace Church” ' +
                'itself? Then they mean every place it is written: {words: ' +
                '"Grace Church", everywhere: true, …the look} -- that box ' +
                'and the words on slide 1. Did they name it instead by ' +
                'where or what it is (the name at the bottom of every slide, ' +
                'the church name) without writing those words? Then it is ' +
                'that box alone: {slide: "master", box: "Church Name", …the ' +
                'look}.',
        });
        // every place: the master's box and slide 1's words, in one change
        const everywhere = await runOnDeck(
            [
                {
                    words: 'Grace Church',
                    everywhere: true,
                    color: 'green',
                },
            ],
            [],
            '',
            'Welcome to Grace Church',
        );
        if ('reason' in everywhere) {
            throw new Error(everywhere.reason);
        }
        expect(everywhere.master).toMatch(
            /<a:srgbClr val="008000"\/><\/a:solidFill><\/a:rPr><a:t>Grace Church/,
        );
        expect(everywhere.slide1).toMatch(
            /<a:srgbClr val="008000"\/><\/a:solidFill><\/a:rPr><a:t>Grace Church/,
        );
        expect(
            await runOnDeck(
                [{ slide: 1, words: 'Grace Church', everywhere: true }],
                [],
                '',
                'Welcome to Grace Church',
            ),
        ).toEqual({
            reason:
                '`everywhere` goes with `words` alone, no `slide` or `box`: ' +
                "every place the words are written, a slide master's box too.",
        });
        // each answer, sent as it says, is made
        for (const changes of [
            [
                {
                    slide: 'master',
                    box: 'Church Name',
                    color: 'green',
                    bold: true,
                },
            ],
            [
                {
                    slide: 'master',
                    box: 'Church Name',
                    color: 'green',
                    bold: true,
                },
                { slide: 1, words: 'Grace Church', color: 'green' },
            ],
        ] as OfficeAskedChangeType[][]) {
            expect(
                await runOnDeck(changes, [], '', 'Welcome to Grace Church'),
            ).not.toHaveProperty('reason');
        }
        // words no slide says are the master's alone, as before
        expect(
            await runOnDeck([
                { words: 'Grace Church', color: 'green', bold: true },
            ]),
        ).not.toHaveProperty('reason');
    });

    test("a slide's own change is refused on the master", async () => {
        expect(await runOnDeck([{ slide: 'master', hidden: true }])).toEqual({
            reason:
                "`hidden` is a slide's, never the slide master's: a master " +
                'or a layout takes its own boxes (their words, looks, place ' +
                'and pictures), new text boxes, shapes and pictures, and its ' +
                'background.',
        });
        expect(
            await runOnDeck([{ slide: 'layout: Title Only', note: 'x' }]),
        ).toMatchObject({
            reason: expect.stringMatching(
                /^`note` is a slide's, never the "Title Only" layout's/,
            ),
        });
    });

    test('a layout no slide uses, or a box the master lacks, is said by name', async () => {
        expect(
            await runOnDeck([{ slide: 'layout: Blank', removeBox: 'x' }]),
        ).toEqual({
            reason:
                'The deck has no "layout: Blank" that a slide uses. It has: ' +
                '"master", "layout: Title Only".',
        });
        expect(
            await runOnDeck([
                { slide: 'master', box: 'Footer Art', color: 'red' },
            ]),
        ).toEqual({
            reason:
                'The slide master has no box "Footer Art". Its boxes: ' +
                '"Church Name" (text), "Logo" (picture).',
        });
        expect(
            await runOnDeck([{ slide: 'master 2', removeBox: 'Logo' }]),
        ).toMatchObject({
            reason: expect.stringMatching(/^The deck has no "master 2"/),
        });
    });
});
