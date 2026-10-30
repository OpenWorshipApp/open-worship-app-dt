// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

vi.mock('../../../helper/settingHelpers', () => ({
    getSetting: h.getSetting,
    setSetting: h.setSetting,
}));

import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';

let container: HTMLDivElement;
let root: Root;

async function render(props: Record<string, unknown>) {
    await act(async () => {
        root.render(
            <SlideEditorToolTitleComp {...props}>
                <span data-body="">body</span>
            </SlideEditorToolTitleComp>,
        );
    });
}

function header() {
    return container.querySelector<HTMLElement>('.app-tool-title')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings = new Map();
    h.getSetting.mockReset();
    h.setSetting.mockReset();
    h.getSetting.mockImplementation(
        (key: string) => h.settings.get(key) ?? null,
    );
    h.setSetting.mockImplementation((key: string, value: string) => {
        h.settings.set(key, value);
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorToolTitleComp', () => {
    test('a plain section shows its title over its body', async () => {
        await render({ title: 'Font' });

        const tool = container.querySelector('.app-tool')!;
        expect(tool.className).toBe('app-tool');
        expect(header().textContent).toBe('Font');
        expect(header().getAttribute('role')).toBeNull();
        expect(
            container.querySelector('.app-tool-body [data-body]'),
        ).not.toBeNull();
    });

    test('an inline section without a title has a body only', async () => {
        await render({ isInline: true, isCollapsible: true });

        expect(container.querySelector('.app-tool')?.className).toBe(
            'app-tool app-tool-inline',
        );
        expect(container.querySelector('.app-tool-title')).toBeNull();
        expect(container.querySelector('[data-body]')).not.toBeNull();
    });

    test('a collapsible section toggles and remembers its state', async () => {
        await render({
            title: 'Shadow',
            isCollapsible: true,
            persistingKey: 'tool-shadow',
        });

        expect(header().getAttribute('role')).toBe('button');
        expect(header().title).toBe('Collapse');
        expect(header().querySelector('i')?.className).toBe(
            'bi bi-chevron-down',
        );
        expect(container.querySelector('[data-body]')).not.toBeNull();

        await act(async () => header().click());

        expect(container.querySelector('[data-body]')).toBeNull();
        expect(header().title).toBe('Expand');
        expect(header().querySelector('i')?.className).toBe(
            'bi bi-chevron-right',
        );
        expect(h.setSetting).toHaveBeenCalledWith('tool-shadow', 'false');
    });

    test('a collapsible section reopens in its remembered state', async () => {
        h.settings.set('tool-media', 'false');
        await render({
            title: 'Media',
            isCollapsible: true,
            persistingKey: 'tool-media',
        });

        expect(h.getSetting).toHaveBeenCalledWith('tool-media');
        expect(container.querySelector('[data-body]')).toBeNull();
    });

    test('an empty key neither reads nor writes a setting', async () => {
        await render({
            title: 'Preview',
            isCollapsible: true,
            isInitiallyExpanded: false,
            persistingKey: '',
        });
        expect(container.querySelector('[data-body]')).toBeNull();

        await act(async () => header().click());

        expect(container.querySelector('[data-body]')).not.toBeNull();
        expect(h.getSetting).not.toHaveBeenCalled();
        expect(h.setSetting).not.toHaveBeenCalled();
    });
});
