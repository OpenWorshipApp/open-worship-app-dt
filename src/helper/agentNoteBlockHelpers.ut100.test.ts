/**
 * `owa_note_edit`'s block rules on what the other suites leave out: every
 * mark of the light mark-up read and written back, the list splits a kind
 * change makes, where a new block lands beside lists, and each refusal --
 * its exact words, and no content handed back.
 */
import { describe, expect, test } from 'vitest';

import {
    NOTE_CODE_LANGUAGE_LIST,
    NOTE_CODE_THEME_LIST,
    NOTE_EDIT_MAX_CHANGES,
    applyNoteEdit,
    readNoteBlocks,
} from './agentNoteBlockHelpers';

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

function element(type: string, children: any[], extra: NodeType = {}) {
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

function paragraph(children: any[], extra: NodeType = {}) {
    return element('paragraph', children, {
        textFormat: 0,
        textStyle: '',
        ...extra,
    });
}

function heading(tag: string, words: string) {
    return element('heading', [text(words)], { tag });
}

function item(children: any[], extra: NodeType = {}) {
    return element('listitem', children, { value: 1, ...extra });
}

function list(listType: string, items: any[]) {
    return element('list', items, {
        textFormat: 0,
        textStyle: '',
        listType,
        start: 1,
        tag: listType === 'number' ? 'ol' : 'ul',
    });
}

const TAB = {
    detail: 2,
    format: 0,
    mode: 'normal',
    style: '',
    text: '\t',
    type: 'tab',
    version: 1,
};
const LINEBREAK = { type: 'linebreak', version: 1 };
const RULE = { type: 'horizontalrule', version: 1 };

function noteOf(children: any[]) {
    return JSON.stringify({ root: element('root', children) });
}

function edit(content: string, changes: any[], extra: NodeType = {}) {
    const result = applyNoteEdit({ content, changes, ...extra });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return { result, root: JSON.parse(result.content).root };
}

function reasonOf(content: string, changes: any[], extra: NodeType = {}) {
    const result = applyNoteEdit({ content, changes, ...extra });
    if (!('reason' in result)) {
        throw new Error('expected a refusal');
    }
    // A refusal hands back no content to write.
    expect(result).toEqual({ reason: result.reason });
    return result.reason;
}

function readOf(content: string) {
    return readNoteBlocks(content)!.blocks.map((block) => {
        return [block.kind, block.text];
    });
}

function wordsOf(nodes: NodeType[]) {
    return nodes.map((node) => {
        return node.type === 'linebreak' ? '\n' : node.text;
    });
}

describe('every mark of the light mark-up, read', () => {
    test('italic, underline, strike and code each get their own marks', () => {
        const content = noteOf([
            paragraph([
                text('b', { format: 1 }),
                text(' '),
                text('i', { format: 2 }),
                text(' '),
                text('u', { format: 8 }),
                text(' '),
                text('s', { format: 4 }),
                text(' '),
                text('c', { format: 16 }),
            ]),
        ]);
        expect(readOf(content)).toEqual([
            ['paragraph', '**b** *i* __u__ ~~s~~ `c`'],
        ]);
    });

    test('a run of every mark at once nests them, and reads back to the same bits', () => {
        const content = noteOf([
            paragraph([text('all', { format: 31 }), text(' plain')]),
        ]);
        const [[, read]] = readOf(content);
        expect(read).toBe('~~__***`all`***__~~ plain');
        // Given back with one more word, the marked run is still all five.
        const { root } = edit(content, [{ block: 1, text: `${read} now` }]);
        expect(root.children[0].children).toEqual([
            text('all', { format: 31 }),
            text(' plain now'),
        ]);
    });

    test('a marked run of spaces alone reads as the spaces, no marks round nothing', () => {
        const content = noteOf([
            paragraph([text('a'), text('  ', { format: 1 }), text('b')]),
        ]);
        expect(readOf(content)).toEqual([['paragraph', 'a  b']]);
    });

    test('a tab among words reads as a tab, in a paragraph and in code', () => {
        const content = noteOf([
            paragraph([text('one'), TAB, text('two')]),
            element('code', [
                text('let', { type: 'code-highlight' }),
                TAB,
                text('x', { type: 'code-highlight' }),
            ]),
        ]);
        expect(readOf(content)).toEqual([
            ['paragraph', 'one\ttwo'],
            ['code', 'let\tx'],
        ]);
    });
});

describe('objects among the words make a block fixed', () => {
    const PICTURE = {
        type: 'image',
        version: 1,
        src: 'https://example.org/lamb.png',
        altText: 'Lamb',
    };

    test('a video or audio kept as media reads as media, with its title and source', () => {
        const content = noteOf([
            paragraph([
                {
                    type: 'image',
                    version: 1,
                    mediaType: 'video',
                    src: 'C:/media/clip.mp4',
                    altText: 'clip',
                },
            ]),
        ]);
        const read = readNoteBlocks(content)!;
        expect(read.blocks[0]).toEqual({
            n: 1,
            kind: 'media',
            text: 'clip — C:/media/clip.mp4',
            isFixed: true,
        });
    });

    test('a picture in a quote line, or inside a link, makes the block a picture', () => {
        const content = noteOf([
            element('quote', [
                paragraph([text('Behold')]),
                paragraph([PICTURE]),
            ]),
            paragraph([
                element('link', [PICTURE], { url: 'https://example.org' }),
            ]),
        ]);
        expect(readOf(content)).toEqual([
            ['picture', 'Lamb — https://example.org/lamb.png'],
            ['picture', 'Lamb — https://example.org/lamb.png'],
        ]);
        // And such a block takes no words.
        expect(reasonOf(content, [{ block: 1, text: 'Behold' }])).toBe(
            'Block 1 is a picture: it can be moved, removed, styled, sized ' +
                'or aligned, never given words or another kind.',
        );
    });

    test('a damaged note: a null block and a stray paragraph in a list are skipped, and kept by a change', () => {
        const stray = paragraph([text('stray')]);
        const content = noteOf([
            paragraph([text('one')]),
            null,
            list('bullet', [item([text('a')]), stray]),
            element('heading', [text('Title'), null], { tag: 'h2' }),
        ]);
        const read = readNoteBlocks(content)!;
        expect(read.blockCount).toBe(3);
        expect(readOf(content)).toEqual([
            ['paragraph', 'one'],
            ['bullet', 'a'],
            // A broken piece inside a heading is no words.
            ['h2', 'Title'],
        ]);
        const { root } = edit(content, [{ block: 2, text: 'b' }]);
        expect(root.children[1]).toBeNull();
        const [first, second] = root.children[2].children;
        expect(first.children).toEqual([text('b')]);
        // Only a list item is numbered; the stray paragraph is no item.
        expect(first.value).toBe(1);
        expect(second.type).toBe('paragraph');
        expect(second.value).toBeUndefined();
        expect(second.children).toEqual([text('stray')]);
    });
});

describe('the mark-up, written back', () => {
    const CONTENT = noteOf([paragraph([text('Old words')])]);

    test('inside backticks a star is a star; one backtick never closed is a character', () => {
        const { root } = edit(CONTENT, [{ block: 1, text: 'Run `a*b*` now' }]);
        expect(root.children[0].children).toEqual([
            text('Run '),
            text('a*b*', { format: 16 }),
            text(' now'),
        ]);
        const unclosed = edit(CONTENT, [{ block: 1, text: 'one ` two' }]);
        expect(unclosed.root.children[0].children).toEqual([text('one ` two')]);
    });

    test('an escaped mark is the character itself', () => {
        const { root } = edit(CONTENT, [
            { block: 1, text: '2 \\* 3 \\_ \\[x\\]' },
        ]);
        expect(root.children[0].children).toEqual([text('2 * 3 _ [x]')]);
    });

    test('a tab, typed or written out, is a tab node', () => {
        for (const words of ['x\ty', 'x\\ty']) {
            const { root } = edit(CONTENT, [{ block: 1, text: words }]);
            expect(root.children[0].children).toEqual([
                text('x'),
                TAB,
                text('y'),
            ]);
        }
    });

    test('words that span two nodes of one format come back as those two nodes', () => {
        const content = noteOf([
            paragraph([
                text('Grace ', { style: 'color: red;' }),
                text('alone', { style: 'color: blue;' }),
            ]),
        ]);
        expect(readOf(content)).toEqual([['paragraph', 'Grace alone']]);
        const { root } = edit(content, [
            { block: 1, text: 'Grace alone\nmore' },
        ]);
        expect(root.children[0].children).toEqual([
            text('Grace ', { style: 'color: red;' }),
            text('alone', { style: 'color: blue;' }),
            LINEBREAK,
            // New words take the block's own style: its first words'.
            text('more', { style: 'color: red;' }),
        ]);
    });

    test('a bold run whose space was read outside its marks keeps the space inside', () => {
        const content = noteOf([
            paragraph([text('A', { format: 1 }), text(' Text', { format: 1 })]),
        ]);
        expect(readOf(content)).toEqual([['paragraph', '**A** **Text**']]);
        const { root } = edit(content, [
            { block: 1, text: '**A** **Text** more' },
        ]);
        expect(root.children[0].children).toEqual([
            text('A', { format: 1 }),
            text(' Text', { format: 1 }),
            text(' more'),
        ]);
    });

    test('a link given back keeps its own node: its target and title', () => {
        const content = noteOf([
            paragraph([
                text('See '),
                element('link', [text('site')], {
                    rel: 'noreferrer',
                    target: '_blank',
                    title: 'Home',
                    url: 'https://example.org',
                }),
            ]),
        ]);
        expect(readOf(content)).toEqual([
            ['paragraph', 'See [site](https://example.org)'],
        ]);
        const { root } = edit(content, [
            { block: 1, text: 'See [site](https://example.org) now' },
        ]);
        const [, link, after] = root.children[0].children;
        expect(link).toMatchObject({
            type: 'link',
            target: '_blank',
            title: 'Home',
            url: 'https://example.org',
            children: [text('site')],
        });
        expect(after).toEqual(text(' now'));
    });

    test('a code block given new words is a line of text each, line breaks between', () => {
        const content = noteOf([
            element('code', [text('old', { type: 'code-highlight' })], {
                language: 'js',
            }),
        ]);
        const { root } = edit(content, [
            { block: 1, text: 'let a = 1\n\nlet b = 2' },
        ]);
        expect(root.children[0].type).toBe('code');
        expect(root.children[0].language).toBe('js');
        expect(wordsOf(root.children[0].children)).toEqual([
            'let a = 1',
            '\n',
            '\n',
            'let b = 2',
        ]);
    });

    test('a short block may be given another kind and other words: it had few to lose', () => {
        const content = noteOf([heading('h1', 'Grace Alone')]);
        const { result } = edit(content, [
            { block: 1, kind: 'paragraph', text: 'Totally new words here' },
        ]);
        expect(readOf(result.content)).toEqual([
            ['paragraph', 'Totally new words here'],
        ]);
    });
});

describe('a list item given another kind', () => {
    // 1 a heading, 2-4 a bullet list a, b, c.
    const CONTENT = noteOf([
        heading('h1', 'Points'),
        list('bullet', [
            item([text('a')]),
            item([text('b')]),
            item([text('c')]),
        ]),
    ]);

    test('the FIRST item made a heading: the list goes on after it', () => {
        const { result, root } = edit(CONTENT, [{ block: 2, kind: 'h2' }]);
        expect(readOf(result.content)).toEqual([
            ['h1', 'Points'],
            ['h2', 'a'],
            ['bullet', 'b'],
            ['bullet', 'c'],
        ]);
        expect(root.children.map((one: NodeType) => one.type)).toEqual([
            'heading',
            'heading',
            'list',
        ]);
        // The list that goes on is numbered again from its start.
        expect(
            root.children[2].children.map((one: NodeType) => one.value),
        ).toEqual([1, 2]);
    });

    test('a MIDDLE item made a paragraph: the list is cut round it', () => {
        const { result, root } = edit(CONTENT, [
            { block: 3, kind: 'paragraph' },
        ]);
        expect(readOf(result.content)).toEqual([
            ['h1', 'Points'],
            ['bullet', 'a'],
            ['paragraph', 'b'],
            ['bullet', 'c'],
        ]);
        expect(root.children.map((one: NodeType) => one.type)).toEqual([
            'heading',
            'list',
            'paragraph',
            'list',
        ]);
    });

    test('a middle item made a check item: a check list of its own, ticked as asked', () => {
        const { result, root } = edit(CONTENT, [
            { block: 3, kind: 'check', checked: true },
        ]);
        const read = readNoteBlocks(result.content)!;
        expect(read.blocks.map((block) => [block.kind, block.text])).toEqual([
            ['h1', 'Points'],
            ['bullet', 'a'],
            ['check', 'b'],
            ['bullet', 'c'],
        ]);
        expect(read.blocks[2].checked).toBe(true);
        expect(root.children[2]).toMatchObject({
            type: 'list',
            listType: 'check',
            tag: 'ul',
        });
        // `checked` is a check list's alone.
        expect(root.children[1].children[0].checked).toBeUndefined();
        expect(root.children[3].children[0].checked).toBeUndefined();
    });

    test('a middle item made a check item, no tick asked: unticked', () => {
        const { result, root } = edit(CONTENT, [{ block: 3, kind: 'check' }]);
        const read = readNoteBlocks(result.content)!;
        expect(read.blocks[2]).toEqual({
            n: 3,
            kind: 'check',
            text: 'b',
            checked: false,
        });
        expect(root.children[2].children[0].checked).toBe(false);
    });

    test('the one item of a list made another list kind: the list itself changes', () => {
        const single = noteOf([list('bullet', [item([text('only')])])]);
        const numbered = edit(single, [{ block: 1, kind: 'number' }]);
        expect(numbered.root.children[0]).toMatchObject({
            listType: 'number',
            tag: 'ol',
        });
        const checked = edit(single, [{ block: 1, kind: 'check' }]);
        expect(checked.root.children[0]).toMatchObject({
            listType: 'check',
            tag: 'ul',
        });
        // Not asked to tick: an unticked item.
        expect(checked.root.children[0].children[0].checked).toBe(false);
        expect(readNoteBlocks(checked.result.content)!.blocks[0]).toEqual({
            n: 1,
            kind: 'check',
            text: 'only',
            checked: false,
        });
    });
});

describe('where a new block lands beside lists', () => {
    test('a bullet added at the top of a note that starts with bullets joins that list', () => {
        const content = noteOf([
            list('bullet', [item([text('a')]), item([text('b')])]),
        ]);
        const { result, root } = edit(content, [
            { after: 0, kind: 'bullet', text: 'zero' },
        ]);
        expect(root.children).toHaveLength(1);
        expect(readOf(result.content)).toEqual([
            ['bullet', 'zero'],
            ['bullet', 'a'],
            ['bullet', 'b'],
        ]);
        expect(
            root.children[0].children.map((one: NodeType) => one.value),
        ).toEqual([1, 2, 3]);
    });

    test('a bullet added after a block a bullet list follows goes first in that list', () => {
        const content = noteOf([
            paragraph([text('Intro')]),
            list('bullet', [item([text('a')])]),
        ]);
        const { result, root } = edit(content, [
            { after: 1, kind: 'bullet', text: 'new' },
        ]);
        expect(root.children).toHaveLength(2);
        expect(readOf(result.content)).toEqual([
            ['paragraph', 'Intro'],
            ['bullet', 'new'],
            ['bullet', 'a'],
        ]);
    });

    test('a paragraph added after a NESTED item goes after the whole list', () => {
        const content = noteOf([
            list('bullet', [
                item([text('top')]),
                item([list('bullet', [item([text('nested')])])]),
            ]),
            paragraph([text('end')]),
        ]);
        const read = readNoteBlocks(content)!;
        expect(read.blocks[1]).toMatchObject({ text: 'nested', level: 1 });
        const { result, root } = edit(content, [
            { after: 2, kind: 'paragraph', text: 'after the list' },
        ]);
        expect(readOf(result.content)).toEqual([
            ['bullet', 'top'],
            ['bullet', 'nested'],
            ['paragraph', 'after the list'],
            ['paragraph', 'end'],
        ]);
        expect(root.children.map((one: NodeType) => one.type)).toEqual([
            'list',
            'paragraph',
            'paragraph',
        ]);
    });

    test('a code block added with lines and a language', () => {
        const content = noteOf([paragraph([text('Example')])]);
        const { root } = edit(content, [
            {
                after: 1,
                kind: 'code',
                text: 'x = 1\ny = 2',
                language: 'Python',
            },
        ]);
        const code = root.children[1];
        expect(code.type).toBe('code');
        expect(code.language).toBe('python');
        expect(wordsOf(code.children)).toEqual(['x = 1', '\n', 'y = 2']);
    });

    test('a new block takes the toolbar fields asked with it', () => {
        const content = noteOf([paragraph([text('Intro')])]);
        const { root, result } = edit(content, [
            { after: 1, kind: 'paragraph', text: 'Amen', color: 'red' },
        ]);
        expect(root.children[1].children).toEqual([
            text('Amen', { style: 'color: red;' }),
        ]);
        expect(result.summary).toBe(
            'blocks: 1 added -- after block 1: added paragraph, color red',
        );
    });

    test('a new bullet with an indent nests under the item before it', () => {
        const content = noteOf([
            list('bullet', [item([text('first')]), item([text('second')])]),
        ]);
        const { result } = edit(content, [
            { after: 2, kind: 'bullet', text: 'under second', indent: 1 },
        ]);
        expect(
            readNoteBlocks(result.content)!.blocks.map((block) => {
                return [block.text, block.level ?? 0];
            }),
        ).toEqual([
            ['first', 0],
            ['second', 0],
            ['under second', 1],
        ]);
    });

    test('a new rule cannot be aligned: nothing is added', () => {
        const content = noteOf([paragraph([text('Intro')])]);
        expect(
            reasonOf(content, [{ after: 1, kind: 'rule', align: 'center' }]),
        ).toBe('The new rule cannot be aligned.');
    });
});

describe('text size on a list item', () => {
    test('a nested list inside the item keeps its own size', () => {
        const nested = list('bullet', [
            item([text('inner', { style: 'font-size: 20px;' })]),
        ]);
        const content = noteOf([
            list('bullet', [item([text('outer'), nested])]),
        ]);
        const { root } = edit(content, [{ block: 1, size: 30 }]);
        const outerItem = root.children[0].children[0];
        expect(outerItem.children[0].style).toBe('font-size: 30px;');
        expect(outerItem.children[1].children[0].children[0].style).toBe(
            'font-size: 20px;',
        );
    });
});

describe('every refusal says why and changes nothing', () => {
    // 1 a paragraph, 2 a code block, 3 a rule, 4 a bullet, 5 a nested bullet.
    const CONTENT = noteOf([
        paragraph([text('Grace and peace to you')]),
        element('code', [text('x', { type: 'code-highlight' })], {
            language: 'js',
        }),
        RULE,
        list('bullet', [
            item([text('top')]),
            item([list('bullet', [item([text('nested')])])]),
        ]),
    ]);

    test('the toolbar fields, checked', () => {
        expect(reasonOf(CONTENT, [{ block: 1, styles: 'bold' }])).toBe(
            '`styles` is a list of style names.',
        );
        expect(
            reasonOf(CONTENT, [
                { block: 1, styles: ['bold'], stylesOff: ['bold'] },
            ]),
        ).toBe('A style cannot be both in `styles` and `stylesOff`.');
        expect(reasonOf(CONTENT, [{ block: 1, clear: false }])).toBe(
            '`clear` is true: Clear Formatting.',
        );
        for (const indent of [11, -1, 'deeper', 1.5]) {
            expect(reasonOf(CONTENT, [{ block: 1, indent }])).toBe(
                '`indent` is "more", "less" or a level from 0 to 10 (for a ' +
                    'list item, how deep it is nested).',
            );
        }
        for (const words of ['  ', 7]) {
            expect(reasonOf(CONTENT, [{ block: 1, words, color: 'red' }])).toBe(
                '`words` are words of the block, as it reads.',
            );
        }
    });

    test("a code block's language and theme are of its lists", () => {
        expect(reasonOf(CONTENT, [{ block: 2, language: 'cobol' }])).toBe(
            `\`language\` is one of ${NOTE_CODE_LANGUAGE_LIST.join(', ')}.`,
        );
        expect(reasonOf(CONTENT, [{ block: 2, theme: 'neon' }])).toBe(
            `\`theme\` is one of ${NOTE_CODE_THEME_LIST.join(', ')}.`,
        );
        expect(
            reasonOf(CONTENT, [
                { after: 1, kind: 'paragraph', text: 'x', language: 'js' },
            ]),
        ).toBe(
            'A new block is not a code block: only a code block has a ' +
                'language and a theme.',
        );
    });

    test('a rule cannot be aligned or indented', () => {
        expect(reasonOf(CONTENT, [{ block: 3, align: 'center' }])).toBe(
            'Block 3 cannot be aligned.',
        );
        expect(reasonOf(CONTENT, [{ block: 3, indent: 'more' }])).toBe(
            'Block 3 cannot be indented.',
        );
    });

    test('too many changes, or one that is no object', () => {
        const many = Array.from({ length: NOTE_EDIT_MAX_CHANGES + 1 }, () => {
            return { after: 0, text: 'x' };
        });
        expect(reasonOf(CONTENT, many)).toBe(
            `At most ${NOTE_EDIT_MAX_CHANGES} changes in one call; send the ` +
                'rest in another.',
        );
        expect(reasonOf(CONTENT, ['make it bold'])).toBe(
            'Each change is an object.',
        );
        expect(reasonOf(CONTENT, [null])).toBe('Each change is an object.');
    });

    test('words past the most a block holds', () => {
        expect(reasonOf(CONTENT, [{ block: 1, text: 'a'.repeat(20001) }])).toBe(
            "A block's words are 20000 characters at most.",
        );
    });

    test('a block read cut short cannot be given new words', () => {
        const long = noteOf([paragraph([text('word '.repeat(1700))])]);
        expect(readNoteBlocks(long)!.blocks[0].isTextCut).toBe(true);
        expect(reasonOf(long, [{ block: 1, text: 'short' }])).toBe(
            'Block 1 was too long to read whole, so its words cannot be ' +
                'replaced here.',
        );
    });

    test('kinds a block may not become, and a nested item kept its kind', () => {
        expect(reasonOf(CONTENT, [{ block: 1, kind: 'table' }])).toBe(
            "A block's kind is one of paragraph, h1, h2, h3, h4, h5, h6, " +
                'quote, code, bullet, number, check.',
        );
        expect(reasonOf(CONTENT, [{ block: 5, kind: 'number' }])).toBe(
            "Block 5 is inside another list item's list: its words can " +
                'change, its kind cannot.',
        );
    });

    test('moves, links and adds that point nowhere', () => {
        expect(reasonOf(CONTENT, [{ block: 1, after: 1 }])).toBe(
            '`after` for a move is 0 (the top) or another block number.',
        );
        expect(reasonOf(CONTENT, [{ block: 1, after: 9 }])).toBe(
            '`after` for a move is 0 (the top) or another block number.',
        );
        expect(reasonOf(CONTENT, [{ block: 1, linkTo: 1 }])).toBe(
            "`linkTo` is another block's number, 1 to 5.",
        );
        expect(reasonOf(CONTENT, [{ block: 1, linkTo: 6 }])).toBe(
            "`linkTo` is another block's number, 1 to 5.",
        );
        expect(
            reasonOf(CONTENT, [{ after: 1, text: 'Peace', linkTo: 1 }]),
        ).toBe(
            'A link starts at a block that is there: link from it in a ' +
                'second call, once the new block is read.',
        );
    });

    test('a block removed in the same call is no anchor and no link end', () => {
        expect(
            reasonOf(CONTENT, [
                { block: 1, remove: true },
                { block: 4, after: 1 },
            ]),
        ).toBe(
            'Block 1 is removed in this change: move block 4 after another one.',
        );
        expect(
            reasonOf(CONTENT, [
                { block: 1, remove: true },
                { after: 1, text: 'Peace' },
            ]),
        ).toBe(
            'Block 1 is removed in this change: put the new block after ' +
                'another one.',
        );
        expect(
            reasonOf(CONTENT, [
                { block: 4, remove: true },
                { block: 1, linkTo: 4 },
            ]),
        ).toBe('A block this call removes cannot be linked.');
    });

    test('a passage no installed Bible can read', () => {
        expect(
            reasonOf(CONTENT, [
                { after: 1, kind: 'passage', ref: ' Hezekiah 1:1 ' },
            ]),
        ).toBe(
            'No installed Bible could read "Hezekiah 1:1". Write a ' +
                'reference as "Book chapter:verse" (e.g. "John 3:16" or ' +
                '"Psalm 23:1-3"); never write a verse\'s words yourself.',
        );
    });
});
