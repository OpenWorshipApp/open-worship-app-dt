// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    isPagePresenter: true,
    isInjected: false,
    varyAppDocumentContextValue: {
        selectedVaryAppDocument: { filePath: '/docs/a.slides' },
    } as unknown,
    editingSlideContextValue: { selectedSlideEditing: { id: 2 } } as unknown,
    seen: {} as Record<string, unknown>,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return state.isPagePresenter;
        },
    },
}));
vi.mock('../others/commonButtons', async () => {
    const { createContext, use } = await import('react');
    const BibleLookupTogglePopupContext = createContext<{
        isShowing: boolean;
        setIsShowing: (isShowing: boolean) => void;
    } | null>(null);
    return {
        BibleLookupTogglePopupContext,
        BibleLookupButtonComp: () => {
            const toggle = use(BibleLookupTogglePopupContext)!;
            return (
                <button
                    type="button"
                    data-part="bible-lookup"
                    onClick={() => toggle.setIsShowing(!toggle.isShowing)}
                >
                    lookup
                </button>
            );
        },
        SettingButtonComp: () => <i data-part="setting" />,
        ChatbotButtonComp: () => <i data-part="chatbot" />,
        AiChatButtonComp: () => <i data-part="ai-chat" />,
        HelpButtonComp: () => <i data-part="help" />,
    };
});
vi.mock('../app-modal/AppPopupBibleLookupComp', async () => {
    const { BibleLookupTogglePopupContext } =
        await import('../others/commonButtons');
    return {
        default: () => {
            const toggle = use(BibleLookupTogglePopupContext)!;
            return toggle.isShowing ? <i data-part="lookup-popup" /> : null;
        },
    };
});
vi.mock('../others/StayAwakeButtonComp', () => ({
    default: () => <i data-part="stay-awake" />,
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    default: () => <i data-part="context-menu" />,
}));
vi.mock('../popup-widget/HandleAlertComp', () => ({
    default: () => <i data-part="alerts" />,
}));
vi.mock('../toast/ToastComp', () => ({
    default: () => <i data-part="toast" />,
}));
vi.mock('../progress-bar/TopProgressBarComp', () => ({
    default: () => <i data-part="progress" />,
}));
vi.mock('../app-document-list/AppDocumentPreviewFloatingComp', () => ({
    default: () => <i data-part="document-preview" />,
}));
vi.mock('../graph-view/GraphViewPanelsHostComp', () => ({
    default: () => <i data-part="graph-panels" />,
}));
vi.mock('../location-name-lookup/LocationNameDetailPanelsHostComp', () => ({
    default: () => <i data-part="location-panels" />,
}));
vi.mock('./LayoutTabRenderComp', () => ({
    default: () => <i data-part="tabs" />,
}));
vi.mock('./layoutHelpers', () => ({
    useAppDocumentContextValues: () => ({
        varyAppDocumentContextValue: state.varyAppDocumentContextValue,
        editingSlideContextValue: state.editingSlideContextValue,
    }),
}));
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        get isInjectedAppDocumentFilePath() {
            return state.isInjected;
        },
        SelectedVaryAppDocumentContext: createContext<unknown>(null),
        SelectedEditingSlideContext: createContext<unknown>(null),
    };
});

import AppLayoutComp from './AppLayoutComp';
import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';

function PageProbeComp() {
    state.seen.varyAppDocument = use(SelectedVaryAppDocumentContext);
    state.seen.editingSlide = use(SelectedEditingSlideContext);
    return <p className="page">page</p>;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.isPagePresenter = true;
    state.isInjected = false;
    state.seen = {};
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function listParts(scope: ParentNode = host) {
    return Array.from(scope.querySelectorAll('[data-part]')).map((element) =>
        element.getAttribute('data-part'),
    );
}

async function renderLayout() {
    await act(async () =>
        root.render(
            <AppLayoutComp>
                <PageProbeComp />
            </AppLayoutComp>,
        ),
    );
}

describe('AppLayoutComp', () => {
    test('the presenter gets the full header, the page and every host', async () => {
        await renderLayout();
        expect(listParts(host.querySelector('#app-header')!)).toEqual([
            'tabs',
            'bible-lookup',
            'stay-awake',
            'setting',
            'chatbot',
            'ai-chat',
            'help',
        ]);
        expect(host.querySelector('#app-body .page')!.textContent).toBe('page');
        expect(listParts().slice(7)).toEqual([
            'progress',
            'toast',
            'context-menu',
            'alerts',
            'document-preview',
            'location-panels',
            'graph-panels',
        ]);
    });

    test('only the presenter offers to keep the computer awake', async () => {
        state.isPagePresenter = false;
        await renderLayout();
        expect(listParts()).not.toContain('stay-awake');
        expect(listParts()).toContain('setting');
    });

    test('a window opened on one injected document has no tabs and no settings', async () => {
        state.isInjected = true;
        await renderLayout();
        const parts = listParts(host.querySelector('#app-header')!);
        expect(parts).not.toContain('tabs');
        expect(parts).not.toContain('setting');
        expect(parts).toContain('bible-lookup');
    });

    test('the page reads the selected document and editing slide from the layout', async () => {
        await renderLayout();
        expect(state.seen.varyAppDocument).toBe(
            state.varyAppDocumentContextValue,
        );
        expect(state.seen.editingSlide).toBe(state.editingSlideContextValue);
    });

    test('the lookup button toggles the bible lookup popup', async () => {
        await renderLayout();
        expect(listParts()).not.toContain('lookup-popup');
        const button = host.querySelector<HTMLButtonElement>(
            '[data-part="bible-lookup"]',
        )!;
        await act(async () => button.click());
        expect(listParts()).toContain('lookup-popup');
        await act(async () => button.click());
        expect(listParts()).not.toContain('lookup-popup');
    });
});
