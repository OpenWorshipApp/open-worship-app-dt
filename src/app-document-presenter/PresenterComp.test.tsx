// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: { 'present-tabs': 'd', panels: '' } as Record<string, string>,
    tabProps: [] as any[],
    resizeProps: null as any,
    menu: vi.fn(),
    checkScreen: vi.fn(),
    longTextUpdate: vi.fn(),
    showBible: null as null | (() => void),
    selectDocument: null as null | (() => void),
    selectSlide: null as null | (() => void),
    bibleUpdate: null as null | (() => void),
    foregroundOnScreen: false,
}));

vi.mock('../event/PreviewingEventListener', () => ({
    useBibleItemShowing: (callback: () => void) => {
        h.showBible = callback;
    },
    useVaryAppDocumentSelecting: (callback: () => void) => {
        h.selectDocument = callback;
    },
}));
vi.mock('../event/VaryAppDocumentEventListener', () => ({
    useVarySlideSelecting: (callback: () => void) => {
        h.selectSlide = callback;
    },
}));
vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingString: (key: string, fallback: string) => {
            const [value, setValue] = react.useState(
                h.settings[key] ?? fallback,
            );
            const set = (next: string | ((previous: string) => string)) => {
                setValue((previous) => {
                    const result =
                        typeof next === 'function' ? next(previous) : next;
                    h.settings[key] = result;
                    return result;
                });
            };
            return [value, set] as const;
        },
    };
});
vi.mock('../others/TabRenderComp', () => ({
    default: (props: any) => {
        h.tabProps.push(props);
        return createElement(
            'div',
            { className: 'test-tabs' },
            props.tabs.map((tab: any) =>
                createElement(
                    'button',
                    {
                        key: tab.key,
                        type: 'button',
                        'data-tab': tab.key,
                        'data-active': props.activeTabs.includes(tab.key),
                        onClick: (event: MouseEvent) =>
                            props.setActiveTab(tab.key, event),
                        onContextMenu: (event: MouseEvent) =>
                            props.setActiveTab(tab.key, event),
                    },
                    tab.title,
                ),
            ),
        );
    },
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) =>
        createElement('div', {}, children),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        children,
        extraActionButtons,
        onClose,
    }: {
        title: ReactNode;
        children: ReactNode;
        extraActionButtons: ReactNode;
        onClose: () => void;
    }) =>
        createElement(
            'section',
            {},
            title,
            extraActionButtons,
            children,
            createElement('button', { onClick: onClose }, 'Close panel'),
        ),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (key: string) => key,
    toWidgetLabel: (key: string) => ({ label: key }),
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeProps = props;
        return createElement(
            'div',
            { className: 'test-resize' },
            props.dataInput.map((item: any) => item.label).join(','),
        );
    },
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => ({ id: 'view' }),
    useBibleItemViewControllerUpdateEvent: (callback: () => void) => {
        h.bibleUpdate = callback;
    },
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: { fireUpdateEvent: h.longTextUpdate },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => undefined,
    useScreenLongTextManagerEvents: () => undefined,
}));
vi.mock('../presenter-foreground/foregroundWidgetHelpers', () => ({
    FOREGROUND_OPEN_PANELS_SETTING_NAME: 'panels',
    FOREGROUND_WIDGET_LIST: [
        {
            key: 'message',
            labelKey: 'Message Show',
            isNoTransition: false,
            Comp: () => createElement('span', {}, 'Message controls'),
        },
    ],
    genForegroundPanelMenuItems: (
        _raw: string,
        toggle: (key: string) => void,
    ) => [{ menuElement: 'Message Show', onSelect: () => toggle('message') }],
    getForegroundWidgetShowingScreenIds: () =>
        h.foregroundOnScreen ? ['screen-1'] : [],
    toForegroundPanelPersistKey: (key: string) => `panel:${key}`,
    toOpenPanelKeys: (raw: string) => (raw ? raw.split(',') : []),
    toToggledPanelKeys: (raw: string, key: string) =>
        raw.split(',').includes(key) ? '' : key,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.menu,
}));
vi.mock('./presenterRendererHelpers', () => ({
    checkIsOnScreen: h.checkScreen,
    PRESENT_TAB_SETTING_NAME: 'present-tabs',
}));
vi.mock('../helper/appHooks', async () => {
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
vi.mock('./VaryAppDocumentPinComp', () => ({
    default: () => createElement('span', {}, 'Pin'),
}));
vi.mock('../presenter-foreground/ForegroundTransitionControlsComp', () => ({
    ForegroundComponentTransitionButtonComp: () =>
        createElement('span', {}, 'Transition'),
}));
vi.mock('./items/AppDocumentPreviewerComp', () => ({ default: () => null }));
vi.mock('./PresenterBiblePreviewerRenderComp', () => ({ default: () => null }));

import PresenterComp from './PresenterComp';

let container: HTMLDivElement;
let root: Root;

async function renderPresenter() {
    await act(async () => root.render(createElement(PresenterComp)));
}

function tab(key: string) {
    return container.querySelector<HTMLButtonElement>(`[data-tab="${key}"]`)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings = { 'present-tabs': 'd', panels: '' };
    h.tabProps = [];
    h.resizeProps = null;
    h.menu.mockReset();
    h.checkScreen.mockReset().mockResolvedValue(false);
    h.longTextUpdate.mockReset();
    h.foregroundOnScreen = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Presenter tabs and foreground panels', () => {
    it('normalizes a saved Lyrics tab and keeps the Documents panel available', async () => {
        h.settings['present-tabs'] = 'l';
        await renderPresenter();
        expect(h.settings['present-tabs']).toBe('d');
        expect(tab('d').dataset.active).toBe('true');
        expect(tab('d').textContent).toContain('Pin');
        expect(
            h.resizeProps.dataInput.map(({ key }: { key: string }) => key),
        ).toEqual(['h1']);
        expect(h.resizeProps.flexSizeDefault).toEqual({ h1: ['1'], h3: ['1'] });
    });

    it('toggles tabs, keeps the last tab, and uses right-click for solo view', async () => {
        await renderPresenter();
        await act(async () => tab('b').click());
        expect(h.settings['present-tabs']).toBe('db');
        expect(
            h.resizeProps.dataInput.map(({ key }: { key: string }) => key),
        ).toEqual(['h1', 'h3']);
        await act(async () => tab('d').click());
        expect(h.settings['present-tabs']).toBe('b');
        await act(async () => tab('b').click());
        expect(h.settings['present-tabs']).toBe('b');
        await act(async () =>
            tab('d').dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(h.settings['present-tabs']).toBe('d');
    });

    it('opens the matching tab on Bible and document selection events', async () => {
        await renderPresenter();
        await act(async () => h.showBible!());
        expect(h.settings['present-tabs']).toBe('db');
        await act(async () => h.selectDocument!());
        expect(h.settings['present-tabs']).toBe('db');
        await act(async () => tab('d').click());
        expect(h.settings['present-tabs']).toBe('b');
        await act(async () => h.selectSlide!());
        expect(h.settings['present-tabs']).toBe('bd');
        h.bibleUpdate!();
        expect(h.longTextUpdate).toHaveBeenCalledTimes(1);
    });

    it('toggles full view and opens a foreground panel from its menu', async () => {
        await renderPresenter();
        expect(container.querySelector('.app-full-view')).toBeNull();
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[aria-label="Full view"]')!
                .click(),
        );
        expect(container.querySelector('.app-full-view')).not.toBeNull();
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Exit full view"]',
                )!
                .click(),
        );
        expect(container.querySelector('.app-full-view')).toBeNull();
        await act(async () => tab('f').click());
        expect(h.menu).toHaveBeenCalledTimes(1);
        const menuItems = h.menu.mock.calls[0][1];
        await act(async () => menuItems[0].onSelect());
        expect(h.settings.panels).toBe('message');
        expect(container.textContent).toContain('Message controls');
        expect(container.textContent).toContain('Transition');
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('section button')!
                .click(),
        );
        expect(h.settings.panels).toBe('');
        expect(container.textContent).not.toContain('Message controls');
    });

    it('asks the screen checker for each tab', async () => {
        await renderPresenter();
        const tabs = h.tabProps.find((props) =>
            props.tabs.some(({ key }: { key: string }) => key === 'd'),
        ).tabs;
        await tabs[0].checkIsOnScreen();
        await tabs[1].checkIsOnScreen();
        expect(h.checkScreen.mock.calls.map(([key]) => key)).toEqual([
            'd',
            'b',
        ]);
    });
});
