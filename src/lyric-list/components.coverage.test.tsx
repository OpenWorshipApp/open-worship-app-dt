// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One mock surface for the lyric folder's components and hooks. What is REAL
// here: the components under test, `LyricManager`, the stage-style store and
// helpers, the warm-slides store, the Stage Previewer header, `EventHandler`,
// `appHooks` and `genTimeoutAttempt`. Everything that would reach the disk,
// open-lyric, a window or the screens is faked below.
const { mocks, state } = vi.hoisted(() => ({
    mocks: {
        handleError: vi.fn(),
        showAppContextMenu: vi.fn(),
        notifyElementHighlight: vi.fn(),
        openPopupWindow: vi.fn(),
        bringDomToCenterView: vi.fn(),
        initOpenLyric: vi.fn(),
        applyOpenLyricTheme: vi.fn(),
        notifyLyricElement: vi.fn(),
        lyricGetInstance: vi.fn(),
        exportLyricStagesToPptx: vi.fn(),
        genDocumentTransitionMenuItems: vi.fn(),
        showVaryAppDocument: vi.fn(),
        handleAppDocumentDragStart: vi.fn(),
        exportAppDocument: vi.fn(),
        checkHandleOpenSlidesPreviewClicking: vi.fn(),
        closeAppDocumentPreviewFloating: vi.fn(),
        openSlidesPreview: vi.fn(),
        openLyricInLongTextShow: vi.fn(),
        openLyricInChatbot: vi.fn(),
        checkIsOnScreen: vi.fn(),
        setSelected: vi.fn(),
    },
    state: {
        settings: new Map<string, string>(),
        settingWrites: [] as [string, string][],
        settingRemovals: [] as string[],
        contents: new Map<string, string>(),
        log: [] as string[],
        isDarkMode: false,
        canSave: false,
        isShowingPreviewer: false,
        screenManagers: [] as { stage: number; isDeleted: boolean }[],
        fileItemPropsList: [] as any[],
        getFileSource: null as unknown as (filePath: string) => any,
        getStageDoc: null as unknown as (
            filePath: string,
            stage: number,
        ) => any,
        getLyricAppDocument: null as unknown as (filePath: string) => any,
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: {},
        isPageScreen: false,
        lyricEditorHomePage: '/lyric-editor.html',
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => mocks.handleError(...args),
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useCallback, useState } = await import('react');
    const writeSetting = (key: string, value: string) => {
        state.settings.set(key, value);
        state.settingWrites.push([key, value]);
    };
    return {
        getSetting: (key: string) => state.settings.get(key) ?? null,
        setSetting: (key: string, value: string | null) => {
            writeSetting(key, value ?? '');
        },
        removeSetting: (key: string) => {
            state.settings.delete(key);
            state.settingRemovals.push(key);
        },
        useStateSettingString: (settingName: string, defaultString = '') => {
            const [data, setData] = useState(
                () => state.settings.get(settingName) || defaultString,
            );
            const setDataSetting = useCallback(
                (text: string) => {
                    setData(text);
                    writeSetting(settingName, text);
                },
                [settingName],
            );
            return [data, setDataSetting];
        },
        useStateSettingBooleanSynced: (
            settingName: string,
            defaultValue = false,
        ) => {
            const [data, setData] = useState(() => {
                const value = state.settings.get(settingName);
                return value === undefined ? defaultValue : value === 'true';
            });
            const setDataSetting = useCallback(
                (value: boolean) => {
                    setData(value);
                    writeSetting(settingName, `${value}`);
                },
                [settingName],
            );
            return [data, setDataSetting];
        },
    };
});
vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: (...args: any[]) => {
        return mocks.notifyElementHighlight(...args);
    },
    openPopupWindow: (...args: any[]) => mocks.openPopupWindow(...args),
    setParamFileFullName: (url: string, fileFullName: string) => {
        return `${url}?file=${encodeURIComponent(fileFullName)}`;
    },
    setParamIdNum: (url: string, id: number) => `${url}&id=${id}`,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToCenterView: (...args: any[]) => {
        return mocks.bringDomToCenterView(...args);
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => state.getFileSource(filePath),
    },
}));
vi.mock('../helper/dirSourceHelpers', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        // The real hook's contract: listen on the file's OWN source, re-arm
        // when the deps move, release on unmount.
        useFileSourceEvents: (
            events: string[],
            callback: (...args: any[]) => any,
            deps: unknown[] = [],
            filePath?: string,
        ) => {
            const callbackRef = useRef(callback);
            callbackRef.current = callback;
            useEffect(() => {
                const fileSource = state.getFileSource(filePath!);
                const registered = fileSource.registerEventListener(
                    events,
                    (...args: any[]) => callbackRef.current(...args),
                );
                return () => {
                    fileSource.unregisterEventListener(registered);
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [filePath, ...deps]);
        },
    };
});
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
    useIsDarkMode: () => state.isDarkMode,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span>Loading panel</span>,
}));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title, setValue, defaultSize }: any) => (
        <input
            type="range"
            aria-label={title}
            min={defaultSize.min}
            max={defaultSize.max}
            step={defaultSize.step}
            data-default-size={defaultSize.size}
            value={value}
            onChange={(event) => {
                setValue(Number(event.target.value));
            }}
        />
    ),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({ title, persistKey, onClose, children }: any) => (
        <section role="dialog" aria-label={title} data-persist-key={persistKey}>
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (...args: any[]) => mocks.showAppContextMenu(...args),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: any) => (
        <button
            type="button"
            aria-label="Lyric menu"
            onClick={(event) => onOpening(event)}
        >
            ⋮
        </button>
    ),
}));
vi.mock('../resize-actor/ResizeActorComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ flexSizeName, flexSizeDefault, dataInput }: any) => (
            <div
                className="fake-resize-actor"
                data-flex-size-name={flexSizeName}
                data-flex-size-default={JSON.stringify(flexSizeDefault)}
            >
                {dataInput.map((item: any) => {
                    const LazyChildComp = item.children;
                    return (
                        <section
                            key={item.key}
                            data-key={item.key}
                            data-widget-name={item.widgetName}
                            data-widget-key={item.widgetKey ?? ''}
                            data-widget-icon={item.widgetIconName ?? ''}
                        >
                            {'render' in item.children ? (
                                item.children.render()
                            ) : (
                                <Suspense fallback={<span>Loading pane</span>}>
                                    <LazyChildComp />
                                </Suspense>
                            )}
                        </section>
                    );
                })}
            </div>
        ),
    };
});
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext, use } = await import('react');
    const SelectedVaryAppDocumentContext = createContext<any>(null);
    return {
        VaryAppDocumentContext: createContext<any>(null),
        SelectedVaryAppDocumentContext,
        useSelectedAppDocumentSetterContext: () => {
            const context = use(SelectedVaryAppDocumentContext);
            if (context === null) {
                throw new Error('No SelectedVaryAppDocumentContext found');
            }
            return context.setSelectedVaryAppDocument;
        },
        checkIsVaryAppDocumentFilePathOnScreen: (...args: any[]) => {
            return mocks.checkIsOnScreen(...args);
        },
        genEditSlideContextMenuItem: (onSelect: () => void) => ({
            menuElement: 'Edit',
            onSelect,
        }),
    };
});
vi.mock('../app-document-presenter/items/VarySlidesPreviewerComp', async () => {
    const { use } = await import('react');
    const { VaryAppDocumentContext } =
        await import('../app-document-list/appDocumentHelpers');
    return {
        default: function FakeVarySlidesPreviewerComp() {
            const lyricAppDocument: any = use(VaryAppDocumentContext);
            return (
                <div
                    className="fake-slides"
                    data-doc={`${lyricAppDocument.filePath}#${lyricAppDocument.stage}`}
                />
            );
        },
    };
});
vi.mock('../app-document-presenter/items/varyAppDocumentHelpers', () => ({
    ON_SLIDE_ITEM_SELECTED_EVENT: 'on-slide-item-selected',
}));
vi.mock('../_screen/screenHelpers', () => ({
    getStageAccentColor: (stage: number) => `var(--stage-${stage})`,
    STAGE_NUMBER_CHOICE_COUNT: 6,
}));
vi.mock('../_screen/managers/ScreenManagerBase', async () => {
    const { default: EventHandler } = await vi.importActual<any>(
        '../event/EventHandler',
    );
    class FakeScreenManagerBase extends EventHandler {
        static readonly eventNamePrefix: string = 'screen-manager-base';
    }
    return { default: FakeScreenManagerBase };
});
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => state.screenManagers,
}));
vi.mock('./lyricHelpers', () => ({
    initOpenLyric: (...args: any[]) => mocks.initOpenLyric(...args),
    applyOpenLyricTheme: (...args: any[]) => {
        return mocks.applyOpenLyricTheme(...args);
    },
    getLyricAppDocumentStageByStage: (filePath: string, stage: number) => {
        return [stage, state.getStageDoc(filePath, stage)];
    },
}));
vi.mock('./LyricSlide', () => ({
    INDEX_CLASSNAME_PREFIX: 'ol-slide--lyric-index',
    default: class FakeLyricSlide {
        static notifyLyricElement(index: number, root: HTMLElement | null) {
            mocks.notifyLyricElement(index, root);
        }
    },
}));
vi.mock('./Lyric', () => ({
    default: {
        getInstance: (filePath: string) => mocks.lyricGetInstance(filePath),
    },
}));
vi.mock('./LyricAppDocument', () => ({
    default: {
        getInstance: (filePath: string) => state.getLyricAppDocument(filePath),
    },
}));
vi.mock('./lyricPptxExportHelpers', () => ({
    exportLyricStagesToPptx: (...args: any[]) => {
        return mocks.exportLyricStagesToPptx(...args);
    },
}));
vi.mock('../others/slideTransitionMenuHelpers', () => ({
    genDocumentTransitionMenuItems: (...args: any[]) => {
        return mocks.genDocumentTransitionMenuItems(...args);
    },
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    default: (props: any) => {
        state.fileItemPropsList.push(props);
        return (
            <article
                data-index={props.index}
                data-file-path={props.filePath}
                data-selected={String(props.isSelected)}
            >
                {props.contextMenuItems.map((item: any, index: number) => (
                    <button
                        type="button"
                        key={index}
                        className="fake-menu-item"
                        onClick={() => item.onSelect()}
                    >
                        {item.menuElement}
                    </button>
                ))}
                {props.fileData ? (
                    props.renderChild(props.fileData)
                ) : (
                    <span>No lyric yet</span>
                )}
            </article>
        );
    },
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: {
        showVaryAppDocument: (...args: any[]) => {
            return mocks.showVaryAppDocument(...args);
        },
    },
}));
vi.mock('../editing-manager/editingHelpers', () => ({
    useEditingHistoryStatus: () => ({ canSave: state.canSave }),
}));
vi.mock('../app-document-presenter/presenterRendererHelpers', () => ({
    getIsShowingVaryAppDocumentPreviewer: () => state.isShowingPreviewer,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleAppDocumentDragStart: (...args: any[]) => {
        return mocks.handleAppDocumentDragStart(...args);
    },
}));
vi.mock('../app-document-list/appDocumentArchiveHelpers', () => ({
    exportAppDocument: (...args: any[]) => mocks.exportAppDocument(...args),
}));
vi.mock('../app-document-list/appDocumentPreviewFloatingHelpers', () => ({
    checkHandleOpenSlidesPreviewClicking: (...args: any[]) => {
        return mocks.checkHandleOpenSlidesPreviewClicking(...args);
    },
    closeAppDocumentPreviewFloating: (...args: any[]) => {
        return mocks.closeAppDocumentPreviewFloating(...args);
    },
    genOpenSlidesPreviewContextMenu: (
        filePath: string,
        isSelected: boolean,
    ) => ({
        menuElement: 'Open Slides Preview',
        onSelect: () => mocks.openSlidesPreview(filePath, isSelected),
    }),
}));
vi.mock('../presenter-foreground/foregroundLongTextOpenHelpers', () => ({
    openLyricInLongTextShow: (...args: any[]) => {
        return mocks.openLyricInLongTextShow(...args);
    },
}));
// The help window's item is a leaf of its own; here it is always offered.
vi.mock('../helper/ai/lyricChatbotMenuHelpers', () => ({
    genLyricOpenInChatbotContextMenu: (filePath: string) => [
        {
            menuElement: 'Open in Chatbot',
            onSelect: () => mocks.openLyricInChatbot(filePath),
        },
    ],
}));

