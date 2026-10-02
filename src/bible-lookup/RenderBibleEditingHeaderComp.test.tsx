// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

const { controller } = vi.hoisted(() => ({
    controller: {
        isAlone: true,
        selectedBibleItem: { bibleKey: 'KJV', extraBibleKeys: [] },
    },
}));

vi.mock('../bible-reader/LookupBibleItemController', async () => {
    const { createContext } = await import('react');
    return {
        closeEventMapper: {},
        EditingResultContext: createContext(null),
        useLookupBibleItemControllerContext: () => controller,
    };
});
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button type="button" className="app-context-menu-dots" />,
}));
vi.mock('./BibleInfoButtonComp', () => ({
    default: () => <button type="button" className="bible-info" />,
}));
vi.mock('./RenderEditingActionButtonsComp', () => ({
    default: () => <div className="btn-group" />,
}));
vi.mock('../bible-reader/view-extra/RenderTitleMaterialComp', () => ({
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
vi.mock('../bible-reader/readBibleHelpers', () => ({
    closeCurrentEditingBibleItem: vi.fn(),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'Ctrl+W',
}));
vi.mock('../helper/helpers', () => ({ BIBLE_VERSE_TEXT_TITLE: '' }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (current: unknown) => ({ current }),
}));

import type React from 'react';

import { EditingResultContext } from '../bible-reader/LookupBibleItemController';
import { BibleViewTitleMaterialContext } from '../bible-reader/view-extra/viewExtraHelpers';
import RenderBibleEditingHeaderComp from './RenderBibleEditingHeaderComp';

function renderHeader(isFound: boolean, actionElement?: React.ReactNode) {
    const editingResult = isFound
        ? { result: { bibleItem: { id: 'found' } } }
        : { result: { bibleItem: null } };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
        <BibleViewTitleMaterialContext
            value={{ titleElement: null, actionElement }}
        >
            <EditingResultContext value={editingResult as any}>
                <RenderBibleEditingHeaderComp />
            </EditingResultContext>
        </BibleViewTitleMaterialContext>,
    );
    const header = host.querySelector('.bible-view-header')!;
    return {
        actions: header.querySelector('.bible-view-header-actions'),
        info: header.querySelector('.bible-info'),
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

test('a resolved passage puts its actions and the close in the overlay', () => {
    controller.isAlone = false;
    const { actions, info } = renderHeader(true);

    expect(info).toBeNull();
    expect(actions!.querySelector(':scope > .btn-group')).not.toBeNull();
    const close = actions!.querySelector('.bible-view-header-close');
    expect(close?.getAttribute('title')).toBe('Close [Ctrl+W]');
    expect(close?.getAttribute('aria-label')).toBe('Close');
});

test('the only view in the lookup cannot be closed from its header', () => {
    const { actions } = renderHeader(true);

    expect(actions!.querySelector('.bible-view-header-close')).toBeNull();
});
