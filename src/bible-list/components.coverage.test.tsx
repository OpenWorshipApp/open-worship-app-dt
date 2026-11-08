// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));
vi.mock('../media-sessions/useFileListSessions', () => ({
    useFileListSessions: (settingName: string) => ({
        activeId: '',
        isDefaultSession: true,
        dirSourceSettingName: settingName,
        element: null,
    }),
}));

// ONE mock surface for the Bibles panel: the list of list files, the reading
// column that holds it beside the notes, a list's rows, one row, and the
// Generate Slides popup a row opens. The components themselves are real, so a
// row pressed here opens the real popup.
const h = vi.hoisted(() => ({
    appProvider: { isPagePresenter: false, isPageReader: true },
    bibleFromFilePath: vi.fn(),
    bibleGetDefault: vi.fn(),
    bibleCreate: vi.fn(),
    dirSource: null as unknown,
    dirSourceSettingNames: [] as string[],
    refreshEvents: [] as unknown[][],
    genRemovingMenu: vi.fn(),
    dragStart: vi.fn(),
    attachDrop: vi.fn(),
    extractDrop: vi.fn(),
    changeDragStyle: vi.fn(),
    stopDragging: vi.fn(),
    selectBibleItem: vi.fn(),
    showLookup: null as null | (() => void),
    viewController: null as any,
    newTarget: null as unknown,
    getAttachedBackground: vi.fn(),
    openItemMenu: vi.fn(),
    checkOnScreen: vi.fn(),
    sortBibleFilePaths: vi.fn(),
    isOnScreen: false,
    openInChatbot: vi.fn(),
    duplicated: vi.fn(),
    bibleInfoList: vi.fn(),
    handleError: vi.fn(),
    generateSlides: vi.fn(),
    appDocumentGetInstance: vi.fn(),
    setSelectedAppDocument: vi.fn(),
    showVaryAppDocument: vi.fn(),
    theme: 'dark',
    selectAndImport: vi.fn(),
    askAndImport: vi.fn(),
    importDropped: vi.fn(),
    fileListProps: null as any,
    resizeProps: [] as any[],
}));

