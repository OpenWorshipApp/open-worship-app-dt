// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DEFAULT_BIBLE_COLOR_NOTE } from '../../helper/colorNoteDefaults';
import { BibleViewTitleMaterialContext } from './viewExtraHelpers';

type ColorNoteHandlerType = {
    getColorNote: () => Promise<string | null>;
    setColorNote: (color: string | null) => Promise<void>;
};

const h = vi.hoisted(() => ({
    viewController: {
        getColorNote: vi.fn(),
        setColorNote: vi.fn(),
        getBibleItemsByColorNote: vi.fn(),
        getIsGroupScrollSynced: vi.fn(),
        setIsGroupScrollSynced: vi.fn(),
        applyTargetOrBibleKey: vi.fn(),
        groupScrollSync: { syncFrom: vi.fn() },
    },
    pressElementLikeButton: vi.fn(),
    colorNoteProps: null as null | {
        item: ColorNoteHandlerType;
        defaultColorNote: string;
    },
    keySelectionProps: null as null | Record<string, unknown>,
    audioBibleItems: [] as unknown[],
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: (props: Record<string, unknown>) => {
        h.keySelectionProps = props;
        return <span className="test-key-selection" />;
    },
}));
vi.mock('../../others/ItemColorNoteComp', () => ({
    default: (props: {
        item: ColorNoteHandlerType;
        defaultColorNote: string;
    }) => {
        h.colorNoteProps = props;
        return <span className="test-color-note" />;
    },
}));
vi.mock('../AudioAIEnablingComp', () => ({
    AudioAIEnablingComp: ({ bibleItem }: { bibleItem: unknown }) => {
        h.audioBibleItems.push(bibleItem);
        return <span className="test-audio-enabling" />;
    },
}));
vi.mock('../../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));

import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';

function genBibleItem(extraBibleKeys: string[] = []) {
    return { id: 4, bibleKey: 'KJV', extraBibleKeys } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.colorNoteProps = null;
    h.keySelectionProps = null;
    h.audioBibleItems = [];
    h.viewController.getColorNote.mockReturnValue(null);
    h.viewController.getBibleItemsByColorNote.mockReturnValue([]);
    h.viewController.getIsGroupScrollSynced.mockReturnValue(false);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(bibleItem = genBibleItem(), onBibleKeyChange?: any) {
    await act(async () => {
        root.render(
            <div className="bible-view">
                <BibleViewTitleMaterialContext
                    value={{
                        titleElement: <span className="test-title">GEN 1</span>,
                    }}
                >
                    <RenderTitleMaterialComp
                        bibleItem={bibleItem}
                        onBibleKeyChange={onBibleKeyChange}
                        actionsElement={<button className="test-action" />}
                    />
                </BibleViewTitleMaterialContext>
                <div data-scroll-verses-container="1" />
            </div>,
        );
    });
}

function getSyncButton() {
    return host.querySelector<HTMLButtonElement>('.bible-view-sync-scroll');
}

describe('the title material', () => {
    test('holds the title and the hover actions inside the reference box', async () => {
        const onBibleKeyChange = vi.fn();
        const bibleItem = genBibleItem();
        await render(bibleItem, onBibleKeyChange);
        const reference = host.querySelector('.bible-view-reference')!;
        expect(reference.querySelector('.test-title')!.textContent).toBe(
            'GEN 1',
        );
        expect(reference.querySelector('.test-action')).not.toBeNull();
        expect(h.keySelectionProps).toEqual({
            bibleKey: 'KJV',
            onBibleKeyChange,
            contextMenuTitle: 'Add Extra Bible',
        });
        expect(h.audioBibleItems.at(-1)).toBe(bibleItem);
    });

    test("the colour note reads and writes the item's group colour", async () => {
        const bibleItem = genBibleItem();
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        await render(bibleItem);
        expect(h.colorNoteProps!.defaultColorNote).toBe(
            DEFAULT_BIBLE_COLOR_NOTE,
        );
        expect(await h.colorNoteProps!.item.getColorNote()).toBe('#ff0000');
        expect(h.viewController.getColorNote).toHaveBeenCalledWith(bibleItem);
        await h.colorNoteProps!.item.setColorNote('#00ff00');
        expect(h.viewController.setColorNote).toHaveBeenCalledWith(
            bibleItem,
            '#00ff00',
        );
    });
});

describe('extra bibles', () => {
    test('each extra bible is a chip that removes itself', async () => {
        const bibleItem = genBibleItem(['KHM', 'FRE']);
        await render(bibleItem);
        const chips = Array.from(
            host.querySelectorAll<HTMLSpanElement>('.bible-extra-key'),
        );
        expect(chips.map((chip) => chip.textContent)).toEqual(['KHM', 'FRE']);
        const [khmerChip] = chips;
        expect(khmerChip.getAttribute('role')).toBe('button');
        expect(khmerChip.tabIndex).toBe(0);
        expect(khmerChip.getAttribute('aria-label')).toBe(
            'Click to remove extra Bible KHM',
        );
        // Each chip in its own bible's face.
        expect(khmerChip.style.fontFamily).toBe('KHM Font');
        await act(async () => {
            khmerChip.click();
        });
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { extraBibleKeys: ['FRE'] },
        );
    });

    test('a chip answers the keyboard like a button', async () => {
        await render(genBibleItem(['KHM']));
        const chip = host.querySelector<HTMLSpanElement>('.bible-extra-key')!;
        await act(async () => {
            chip.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledOnce();
        expect(h.pressElementLikeButton.mock.calls[0][0].key).toBe('Enter');
    });
});

describe('group sync scrolling', () => {
    test('an ungrouped view has no sync button', async () => {
        await render();
        expect(getSyncButton()).toBeNull();
        // A colour shared with nobody is not a group either.
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([{}]);
        await render(genBibleItem());
        expect(getSyncButton()).toBeNull();
    });

    test('turning sync on lines the group up with this view', async () => {
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([{}, {}]);
        await render();
        const button = getSyncButton()!;
        expect(button.title).toBe('Enable group sync scrolling');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.getAttribute('aria-label')).toBe('Sync group scrolling');
        expect(h.viewController.getIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
        );
        await act(async () => {
            button.click();
        });
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
            true,
        );
        expect(h.viewController.groupScrollSync.syncFrom).toHaveBeenCalledWith(
            host.querySelector('[data-scroll-verses-container]'),
        );
    });

    test('turning sync off moves nothing', async () => {
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([{}, {}]);
        h.viewController.getIsGroupScrollSynced.mockReturnValue(true);
        await render();
        const button = getSyncButton()!;
        expect(button.title).toBe('Disable group sync scrolling');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        await act(async () => {
            button.click();
        });
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
            false,
        );
        expect(
            h.viewController.groupScrollSync.syncFrom,
        ).not.toHaveBeenCalled();
    });

    test('a view with no verses yet has nothing to sync from', async () => {
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([{}, {}]);
        await render();
        host.querySelector('[data-scroll-verses-container]')!.remove();
        await act(async () => {
            getSyncButton()!.click();
        });
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledOnce();
        expect(
            h.viewController.groupScrollSync.syncFrom,
        ).not.toHaveBeenCalled();
    });
});
