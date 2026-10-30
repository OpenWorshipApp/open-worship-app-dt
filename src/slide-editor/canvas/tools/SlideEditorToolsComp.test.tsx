// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    selected: [] as any[],
    editing: null as any,
    storedTab: null as null | string,
    settingRequests: [] as [string, string][],
    settingWrites: [] as [string, string][],
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue: string) => {
            h.settingRequests.push([key, defaultValue]);
            const [value, setValue] = react.useState(
                h.storedTab ?? defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    h.settingWrites.push([key, newValue]);
                    setValue(newValue);
                },
            ];
        },
    };
});

// The real tab bar listens to screen updates for its on-screen marks; only
// the header buttons and the lazy body matter here.
vi.mock('../../../others/TabRenderComp', () => ({
    default: ({
        tabs,
        activeTabs,
        setActiveTab,
    }: {
        tabs: { key: string; title: ReactNode }[];
        activeTabs: string[];
        setActiveTab: (key: string) => void;
    }) => (
        <div data-tabs="">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    data-tab={tab.key}
                    data-active={activeTabs.includes(tab.key)}
                    onClick={() => setActiveTab(tab.key)}
                >
                    {tab.title}
                </button>
            ))}
        </div>
    ),
    genTabBody: (selected: string, [key, Element]: [string, any]) => (
        <Suspense fallback={<span data-loading="" />}>
            {selected === key ? <Element /> : null}
        </Suspense>
    ),
}));

vi.mock('./SlideEditorPropertiesComp', () => ({
    default: ({ canvasItems }: { canvasItems: { id: number }[] }) => (
        <div data-properties="">
            {canvasItems.map((item) => item.id).join(',') || 'none'}
        </div>
    ),
}));

vi.mock('./ToolCanvasItemsComp', () => ({
    default: () => <div data-items-list="">items</div>,
}));

vi.mock('../CanvasItem', () => ({
    useSelectedCanvasItemsAndSetterContext: () => ({
        canvasItems: h.selected,
    }),
    useEditingCanvasItemAndSetterContext: () => ({ canvasItem: h.editing }),
}));

import SlideEditorToolsComp from './SlideEditorToolsComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<SlideEditorToolsComp />));
}

function properties() {
    return container.querySelector('[data-properties]')?.textContent ?? null;
}

async function waitForItemsList() {
    await act(async () => {
        await vi.waitFor(() => {
            expect(container.querySelector('[data-items-list]')).not.toBeNull();
        });
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.selected = [];
    h.editing = null;
    h.storedTab = null;
    h.settingRequests = [];
    h.settingWrites = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorToolsComp', () => {
    test('opens on the Properties tab for the selected items', async () => {
        h.selected = [{ id: 3 }, { id: 5 }];
        await render();

        expect(h.settingRequests[0]).toEqual(['editor-tools-tab', 'p']);
        const tabs = Array.from(container.querySelectorAll('[data-tab]'));
        expect(tabs.map((tab) => tab.textContent)).toEqual([
            'Properties',
            'Canvas Items',
        ]);
        expect(tabs.map((tab) => tab.getAttribute('data-active'))).toEqual([
            'true',
            'false',
        ]);
        expect(properties()).toBe('3,5');
        expect(container.querySelector('[data-items-list]')).toBeNull();
    });

    test('shows the box being text-edited when nothing is selected', async () => {
        h.editing = { id: 8 };
        await render();
        expect(properties()).toBe('8');
    });

    test('a selection wins over the box being edited', async () => {
        h.selected = [{ id: 2 }];
        h.editing = { id: 8 };
        await render();
        expect(properties()).toBe('2');
    });

    test('with nothing selected or edited the properties panel gets no items', async () => {
        await render();
        expect(properties()).toBe('none');
    });

    test('switching to Canvas Items remembers the tab and loads the list', async () => {
        await render();

        await act(async () => {
            container
                .querySelector<HTMLButtonElement>('[data-tab="c"]')!
                .click();
        });

        expect(h.settingWrites).toEqual([['editor-tools-tab', 'c']]);
        expect(properties()).toBeNull();
        await waitForItemsList();
    });

    test('reopens on the remembered Canvas Items tab', async () => {
        h.storedTab = 'c';
        await render();

        expect(properties()).toBeNull();
        await waitForItemsList();
    });
});
