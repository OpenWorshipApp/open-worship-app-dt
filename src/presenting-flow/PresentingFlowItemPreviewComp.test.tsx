// @vitest-environment jsdom

import { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        flow: {
            setItemDisabled: vi.fn(),
            setItemSlideScreenIds: vi.fn(),
            setItemSlideDisabled: vi.fn(),
        },
        expanded: true,
    },
    mocks: {
        selectItem: vi.fn(),
        selectChild: vi.fn(),
        showMenu: vi.fn(),
        itemMenu: vi.fn(() => [{ menuElement: 'Edit entry' }]),
        slideMenu: vi.fn(() => [{ menuElement: 'Park slide' }]),
        send: vi.fn(async () => {}),
        showDropped: vi.fn(),
        screenDrop: vi.fn(),
        origin: vi.fn(),
        armCc: vi.fn(),
        handleError: vi.fn(),
        loadDocument: vi.fn(),
        loadSlides: vi.fn(),
        registerStepping: vi.fn(() => vi.fn()),
        reveal: vi.fn(() => false),
        waitFor: vi.fn(),
        bringToView: vi.fn(),
    },
}));

vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <span data-testid="dots">dots</span>,
}));
vi.mock('../_screen/managers/screenChoosingHelpers', async () => ({
    PresetScreenIdsContext: (await import('react')).createContext<number[]>([]),
}));
vi.mock('../_screen/managers/screenDroppedHelpers', () => ({
    showDroppedDataOnScreens: mocks.showDropped,
}));
vi.mock('../app-document-list/appDocumentHelpers', async () => ({
    VaryAppDocumentContext: (await import('react')).createContext(null),
}));
vi.mock('../app-document-presenter/items/slideItemRenderHelpers', () => ({
    genAttachBackgroundComponent: (data: any) => (
        <span data-testid="background">{data.item.name}</span>
    ),
}));
vi.mock('../app-document-presenter/items/VarySlideRenderWrapperComp', () => ({
    default: ({ varySlide }: any) => (
        <button
            data-testid="slide-card"
            data-slide-id={varySlide.id}
            className="app-caught-hover-pointer"
        >
            Slide {varySlide.id}
        </button>
    ),
}));
vi.mock('../app-document-presenter/items/varySlideGridHelpers', () => ({
    THUMBNAIL_EXTRA_HEIGHT: 4,
    THUMBNAIL_EXTRA_WIDTH: 6,
    genSlideHeightGetter: () => () => 80,
    toVarySlideGridItemKey: (gridItem: any) => String(gridItem.varySlide.id),
    toVarySlideGridItems: (slides: any[]) =>
        slides.map((slide, index) => ({
            ownerSlide: slide,
            varySlide: slide,
            index,
        })),
    toVarySlideKey: (slide: any) => `slide-${slide.id}`,
}));
vi.mock('../app-document-presenter/items/varyAppDocumentHelpers', () => ({
    DATA_QUERY_KEY: 'data-slide-id',
}));
vi.mock('../virtual-list/VirtualGridComp', () => ({
    default: ({ items, renderItem }: any) => (
        <div data-testid="grid">{items.map(renderItem)}</div>
    ),
}));
vi.mock('../virtual-list/virtualRevealHelpers', () => ({
    revealVirtualItem: mocks.reveal,
    waitForVirtualElement: mocks.waitFor,
}));
vi.mock('../bible-reader/BibleViewTitleEditorComp', () => ({
    default: ({ bibleItem }: any) => <span>{bibleItem.title}</span>,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: any) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
    useAppEffect: useEffect,
    useAppStateAsync: (loader: () => Promise<any>, dependencies: unknown[]) => {
        const [value, setValue] = useState<any>(undefined);
        useEffect(() => {
            let live = true;
            void Promise.resolve(loader()).then((result) => {
                if (live) setValue(result);
            });
            return () => {
                live = false;
            };
        }, dependencies);
        return [value];
    },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Bible Font',
}));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: { onDropped: null as any },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span data-testid="loading">Loading</span>,
}));
vi.mock('./presentingFlowDocumentHelpers', () => ({
    loadVaryAppDocument: mocks.loadDocument,
    loadVarySlides: mocks.loadSlides,
}));
vi.mock('./presentingFlowHelpers', () => ({
    handlePresentingFlowItemScreenDropping: mocks.screenDrop,
    sendPresentingFlowItemToScreens: mocks.send,
}));
vi.mock('./presentingFlowItemMenuHelpers', () => ({
    genPresentingFlowItemContextMenuItems: mocks.itemMenu,
    genPresentingFlowVarySlideContextMenuItems: mocks.slideMenu,
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    checkIsPresentingFlowItemOnScreen: () => false,
    toPresentingFlowItemOnScreenKey: () => 'on-screen-key',
    useIsOnScreenChecking: () => false,
}));
vi.mock('./presentingFlowOriginHelpers', () => ({
    notifyPresentingFlowItemOrigin: mocks.origin,
}));
vi.mock('./PresentingFlow', () => ({
    default: { getInstance: () => state.flow },
}));
vi.mock('./PresentingFlowCcRowsComp', () => ({
    default: ({ ccItems }: any) => (
        <button data-presenting-flow-cc-row="">CC {ccItems.length}</button>
    ),
}));
vi.mock('./presentingFlowCcApplyHelpers', () => ({
    armPresentingFlowCcPropagation: mocks.armCc,
}));
vi.mock('./presentingFlowCcHelpers', () => ({
    PRESENTING_FLOW_CC_ROW_ATTR: 'data-presenting-flow-cc-row',
    PRESENTING_FLOW_ITEM_UUID_ATTR: 'data-presenting-flow-item-uuid',
}));
vi.mock('./PresentingFlowRowGutterComp', () => ({
    default: ({ lineNumber }: any) => (
        <span data-testid="gutter">{lineNumber}</span>
    ),
}));
vi.mock('./PresentingFlowScreenPinComp', () => ({
    default: ({ screenIds }: any) => (
        <span data-testid="pin">{screenIds.join(',')}</span>
    ),
}));
vi.mock('./presentingFlowPreviewFloatingHelpers', () => ({
    PRESENTING_FLOW_PREVIEW_ITEM_INDEX_KEY: 'data-preview-index',
    bringPresentingFlowRunElementToView: mocks.bringToView,
    findNextPresentingFlowPreviewChildIndex: (_slides: any[], from: number) =>
        from + 1,
    registerPresentingFlowPreviewChildStepping: mocks.registerStepping,
    resolvePresentingFlowPreviewSelectedChildIndex: () => -1,
    setPresentingFlowPreviewSelectedChild: mocks.selectChild,
    setPresentingFlowPreviewSelectedItem: mocks.selectItem,
    toPresentingFlowPreviewItemKey: (item: any) => `item-${item.uuid}`,
    usePresentingFlowPreviewIsChildSelected: () => false,
    usePresentingFlowPreviewIsItemSelected: () => false,
    usePresentingFlowPreviewItemExpanding: () => {
        const [expanded, setExpanded] = useState(state.expanded);
        return [expanded, () => setExpanded((value: boolean) => !value)];
    },
}));