vi.mock('./cueList.scss', () => ({}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./Bible', () => ({
    default: {
        fromFilePath: h.bibleFromFilePath,
        getDefault: h.bibleGetDefault,
        create: h.bibleCreate,
        getDirSourceSettingName: () => 'select-dir-bible-read',
        getBaseDirSourceSettingName: () => 'select-dir-bible-read',
    },
}));
vi.mock('../others/ItemReadErrorComp', () => ({
    default: ({
        onContextMenu,
    }: {
        onContextMenu: (event: unknown) => void;
    }) => <div onContextMenu={onContextMenu}>Unreadable passage</div>,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceRefreshEvents: (events: string[], filePath: string) => {
        h.refreshEvents.push([events, filePath]);
    },
    useGenDirSourceReload: (settingName: string) => {
        h.dirSourceSettingNames.push(settingName);
        return h.dirSource;
    },
}));
vi.mock('../helper/dragHelpers', () => ({
    genRemovingAttachedBackgroundMenu: h.genRemovingMenu,
    handleDragStart: h.dragStart,
    handleAttachBackgroundDrop: h.attachDrop,
    extractDropData: h.extractDrop,
}));
// As the real one does: the press stays off the row it sits on.
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: unknown) => void }) => (
        <button
            type="button"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpening(event);
            }}
        >
            More Options
        </button>
    ),
}));
vi.mock('../others/ItemColorNoteComp', () => ({ default: () => null }));
vi.mock('../bible-lookup/BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: ({
        bibleKey,
        onBibleKeyChange,
    }: {
        bibleKey: string;
        onBibleKeyChange: (
            isContextMenu: boolean,
            oldBibleKey: string,
            newBibleKey: string,
        ) => void;
    }) => (
        <button
            type="button"
            onClick={() => onBibleKeyChange(false, bibleKey, 'NIV')}
        >
            {`Change version ${bibleKey}`}
        </button>
    ),
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: { handleBibleItemSelecting: h.selectBibleItem },
}));
vi.mock('../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.showLookup,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../helper/DragInf', () => ({
    DragTypeEnum: { BIBLE_ITEM: 'bible-item' },
}));
vi.mock('../helper/helpers', () => ({
    changeDragEventStyle: h.changeDragStyle,
    stopDraggingState: h.stopDragging,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../bible-reader/BibleViewTitleEditorComp', () => ({
    default: ({
        bibleItem,
        onTargetChange,
    }: {
        bibleItem: { id: number };
        onTargetChange: (target: unknown) => void;
    }) => (
        <button type="button" onClick={() => onTargetChange(h.newTarget)}>
            {`Passage ${bibleItem.id}`}
        </button>
    ),
}));
vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { getAttachedBackground: h.getAttachedBackground },
}));
vi.mock('../others/AttachBackgroundIconComp', () => ({ default: () => null }));
vi.mock('./bibleHelpers', () => ({
    improveBibleItemTitleOnHover: () => undefined,
    openBibleItemContextMenu: h.openItemMenu,
    useIsOnScreen: () => h.isOnScreen,
    checkIsBibleItemOnScreen: h.checkOnScreen,
    sortBibleFilePaths: h.sortBibleFilePaths,
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath.split('/').pop(),
        }),
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        // `undefined` until the read answers, as the real hook is.
        useAppStateAsync: (
            callee: () => unknown,
            deps: unknown[] = [],
            defaultValue?: unknown,
        ) => {
            const [value, setValue] = useState(defaultValue);
            useEffect(() => {
                let isActive = true;
                Promise.resolve(callee())
                    .then((newValue) => {
                        if (isActive) {
                            setValue(newValue);
                        }
                    })
                    .catch(() => undefined);
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => (
        <Suspense fallback={<span>Loading popup</span>}>{children}</Suspense>
    ),
}));
vi.mock('../helper/ai/bibleItemChatbotMenuHelpers', () => ({
    genOpenInChatbotContextMenu: () => [
        { menuElement: 'Open in Chatbot', onSelect: h.openInChatbot },
    ],
}));
vi.mock('./bibleItemHelpers', () => ({ genDuplicatedMessage: h.duplicated }));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        widgetName,
        onClose,
        options,
        children,
    }: {
        title: string;
        widgetName: string;
        onClose: () => void;
        options: { width: number };
        children: ReactNode;
    }) => (
        <section
            aria-label={title}
            data-widget-name={widgetName}
            data-width={options.width}
        >
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getAllLocalBibleInfoList: h.bibleInfoList,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
}));
vi.mock('./bibleSlidesHelpers', () => ({
    generateBibleItemSlides: h.generateSlides,
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: { getInstance: h.appDocumentGetInstance },
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    useSelectedAppDocumentSetterContext: () => h.setSelectedAppDocument,
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: h.showVaryAppDocument },
}));
vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.fileListProps = props;
        return (
            <div data-file-list={props.className}>
                {props.header}
                <ul>
                    {props.bodyHandler([
                        '/bibles/Default.owb',
                        '/bibles/Study.owb',
                    ])}
                </ul>
            </div>
        );
    },
}));
vi.mock('./BibleFileComp', () => ({
    default: ({ index, filePath }: { index: number; filePath: string }) => (
        <li data-bible-file={filePath}>{index}</li>
    ),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSettingPrefix: () => (h.appProvider.isPageReader ? 'reader-' : ''),
}));
vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (key: string) => `label:${key}`,
    toWidgetLabel: (key: string) => ({
        widgetName: `widget:${key}`,
        widgetKey: key,
    }),
}));
vi.mock('../server/fileHelpers', () => ({
    getFileFullName: (file: any) =>
        typeof file === 'string' ? file.split('/').pop() : file?.name,
}));
vi.mock('./bibleArchiveHelpers', () => ({
    askAndImportBibleArchiveFromUrl: h.askAndImport,
    checkIsBibleArchiveFileFullName: (fileFullName: string) =>
        fileFullName.endsWith('.owbible.tar.gz'),
    importDroppedBibleArchive: h.importDropped,
    selectAndImportBibleArchive: h.selectAndImport,
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { bibleReadingLeft: 'bible-reading-left' },
}));
vi.mock('../resize-actor/ResizeActorDynamicComp', () => ({
    default: (props: any) => {
        h.resizeProps.push(props);
        return (
            <div data-flex-size-name={props.flexSizeName}>
                {props.data.horizontal.dataInput.map((item: any) => {
                    const LazyPane = item.children;
                    return (
                        <Suspense key={item.key} fallback={null}>
                            <LazyPane />
                        </Suspense>
                    );
                })}
            </div>
        );
    },
}));
vi.mock('./note/BibleNoteListComp', () => ({
    default: () => <div>Bible notes list</div>,
}));

import BibleItemRenderComp from './BibleItemRenderComp';
import BibleListComp from './BibleListComp';
import BibleReadingLeftComp from './BibleReadingLeftComp';
// Loaded up front, so the row's lazy import of it answers at once.
import BibleSlidesPopupComp from './BibleSlidesPopupComp';
import RenderBibleItemsComp from './RenderBibleItemsComp';

const LIST_FILE_PATH = '/bibles/Default.owb';

let host: HTMLDivElement;
let root: Root;

async function settle() {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

async function run(callback: () => unknown) {
    await act(async () => {
        callback();
        await settle();
    });
}

async function render(node: ReactNode) {
    await act(async () => root.render(node));
    await run(() => undefined);
}

// A lazy pane loads on a real tick, never on the next microtask.
async function waitFor(check: () => boolean, what: string) {
    const deadline = performance.now() + 5_000;
    while (!check()) {
        if (performance.now() > deadline) {
            throw new Error(`Timed out waiting for ${what}`);
        }
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
        });
    }
}

