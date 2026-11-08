import { describe, expect, test } from 'vitest';

import {
    normalizeNoteNode,
    toNoteCanonicalText,
} from './agentNoteNormalizeHelpers';

// The rules read off Lexical's own exportJSON (2026-11-08): a block written
// another way is written back by an open note window as a step of its own.
describe('a changed block written as the editor writes it', () => {
    test("a paragraph's next-words style is its first text's", () => {
        const node: any = {
            children: [
                {
                    detail: 0,
                    format: 1,
                    mode: 'normal',
                    style: 'color: red;',
                    text: 'Grace',
                    type: 'text',
                    version: 1,
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
            type: 'paragraph',
            textFormat: 0,
            textStyle: '',
        };
        normalizeNoteNode(node);
        expect(Object.keys(node)).toEqual([
            'children',
            'direction',
            'format',
            'indent',
            'type',
            'version',
            'textFormat',
            'textStyle',
        ]);
        expect([node.textFormat, node.textStyle]).toEqual([1, 'color: red;']);
    });

    test('another element: its own keys last, no empty next-words style', () => {
        const heading: any = {
            children: [{ text: 'Grace', type: 'text', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
            type: 'heading',
            tag: 'h2',
            textFormat: 0,
            textStyle: 'font-size: 20px;',
        };
        normalizeNoteNode(heading);
        expect(Object.keys(heading)).toEqual([
            'children',
            'direction',
            'format',
            'indent',
            'type',
            'version',
            'tag',
        ]);
        const list: any = {
            children: [
                {
                    children: [{ text: 'one', type: 'text', version: 1 }],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    version: 1,
                    value: 1,
                    checked: false,
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'list',
            version: 1,
            textFormat: 0,
            textStyle: '',
            listType: 'check',
            start: 1,
            tag: 'ul',
        };
        normalizeNoteNode(list);
        expect('textFormat' in list || 'textStyle' in list).toBe(false);
        expect(Object.keys(list.children[0]).slice(-2)).toEqual([
            'checked',
            'value',
        ]);
    });

    // Seen live 2026-11-08: five bullets made by `owa_bible_note add` all
    // read `value: 1`, and the note window wrote them back 1 to 5.
    test("a list's items are numbered as the editor numbers them", () => {
        const item = (extra: any = {}) => ({
            children: [{ text: 'x', type: 'text' }],
            type: 'listitem',
            value: 1,
            ...extra,
        });
        const nested = {
            children: [
                { children: [item()], listType: 'bullet', type: 'list' },
            ],
            type: 'listitem',
            value: 1,
        };
        const bullets: any = {
            children: [item({ checked: false }), nested, item(), item()],
            listType: 'bullet',
            start: 1,
            type: 'list',
        };
        normalizeNoteNode(bullets);
        // A wrapper item takes the next one's number and counts none.
        expect(bullets.children.map((one: any) => one.value)).toEqual([
            1, 2, 2, 3,
        ]);
        expect('checked' in bullets.children[0]).toBe(false);
        const numbers: any = {
            children: [item(), item()],
            listType: 'number',
            start: 4,
            type: 'list',
        };
        normalizeNoteNode(numbers);
        expect(numbers.children.map((one: any) => one.value)).toEqual([4, 5]);
        const checks: any = {
            children: [item({ checked: true }), item()],
            listType: 'check',
            type: 'list',
        };
        normalizeNoteNode(checks);
        expect(
            checks.children.map((one: any) => [one.value, one.checked]),
        ).toEqual([
            [1, true],
            [2, false],
        ]);
    });

    // Measured live 2026-11-08 on five new lists opened in the note window:
    // the list takes its FIRST item's first text's format, ON THE LIST.
    test('an element with no text of its own writes its first text’s style', () => {
        const text = (format: number, style = '') => ({
            detail: 0,
            format,
            mode: 'normal',
            style,
            text: 'x',
            type: 'text',
            version: 1,
        });
        const item = (...children: any[]) => ({
            children,
            type: 'listitem',
            version: 1,
            value: 1,
        });
        const list = (...children: any[]): any => ({
            children,
            listType: 'bullet',
            start: 1,
            tag: 'ul',
            type: 'list',
            version: 1,
        });
        // The FIRST item's first text: seen [1,1,1,0,0,0,1] -> 1.
        const firstBold = list(
            item(text(1), text(0)),
            item(text(0)),
            item(text(1)),
        );
        normalizeNoteNode(firstBold);
        expect(firstBold.textFormat).toBe(1);
        expect('textStyle' in firstBold).toBe(false);
        // An item holding text writes none of its own.
        expect('textFormat' in firstBold.children[0]).toBe(false);
        // Seen [0,1] -> none: a later bold item does not count.
        const lastBold = list(item(text(0)), item(text(1)));
        normalizeNoteNode(lastBold);
        expect('textFormat' in lastBold).toBe(false);
        // A style (a size, a font) is written the same way.
        const sized = list(item(text(0, 'font-size: 20px;')));
        normalizeNoteNode(sized);
        expect(sized.textStyle).toBe('font-size: 20px;');
        expect(Object.keys(sized)).toEqual([
            'children',
            'type',
            'version',
            'textStyle',
            'listType',
            'start',
            'tag',
        ]);
        // A nested list takes its own first text; the item wrapping it is
        // left as it was (nothing measured says otherwise).
        const nested = list(item(text(0)), item(list(item(text(1)))));
        normalizeNoteNode(nested);
        expect(nested.children[1].children[0].textFormat).toBe(1);
        expect('textFormat' in nested.children[1]).toBe(false);
        expect('textFormat' in nested).toBe(false);
        // Lists only: a passage given its title's font was written back
        // without it by the window (2026-11-08).
        const passage: any = {
            children: [
                {
                    children: [text(0, 'font-family: app-Google-Sans;')],
                    type: 'collapsible-title',
                    version: 1,
                },
            ],
            open: true,
            type: 'collapsible-container',
            version: 1,
        };
        normalizeNoteNode(passage);
        expect('textStyle' in passage).toBe(false);
    });

    test('a block object writes its type and version first', () => {
        const video: any = {
            format: '',
            type: 'youtube',
            version: 1,
            height: 'inherit',
            videoID: 'afVN-7vY0KA',
            width: 'inherit',
        };
        normalizeNoteNode(video);
        expect(Object.keys(video)).toEqual([
            'type',
            'version',
            'format',
            'height',
            'videoID',
            'width',
        ]);
    });

    test('a code block reads the same however the highlighter split it', () => {
        const genCode = (children: any[]) => {
            return JSON.stringify({
                root: {
                    children: [{ children, type: 'code', language: 'python' }],
                    type: 'root',
                },
            });
        };
        const plain = genCode([{ text: "print('grace')", type: 'text' }]);
        const split = genCode([
            { text: 'print', type: 'code-highlight', highlightType: 'keyword' },
            { text: "('grace')", type: 'text' },
        ]);
        expect(toNoteCanonicalText(plain)).toBe(toNoteCanonicalText(split));
        expect(toNoteCanonicalText(plain)).not.toBe(
            toNoteCanonicalText(genCode([{ text: 'other', type: 'text' }])),
        );
    });
});
