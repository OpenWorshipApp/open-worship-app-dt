// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        viewController: null as any,
        editingResult: null as any,
        isAudioAvailable: true,
        isAudioEnabled: false,
        checkIsAIAudioAvailableForBible: vi.fn(),
        pressElementLikeButton: vi.fn(),
        closeCurrentEditingBibleItem: vi.fn(),
    };
});

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
// The version pill: it hands back what the person picked, and a right-click
// is how an extra bible is added.
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: ({
        bibleKey,
        onBibleKeyChange,
        contextMenuTitle,
    }: any) => (
        <span
            className="bible-key-pill"
            data-bible-key={bibleKey}
            data-menu-title={contextMenuTitle}
        >
            <button
                type="button"
                className="pick-bible"
                onClick={() => onBibleKeyChange(false, bibleKey, 'NIV')}
            />
            <button
                type="button"
                className="add-extra-bible"
                onClick={() => onBibleKeyChange(true, bibleKey, 'NIV')}
            />
        </span>
    ),
}));
vi.mock('../../others/ItemColorNoteComp', () => ({
    default: ({ item, defaultColorNote }: any) => (
        <span className="color-note" data-default={defaultColorNote}>
            <button
                type="button"
                className="read-color"
                onClick={async (event) => {
                    event.currentTarget.dataset.read =
                        (await item.getColorNote()) ?? '';
                }}
            />
            <button
                type="button"
                className="set-color"
                onClick={() => item.setColorNote('#00ff00')}
            />
        </span>
    ),
}));
vi.mock('../../helper/ai/openAIAudioHelpers', () => ({
    checkIsAIAudioAvailableForBible: h.checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled: () => ({
        isAudioEnabled: h.isAudioEnabled,
        isAvailable: h.isAudioAvailable,
    }),
}));
vi.mock('../../helper/helpers', () => ({
    BIBLE_VERSE_TEXT_TITLE: 'Bible verse text',
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `Font ${bibleKey}`,
}));
vi.mock('../../bible-lookup/BibleInfoButtonComp', () => ({
    default: () => <button type="button" className="bible-info" />,
}));
vi.mock('../../bible-lookup/RenderActionButtonsComp', () => ({
    default: () => <div className="view-actions" />,
}));
vi.mock('../../bible-lookup/RenderEditingActionButtonsComp', () => ({
    default: () => <div className="editing-actions" />,
}));
vi.mock('../../bible-lookup/RenderLookupSplitButtonsComp', () => ({
    default: () => <div className="lookup-split" />,
}));
vi.mock('../LookupBibleItemController', () => ({
    closeEventMapper: {},
    useEditingResult: () => h.editingResult,
}));
vi.mock('../readBibleHelpers', () => ({
    closeCurrentEditingBibleItem: h.closeCurrentEditingBibleItem,
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'Ctrl+W',
}));
vi.mock('../../helper/horizontalWheelScrollHelpers', () => ({
    applyHorizontalWheelScroll: () => {},
}));

import { DEFAULT_BIBLE_COLOR_NOTE } from '../../helper/colorNoteDefaults';
import BibleViewHeaderComp from './BibleViewHeaderComp';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';
import { BibleViewTitleMaterialContext } from './viewExtraHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genBibleItem(extraBibleKeys: string[] = []) {
    return { id: 7, bibleKey: 'KJV', extraBibleKeys } as any;
}

let host: HTMLDivElement;
let root: Root;

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

async function renderInView(node: ReactNode) {
    await act(async () => {
        root.render(
            <div className="bible-view">
                <BibleViewTitleMaterialContext
                    value={{ titleElement: <span className="the-title" /> }}
                >
                    {node}
                </BibleViewTitleMaterialContext>
                <div data-scroll-verses-container="" className="verses" />
            </div>,
        );
    });
}

async function press(element: Element | null) {
    if (element === null) {
        throw new Error('nothing to press');
    }
    await act(async () => {
        (element as HTMLElement).click();
        await flush();
    });
}