function findButton(label: string, scope: ParentNode = document.body) {
    const button = [...scope.querySelectorAll('button')].find(
        (element) =>
            element.textContent?.trim() === label ||
            element.getAttribute('aria-label') === label,
    );
    if (button === undefined) {
        throw new Error(`No button: ${label}`);
    }
    return button;
}

function dispatch(target: Element, type: string, init: object = {}) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    return run(() => target.dispatchEvent(event)).then(() => event);
}

function genBibleItem(overrides: Record<string, unknown> = {}) {
    const bibleItem: any = {
        id: 4,
        bibleKey: 'KJV',
        isError: false,
        filePath: LIST_FILE_PATH,
        target: { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 },
        toVerseFullKey: () => 'JHN 3:16',
        toTitleWithBibleKey: async () => '(KJV) John 3:16',
        save: vi.fn(),
        ...overrides,
    };
    bibleItem.clone = vi.fn(() => ({ ...bibleItem, id: -1 }));
    return bibleItem;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.appProvider.isPagePresenter = false;
    h.appProvider.isPageReader = true;
    h.dirSource = null;
    h.dirSourceSettingNames.length = 0;
    h.refreshEvents.length = 0;
    h.showLookup = null;
    h.viewController = { isLookup: true };
    h.newTarget = null;
    h.isOnScreen = false;
    h.theme = 'dark';
    h.fileListProps = null;
    h.resizeProps.length = 0;
    h.getAttachedBackground.mockResolvedValue(null);
    h.genRemovingMenu.mockReturnValue([{ menuElement: 'Remove background' }]);
    h.extractDrop.mockReturnValue(null);
    h.bibleInfoList.mockResolvedValue([]);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('BibleListComp — the Bibles file list', () => {
    test('renders nothing until the Bibles folder is known', async () => {
        await render(<BibleListComp />);
        expect(h.dirSourceSettingNames).toEqual(['select-dir-bible-read']);
        expect(host.innerHTML).toBe('');
        expect(h.bibleGetDefault).not.toHaveBeenCalled();
    });

    test('the Reader keeps its own folder and prefix, the Presenter its own', async () => {
        const dirSource = { dirPath: '/bibles' };
        h.dirSource = dirSource;
        await render(<BibleListComp />);
        expect(h.bibleGetDefault).toHaveBeenCalledOnce();
        expect(h.fileListProps).toMatchObject({
            className: 'reader-bible-list app-cue-list',
            mimetypeName: 'bible',
            defaultFolderName: 'bibles-read',
            userClassName: 'p-0',
        });
        expect(h.fileListProps.dirSource).toBe(dirSource);
        expect(h.fileListProps.sortFilePaths).toBe(h.sortBibleFilePaths);
        expect(host.textContent).toContain('label:Bibles');
        const rows = [
            ...host.querySelectorAll<HTMLElement>('[data-bible-file]'),
        ];
        expect(
            rows.map((row) => [row.dataset.bibleFile, row.textContent]),
        ).toEqual([
            ['/bibles/Default.owb', '0'],
            ['/bibles/Study.owb', '1'],
        ]);

        h.appProvider.isPageReader = false;
        await render(<BibleListComp key="presenter" />);
        expect(h.fileListProps).toMatchObject({
            className: 'bible-list app-cue-list',
            defaultFolderName: 'bibles',
        });
    });

    test('a new list reports failure when nothing was created', async () => {
        h.dirSource = { dirPath: '/bibles' };
        await render(<BibleListComp />);
        h.bibleCreate.mockResolvedValueOnce({ filePath: '/bibles/Easter.owb' });
        expect(await h.fileListProps.onNewFile('/bibles', 'Easter')).toBe(
            false,
        );
        h.bibleCreate.mockResolvedValueOnce(null);
        expect(await h.fileListProps.onNewFile('/bibles', 'Easter')).toBe(true);
        expect(h.bibleCreate).toHaveBeenCalledWith('/bibles', 'Easter');
    });

    test('the on-screen check reads every list file that still opens', async () => {
        h.dirSource = { dirPath: '/bibles' };
        await render(<BibleListComp />);
        const first = { id: 1 };
        const second = { id: 2 };
        h.bibleFromFilePath.mockImplementation(async (filePath: string) => {
            return filePath === '/bibles/a.owb'
                ? { items: [first, second] }
                : null;
        });
        h.checkOnScreen.mockResolvedValue(true);
        expect(
            await h.fileListProps.checkIsOnScreen([
                '/bibles/a.owb',
                '/bibles/gone.owb',
            ]),
        ).toBe(true);
        expect(h.checkOnScreen).toHaveBeenCalledWith([first, second]);
    });

    test('the list menu imports a bundle, picked or from a URL; a dropped one too', async () => {
        h.dirSource = { dirPath: '/bibles' };
        await render(<BibleListComp />);
        const items = h.fileListProps.genContextMenuItems();
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Import',
            'Import From URL',
        ]);
        items[0].onSelect();
        expect(h.selectAndImport).toHaveBeenCalledOnce();
        expect(h.askAndImport).not.toHaveBeenCalled();
        items[1].onSelect();
        expect(h.askAndImport).toHaveBeenCalledOnce();

        const { takeDroppedFile } = h.fileListProps;
        const bundle = '/downloads/Easter.owbible.tar.gz';
        expect(takeDroppedFile(bundle)).toBe(true);
        expect(h.importDropped).toHaveBeenCalledWith(bundle);
        // A plain list file is copied in by the default handling instead.
        expect(takeDroppedFile('/downloads/Easter.owb')).toBe(false);
        expect(takeDroppedFile({})).toBe(false);
        expect(h.importDropped).toHaveBeenCalledOnce();
    });
});

