/**
 * The Bible Note editor's toolbar, control by control, done through
 * `owa_note_edit`'s changes (2026-11-08, the user, with a picture of the
 * toolbar: _make chatbot able to use all toolbar operations_). Each test is
 * named `toolbar: <id>` after an item of the inventory
 * `.claude/skills/owa-enhance-bible-note-chatbot/references/toolbar-inventory.json`,
 * and asserts the node the editor's own control writes; the skill's
 * `scripts/toolbar-coverage.mjs` counts a control covered when its test
 * passes. Undo and Redo go through the worker and are tested beside it
 * (`agentNoteEditHelpers.test.ts`, the same names).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers';

const INVENTORY_PATH = join(
    process.cwd(),
    '.claude/skills/owa-enhance-bible-note-chatbot/references/toolbar-inventory.json',
);
// Tested in the worker's own file, where the note's history is.
const WORKER_TESTED_ID_LIST = ['undo', 'redo', 'show-invisible-characters'];

type NodeType = Record<string, any>;

function text(words: string, extra: NodeType = {}): NodeType {
    return {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: words,
        type: 'text',
        version: 1,
        ...extra,
    };
}

function element(type: string, children: NodeType[], extra: NodeType = {}) {
    return {
        children,
        direction: null,
        format: '',
        indent: 0,
        type,
        version: 1,
        ...extra,
    };
}

function paragraph(children: NodeType[]) {
    return element('paragraph', children, { textFormat: 0, textStyle: '' });
}

function listItem(words: string) {
    return element('listitem', [text(words)], { value: 1 });
}

// 1 a heading, 2 a paragraph, 3-5 a bullet list, 6 a quote.
const CONTENT = JSON.stringify({
    root: element('root', [
        element('heading', [text('Grace Alone')], { tag: 'h2' }),
        paragraph([text('Love is patient and kind')]),
        element(
            'list',
            [
                listItem('first point'),
                listItem('second point'),
                listItem('third'),
            ],
            {
                listType: 'bullet',
                start: 1,
                tag: 'ul',
                textFormat: 0,
                textStyle: '',
            },
        ),
        element('quote', [text('Faith, hope, love')]),
    ]),
});

function edit(changes: any[], extra: Record<string, any> = {}) {
    const result = applyNoteEdit({ content: CONTENT, changes, ...extra });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return { result, root: JSON.parse(result.content).root };
}

function kindsOf(content: string) {
    return readNoteBlocks(content)!.blocks.map((block) => {
        return block.kind;
    });
}

function runOf(root: NodeType, words: string): NodeType {
    const found: NodeType[] = [];
    const visit = (node: NodeType) => {
        if (node.text === words) {
            found.push(node);
        }
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    visit(root);
    if (found.length === 0) {
        throw new Error(`no run "${words}"`);
    }
    return found[0];
}

function addedObject(kind: string, words: string, extra: NodeType = {}) {
    const { root } = edit([{ after: 2, kind, text: words, ...extra }], {
        now: new Date(2026, 10, 8, 15, 30),
        genId: () => 'abcde',
    });
    return root.children[2];
}

function expectStyleBit(name: string, bit: number) {
    const { root } = edit([{ block: 2, words: 'patient', styles: [name] }]);
    expect(runOf(root, 'patient').format & bit).toBe(bit);
    // Only those words: the rest of the sentence is as it was.
    expect(runOf(root, 'Love is ').format).toBe(0);
}

const PROBE_MAP: Record<string, () => void> = {
    'block-normal': () => {
        const { result } = edit([{ block: 1, kind: 'paragraph' }]);
        expect(kindsOf(result.content)[0]).toBe('paragraph');
    },
    'block-heading-1': () => {
        const { root } = edit([{ block: 2, kind: 'h1' }]);
        expect(root.children[1]).toMatchObject({ type: 'heading', tag: 'h1' });
    },
    'block-heading-2': () => {
        const { root } = edit([{ block: 2, kind: 'h2' }]);
        expect(root.children[1]).toMatchObject({ type: 'heading', tag: 'h2' });
    },
    'block-heading-3': () => {
        const { root } = edit([{ block: 2, kind: 'h3' }]);
        expect(root.children[1]).toMatchObject({ type: 'heading', tag: 'h3' });
    },
    'block-numbered-list': () => {
        const { root } = edit([{ block: 2, kind: 'number' }]);
        expect(root.children[1]).toMatchObject({
            type: 'list',
            listType: 'number',
            tag: 'ol',
        });
    },
    'block-bullet-list': () => {
        const { root } = edit([{ block: 2, kind: 'bullet' }]);
        expect(root.children[1]).toMatchObject({
            type: 'list',
            listType: 'bullet',
        });
    },
    'block-check-list': () => {
        const { root } = edit([{ block: 2, kind: 'check', checked: true }]);
        expect(root.children[1].listType).toBe('check');
        expect(root.children[1].children[0].checked).toBe(true);
    },
    'block-quote': () => {
        const { root } = edit([{ block: 2, kind: 'quote' }]);
        expect(root.children[1].type).toBe('quote');
    },
    'block-code': () => {
        const { root } = edit([{ block: 2, kind: 'code' }]);
        expect(root.children[1].type).toBe('code');
    },
    'font-family': () => {
        const { root } = edit([{ block: 2, font: 'georgia' }]);
        expect(runOf(root, 'Love is patient and kind').style).toBe(
            'font-family: Georgia;',
        );
        // What the next words typed there get, too.
        expect(root.children[1].textStyle).toBe('font-family: Georgia;');
        // A language's own face, as the font box lists it.
        const khmer = edit([{ block: 2, font: 'app-Battambang' }], {
            fontList: ['Arial', 'app-Battambang'],
        });
        expect(runOf(khmer.root, 'Love is patient and kind').style).toBe(
            'font-family: app-Battambang;',
        );
        const back = applyNoteEdit({
            content: khmer.result.content,
            changes: [{ block: 2, font: 'default' }],
        });
        expect(
            'content' in back && JSON.parse(back.content).root.children[1],
        ).toMatchObject({ textStyle: '' });
    },
    'font-size-decrease': () => {
        const { root } = edit([{ block: 2, size: 'smaller' }]);
        expect(runOf(root, 'Love is patient and kind').style).toBe(
            'font-size: 12px;',
        );
    },
    'font-size-input': () => {
        const { root } = edit([{ block: 2, size: 36 }]);
        expect(runOf(root, 'Love is patient and kind').style).toBe(
            'font-size: 36px;',
        );
        // The size box on a selection: those words alone.
        const words = edit([{ block: 2, words: 'kind', size: 30 }]).root;
        expect(runOf(words, 'kind').style).toBe('font-size: 30px;');
        expect(runOf(words, 'Love is patient and ').style).toBe('');
    },
    'font-size-increase': () => {
        const { root } = edit([{ block: 2, size: 'larger' }]);
        expect(runOf(root, 'Love is patient and kind').style).toBe(
            'font-size: 19px;',
        );
    },
    bold: () => {
        expectStyleBit('bold', 1);
        const { root } = edit([{ block: 2, text: 'Love is **patient**' }]);
        expect(runOf(root, 'patient').format).toBe(1);
    },
    italic: () => {
        expectStyleBit('italic', 2);
    },
    underline: () => {
        expectStyleBit('underline', 8);
    },
    'inline-code': () => {
        expectStyleBit('code', 16);
    },
    link: () => {
        const { root } = edit([
            { block: 2, text: 'Love is [patient](https://example.org/love)' },
        ]);
        const link = root.children[1].children[1];
        expect(link).toMatchObject({
            type: 'link',
            url: 'https://example.org/love',
        });
        expect(link.children[0].text).toBe('patient');
    },
    'text-color': () => {
        const { root } = edit([
            { block: 2, words: 'patient', color: 'Dark Red' },
        ]);
        expect(runOf(root, 'patient').style).toBe('color: darkred;');
        const back = applyNoteEdit({
            content: JSON.stringify({ root }),
            changes: [{ block: 2, words: 'patient', color: 'none' }],
        });
        expect(
            'content' in back &&
                runOf(JSON.parse(back.content).root, 'patient').style,
        ).toBe('');
    },
    'background-color': () => {
        const { root } = edit([{ block: 1, background: '#FFEB3B' }]);
        expect(runOf(root, 'Grace Alone').style).toBe(
            'background-color: #ffeb3b;',
        );
    },
    lowercase: () => {
        expectStyleBit('lowercase', 256);
    },
    uppercase: () => {
        expectStyleBit('uppercase', 512);
        // One case at a time, as the editor toggles them.
        const { root } = edit([
            { block: 2, words: 'patient', styles: ['lowercase'] },
        ]);
        const again = applyNoteEdit({
            content: JSON.stringify({ root }),
            changes: [{ block: 2, words: 'patient', styles: ['uppercase'] }],
        });
        expect(
            'content' in again &&
                runOf(JSON.parse(again.content).root, 'patient').format,
        ).toBe(512);
    },
    capitalize: () => {
        expectStyleBit('capitalize', 1024);
    },
    strikethrough: () => {
        expectStyleBit('strikethrough', 4);
        const { root } = edit([{ block: 2, text: 'Love is ~~patient~~' }]);
        expect(runOf(root, 'patient').format).toBe(4);
    },
    subscript: () => {
        expectStyleBit('subscript', 32);
    },
    superscript: () => {
        expectStyleBit('superscript', 64);
        // Subscript and superscript are one or the other.
        const { root } = edit([
            {
                block: 2,
                words: 'patient',
                styles: ['subscript', 'superscript'],
            },
        ]);
        expect(runOf(root, 'patient').format).toBe(64);
    },
    highlight: () => {
        expectStyleBit('highlight', 128);
        const { root } = edit([
            { block: 2, words: 'patient', styles: ['highlight'] },
        ]);
        const off = applyNoteEdit({
            content: JSON.stringify({ root }),
            changes: [{ block: 2, words: 'patient', stylesOff: ['highlight'] }],
        });
        expect(
            'content' in off &&
                runOf(JSON.parse(off.content).root, 'patient').format,
        ).toBe(0);
    },
    'clear-formatting': () => {
        const styled = edit([
            {
                block: 1,
                color: 'red',
                styles: ['bold'],
                align: 'center',
            },
        ]);
        const cleared = applyNoteEdit({
            content: styled.result.content,
            changes: [{ block: 1, clear: true }],
        });
        if ('reason' in cleared) {
            throw new Error(cleared.reason);
        }
        const block = JSON.parse(cleared.content).root.children[0];
        // A heading is made a paragraph, its words plain, its alignment back.
        expect(block).toMatchObject({ type: 'paragraph', format: '' });
        expect(block.children[0]).toMatchObject({ style: '', format: 0 });
    },
    'insert-horizontal-rule': () => {
        expect(addedObject('rule', '')).toEqual({
            type: 'horizontalrule',
            version: 1,
        });
    },
    'insert-page-break': () => {
        expect(addedObject('page-break', '')).toEqual({
            type: 'page-break',
            version: 1,
        });
    },
    'insert-media': () => {
        const picture = addedObject(
            'media',
            'https://example.org/cross.jpg\nThe cross',
        ).children[0];
        expect(picture).toMatchObject({
            type: 'image',
            src: 'https://example.org/cross.jpg',
            altText: 'The cross',
            mediaType: 'image',
            maxWidth: 500,
        });
        expect(
            addedObject('media', 'C:\\media\\hymn.mp3').children[0],
        ).toMatchObject({ mediaType: 'audio', altText: 'hymn.mp3' });
    },
    'insert-mention-name': () => {
        const { root } = edit([{ block: 2, text: 'Love is like [@Mary]' }], {
            nameMap: new Map([
                ['mention:Mary', { mentionId: 'm-1', mentionName: 'Mary' }],
            ]),
        });
        expect(runOf(root, 'Mary')).toMatchObject({
            type: 'mention',
            mentionKind: 'mention',
            mentionId: 'm-1',
            mode: 'segmented',
        });
        // A name the lookup does not have stays words.
        const unknown = edit([{ block: 2, text: 'Love is like [@Zork]' }]).root;
        expect(runOf(unknown, 'Zork').type).toBe('text');
    },
    'insert-pin-location': () => {
        const { root } = edit([{ block: 2, text: 'Born in [#Bethlehem]' }], {
            nameMap: new Map([
                [
                    'location:Bethlehem',
                    { mentionId: 'p-34', mentionName: 'Bethlehem' },
                ],
            ]),
        });
        expect(runOf(root, 'Bethlehem')).toMatchObject({
            type: 'mention',
            mentionKind: 'location',
            mentionId: 'p-34',
        });
    },
    'insert-bible-verse': () => {
        const { root } = edit([{ block: 2, text: 'See [^John 3:16]' }], {
            verseMap: new Map([
                [
                    'John 3:16',
                    {
                        mentionName: '(KJV) John 3:16',
                        shownText: 'John 3:16',
                        verseText: '(16): For God so loved the world',
                        style: '',
                    },
                ],
            ]),
        });
        expect(runOf(root, 'John 3:16')).toMatchObject({
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionData: '(16): For God so loved the world',
        });
    },
    'insert-emoji': () => {
        const { root } = edit([{ block: 2, text: 'Love is patient 🙏' }]);
        expect(runOf(root, 'Love is patient 🙏').type).toBe('text');
    },
    'insert-table': () => {
        const table = addedObject(
            'table',
            'Book | Chapter\nJohn | 3\nRomans | 8',
        );
        expect(table).toMatchObject({ type: 'table', colWidths: [92, 92] });
        expect(table.children).toHaveLength(3);
        expect(table.children[0].children[0].headerState).toBe(1);
        expect(table.children[1].children[0].headerState).toBe(0);
        expect(runOf(table, 'Romans').type).toBe('text');
    },
    'insert-poll': () => {
        const poll = addedObject(
            'poll',
            'Which hymn next?\n- Amazing Grace\n- Be Thou My Vision',
        ).children[0];
        expect(poll).toEqual({
            type: 'poll',
            version: 1,
            question: 'Which hymn next?',
            options: [
                { text: 'Amazing Grace', uid: 'abcde', votes: [] },
                { text: 'Be Thou My Vision', uid: 'abcde', votes: [] },
            ],
        });
    },
    'insert-columns-layout': () => {
        const layout = addedObject('columns', 'Law\nProphets | Gospels');
        expect(layout).toMatchObject({
            type: 'layout-container',
            templateColumns: '1fr 1fr',
        });
        expect(layout.children[0].children).toHaveLength(2);
        expect(runOf(layout.children[1], 'Gospels').type).toBe('text');
    },
    'insert-equation': () => {
        expect(addedObject('equation', '7 \\times 70').children[0]).toEqual({
            type: 'equation',
            version: 1,
            equation: '7 \\times 70',
            inline: false,
        });
    },
    'insert-sticky-note': () => {
        const sticky = addedObject('sticky', 'Pray for Tom', {
            color: 'Pink',
        });
        expect(sticky).toMatchObject({
            type: 'sticky',
            color: 'pink',
            layer: 0,
        });
        expect(
            sticky.caption.editorState.root.children[0].children[0].text,
        ).toBe('Pray for Tom');
    },
    'insert-collapsible': () => {
        const box = addedObject('collapsible', 'Background\nWritten by John');
        expect(box).toMatchObject({
            type: 'collapsible-container',
            open: true,
        });
        expect(runOf(box.children[0], 'Background').type).toBe('text');
        expect(runOf(box.children[1], 'Written by John').type).toBe('text');
        const { result } = edit([
            {
                after: 2,
                kind: 'collapsible',
                text: 'Background\nWritten by John',
            },
        ]);
        expect(kindsOf(result.content)[2]).toBe('collapsible');
    },
    'insert-date': () => {
        expect(addedObject('date', 'today').children[0]).toEqual({
            type: 'datetime',
            version: 1,
            dateTime: new Date(2026, 10, 8).toISOString(),
        });
        expect(
            addedObject('date', '2026-12-25 09:30').children[0].dateTime,
        ).toBe(new Date(2026, 11, 25, 9, 30).toISOString());
    },
    'insert-youtube': () => {
        expect(
            addedObject('video', 'https://www.youtube.com/watch?v=afVN-7vY0KA'),
        ).toMatchObject({ type: 'youtube', videoID: 'afVN-7vY0KA' });
    },
    'insert-website': () => {
        expect(
            addedObject('website', 'https://en.wikipedia.org/wiki/Bethlehem'),
        ).toMatchObject({
            type: 'website',
            url: 'https://en.wikipedia.org/wiki/Bethlehem',
        });
    },
    'align-left': () => {
        expect(
            edit([{ block: 2, align: 'left' }]).root.children[1].format,
        ).toBe('left');
    },
    'align-center': () => {
        expect(
            edit([{ block: 2, align: 'centre' }]).root.children[1].format,
        ).toBe('center');
        // A list item is aligned on its own.
        expect(
            edit([{ block: 4, align: 'center' }]).root.children[2].children[1]
                .format,
        ).toBe('center');
    },
    'align-right': () => {
        expect(
            edit([{ block: 2, align: 'right' }]).root.children[1].format,
        ).toBe('right');
    },
    'align-justify': () => {
        expect(
            edit([{ block: 2, align: 'justify' }]).root.children[1].format,
        ).toBe('justify');
    },
    'align-start': () => {
        expect(
            edit([{ block: 2, align: 'start' }]).root.children[1].format,
        ).toBe('start');
    },
    'align-end': () => {
        expect(edit([{ block: 2, align: 'end' }]).root.children[1].format).toBe(
            'end',
        );
    },
    outdent: () => {
        expect(edit([{ block: 2, indent: 2 }]).root.children[1].indent).toBe(2);
        const nested = edit([{ block: 4, indent: 'more' }]);
        const out = applyNoteEdit({
            content: nested.result.content,
            changes: [{ block: 4, indent: 'less' }],
        });
        if ('reason' in out) {
            throw new Error(out.reason);
        }
        // Back where it was: three items of one list.
        expect(readNoteBlocks(out.content)!.blocks.slice(2, 5)).toEqual([
            { n: 3, kind: 'bullet', text: 'first point' },
            { n: 4, kind: 'bullet', text: 'second point' },
            { n: 5, kind: 'bullet', text: 'third' },
        ]);
    },
    indent: () => {
        expect(
            edit([{ block: 2, indent: 'more' }]).root.children[1].indent,
        ).toBe(1);
        // A list item nests under the one before it, as the editor nests it.
        const { result } = edit([{ block: 4, indent: 'more' }]);
        expect(readNoteBlocks(result.content)!.blocks.slice(2, 5)).toEqual([
            { n: 3, kind: 'bullet', text: 'first point' },
            { n: 4, kind: 'bullet', text: 'second point', level: 1 },
            { n: 5, kind: 'bullet', text: 'third' },
        ]);
    },
    'code-language': () => {
        const { root } = edit([{ block: 2, kind: 'code', language: 'Python' }]);
        expect(root.children[1]).toMatchObject({
            type: 'code',
            language: 'python',
        });
        const refused = applyNoteEdit({
            content: CONTENT,
            changes: [{ block: 1, language: 'js' }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'not a code block',
        );
    },
    'code-theme': () => {
        const { root } = edit([
            { block: 2, kind: 'code', theme: 'github-light' },
        ]);
        expect(root.children[1]).toMatchObject({
            type: 'code',
            theme: 'github-light',
        });
    },
    'link-block-text': () => {
        const { result } = edit([{ block: 2, words: 'patient', linkTo: 1 }]);
        // Nothing of the note changes: the link is the editor's own entry.
        expect(result.content).toBe(CONTENT);
        expect(result.isChanged).toBe(true);
        expect(result.blockLinks).toHaveLength(1);
        expect(result.blockLinks![0]).toMatchObject({
            kind: 'direction-to',
            from: {
                anchor: { offset: 8, path: [1, 0] },
                focus: { offset: 15, path: [1, 0] },
                blockPaths: [[1]],
            },
            to: {
                anchor: { offset: 0, path: [0, 0] },
                focus: { offset: 11, path: [0, 0] },
                blockPaths: [[0]],
            },
        });
        expect(result.blockLinks![0].id).toMatch(/^block-text-link-/);
        // A list item's link names the list as its block.
        const item = edit([{ block: 4, linkTo: 2, linkKind: 'no-direction' }])
            .result.blockLinks![0];
        expect(item.from.blockPaths).toEqual([[2]]);
        expect(item.from.anchor.path).toEqual([2, 1, 0]);
        expect(item.kind).toBe('no-direction');
        // A link joins words: an empty line has none to point at.
        const withEmpty = JSON.stringify({
            root: element('root', [paragraph([text('Grace')]), paragraph([])]),
        });
        const refused = applyNoteEdit({
            content: withEmpty,
            changes: [{ block: 1, linkTo: 2 }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'no words to link',
        );
    },
    'insert-excalidraw': () => {
        // Arrows between commas on one line, as gemma4:cloud wrote them.
        const block = addedObject('drawing', 'God -> Man, Man -> Sin\nGrace');
        // Inline, as the editor keeps it: in a paragraph of its own.
        expect(block.type).toBe('paragraph');
        const drawing = block.children[0];
        expect(drawing).toMatchObject({ type: 'excalidraw', version: 1 });
        const data = JSON.parse(drawing.data);
        const typeCount = (type: string) => {
            return data.elements.filter((element: NodeType) => {
                return element.type === type;
            }).length;
        };
        expect([
            typeCount('rectangle'),
            typeCount('text'),
            typeCount('arrow'),
        ]).toEqual([4, 4, 2]);
        // Each word is in its box, each arrow bound to the boxes it joins.
        const boxOf = (words: string) => {
            const text = data.elements.find((element: NodeType) => {
                return element.type === 'text' && element.text === words;
            });
            return data.elements.find((element: NodeType) => {
                return element.id === text.containerId;
            });
        };
        const arrow = data.elements.find((element: NodeType) => {
            return element.type === 'arrow';
        });
        expect(arrow.startBinding.elementId).toBe(boxOf('God').id);
        expect(arrow.endBinding.elementId).toBe(boxOf('Man').id);
        // Top to bottom: God, then Man, then Sin; Grace on a row below.
        expect(boxOf('God').y).toBeLessThan(boxOf('Man').y);
        expect(boxOf('Man').y).toBeLessThan(boxOf('Sin').y);
        expect(boxOf('Sin').y).toBeLessThan(boxOf('Grace').y);
        const { result } = edit([
            { after: 2, kind: 'drawing', text: 'God -> Man' },
        ]);
        expect(readNoteBlocks(result.content)!.blocks[2]).toMatchObject({
            kind: 'drawing',
            text: '3 shapes: God | Man',
        });
    },
    'insert-default-example': () => {
        const exampleNodes = [
            element('heading', [text('Genesis 1')], { tag: 'h1' }),
            paragraph([text('In the beginning')]),
        ];
        const { result } = edit([{ after: 1, kind: 'example' }], {
            exampleNodes,
        });
        expect(kindsOf(result.content).slice(0, 4)).toEqual([
            'h2',
            'h1',
            'paragraph',
            'paragraph',
        ]);
        // The app's copy of the editor's own example is there to insert.
        const shipped = JSON.parse(
            readFileSync(
                join(process.cwd(), 'src/helper/agentNoteDefaultExample.json'),
                'utf8',
            ),
        );
        expect(shipped.nodes.length).toBeGreaterThan(10);
        expect(shipped.nodes[0]).toMatchObject({ type: 'heading', tag: 'h1' });
    },
};

type InventoryItemType = { id: string; change?: string; excluded?: string };

const inventory: { items: InventoryItemType[] } = JSON.parse(
    readFileSync(INVENTORY_PATH, 'utf8'),
);

describe('the note toolbar through owa_note_edit', () => {
    test('every covered inventory item has its probe, and only those', () => {
        const coveredIdList = inventory.items
            .filter((item) => {
                return item.change !== undefined;
            })
            .map((item) => {
                return item.id;
            });
        expect(
            [...Object.keys(PROBE_MAP), ...WORKER_TESTED_ID_LIST].sort(),
        ).toEqual([...coveredIdList].sort());
        // An excluded item says why, and a covered one says how.
        for (const item of inventory.items) {
            expect(
                Boolean(item.change) !== Boolean(item.excluded),
                item.id,
            ).toBe(true);
        }
    });

    for (const [id, probe] of Object.entries(PROBE_MAP)) {
        test(`toolbar: ${id}`, probe);
    }

    // Seen live 2026-11-08 on gemma4:cloud, asked to make the word "fas" of
    // "tasdfasd fas dfasd" red.
    test('words are whole words first: a word is not the middle of another', () => {
        const content = JSON.stringify({
            root: element('root', [paragraph([text('tasdfasd fas dfasd')])]),
        });
        const result = applyNoteEdit({
            content,
            changes: [{ block: 1, words: 'fas', color: 'red' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const runs = JSON.parse(result.content).root.children[0].children;
        expect(
            runs.map((run: NodeType) => {
                return [run.text, run.style];
            }),
        ).toEqual([
            ['tasdfasd ', ''],
            ['fas', 'color: red;'],
            [' dfasd', ''],
        ]);
    });

    test('HTML a model writes round the words is the words and their style', () => {
        const { root } = edit([
            {
                block: 2,
                words: 'Love is <span style="color:red">patient</span> and kind',
            },
        ]);
        expect(runOf(root, 'patient').style).toBe('color: red;');
        const bold = edit([{ block: 2, words: '<b>kind</b>' }]).root;
        expect(runOf(bold, 'kind').format).toBe(1);
    });

    // Seen live 2026-11-08: a table and a sticky note at the end of a note,
    // the sticky "after" the number the new table would have.
    test('a block this call adds, named by the number it would have, is after it', () => {
        const { result } = edit([
            { after: 6, kind: 'table', text: 'Book | Chapter\nJohn | 3' },
            { after: 7, kind: 'sticky', text: 'Pray for Tom' },
        ]);
        expect(kindsOf(result.content).slice(-2)).toEqual(['table', 'sticky']);
        // A number past both is still refused, saying how.
        const refused = applyNoteEdit({
            content: CONTENT,
            changes: [{ after: 8, kind: 'paragraph', text: 'x' }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'a block this call adds has no number',
        );
    });

    test('the answer says what each change did, and nothing it did not', () => {
        const { result } = edit([
            { block: 2, words: 'patient', color: 'red', stylesOff: ['bold'] },
            { block: 1, align: 'center' },
        ]);
        expect(result.summary).toBe(
            'blocks: 2 changed -- block 2 "patient": color red, bold off; ' +
                'block 1: aligned center',
        );
    });

    test('a style the editor does not have, or words not in the block, is refused', () => {
        const reasonOf = (changes: any[]) => {
            const result = applyNoteEdit({ content: CONTENT, changes });
            return 'reason' in result ? result.reason : 'no refusal';
        };
        expect(reasonOf([{ block: 2, font: 'Comic Sans' }])).toContain(
            'font box lists',
        );
        expect(reasonOf([{ block: 2, color: 'sparkly' }])).toContain('colour');
        expect(reasonOf([{ block: 2, styles: ['blink'] }])).toContain(
            'names styles',
        );
        expect(reasonOf([{ block: 2, align: 'diagonal' }])).toContain(
            '`align`',
        );
        expect(
            reasonOf([{ block: 2, words: 'grace', color: 'red' }]),
        ).toContain('does not have the words');
        expect(reasonOf([{ block: 2, words: 'Love' }])).toContain(
            'give one of those',
        );
        expect(
            reasonOf([{ after: 1, kind: 'sticky', text: 'x', color: 'red' }]),
        ).toContain('sticky note is one of');
    });

    test('a style change keeps every other block byte for byte', () => {
        const { result } = edit([{ block: 2, words: 'patient', color: 'red' }]);
        const before = JSON.parse(CONTENT).root.children;
        const after = JSON.parse(result.content).root.children;
        for (const index of [0, 2, 3]) {
            expect(JSON.stringify(after[index])).toBe(
                JSON.stringify(before[index]),
            );
        }
    });
});