import { dragStore } from '../helper/dragHelpers';
import PresentingFlowItemPreviewComp from './PresentingFlowItemPreviewComp';

function item(overrides: Record<string, unknown> = {}) {
    return {
        filePath: '/run',
        itemFilePath: '/source',
        uuid: 'entry-1',
        title: 'Opening',
        iconName: 'star',
        iconColor: 'red',
        idLabel: '#1',
        extraStyle: {},
        colorNote: null,
        screenIds: [] as number[],
        ccItems: [] as any[],
        hasCcItems: false,
        hasSlideCcItems: false,
        isDisabled: false,
        isError: false,
        isAction: false,
        isSlide: false,
        isAppDocument: false,
        isBackground: false,
        isAudio: false,
        isBibleItem: false,
        isScreenReachable: true,
        toDroppedData: vi.fn(async () => ({ item: { name: 'Blue' } })),
        getVarySlide: vi.fn(async () => ({ id: 7 })),
        getSlideScreenIds: vi.fn(() => [3]),
        getOwnSlideScreenIds: vi.fn(() => []),
        checkIsSlideDisabled: vi.fn(() => false),
        checkIsVarySlideDisabled: vi.fn(() => false),
        checkIsOwnSlideDisabled: vi.fn(() => false),
        getSlideCcItems: vi.fn(() => []),
        getEffectiveSlideCcItems: vi.fn(() => []),
        ...overrides,
    } as any;
}