describe('BibleReadingLeftComp — the Bibles and Bible Notes column', () => {
    test('holds both lists, each loaded only when its pane renders', async () => {
        h.dirSource = { dirPath: '/bibles' };
        await render(<BibleReadingLeftComp />);
        const { flexSizeName, data } = h.resizeProps[0];
        expect(flexSizeName).toBe('bible-reading-left');
        expect(data.minWidth).toBe(400);
        expect(data.horizontal.flexSizeDefault).toEqual({
            h1: ['1'],
            h2: ['1'],
        });
        expect(data.vertical.flexSizeDefault).toEqual({
            v1: ['1'],
            v2: ['1'],
        });
        expect(
            data.horizontal.dataInput.map((item: any) => [
                item.key,
                item.widgetName,
                item.widgetKey,
            ]),
        ).toEqual([
            ['h1', 'widget:Bibles', 'Bibles'],
            ['h2', 'widget:Bible Notes', 'Bible Notes'],
        ]);
        expect(data.vertical.dataInput.map((item: any) => item.key)).toEqual([
            'v1',
            'v2',
        ]);
        // The same list either way the column is laid out.
        expect(data.vertical.dataInput[0].children).toBe(
            data.horizontal.dataInput[0].children,
        );
        await waitFor(
            () =>
                host.textContent!.includes('Bible notes list') &&
                host.querySelector('[data-file-list]') !== null,
            'both lazy panes',
        );
        expect(host.textContent).toContain('label:Bibles');
    });

    test('a second mount is told apart by its names, and keeps its panes across renders', async () => {
        const props = {
            flexSizeName: 'bible-reading-left-lookup',
            biblesLabel: 'Lookup Bibles',
            bibleNotesLabel: 'Lookup Bible Notes',
        };
        await render(<BibleReadingLeftComp {...props} />);
        await render(<BibleReadingLeftComp {...props} />);
        const [first, second] = h.resizeProps.slice(-2);
        expect(second.flexSizeName).toBe('bible-reading-left-lookup');
        expect(
            second.data.horizontal.dataInput.map((item: any) => item.widgetKey),
        ).toEqual(['Lookup Bibles', 'Lookup Bible Notes']);
        // Rebuilt only when a label moves: a new array would remount the panes.
        expect(second.data.horizontal.dataInput).toBe(
            first.data.horizontal.dataInput,
        );
        expect(second.data.vertical.dataInput).toBe(
            first.data.vertical.dataInput,
        );
        await render(
            <BibleReadingLeftComp {...props} bibleNotesLabel="Bible Notes" />,
        );
        const third = h.resizeProps.at(-1);
        expect(third.data.horizontal.dataInput).not.toBe(
            second.data.horizontal.dataInput,
        );
        expect(third.data.horizontal.dataInput[1].widgetKey).toBe(
            'Bible Notes',
        );
    });
});

