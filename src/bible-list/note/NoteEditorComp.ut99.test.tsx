// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type Note from './Note';
import type NoteItem from './NoteItem';

const h = vi.hoisted(() => ({
    onFileUpdate: null as null | (() => void),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_names: string[], callback: () => void) => {
        h.onFileUpdate = callback;
    },
}));
vi.mock('../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../../others/SimpleNoteEditorComp', () => ({
    default: ({
        store,
        isInput,
        onEscape,
        onBlur,
        onEnter,
    }: {
        store: { currentText: string; save: () => Promise<boolean> };
        isInput?: boolean;
        onEscape?: () => void;
        onBlur?: () => void;
        onEnter?: () => void;
    }) => (
        <div data-editor={isInput ? 'title' : 'content'}>
            <span data-text>{store.currentText}</span>
            <button
                type="button"
                onClick={() => {
                    store.currentText = 'edited';
                }}
            >
                Edit
            </button>
            <button type="button" onClick={() => store.save()}>
                Save
            </button>
            <button type="button" onClick={onEscape}>
                Escape
            </button>
            <button type="button" onClick={onBlur}>
                Blur
            </button>
            <button type="button" onClick={onEnter}>
                Enter
            </button>
        </div>
    ),
}));

import NoteEditorComp, { NoteTitleEditorComp } from './NoteEditorComp';

