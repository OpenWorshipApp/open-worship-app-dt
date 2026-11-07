// @vitest-environment jsdom

/**
 * The bible lookup's toolbar pieces, driven through their DOM: a view's action
 * buttons and the editing view's (with their keyboard shortcuts), the body
 * previewer's per-view renderer, the Bible Information button and popup, the
 * header with its right-hand buttons, the lookup popup and the Word export.
 * The controller, the keyboard registry and every child that is another
 * feature's own component are this file's mocks.
 */

import type { ReactNode } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const realSetImmediate = globalThis.setImmediate.bind(globalThis);

const h = vi.hoisted(() => ({
    page: {
        isPagePresenter: false,
        isPageAppDocumentEditor: false,
        isPageReader: false,
    },
    settings: {} as Record<string, string>,
    isAIEnabled: true,
    viewController: {} as any,
    editingResult: null as any,
    previewItems: [] as any[],
    hideBibleLookupPopup: null as null | (() => void),
    keyboardEntries: new Set<{
        mappers: any[];
        layer: unknown;
        fire: (event: any) => void;
    }>(),
    lastPreviewFullSizeProps: null as any,
    lastBibleReaderProps: null as any,
    openExternalURL: vi.fn(),
    exportToWordDocument: vi.fn(),
    saveBibleItem: vi.fn(),
    addBibleItemAndPresent: vi.fn(),
    showAddingBibleItemFail: vi.fn(),
    showAppContextMenu: vi.fn(),
    genBibleItemCopyingContextMenu: vi.fn(),
    handleError: vi.fn(),
    insertBibleItem: vi.fn(),
    openChatbotWithBibleItem: vi.fn(),
    setBibleLookupInputFocus: vi.fn(),
    useNextEditingBibleItem: vi.fn(),
    useCloseBibleItemRenderer: vi.fn(),
    getBibleInfo: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        presenterHomePage: '/presenter.html',
        browserUtils: { openExternalURL: h.openExternalURL },
        get isPagePresenter() {
            return h.page.isPagePresenter;
        },
        get isPageAppDocumentEditor() {
            return h.page.isPageAppDocumentEditor;
        },
        get isPageReader() {
            return h.page.isPageReader;
        },
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/loggerHelpers', () => ({
    appError: () => {},
    appWarning: () => {},
    appLog: () => {},
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    getLanguageTitle: ({ locale }: { locale: string }) => `Lang(${locale})`,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    exportToWordDocument: h.exportToWordDocument,
    saveBibleItem: h.saveBibleItem,
}));
vi.mock('../bible-list/bibleItemHelpers', () => ({
    genBibleItemCopyingContextMenu: h.genBibleItemCopyingContextMenu,
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => {
    const splitHorizontalEventMapper = {
        allControlKey: ['Ctrl', 'Shift'],
        key: 's',
    };
    const splitVerticalEventMapper = {
        allControlKey: ['Ctrl', 'Shift'],
        key: 'v',
    };
    return {
        splitHorizontalEventMapper,
        splitVerticalEventMapper,
        splitEventMappers: [
            splitHorizontalEventMapper,
            splitVerticalEventMapper,
        ],
        useLookupBibleItemControllerContext: () => h.viewController,
        useEditingResult: () => h.editingResult,
    };
});
vi.mock('./bibleActionHelpers', () => ({
    addBibleItemAndPresent: h.addBibleItemAndPresent,
    showAddingBibleItemFail: h.showAddingBibleItemFail,
    ctrlEnterEventMapper: { allControlKey: ['Ctrl'], key: 'Enter' },
    ctrlShiftEnterEventMapper: {
        allControlKey: ['Ctrl', 'Shift'],
        key: 'Enter',
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuEventHelpers', () => ({
    createMouseEventUnder: (element: HTMLElement) => ({
        isMouseEventUnder: element,
    }),
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('../helper/ai/bibleItemAskHelpers', () => ({
    openChatbotWithBibleItem: h.openChatbotWithBibleItem,
}));
vi.mock('../slide-editor/canvas/canvasBibleItemHelpers', () => ({
    CanvasBibleItemEventListener: { insertBibleItem: h.insertBibleItem },
}));
// The registry, reduced to what these components rely on: every registration
// stays live while its component is mounted and calls its latest listener.
vi.mock('../event/KeyboardEventListener', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        toShortcutKey: (mapper: any) => {
            return [...(mapper.allControlKey ?? []), mapper.key].join('+');
        },
        useKeyboardRegistering: (
            mappers: any[],
            listener: (event: any) => void,
            _deps: unknown[],
            layer?: unknown,
        ) => {
            const listenerRef = useRef(listener);
            listenerRef.current = listener;
            useEffect(() => {
                const entry = {
                    mappers,
                    layer,
                    fire: (event: any) => listenerRef.current(event),
                };
                h.keyboardEntries.add(entry);
                return () => {
                    h.keyboardEntries.delete(entry);
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
        },
    };
});
vi.mock('../app-modal/ModalComp', () => ({
    MODAL_KEYBOARD_LAYER: 'modal-layer',
    ModalComp: ({ children }: { children: ReactNode }) => {
        return <div className="ut-modal">{children}</div>;
    },
    ModalCloseButtonComp: ({ close }: { close: () => void }) => {
        return (
            <button className="ut-modal-close" onClick={close}>
                close
            </button>
        );
    },
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: h.getBibleInfo,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey}-font`,
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (name: string) => h.settings[name],
        useStateSettingBoolean: (name: string, defaultValue: boolean) => {
            const stored = h.settings[name];
            const [value, setValue] = useState(
                stored === undefined ? defaultValue : stored === 'true',
            );
            return [
                value,
                (newValue: boolean) => {
                    h.settings[name] = `${newValue}`;
                    setValue(newValue);
                },
            ];
        },
    };
});
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.hideBibleLookupPopup,
    QuitCurrentPageComp: ({ title, pathname }: any) => {
        return (
            <button className="ut-quit" data-pathname={pathname}>
                {title}
            </button>
        );
    },
    SettingButtonComp: () => <button className="ut-setting" />,
    ChatbotButtonComp: () => <button className="ut-chatbot" />,
    AiChatButtonComp: () => <button className="ut-aichat" />,
    HelpButtonComp: () => <button className="ut-help" />,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="ut-loading">loading</div>,
}));
vi.mock('../bible-reader/readBibleHelpers', () => ({
    useNextEditingBibleItem: h.useNextEditingBibleItem,
    useCloseBibleItemRenderer: h.useCloseBibleItemRenderer,
}));
vi.mock('./selectionHelpers', () => ({
    setBibleLookupInputFocus: h.setBibleLookupInputFocus,
}));
vi.mock('../bible-reader/BiblePreviewerRenderComp', () => ({
    default: () => {
        return (
            <>
                {h.previewItems.map((bibleItem) => {
                    return (
                        <div key={bibleItem.id} className="ut-preview-item">
                            {h.viewController.finalRenderer(bibleItem)}
                        </div>
                    );
                })}
            </>
        );
    },
}));
vi.mock('../bible-reader/BibleViewComp', async () => {
    const { useBibleViewTitleMaterialContext } =
        await import('../bible-reader/view-extra/viewExtraHelpers');
    return {
        default: ({ bibleItem, isEditing }: any) => {
            const { titleElement, actionElement } =
                useBibleViewTitleMaterialContext();
            return (
                <div
                    className="ut-view"
                    data-editing={`${isEditing}`}
                    data-key={bibleItem.bibleKey}
                >
                    <div className="ut-view-title">{titleElement}</div>
                    <div className="ut-view-action">{actionElement}</div>
                </div>
            );
        },
    };
});
vi.mock('../bible-reader/view-extra/BibleViewTitleEditingComp', () => ({
    BibleViewTitleEditingComp: ({ bibleItem, onTargetChange }: any) => {
        return (
            <button
                className="ut-title-editing"
                onClick={() => {
                    onTargetChange({
                        bookKey: 'GEN',
                        chapter: 2,
                        verseStart: 1,
                        verseEnd: 3,
                    });
                }}
            >
                {bibleItem.title}
            </button>
        );
    },
}));
vi.mock('../bible-reader/view-extra/BibleViewTitleWrapperComp', () => ({
    default: ({ bibleKey, children }: any) => {
        return (
            <span className="ut-title-wrapper" data-key={bibleKey}>
                {children}
            </span>
        );
    },
}));
vi.mock('./InputHandlerComp', () => ({
    default: ({ onBibleKeyChange }: any) => {
        return (
            <button
                className="ut-input-handler"
                onClick={() => {
                    onBibleKeyChange('KJV', 'NIV');
                }}
            />
        );
    },
}));
vi.mock('./BibleLookupInputHistoryComp', () => ({
    default: () => <div className="ut-history" />,
}));
vi.mock('../location-name-lookup/LocationNameLookupToggleComp', () => ({
    default: () => <div className="ut-location-toggle" />,
}));
vi.mock('./PreviewFullSizeButtonComp', () => ({
    default: (props: any) => {
        h.lastPreviewFullSizeProps = props;
        return <div className="ut-preview-full-size" />;
    },
}));
vi.mock('./RenderOpenWikiDictionaryComp', () => ({
    default: () => <button className="ut-wiki" />,
}));
vi.mock('../bible-reader/BibleReaderComp', () => ({
    default: (props: any) => {
        h.lastBibleReaderProps = props;
        return <div className="ut-bible-reader" />;
    },
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: {
        bibleLookupPopup: 'bible-lookup-popup',
        bibleReadingLeftLookup: 'bible-reading-left-lookup',
    },
}));

import RenderActionButtonsComp from './RenderActionButtonsComp';
import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';
import BibleLookupBodyPreviewerComp from './BibleLookupBodyPreviewerComp';
import BibleInfoButtonComp from './BibleInfoButtonComp';
import BibleInfoPopupComp from './BibleInfoPopupComp';
import RenderExtraButtonsRightComp, {
    getIsKeepingPopup,
} from './RenderExtraButtonsRightComp';
import RenderBibleLookupHeaderComp from './RenderBibleLookupHeaderComp';
import BibleLookupPopupComp from './BibleLookupPopupComp';
import RenderExportWordComp from './RenderExportWordComp';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush(times = 4) {
    for (let i = 0; i < times; i++) {
        await act(async () => {
            await new Promise((resolve) => {
                realSetImmediate(resolve);
            });
        });
    }
}

async function render(node: ReactNode) {
    if (root === null) {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    }
    await act(async () => {
        root!.render(node);
    });
    await flush();
}

async function unmount() {
    if (root !== null) {
        const oldRoot = root;
        root = null;
        await act(async () => {
            oldRoot.unmount();
        });
    }
}

async function press(element: Element | null | undefined) {
    expect(element).toBeTruthy();
    await act(async () => {
        (element as HTMLElement).click();
    });
    await flush();
}

function query(selector: string) {
    return container!.querySelector(selector);
}

function byLabel(label: string) {
    return container!.querySelector(
        `[aria-label="${label}"]`,
    ) as HTMLElement | null;
}

function labels() {
    return [...container!.querySelectorAll('button[aria-label]')].map(
        (button) => button.getAttribute('aria-label'),
    );
}

async function fireKey(key: string, isShift: boolean, event: any = {}) {
    const entries = [...h.keyboardEntries].filter(({ mappers }) => {
        return mappers.some((mapper) => {
            return (
                mapper.key.toLowerCase() === key.toLowerCase() &&
                (mapper.allControlKey ?? []).includes('Shift') === isShift
            );
        });
    });
    await act(async () => {
        for (const entry of entries) {
            entry.fire({ key, preventDefault: vi.fn(), ...event });
        }
    });
    await flush();
    return entries.length;
}

function genViewController() {
    return {
        isMinimized: false,
        isLookup: true,
        extraActionButtons: <span className="ut-extra-action" />,
        extraEditingActionButtons: <span className="ut-extra-editing" />,
        splitBibleItemOnPress: vi.fn(),
        checkIsSplitAskingBibleKey: vi.fn((_item: any) => false),
        onLookupSaveBibleItem: vi.fn(),
        applyTargetOrBibleKey: vi.fn(),
        editBibleItem: vi.fn(),
        checkIsBibleItemSelected: vi.fn((_item: any) => false),
        getBibleItemsForExportingMSWord: vi.fn(async () => [] as any[]),
        selectedBibleItem: null as any,
        finalRenderer: null as any,
    };
}

const bibleItem = { id: 7, bibleKey: 'KJV', title: 'John 3:16' } as any;

beforeEach(() => {
    h.page.isPagePresenter = false;
    h.page.isPageAppDocumentEditor = false;
    h.page.isPageReader = false;
    h.settings = {};
    h.isAIEnabled = true;
    h.viewController = genViewController();
    h.editingResult = null;
    h.previewItems = [];
    h.hideBibleLookupPopup = null;
    h.keyboardEntries.clear();
    h.lastPreviewFullSizeProps = null;
    h.lastBibleReaderProps = null;
    h.genBibleItemCopyingContextMenu.mockReturnValue([
        { menuElement: 'Copy reference' },
    ]);
    h.openChatbotWithBibleItem.mockResolvedValue(undefined);
    h.saveBibleItem.mockResolvedValue(bibleItem);
});

afterEach(async () => {
    await unmount();
    container?.remove();
    container = null;
});

describe('RenderActionButtonsComp', () => {
    it('acts on the view it belongs to from every presenter button', async () => {
        h.page.isPagePresenter = true;
        await render(<RenderActionButtonsComp bibleItem={bibleItem} />);
        expect(labels()).toEqual([
            'Copy',
            'Split horizontal',
            'Split vertical',
            'Save bible item',
            'Save bible item and show on screen',
            'Export to MS Word',
            'Ask the Assistant About This Passage',
        ]);
        expect(query('.ut-extra-action')).not.toBeNull();
        expect(byLabel('Split horizontal')?.hasAttribute('aria-haspopup')).toBe(
            false,
        );

        await press(byLabel('Copy'));
        expect(h.genBibleItemCopyingContextMenu).toHaveBeenCalledWith(
            bibleItem,
        );
        expect(h.showAppContextMenu.mock.calls[0][1]).toEqual([
            { menuElement: 'Copy reference' },
        ]);

        await press(byLabel('Split horizontal'));
        await press(byLabel('Split vertical'));
        const splitCalls = h.viewController.splitBibleItemOnPress.mock.calls;
        expect(splitCalls.map((call: any[]) => call.slice(1))).toEqual([
            [bibleItem, true],
            [bibleItem, false],
        ]);

        await press(byLabel('Save bible item'));
        expect(h.saveBibleItem.mock.calls[0][0]).toBe(bibleItem);
        h.saveBibleItem.mock.calls[0][1]();
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(1);

        await press(byLabel('Save bible item and show on screen'));
        expect(h.addBibleItemAndPresent.mock.calls[0][1]).toBe(bibleItem);
        h.addBibleItemAndPresent.mock.calls[0][2]();
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(2);

        await press(byLabel('Export to MS Word'));
        expect(h.exportToWordDocument).toHaveBeenCalledWith([bibleItem]);

        await press(byLabel('Ask the Assistant About This Passage'));
        expect(h.openChatbotWithBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    it('inserts into the selected slide in the slide editor', async () => {
        h.page.isPageAppDocumentEditor = true;
        await render(<RenderActionButtonsComp bibleItem={bibleItem} />);
        expect(byLabel('Save bible item and show on screen')).toBeNull();
        await press(byLabel('Insert bible item into selected slide'));
        expect(h.insertBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(1);
    });

    it('hands a failing assistant handoff to the error handler', async () => {
        const error = new Error('no assistant');
        h.openChatbotWithBibleItem.mockRejectedValue(error);
        await render(<RenderActionButtonsComp bibleItem={bibleItem} />);
        await press(byLabel('Ask the Assistant About This Passage'));
        expect(h.handleError).toHaveBeenCalledWith(error);
    });

    it('asks for a version in a grouped view, and keeps only the split buttons minimized', async () => {
        h.viewController.checkIsSplitAskingBibleKey.mockReturnValue(true);
        h.viewController.isMinimized = true;
        h.isAIEnabled = false;
        await render(<RenderActionButtonsComp bibleItem={bibleItem} />);
        expect(labels()).toEqual([
            'Copy',
            'Split Horizontal to',
            'Split Vertical to',
        ]);
        expect(
            byLabel('Split Vertical to')?.getAttribute('aria-haspopup'),
        ).toBe('menu');
        expect(
            h.viewController.checkIsSplitAskingBibleKey,
        ).toHaveBeenCalledWith(bibleItem);

        h.viewController = genViewController();
        h.viewController.isLookup = false;
        await render(<RenderActionButtonsComp bibleItem={{ ...bibleItem }} />);
        expect(byLabel('Save bible item')).toBeNull();
    });
});

describe('RenderEditingActionButtonsComp', () => {
    it('names its shortcuts and acts from every button', async () => {
        h.page.isPagePresenter = true;
        h.page.isPageAppDocumentEditor = true;
        await render(<RenderEditingActionButtonsComp bibleItem={bibleItem} />);
        expect(labels()).toEqual([
            'Copy',
            'Split horizontal',
            'Split vertical',
            'Save bible item',
            'Save bible item and show on screen',
            'Insert bible item into selected slide',
            'Export to MS Word',
            'Ask the Assistant About This Passage',
        ]);
        expect(byLabel('Split horizontal')?.getAttribute('title')).toBe(
            'Split horizontal [Ctrl+Shift+s]',
        );
        expect(byLabel('Save bible item')?.getAttribute('title')).toBe(
            'Save bible item [Ctrl+Enter]',
        );
        expect(
            byLabel('Insert bible item into selected slide')?.getAttribute(
                'title',
            ),
        ).toBe('Insert bible item into selected slide [Ctrl+Shift+Enter]');
        expect(query('.ut-extra-editing')).not.toBeNull();

        await press(byLabel('Split horizontal'));
        await press(byLabel('Split vertical'));
        expect(
            h.viewController.splitBibleItemOnPress.mock.calls.map(
                (call: any[]) => call.slice(1),
            ),
        ).toEqual([
            [bibleItem, true],
            [bibleItem, false],
        ]);
        await press(byLabel('Save bible item'));
        expect(h.saveBibleItem.mock.calls[0][0]).toBe(bibleItem);
        h.saveBibleItem.mock.calls[0][1]();
        await press(byLabel('Save bible item and show on screen'));
        expect(h.addBibleItemAndPresent.mock.calls[0][1]).toBe(bibleItem);
        h.addBibleItemAndPresent.mock.calls[0][2]();
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(2);
        await press(byLabel('Insert bible item into selected slide'));
        expect(h.insertBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(3);
        await press(byLabel('Export to MS Word'));
        expect(h.exportToWordDocument).toHaveBeenCalledWith([bibleItem]);
    });

    it('saves on Ctrl+Enter and says so when the save fails', async () => {
        await render(<RenderEditingActionButtonsComp bibleItem={bibleItem} />);
        expect(await fireKey('Enter', false)).toBe(1);
        expect(h.saveBibleItem.mock.calls[0][0]).toBe(bibleItem);
        h.saveBibleItem.mock.calls[0][1]();
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(1);
        expect(h.showAddingBibleItemFail).not.toHaveBeenCalled();

        h.saveBibleItem.mockResolvedValue(null);
        await fireKey('Enter', false);
        expect(h.showAddingBibleItemFail).toHaveBeenCalledTimes(1);
    });

    it('presents and inserts on Ctrl+Shift+Enter only on the page that has each', async () => {
        h.page.isPagePresenter = true;
        h.page.isPageAppDocumentEditor = true;
        await render(<RenderEditingActionButtonsComp bibleItem={bibleItem} />);
        const event = { isShortcutEvent: true };
        expect(await fireKey('Enter', true, event)).toBe(2);
        expect(h.addBibleItemAndPresent).toHaveBeenCalledTimes(1);
        expect(h.addBibleItemAndPresent.mock.calls[0][0]).toMatchObject(event);
        expect(h.addBibleItemAndPresent.mock.calls[0][1]).toBe(bibleItem);
        h.addBibleItemAndPresent.mock.calls[0][2]();
        expect(h.insertBibleItem).toHaveBeenCalledWith(bibleItem);
        expect(h.viewController.onLookupSaveBibleItem).toHaveBeenCalledTimes(2);

        // The same buttons stay mounted; the page they act for is gone.
        h.page.isPagePresenter = false;
        h.page.isPageAppDocumentEditor = false;
        await fireKey('Enter', true);
        expect(h.addBibleItemAndPresent).toHaveBeenCalledTimes(1);
        expect(h.insertBibleItem).toHaveBeenCalledTimes(1);
    });

    it('hangs a split asked from the keyboard under the button of that split', async () => {
        await render(<RenderEditingActionButtonsComp bibleItem={bibleItem} />);
        const preventDefault = vi.fn();
        await fireKey('S', true, { preventDefault });
        expect(preventDefault).toHaveBeenCalledTimes(1);
        await fireKey('v', true);
        const calls = h.viewController.splitBibleItemOnPress.mock.calls;
        expect(calls[0]).toEqual([
            { isMouseEventUnder: byLabel('Split horizontal') },
            bibleItem,
            true,
        ]);
        expect(calls[1]).toEqual([
            { isMouseEventUnder: byLabel('Split vertical') },
            bibleItem,
            false,
        ]);
    });

    it('keeps only copy, split and ask while minimized', async () => {
        h.viewController.isMinimized = true;
        await render(<RenderEditingActionButtonsComp bibleItem={bibleItem} />);
        expect(labels()).toEqual([
            'Copy',
            'Split horizontal',
            'Split vertical',
            'Ask the Assistant About This Passage',
        ]);
    });
});

describe('BibleLookupBodyPreviewerComp', () => {
    const plainItem = { id: 1, bibleKey: 'KJV', title: 'Genesis 1:1' };
    const editingItem = { id: 2, bibleKey: 'NIV', title: 'John 3:16' };
    const selectedItem = { id: 3, bibleKey: 'ESV', title: 'Selected' };
    const foundItem = { id: 4, bibleKey: 'NIV', title: 'John 3:17' };
    const newTarget = {
        bookKey: 'GEN',
        chapter: 2,
        verseStart: 1,
        verseEnd: 3,
    };

    async function renderPreviewer() {
        h.previewItems = [plainItem, editingItem];
        h.viewController.selectedBibleItem = selectedItem;
        h.viewController.checkIsBibleItemSelected.mockImplementation(
            (item: any) => item === editingItem,
        );
        await render(<BibleLookupBodyPreviewerComp />);
        return [...container!.querySelectorAll('.ut-view')] as HTMLElement[];
    }

    it('renders every view through its own renderer, editing or not', async () => {
        h.editingResult = {
            result: { bibleItem: foundItem },
            oldInputText: 'Jn 3:17',
        };
        const [plainView, editingView] = await renderPreviewer();
        expect(h.useNextEditingBibleItem).toHaveBeenCalled();
        expect(h.useCloseBibleItemRenderer).toHaveBeenCalled();
        expect([plainView.dataset.editing, plainView.dataset.key]).toEqual([
            'false',
            'KJV',
        ]);
        // The editing view shows the selected item, titled by what is found.
        expect([editingView.dataset.editing, editingView.dataset.key]).toEqual([
            'true',
            'ESV',
        ]);
        expect(plainView.querySelector('.ut-title-editing')?.textContent).toBe(
            'Genesis 1:1',
        );
        expect(
            editingView.querySelector('.ut-title-editing')?.textContent,
        ).toBe('John 3:17');

        const pencil = plainView.querySelector('.bible-view-header-edit')!;
        expect(pencil.getAttribute('title')).toBe('Click to edit this section');
        await press(pencil);
        expect(h.viewController.editBibleItem).toHaveBeenCalledWith(plainItem);
        const back = editingView.querySelector('.bible-view-header-edit')!;
        expect(back.getAttribute('title')).toBe(
            'Hit "Escape" to jump back to editing input',
        );
        await press(back);
        expect(h.setBibleLookupInputFocus).toHaveBeenCalledTimes(1);

        await press(plainView.querySelector('.ut-title-editing'));
        await press(editingView.querySelector('.ut-title-editing'));
        expect(h.viewController.applyTargetOrBibleKey.mock.calls).toEqual([
            [plainItem, { target: newTarget }],
            [foundItem, { target: newTarget }],
        ]);
    });

    it('titles the editing view with what was typed until it finds a passage', async () => {
        h.editingResult = {
            result: { bibleItem: null },
            oldInputText: 'Jn 3:',
        };
        const [, editingView] = await renderPreviewer();
        const wrapper = editingView.querySelector('.ut-title-wrapper')!;
        expect(wrapper.getAttribute('data-key')).toBe('ESV');
        expect(wrapper.textContent).toBe('Jn 3:');
        expect(editingView.querySelector('.bible-view-header-edit')).toBeNull();

        h.editingResult = null;
        await render(<BibleLookupBodyPreviewerComp />);
        const view = container!.querySelectorAll('.ut-view')[1];
        expect(view.querySelector('.ut-title-wrapper')?.textContent).toBe('');
    });
});

describe('BibleInfoButtonComp and BibleInfoPopupComp', () => {
    const bibleInfo = {
        title: 'King James Version',
        key: 'KJV',
        version: 2,
        locale: 'en-US',
        publisher: '',
        copyRights: 'Public domain, see https://example.org/kjv.',
        legalNote: undefined,
        description: 'The 1611 text',
        booksAvailable: ['GEN', 'EXO'],
    };

    it('reads the bible info only once opened, and lists what it holds', async () => {
        let release: (value: unknown) => void = () => {};
        h.getBibleInfo.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );
        await render(<BibleInfoButtonComp bibleKey="KJV" />);
        expect(h.getBibleInfo).not.toHaveBeenCalled();
        expect(query('.ut-modal')).toBeNull();
        await press(byLabel('Bible Information'));
        expect(h.getBibleInfo).toHaveBeenCalledWith('KJV');
        const dialog = query('[role="dialog"]') as HTMLElement;
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        const titleId = dialog.getAttribute('aria-labelledby')!;
        expect(document.getElementById(titleId)?.textContent).toBe(
            'Bible Information',
        );
        expect(query('.app-popup-body')?.textContent).toBe('Loading...');

        release(bibleInfo);
        await flush();
        const cells = [...query('.app-popup-body > div')!.children];
        const rows: string[][] = [];
        for (let i = 0; i < cells.length; i += 2) {
            rows.push([cells[i].textContent!, cells[i + 1].textContent!]);
        }
        expect(rows).toEqual([
            ['Title', 'King James Version'],
            ['Key', 'KJV'],
            ['Version', '2'],
            ['Locale', 'Lang(en-US) (en-US)'],
            ['Copy Rights', 'Public domain, see https://example.org/kjv.'],
            ['Description', 'The 1611 text'],
            ['Books', '2'],
        ]);
        const versionValue = cells[5] as HTMLElement;
        expect(versionValue.className).toBe('app-data');
        expect(versionValue.style.fontFamily).toBe('');
        expect((cells[1] as HTMLElement).style.fontFamily).toBe('KJV-font');

        const link = query('.app-popup-body a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('https://example.org/kjv');
        expect(link.getAttribute('draggable')).toBe('false');
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            link.dispatchEvent(click);
        });
        expect(click.defaultPrevented).toBe(true);
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://example.org/kjv',
        );

        await press(byLabel('Close'));
        expect(query('[role="dialog"]')).toBeNull();
    });

    it('closes on Escape from its own keyboard layer', async () => {
        h.getBibleInfo.mockResolvedValue(null);
        const close = vi.fn();
        await render(<BibleInfoPopupComp bibleKey="KJV" close={close} />);
        expect(query('.app-popup-body')?.textContent).toBe('No Data');
        const escape = [...h.keyboardEntries].find(({ mappers }) => {
            return mappers[0].key === 'Escape';
        })!;
        expect(escape.layer).toBe('modal-layer');
        const preventDefault = vi.fn();
        escape.fire({ preventDefault });
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('leaves out the rows a bible does not fill, and counts no books as 0', async () => {
        h.getBibleInfo.mockResolvedValue({
            title: 'Untitled',
            key: 'UNK',
            locale: '',
        });
        await render(<BibleInfoPopupComp bibleKey="UNK" close={vi.fn()} />);
        const labelCells = [
            ...query('.app-popup-body > div')!.querySelectorAll('.text-muted'),
        ].map((cell) => cell.textContent);
        expect(labelCells).toEqual(['Title', 'Key', 'Books']);
    });
});

describe('RenderExtraButtonsRightComp', () => {
    it('keeps the popup open on the reader, and on other pages as the setting says', () => {
        h.page.isPageReader = true;
        expect(getIsKeepingPopup()).toBe(true);
        h.page.isPageReader = false;
        expect(getIsKeepingPopup()).toBe(false);
        h.settings['close-on-add-bible-item'] = 'true';
        expect(getIsKeepingPopup()).toBe(true);
    });

    it('offers Keep Open in the presenter and toggles it from the box or its words', async () => {
        h.page.isPagePresenter = true;
        const toggleAdvanceLookup = vi.fn();
        await render(
            <RenderExtraButtonsRightComp
                toggleAdvanceLookup={toggleAdvanceLookup}
                isAdvanceLookupOpened={false}
            >
                <button className="ut-child" />
            </RenderExtraButtonsRightComp>,
        );
        const checkbox = byLabel('Keep Open') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
        await press(checkbox);
        expect(checkbox.checked).toBe(true);
        expect(h.settings['close-on-add-bible-item']).toBe('true');
        expect(getIsKeepingPopup()).toBe(true);
        await press(query('.input-group-text span'));
        expect(checkbox.checked).toBe(false);
        expect(h.settings['close-on-add-bible-item']).toBe('false');

        const group = query('[role="group"]')!;
        expect(group.firstElementChild?.className).toBe('ut-child');
        const advance = byLabel('Advance Bible Lookup')!;
        expect(advance.className).toBe('btn btn-sm btn-outline-info');
        expect(advance.getAttribute('aria-pressed')).toBe('false');
        await press(advance);
        expect(toggleAdvanceLookup).toHaveBeenCalledTimes(1);
        expect(query('.ut-quit')).toBeNull();
    });

    it("adds the reader's own page buttons and no Keep Open there", async () => {
        h.page.isPageReader = true;
        await render(
            <RenderExtraButtonsRightComp
                toggleAdvanceLookup={vi.fn()}
                isAdvanceLookupOpened
            />,
        );
        expect(byLabel('Keep Open')).toBeNull();
        const advance = byLabel('Advance Bible Lookup')!;
        expect(advance.className).toBe('btn btn-sm btn-info');
        expect(advance.getAttribute('aria-pressed')).toBe('true');
        const quit = query('.ut-quit') as HTMLElement;
        expect(quit.textContent).toBe('Go Back to Presenter');
        expect(quit.dataset.pathname).toBe('/presenter.html');
        for (const selector of [
            '.ut-setting',
            '.ut-chatbot',
            '.ut-aichat',
            '.ut-help',
        ]) {
            expect(query(selector)).not.toBeNull();
        }
    });
});

describe('RenderBibleLookupHeaderComp', () => {
    function genHeader() {
        return (
            <RenderBibleLookupHeaderComp
                flexSizeName="lookup-flex"
                sideWidgetKeys={['h1', 'h3', 'advance']}
                toggleAdvanceLookup={vi.fn()}
                isAdvanceLookupOpened={false}
            />
        );
    }

    it('lays out history, input, toggles and the right-hand buttons, and closes the popup', async () => {
        h.page.isPagePresenter = true;
        h.hideBibleLookupPopup = vi.fn();
        h.viewController.selectedBibleItem = bibleItem;
        const exported = [{ id: 1 }, { id: 2 }];
        h.viewController.getBibleItemsForExportingMSWord.mockResolvedValue(
            exported,
        );
        await render(genHeader());
        expect(query('.ut-history')).not.toBeNull();
        expect(query('.ut-location-toggle')).not.toBeNull();
        expect(h.lastPreviewFullSizeProps).toEqual({
            flexSizeName: 'lookup-flex',
            sideWidgetKeys: ['h1', 'h3', 'advance'],
        });
        expect(query('.flex-fill.justify-content-end')?.className).toContain(
            ' pe-5',
        );
        expect(query('.ut-wiki')).not.toBeNull();

        await press(query('.ut-input-handler'));
        expect(h.viewController.applyTargetOrBibleKey).toHaveBeenCalledWith(
            bibleItem,
            { bibleKey: 'NIV' },
        );

        await press(byLabel('Export to MS Word'));
        expect(
            h.viewController.getBibleItemsForExportingMSWord,
        ).toHaveBeenCalledTimes(1);
        expect(h.exportToWordDocument).toHaveBeenCalledWith(exported);

        await press(query('.ut-modal-close'));
        expect(h.hideBibleLookupPopup).toHaveBeenCalledTimes(1);
    });

    it('drops the popup close and the right padding on the reader', async () => {
        h.page.isPageReader = true;
        await render(genHeader());
        expect(query('.ut-modal-close')).toBeNull();
        expect(
            query('.flex-fill.justify-content-end')?.className,
        ).not.toContain('pe-5');
    });

    it('keeps only the input, its toggles and the advance button when minimized', async () => {
        h.viewController.isMinimized = true;
        h.hideBibleLookupPopup = vi.fn();
        await render(genHeader());
        expect(query('.ut-history')).toBeNull();
        expect(query('.ut-wiki')).toBeNull();
        expect(query('.ut-modal-close')).toBeNull();
        expect(
            query('.mx-2 [aria-label="Advance Bible Lookup"]'),
        ).not.toBeNull();
    });
});

describe('BibleLookupPopupComp', () => {
    it('opens the reader in a modal and closes after a save unless kept open', async () => {
        h.page.isPagePresenter = true;
        h.hideBibleLookupPopup = vi.fn();
        await render(<BibleLookupPopupComp />);
        expect(query('.ut-modal .ut-bible-reader')).not.toBeNull();
        const props = h.lastBibleReaderProps;
        expect(props).toMatchObject({
            flexSizeName: 'bible-lookup-popup',
            bibleAndNotesLabel: 'Bible and Notes (Lookup)',
            readingLeftFlexSizeName: 'bible-reading-left-lookup',
            readingLeftBiblesLabel: 'Bibles (Lookup)',
            readingLeftBibleNotesLabel: 'Bible Notes (Lookup)',
        });
        props.onLookupSaveBibleItem();
        expect(h.hideBibleLookupPopup).toHaveBeenCalledTimes(1);
        h.settings['close-on-add-bible-item'] = 'true';
        props.onLookupSaveBibleItem();
        expect(h.hideBibleLookupPopup).toHaveBeenCalledTimes(1);
    });

    it('saves without closing anything when there is no popup to close', async () => {
        await render(<BibleLookupPopupComp />);
        expect(() =>
            h.lastBibleReaderProps.onLookupSaveBibleItem(),
        ).not.toThrow();
    });
});

describe('RenderExportWordComp', () => {
    it('exports what the views hold when pressed', async () => {
        h.viewController.getBibleItemsForExportingMSWord.mockResolvedValue([
            bibleItem,
        ]);
        await render(<RenderExportWordComp />);
        const button = byLabel('Export to MS Word')!;
        expect(button.getAttribute('title')).toBe('Export to MS Word');
        expect(h.exportToWordDocument).not.toHaveBeenCalled();
        await press(button);
        expect(h.exportToWordDocument).toHaveBeenCalledWith([bibleItem]);
    });
});