describe('RenderBibleItemsComp — one list file’s passages', () => {
    test('a row per passage, the duplicate warned, and the default list offers to add one', async () => {
        const showLookup = vi.fn();
        h.showLookup = showLookup;
        h.duplicated.mockImplementation((_items, _item, index: number) =>
            index === 1 ? 'Duplicated with item number 1' : undefined,
        );
        const first = genBibleItem({ id: 1 });
        const second = genBibleItem({ id: 2 });
        const bible = {
            items: [first, second],
            isDefault: true,
            filePath: LIST_FILE_PATH,
        };
        await render(<RenderBibleItemsComp bible={bible as any} />);
        const rows = [...host.querySelectorAll<HTMLElement>('li')];
        expect(rows.map((row) => row.dataset.bibleItemId)).toEqual([
            'Default.owb-1',
            'Default.owb-2',
        ]);
        expect(rows.map((row) => row.dataset.index)).toEqual(['1', '2']);
        expect(h.duplicated.mock.calls).toEqual([
            [bible.items, first, 0],
            [bible.items, second, 1],
        ]);
        expect(rows[0].querySelector('[title^="Duplicated"]')).toBeNull();
        expect(rows[1].querySelector<HTMLElement>('.float-end')!.title).toBe(
            'Duplicated with item number 1',
        );

        await run(() => findButton('Add Bible Item', host).click());
        expect(showLookup).toHaveBeenCalledOnce();
    });

    test('no add button on another list, or with no lookup to open', async () => {
        h.showLookup = vi.fn();
        const items = [genBibleItem()];
        await render(
            <RenderBibleItemsComp
                bible={
                    { items, isDefault: false, filePath: LIST_FILE_PATH } as any
                }
            />,
        );
        expect(host.querySelectorAll('li')).toHaveLength(1);
        expect(host.textContent).not.toContain('Add Bible Item');
        h.showLookup = null;
        await render(
            <RenderBibleItemsComp
                bible={
                    { items, isDefault: true, filePath: LIST_FILE_PATH } as any
                }
            />,
        );
        expect(host.textContent).not.toContain('Add Bible Item');
    });
});

