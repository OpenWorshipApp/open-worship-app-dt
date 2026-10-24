// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

const { controller } = vi.hoisted(() => ({
    controller: {
        isAlone: true,
        selectedBibleItem: { bibleKey: 'KJV', extraBibleKeys: [] },
        deleteBibleItem: () => {},
    },
}));

vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => controller,
}));
vi.mock('../LookupBibleItemController', async () => {
    const { createContext, use } = await import('react');
    const EditingResultContext = createContext(null);
    return {
        closeEventMapper: {},
        EditingResultContext,
        useEditingResult: () => use(EditingResultContext),
    };
});
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button type="button" className="app-context-menu-dots" />,
}));
vi.mock('../../bible-lookup/BibleInfoButtonComp', () => ({
    default: () => <button type="button" className="bible-info" />,
}));
vi.mock('../../bible-lookup/RenderEditingActionButtonsComp', () => ({
    default: () => <div className="btn-group editing-actions" />,
}));
vi.mock('../../bible-lookup/RenderActionButtonsComp', () => ({
    default: () => <div className="btn-group view-actions" />,
}));
vi.mock('../../bible-lookup/RenderLookupSplitButtonsComp', () => ({
    default: ({ bookKey }: { bookKey: string | null }) => (
        <div className="btn-group lookup-split" data-book-key={bookKey ?? ''} />
    ),
}));
vi.mock('./RenderTitleMaterialComp', () => ({
    RenderTitleMaterialComp: ({
        actionsElement,
    }: {
        actionsElement?: React.ReactNode;
    }) => (
        <div className="bible-view-title-material">
            <div className="bible-view-title-keys" />
            <div className="bible-view-reference">{actionsElement}</div>
        </div>
    ),
}));
vi.mock('../readBibleHelpers', () => ({
    closeCurrentEditingBibleItem: vi.fn(),
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'Ctrl+W',
}));
vi.mock('../../helper/helpers', () => ({ BIBLE_VERSE_TEXT_TITLE: '' }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (current: unknown) => ({ current }),
}));

import type React from 'react';

import { EditingResultContext } from '../LookupBibleItemController';
import { BibleViewTitleMaterialContext } from './viewExtraHelpers';
import BibleViewHeaderComp from './BibleViewHeaderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bibleItem = { id: 1, bibleKey: 'KJV', extraBibleKeys: [] } as any;

function genHeader(
    isEditing: boolean,
    isFound: boolean,
    actionElement?: React.ReactNode,
) {
    const editingResult = isFound
        ? { result: { bibleItem: { id: 'found' }, bookKey: 'GEN' } }
        : { result: { bibleItem: null, bookKey: 'EXO' } };
    return (
        <BibleViewTitleMaterialContext
            value={{ titleElement: null, actionElement }}
        >
            <EditingResultContext value={editingResult as any}>
                <BibleViewHeaderComp
                    bibleItem={bibleItem}
                    isEditing={isEditing}
                />
            </EditingResultContext>
        </BibleViewTitleMaterialContext>
    );
}

function renderHeader(
    isFound: boolean,
    actionElement?: React.ReactNode,
    isEditing = true,
) {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
        genHeader(isEditing, isFound, actionElement),
    );
    const header = host.querySelector('.bible-view-header')!;
    return {
        header,
        actions: header.querySelector('.bible-view-header-actions'),
        info: header.querySelector('.bible-info'),
        split: header.querySelector('.lookup-split'),
        end: header.querySelector(':scope > .bible-view-header-end'),
        keys: header.querySelector('.bible-view-title-keys'),
    };
}

beforeEach(() => {
    controller.isAlone = true;
});

