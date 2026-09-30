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
    RenderTitleMaterialComp: () => (
        <div className="bible-view-title-material" />
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

import { EditingResultContext } from '../bible-reader/LookupBibleItemController';
import RenderBibleEditingHeaderComp from './RenderBibleEditingHeaderComp';

function renderHeader(isFound: boolean) {
    const editingResult = isFound
        ? { result: { bibleItem: { id: 'found' } } }
        : { result: { bibleItem: null } };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
        <EditingResultContext value={editingResult as any}>
            <RenderBibleEditingHeaderComp />
        </EditingResultContext>,
    );
    const header = host.querySelector('.bible-view-header')!;
    return {
        actions: header.querySelector('.bible-view-header-actions'),
        info: header.querySelector('.bible-info'),
        end: header.querySelector(':scope > .bible-view-header-end'),
    };
}

beforeEach(() => {
    controller.isAlone = true;
});

// The overlay hangs off the end group's left edge and covers whatever is
// under it while the header is hovered, so a control that has to stay
// pressable must sit in the end group BESIDE it, never under or inside it.
// Anchored a fixed ⋮-width from the right, the ✕ once landed on the (i).
test('the translation info stays in the row beside the hover actions', () => {
    controller.isAlone = false;
    const { actions, info, end } = renderHeader(false);

    expect(info).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(actions!.contains(info)).toBe(false);
    expect(info!.closest('.bible-view-header-end')).toBe(end);
    expect(actions!.parentElement).toBe(end);
    expect(actions!.querySelector('.bible-view-header-close')).not.toBeNull();
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