describe('BibleItemRenderComp — one saved passage', () => {
    function renderRow(
        bibleItem: any,
        extra: { warningMessage?: string } = {},
    ) {
        return render(
            <ul>
                <BibleItemRenderComp
                    index={0}
                    bibleItem={bibleItem}
                    filePath={LIST_FILE_PATH}
                    {...extra}
                />
            </ul>,
        );
    }

    function getRow() {
        return host.querySelector('li')!;
    }

    test('the Reader opens it beside the last passage read, or as the first', async () => {
        const straightItems: unknown[] = [];
        h.viewController = {
            isLookup: false,
            get straightBibleItems() {
                return [...straightItems];
            },
            addBibleItem: vi.fn(),
            addBibleItemRight: vi.fn(),
        };
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);
        expect(h.refreshEvents.at(-1)).toEqual([['select'], LIST_FILE_PATH]);
        await dispatch(getRow(), 'dblclick');
        expect(h.viewController.addBibleItem).toHaveBeenCalledWith(
            null,
            bibleItem,
            false,
            false,
            false,
        );
        const lastRead = { id: 'last' };
        straightItems.push({ id: 'first' }, lastRead);
        await dispatch(getRow(), 'dblclick');
        // A colour group of its own, beside the passage read last.
        expect(h.viewController.addBibleItemRight).toHaveBeenCalledWith(
            lastRead,
            bibleItem,
            true,
        );
        expect(h.viewController.addBibleItem).toHaveBeenCalledOnce();
    });

    test('outside the Presenter and the Reader, opening it does nothing', async () => {
        h.appProvider.isPageReader = false;
        h.viewController = {
            isLookup: false,
            straightBibleItems: [],
            addBibleItem: vi.fn(),
            addBibleItemRight: vi.fn(),
        };
        await renderRow(genBibleItem());
        await dispatch(getRow(), 'dblclick');
        expect(h.selectBibleItem).not.toHaveBeenCalled();
        expect(h.viewController.addBibleItem).not.toHaveBeenCalled();
        expect(h.viewController.addBibleItemRight).not.toHaveBeenCalled();
    });

    test('its menu opens it, removes an attached background and, in the Presenter, generates slides', async () => {
        h.appProvider.isPagePresenter = true;
        h.showLookup = vi.fn();
        h.getAttachedBackground.mockResolvedValue({ type: 'image' });
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);
        await run(() => findButton('More Options', host).click());
        expect(h.getAttachedBackground).toHaveBeenCalledWith(LIST_FILE_PATH, 4);
        expect(h.genRemovingMenu).toHaveBeenCalledWith(LIST_FILE_PATH, 4);
        const [, itemArg, indexArg, lookupArg, menuItems] =
            h.openItemMenu.mock.lastCall!;
        expect([itemArg, indexArg, lookupArg]).toEqual([
            bibleItem,
            0,
            h.showLookup,
        ]);
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Open',
            'Open in Chatbot',
            'Generate Slides',
            'Create Lyric',
            'Remove background',
        ]);
        expect(menuItems[2].childBefore).toBe('icon:file-earmark-slides');
        expect(menuItems[3].childBefore).toBe('icon:music-note-list');

        const openEvent = { shiftKey: false };
        menuItems[0].onSelect(openEvent);
        expect(h.selectBibleItem).toHaveBeenCalledWith(openEvent, bibleItem);

        // The popup is handed a COPY: generating must not touch the row.
        await run(() => menuItems[2].onSelect());
        await waitFor(
            () => document.querySelector('[data-widget-name]') !== null,
            'the Generate Slides popup',
        );
        expect(bibleItem.clone).toHaveBeenCalledOnce();
        expect(
            document
                .querySelector('[data-widget-name]')!
                .getAttribute('aria-label'),
        ).toBe('Generate Slides');
        await run(() => findButton('Cancel').click());
        expect(document.querySelector('[data-widget-name]')).toBeNull();
    });

    test('a menu outside the Presenter has no Generate Slides', async () => {
        await renderRow(genBibleItem());
        await dispatch(getRow(), 'contextmenu');
        const menuItems = h.openItemMenu.mock.lastCall![4];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Open',
            'Open in Chatbot',
        ]);
        expect(h.genRemovingMenu).not.toHaveBeenCalled();
    });

    test('a version or a passage changed on the row is saved into its list file', async () => {
        const bible = { filePath: LIST_FILE_PATH };
        h.bibleFromFilePath.mockResolvedValue(bible);
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);
        await run(() => findButton('Change version KJV', host).click());
        expect(h.bibleFromFilePath).toHaveBeenCalledWith(LIST_FILE_PATH);
        expect(bibleItem.bibleKey).toBe('NIV');
        expect(bibleItem.save).toHaveBeenLastCalledWith(bible);

        const newTarget = {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 17,
        };
        h.newTarget = newTarget;
        await run(() => findButton('Passage 4', host).click());
        expect(bibleItem.target).toBe(newTarget);
        expect(bibleItem.save).toHaveBeenCalledTimes(2);
    });

    test('a list file that no longer opens keeps the change unsaved', async () => {
        h.bibleFromFilePath.mockResolvedValue(null);
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);
        h.newTarget = {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 1,
        };
        await run(() => findButton('Change version KJV', host).click());
        await run(() => findButton('Passage 4', host).click());
        expect(bibleItem.bibleKey).toBe('KJV');
        expect(bibleItem.target.bookKey).toBe('JHN');
        expect(bibleItem.save).not.toHaveBeenCalled();

        // A passage that belongs to no file has no list to be saved into.
        const looseItem = genBibleItem({ filePath: undefined });
        h.bibleFromFilePath.mockClear();
        await renderRow(looseItem);
        await run(() => findButton('Change version KJV', host).click());
        expect(h.bibleFromFilePath).not.toHaveBeenCalled();
        expect(looseItem.save).not.toHaveBeenCalled();
    });

    test('drag in and out of the row dims it and drags the passage', async () => {
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);
        const over = await dispatch(getRow(), 'dragover');
        expect(over.defaultPrevented).toBe(true);
        expect(h.changeDragStyle).toHaveBeenLastCalledWith(
            expect.anything(),
            'opacity',
            '0.5',
        );
        const leave = await dispatch(getRow(), 'dragleave');
        expect(leave.defaultPrevented).toBe(true);
        expect(h.changeDragStyle).toHaveBeenLastCalledWith(
            expect.anything(),
            'opacity',
            '1',
        );
        await dispatch(getRow(), 'dragstart');
        expect(h.dragStart).toHaveBeenCalledWith(expect.anything(), bibleItem);
    });

    test('a passage dropped from this file reorders it; any other passage is the file row’s', async () => {
        const bible = {
            getItemIndex: vi.fn(() => 2),
            moveItemToIndex: vi.fn(),
            save: vi.fn(),
        };
        h.bibleFromFilePath.mockResolvedValue(bible);
        const bibleItem = genBibleItem();
        await renderRow(bibleItem);

        const sameFileItem = { id: 9, filePath: LIST_FILE_PATH };
        h.extractDrop.mockReturnValueOnce({
            type: 'bible-item',
            item: sameFileItem,
        });
        await dispatch(getRow(), 'drop');
        expect(h.stopDragging).toHaveBeenCalledOnce();
        expect(bible.getItemIndex).toHaveBeenCalledWith(bibleItem);
        expect(bible.moveItemToIndex).toHaveBeenCalledWith(sameFileItem, 2);
        expect(bible.save).toHaveBeenCalledOnce();

        // Another file's passage, or a fresh one, goes on to the file row.
        for (const item of [
            { id: 10, filePath: '/bibles/Study.owb' },
            { id: 11 },
        ]) {
            h.extractDrop.mockReturnValueOnce({ type: 'bible-item', item });
            await dispatch(getRow(), 'drop');
        }
        expect(h.stopDragging).toHaveBeenCalledOnce();
        expect(bible.moveItemToIndex).toHaveBeenCalledOnce();
        expect(h.attachDrop).not.toHaveBeenCalled();

        // The list file is gone by the time the drop lands.
        h.bibleFromFilePath.mockResolvedValueOnce(null);
        h.extractDrop.mockReturnValueOnce({
            type: 'bible-item',
            item: sameFileItem,
        });
        await dispatch(getRow(), 'drop');
        expect(h.stopDragging).toHaveBeenCalledTimes(2);
        expect(bible.moveItemToIndex).toHaveBeenCalledOnce();

        // Not a passage at all: a background for this one.
        await dispatch(getRow(), 'drop');
        expect(h.attachDrop).toHaveBeenCalledWith(expect.anything(), {
            filePath: LIST_FILE_PATH,
            id: 4,
        });
        // Every drop clears the dimming it came in with.
        expect(
            h.changeDragStyle.mock.calls.filter(([, , value]) => value === '1'),
        ).toHaveLength(5);
    });

    test('an unreadable passage still has its menu', async () => {
        await renderRow(genBibleItem({ isError: true }));
        expect(host.querySelector('li')).toBeNull();
        const errorRow = [...host.querySelectorAll('div')].find(
            (element) => element.textContent === 'Unreadable passage',
        )!;
        await dispatch(errorRow, 'contextmenu');
        expect(h.openItemMenu).toHaveBeenCalledOnce();
    });

    test('a passage on a screen, or a duplicate, says so', async () => {
        h.isOnScreen = true;
        await renderRow(genBibleItem(), {
            warningMessage: 'Duplicated with item number 3',
        });
        expect(getRow().className).toContain('app-cue-on-air');
        expect(getRow().querySelector('.app-on-screen')).not.toBeNull();
        expect(getRow().querySelector<HTMLElement>('.float-end')!.title).toBe(
            'Duplicated with item number 3',
        );
    });
});

