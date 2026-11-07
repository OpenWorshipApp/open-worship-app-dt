// @vitest-environment jsdom

// The router folder on one mock surface: the REAL `routeHelpers`,
// `layoutHelpers` (tabs and the document/slide selection hook),
// `LayoutTabRenderComp`, `AppLayoutComp` and `PopupLayoutComp`, with the page
// furniture they mount stubbed to a marker so the tests read what the layout
// wires together.

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    provider: {
        isPagePresenter: true,
        isPageAppDocumentEditor: false,
        isPageScreenMirror: false,
        presenterHomePage: '/presenter.html',
        readerHomePage: '/reader.html',
        experimentHomePage: '/experiment.html',
        appDocumentEditorHomePage: '/slide-editor.html',
        screenMirrorHomePage: '/screen-mirror.html',
        currentHomePage: '/presenter.html',
        systemUtils: { isDev: false },
    },
    flags: { isInjected: false },
    settings: new Map<string, string>(),
    fileEvents: new Map<
        string,
        { callback: (data?: any) => any; filePath?: string }
    >(),
    openPopupWindow: vi.fn(),
    onSlideItemsKeyboardEvent: vi.fn(),
    checkIsAppDocumentSelected: vi.fn(),
    openAppDocumentEditorExternal: vi.fn(),
    getSelectedVaryAppDocument: vi.fn(),
    getSelectedEditingSlide: vi.fn(),
    setSelectedVaryAppDocument: vi.fn(),
    setSelectedEditingSlide: vi.fn(),
    preloadAttachedBackground: vi.fn(),
    checkIsVaryAppDocumentSwitchRefused: vi.fn(),
    forceUnpinVaryAppDocument: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({ default: mocks.provider }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/labelIconHelpers', () => ({
    genLabelIcon: (title: string) => `[icon:${title}]`,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => mocks.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        mocks.settings.set(key, value);
    },
}));
vi.mock('../helper/domHelpers', () => ({
    openPopupWindow: mocks.openPopupWindow,
}));
vi.mock('../helper/helpers', () => ({
    checkIsSameValues: (value1: any, value2: any) => {
        return JSON.stringify(value1) === JSON.stringify(value2);
    },
}));
vi.mock('../slide-editor/slideEditingKeyboardEventHelpers', () => ({
    onSlideItemsKeyboardEvent: mocks.onSlideItemsKeyboardEvent,
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    checkIsHistoryMovementEventType: (eventType?: string) => {
        return eventType === 'undo' || eventType === 'redo';
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: (value: any) => !!value?.isAppDocument,
    },
    checkIsAppDocumentSelected: mocks.checkIsAppDocumentSelected,
    openAppDocumentEditorExternal: mocks.openAppDocumentEditorExternal,
}));
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        get isInjectedAppDocumentFilePath() {
            return mocks.flags.isInjected;
        },
        SelectedVaryAppDocumentContext: createContext<any>(null),
        SelectedEditingSlideContext: createContext<any>(null),
        getSelectedVaryAppDocument: mocks.getSelectedVaryAppDocument,
        getSelectedEditingSlide: mocks.getSelectedEditingSlide,
        setSelectedVaryAppDocument: mocks.setSelectedVaryAppDocument,
        setSelectedEditingSlide: mocks.setSelectedEditingSlide,
        preloadAttachedBackground: mocks.preloadAttachedBackground,
    };
});
vi.mock('../app-document-list/varyAppDocumentLockHelpers', () => ({
    checkIsVaryAppDocumentSwitchRefused:
        mocks.checkIsVaryAppDocumentSwitchRefused,
    forceUnpinVaryAppDocument: mocks.forceUnpinVaryAppDocument,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    // The LATEST callback per event list, as a re-subscribing hook leaves it.
    useFileSourceEvents: (
        events: string[],
        callback: (data?: any) => any,
        _deps: any[],
        filePath?: string,
    ) => {
        mocks.fileEvents.set(events.join(','), { callback, filePath });
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effectMethod: (methods: any) => Promise<any>,
            deps: any[],
            methods: any,
        ) => {
            useEffect(() => {
                effectMethod({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('../others/commonButtons', async () => {
    const {
        createContext,
        createElement,
        use: useContext,
    } = await import('react');
    const BibleLookupTogglePopupContext = createContext<any>(null);
    const marker = (name: string) => () => `[${name}]`;
    return {
        BibleLookupTogglePopupContext,
        BibleLookupButtonComp: () => {
            const context = useContext(BibleLookupTogglePopupContext);
            return createElement(
                'button',
                {
                    type: 'button',
                    id: 'lookup-toggle',
                    onClick: () => context.setIsShowing(!context.isShowing),
                },
                `lookup:${context.isShowing}`,
            );
        },
        AiChatButtonComp: marker('AiChat'),
        ChatbotButtonComp: marker('Chatbot'),
        HelpButtonComp: marker('Help'),
        SettingButtonComp: marker('Setting'),
    };
});
vi.mock('../others/StayAwakeButtonComp', () => ({
    default: () => '[StayAwake]',
}));
vi.mock('../app-modal/AppPopupBibleLookupComp', () => ({
    default: () => '[PopupBibleLookup]',
}));
vi.mock('../context-menu/AppContextMenuComp', () => ({
    default: () => '[ContextMenu]',
}));
vi.mock('../popup-widget/HandleAlertComp', () => ({
    default: () => '[Alert]',
}));
vi.mock('../toast/ToastComp', () => ({ default: () => '[Toast]' }));
vi.mock('../progress-bar/TopProgressBarComp', () => ({
    default: () => '[ProgressBar]',
}));
vi.mock('../app-document-list/AppDocumentPreviewFloatingComp', () => ({
    default: () => '[PreviewFloating]',
}));
vi.mock('../graph-view/GraphViewPanelsHostComp', () => ({
    default: () => '[GraphPanels]',
}));
vi.mock('../location-name-lookup/LocationNameDetailPanelsHostComp', () => ({
    default: () => '[NamePanels]',
}));

import { goToPath, toTitleExternal } from './routeHelpers';
import { useAppDocumentContextValues } from './layoutHelpers';
import LayoutTabRenderComp from './LayoutTabRenderComp';
import AppLayoutComp from './AppLayoutComp';
import PopupLayoutComp from './PopupLayoutComp';
import {
    SelectedEditingSlideContext,
    SelectedVaryAppDocumentContext,
} from '../app-document-list/appDocumentHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const START_URL = 'https://localhost:3000/presenter.html?screenId=1';

let container: HTMLDivElement;
let root: Root;
let fakeLocation: { href: string };

beforeEach(() => {
    mocks.provider.isPagePresenter = true;
    mocks.provider.isPageAppDocumentEditor = false;
    mocks.provider.isPageScreenMirror = false;
    mocks.provider.currentHomePage = '/presenter.html';
    mocks.provider.systemUtils.isDev = false;
    mocks.flags.isInjected = false;
    mocks.settings.clear();
    mocks.fileEvents.clear();
    mocks.checkIsAppDocumentSelected.mockResolvedValue(false);
    mocks.getSelectedVaryAppDocument.mockResolvedValue(null);
    mocks.getSelectedEditingSlide.mockResolvedValue(null);
    mocks.checkIsVaryAppDocumentSwitchRefused.mockReturnValue(false);
    fakeLocation = { href: START_URL };
    vi.stubGlobal('location', fakeLocation);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

describe('routeHelpers', () => {
    test('an external title is its icon then its words', () => {
        expect(
            renderToStaticMarkup(
                toTitleExternal('Presenter', { color: 'red' }),
            ),
        ).toBe('<span style="color:red">[icon:Presenter]Presenter </span>');
    });

    test('a path goes to that page and remembers the page it left', () => {
        goToPath('/reader.html');
        expect(fakeLocation.href).toBe(
            'https://localhost:3000/reader.html?screenId=1',
        );
        expect(mocks.settings.get('last-page-location')).toBe(
            '/presenter.html',
        );
    });

    test('no path goes back to the remembered page, else the Presenter', () => {
        mocks.provider.currentHomePage = '/reader.html';
        goToPath();
        expect(new URL(fakeLocation.href).pathname).toBe('/presenter.html');
        mocks.settings.set('last-page-location', '/slide-editor.html');
        goToPath();
        expect(new URL(fakeLocation.href).pathname).toBe('/slide-editor.html');
    });

    test('going to the page already open goes to the Presenter instead', () => {
        mocks.provider.currentHomePage = '/reader.html';
        goToPath('/reader.html');
        expect(new URL(fakeLocation.href).pathname).toBe('/presenter.html');
    });
});

describe('LayoutTabRenderComp', () => {
    function renderTabs() {
        act(() => {
            root.render(<LayoutTabRenderComp />);
        });
        return Array.from(container.querySelectorAll('li')).map((item) => {
            return item.querySelectorAll('button');
        });
    }

    async function press(button: HTMLButtonElement) {
        await act(async () => {
            button.click();
            await flush();
        });
    }

    test('the Presenter offers the editor, the Reader and Screen Mirror', () => {
        const tabs = renderTabs();
        expect(tabs.map((buttons) => buttons[0].textContent)).toEqual([
            '🖥️✏️Slide Editor ',
            '📖Bible Reader ',
            'Screen Mirror',
        ]);
        expect(tabs.map((buttons) => buttons[1]?.title ?? null)).toEqual([
            'Open Slide Editor in a new window',
            'Open Bible Reader in a new window',
            null,
        ]);
        expect(tabs[1][1].getAttribute('aria-label')).toBe(
            'Open Bible Reader in a new window',
        );
    });

    test('a plain tab navigates and the editor tab waits for a selected document', async () => {
        const tabs = renderTabs();
        await press(tabs[1][0]);
        expect(new URL(fakeLocation.href).pathname).toBe('/reader.html');

        fakeLocation.href = START_URL;
        await press(tabs[0][0]);
        expect(mocks.checkIsAppDocumentSelected).toHaveBeenCalledOnce();
        expect(fakeLocation.href).toBe(START_URL);

        mocks.checkIsAppDocumentSelected.mockResolvedValue(true);
        await press(tabs[0][0]);
        expect(new URL(fakeLocation.href).pathname).toBe('/slide-editor.html');

        fakeLocation.href = START_URL;
        await press(tabs[2][0]);
        expect(new URL(fakeLocation.href).pathname).toBe('/screen-mirror.html');
    });

    test('the open-in-a-new-window button opens a window and never navigates', async () => {
        const tabs = renderTabs();
        await press(tabs[1][1]);
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            '/reader.html',
            expect.stringMatching(/^reader_\d+$/),
            'reader',
        );
        expect(fakeLocation.href).toBe(START_URL);
    });

    test('a tab that opens by itself opens instead of navigating', async () => {
        mocks.provider.systemUtils.isDev = true;
        const tabs = renderTabs();
        expect(tabs.at(-1)?.[0].textContent).toBe(
            '[icon:(dev)Experiment](dev)Experiment ',
        );
        await press(tabs.at(-1)![0]);
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            '/experiment.html',
            expect.stringMatching(/^experiment_\d+$/),
            'experiment',
            { appBlinkFeatures: ['CanvasDrawElement'] },
        );
        expect(fakeLocation.href).toBe(START_URL);
    });
});

describe('AppLayoutComp and PopupLayoutComp', () => {
    function SelectionReaderComp() {
        const document = use(SelectedVaryAppDocumentContext);
        const slide = use(SelectedEditingSlideContext);
        return (
            <span id="selection">
                {document?.selectedVaryAppDocument?.filePath ?? 'none'}|
                {slide === null ? 'no-slide-context' : 'slide-context'}
            </span>
        );
    }

    async function renderLayout() {
        await act(async () => {
            root.render(
                <AppLayoutComp>
                    <SelectionReaderComp />
                </AppLayoutComp>,
            );
            await flush();
        });
    }

    test('the Presenter header carries the tabs, the lookup and its buttons', async () => {
        mocks.getSelectedVaryAppDocument.mockResolvedValue({
            filePath: '/docs/a.ows',
        });
        await renderLayout();
        const header = container.querySelector('#app-header') as HTMLElement;
        expect(header.querySelector('.nav-tabs')).not.toBeNull();
        expect(header.textContent).toContain(
            'lookup:false[StayAwake][Setting][Chatbot][AiChat][Help]',
        );
        expect(container.querySelector('#app-body')?.textContent).toBe(
            '/docs/a.ows|slide-context',
        );
        expect(container.textContent).toContain(
            '[PopupBibleLookup][ProgressBar][Toast][ContextMenu][Alert]' +
                '[PreviewFloating][NamePanels][GraphPanels]',
        );
    });

    test('the lookup toggle is held by the layout', async () => {
        await renderLayout();
        const toggle = container.querySelector(
            '#lookup-toggle',
        ) as HTMLButtonElement;
        act(() => {
            toggle.click();
        });
        expect(toggle.textContent).toBe('lookup:true');
        act(() => {
            toggle.click();
        });
        expect(toggle.textContent).toBe('lookup:false');
    });

    test('an injected document window has no tabs, no settings and no stay-awake', async () => {
        mocks.flags.isInjected = true;
        mocks.provider.isPagePresenter = false;
        await renderLayout();
        const header = container.querySelector('#app-header') as HTMLElement;
        expect(header.querySelector('.nav-tabs')).toBeNull();
        expect(header.textContent).toBe('lookup:false[Chatbot][AiChat][Help]');
    });

    test('a popup window wraps its page with the shared overlays only', () => {
        act(() => {
            root.render(
                <PopupLayoutComp>
                    <b>page</b>
                </PopupLayoutComp>,
            );
        });
        expect(container.innerHTML).toBe(
            '<div class="w-100 h-100 app-overflow-hidden"><b>page</b></div>' +
                '[ProgressBar][Toast][ContextMenu][Alert]',
        );
    });
});

class FakeSlide {
    constructor(
        public id: number,
        public value = 'saved',
    ) {}
    checkIsSame(other: FakeSlide | null) {
        return other?.id === this.id;
    }
    toJson() {
        return { id: this.id, value: this.value };
    }
}

function genDocument(slides: FakeSlide[], isEditable = true) {
    const document = {
        filePath: '/docs/song.ows',
        isAppDocument: true,
        isEditable,
        slides,
        getSlides: vi.fn(async () => document.slides),
        getSlideIndex: async (slide: FakeSlide) => {
            return document.slides.findIndex((item) => item.checkIsSame(slide));
        },
    };
    return document;
}

describe('useAppDocumentContextValues', () => {
    let values: ReturnType<typeof useAppDocumentContextValues>;

    function HostComp() {
        values = useAppDocumentContextValues();
        return null;
    }

    async function renderHost() {
        await act(async () => {
            root.render(<HostComp />);
            await flush();
        });
    }

    async function run(task: () => any) {
        await act(async () => {
            await task();
            await flush();
        });
    }

    async function selectDocument(document: any) {
        let isApplied: boolean | undefined;
        await run(async () => {
            isApplied =
                await values.varyAppDocumentContextValue.setSelectedVaryAppDocument(
                    document,
                );
        });
        return isApplied;
    }

    function getEditing() {
        return values.editingSlideContextValue;
    }

    async function selectSlide(slide: FakeSlide | null, controlType?: any) {
        await run(() => {
            return getEditing().setSelectedSlide(slide as any, controlType);
        });
    }

    function heldIds() {
        return getEditing().holdingSlides.map((slide: any) => slide.id);
    }

    function fireUpdate(data?: any) {
        return run(() => mocks.fileEvents.get('update')?.callback(data));
    }

    const slides = [0, 1, 2, 3, 4].map((id) => new FakeSlide(id));

    test('off the editor page the editing value is inert and keys go on with nothing held', async () => {
        const document = genDocument(slides);
        await renderHost();
        await selectDocument(document);
        expect(getEditing().selectedSlideEditing).toBeNull();
        expect(getEditing().holdingSlides).toEqual([]);
        await selectSlide(slides[2], 'Ctrl');
        expect(getEditing().holdingSlides).toEqual([]);
        const event = { key: 'ArrowDown' };
        getEditing().onSlideItemsKeyboardEvent(event as any);
        expect(mocks.onSlideItemsKeyboardEvent).toHaveBeenCalledWith(
            {
                holdingSlides: [],
                setHoldingSlides: expect.any(Function),
                varyAppDocument: document,
                selectedSlideEditing: null,
            },
            event,
        );
    });

    test('an editable document opens on its first slide, a read-only one on none', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        expect(await selectDocument(genDocument(slides))).toBe(true);
        expect(getEditing().selectedSlideEditing).toBe(slides[0]);
        expect(mocks.setSelectedEditingSlide).toHaveBeenLastCalledWith(
            slides[0],
        );
        await selectDocument(genDocument(slides, false));
        expect(getEditing().selectedSlideEditing).toBeNull();
        await selectDocument(genDocument([]));
        expect(getEditing().selectedSlideEditing).toBeNull();
    });

    test('Ctrl adds and removes held slides, but never lets go of the current one', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        await selectDocument(genDocument(slides));
        await selectSlide(slides[2], 'Ctrl');
        await selectSlide(slides[3], 'Ctrl');
        expect(heldIds()).toEqual([2, 3]);
        await selectSlide(slides[2], 'Ctrl');
        expect(heldIds()).toEqual([3]);
        await selectSlide(slides[0], 'Ctrl');
        expect(heldIds()).toEqual([3, 0]);
        await selectSlide(slides[0], 'Ctrl');
        expect(heldIds()).toEqual([3, 0]);
        // A plain press picks one slide and lets go of the rest.
        await selectSlide(slides[1]);
        expect(getEditing().selectedSlideEditing).toBe(slides[1]);
        expect(heldIds()).toEqual([]);
    });

    test('Shift holds the run between the current slide and the pressed one', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        await selectDocument(genDocument(slides));
        await selectSlide(slides[3], 'Shift');
        expect(heldIds()).toEqual([0, 1, 2, 3]);
        await selectSlide(slides[4]);
        await selectSlide(slides[1], 'Shift');
        expect(heldIds()).toEqual([1, 2, 3, 4]);
    });

    test('Shift with no current slide holds the pressed one alone', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        await selectDocument(genDocument(slides));
        await selectSlide(null);
        await selectSlide(slides[2], 'Shift');
        expect(heldIds()).toEqual([2]);
    });

    test('a slide from another document, either end, leaves what is held', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        await selectDocument(genDocument(slides));
        await selectSlide(slides[2], 'Ctrl');
        await selectSlide(new FakeSlide(99), 'Shift');
        expect(heldIds()).toEqual([2]);
        await selectSlide(new FakeSlide(98));
        await selectSlide(slides[2], 'Ctrl');
        await selectSlide(slides[1], 'Shift');
        expect(heldIds()).toEqual([2]);
    });

    test('a held selection needs a slide and a slide document', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        await renderHost();
        await selectDocument(genDocument(slides));
        await selectSlide(null, 'Ctrl');
        expect(heldIds()).toEqual([]);
        await selectDocument({ filePath: '/docs/a.pdf' });
        await selectSlide(slides[1], 'Ctrl');
        expect(heldIds()).toEqual([]);
    });

    test('on the editor page the keys see what is held and the editing slide', async () => {
        mocks.provider.isPageAppDocumentEditor = true;
        const document = genDocument(slides);
        await renderHost();
        await selectDocument(document);
        await selectSlide(slides[2], 'Ctrl');
        const event = { key: 'Delete' };
        getEditing().onSlideItemsKeyboardEvent(event as any);
        const [context] = mocks.onSlideItemsKeyboardEvent.mock.calls.at(-1)!;
        expect(context.varyAppDocument).toBe(document);
        expect(context.selectedSlideEditing).toBe(slides[0]);
        expect(context.holdingSlides.map((slide: any) => slide.id)).toEqual([
            2,
        ]);
        await run(() => context.setHoldingSlides([slides[4]]));
        expect(heldIds()).toEqual([4]);
    });

    describe('a change to the selected document on disk', () => {
        async function renderEditing() {
            mocks.provider.isPageAppDocumentEditor = true;
            const document = genDocument(
                [0, 1, 2].map((id) => new FakeSlide(id)),
            );
            await renderHost();
            await selectDocument(document);
            await selectSlide(document.slides[1]);
            document.getSlides.mockClear();
            return document;
        }

        test('is listened to on that document', async () => {
            const document = await renderEditing();
            expect(mocks.fileEvents.get('update')?.filePath).toBe(
                document.filePath,
            );
        });

        test('an own edit echo is ignored, a history move refreshes the editing slide', async () => {
            const document = await renderEditing();
            const before = getEditing().selectedSlideEditing;
            await fireUpdate({ isHistoryEditing: true, eventType: 'edit' });
            expect(document.getSlides).not.toHaveBeenCalled();
            expect(getEditing().selectedSlideEditing).toBe(before);

            document.slides = [0, 1, 2].map((id) => new FakeSlide(id));
            await fireUpdate({ isHistoryEditing: true, eventType: 'undo' });
            expect(getEditing().selectedSlideEditing).toBe(document.slides[1]);
        });

        test('the same saved value keeps the live slide, a changed one replaces it', async () => {
            const document = await renderEditing();
            const before = getEditing().selectedSlideEditing;
            document.slides = [0, 1, 2].map((id) => new FakeSlide(id));
            await fireUpdate();
            expect(document.getSlides).toHaveBeenCalledOnce();
            expect(getEditing().selectedSlideEditing).toBe(before);

            document.slides = [
                new FakeSlide(0),
                new FakeSlide(1, 'changed elsewhere'),
            ];
            await fireUpdate();
            expect(getEditing().selectedSlideEditing).toBe(document.slides[1]);
        });

        test('a slide that is gone falls back to the first, or to none', async () => {
            const document = await renderEditing();
            document.slides = [new FakeSlide(7), new FakeSlide(8)];
            await fireUpdate();
            expect(getEditing().selectedSlideEditing).toBe(document.slides[0]);
            document.slides = [];
            await fireUpdate();
            expect(getEditing().selectedSlideEditing).toBeNull();
        });

        test('a song or a document that is not editable is left alone', async () => {
            mocks.provider.isPageAppDocumentEditor = true;
            const song = genDocument(slides, false);
            await renderHost();
            await fireUpdate();
            await selectDocument(song);
            song.getSlides.mockClear();
            await fireUpdate();
            expect(song.getSlides).not.toHaveBeenCalled();
            await selectDocument({ filePath: '/docs/a.pdf' });
            await fireUpdate();
            expect(getEditing().selectedSlideEditing).toBeNull();
        });
    });
});