beforeEach(() => {
    h.viewController = {
        isAlone: false,
        selectedBibleItem: genBibleItem(['ESV']),
        getColorNote: vi.fn(),
        setColorNote: vi.fn(),
        getBibleItemsByColorNote: vi.fn(),
        getIsGroupScrollSynced: vi.fn(),
        setIsGroupScrollSynced: vi.fn(),
        applyTargetOrBibleKey: vi.fn(),
        deleteBibleItem: vi.fn(),
        groupScrollSync: { syncFrom: vi.fn() },
    };
    h.viewController.getColorNote.mockReturnValue(null);
    h.viewController.getBibleItemsByColorNote.mockReturnValue([]);
    h.viewController.getIsGroupScrollSynced.mockReturnValue(false);
    h.editingResult = null;
    h.isAudioAvailable = true;
    h.isAudioEnabled = false;
    h.checkIsAIAudioAvailableForBible.mockResolvedValue(false);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('RenderTitleMaterialComp', () => {
    test('needs the title material of the view it sits in', () => {
        expect(() =>
            renderToStaticMarkup(
                <RenderTitleMaterialComp bibleItem={genBibleItem()} />,
            ),
        ).toThrow(
            'useBibleViewTitleMaterialContext must be used within a ' +
                'BibleViewTitleMaterialContext',
        );
    });

    test("draws the view's colour, its version and its reference with the actions", async () => {
        const bibleItem = genBibleItem();
        await renderInView(
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                actionsElement={<span className="the-actions" />}
            />,
        );
        expect(
            host.querySelector('.color-note')!.getAttribute('data-default'),
        ).toBe(DEFAULT_BIBLE_COLOR_NOTE);
        const pill = host.querySelector('.bible-key-pill')!;
        expect(pill.getAttribute('data-bible-key')).toBe('KJV');
        expect(pill.getAttribute('data-menu-title')).toBe('Add Extra Bible');
        const reference = host.querySelector('.bible-view-reference')!;
        expect(
            Array.from(reference.children).map((child) => child.className),
        ).toEqual(['the-title', 'the-actions']);
        // One view alone in its colour has nobody to scroll along with.
        expect(host.querySelector('.bible-view-sync-scroll')).toBeNull();
        expect(host.querySelector('.bible-extra-key')).toBeNull();
    });

    test('the colour dot reads and sets this view’s colour', async () => {
        const bibleItem = genBibleItem();
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const readButton = host.querySelector<HTMLElement>('.read-color')!;
        await press(readButton);
        expect(readButton.dataset.read).toBe('#ff0000');
        expect(h.viewController.getColorNote).toHaveBeenCalledWith(bibleItem);

        await press(host.querySelector('.set-color'));
        expect(h.viewController.setColorNote).toHaveBeenCalledWith(
            bibleItem,
            '#00ff00',
        );
    });

    test('a colour group can switch its scrolling together on, and catches up at once', async () => {
        const bibleItem = genBibleItem();
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([
            bibleItem,
            genBibleItem(),
        ]);
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const syncButton = host.querySelector('.bible-view-sync-scroll')!;
        expect(h.viewController.getBibleItemsByColorNote).toHaveBeenCalledWith(
            '#ff0000',
        );
        expect(syncButton.getAttribute('title')).toBe(
            'Enable group sync scrolling',
        );
        expect(syncButton.getAttribute('aria-label')).toBe(
            'Sync group scrolling',
        );
        expect(syncButton.getAttribute('aria-pressed')).toBe('false');

        await press(syncButton);
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
            true,
        );
        expect(h.viewController.groupScrollSync.syncFrom).toHaveBeenCalledWith(
            host.querySelector('[data-scroll-verses-container]'),
        );
    });

    test('a group already scrolling together switches it off, with nothing to catch up', async () => {
        const bibleItem = genBibleItem();
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([
            bibleItem,
            genBibleItem(),
        ]);
        h.viewController.getIsGroupScrollSynced.mockReturnValue(true);
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const syncButton = host.querySelector('.bible-view-sync-scroll')!;
        expect(syncButton.getAttribute('title')).toBe(
            'Disable group sync scrolling',
        );
        expect(syncButton.getAttribute('aria-pressed')).toBe('true');
        await press(syncButton);
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
            false,
        );
        expect(
            h.viewController.groupScrollSync.syncFrom,
        ).not.toHaveBeenCalled();
    });

    test('switching sync on outside a bible view has nothing to catch up from', async () => {
        const bibleItem = genBibleItem();
        h.viewController.getColorNote.mockReturnValue('#ff0000');
        h.viewController.getBibleItemsByColorNote.mockReturnValue([
            bibleItem,
            genBibleItem(),
        ]);
        await act(async () => {
            root.render(
                <BibleViewTitleMaterialContext value={{ titleElement: null }}>
                    <RenderTitleMaterialComp bibleItem={bibleItem} />
                </BibleViewTitleMaterialContext>,
            );
        });
        await press(host.querySelector('.bible-view-sync-scroll'));
        expect(h.viewController.setIsGroupScrollSynced).toHaveBeenCalledWith(
            '#ff0000',
            true,
        );
        expect(
            h.viewController.groupScrollSync.syncFrom,
        ).not.toHaveBeenCalled();
    });

    test('each extra bible is a chip that removes it, by mouse or keyboard', async () => {
        const bibleItem = genBibleItem(['NIV', 'TQAM']);
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const chipList = Array.from(
            host.querySelectorAll<HTMLElement>('.bible-extra-key'),
        );
        expect(
            chipList.map((chip) => {
                return [
                    chip.textContent,
                    chip.getAttribute('aria-label'),
                    chip.getAttribute('role'),
                    chip.getAttribute('tabindex'),
                    chip.style.fontFamily,
                ];
            }),
        ).toEqual([
            [
                'NIV',
                'Click to remove extra Bible NIV',
                'button',
                '0',
                'Font NIV',
            ],
            [
                'TQAM',
                'Click to remove extra Bible TQAM',
                'button',
                '0',
                'Font TQAM',
            ],
        ]);

        await press(chipList[0]);
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { extraBibleKeys: ['TQAM'] },
        );

        await act(async () => {
            chipList[1].dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
        expect(h.pressElementLikeButton.mock.calls[0][0].key).toBe('Enter');
    });
});

describe('AudioAIEnablingComp in the title', () => {
    test('is not drawn where bible audio cannot be had', async () => {
        h.isAudioAvailable = false;
        await renderInView(
            <RenderTitleMaterialComp bibleItem={genBibleItem()} />,
        );
        expect(host.querySelector('.bi-soundwave')).toBeNull();
    });

    test('says whether it is on, and turns it the other way', async () => {
        const bibleItem = genBibleItem();
        h.isAudioEnabled = true;
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const toggle = host.querySelector<HTMLElement>('.bi-soundwave')!;
        expect(toggle.getAttribute('aria-label')).toBe('Toggle Bible Audio');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.getAttribute('role')).toBe('button');
        expect(toggle.style.color).toBe('green');

        await press(toggle);
        expect(h.checkIsAIAudioAvailableForBible).toHaveBeenCalledWith(
            bibleItem,
        );
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { isAudioEnabled: false },
        );
    });

    test('off, it turns on, and a key press reaches it', async () => {
        const bibleItem = genBibleItem();
        await renderInView(<RenderTitleMaterialComp bibleItem={bibleItem} />);
        const toggle = host.querySelector<HTMLElement>('.bi-soundwave')!;
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.style.color).toBe('');
        await press(toggle);
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { isAudioEnabled: true },
        );
        await act(async () => {
            toggle.dispatchEvent(
                new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
    });
});