// The overlay covers whatever is under it while the header is hovered, so it
// lives INSIDE the reference box: it may cover the passage text and nothing
// else. Hung off the end group with a pane-wide width it reached back over
// the version pill and its ⋮, and a click meant for them opened Copy. A
// control that has to stay pressable sits in the end group beside it.
test('the hover actions live in the reference box, beside the info', () => {
    controller.isAlone = false;
    const { actions, info, end, keys } = renderHeader(false);

    expect(info).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(actions!.contains(info)).toBe(false);
    expect(info!.closest('.bible-view-header-end')).toBe(end);
    expect(end!.contains(actions)).toBe(false);
    expect(actions!.parentElement!.classList).toContain('bible-view-reference');
    expect(keys!.contains(actions)).toBe(false);
    expect(actions!.querySelector('.bible-view-header-close')).not.toBeNull();
});

test('the pencil is one of the actions, first in the row', () => {
    const { actions } = renderHeader(
        true,
        <button type="button" className="bible-view-header-edit" />,
    );

    expect(actions!.firstElementChild!.classList).toContain(
        'bible-view-header-edit',
    );
});

test('nothing to act on and nothing to close draws no empty overlay', () => {
    const { actions, info } = renderHeader(false);

    // A hover would otherwise fade the title out under a blank strip.
    expect(actions).toBeNull();
    expect(info).not.toBeNull();
});

// The book and chapter grids have no passage to act on, but the view can
// still be split: the buttons sit at rest beside the info, where the user
// looks for them, never in the hover overlay.
test('the grids keep their split buttons at rest, before the info', () => {
    const { actions, split, info, end } = renderHeader(false);

    expect(actions).toBeNull();
    expect(split).not.toBeNull();
    expect(split!.closest('.bible-view-header-end')).toBe(end);
    expect(split!.nextElementSibling).toBe(info);
    expect(split!.getAttribute('data-book-key')).toBe('EXO');
});

test('a resolved passage puts its actions and the close in the overlay', () => {
    controller.isAlone = false;
    const { actions, info, split } = renderHeader(true);

    expect(info).toBeNull();
    expect(split).toBeNull();
    expect(actions!.querySelector(':scope > .editing-actions')).not.toBeNull();
    const close = actions!.querySelector('.bible-view-header-close');
    expect(close?.getAttribute('title')).toBe('Close [Ctrl+W]');
    expect(close?.getAttribute('aria-label')).toBe('Close');
});

test('the only view in the lookup cannot be closed from its header', () => {
    const { actions } = renderHeader(true);

    expect(actions!.querySelector('.bible-view-header-close')).toBeNull();
});

test('a plain view is a card header with its own actions and a close', () => {
    const { header, actions, info, split } = renderHeader(
        false,
        <button type="button" className="bible-view-header-edit" />,
        false,
    );

    expect(header.classList).toContain('card-header');
    expect(header.getAttribute('title')).toBeNull();
    expect(info).toBeNull();
    expect(split).toBeNull();
    expect(actions!.firstElementChild!.classList).toContain(
        'bible-view-header-edit',
    );
    expect(actions!.querySelector(':scope > .view-actions')).not.toBeNull();
    const close = actions!.querySelector('.bible-view-header-close');
    expect(close?.getAttribute('title')).toBe('Close');
});

// The point of one header for both: making a view the one being edited, or
// another view instead, must not rebuild its title row -- that rebuild was the
// flicker of the colour dot, the version pill and the reference.
test('switching in and out of editing keeps the title row mounted', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
        root.render(genHeader(false, true));
    });
    const titleMaterial = host.querySelector('.bible-view-title-material');
    expect(titleMaterial).not.toBeNull();

    act(() => {
        root.render(genHeader(true, true));
    });
    expect(host.querySelector('.bible-view-title-material')).toBe(
        titleMaterial,
    );
    expect(host.querySelector('.bible-view-header')!.classList).toContain(
        'app-border-bottom-white-round',
    );

    act(() => {
        root.render(genHeader(false, true));
    });
    expect(host.querySelector('.bible-view-title-material')).toBe(
        titleMaterial,
    );
    act(() => {
        root.unmount();
    });
});
