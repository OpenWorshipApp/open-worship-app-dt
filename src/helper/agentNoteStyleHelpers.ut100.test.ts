/**
 * The note editor's toolbar as pure rules (`agentNoteStyleHelpers.ts`): a
 * run's CSS, colours, fonts, a block's next-words style, where words are,
 * HTML round words, and Indent / Outdent on list items.
 */
import { describe, expect, test } from 'vitest';

import {
    applyBlockTypingStyle,
    collectBlockRuns,
    findListPlace,
    findNoteFont,
    findWordRanges,
    nestListItem,
    parseStyleText,
    patchStyleText,
    readWordsMarkup,
    splitRunsForWords,
    toCssColor,
    unnestListItem,
} from './agentNoteStyleHelpers';

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

function item(name: string): NodeType {
    return { type: 'listitem', value: 1, children: [text(name)] };
}

function listOf(children: NodeType[]): NodeType {
    return { type: 'list', listType: 'bullet', children };
}

function wrapper(children: NodeType[]): NodeType {
    return { type: 'listitem', value: 1, children: [listOf(children)] };
}

/**
 * A list's shape in words: an item by its words, a nested list in
 * brackets -- `['a', ['b', 'c']]`.
 */
function shapeOf(list: NodeType): any[] {
    return list.children.map((one: NodeType) => {
        const first = one.children[0];
        return first.type === 'list' ? shapeOf(first) : first.text;
    });
}

describe("a run's CSS", () => {
    test('no style at all is no properties', () => {
        expect(parseStyleText(undefined).size).toBe(0);
        expect(parseStyleText(12).size).toBe(0);
    });

    test('a patch that changes nothing hands the style back as it was', () => {
        expect(
            patchStyleText('color: red;font-size: 20px;', { color: 'red' }),
        ).toBe('color: red;font-size: 20px;');
        // Nothing to take off, and no style to begin with.
        expect(patchStyleText(undefined, { color: null })).toBe('');
    });
});