import EventHandler, { BasicEventHandler } from '../event/EventHandler';
import ScreenManagerBase from '../_screen/managers/ScreenManagerBase';
import {
    SelectedVaryAppDocumentContext,
    type SelectedAppDocumentContextType,
} from '../app-document-list/appDocumentHelpers';
import type { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import { bringDomToCenterView } from '../helper/helpers';
import LyricFileComp from './LyricFileComp';
import LyricHandlerComp from './LyricHandlerComp';
import LyricManager, {
    LyricManagerContext,
    useLyricManagerContext,
} from './LyricManager';
import LyricRenderPreviewBodyComp from './LyricRenderPreviewBodyComp';
import LyricSlidesPreviewerComp from './LyricSlidesPreviewerComp';
import LyricStageStyleComp from './LyricStageStyleComp';
import LyricStageStyleFloatingComp from './LyricStageStyleFloatingComp';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import {
    closeLyricStageStyleFloating,
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';
import { getHeldOpenLyric } from './lyricWarmSlidesHelpers';
import {
    getLyricWarmStages,
    useLyricWarmSlides,
    warmLyricStages,
} from './useLyricWarmSlides';

const SONG_PATH = '/songs/Amazing Grace.owl';

class FakeFileSource extends BasicEventHandler<string> {
    constructor(readonly filePath: string) {
        super();
    }
    get fullName() {
        return this.filePath.split('/').pop() ?? '';
    }
    get name() {
        return this.fullName.replace(/\.[^.]+$/, '');
    }
    fireUpdateEvent() {
        this.addPropEvent('update');
    }
}

// open-lyric's previewer as this folder uses it: a `value` it re-renders on
// write (logged, so a skipped write shows), a `container` it mounts into.
class FakeOpenLyric {
    private _value = '';
    container: HTMLElement | null = null;
    mountCount = 0;
    reloadCount = 0;
    constructor(readonly name: string) {}
    get value() {
        return this._value;
    }
    set value(newValue: string) {
        state.log.push(`value:${this.name}:${newValue}`);
        this._value = newValue;
    }
    mount() {
        this.mountCount += 1;
        this.container!.innerHTML =
            '<div class="ol-song-view__sections">' +
            '<section>Verse 1</section>' +
            '<section><span class="ol-line">Chorus</span></section>' +
            '</div>';
    }
    reload() {
        this.reloadCount += 1;
    }
}

// A stage document as the previewer and the warm-up use it.
class FakeStageDoc {
    openLyric: any = null;
    warmDeck: unknown = null;
    buildSlides: (() => Promise<void>) | null = null;
    constructor(
        readonly filePath: string,
        readonly stage: number,
    ) {}
    clearCache() {
        state.log.push(`clear:${this.stage}`);
    }
    getWarmDeck() {
        return this.warmDeck;
    }
    async getSlides() {
        state.log.push(`warm:${this.stage}`);
        if (this.buildSlides !== null) {
            await this.buildSlides();
        }
        return [];
    }
}

const fileSources = new Map<string, FakeFileSource>();
const stageDocs = new Map<string, FakeStageDoc>();
const lyricAppDocuments = new Map<string, any>();
state.getFileSource = (filePath) => {
    let fileSource = fileSources.get(filePath);
    if (fileSource === undefined) {
        fileSource = new FakeFileSource(filePath);
        fileSources.set(filePath, fileSource);
    }
    return fileSource;
};
state.getStageDoc = (filePath, stage) => {
    const key = `${filePath}#${stage}`;
    let doc = stageDocs.get(key);
    if (doc === undefined) {
        doc = new FakeStageDoc(filePath, stage);
        stageDocs.set(key, doc);
    }
    return doc;
};
state.getLyricAppDocument = (filePath) => {
    let doc = lyricAppDocuments.get(filePath);
    if (doc === undefined) {
        doc = { filePath, kind: 'lyric-app-document' };
        lyricAppDocuments.set(filePath, doc);
    }
    return doc;
};

function genLyric(filePath = SONG_PATH) {
    return {
        filePath,
        fileSource: state.getFileSource(filePath),
        getContent: async () => state.contents.get(filePath) ?? '',
    };
}

function genManager(name = 'main', filePath = SONG_PATH) {
    const lyric = genLyric(filePath);
    const openLyric = new FakeOpenLyric(name);
    const manager = new LyricManager(lyric as any, openLyric as any);
    return { lyric, openLyric, manager };
}

const mounted: Root[] = [];
const openedOwnerIds: string[] = [];

async function mount(node: ReactNode) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mounted.push(root);
    await act(async () => {
        root.render(node);
    });
    return { host, root };
}

async function unmount(root: Root) {
    const index = mounted.indexOf(root);
    if (index !== -1) {
        mounted.splice(index, 1);
    }
    await act(async () => {
        root.unmount();
    });
}

async function flushMicrotasks() {
    for (let i = 0; i < 12; i++) {
        await Promise.resolve();
    }
}

// Lazy panes resolve through a dynamic import, then React retries them.
async function settle() {
    await act(async () => {
        await vi.dynamicImportSettled();
        await flushMicrotasks();
    });
    await act(async () => {
        await flushMicrotasks();
    });
}

async function advance(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

async function fireFileUpdate(filePath = SONG_PATH) {
    await act(async () => {
        state.getFileSource(filePath).fireUpdateEvent();
        await flushMicrotasks();
    });
}

function setNativeValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
) {
    const prototype =
        element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
        element,
        value,
    );
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(container: ParentNode, text: string) {
    const button = [...container.querySelectorAll('button')].find((element) => {
        return element.textContent?.trim() === text;
    });
    expect(button, `button "${text}"`).toBeDefined();
    return button!;
}

function getByLabel<T extends Element = HTMLElement>(
    container: ParentNode,
    label: string,
) {
    const element = container.querySelector<T & Element>(
        `[aria-label="${label}"]`,
    );
    expect(element, `[aria-label="${label}"]`).not.toBeNull();
    return element as T;
}

function getLastMenuItems() {
    const lastCall = mocks.showAppContextMenu.mock.calls.at(-1);
    expect(lastCall, 'a context menu was shown').toBeDefined();
    return lastCall![1] as any[];
}

function selectMenuItem(items: any[], menuElement: string) {
    const item = items.find((each) => each.menuElement === menuElement);
    expect(item, `menu item "${menuElement}"`).toBeDefined();
    return item;
}

function readStyleWrite(index: number) {
    const [key, raw] = state.settingWrites[index];
    return { key, style: JSON.parse(raw) };
}

const DEFAULT_STYLE = {
    marginHorizontalPercentage: 2,
    marginVerticalPercentage: 2,
    isMarginLinked: true,
    boxVerticalAlignment: 'center',
    boxHorizontalAlignment: 'center',
    backgroundAlphaPercentage: 50,
    extraFontSize: 45,
    theme: 'light',
    customCss: '',
};

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    state.settings.clear();
    state.settingWrites.length = 0;
    state.settingRemovals.length = 0;
    state.contents.clear();
    state.log.length = 0;
    state.isDarkMode = false;
    state.canSave = false;
    state.isShowingPreviewer = false;
    state.screenManagers = [];
    state.fileItemPropsList.length = 0;
    fileSources.clear();
    stageDocs.clear();
    lyricAppDocuments.clear();
    mocks.lyricGetInstance.mockImplementation((filePath: string) => {
        return genLyric(filePath);
    });
    mocks.genDocumentTransitionMenuItems.mockResolvedValue([]);
    mocks.checkHandleOpenSlidesPreviewClicking.mockReturnValue(false);
    mocks.setSelected.mockResolvedValue(true);
});

