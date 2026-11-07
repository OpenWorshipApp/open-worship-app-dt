// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    doc: null as any,
    isPagePresenter: true,
    stage: 0,
    typing: false,
    files: [] as File[],
    menuRoom: null as any,
    zoomOptions: null as any,
    presentingPaths: new Set<string>(),
    highlight: vi.fn(),
    register: vi.fn(),
    controlEvent: vi.fn(),
    menuItems: vi.fn(),
    createSlides: vi.fn(),
    toast: vi.fn(),
    dragStyle: vi.fn(),
    setScale: vi.fn(),
    showMenu: vi.fn(),
}));

vi.mock('../../event/VaryAppDocumentEventListener', () => ({
    useVarySlideThumbnailSizeScale: () => [15, h.setScale],
}));
vi.mock('./VarySlidesComp', () => ({
    default: ({ menuRoom }: { menuRoom: unknown }) => {
        h.menuRoom = menuRoom;
        return createElement('span', {}, 'Slide cards');
    },
}));
vi.mock('../../app-document-list/AppDocument', () => ({
    default: class AppDocument {},
}));
vi.mock('../../others/AppRangeComp', () => ({
    useZoomingRegistering: (_ref: unknown, options: unknown) => {
        h.zoomOptions = options;
    },
}));
vi.mock('./AppDocumentPreviewerFooterComp', () => ({ defaultRangeSize: 10 }));
vi.mock('./SlidesMenuComp', () => ({
    default: () => createElement('span', {}, 'Editing menu'),
}));
vi.mock('./varyAppDocumentHelpers', () => ({
    checkIsVaryAppDocumentPresenting: (filePath: string) =>
        h.presentingPaths.has(filePath),
    getContainerDiv: () => document.querySelector('.slide-items-container'),
    SLIDE_ITEMS_CONTAINER_CLASS_NAME: 'slide-items-container',
}));
vi.mock('../../keyboard-shortcut/keyingAreaHelpers', () => ({
    KEYING_AREA_PRIORITY: { slides: 20, slidesPopup: 10 },
    registerKeyingArea: h.register,
}));
vi.mock('../../presenting-control/presentingControlShortcutHelpers', () => ({
    checkIsTypingTarget: () => h.typing,
}));
vi.mock('../../app-document-list/appDocumentHelpers', async () => {
    const react = await import('react');
    return {
        SelectedEditingSlideContext: react.createContext(null),
        toKeyByFilePath: (path: string, id: string) => `${path}:${id}`,
        useSlideItemsControlEventContext: () => h.controlEvent,
        useVaryAppDocumentContext: () => h.doc,
    };
});
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: MouseEvent) => void }) =>
        createElement('button', { onClick: onOpening }, 'Document menu'),
}));
vi.mock('../../scrolling/ScrollingHandlerComp', () => ({
    default: () => null,
}));
vi.mock('../../helper/helpers', () => ({
    bringDomToCenterView: vi.fn(),
    changeDragEventStyle: h.dragStyle,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../others/droppingFileHelpers', () => ({
    readDroppedFiles: async function* () {
        for (const file of h.files) yield file;
    },
}));
vi.mock('../../slide-editor/canvas/canvasHelpers', () => ({
    checkIsSupportMediaType: (type: string) =>
        type.startsWith('image/') || type.startsWith('video/'),
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('./appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'document-slide',
    createNewSlidesFromDroppedData: h.createSlides,
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: h.highlight,
}));
vi.mock('./slidesPreviewerScopeHelpers', async () => {
    const react = await import('react');
    return {
        genSlidesPreviewerScope: (containerRef: unknown) => ({
            scopeId: 'scope-1',
            containerRef,
        }),
        SLIDES_PREVIEWER_SCOPE_KEY: 'data-slide-scope',
        SlidesPreviewerScopeContext: react.createContext(null),
        useThumbnailScaleSettingOptions: () => ({ min: 2 }),
    };
});
vi.mock('../../others/slideTransitionMenuHelpers', () => ({
    DocumentTransitionIconComp: () =>
        createElement('span', {}, 'Transition icon'),
    genDocumentTransitionMenuItems: h.menuItems,
}));
vi.mock('../stage/documentStageContexts', () => ({
    useSlideStage: () => h.stage,
}));

import AppDocument from '../../app-document-list/AppDocument';
import VarySlidesPreviewerComp from './VarySlidesPreviewerComp';
import { SelectedEditingSlideContext } from '../../app-document-list/appDocumentHelpers';

let container: HTMLDivElement;
let root: Root;

async function renderPreviewer(
    selectedSlide: { filePath: string; id: string } | null = null,
) {
    await act(async () =>
        root.render(
            createElement(
                SelectedEditingSlideContext,
                { value: { selectedSlideEditing: selectedSlide } as any },
                createElement(VarySlidesPreviewerComp),
            ),
        ),
    );
}

function panel() {
    return container.querySelector<HTMLElement>('.slide-items-container')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.isPagePresenter = true;
    h.stage = 0;
    h.typing = false;
    h.files = [];
    h.presentingPaths.clear();
    h.menuRoom = null;
    h.zoomOptions = null;
    h.doc = Object.assign(new (AppDocument as any)(), {
        filePath: 'C:/documents/service.owa',
        isEditable: true,
        showContextMenu: h.showMenu,
    });
    h.menuItems.mockResolvedValue([{ menuElement: 'Transition' }]);
    h.createSlides.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('slides previewer', () => {
    it('shows editing controls and registers its own slide keyboard area', async () => {
        await renderPreviewer({ filePath: h.doc.filePath, id: 'slide-2' });
        expect(panel().dataset.slideScope).toBe('scope-1');
        expect(panel().tabIndex).toBe(0);
        expect(container.textContent).toContain('Editing menu');
        expect(container.textContent).toContain('Slide cards');
        expect(h.menuRoom).toBeNull();
        expect(h.register).toHaveBeenCalledTimes(1);
        expect(h.register.mock.calls[0][0].priority).toBe(20);
        expect(h.zoomOptions).toEqual({
            value: 15,
            setValue: h.setScale,
            defaultSize: 10,
        });
        expect(h.highlight.mock.calls[0][1].revealKey).toBe(
            `${h.doc.filePath}:slide-2`,
        );
        expect(document.activeElement).toBe(panel());
    });

    it('routes keys only when the previewer itself has focus', async () => {
        await renderPreviewer();
        panel().focus();
        await act(async () =>
            panel().dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'ArrowRight',
                    bubbles: true,
                }),
            ),
        );
        expect(h.controlEvent).toHaveBeenCalledTimes(1);
        const child = container.querySelector<HTMLButtonElement>('button')!;
        child.focus();
        await act(async () =>
            child.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'ArrowRight',
                    bubbles: true,
                }),
            ),
        );
        expect(h.controlEvent.mock.calls.map(([event]) => event.type)).toEqual([
            'keydown',
            'blur',
        ]);
    });

    it('opens the document transition menu from the panel and menu button', async () => {
        await renderPreviewer();
        await act(async () =>
            panel().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(h.menuItems).toHaveBeenCalledWith(h.doc.filePath);
        expect(h.showMenu).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'contextmenu' }),
            [{ menuElement: 'Transition' }],
        );
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(h.showMenu).toHaveBeenCalledTimes(2);
    });

    it('accepts dropped media and reports unsupported files', async () => {
        await renderPreviewer();
        const image = new File(['image'], 'photo.png', { type: 'image/png' });
        const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
        h.files = [image, text];
        await act(async () =>
            panel().dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            ),
        );
        expect(h.createSlides).toHaveBeenCalledWith(h.doc, [image]);
        expect(h.toast).toHaveBeenCalledWith(
            'Insert Image or Video',
            'Unsupported file type!',
        );
        expect(h.dragStyle).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'drop' }),
            'opacity',
            '1',
        );
    });

    it('keeps Stage previewers read-only and leaves Presenter key registration behind', async () => {
        h.stage = 1;
        h.isPagePresenter = false;
        h.doc.isEditable = false;
        await renderPreviewer();
        expect(container.textContent).not.toContain('Editing menu');
        expect(h.menuRoom).toEqual({ height: 26, width: 64 });
        expect(h.register).not.toHaveBeenCalled();
        expect(h.highlight.mock.calls[0][1].revealKey).toBeUndefined();
    });

    function genDocument(filePath: string) {
        return Object.assign(new (AppDocument as any)(), {
            filePath,
            isEditable: true,
            showContextMenu: h.showMenu,
        });
    }

    it('looks for the active card only inside its own panel', async () => {
        await renderPreviewer();
        const findActiveCard = h.highlight.mock.calls[0][0] as () => unknown;
        expect(findActiveCard()).toBeNull();
        // Another previewer's active card is not this one's to scroll to.
        const elsewhere = document.createElement('div');
        elsewhere.className = 'document-slide active';
        document.body.appendChild(elsewhere);
        try {
            expect(findActiveCard()).toBeNull();
            const card = document.createElement('div');
            card.className = 'document-slide active';
            panel().appendChild(card);
            expect(findActiveCard()).toBe(card);
        } finally {
            elsewhere.remove();
        }
    });

    it('leaves focus alone in a field being typed into, and behind the main panel', async () => {
        h.typing = true;
        await renderPreviewer();
        expect(document.activeElement).toBe(document.body);

        await act(async () => root.unmount());
        root = createRoot(container);
        h.typing = false;
        const mainPanel = document.createElement('div');
        mainPanel.className = 'slide-items-container';
        document.body.insertBefore(mainPanel, container);
        try {
            await renderPreviewer();
            expect(panel()).not.toBe(mainPanel);
            expect(document.activeElement).toBe(document.body);
        } finally {
            mainPanel.remove();
        }
    });

    it('picking another document keeps focus on a control inside the panel', async () => {
        await renderPreviewer();
        expect(document.activeElement).toBe(panel());
        const menuButton =
            container.querySelector<HTMLButtonElement>('button')!;
        menuButton.focus();
        h.doc = genDocument('C:/documents/next.owa');
        await renderPreviewer();
        expect(document.activeElement).toBe(menuButton);
    });

    it('its keying area is its own panel, live while its current document is on a screen', async () => {
        const unregister = vi.fn();
        h.register.mockReturnValue(unregister);
        await renderPreviewer();
        const area = h.register.mock.calls[0][0];
        expect(area.getElement()).toBe(panel());
        expect(area.checkHasSelected()).toBe(false);
        h.presentingPaths.add('C:/documents/service.owa');
        expect(area.checkHasSelected()).toBe(true);

        // Asked of the document showing NOW, not the one it registered with.
        h.doc = genDocument('C:/documents/next.owa');
        await renderPreviewer();
        expect(h.register).toHaveBeenCalledTimes(1);
        expect(area.checkHasSelected()).toBe(false);
        h.presentingPaths.add('C:/documents/next.owa');
        expect(area.checkHasSelected()).toBe(true);

        await act(async () => root.unmount());
        expect(unregister).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });

    it('a floating preview ranks its keying area below the panel behind it', async () => {
        container.classList.add('floating-widget');
        try {
            await renderPreviewer();
            expect(h.register.mock.calls[0][0].priority).toBe(10);
        } finally {
            container.classList.remove('floating-widget');
        }
    });

    it('dims under a drag and comes back when it leaves', async () => {
        await renderPreviewer();
        const over = new Event('dragover', { bubbles: true, cancelable: true });
        await act(async () => panel().dispatchEvent(over));
        expect(over.defaultPrevented).toBe(true);
        expect(h.dragStyle).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'dragover' }),
            'opacity',
            '0.5',
        );
        const leave = new Event('dragleave', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => panel().dispatchEvent(leave));
        expect(leave.defaultPrevented).toBe(true);
        expect(h.dragStyle).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'dragleave' }),
            'opacity',
            '1',
        );
    });

    it('a drop on a document that takes no new slides adds nothing', async () => {
        // A PDF, a PPTX, a lyric: what is shown here, not an Open Worship file.
        h.doc = {
            filePath: 'C:/documents/handout.pdf',
            isEditable: false,
            showContextMenu: h.showMenu,
        };
        h.files = [new File(['image'], 'photo.png', { type: 'image/png' })];
        await renderPreviewer();
        const drop = new Event('drop', { bubbles: true, cancelable: true });
        await act(async () => panel().dispatchEvent(drop));
        expect(drop.defaultPrevented).toBe(true);
        expect(h.dragStyle).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'drop' }),
            'opacity',
            '1',
        );
        expect(h.createSlides).not.toHaveBeenCalled();
        expect(h.toast).not.toHaveBeenCalled();
    });
});
