// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        presets: [] as any[],
        inputConfirmed: true,
        confirmDeletion: true,
    },
    mocks: {
        showMenu: vi.fn(),
        showInput: vi.fn(),
        showConfirm: vi.fn(),
        handleError: vi.fn(),
        savePreset: vi.fn(),
        deletePreset: vi.fn(),
        toggleRelation: vi.fn(),
        soloRelation: vi.fn(),
        setPathBarOpen: vi.fn(),
        getSnapshot: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('../context-menu/AppContextMenuComp', () => ({
    elementDivider: 'DIVIDER',
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/mermaidLiveHelpers', () => ({
    MERMAID_LIVE_LABEL: 'Open in Mermaid Live',
    MERMAID_LIVE_TITLE: 'Open diagram in Mermaid Live',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: mocks.showInput,
    showAppConfirm: mocks.showConfirm,
}));
vi.mock('./graphExportHelpers', () => ({
    COPY_MARKDOWN_LABEL: 'Copy as Markdown',
}));
vi.mock('./graphTextExportHelpers', () => ({
    GRAPH_DIAGRAM_FORMAT_LIST: [
        {
            key: 'mermaid',
            label: 'Copy Mermaid',
            title: 'Copy diagram as Mermaid',
            iconName: 'diagram',
        },
    ],
    MERMAID_LIVE_FORMAT_LIST: [
        { key: 'mermaid', name: 'Mermaid', iconName: 'diagram' },
    ],
}));
vi.mock('./GraphPathBarComp', () => ({
    default: () => <div>Path finder</div>,
}));
vi.mock('./graphPresetHelpers', () => ({
    getPresetList: () => state.presets,
    savePreset: mocks.savePreset,
    deletePreset: mocks.deletePreset,
}));
vi.mock('./graphViewStore', () => ({
    getGraphEngine: () => ({
        toggleRelationHidden: mocks.toggleRelation,
        soloRelation: mocks.soloRelation,
        setPathBarOpen: mocks.setPathBarOpen,
        getSnapshot: mocks.getSnapshot,
        restore: mocks.restore,
    }),
}));

import GraphToolbarComp from './GraphToolbarComp';

let host: HTMLDivElement;
let root: Root;
let widget: HTMLDivElement;
let viewport: HTMLDivElement;
let graph: any;
let source: any;
let actions: Pick<
    ComponentProps<typeof GraphToolbarComp>,
    | 'onSaveImage'
    | 'onPrint'
    | 'onCopyMarkdown'
    | 'onCopyDiagram'
    | 'onOpenMermaidLive'
>;

function button(label: string) {
    const result = host.querySelector<HTMLButtonElement>(
        `[aria-label="${label}"]`,
    );
    expect(result).not.toBeNull();
    return result!;
}

function renderToolbar() {
    return act(async () =>
        root.render(
            <GraphToolbarComp
                graph={graph}
                source={source}
                context={{}}
                {...actions}
                viewportRef={{ current: viewport }}
            />,
        ),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    state.presets = [];
    state.inputConfirmed = true;
    state.confirmDeletion = true;
    mocks.showInput.mockImplementation(async () => state.inputConfirmed);
    mocks.showConfirm.mockImplementation(async () => state.confirmDeletion);
    mocks.getSnapshot.mockReturnValue([
        { key: 'other', title: 'Old other' },
        { key: 'active', title: 'Active' },
    ]);
    graph = {
        key: 'active',
        title: 'People of Genesis',
        hiddenRelationList: ['place'],
        isPathBarOpen: false,
    };
    source = {
        relationDefList: [
            { kind: 'family', styleKey: 'blue', label: 'Family' },
            { kind: 'place', styleKey: 'green', label: 'Place' },
        ],
        findPath: vi.fn(),
    };
    actions = {
        onSaveImage: vi.fn<() => void>(),
        onPrint: vi.fn<() => void>(),
        onCopyMarkdown: vi.fn<() => void>(),
        onCopyDiagram: vi.fn<(format: string) => void>(),
        onOpenMermaidLive: vi.fn<(format: string) => void>(),
    };
    host = document.createElement('div');
    widget = document.createElement('div');
    widget.className = 'floating-widget';
    viewport = document.createElement('div');
    widget.append(viewport);
    document.body.append(host, widget);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    widget.remove();
    vi.unstubAllGlobals();
});

describe('graph toolbar', () => {
    test('toggles relation chips and the optional path finder', async () => {
        await renderToolbar();
        const family = [...host.querySelectorAll('button')].find(
            (item) => item.textContent === 'Family',
        )!;
        const place = [...host.querySelectorAll('button')].find(
            (item) => item.textContent === 'Place',
        )!;
        expect(family.getAttribute('aria-pressed')).toBe('true');
        expect(place.getAttribute('aria-pressed')).toBe('false');
        await act(async () => family.click());
        expect(mocks.toggleRelation).toHaveBeenCalledWith('active', 'family');
        const contextEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => place.dispatchEvent(contextEvent));
        expect(contextEvent.defaultPrevented).toBe(true);
        expect(mocks.soloRelation).toHaveBeenCalledWith(
            'active',
            'place',
            source.relationDefList,
        );
        await act(async () => button('Find Connection').click());
        expect(mocks.setPathBarOpen).toHaveBeenCalledWith('active', true);

        graph = { ...graph, isPathBarOpen: true };
        await renderToolbar();
        expect(host.textContent).toContain('Path finder');
        source = { ...source, findPath: undefined };
        await renderToolbar();
        expect(host.textContent).not.toContain('Path finder');
    });

    test('copy menu dispatches Markdown, diagram and Mermaid Live actions', async () => {
        await renderToolbar();
        await act(async () => button('Copy').click());
        const [event, menuItems] = mocks.showMenu.mock.calls.at(-1)!;
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Copy as Markdown',
            'DIVIDER',
            'Copy Mermaid',
            'DIVIDER',
            'Open in Mermaid Live',
        ]);
        await act(async () => menuItems[0].onSelect());
        expect(actions.onCopyMarkdown).toHaveBeenCalledOnce();
        await act(async () => menuItems[2].onSelect());
        expect(actions.onCopyDiagram).toHaveBeenCalledWith('mermaid');
        await act(async () => menuItems[4].onSelect());
        const [subEvent, subMenu] = mocks.showMenu.mock.calls.at(-1)!;
        expect(subEvent).toBe(event);
        await act(async () => subMenu[0].onSelect());
        expect(actions.onOpenMermaidLive).toHaveBeenCalledWith('mermaid');
    });

    test('preset menu saves, restores and confirms deletion', async () => {
        const presetGraph = { key: 'other', title: 'Morning' };
        state.presets = [{ name: 'Morning', graph: presetGraph }];
        await renderToolbar();
        await act(async () => button('Presets').click());
        const menuItems = mocks.showMenu.mock.calls.at(-1)?.[1];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Save as image',
            'Print',
            'Save preset',
            'Morning',
            'Delete preset',
        ]);
        await act(async () => menuItems[0].onSelect());
        await act(async () => menuItems[1].onSelect());
        expect(actions.onSaveImage).toHaveBeenCalledOnce();
        expect(actions.onPrint).toHaveBeenCalledOnce();
        await act(async () => menuItems[2].onSelect());
        expect(mocks.showInput).toHaveBeenCalledWith(
            'Save preset',
            expect.anything(),
            { escToCancel: true, enterToOk: true },
        );
        expect(mocks.savePreset).toHaveBeenCalledWith(
            'People of Genesis',
            graph,
        );
        await act(async () => menuItems[3].onSelect());
        expect(mocks.restore).toHaveBeenCalledWith([
            { key: 'active', title: 'Active' },
            presetGraph,
        ]);
        await act(async () => menuItems[4].onSelect());
        expect(mocks.deletePreset).toHaveBeenCalledWith('Morning');
    });

    test('fullscreen label follows browser events and the button exits on request', async () => {
        const requestFullscreen = vi.fn(async () => undefined);
        const exitFullscreen = vi.fn(async () => undefined);
        Object.defineProperty(widget, 'requestFullscreen', {
            configurable: true,
            value: requestFullscreen,
        });
        Object.defineProperty(document, 'exitFullscreen', {
            configurable: true,
            value: exitFullscreen,
        });
        await renderToolbar();
        await act(async () => button('Fullscreen').click());
        expect(requestFullscreen).toHaveBeenCalledOnce();
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            value: widget,
        });
        await act(async () =>
            document.dispatchEvent(new Event('fullscreenchange')),
        );
        expect(button('Exit fullscreen')).toBeDefined();
        await act(async () => button('Exit fullscreen').click());
        expect(exitFullscreen).toHaveBeenCalledOnce();
        delete (document as any).fullscreenElement;
    });
});