describe('note editors', () => {
    let container: HTMLDivElement;
    let root: Root;
    let item: NoteItem;
    let note: Note;
    let liveItem: NoteItem;
    const updateAndSave = vi.fn(async () => true);
    const reload = vi.fn(async () => {});

    async function renderContent() {
        await act(async () =>
            root.render(
                <NoteEditorComp
                    note={note}
                    noteItem={item}
                    extraStyle={{ height: 120 }}
                />,
            ),
        );
    }

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === label,
        )!;
        await act(async () => button.click());
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.onFileUpdate = null;
        updateAndSave.mockClear();
        reload.mockClear();
        item = {
            id: 2,
            title: 'Old title',
            content: 'Old content',
        } as NoteItem;
        liveItem = item;
        note = {
            filePath: '/notes/Default.own',
            updateAndSaveNoteItem: updateAndSave,
            reload,
            getItemById: () => liveItem,
        } as unknown as Note;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('content editor saves changed text silently and skips an unchanged save', async () => {
        await renderContent();
        expect(
            container.querySelector('[data-editor="content"] [data-text]')
                ?.textContent,
        ).toBe('Old content');
        expect((container.firstElementChild as HTMLElement).style.height).toBe(
            '120px',
        );
        await click('Save');
        expect(updateAndSave).not.toHaveBeenCalled();
        await click('Edit');
        await click('Save');
        expect(updateAndSave).toHaveBeenLastCalledWith(item, true);
        expect(item.content).toBe('edited');
    });

    test('title editor saves an edited title and forwards close actions', async () => {
        const onEscape = vi.fn();
        const onBlur = vi.fn();
        const onEnter = vi.fn();
        await act(async () =>
            root.render(
                <NoteTitleEditorComp
                    note={note}
                    noteItem={item}
                    onEscape={onEscape}
                    onBlur={onBlur}
                    onEnter={onEnter}
                />,
            ),
        );
        expect(
            container.querySelector('[data-editor="title"] [data-text]')
                ?.textContent,
        ).toBe('Old title');
        await click('Edit');
        await click('Escape');
        await click('Blur');
        await click('Enter');
        expect([
            onEscape.mock.calls.length,
            onBlur.mock.calls.length,
            onEnter.mock.calls.length,
        ]).toEqual([1, 1, 1]);
        await click('Save');
        expect(item.title).toBe('edited');
        expect(updateAndSave).toHaveBeenLastCalledWith(item, true);
    });

    test('a file update refreshes the content store from the latest item', async () => {
        await renderContent();
        liveItem = {
            id: 2,
            title: 'New title',
            content: 'disk text',
        } as NoteItem;
        await act(async () => h.onFileUpdate?.());
        expect(reload).toHaveBeenCalledOnce();
        expect(container.querySelector('[data-text]')?.textContent).toBe(
            'disk text',
        );
        expect(updateAndSave).not.toHaveBeenCalled();
    });

    function textOf(kind: 'title' | 'content') {
        return container.querySelector(`[data-editor="${kind}"] [data-text]`)
            ?.textContent;
    }

    async function renderTitle(noteItem = item) {
        await act(async () =>
            root.render(
                <NoteTitleEditorComp note={note} noteItem={noteItem} />,
            ),
        );
    }

    function deferReload() {
        let finishReload: () => void = () => undefined;
        reload.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                finishReload = resolve;
            }),
        );
        return () => finishReload();
    }

    test('a content refresh keeps the typing when the item is gone or already reads the same', async () => {
        await renderContent();
        await click('Edit');
        liveItem = null as unknown as NoteItem;
        await act(async () => h.onFileUpdate?.());
        liveItem = { id: 2, title: 'Old title', content: 'edited' } as NoteItem;
        await act(async () => h.onFileUpdate?.());
        expect(reload).toHaveBeenCalledTimes(2);
        // Still the same store: what was typed into it is there to save.
        await click('Save');
        expect(updateAndSave).toHaveBeenCalledOnce();
        expect(updateAndSave).toHaveBeenCalledWith(item, true);
        expect(item.content).toBe('edited');
    });

    test('a content refresh that lands after the editor moved to another item is dropped', async () => {
        const finishReload = deferReload();
        await renderContent();
        liveItem = {
            id: 2,
            title: 'Old title',
            content: 'disk text of the old item',
        } as NoteItem;
        const firstItemUpdate = h.onFileUpdate!;
        await act(async () => firstItemUpdate());
        const otherItem = {
            id: 3,
            title: 'Other',
            content: 'Other content',
        } as NoteItem;
        await act(async () =>
            root.render(<NoteEditorComp note={note} noteItem={otherItem} />),
        );
        expect(textOf('content')).toBe('Other content');
        await act(async () => finishReload());
        expect(textOf('content')).toBe('Other content');
        expect(updateAndSave).not.toHaveBeenCalled();
    });

    test('a title changed on disk refreshes the title field; an item gone from the file leaves it', async () => {
        await renderTitle();
        liveItem = null as unknown as NoteItem;
        await act(async () => h.onFileUpdate?.());
        expect(reload).toHaveBeenCalledOnce();
        expect(textOf('title')).toBe('Old title');
        liveItem = {
            id: 2,
            title: 'New title',
            content: 'Old content',
        } as NoteItem;
        await act(async () => h.onFileUpdate?.());
        expect(reload).toHaveBeenCalledTimes(2);
        expect(textOf('title')).toBe('New title');
        expect(updateAndSave).not.toHaveBeenCalled();
    });

    // 2026-11-04: the title field held the item's CONTENT up to the title
    // typed, so every update rebuilt it, and the store it replaced saved
    // itself on the way out -- a title already on disk written again, and
    // every window reading the file reloading once more for nothing.
    test('a title refresh keeps the typing when the file already reads the same', async () => {
        await renderTitle();
        await click('Edit');
        liveItem = {
            id: 2,
            title: 'edited',
            content: 'Old content',
        } as NoteItem;
        await act(async () => h.onFileUpdate?.());
        expect(reload).toHaveBeenCalledOnce();
        expect(updateAndSave).not.toHaveBeenCalled();
        // Still the same store: what was typed into it is there to save.
        await click('Save');
        expect(updateAndSave).toHaveBeenCalledExactlyOnceWith(item, true);
        expect(item.title).toBe('edited');
    });

    test('a title refresh that lands after the field moved to another item is dropped', async () => {
        const finishReload = deferReload();
        await renderTitle();
        liveItem = {
            id: 2,
            title: 'Disk title of the old item',
            content: 'Old content',
        } as NoteItem;
        const firstItemUpdate = h.onFileUpdate!;
        await act(async () => firstItemUpdate());
        const otherItem = {
            id: 3,
            title: 'Other title',
            content: 'Other content',
        } as NoteItem;
        await renderTitle(otherItem);
        expect(textOf('title')).toBe('Other title');
        await act(async () => finishReload());
        expect(textOf('title')).toBe('Other title');
        expect(updateAndSave).not.toHaveBeenCalled();
    });
});
