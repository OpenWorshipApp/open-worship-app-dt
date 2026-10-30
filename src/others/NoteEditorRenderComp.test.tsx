// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./SimpleNoteEditorComp', () => ({
    default: ({
        store,
        placeholder,
    }: {
        store: { defaultText: string };
        placeholder?: string;
    }) => (
        <textarea
            readOnly
            placeholder={placeholder}
            value={store.defaultText}
        />
    ),
}));

import NoteEditorRenderComp from './NoteEditorRenderComp';

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

const STORE = {
    defaultText: 'Remember the offering',
    currentText: 'Remember the offering',
    checkCanSave: () => false,
};

describe('NoteEditorRenderComp', () => {
    test('titles the note and hands the store to the editor', async () => {
        await act(async () =>
            root.render(
                <NoteEditorRenderComp
                    store={STORE}
                    title="Slide 3 note"
                    uuid="note-3"
                />,
            ),
        );
        const wrapper = host.firstElementChild as HTMLElement;
        expect(wrapper.dataset.noteEditorUuid).toBe('note-3');
        const title = wrapper.firstElementChild as HTMLElement;
        expect(title.textContent).toBe('Slide 3 note');
        expect(title.title).toBe('Double click to jump to top');
        const editor = host.querySelector('textarea')!;
        expect(editor.value).toBe('Remember the offering');
        expect(editor.placeholder).toBe('Enter your note here...');
    });

    test('double-clicking the title scrolls the note to the top of its list', async () => {
        await act(async () =>
            root.render(<NoteEditorRenderComp store={STORE} title="Note" />),
        );
        const wrapper = host.firstElementChild as HTMLElement;
        const scrollIntoView = vi.fn();
        wrapper.scrollIntoView = scrollIntoView;
        const title = wrapper.firstElementChild as HTMLElement;
        await act(async () =>
            title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
        );
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
            behavior: 'smooth',
            block: 'start',
        });
    });
});