describe('BibleViewHeaderComp answers its title row', () => {
    test("a plain view's version pill changes its own bible, or adds one beside it", async () => {
        const bibleItem = genBibleItem(['ESV']);
        await renderInView(
            <BibleViewHeaderComp bibleItem={bibleItem} isEditing={false} />,
        );
        await press(host.querySelector('.pick-bible'));
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenLastCalledWith(
            bibleItem,
            { bibleKey: 'NIV' },
        );
        await press(host.querySelector('.add-extra-bible'));
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenLastCalledWith(
            bibleItem,
            { extraBibleKeys: ['ESV', 'NIV'] },
        );
    });

    test('the editing view answers for the item selected in the lookup', async () => {
        const shownItem = genBibleItem();
        await renderInView(
            <BibleViewHeaderComp bibleItem={shownItem} isEditing />,
        );
        await press(host.querySelector('.add-extra-bible'));
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            h.viewController.selectedBibleItem,
            { extraBibleKeys: ['ESV', 'NIV'] },
        );
    });

    test("a plain view's close removes that view", async () => {
        const bibleItem = genBibleItem();
        await renderInView(
            <BibleViewHeaderComp bibleItem={bibleItem} isEditing={false} />,
        );
        await press(host.querySelector('.bible-view-header-close'));
        expect(h.viewController.deleteBibleItem).toHaveBeenCalledWith(
            bibleItem,
        );
        expect(h.closeCurrentEditingBibleItem).not.toHaveBeenCalled();
    });

    test("the editing view's close closes the lookup's editing", async () => {
        h.editingResult = { result: { bibleItem: genBibleItem() } };
        await renderInView(
            <BibleViewHeaderComp bibleItem={genBibleItem()} isEditing />,
        );
        const close = host.querySelector('.bible-view-header-close')!;
        expect(close.getAttribute('title')).toBe('Close [Ctrl+W]');
        await press(close);
        expect(h.closeCurrentEditingBibleItem).toHaveBeenCalledWith(
            h.viewController,
        );
        expect(h.viewController.deleteBibleItem).not.toHaveBeenCalled();
    });
});