describe('BibleSlidesPopupComp — Generate Slides', () => {
    const BIBLE_INFO_LIST = [
        { key: 'KJV', title: 'King James', locale: 'en' },
        { key: 'NIV', title: 'New International', locale: 'en' },
        { key: 'KHSV', title: 'Khmer Standard', locale: 'km' },
    ];

    function genPassage() {
        return {
            bibleKey: 'KJV',
            toTitleWithBibleKey: async () => '(KJV) John 3:16',
        } as any;
    }

    function getPopup() {
        return document.querySelector<HTMLElement>(
            '.app-floating-widget-portal',
        )!;
    }

    function getFontSizeInput() {
        return getPopup().querySelector<HTMLInputElement>(
            'input[type="number"]',
        )!;
    }

    function getThemeSelect() {
        return getPopup().querySelector<HTMLSelectElement>('select')!;
    }

    function getVersionBox(bibleKey: string) {
        const label = [...getPopup().querySelectorAll('label')].find(
            (element) => element.textContent?.startsWith(bibleKey),
        )!;
        return label.querySelector<HTMLInputElement>('input')!;
    }

    function getSubmitButton() {
        return getPopup().querySelector<HTMLButtonElement>(
            'button[type="submit"]',
        )!;
    }

    function typeFontSize(value: string) {
        const input = getFontSizeInput();
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        return run(() => {
            setValue.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    function chooseTheme(value: string) {
        const select = getThemeSelect();
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            'value',
        )!.set!;
        return run(() => {
            setValue.call(select, value);
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    async function renderPopup(onClose = vi.fn(), bibleItem = genPassage()) {
        await render(
            <BibleSlidesPopupComp bibleItem={bibleItem} onClose={onClose} />,
        );
        return { onClose, bibleItem };
    }

    test('shows loading, then every OTHER local version beside the passage’s own', async () => {
        let resolveList: (list: unknown) => void = () => undefined;
        h.bibleInfoList.mockReturnValue(
            new Promise((resolve) => {
                resolveList = resolve;
            }),
        );
        await renderPopup();
        const popup = getPopup();
        expect(popup.dataset.bsTheme).toBe('dark');
        const widget = popup.querySelector<HTMLElement>('[data-widget-name]')!;
        expect(widget.dataset.widgetName).toBe('Generate Slides');
        expect(widget.dataset.width).toBe('480');
        expect(popup.querySelector('strong')!.textContent).toBe(
            '(KJV) John 3:16',
        );
        expect(popup.querySelector('[role="status"]')!.textContent).toBe(
            'Loading',
        );
        const ownBox = getVersionBox('KJV');
        expect([ownBox.checked, ownBox.disabled]).toEqual([true, true]);

        await run(() => resolveList(BIBLE_INFO_LIST));
        expect(popup.querySelector('[role="status"]')).toBeNull();
        const labels = [...popup.querySelectorAll<HTMLElement>('label')]
            .filter((label) => label.dataset.localeFf !== undefined)
            .map((label) => [label.textContent, label.dataset.localeFf]);
        expect(labels).toEqual([
            ['NIV — New International', 'en'],
            ['KHSV — Khmer Standard', 'km'],
        ]);
        expect(getVersionBox('NIV').checked).toBe(false);
    });

    // 2026-11-04: a list that could not be read left the popup on "Loading"
    // for good -- the hook keeps its value on a rejection, so the alert
    // written for it could never show.
    test('a version list that cannot be read says so instead of loading for good', async () => {
        const error = new Error('Cannot read the Bibles folder');
        h.bibleInfoList.mockRejectedValue(error);
        await renderPopup();
        const popup = getPopup();
        expect(popup.querySelector('[role="status"]')).toBeNull();
        expect(popup.querySelector('[role="alert"]')!.textContent).toBe(
            'Unable to get bible info list',
        );
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('generates the chosen versions at the chosen size and theme, then previews the document', async () => {
        h.theme = 'light';
        h.bibleInfoList.mockResolvedValue(BIBLE_INFO_LIST);
        const appDocument = { filePath: '/documents/John 3 16 KJV-NIV.ows' };
        h.generateSlides.mockResolvedValue({ filePath: appDocument.filePath });
        h.appDocumentGetInstance.mockReturnValue(appDocument);
        h.setSelectedAppDocument.mockResolvedValue(true);
        const { onClose, bibleItem } = await renderPopup();
        expect(getPopup().dataset.bsTheme).toBe('light');

        await typeFontSize('40');
        await chooseTheme('light');
        expect(getThemeSelect().value).toBe('light');
        await run(() => getVersionBox('NIV').click());
        await run(() => getVersionBox('KHSV').click());
        await run(() => getVersionBox('KHSV').click());
        expect(getVersionBox('KHSV').checked).toBe(false);
        await run(() => getSubmitButton().click());

        expect(h.generateSlides).toHaveBeenCalledWith(
            bibleItem,
            ['KJV', 'NIV'],
            { fontSize: 40, theme: 'light' },
        );
        expect(h.appDocumentGetInstance).toHaveBeenCalledWith(
            appDocument.filePath,
        );
        expect(h.setSelectedAppDocument).toHaveBeenCalledWith(appDocument);
        expect(h.showVaryAppDocument).toHaveBeenCalledWith(appDocument);
        expect(onClose).toHaveBeenCalledOnce();
    });

    test('an empty size is Auto; a document left unselected closes without a preview', async () => {
        h.generateSlides.mockResolvedValue({ filePath: '/documents/x.ows' });
        h.appDocumentGetInstance.mockReturnValue({
            filePath: '/documents/x.ows',
        });
        h.setSelectedAppDocument.mockResolvedValue(false);
        const { onClose, bibleItem } = await renderPopup();
        await typeFontSize('');
        await chooseTheme('dark');
        await run(() => getSubmitButton().click());
        expect(h.generateSlides).toHaveBeenCalledWith(bibleItem, ['KJV'], {
            fontSize: undefined,
            theme: 'dark',
        });
        expect(h.showVaryAppDocument).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });

    test('a size that is not a positive number cannot be sent', async () => {
        await renderPopup();
        for (const badSize of ['-3', '0']) {
            await typeFontSize(badSize);
            expect(getSubmitButton().disabled).toBe(true);
            // Enter in the field submits the form without the button.
            await run(() =>
                getPopup()
                    .querySelector('form')!
                    .dispatchEvent(
                        new Event('submit', {
                            bubbles: true,
                            cancelable: true,
                        }),
                    ),
            );
        }
        expect(h.generateSlides).not.toHaveBeenCalled();
        await typeFontSize('12.5');
        expect(getSubmitButton().disabled).toBe(false);
    });

    test('while generating nothing can be changed, sent twice or closed; a failed run stays open', async () => {
        h.bibleInfoList.mockResolvedValue(BIBLE_INFO_LIST);
        let finish: (file: unknown) => void = () => undefined;
        h.generateSlides.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        const { onClose } = await renderPopup();
        await run(() => getSubmitButton().click());
        expect(getSubmitButton().disabled).toBe(true);
        expect(
            getSubmitButton().querySelector('.spinner-border'),
        ).not.toBeNull();
        expect(getFontSizeInput().disabled).toBe(true);
        expect(getThemeSelect().disabled).toBe(true);
        expect(getVersionBox('NIV').disabled).toBe(true);
        expect(findButton('Cancel').disabled).toBe(true);

        await run(() => findButton('Close widget').click());
        await run(() =>
            getPopup()
                .querySelector('form')!
                .dispatchEvent(
                    new Event('submit', { bubbles: true, cancelable: true }),
                ),
        );
        expect(onClose).not.toHaveBeenCalled();
        expect(h.generateSlides).toHaveBeenCalledOnce();

        await run(() => finish(null));
        expect(onClose).not.toHaveBeenCalled();
        expect(getSubmitButton().disabled).toBe(false);
        expect(getSubmitButton().querySelector('.spinner-border')).toBeNull();
        expect(getVersionBox('NIV').disabled).toBe(false);
        await run(() => findButton('Cancel').click());
        expect(onClose).toHaveBeenCalledOnce();
    });
});
