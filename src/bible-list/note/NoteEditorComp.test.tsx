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
});
