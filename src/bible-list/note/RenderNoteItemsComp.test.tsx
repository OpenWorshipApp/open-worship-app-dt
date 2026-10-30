// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type RowPropsType = {
    index: number;
    noteItem: { id: number };
    filePath: string;
    note: { name: string };
};

function genRowComp(kind: string) {
    return ({ index, noteItem, filePath, note }: RowPropsType) => (
        <li
            className={kind}
            data-index={index}
            data-file={filePath}
            data-note={note.name}
        >
            {noteItem.id}
        </li>
    );
}

vi.mock('./BibleNoteItemRenderComp', () => ({
    default: genRowComp('bible-note-row'),
}));
vi.mock('./VerseNoteItemRenderComp', () => ({
    default: genRowComp('verse-row'),
}));

import RenderNoteItemsComp from './RenderNoteItemsComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the items of one note file', () => {
    test('a verse item gets the verse row, any other item the note row, in order', async () => {
        const note = {
            name: 'Sermons',
            filePath: '/notes/Sermons.own',
            items: [
                { id: 1, isVerseItem: false },
                { id: 2, isVerseItem: true },
                { id: 3, isVerseItem: false },
            ],
        } as any;
        await act(async () => {
            root.render(<RenderNoteItemsComp note={note} />);
        });
        const rows = [...host.querySelectorAll<HTMLElement>('ul > li')];
        expect(
            rows.map((row) => [
                row.className,
                row.textContent,
                row.dataset.index,
            ]),
        ).toEqual([
            ['bible-note-row', '1', '0'],
            ['verse-row', '2', '1'],
            ['bible-note-row', '3', '2'],
        ]);
        for (const row of rows) {
            expect(row.dataset.file).toBe('/notes/Sermons.own');
            expect(row.dataset.note).toBe('Sermons');
        }
    });
});