afterEach(async () => {
    for (const root of [...mounted].reverse()) {
        await unmount(root);
    }
    for (const ownerId of openedOwnerIds.splice(0)) {
        closeLyricStageStyleFloating(ownerId);
    }
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('lyricContextMenuHelpers and lyricEditorHelpers', () => {
    test('Reload is one labelled, iconed item around the caller action', () => {
        const onSelect = vi.fn();
        const item = genLyricReloadContextMenuItem(onSelect);
        expect(item.menuElement).toBe('Reload');
        expect(item.onSelect).toBe(onSelect);
        expect(renderToStaticMarkup(item.childBefore as any)).toContain(
            'bi bi-arrow-clockwise',
        );
    });

    test('the lyric editor opens on the song, and on one slide of it', () => {
        mocks.openPopupWindow.mockReturnValue('popup-handle');
        const lyric = genLyric();
        const openedAt = Date.now();
        expect(openPopupLyricEditorWindow(lyric as any)).toBe('popup-handle');
        expect(mocks.openPopupWindow).toHaveBeenLastCalledWith(
            '/lyric-editor.html?file=Amazing%20Grace.owl',
            `Amazing Grace.owl_${openedAt}`,
            'lyric-editor',
        );
        openPopupLyricEditorWindow(lyric as any, 3);
        expect(mocks.openPopupWindow).toHaveBeenLastCalledWith(
            '/lyric-editor.html?file=Amazing%20Grace.owl&id=3',
            `Amazing Grace.owl_${openedAt}`,
            'lyric-editor',
        );
    });
});

describe('LyricManager', () => {
    function genContainer(openLyric: FakeOpenLyric) {
        const container = document.createElement('div');
        const body = document.createElement('div');
        container.append(body);
        document.body.append(container);
        openLyric.container = body;
        openLyric.mount();
        return container;
    }

    test('reads the song through its lyric and previewer', () => {
        const { manager, lyric, openLyric } = genManager();
        expect(manager.filePath).toBe(SONG_PATH);
        expect(manager.fileSource).toBe(lyric.fileSource);
        expect(manager.openLyricPreviewer).toBe(openLyric);
        // No container yet: the constructor's install is a no-op, and there
        // is no rendered song to look a section up in.
        expect(manager.containerElement).toBeNull();
        expect(manager.previewPanel).toBeNull();
        openLyric.container = document.createElement('div');
        expect(manager.previewPanel).toBeNull();
        openLyric.mount();
        expect(manager.previewPanel?.className).toBe('ol-song-view__sections');
    });

    test('a click on a rendered section reports that section index', () => {
        const { manager, openLyric } = genManager();
        const container = genContainer(openLyric);
        const onSectionSelected = vi.fn();
        manager.containerElement = container;
        manager.onSectionSelected = onSectionSelected;
        manager.initLyricPreviewEvent();

        container.querySelector<HTMLElement>('.ol-line')!.click();
        expect(onSectionSelected).toHaveBeenCalledWith(1);
        container.querySelector<HTMLElement>('section')!.click();
        expect(onSectionSelected).toHaveBeenLastCalledWith(0);

        // A click outside every section, or one with no node behind it, is
        // not the song's.
        onSectionSelected.mockClear();
        container.click();
        // jsdom 23 implements no `PointerEvent`; the handler reads only
        // `target`, which an event never dispatched leaves `null`.
        container.onclick!(new MouseEvent('click') as PointerEvent);
        expect(onSectionSelected).not.toHaveBeenCalled();

        // With nothing listening the click is still harmless.
        manager.onSectionSelected = null;
        expect(() => {
            container.querySelector<HTMLElement>('.ol-line')!.click();
        }).not.toThrow();

        // The previewer unmounted its song: nothing to resolve a click in.
        manager.onSectionSelected = onSectionSelected;
        openLyric.container = null;
        container.querySelector<HTMLElement>('.ol-line')!.click();
        expect(onSectionSelected).not.toHaveBeenCalled();
    });

    test('a section is scrolled into view and flashed by its index', () => {
        const { manager, openLyric } = genManager();
        manager.notifyLyricElement(0);
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();

        const container = genContainer(openLyric);
        manager.notifyLyricElement(1);
        expect(mocks.notifyElementHighlight).toHaveBeenCalledTimes(1);
        const [getTarget, options] = mocks.notifyElementHighlight.mock.calls[0];
        expect(getTarget()).toBe(container.querySelectorAll('section')[1]);
        expect(options).toEqual({ moveToView: bringDomToCenterView });

        // An index no section answers to (an extra slide's) does nothing.
        manager.notifyLyricElement(5);
        expect(mocks.notifyElementHighlight).toHaveBeenCalledTimes(1);
    });

    test('the previewer is re-fed only when the text on disk moved', async () => {
        const { manager, openLyric } = genManager();
        state.contents.set(SONG_PATH, '');
        await manager.refreshOpenLyricContent();
        expect(state.log).toEqual([]);
        state.contents.set(SONG_PATH, 'Amazing grace');
        await manager.refreshOpenLyricContent();
        await manager.refreshOpenLyricContent();
        expect(state.log).toEqual(['value:main:Amazing grace']);
        expect(openLyric.value).toBe('Amazing grace');
    });

    test('destroy lets go of the element and the listener', () => {
        const { manager, openLyric } = genManager();
        expect(() => manager.destroy()).not.toThrow();
        const container = genContainer(openLyric);
        manager.containerElement = container;
        manager.onSectionSelected = vi.fn();
        manager.initLyricPreviewEvent();
        expect(container.onclick).not.toBeNull();
        manager.destroy();
        expect(container.onclick).toBeNull();
        expect(manager.containerElement).toBeNull();
        expect(manager.onSectionSelected).toBeNull();
    });

    test('the context hook refuses to run outside a provider', () => {
        function BareConsumerComp() {
            useLyricManagerContext();
            return null;
        }
        expect(() => renderToStaticMarkup(<BareConsumerComp />)).toThrow(
            'useLyricManagerContext must be used within a LyricManagerProvider',
        );
    });
});

describe('lyricStageStyleFloatingHelpers', () => {
    function OpenStageProbeComp({ ownerId }: Readonly<{ ownerId: string }>) {
        const stage = useLyricStageStyleFloatingStage(ownerId);
        return <output>{stage === null ? 'none' : `stage ${stage}`}</output>;
    }

    test('one panel at a time, owned by the previewer that opened it', async () => {
        const ownerA = genLyricStageStyleFloatingOwnerId();
        const ownerB = genLyricStageStyleFloatingOwnerId();
        openedOwnerIds.push(ownerA, ownerB);
        expect(ownerA).toMatch(/^lyric-stage-style-owner-\d+$/);
        expect(ownerB).not.toBe(ownerA);
        const { host: hostA } = await mount(
            <OpenStageProbeComp ownerId={ownerA} />,
        );
        const { host: hostB } = await mount(
            <OpenStageProbeComp ownerId={ownerB} />,
        );
        expect(hostA.textContent).toBe('none');

        await act(async () => toggleLyricStageStyleFloatingStage(ownerA, 1));
        expect(hostA.textContent).toBe('stage 1');
        expect(hostB.textContent).toBe('none');

        // Another chip retargets the open panel instead of opening a second.
        await act(async () => toggleLyricStageStyleFloatingStage(ownerA, 3));
        expect(hostA.textContent).toBe('stage 3');

        // A host that does not own the panel cannot close it.
        await act(async () => closeLyricStageStyleFloating(ownerB));
        expect(hostA.textContent).toBe('stage 3');

        // The other previewer's gear takes the single slot over.
        await act(async () => toggleLyricStageStyleFloatingStage(ownerB, 3));
        expect(hostA.textContent).toBe('none');
        expect(hostB.textContent).toBe('stage 3');

        // The same gear twice closes it.
        await act(async () => toggleLyricStageStyleFloatingStage(ownerB, 3));
        expect(hostB.textContent).toBe('none');

        await act(async () => toggleLyricStageStyleFloatingStage(ownerA, 2));
        await act(async () => closeLyricStageStyleFloating(ownerA));
        expect(hostA.textContent).toBe('none');
    });
});

describe('LyricStageStyleComp', () => {
    function getRange(container: ParentNode, title: string) {
        return getByLabel<HTMLInputElement>(container, title);
    }

    async function slide(container: ParentNode, title: string, value: number) {
        await act(async () => {
            setNativeValue(getRange(container, title), String(value));
        });
    }

    function getCssBox(container: ParentNode) {
        return container.querySelector<HTMLTextAreaElement>(
            '#lyric-stage-style-custom-css',
        )!;
    }

    test('opens on the stage saved style', async () => {
        state.settings.set(
            'lyric-stage-style-2',
            JSON.stringify({
                paddingPercentage: 5,
                backgroundAlphaPercentage: 30,
                extraFontSize: 60,
                theme: 'dark',
                customCss: '.ol-preview-line { color: red; }',
            }),
        );
        const { host } = await mount(
            <LyricStageStyleComp stage={2} onChanged={vi.fn()} />,
        );
        expect(host.textContent).toContain('Applies to every song');
        expect(host.textContent).toContain(
            'Custom CSS is added after this stage own style',
        );
        // A record from before the margin was split: its one side, doubled.
        for (const label of ['Horizontal Margin (%)', 'Vertical Margin (%)']) {
            const margin = getRange(host, label);
            expect(margin.value).toBe('10');
            expect([
                margin.min,
                margin.max,
                margin.dataset.defaultSize,
            ]).toEqual(['0', '99', '2']);
        }
        const alpha = getRange(host, 'Background Opacity (%)');
        expect(alpha.value).toBe('30');
        expect([alpha.max, alpha.dataset.defaultSize]).toEqual(['100', '50']);
        const font = getRange(host, 'Extra Font Size');
        expect(font.value).toBe('60');
        expect([font.max, font.dataset.defaultSize]).toEqual(['200', '45']);
        const dark = findButton(host, 'Dark');
        const light = findButton(host, 'Light');
        expect(dark.getAttribute('aria-pressed')).toBe('true');
        expect(dark.className).toBe('btn btn-sm btn-info');
        expect(light.getAttribute('aria-pressed')).toBe('false');
        expect(light.className).toBe('btn btn-sm btn-outline-info');
        expect(getCssBox(host).value).toBe('.ol-preview-line { color: red; }');
    });

    test('a slider drag writes its LAST value once, 500 ms after it stops', async () => {
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleComp stage={0} onChanged={onChanged} />,
        );
        await slide(host, 'Horizontal Margin (%)', 3);
        await slide(host, 'Horizontal Margin (%)', 4);
        // The control follows the hand at once; the write waits.
        expect(getRange(host, 'Horizontal Margin (%)').value).toBe('4');
        expect(state.settingWrites).toEqual([]);
        await advance(499);
        expect(state.settingWrites).toEqual([]);
        expect(onChanged).not.toHaveBeenCalled();
        await advance(1);
        expect(state.settingWrites).toHaveLength(1);
        expect(readStyleWrite(0)).toEqual({
            key: 'lyric-stage-style-0',
            style: {
                ...DEFAULT_STYLE,
                marginHorizontalPercentage: 4,
                marginVerticalPercentage: 4,
            },
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('the opacity and font sliders write their own fields', async () => {
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleComp stage={1} onChanged={onChanged} />,
        );
        await slide(host, 'Background Opacity (%)', 20);
        await slide(host, 'Extra Font Size', 80);
        await advance(500);
        expect(state.settingWrites).toHaveLength(1);
        expect(readStyleWrite(0)).toEqual({
            key: 'lyric-stage-style-1',
            style: {
                ...DEFAULT_STYLE,
                backgroundAlphaPercentage: 20,
                extraFontSize: 80,
            },
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('a theme press commits at once, with a slider value still pending', async () => {
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleComp stage={0} onChanged={onChanged} />,
        );
        await slide(host, 'Horizontal Margin (%)', 6);
        await act(async () => findButton(host, 'Dark').click());
        expect(state.settingWrites).toHaveLength(1);
        expect(readStyleWrite(0).style).toEqual({
            ...DEFAULT_STYLE,
            marginHorizontalPercentage: 6,
            marginVerticalPercentage: 6,
            theme: 'dark',
        });
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(findButton(host, 'Dark').getAttribute('aria-pressed')).toBe(
            'true',
        );
        // The slider's own trailing write was folded into that one.
        await advance(1000);
        expect(state.settingWrites).toHaveLength(1);
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('custom CSS waits for a pause in typing; leaving the box commits at once', async () => {
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleComp stage={0} onChanged={onChanged} />,
        );
        await act(async () => {
            setNativeValue(getCssBox(host), '.ol-preview-line { color: red; }');
        });
        expect(getCssBox(host).value).toBe('.ol-preview-line { color: red; }');
        await advance(500);
        expect(state.settingWrites).toEqual([]);
        await advance(1000);
        expect(state.settingWrites).toHaveLength(1);
        expect(readStyleWrite(0).style.customCss).toBe(
            '.ol-preview-line { color: red; }',
        );
        expect(onChanged).toHaveBeenCalledTimes(1);

        await act(async () => {
            setNativeValue(getCssBox(host), 'b { }');
        });
        await act(async () => {
            getCssBox(host).dispatchEvent(
                new FocusEvent('focusout', { bubbles: true }),
            );
        });
        expect(state.settingWrites).toHaveLength(2);
        expect(readStyleWrite(1).style.customCss).toBe('b { }');
        expect(onChanged).toHaveBeenCalledTimes(2);
        await advance(1500);
        expect(state.settingWrites).toHaveLength(2);
    });

    test('Reset deletes the saved style and drops a pending slider write', async () => {
        state.settings.set(
            'lyric-stage-style-0',
            JSON.stringify({ ...DEFAULT_STYLE, theme: 'dark' }),
        );
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleComp stage={0} onChanged={onChanged} />,
        );
        await slide(host, 'Horizontal Margin (%)', 9);
        const reset = host.querySelector<HTMLButtonElement>(
            '[title="Reset Stage Style"]',
        )!;
        expect(reset.textContent).toBe('Reset');
        await act(async () => reset.click());
        expect(state.settingRemovals).toEqual(['lyric-stage-style-0']);
        expect(state.settings.has('lyric-stage-style-0')).toBe(false);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(getRange(host, 'Horizontal Margin (%)').value).toBe('2');
        expect(findButton(host, 'Light').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await advance(500);
        expect(state.settingWrites).toEqual([]);
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('two panels commit independently (a timer per panel)', async () => {
        const onChangedA = vi.fn();
        const onChangedB = vi.fn();
        const { host: hostA } = await mount(
            <LyricStageStyleComp stage={1} onChanged={onChangedA} />,
        );
        const { host: hostB } = await mount(
            <LyricStageStyleComp stage={2} onChanged={onChangedB} />,
        );
        await slide(hostA, 'Horizontal Margin (%)', 3);
        await slide(hostB, 'Horizontal Margin (%)', 7);
        await advance(500);
        const written = Object.fromEntries(
            state.settingWrites.map(([key, raw]) => {
                return [key, JSON.parse(raw).marginHorizontalPercentage];
            }),
        );
        expect(written).toEqual({
            'lyric-stage-style-1': 3,
            'lyric-stage-style-2': 7,
        });
        expect(onChangedA).toHaveBeenCalledTimes(1);
        expect(onChangedB).toHaveBeenCalledTimes(1);
    });
});

describe('LyricStageStyleFloatingComp', () => {
    function getDialog() {
        return document.querySelector<HTMLElement>('[role="dialog"]');
    }

    test('portals the open stage panel and retargets it per stage', async () => {
        state.settings.set(
            'lyric-stage-style-2',
            JSON.stringify({ ...DEFAULT_STYLE, marginHorizontalPercentage: 7 }),
        );
        const ownerId = genLyricStageStyleFloatingOwnerId();
        openedOwnerIds.push(ownerId);
        const onChanged = vi.fn();
        const { host } = await mount(
            <LyricStageStyleFloatingComp
                ownerId={ownerId}
                onChanged={onChanged}
            />,
        );
        expect(getDialog()).toBeNull();

        await act(async () => toggleLyricStageStyleFloatingStage(ownerId, 2));
        await settle();
        const dialog = getDialog()!;
        expect(dialog.getAttribute('aria-label')).toBe('Stage Style · Stage 2');
        expect(dialog.dataset.persistKey).toBe(
            'floating-widget-rect-lyric-stage-style',
        );
        // On the body, out of the previewer card that could clip it.
        expect(host.contains(dialog)).toBe(false);
        expect(dialog.parentElement!.parentElement).toBe(document.body);
        expect(dialog.parentElement!.dataset.bsTheme).toBe('dark');
        expect(
            getByLabel<HTMLInputElement>(dialog, 'Horizontal Margin (%)').value,
        ).toBe('7');

        // Another stage: the SAME widget, a fresh body with that stage values.
        await act(async () => toggleLyricStageStyleFloatingStage(ownerId, 3));
        await settle();
        expect(getDialog()!.getAttribute('aria-label')).toBe(
            'Stage Style · Stage 3',
        );
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        expect(
            getByLabel<HTMLInputElement>(getDialog()!, 'Horizontal Margin (%)')
                .value,
        ).toBe('2');

        await act(async () => findButton(getDialog()!, 'Dark').click());
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(readStyleWrite(0).key).toBe('lyric-stage-style-3');

        await act(async () => findButton(getDialog()!, 'Close widget').click());
        expect(getDialog()).toBeNull();
    });

    test('renders nothing while another previewer owns the panel', async () => {
        const ownerId = genLyricStageStyleFloatingOwnerId();
        const otherOwnerId = genLyricStageStyleFloatingOwnerId();
        openedOwnerIds.push(ownerId, otherOwnerId);
        await mount(
            <LyricStageStyleFloatingComp
                ownerId={ownerId}
                onChanged={vi.fn()}
            />,
        );
        await act(async () => {
            toggleLyricStageStyleFloatingStage(otherOwnerId, 1);
        });
        expect(getDialog()).toBeNull();
    });
});

describe('useLyricWarmSlides', () => {
    function WarmHostComp({
        manager,
        paneStages,
    }: Readonly<{ manager: LyricManager; paneStages: number[] }>) {
        useLyricWarmSlides(manager, paneStages);
        return null;
    }

    function getWarmLog() {
        return state.log.filter((entry) => entry.startsWith('warm:'));
    }

    test('the stages to warm are the live screens no pane already builds', () => {
        state.screenManagers = [
            { stage: 0, isDeleted: false },
            { stage: 2, isDeleted: false },
            { stage: 2, isDeleted: false },
            { stage: 3, isDeleted: true },
            { stage: 4, isDeleted: false },
        ];
        expect(getLyricWarmStages([0, 4])).toEqual([2]);
        expect(getLyricWarmStages([])).toEqual([0, 2, 4]);
    });

    test('a stage already built is skipped, and a run stops once inactive', async () => {
        state.getStageDoc(SONG_PATH, 2).warmDeck = [{ id: 1 }];
        await warmLyricStages(SONG_PATH, [2, 5], () => true);
        expect(getWarmLog()).toEqual(['warm:5']);
        state.log.length = 0;
        await warmLyricStages(SONG_PATH, [5, 6], () => false);
        expect(getWarmLog()).toEqual([]);
    });

    test('holds the song and warms the screens stages after the debounce', async () => {
        state.screenManagers = [
            { stage: 0, isDeleted: false },
            { stage: 2, isDeleted: false },
        ];
        const { manager, openLyric } = genManager();
        const { root } = await mount(
            <WarmHostComp manager={manager} paneStages={[0]} />,
        );
        expect(getHeldOpenLyric(SONG_PATH)).toBe(openLyric);
        await advance(499);
        expect(getWarmLog()).toEqual([]);
        await advance(1);
        expect(getWarmLog()).toEqual(['warm:2']);

        // A screen moving to another stage fires `instance`: warm again.
        state.screenManagers[1].stage = 3;
        await act(async () => {
            ScreenManagerBase.addPropEvent('instance');
            await flushMicrotasks();
        });
        await advance(500);
        expect(getWarmLog()).toEqual(['warm:2', 'warm:3']);

        await unmount(root);
        expect(getHeldOpenLyric(SONG_PATH)).toBeNull();
        await act(async () => {
            ScreenManagerBase.addPropEvent('instance');
            await flushMicrotasks();
        });
        await advance(500);
        expect(getWarmLog()).toEqual(['warm:2', 'warm:3']);
    });

    test('two hosts of one song BOTH warm after one screen event', async () => {
        state.screenManagers = [{ stage: 2, isDeleted: false }];
        const first = genManager('first');
        const second = genManager('second');
        await mount(<WarmHostComp manager={first.manager} paneStages={[0]} />);
        await mount(<WarmHostComp manager={second.manager} paneStages={[0]} />);
        await advance(500);
        expect(getWarmLog()).toEqual(['warm:2', 'warm:2']);
        state.log.length = 0;
        await act(async () => {
            ScreenManagerBase.addPropEvent('instance');
            await flushMicrotasks();
        });
        await advance(500);
        expect(getWarmLog()).toEqual(['warm:2', 'warm:2']);
    });

    test('a host gone before the debounce fires builds nothing', async () => {
        state.screenManagers = [{ stage: 2, isDeleted: false }];
        const { manager } = genManager();
        const { root } = await mount(
            <WarmHostComp manager={manager} paneStages={[0]} />,
        );
        await unmount(root);
        await advance(500);
        expect(getWarmLog()).toEqual([]);
    });

    test('a host gone mid-run stops before the next stage', async () => {
        state.screenManagers = [
            { stage: 2, isDeleted: false },
            { stage: 3, isDeleted: false },
        ];
        let finishBuild!: () => void;
        state.getStageDoc(SONG_PATH, 2).buildSlides = () => {
            return new Promise<void>((resolve) => {
                finishBuild = resolve;
            });
        };
        const { manager } = genManager();
        const { root } = await mount(
            <WarmHostComp manager={manager} paneStages={[0]} />,
        );
        await advance(500);
        expect(getWarmLog()).toEqual(['warm:2']);
        await unmount(root);
        await act(async () => {
            finishBuild();
            await flushMicrotasks();
        });
        expect(getWarmLog()).toEqual(['warm:2']);
    });

    test('a failed build is reported, not thrown', async () => {
        state.screenManagers = [{ stage: 2, isDeleted: false }];
        const error = new Error('render failed');
        state.getStageDoc(SONG_PATH, 2).buildSlides = async () => {
            throw error;
        };
        const { manager } = genManager();
        await mount(<WarmHostComp manager={manager} paneStages={[0]} />);
        await advance(500);
        await act(async () => {
            await flushMicrotasks();
        });
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });
});

describe('LyricSlidesPreviewerComp', () => {
    async function mountPreviewer(manager: LyricManager) {
        return await mount(
            <LyricManagerContext value={manager}>
                <LyricSlidesPreviewerComp />
            </LyricManagerContext>,
        );
    }

    function getPanes(host: HTMLElement) {
        return [...host.querySelectorAll<HTMLElement>('section[data-key]')];
    }

    test('shows the base stage and the stages the setting names, in order', async () => {
        state.settings.set('lyric-slides-previewer-stages', '2,1');
        const { manager, openLyric } = genManager();
        const { host } = await mountPreviewer(manager);
        const panes = getPanes(host);
        expect(panes.map((pane) => pane.dataset.key)).toEqual([
            'h0',
            'h1',
            'h2',
        ]);
        expect(panes.map((pane) => pane.dataset.widgetName)).toEqual([
            'Stage 0',
            'Stage 1',
            'Stage 2',
        ]);
        expect(panes[0].dataset.widgetIcon).toBe('easel2');
        const resizeActor =
            host.querySelector<HTMLElement>('.fake-resize-actor')!;
        expect(resizeActor.dataset.flexSizeName).toBe(
            'flex-size-lyric-slides-previewer',
        );
        expect(JSON.parse(resizeActor.dataset.flexSizeDefault!)).toEqual({
            h0: ['1'],
            h1: ['1'],
            h2: ['1'],
        });
        // Each pane shows ITS stage document, fed this previewer's song.
        expect(
            panes.map((pane) => {
                return pane.querySelector<HTMLElement>('.fake-slides')!.dataset
                    .doc;
            }),
        ).toEqual([`${SONG_PATH}#0`, `${SONG_PATH}#1`, `${SONG_PATH}#2`]);
        for (const stage of [0, 1, 2]) {
            expect(state.getStageDoc(SONG_PATH, stage).openLyric).toBe(
                openLyric,
            );
        }
        expect(
            panes[1]
                .querySelector<HTMLElement>('.stage-previewer-pane')!
                .style.getPropertyValue('--stage-accent'),
        ).toBe('var(--stage-1)');
        // A gear on every chip, the base stage included.
        expect(
            [...host.querySelectorAll('.stage-previewer-chip-config')].map(
                (button) => button.getAttribute('aria-label'),
            ),
        ).toEqual(['Stage Style 0', 'Stage Style 1', 'Stage Style 2']);
    });

    test('a stage added or hidden in the header is saved and shown', async () => {
        state.settings.set('lyric-slides-previewer-stages', '2');
        const { manager } = genManager();
        const { host } = await mountPreviewer(manager);
        await act(async () => getByLabel(host, 'Add Stage').click());
        const items = getLastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Stage 0',
            'Stage 1',
            'Stage 2',
            'Stage 3',
            'Stage 4',
            'Stage 5',
            'Increment · Stage 3',
        ]);
        await act(async () => selectMenuItem(items, 'Stage 4').onSelect());
        expect(state.settings.get('lyric-slides-previewer-stages')).toBe('2,4');
        expect(getPanes(host).map((pane) => pane.dataset.key)).toEqual([
            'h0',
            'h2',
            'h4',
        ]);
        await act(async () => getByLabel(host, 'Hide Stage 2').click());
        expect(state.settings.get('lyric-slides-previewer-stages')).toBe('4');
        expect(getPanes(host).map((pane) => pane.dataset.key)).toEqual([
            'h0',
            'h4',
        ]);
    });

    test('the gear opens that stage panel; a style change refreshes every pane', async () => {
        state.settings.set('lyric-slides-previewer-stages', '1');
        state.screenManagers = [{ stage: 3, isDeleted: false }];
        const { manager } = genManager();
        const { host } = await mountPreviewer(manager);
        await advance(500);
        expect(state.log).toEqual(['warm:3']);
        state.log.length = 0;

        const gear = getByLabel<HTMLButtonElement>(host, 'Stage Style 1');
        await act(async () => gear.click());
        await settle();
        expect(gear.getAttribute('aria-pressed')).toBe('true');
        expect(gear.className).toContain('is-active');
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        expect(dialog.getAttribute('aria-label')).toBe('Stage Style · Stage 1');

        // The song on disk moved meanwhile; the commit refreshes from it.
        state.contents.set(SONG_PATH, 'Amazing grace, how sweet');
        await act(async () => {
            findButton(dialog, 'Dark').click();
            await flushMicrotasks();
        });
        expect(readStyleWrite(0)).toEqual({
            key: 'lyric-stage-style-1',
            style: { ...DEFAULT_STYLE, theme: 'dark' },
        });
        // Re-fed FIRST, caches dropped SECOND, screens re-warmed last.
        expect(state.log).toEqual([
            'value:main:Amazing grace, how sweet',
            'clear:0',
            'clear:1',
        ]);
        await advance(500);
        expect(state.log.at(-1)).toBe('warm:3');

        await act(async () => gear.click());
        expect(gear.getAttribute('aria-pressed')).toBe('false');
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    test('More Options offers Reload, Export to PPTX and the song transition', async () => {
        state.settings.set('lyric-slides-previewer-stages', '1');
        const onTransition = vi.fn();
        mocks.genDocumentTransitionMenuItems.mockResolvedValue([
            { menuElement: 'Transition', onSelect: onTransition },
        ]);
        const { manager } = genManager();
        const { host } = await mountPreviewer(manager);
        await act(async () => {
            getByLabel(host, 'More Options').click();
            await flushMicrotasks();
        });
        expect(mocks.genDocumentTransitionMenuItems).toHaveBeenCalledWith(
            SONG_PATH,
        );
        const items = getLastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Reload',
            'Export to PPTX',
            'Transition',
        ]);

        selectMenuItem(items, 'Export to PPTX').onSelect();
        expect(mocks.exportLyricStagesToPptx).toHaveBeenCalledWith([
            [0, state.getStageDoc(SONG_PATH, 0)],
            [1, state.getStageDoc(SONG_PATH, 1)],
        ]);

        state.contents.set(SONG_PATH, 'Reloaded words');
        await act(async () => {
            selectMenuItem(items, 'Reload').onSelect();
            await flushMicrotasks();
        });
        expect(state.log).toEqual([
            'value:main:Reloaded words',
            'clear:0',
            'clear:1',
        ]);
    });

    test('one update of the song refreshes BOTH previewers of it', async () => {
        state.settings.set('lyric-slides-previewer-stages', '1');
        state.screenManagers = [{ stage: 3, isDeleted: false }];
        const first = genManager('first');
        const second = genManager('second');
        await mountPreviewer(first.manager);
        await mountPreviewer(second.manager);
        await advance(500);
        state.log.length = 0;

        state.contents.set(SONG_PATH, 'New verse');
        await fireFileUpdate();
        expect(first.openLyric.value).toBe('New verse');
        expect(second.openLyric.value).toBe('New verse');
        expect(state.log.filter((entry) => entry === 'clear:0')).toHaveLength(
            2,
        );
        expect(state.log.filter((entry) => entry === 'clear:1')).toHaveLength(
            2,
        );
        await advance(500);
        expect(state.log.filter((entry) => entry === 'warm:3')).toHaveLength(2);
    });

    test('a previewer that goes away closes the style panel it opened', async () => {
        const lastOwnerId = genLyricStageStyleFloatingOwnerId();
        const previewerOwnerId =
            'lyric-stage-style-owner-' +
            (Number(lastOwnerId.split('-').pop()) + 1);
        openedOwnerIds.push(previewerOwnerId);
        function OpenStageProbeComp() {
            const stage = useLyricStageStyleFloatingStage(previewerOwnerId);
            return (
                <output>{stage === null ? 'none' : `stage ${stage}`}</output>
            );
        }
        const { manager } = genManager();
        const { host, root } = await mountPreviewer(manager);
        const { host: probeHost } = await mount(<OpenStageProbeComp />);
        await act(async () => getByLabel(host, 'Stage Style 0').click());
        expect(probeHost.textContent).toBe('stage 0');
        await unmount(root);
        expect(probeHost.textContent).toBe('none');
    });
});

describe('LyricRenderPreviewBodyComp', () => {
    test('mounts the previewer into its body and offers Reload and Edit', async () => {
        mocks.openPopupWindow.mockReturnValue(null);
        const { manager, openLyric } = genManager();
        const { host, root } = await mount(
            <LyricManagerContext value={manager}>
                <LyricRenderPreviewBodyComp />
            </LyricManagerContext>,
        );
        const body = host.querySelector<HTMLElement>(
            '.app-lyric-render-preview-body',
        )!;
        expect(openLyric.container).toBe(body);
        expect(openLyric.mountCount).toBe(1);
        expect(body.textContent).toBe('Verse 1Chorus');

        // Right-click and the ⋮ open the same menu.
        await act(async () => {
            body.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await act(async () => getByLabel(host, 'Lyric menu').click());
        expect(mocks.showAppContextMenu).toHaveBeenCalledTimes(2);
        const items = getLastMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'Reload',
            'Edit',
        ]);
        selectMenuItem(items, 'Reload').onSelect();
        expect(openLyric.reloadCount).toBe(1);
        selectMenuItem(items, 'Edit').onSelect();
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            '/lyric-editor.html?file=Amazing%20Grace.owl',
            expect.stringMatching(/^Amazing Grace\.owl_\d+$/),
            'lyric-editor',
        );

        await unmount(root);
        expect(openLyric.container).toBeNull();
    });

    test('never mounts a previewer twice into the element it is already in', async () => {
        const first = genManager('first');
        const { host, root } = await mount(
            <LyricManagerContext value={first.manager}>
                <LyricRenderPreviewBodyComp />
            </LyricManagerContext>,
        );
        const body = host.querySelector<HTMLElement>(
            '.app-lyric-render-preview-body',
        )!;
        // A second previewer that is already living in this element.
        const second = genManager('second');
        second.openLyric.container = body;
        await act(async () => {
            root.render(
                <LyricManagerContext value={second.manager}>
                    <LyricRenderPreviewBodyComp />
                </LyricManagerContext>,
            );
        });
        expect(first.openLyric.container).toBeNull();
        expect(second.openLyric.mountCount).toBe(0);
        await unmount(root);
        // It did not mount it, so it does not take it out either.
        expect(second.openLyric.container).toBe(body);
    });
});

describe('LyricHandlerComp', () => {
    async function mountHandler(openLyric: FakeOpenLyric, prefix?: string) {
        let resolveOpenLyric!: (value: unknown) => void;
        mocks.initOpenLyric.mockReturnValue(
            new Promise((resolve) => {
                resolveOpenLyric = resolve;
            }),
        );
        const mountedHandler = await mount(
            <LyricHandlerComp
                filePath={SONG_PATH}
                flexSizeNamePrefix={prefix}
            />,
        );
        const loadingText = mountedHandler.host.textContent;
        await act(async () => {
            resolveOpenLyric(openLyric);
            await flushMicrotasks();
        });
        await settle();
        return { ...mountedHandler, loadingText };
    }

    function getContainer(host: HTMLElement) {
        return host.firstElementChild as HTMLElement;
    }

    test('loads the song previewer, then the song and its slides', async () => {
        state.isDarkMode = true;
        const openLyric = new FakeOpenLyric('main');
        const { host, loadingText } = await mountHandler(openLyric);
        expect(loadingText).toBe('Loading...');
        expect(mocks.applyOpenLyricTheme).toHaveBeenCalledWith(null, true);
        expect(mocks.lyricGetInstance).toHaveBeenCalledWith(SONG_PATH);
        expect(mocks.initOpenLyric).toHaveBeenCalledWith(SONG_PATH);
        expect(mocks.applyOpenLyricTheme).toHaveBeenLastCalledWith(
            openLyric,
            true,
        );

        const resizeActor =
            host.querySelector<HTMLElement>('.fake-resize-actor')!;
        expect(resizeActor.dataset.flexSizeName).toBe('lyric-previewer');
        const [songPane, slidesPane] = [
            ...resizeActor.querySelectorAll<HTMLElement>(':scope > section'),
        ];
        expect(songPane.dataset).toMatchObject({
            key: 'v1',
            widgetName: 'Previewer',
            widgetKey: 'Previewer',
            widgetIcon: 'eye',
        });
        expect(slidesPane.dataset).toMatchObject({
            key: 'v2',
            widgetName: 'Slides',
            widgetIcon: 'collection',
        });
        // Both lazy bodies are up: the song mounted, the stage pane listed.
        expect(openLyric.container).toBe(
            songPane.querySelector('.app-lyric-render-preview-body'),
        );
        expect(songPane.textContent).toContain('Chorus');
        expect(slidesPane.querySelector('.fake-slides')).not.toBeNull();
    });

    test('a floating preview keeps its own pane sizes', async () => {
        const { host } = await mountHandler(
            new FakeOpenLyric('floating'),
            'floating-',
        );
        expect(
            host.querySelector<HTMLElement>('.fake-resize-actor')!.dataset
                .flexSizeName,
        ).toBe('floating-lyric-previewer');
    });

    test('song to slides: a clicked verse brings its card into view here', async () => {
        const { host } = await mountHandler(new FakeOpenLyric('main'));
        const container = getContainer(host);
        await act(async () => {
            host.querySelector<HTMLElement>('.ol-line')!.click();
        });
        expect(mocks.notifyLyricElement).toHaveBeenCalledWith(1, container);
    });

    test('slides to song: only a lyric card of THIS previewer moves the song', async () => {
        const { host } = await mountHandler(new FakeOpenLyric('main'));
        const slides = host.querySelector<HTMLElement>('.fake-slides')!;
        const sections = host.querySelectorAll('section:not([data-key])');
        async function selectCard(className: string, isInside = true) {
            const card = document.createElement('div');
            card.className = className;
            (isInside ? slides : document.body).append(card);
            await act(async () => {
                EventHandler.addPropEvent('on-slide-item-selected', {
                    target: card,
                });
                await flushMicrotasks();
            });
            card.remove();
        }

        await selectCard('ol-slide--lyric-index-1');
        expect(mocks.notifyElementHighlight).toHaveBeenCalledTimes(1);
        expect(mocks.notifyElementHighlight.mock.calls[0][0]()).toBe(
            sections[1],
        );

        // Another previewer's card, a non-lyric card, an extra slide (-1), a
        // garbled index, and an index no verse answers to: all ignored.
        await selectCard('ol-slide--lyric-index-0', false);
        await selectCard('slide-card');
        await selectCard('ol-slide--lyric-index--1');
        await selectCard('ol-slide--lyric-index-x');
        await selectCard('ol-slide--lyric-index-7');
        expect(mocks.notifyElementHighlight).toHaveBeenCalledTimes(1);
    });

    test('a change on disk re-feeds the song', async () => {
        const openLyric = new FakeOpenLyric('main');
        await mountHandler(openLyric);
        state.contents.set(SONG_PATH, 'Through many dangers');
        await fireFileUpdate();
        expect(openLyric.value).toBe('Through many dangers');
        // Two listeners asked, the text moved once.
        expect(state.log.filter((entry) => entry.startsWith('value:'))).toEqual(
            ['value:main:Through many dangers'],
        );
    });

    test('unmounting lets go of every listener and the element', async () => {
        const openLyric = new FakeOpenLyric('main');
        const { host, root } = await mountHandler(openLyric);
        const container = getContainer(host);
        expect(container.onclick).not.toBeNull();
        const slides = host.querySelector<HTMLElement>('.fake-slides')!;
        const card = document.createElement('div');
        card.className = 'ol-slide--lyric-index-1';
        slides.append(card);
        await unmount(root);
        expect(container.onclick).toBeNull();
        expect(openLyric.container).toBeNull();
        await act(async () => {
            EventHandler.addPropEvent('on-slide-item-selected', {
                target: card,
            });
            await flushMicrotasks();
        });
        expect(mocks.notifyElementHighlight).not.toHaveBeenCalled();
        state.contents.set(SONG_PATH, 'After unmount');
        await fireFileUpdate();
        expect(openLyric.value).toBe('');
    });
});

describe('LyricFileComp', () => {
    const RENAMED_PATH = '/songs/Renamed.owl';

    function getProps() {
        const props = state.fileItemPropsList.at(-1);
        expect(props, 'FileItemHandlerComp props').toBeDefined();
        return props;
    }

    async function mountFile(selectedFilePath: string | null = null) {
        const contextValue: SelectedAppDocumentContextType = {
            // `LyricFileComp` reads nothing of the selected document but its
            // `filePath`, so a stand-in carrying only that is enough.
            selectedVaryAppDocument:
                selectedFilePath === null
                    ? null
                    : ({ filePath: selectedFilePath } as VaryAppDocumentType),
            setSelectedVaryAppDocument: mocks.setSelected,
        };
        return await mount(
            <SelectedVaryAppDocumentContext value={contextValue}>
                <LyricFileComp index={4} filePath={SONG_PATH} />
            </SelectedVaryAppDocumentContext>,
        );
    }

    test('lists the song by name with its menu once it is read', async () => {
        const { host } = await mountFile();
        // The first pass had no lyric yet, so no menu.
        expect(state.fileItemPropsList[0].fileData).toBeUndefined();
        expect(state.fileItemPropsList[0].contextMenuItems).toEqual([]);
        const props = getProps();
        expect(props.index).toBe(4);
        expect(props.filePath).toBe(SONG_PATH);
        expect(props.isSelected).toBe(false);
        expect(props.fileData.filePath).toBe(SONG_PATH);
        expect(
            host.querySelector('.bi-music-note')!.getAttribute('title'),
        ).toBe('Lyric');
        expect(host.querySelector('.app-ellipsis')!.textContent).toBe(
            'Amazing Grace',
        );
        expect(host.textContent).not.toContain('*');
        expect(
            [...host.querySelectorAll('.fake-menu-item')].map(
                (item) => item.textContent,
            ),
        ).toEqual([
            'Open Slides Preview',
            'Long Text Show',
            'Open in Chatbot',
            'Edit',
            'Export',
        ]);
    });

    test('an unsaved song carries the red star', async () => {
        state.canSave = true;
        const { host } = await mountFile();
        const star = [...host.querySelectorAll('span')].find((span) => {
            return span.textContent === '*';
        });
        expect(star?.style.color).toBe('red');
    });

    test('the menu items reach their actions', async () => {
        mocks.openPopupWindow.mockReturnValue(null);
        const { host } = await mountFile(SONG_PATH);
        await act(async () => findButton(host, 'Open Slides Preview').click());
        expect(mocks.openSlidesPreview).toHaveBeenCalledWith(SONG_PATH, true);
        await act(async () => findButton(host, 'Export').click());
        expect(mocks.exportAppDocument).toHaveBeenCalledWith(SONG_PATH);
        await act(async () => findButton(host, 'Edit').click());
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            '/lyric-editor.html?file=Amazing%20Grace.owl',
            expect.stringMatching(/^Amazing Grace\.owl_\d+$/),
            'lyric-editor',
        );
        await act(async () => {
            findButton(host, 'Long Text Show').click();
            await vi.dynamicImportSettled();
            await flushMicrotasks();
        });
        expect(mocks.openLyricInLongTextShow).toHaveBeenCalledWith(SONG_PATH);
        await act(async () => findButton(host, 'Open in Chatbot').click());
        expect(mocks.openLyricInChatbot).toHaveBeenCalledWith(SONG_PATH);
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a Long Text Show that fails is reported', async () => {
        const error = new Error('panel unavailable');
        mocks.openLyricInLongTextShow.mockImplementation(() => {
            throw error;
        });
        const { host } = await mountFile();
        await act(async () => {
            findButton(host, 'Long Text Show').click();
            await vi.dynamicImportSettled();
            await flushMicrotasks();
        });
        expect(mocks.handleError).toHaveBeenCalledWith(error);
    });

    test('a click selects the song as a document and shows it', async () => {
        await mountFile();
        const event = { type: 'click' };
        await act(async () => {
            await getProps().onClick(event);
        });
        const lyricAppDocument = state.getLyricAppDocument(SONG_PATH);
        expect(mocks.checkHandleOpenSlidesPreviewClicking).toHaveBeenCalledWith(
            event,
            SONG_PATH,
            false,
        );
        expect(mocks.setSelected).toHaveBeenCalledWith(lyricAppDocument);
        expect(mocks.showVaryAppDocument).toHaveBeenCalledWith(
            lyricAppDocument,
        );

        // Already on the previewer: selecting is enough.
        state.isShowingPreviewer = true;
        await act(async () => {
            await getProps().onClick(event);
        });
        expect(mocks.setSelected).toHaveBeenCalledTimes(2);
        expect(mocks.showVaryAppDocument).toHaveBeenCalledTimes(1);
    });

    test('a refused switch or a preview shortcut stops the click', async () => {
        await mountFile();
        mocks.setSelected.mockResolvedValue(false);
        await act(async () => {
            await getProps().onClick({});
        });
        expect(mocks.setSelected).toHaveBeenCalledTimes(1);
        expect(mocks.showVaryAppDocument).not.toHaveBeenCalled();

        mocks.checkHandleOpenSlidesPreviewClicking.mockReturnValue(true);
        await act(async () => {
            await getProps().onClick({});
        });
        expect(mocks.setSelected).toHaveBeenCalledTimes(1);
    });

    test('a file that is no lyric gives a bare row that clicks to nothing', async () => {
        mocks.lyricGetInstance.mockReturnValue(null);
        const { host } = await mountFile();
        expect(getProps().contextMenuItems).toEqual([]);
        expect(host.textContent).toBe('No lyric yet');
        await act(async () => {
            await getProps().onClick({});
        });
        expect(mocks.setSelected).not.toHaveBeenCalled();
    });

    test('reload re-reads the song through its update event', async () => {
        await mountFile();
        const callCount = mocks.lyricGetInstance.mock.calls.length;
        await act(async () => {
            getProps().reload();
            await flushMicrotasks();
        });
        expect(mocks.lyricGetInstance.mock.calls.length).toBe(callCount + 1);
    });

    test('drag, on-screen check and rename go through the document helpers', async () => {
        mocks.checkIsOnScreen.mockResolvedValue(true);
        await mountFile();
        const dragEvent = { type: 'dragstart' };
        getProps().onDragStart(dragEvent);
        expect(mocks.handleAppDocumentDragStart).toHaveBeenCalledWith(
            dragEvent,
            SONG_PATH,
        );
        await expect(getProps().checkIsOnScreen(SONG_PATH)).resolves.toBe(true);
        expect(mocks.checkIsOnScreen).toHaveBeenCalledWith(SONG_PATH);

        // Not selected: only the floating preview of the old path closes.
        await act(async () => {
            await getProps().renamedCallback({ filePath: RENAMED_PATH });
        });
        expect(mocks.closeAppDocumentPreviewFloating).toHaveBeenCalledWith(
            SONG_PATH,
        );
        expect(mocks.setSelected).not.toHaveBeenCalled();
    });

    test('a selected song keeps its selection through a rename', async () => {
        const { host } = await mountFile(SONG_PATH);
        expect(host.querySelector('article')!.dataset.selected).toBe('true');
        await act(async () => {
            await getProps().renamedCallback({ filePath: RENAMED_PATH });
        });
        expect(mocks.setSelected).toHaveBeenCalledWith(
            state.getLyricAppDocument(RENAMED_PATH),
            { isForce: true },
        );
    });
});