describe('colours and fonts asked for in words', () => {
    test('a colour function is kept, its spaces made one', () => {
        expect(toCssColor('rgb( 1,  2,   3 )')).toBe('rgb( 1, 2, 3 )');
        expect(toCssColor('hsl(120, 50%, 50%)')).toBe('hsl(120, 50%, 50%)');
        expect(toCssColor('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    });

    test('something that is not words is no colour and no font', () => {
        expect(toCssColor(255)).toBeNull();
        expect(toCssColor(null)).toBeNull();
        expect(findNoteFont(12, ['Arial'])).toBeNull();
        expect(findNoteFont(undefined, ['Arial'])).toBeNull();
    });
});

describe('the style a block gives words typed into it next', () => {
    test('a size is scaled from the block size, styles flip its format bits', () => {
        const node: NodeType = {
            type: 'paragraph',
            textFormat: 1,
            textStyle: 'font-size: 20px;',
        };
        applyBlockTypingStyle(node, 'paragraph', {
            size: 'larger',
            on: ['italic'],
            off: ['bold'],
        });
        // 20 x 1.25; bold (1) off, italic (2) on.
        expect(node.textStyle).toBe('font-size: 25px;');
        expect(node.textFormat).toBe(2);
    });

    test('a heading with no size of its own starts from its drawn size', () => {
        const node: NodeType = { type: 'heading', textStyle: '' };
        applyBlockTypingStyle(node, 'h1', { size: 'smaller' });
        // A h1 is drawn at 24px: 24 x 0.8 = 19.2, rounded.
        expect(node.textStyle).toBe('font-size: 19px;');
    });

    test('subscript and superscript are one or the other', () => {
        const node: NodeType = { type: 'paragraph', textFormat: 32 };
        applyBlockTypingStyle(node, 'paragraph', { on: ['superscript'] });
        expect(node.textFormat).toBe(64);
    });
});

describe('the runs of a block', () => {
    test('a broken piece is passed over, and a list under an item is its own', () => {
        const block = {
            type: 'listitem',
            children: [null, text('outer'), listOf([item('inner')])],
        };
        expect(
            collectBlockRuns(block).map((run) => {
                return run.text;
            }),
        ).toEqual(['outer']);
    });

    test('a line break among the runs is no run, and no words are cut at it', () => {
        const block = {
            type: 'paragraph',
            children: [
                text('Grace'),
                { type: 'linebreak', version: 1 },
                text('and peace'),
            ],
        };
        const runs = splitRunsForWords(block, 'peace')!;
        expect(runs).toEqual([text('peace')]);
        expect(
            block.children.map((one: NodeType) => {
                return one.type === 'linebreak' ? '\n' : one.text;
            }),
        ).toEqual(['Grace', '\n', 'and ', 'peace']);
    });

    test('a mention the words touch is restyled whole: it cannot be cut', () => {
        const mention = text('John 3:16', {
            type: 'mention',
            mode: 'segmented',
            mentionKind: 'bible-verse',
        });
        const block = { type: 'paragraph', children: [text('Read '), mention] };
        const runs = splitRunsForWords(block, '3:16')!;
        expect(runs).toHaveLength(1);
        expect(runs[0]).toBe(mention);
        // The mention is still one node, its words whole.
        expect(block.children[1].text).toBe('John 3:16');
    });
});

describe('where words are, in a piece of a letter cluster', () => {
    const MARK = String.fromCharCode(0x301);

    test('a mark asked alone takes its whole letter', () => {
        // "cafe" + a combining acute: the e and its mark are one letter.
        const word = `cafe${MARK}`;
        expect(findWordRanges(word, MARK)).toEqual([[3, 5]]);
    });

    test('two pieces of one cluster are one range', () => {
        const letters = `e${MARK}${MARK}x`;
        expect(findWordRanges(letters, MARK)).toEqual([[0, 3]]);
    });
});

describe('HTML a model writes round the words', () => {
    test('tags with no style of their own are taken off', () => {
        expect(readWordsMarkup('<p>grace</p>')).toEqual({
            words: 'grace',
            on: [],
        });
    });

    test("a span's CSS is read as the fields it asks for", () => {
        expect(
            readWordsMarkup(
                'all <span style="background-color: yellow; ' +
                    'font-family: Georgia, serif; font-size: 18px; ' +
                    'font-weight: bold; font-style: italic">grace</span>',
            ),
        ).toEqual({
            words: 'grace',
            background: 'yellow',
            font: 'Georgia',
            size: 18,
            on: ['bold', 'italic'],
        });
        expect(
            readWordsMarkup(
                '<span style="background: pink; font-weight: 700">x</span>',
            ),
        ).toEqual({ words: 'x', background: 'pink', on: ['bold'] });
    });
});

describe('Indent and Outdent on list items', () => {
    test('an item after a nested list joins that list', () => {
        const c = item('c');
        const outer = listOf([item('a'), wrapper([item('b')]), c]);
        const root = { type: 'root', children: [outer] };
        expect(nestListItem(root, c)).toBe(true);
        expect(shapeOf(outer)).toEqual(['a', ['b', 'c']]);
    });

    test('nested between two nested lists, the two become one', () => {
        const c = item('c');
        const outer = listOf([
            item('a'),
            wrapper([item('b')]),
            c,
            wrapper([item('d')]),
        ]);
        const root = { type: 'root', children: [outer] };
        expect(nestListItem(root, c)).toBe(true);
        expect(shapeOf(outer)).toEqual(['a', ['b', 'c', 'd']]);
    });

    test('an item before a nested list goes first in it', () => {
        const b = item('b');
        const outer = listOf([item('a'), b, wrapper([item('c')])]);
        const root = { type: 'root', children: [outer] };
        expect(nestListItem(root, b)).toBe(true);
        expect(shapeOf(outer)).toEqual(['a', ['b', 'c']]);
    });

    test('an item found past a broken piece of the note; one not in it is not moved', () => {
        const a = item('a');
        const root = { type: 'root', children: [null, listOf([a])] };
        expect(findListPlace(root, a)?.list).toBe(root.children[1]);
        expect(nestListItem(root, item('elsewhere'))).toBe(false);
    });

    test('an item that is not nested cannot go further out', () => {
        const a = item('a');
        const root = { type: 'root', children: [listOf([a])] };
        expect(unnestListItem(root, a)).toBe(false);
        expect(shapeOf(root.children[0])).toEqual(['a']);
    });

    test('a middle item taken out: the items after it stay nested, under it', () => {
        const c = item('c');
        const outer = listOf([item('a'), wrapper([item('b'), c, item('d')])]);
        const root = { type: 'root', children: [outer] };
        expect(unnestListItem(root, c)).toBe(true);
        expect(shapeOf(outer)).toEqual(['a', ['b'], 'c', ['d']]);
    });

    test('the first item taken out of a wrapper that holds another list', () => {
        const b = item('b');
        const second = listOf([item('x')]);
        const holder = {
            type: 'listitem',
            value: 1,
            children: [listOf([b]), second],
        };
        const outer = listOf([item('a'), holder]);
        const root = { type: 'root', children: [outer] };
        expect(unnestListItem(root, b)).toBe(true);
        // b goes before the wrapper, which keeps its other list.
        expect(outer.children[1]).toBe(b);
        expect(outer.children[2]).toBe(holder);
        expect(holder.children).toEqual([second]);
    });
});