let container: HTMLDivElement;
let root: Root;

async function render(entry = item()) {
    await act(async () => {
        root.render(
            <PresentingFlowItemPreviewComp
                presentingFlowItem={entry}
                index={1}
                itemCount={4}
                thumbnailWidth={160}
            />,
        );
    });
    return entry;
}

function find<T extends Element = HTMLElement>(selector: string): T {
    const found = container.querySelector<T>(selector);
    if (found === null) throw new Error(`Missing ${selector}`);
    return found;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('getComputedStyle', (target: Element) => ({
        cursor: target.classList.contains('app-caught-hover-pointer')
            ? 'pointer'
            : 'auto',
    }));
    state.expanded = true;
    mocks.loadDocument.mockResolvedValue({ id: 'document' });
    mocks.loadSlides.mockResolvedValue([{ id: 3 }, { id: 4 }]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    dragStore.onDropped = null;
    vi.unstubAllGlobals();
});

describe('presenting flow item preview', () => {
    it('selects only offered content, gives the frame its full menu, and folds with the chevron', async () => {
        const entry = await render(
            item({
                hasCcItems: true,
                ccItems: [item()],
                screenIds: [2],
                isDisabled: true,
            }),
        );
        expect(
            find('[data-preview-index]').getAttribute('data-preview-index'),
        ).toBe('1');
        expect(
            find('[data-presenting-flow-item-uuid]').getAttribute(
                'data-presenting-flow-item-uuid',
            ),
        ).toBe('entry-1');
        expect(find('[data-testid="pin"]').textContent).toBe('2');
        expect(find('[data-testid="gutter"]').textContent).toBe('2');
        expect(find('.app-presenting-flow-preview-item').className).toContain(
            'disabled',
        );

        await act(async () =>
            find('hr').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(mocks.selectItem).not.toHaveBeenCalled();
        await act(async () =>
            find('[data-presenting-flow-cc-row]').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(mocks.selectItem).not.toHaveBeenCalled();
        await act(async () =>
            find('.app-presenting-flow-preview-item-label').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(mocks.selectItem).toHaveBeenCalledWith(
            '/run',
            'item-entry-1',
            1,
        );

        await act(async () =>
            find('.app-presenting-flow-preview-item').dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(mocks.itemMenu).toHaveBeenCalledWith(state.flow, entry, 1, 4);
        expect(mocks.showMenu).toHaveBeenCalledWith(expect.anything(), [
            { menuElement: 'Edit entry' },
        ]);
        await act(async () =>
            find('.app-presenting-flow-preview-item-chevron').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(
            container.querySelector('.app-presenting-flow-preview-item-body'),
        ).toBeNull();
        await act(async () =>
            find('.app-presenting-flow-preview-item-chevron').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(
            container.querySelector('.app-presenting-flow-preview-item-body'),
        ).not.toBeNull();
    });

    it('sends active action buttons to screens but keeps parked actions inert', async () => {
        await render(item({ isAction: true, title: 'Clear', screenIds: [3] }));
        const button = find<HTMLButtonElement>(
            '.app-presenting-flow-preview-item-body button',
        );
        expect(button.className).toContain('btn-outline-secondary');
        await act(async () => button.click());
        expect(mocks.send).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Clear' }),
            expect.anything(),
        );

        await render(item({ isAction: true, isDisabled: true }));
        await act(async () =>
            find<HTMLButtonElement>(
                '.app-presenting-flow-preview-item-body button',
            ).click(),
        );
        expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    it('points audio at its source instead of presenting it', async () => {
        const entry = await render(item({ isAudio: true, title: 'Song' }));
        await act(async () =>
            find<HTMLButtonElement>(
                '.app-presenting-flow-preview-item-body button',
            ).click(),
        );
        expect(mocks.origin).toHaveBeenCalledWith(entry);
        expect(mocks.send).not.toHaveBeenCalled();
    });

    it('shows a background with its pinned screens and clears its drag payload', async () => {
        const entry = await render(
            item({ isBackground: true, screenIds: [5], ccItems: [item()] }),
        );
        expect(find('[data-testid="background"]').textContent).toBe('Blue');
        const card = find<HTMLElement>(
            '.app-presenting-flow-preview-item-body .card',
        );
        expect(card.getAttribute('draggable')).toBe('true');
        await act(async () => card.click());
        expect(mocks.armCc).toHaveBeenCalledWith(
            expect.anything(),
            entry.ccItems,
        );
        expect(mocks.showDropped).toHaveBeenCalledWith(
            expect.anything(),
            { item: { name: 'Blue' } },
            false,
            [5],
        );

        const start = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        }) as any;
        start.dataTransfer = { setData: vi.fn() };
        await act(async () => card.dispatchEvent(start));
        expect(start.dataTransfer.setData).toHaveBeenCalledWith(
            'text',
            'Opening',
        );
        expect(dragStore.onDropped).toBeTypeOf('function');
        await act(async () =>
            card.dispatchEvent(new Event('dragend', { bubbles: true })),
        );
        expect(dragStore.onDropped).toBeNull();

        await render(item({ isBackground: true, isDisabled: true }));
        const parked = find<HTMLElement>(
            '.app-presenting-flow-preview-item-body .card',
        );
        await act(async () => parked.click());
        expect(mocks.showDropped).toHaveBeenCalledTimes(1);
        const parkedDrag = new Event('dragstart', {
            bubbles: true,
            cancelable: true,
        }) as any;
        parkedDrag.dataTransfer = { setData: vi.fn() };
        await act(async () => parked.dispatchEvent(parkedDrag));
        expect(parkedDrag.defaultPrevented).toBe(true);
        expect(parkedDrag.dataTransfer.setData).not.toHaveBeenCalled();
    });

    it('shows a read-only Bible item and reports unreadable data', async () => {
        const bibleItem = { bibleKey: 'KJV', title: 'John 3:16' };
        const entry = item({
            isBibleItem: true,
            toDroppedData: vi.fn(async () => ({ item: bibleItem })),
        });
        await render(entry);
        expect(container.textContent).toContain('KJV');
        expect(container.textContent).toContain('John 3:16');
        await act(async () =>
            find<HTMLElement>(
                '.app-presenting-flow-preview-item-body .card',
            ).click(),
        );
        expect(mocks.showDropped).toHaveBeenCalledWith(
            expect.anything(),
            { item: bibleItem },
            false,
            [],
        );
        await render(
            item({ isBibleItem: true, toDroppedData: vi.fn(async () => null) }),
        );
        expect(container.textContent).toContain('Fail to read file data');
    });

    it('renders single-slide cards and blocks clicks on parked slides', async () => {
        const entry = await render(
            item({ isSlide: true, screenIds: [8], ccItems: [item()] }),
        );
        expect(find('[data-testid="slide-card"]').textContent).toBe('Slide 7');
        expect(entry.getVarySlide).toHaveBeenCalledOnce();
        const card = find<HTMLElement>('.app-presenting-flow-preview-slide');
        await act(async () =>
            card.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
        expect(mocks.armCc).not.toHaveBeenCalled();
        await act(async () =>
            find('[data-testid="slide-card"]').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            ),
        );
        expect(mocks.armCc).toHaveBeenCalledWith(
            expect.anything(),
            entry.ccItems,
        );
        await act(async () =>
            card.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(mocks.slideMenu).toHaveBeenCalledWith(
            expect.objectContaining({
                varySlide: { id: 7 },
                isDisabled: false,
                ownScreenIds: [],
            }),
        );

        await render(item({ isSlide: true, isDisabled: true }));
        const parked = find<HTMLElement>('.app-presenting-flow-preview-slide');
        const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => parked.dispatchEvent(click));
        expect(click.defaultPrevented).toBe(true);
        expect(
            find('.app-presenting-flow-preview-slide-disabled-icon').className,
        ).toContain('bi-slash-circle');
    });

    it('walks document slides through a card click and edits each slide pin and parking', async () => {
        const follower = item({ uuid: 'follower' });
        const entry = await render(
            item({
                isAppDocument: true,
                hasSlideCcItems: true,
                screenIds: [3],
                getOwnSlideScreenIds: vi.fn(() => [7]),
                getSlideCcItems: vi.fn(() => [follower]),
                getEffectiveSlideCcItems: vi.fn(() => [follower]),
            }),
        );
        expect(mocks.loadDocument).toHaveBeenCalledWith('/source');
        expect(mocks.loadSlides).toHaveBeenCalledWith({ id: 'document' });
        expect(
            find('[data-testid="grid"]').querySelectorAll(
                '[data-testid="slide-card"]',
            ),
        ).toHaveLength(2);
        expect(entry.getSlideCcItems).toHaveBeenCalledWith(3);
        expect(mocks.registerStepping).toHaveBeenCalledWith(
            '/run',
            1,
            expect.any(Function),
        );

        const step = (mocks.registerStepping.mock.calls as any[][])[0][2];
        expect(step(new MouseEvent('click'), true)).toBe(true);
        expect(mocks.bringToView).toHaveBeenCalledWith(
            find('[data-slide-id="3"]'),
        );
        expect(mocks.selectChild).toHaveBeenCalledWith(
            '/run',
            'item-entry-1',
            1,
            3,
        );
        expect(mocks.armCc).toHaveBeenCalledWith(expect.anything(), [follower]);

        await act(async () =>
            find('[data-slide-id="3"]').dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        const menuArgs = (mocks.slideMenu.mock.lastCall as any[])?.[0] as any;
        expect(menuArgs).toMatchObject({
            varySlide: { id: 3 },
            ownScreenIds: [7],
            isDisabled: false,
        });
        menuArgs.setSlideScreenIds(3, [9]);
        menuArgs.setSlideDisabled(3, true);
        expect(state.flow.setItemSlideScreenIds).toHaveBeenCalledWith(
            1,
            3,
            [9],
        );
        expect(state.flow.setItemSlideDisabled).toHaveBeenCalledWith(
            1,
            3,
            true,
        );
    });

    it('reports an unreadable document and leaves a folded document unloaded', async () => {
        mocks.loadDocument.mockResolvedValueOnce(null);
        await render(item({ isAppDocument: true }));
        expect(container.textContent).toContain('Fail to read file data');
        expect(mocks.registerStepping).not.toHaveBeenCalled();

        state.expanded = false;
        mocks.loadDocument.mockClear();
        await act(async () => root.unmount());
        root = createRoot(container);
        await render(item({ isAppDocument: true }));
        expect(mocks.loadDocument).not.toHaveBeenCalled();
        expect(
            container.querySelector('.app-presenting-flow-preview-item-body'),
        ).toBeNull();
    });
});
