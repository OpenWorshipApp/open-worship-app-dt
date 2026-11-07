// @vitest-environment jsdom

import { act, lazy, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One mock surface for the small `src/others` components that have no sibling
// test of their own. Everything a component reaches beyond React is mocked
// here, file-locally; `../helper/appHooks` is the real one (it only needs the
// provider's `isDev` / warning flags), so the async-state wiring under test is
// the shipped one.
const h = vi.hoisted(() => {
    const state = {
        tranPrefix: '',
        theme: 'dark',
        isPageLyricEditor: false,
        isPageLWShare: false,
        commitHash: 'abcdef1234567890' as string | undefined,
        electronVersion: '39.2.0',
        bibleNoteVersion: '0.9.4',
        attachedBackgroundData: null as any,
        fontList: undefined as any,
        fontWeightOptionCalls: [] as any[][],
        askingNewNameProps: null as any,
        simpleNoteProps: null as any,
        screenUpdateListeners: new Set<(type: string) => void>(),
    };
    const mocks = {
        handleError: vi.fn(),
        openExternalURL: vi.fn(),
        showAppContextMenu: vi.fn(),
        showFileOrDirExplorer: vi.fn(),
        renameAllMaterialFiles: vi.fn(),
        moveFilePath: vi.fn(),
        getFileSourceInstance: vi.fn(),
        fsCheckDirExist: vi.fn(),
        fsCheckFileExist: vi.fn(),
        useAttachedBackgroundData: vi.fn(),
        genDirSourceContextMenuItems: vi.fn(),
        openPathSetting: vi.fn(),
        openChatbotOnPress: vi.fn(),
        getBibleLocale: vi.fn(),
        getFontFamilyByLocale: vi.fn(),
        getDocxToHtmlsVersion: vi.fn(),
        getPptxToHtmlsVersion: vi.fn(),
    };
    const appProvider = {
        systemUtils: {
            isDev: false,
            get commitHash() {
                return state.commitHash;
            },
            get electronVersion() {
                return state.electronVersion;
            },
        },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: () => {} },
        messageUtils: { sendData: () => {}, sendDataSync: () => undefined },
        appInfo: {
            gitRepository: 'https://github.com/example/owa',
            titleFull: 'Open Worship App (test)',
            version: '2026.11.3',
            description: 'A volunteer-first presenter.',
            homepage: 'https://owa.example.org',
        },
        browserUtils: {
            openExternalURL: (url: string) => mocks.openExternalURL(url),
        },
        get isPageLyricEditor() {
            return state.isPageLyricEditor;
        },
        get isPageLWShare() {
            return state.isPageLWShare;
        },
    };
    return { state, mocks, appProvider };
});

vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => h.state.tranPrefix + key,
    checkIsValidLocale: (locale: string) => ['km', 'en'].includes(locale),
    getFontFamilyByLocale: (locale: string) =>
        h.mocks.getFontFamilyByLocale(locale),
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.mocks.handleError(error),
}));
vi.mock('../_screen/managers/screenManagerHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useScreenUpdateEvents: (
            _screenManager: unknown,
            callback?: (type: string) => void,
        ) => {
            const callbackRef = useRef(callback);
            callbackRef.current = callback;
            useEffect(() => {
                const listener = (type: string) => {
                    callbackRef.current?.(type);
                };
                h.state.screenUpdateListeners.add(listener);
                return () => {
                    h.state.screenUpdateListeners.delete(listener);
                };
            }, []);
        },
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (...args: any[]) => h.mocks.showAppContextMenu(...args),
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: (filePath: string) =>
        h.mocks.showFileOrDirExplorer(filePath),
    renameAllMaterialFiles: (...args: any[]) =>
        h.mocks.renameAllMaterialFiles(...args),
}));
vi.mock('../helper/dragHelpers', () => ({
    useAttachedBackgroundData: (...args: any[]) =>
        h.mocks.useAttachedBackgroundData(...args),
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: (path: string) => h.mocks.fsCheckDirExist(path),
    fsCheckFileExist: (path: string) => h.mocks.fsCheckFileExist(path),
    pathBasename: (path: string) => path.split(/[\\/]/).pop() ?? '',
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) =>
            h.mocks.getFileSourceInstance(filePath),
    },
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        moveFilePath: (...args: any[]) => h.mocks.moveFilePath(...args),
    },
}));
vi.mock('./AskingNewNameComp', () => ({
    default: (props: any) => {
        h.state.askingNewNameProps = props;
        return <input data-mock="asking-new-name" value={props.defaultName} />;
    },
}));
vi.mock('./droppingFileHelpers', () => ({
    genDirSourceContextMenuItems: (...args: any[]) =>
        h.mocks.genDirSourceContextMenuItems(...args),
}));
vi.mock('./SimpleNoteEditorComp', () => ({
    default: (props: any) => {
        h.state.simpleNoteProps = props;
        return <textarea data-mock="simple-note" />;
    },
}));
vi.mock('../server/fontHelpers', () => ({
    useFontList: () => h.state.fontList,
    toCleanFontWeight: (fontWeight: string | null | undefined) => {
        const cleanFontWeight = (fontWeight ?? '').trim();
        return cleanFontWeight === '--' ? '' : cleanFontWeight;
    },
    genFontWeightOptions: (
        fontWeights: string[],
        fontWeight: string,
        missingLabel: string,
    ) => {
        h.state.fontWeightOptionCalls.push([
            fontWeights,
            fontWeight,
            missingLabel,
        ]);
        const options = fontWeights.map((weight) => [weight, `W${weight}`]);
        if (fontWeight !== '' && !fontWeights.includes(fontWeight)) {
            options.unshift([fontWeight, `W${fontWeight} ${missingLabel}`]);
        }
        return options;
    },
}));
vi.mock('../popup-widget/HandleAlertComp', () => ({
    default: () => <div data-mock="handle-alert" />,
}));
vi.mock('../setting/settingHelpers', () => ({
    openPathSetting: () => h.mocks.openPathSetting(),
}));
vi.mock('./AppAssistantComp', () => ({
    default: () => <div data-mock="app-assistant" />,
}));
vi.mock('./commonButtons', () => ({
    openChatbotOnPress: () => h.mocks.openChatbotOnPress(),
}));
vi.mock('../keyboard-shortcut/KeyboardShortcutsComp', () => ({
    default: () => <div data-mock="keyboard-shortcuts" />,
}));
vi.mock('../presenting-control/PresentingControlComp', () => ({
    default: () => <div data-mock="presenting-control" />,
}));
vi.mock('../toast/ToastComp', () => ({
    default: () => <div data-mock="toast" />,
}));
vi.mock('./themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.state.theme }),
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: (bibleKey: string) => h.mocks.getBibleLocale(bibleKey),
}));
vi.mock('bible-note', () => ({
    BibleNote: {
        get VERSION() {
            return h.state.bibleNoteVersion;
        },
    },
}));
vi.mock('../server/docxHelpers', () => ({
    getDocxToHtmlsVersion: () => h.mocks.getDocxToHtmlsVersion(),
}));
vi.mock('../server/pptxHelpers', () => ({
    getPptxToHtmlsVersion: () => h.mocks.getPptxToHtmlsVersion(),
}));

import TabRenderComp, { genTabBody } from './TabRenderComp';
import AttachBackgroundIconComp from './AttachBackgroundIconComp';
import RenderPaginationComp from './RenderPaginationComp';
import { PathPreviewerComp } from './PathPreviewerComp';
import RenderPathTitleComp from './RenderPathTitleComp';
import RenderRenamingComp from './RenderRenamingComp';
import FileReadErrorComp from './FileReadErrorComp';
import ItemReadErrorComp from './ItemReadErrorComp';
import EmptyFileListComp from './EmptyFileListComp';
import NoteEditorRenderComp from './NoteEditorRenderComp';
import BlendModeSelectComp from './BlendModeSelectComp';
import FillingFlexCenterComp from './FillingFlexCenterComp';
import FontSizeControlComp from './FontSizeControlComp';
import FontFamilyControlComp from './FontFamilyControlComp';
import FullscreenPortalComp from './FullscreenPortalComp';
import StickyAutoHideComp from './StickyAutoHideComp';
import NoDataDirGateComp from './NoDataDirGateComp';
import AppWindowToolsComp from './AppWindowToolsComp';
import AppErrorBoundaryComp from './AppErrorBoundaryComp';
import AboutComp from './AboutComp';
import {
    genLabelIcon,
    getLabelIconName,
    toIconedLabel,
    toWidgetLabel,
} from './labelIconHelpers';
import { getReactRoot } from './rootHelpers';
import { applyFontFamily } from './LanguageWrapper';
import { DragTypeEnum } from '../helper/DragInf';
import {
    BLEND_MODE_GROUP_LIST,
    DEFAULT_BLEND_MODE,
} from '../helper/blendModeHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: ReactNode) {
    await act(async () => {
        root?.render(node);
    });
}

async function flush() {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await Promise.resolve();
        });
    }
}

async function unmountRoot() {
    const currentRoot = root;
    root = null;
    if (currentRoot !== null) {
        await act(async () => {
            currentRoot.unmount();
        });
    }
}

async function dispatch(target: EventTarget, event: Event) {
    let result = true;
    await act(async () => {
        result = target.dispatchEvent(event);
    });
    return result;
}

function mouse(type: string) {
    return new MouseEvent(type, { bubbles: true, cancelable: true });
}

function key(keyName: string) {
    return new KeyboardEvent('keydown', {
        key: keyName,
        bubbles: true,
        cancelable: true,
    });
}

async function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pickOption(select: HTMLSelectElement, value: string) {
    await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function getButtonByText(text: string, scope: ParentNode = container) {
    const button = Array.from(scope.querySelectorAll('button')).find(
        (element) => element.textContent?.trim() === text,
    );
    if (button === undefined) {
        throw new Error(`No button "${text}"`);
    }
    return button;
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.state.tranPrefix = '';
    h.state.theme = 'dark';
    h.state.isPageLyricEditor = false;
    h.state.isPageLWShare = false;
    h.state.commitHash = 'abcdef1234567890';
    h.state.electronVersion = '39.2.0';
    h.state.bibleNoteVersion = '0.9.4';
    h.state.attachedBackgroundData = null;
    h.state.fontList = undefined;
    h.state.fontWeightOptionCalls.length = 0;
    h.state.askingNewNameProps = null;
    h.state.simpleNoteProps = null;
    h.state.screenUpdateListeners.clear();
    h.mocks.useAttachedBackgroundData.mockImplementation(
        () => h.state.attachedBackgroundData,
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await unmountRoot();
    container.remove();
    vi.useRealTimers();
});

describe('TabRenderComp', () => {
    test('marks the active and on-screen tabs and routes clicks and right-clicks', async () => {
        const setActiveTab = vi.fn();
        const onContextMenu = vi.fn();
        const checkIsOnScreen = vi.fn(async () => true);
        await render(
            <TabRenderComp
                tabs={[
                    {
                        key: 'a',
                        title: 'Tab A',
                        className: 'tab-a',
                        checkIsOnScreen,
                        onContextMenu,
                    },
                    { key: 'b', title: 'Tab B' },
                ]}
                activeTabs={['b']}
                setActiveTab={setActiveTab}
                className="extra"
            />,
        );
        await flush();
        const list = container.querySelector('ul')!;
        expect(list.className).toBe('nav d-flex flex-nowrap nav-tabs extra');
        expect(list.style.overflowY).toBe('hidden');
        expect(list.style.overflowX).toBe('auto');
        const items = container.querySelectorAll('li');
        expect(items[0].className).toBe('nav-item tab-a');
        expect(items[1].className).toBe('nav-item ');
        const [buttonA, buttonB] = Array.from(
            container.querySelectorAll('button'),
        );
        expect(checkIsOnScreen).toHaveBeenCalledWith('a');
        expect(buttonA.textContent).toBe('Tab A');
        expect(buttonA.classList.contains('app-on-screen')).toBe(true);
        expect(buttonA.classList.contains('active')).toBe(false);
        expect(buttonA.getAttribute('aria-pressed')).toBe('false');
        expect(buttonB.classList.contains('app-on-screen')).toBe(false);
        expect(buttonB.classList.contains('active')).toBe(true);
        expect(buttonB.getAttribute('aria-pressed')).toBe('true');

        await dispatch(buttonB, mouse('click'));
        expect(setActiveTab).toHaveBeenCalledTimes(1);
        expect(setActiveTab.mock.calls[0][0]).toBe('b');

        // A tab with its own right-click handler still opens, then hands over.
        const isNotPreventedA = await dispatch(buttonA, mouse('contextmenu'));
        expect(isNotPreventedA).toBe(false);
        expect(setActiveTab.mock.calls[1][0]).toBe('a');
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        expect(onContextMenu.mock.calls[0][0]).toBe('a');

        // Without one, a right-click is just a click.
        const isNotPreventedB = await dispatch(buttonB, mouse('contextmenu'));
        expect(isNotPreventedB).toBe(true);
        expect(setActiveTab.mock.calls[2][0]).toBe('b');
        expect(onContextMenu).toHaveBeenCalledTimes(1);

        await render(
            <TabRenderComp
                tabs={[{ key: 'a', title: 'Tab A' }]}
                activeTabs={[]}
                isVertical
            />,
        );
        expect(list.className).toBe('nav d-flex flex-nowrap flex-column ');
        expect(list.style.overflowY).toBe('auto');
        expect(list.style.overflowX).toBe('hidden');
    });

    test('re-checks the on-screen dot once per burst of screen updates', async () => {
        vi.useFakeTimers();
        let isOnScreen = false;
        const checkIsOnScreen = vi.fn(async () => isOnScreen);
        await render(
            <TabRenderComp
                tabs={[
                    { key: 'a', title: 'A', checkIsOnScreen },
                    { key: 'b', title: 'B' },
                ]}
                activeTabs={[]}
            />,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const buttonA = container.querySelector('button')!;
        expect(buttonA.classList.contains('app-on-screen')).toBe(false);
        expect(checkIsOnScreen).toHaveBeenCalledTimes(1);
        // One listener per tab, the tab without a checker included.
        expect(h.state.screenUpdateListeners.size).toBe(2);

        isOnScreen = true;
        await act(async () => {
            for (const listener of h.state.screenUpdateListeners) {
                listener('background');
                listener('foreground');
            }
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(checkIsOnScreen).toHaveBeenCalledTimes(1);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(checkIsOnScreen).toHaveBeenCalledTimes(2);
        expect(checkIsOnScreen).toHaveBeenLastCalledWith('a');
        expect(buttonA.classList.contains('app-on-screen')).toBe(true);
    });

    test('genTabBody mounts the lazy body of the selected tab only', async () => {
        const loadA = vi.fn(async () => ({
            default: () => <span>Body A</span>,
        }));
        const loadB = vi.fn(async () => ({
            default: () => <span>Body B</span>,
        }));
        const BodyA = lazy(loadA);
        const BodyB = lazy(loadB);
        await render(
            <div>
                {genTabBody('a', ['a', BodyA])}
                {genTabBody('a', ['b', BodyB])}
            </div>,
        );
        await flush();
        expect(container.textContent).toBe('Body A');
        expect(loadA).toHaveBeenCalledTimes(1);
        expect(loadB).not.toHaveBeenCalled();
    });
});

describe('AttachBackgroundIconComp', () => {
    test('renders nothing without an attached background or for an audio one', async () => {
        h.state.attachedBackgroundData = undefined;
        await render(
            <AttachBackgroundIconComp filePath="/d/a.slides" id={3} />,
        );
        expect(h.mocks.useAttachedBackgroundData).toHaveBeenCalledWith(
            '/d/a.slides',
            3,
        );
        expect(container.innerHTML).toBe('');
        h.state.attachedBackgroundData = null;
        await render(<AttachBackgroundIconComp filePath="/d/a.slides" />);
        expect(container.innerHTML).toBe('');
        h.state.attachedBackgroundData = {
            type: DragTypeEnum.BACKGROUND_AUDIO,
            item: { src: 'x' },
        };
        await render(<AttachBackgroundIconComp filePath="/d/a.slides" />);
        expect(container.innerHTML).toBe('');
    });

    test('a color or camera badge swallows its press without a menu', async () => {
        const documentClick = vi.fn();
        document.addEventListener('click', documentClick);
        try {
            h.state.attachedBackgroundData = {
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: 'red',
            };
            await render(<AttachBackgroundIconComp filePath="/d/a.slides" />);
            let button = container.querySelector('button')!;
            expect(button.title).toBe('Color: red');
            expect(button.getAttribute('aria-label')).toBe('Color: red');
            const icon = button.querySelector('i')!;
            expect(icon.className).toBe('bi bi-filter-circle-fill');
            expect(icon.style.color).toBe('red');
            await dispatch(button, mouse('click'));
            expect(documentClick).not.toHaveBeenCalled();
            expect(h.mocks.showAppContextMenu).not.toHaveBeenCalled();

            h.state.attachedBackgroundData = {
                type: DragTypeEnum.BACKGROUND_CAMERA,
                item: { src: 'camera-123' },
            };
            await render(<AttachBackgroundIconComp filePath="/d/a.slides" />);
            button = container.querySelector('button')!;
            expect(button.title).toBe('Camera: camera-123');
            expect(button.querySelector('i')!.className).toBe(
                'bi bi-camera-video-fill',
            );
            await dispatch(button, mouse('contextmenu'));
            expect(documentClick).not.toHaveBeenCalled();
            expect(h.mocks.showAppContextMenu).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener('click', documentClick);
        }
    });

    test.each([
        [DragTypeEnum.BACKGROUND_WEB, 'Web', 'globe', 'contextmenu'],
        [DragTypeEnum.BACKGROUND_IMAGE, 'Image', 'image', 'click'],
        [
            DragTypeEnum.BACKGROUND_VIDEO,
            'Video',
            'file-earmark-play-fill',
            'contextmenu',
        ],
    ])(
        'a %s badge opens a reveal-file menu on %s',
        async (type, label, iconName, eventType) => {
            h.state.attachedBackgroundData = {
                type,
                item: {
                    src: 'file:///C:/Users/me/media/thing.ext',
                    fullName: 'thing.ext',
                    filePath: 'C:\\Users\\me\\media\\thing.ext',
                },
            };
            await render(<AttachBackgroundIconComp filePath="/d/a.slides" />);
            const button = container.querySelector('button')!;
            expect(button.title).toBe('file:///C:/Users/me/media/thing.ext');
            expect(button.getAttribute('aria-label')).toBe(
                `${label}: thing.ext`,
            );
            expect(button.querySelector('i')!.className).toBe(
                `bi bi-${iconName}`,
            );
            const isNotPrevented = await dispatch(button, mouse(eventType));
            expect(isNotPrevented).toBe(false);
            expect(h.mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
            const [event, items] = h.mocks.showAppContextMenu.mock.calls[0];
            expect(event.type).toBe(eventType);
            expect(items).toHaveLength(1);
            expect(items[0].menuElement).toBe('Reveal in File Explorer');
            expect(items[0].childBefore.props.className).toBe(
                'bi bi-folder2-open',
            );
            items[0].onSelect();
            expect(h.mocks.showFileOrDirExplorer).toHaveBeenCalledWith(
                'C:\\Users\\me\\media\\thing.ext',
            );
        },
    );
});

describe('RenderPaginationComp', () => {
    test('steps, jumps, clamps and restores the page field', async () => {
        const setPage = vi.fn();
        const renderPage = (safePage: number) => {
            return render(
                <RenderPaginationComp
                    safePage={safePage}
                    totalPages={10}
                    totalRecords={95}
                    setPage={setPage}
                />,
            );
        };
        await renderPage(2);
        const [previous, next] = Array.from(
            container.querySelectorAll('button'),
        );
        const input = container.querySelector('input')!;
        expect(previous.getAttribute('aria-label')).toBe('Previous');
        expect(next.getAttribute('aria-label')).toBe('Next');
        expect(input.getAttribute('aria-label')).toBe('Jump to page');
        expect(input.value).toBe('2');
        expect(input.style.width).toBe('5ch');
        expect(container.querySelector('span')!.textContent).toBe('/ 10 · 95');
        expect(previous.disabled).toBe(false);
        expect(next.disabled).toBe(false);

        await dispatch(previous, mouse('click'));
        await dispatch(next, mouse('click'));
        expect(setPage.mock.calls).toEqual([[1], [3]]);
        setPage.mockClear();

        // Focus selects the draft; non-digits are dropped; Enter commits a
        // clamped page once, not again on the blur it causes.
        const select = vi.spyOn(input, 'select');
        await act(async () => {
            input.focus();
        });
        expect(select).toHaveBeenCalledTimes(1);
        await typeInto(input, 'a1b2');
        expect(input.value).toBe('12');
        const isNotPrevented = await dispatch(input, key('Enter'));
        expect(isNotPrevented).toBe(false);
        expect(setPage.mock.calls).toEqual([[10]]);
        expect(document.activeElement).not.toBe(input);

        // An empty draft is put back to the page instead of committed.
        await act(async () => {
            input.focus();
        });
        await typeInto(input, '');
        await dispatch(input, key('Enter'));
        expect(input.value).toBe('2');
        expect(setPage.mock.calls).toEqual([[10]]);

        // Escape restores without committing, its blur included.
        await act(async () => {
            input.focus();
        });
        await typeInto(input, '7');
        await dispatch(input, key('Escape'));
        expect(input.value).toBe('2');
        expect(document.activeElement).not.toBe(input);
        expect(setPage.mock.calls).toEqual([[10]]);

        // A plain blur commits, clamped to the first page.
        await act(async () => {
            input.focus();
        });
        await typeInto(input, '0');
        await act(async () => {
            input.blur();
        });
        expect(setPage.mock.calls).toEqual([[10], [1]]);

        // Other keys do nothing special.
        await act(async () => {
            input.focus();
        });
        expect(await dispatch(input, key('Tab'))).toBe(true);

        // The committed page is mirrored back and bounds the arrows.
        await renderPage(10);
        expect(input.value).toBe('10');
        expect(next.disabled).toBe(true);
        expect(previous.disabled).toBe(false);
        await renderPage(1);
        expect(input.value).toBe('1');
        expect(previous.disabled).toBe(true);
    });
});

describe('PathPreviewerComp and RenderPathTitleComp', () => {
    test('a valid directory shows its cleaned path, muted, with no menu', async () => {
        h.mocks.fsCheckDirExist.mockResolvedValue(true);
        await render(<PathPreviewerComp dirOrFilePath="/home/me/songs" />);
        await flush();
        expect(h.mocks.fsCheckDirExist).toHaveBeenCalledWith('/home/me/songs');
        expect(h.mocks.fsCheckFileExist).not.toHaveBeenCalled();
        const label = container.querySelector(
            '.app-ellipsis-left',
        ) as HTMLElement;
        expect(label.title).toBe('home/me/songs');
        expect(label.classList.contains('text-muted')).toBe(true);
        expect(label.classList.contains('pointer')).toBe(false);
        expect(label.querySelector('bdi')!.textContent).toBe('home/me/songs');
        expect(container.querySelector('button')).toBeNull();
        await dispatch(label, mouse('contextmenu'));
        expect(h.mocks.showAppContextMenu).not.toHaveBeenCalled();
    });

    test('a missing file is flagged, clickable and shown by its bare name', async () => {
        h.mocks.fsCheckFileExist.mockResolvedValue(false);
        const onClick = vi.fn();
        await render(
            <PathPreviewerComp
                dirOrFilePath={'C:\\data\\song.v2.json'}
                isFile
                isShowingNameOnly
                onClick={onClick}
            />,
        );
        await flush();
        expect(h.mocks.fsCheckFileExist).toHaveBeenCalledWith(
            'C:\\data\\song.v2.json',
        );
        expect(h.mocks.fsCheckDirExist).not.toHaveBeenCalled();
        const label = container.querySelector(
            '.app-ellipsis-left',
        ) as HTMLElement;
        expect(label.title).toBe('Invalid Path');
        expect(label.classList.contains('text-danger-emphasis')).toBe(true);
        expect(label.classList.contains('fw-bold')).toBe(true);
        expect(label.classList.contains('text-muted')).toBe(false);
        expect(label.classList.contains('pointer')).toBe(true);
        expect(label.textContent).toBe('song');
        await dispatch(label, mouse('click'));
        expect(onClick).toHaveBeenCalledTimes(1);

        await render(
            <PathPreviewerComp
                dirOrFilePath="/data/.hidden"
                isShowingNameOnly
            />,
        );
        expect(container.querySelector('bdi')!.textContent).toBe('.hidden');
    });

    test('with the explorer allowed, right-click and the dots both reveal it', async () => {
        h.mocks.fsCheckDirExist.mockResolvedValue(true);
        await render(
            <PathPreviewerComp
                dirOrFilePath="/data/bibles"
                canOpenFileExplorer
            />,
        );
        await flush();
        const label = container.querySelector(
            '.app-ellipsis-left',
        ) as HTMLElement;
        await dispatch(label, mouse('contextmenu'));
        expect(h.mocks.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [, items] = h.mocks.showAppContextMenu.mock.calls[0];
        expect(items[0].menuElement).toBe('Reveal in File Explorer');
        expect(items[0].childBefore.props.className).toBe('bi bi-folder2-open');
        items[0].onSelect();
        expect(h.mocks.showFileOrDirExplorer).toHaveBeenCalledWith(
            '/data/bibles',
        );
        const dots = container.querySelector('button')!;
        expect(dots.title).toBe('More Options');
        await dispatch(dots, mouse('click'));
        expect(h.mocks.showAppContextMenu).toHaveBeenCalledTimes(2);
    });

    test('RenderPathTitleComp shows the directory and extras only when one is set', async () => {
        h.mocks.fsCheckDirExist.mockResolvedValue(true);
        await render(
            <RenderPathTitleComp
                dirSource={{ dirPath: '' } as any}
                extraElements={<span>extra</span>}
            />,
        );
        expect(container.innerHTML).toBe('');
        await render(
            <RenderPathTitleComp
                dirSource={{ dirPath: '/data/lyrics' } as any}
                extraElements={<span className="extra">extra</span>}
            />,
        );
        await flush();
        expect(container.querySelector('bdi')!.textContent).toBe('data/lyrics');
        expect(container.querySelector('.extra')!.textContent).toBe('extra');
        expect(h.mocks.fsCheckDirExist).toHaveBeenCalledWith('/data/lyrics');
    });
});

describe('RenderRenamingComp', () => {
    async function renderRenaming(renameResult: any) {
        const fileSource = {
            name: 'Old',
            renameTo: vi.fn(async () => renameResult),
        };
        h.mocks.getFileSourceInstance.mockReturnValue(fileSource);
        const setIsRenaming = vi.fn();
        const renamedCallback = vi.fn();
        await render(
            <RenderRenamingComp
                setIsRenaming={setIsRenaming}
                filePath="/docs/Old.slides"
                renamedCallback={renamedCallback}
            />,
        );
        return { fileSource, setIsRenaming, renamedCallback };
    }

    test('offers the current name and moves every trace of a rename', async () => {
        const newFileSource = { filePath: '/docs/New.slides' };
        const { fileSource, setIsRenaming, renamedCallback } =
            await renderRenaming(newFileSource);
        expect(h.mocks.getFileSourceInstance).toHaveBeenCalledWith(
            '/docs/Old.slides',
        );
        expect(
            (
                container.querySelector(
                    '[data-mock="asking-new-name"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('Old');
        await act(async () => {
            await h.state.askingNewNameProps.applyName('New');
        });
        expect(fileSource.renameTo).toHaveBeenCalledWith('New');
        expect(h.mocks.renameAllMaterialFiles).toHaveBeenCalledWith(
            fileSource,
            'New',
        );
        expect(h.mocks.moveFilePath).toHaveBeenCalledWith(
            '/docs/Old.slides',
            '/docs/New.slides',
        );
        expect(renamedCallback).toHaveBeenCalledWith(newFileSource);
        expect(setIsRenaming).toHaveBeenCalledWith(false);
        expect(
            h.mocks.renameAllMaterialFiles.mock.invocationCallOrder[0],
        ).toBeLessThan(h.mocks.moveFilePath.mock.invocationCallOrder[0]);
    });

    test('keeps the box open when the rename fails, closes it on cancel', async () => {
        const { fileSource, setIsRenaming, renamedCallback } =
            await renderRenaming(null);
        await act(async () => {
            await h.state.askingNewNameProps.applyName('Taken');
        });
        expect(fileSource.renameTo).toHaveBeenCalledWith('Taken');
        expect(h.mocks.renameAllMaterialFiles).not.toHaveBeenCalled();
        expect(h.mocks.moveFilePath).not.toHaveBeenCalled();
        expect(renamedCallback).not.toHaveBeenCalled();
        expect(setIsRenaming).toHaveBeenLastCalledWith(true);

        await act(async () => {
            await h.state.askingNewNameProps.applyName(null);
        });
        expect(fileSource.renameTo).toHaveBeenCalledTimes(1);
        expect(setIsRenaming).toHaveBeenLastCalledWith(false);
    });
});

describe('FileReadErrorComp and ItemReadErrorComp', () => {
    test('a file read error offers reload, trash and the item menu', async () => {
        const onContextMenu = vi.fn();
        const reload = vi.fn();
        const trash = vi.fn();
        await render(
            <FileReadErrorComp
                fileSource={{ fullName: 'Broken.slides', trash } as any}
                onContextMenu={onContextMenu}
                reload={reload}
            />,
        );
        expect(container.querySelector('.alert')!.textContent).toBe(
            'Fail to read file data: Broken.slides',
        );
        await dispatch(getButtonByText('Reload'), mouse('click'));
        expect(reload).toHaveBeenCalledTimes(1);
        await dispatch(getButtonByText('Move to Trash'), mouse('click'));
        expect(trash).toHaveBeenCalledWith('ask');
        const dots = container.querySelector(
            'button[title="More Options"]',
        ) as HTMLButtonElement;
        expect(dots.className).toContain('app-context-menu-dots--corner');
        await dispatch(dots, mouse('click'));
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        await dispatch(
            container.querySelector('.alert')!,
            mouse('contextmenu'),
        );
        expect(onContextMenu).toHaveBeenCalledTimes(2);
    });

    test('a file read error with nothing to offer is the warning alone', async () => {
        await render(<FileReadErrorComp />);
        expect(container.querySelector('.alert')!.textContent).toBe(
            'Fail to read file data',
        );
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    test('an item read error carries the dots only with a menu', async () => {
        const onContextMenu = vi.fn();
        await render(<ItemReadErrorComp onContextMenu={onContextMenu} />);
        expect(container.querySelector('.card-header')!.textContent).toBe(
            'Item data error',
        );
        await dispatch(container.querySelector('button')!, mouse('click'));
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        await dispatch(
            container.querySelector('.card-header')!,
            mouse('contextmenu'),
        );
        expect(onContextMenu).toHaveBeenCalledTimes(2);
        await render(<ItemReadErrorComp />);
        expect(container.querySelector('button')).toBeNull();
        expect(container.textContent).toBe('Item data error');
    });
});

describe('EmptyFileListComp', () => {
    test('renders nothing when the folder offers no action', async () => {
        h.mocks.genDirSourceContextMenuItems.mockResolvedValue([]);
        const dirSource = { dirPath: '/data/docs' } as any;
        const options = { contextMenuItems: [] } as any;
        await render(
            <EmptyFileListComp
                dirSource={dirSource}
                contextMenuOptions={options}
            />,
        );
        await flush();
        expect(h.mocks.genDirSourceContextMenuItems).toHaveBeenCalledWith(
            dirSource,
            options,
        );
        expect(container.innerHTML).toBe('');
    });

    test('advertises the folder actions as buttons', async () => {
        const onSelect = vi.fn();
        h.mocks.genDirSourceContextMenuItems.mockResolvedValue([
            {
                id: 'new',
                title: 'Create one',
                menuElement: 'New Document',
                childBefore: <i className="bi bi-plus" />,
                childAfter: <kbd>Ctrl+N</kbd>,
                onSelect,
            },
            { menuElement: 'Import (busy)', disabled: true },
        ]);
        await render(
            <EmptyFileListComp
                dirSource={{ dirPath: '/data/docs' } as any}
                contextMenuOptions={{}}
            />,
        );
        await flush();
        expect(container.textContent).toContain('This folder is empty');
        const buttons = Array.from(container.querySelectorAll('button'));
        expect(buttons.map((button) => button.textContent)).toEqual([
            'New DocumentCtrl+N',
            'Import (busy)',
        ]);
        expect(buttons[0].title).toBe('Create one');
        expect(buttons[0].querySelector('i.bi-plus')).not.toBeNull();
        expect(buttons[0].disabled).toBe(false);
        expect(buttons[1].disabled).toBe(true);
        await dispatch(buttons[0], mouse('click'));
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
    });
});

describe('NoteEditorRenderComp', () => {
    test('wires the note store and scrolls its card up on a title double-click', async () => {
        const store = { text: 'note', save: async () => {} } as any;
        await render(
            <NoteEditorRenderComp
                store={store}
                title="Sermon note"
                uuid="note-1"
            />,
        );
        const card = container.firstElementChild as HTMLElement;
        expect(card.dataset.noteEditorUuid).toBe('note-1');
        const title = card.firstElementChild as HTMLElement;
        expect(title.textContent).toBe('Sermon note');
        expect(title.title).toBe('Double click to jump to top');
        expect(h.state.simpleNoteProps.store).toBe(store);
        expect(h.state.simpleNoteProps.placeholder).toBe(
            'Enter your note here...',
        );
        const scrollIntoView = vi.fn();
        (card as any).scrollIntoView = scrollIntoView;
        await dispatch(title, mouse('dblclick'));
        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'start',
        });
        expect(scrollIntoView.mock.contexts[0]).toBe(card);
    });
});

describe('BlendModeSelectComp', () => {
    test('lists the shared blend-mode vocabulary and reports a pick', async () => {
        const setBlendMode = vi.fn();
        await render(
            <BlendModeSelectComp
                className="form-select x"
                blendMode="screen"
                setBlendMode={setBlendMode}
            />,
        );
        const select = container.querySelector('select')!;
        expect(select.className).toBe('form-select x');
        expect(select.getAttribute('aria-label')).toBe('Blend Mode');
        expect(select.value).toBe('screen');
        expect(select.options[0].value).toBe(DEFAULT_BLEND_MODE);
        expect(select.options[0].textContent).toBe('Normal');
        const groups = Array.from(select.querySelectorAll('optgroup'));
        expect(groups.map((group) => group.label)).toEqual(
            BLEND_MODE_GROUP_LIST.map((group) => group.labelKey),
        );
        expect(
            groups.map((group) => {
                return Array.from(group.querySelectorAll('option')).map(
                    (option) => [option.value, option.textContent],
                );
            }),
        ).toEqual(
            BLEND_MODE_GROUP_LIST.map((group) => {
                return group.modes.map((mode) => [mode.value, mode.labelKey]);
            }),
        );
        await pickOption(select, 'multiply');
        expect(setBlendMode).toHaveBeenCalledWith('multiply');
    });
});

describe('FillingFlexCenterComp', () => {
    test('fills one body width with hidden spacers of the given width', async () => {
        Object.defineProperty(document.body, 'clientWidth', {
            configurable: true,
            get: () => 1000,
        });
        try {
            await render(
                <FillingFlexCenterComp
                    width={300}
                    className="spacer"
                    style={{ height: '1px' }}
                />,
            );
            const spacers = Array.from(container.children) as HTMLElement[];
            expect(spacers).toHaveLength(4);
            for (const spacer of spacers) {
                expect(spacer.className).toBe('spacer');
                expect(spacer.style.width).toBe('300px');
                expect(spacer.style.pointerEvents).toBe('none');
                expect(spacer.style.visibility).toBe('hidden');
                expect(spacer.style.height).toBe('1px');
            }
            // A zero width falls back to the body width: one plus one spacer.
            await render(<FillingFlexCenterComp width={0} />);
            expect(container.children).toHaveLength(2);
            expect(container.children[0].getAttribute('class')).toBeNull();
        } finally {
            delete (document.body as any).clientWidth;
        }
    });
});

describe('FontSizeControlComp', () => {
    test('offers a number box and a 15px-step list, both reporting a number', async () => {
        const setFontSize = vi.fn();
        await render(
            <FontSizeControlComp fontSize={60} setFontSize={setFontSize} />,
        );
        const input = container.querySelector('input')!;
        const select = container.querySelector('select')!;
        expect(input.value).toBe('60');
        expect(input.getAttribute('aria-label')).toBe('Font Size');
        expect(select.getAttribute('aria-label')).toBe('Font Size');
        expect(select.value).toBe('60');
        const options = Array.from(select.options);
        expect(options).toHaveLength(21);
        expect(options[0].textContent).toBe('--');
        expect([options[1].value, options[1].textContent]).toEqual([
            '300',
            '300px',
        ]);
        expect([options[20].value, options[20].textContent]).toEqual([
            '15',
            '15px',
        ]);
        await typeInto(input, '42');
        expect(setFontSize).toHaveBeenLastCalledWith(42);
        await pickOption(select, '150');
        expect(setFontSize).toHaveBeenLastCalledWith(150);
    });
});

describe('FontFamilyControlComp', () => {
    const fontList = { Arial: ['400', '700'], Mono: ['400'] };

    test('says when the font list is loading or failed', async () => {
        await render(
            <FontFamilyControlComp fontFamily="" setFontFamily={vi.fn()} />,
        );
        expect(container.textContent).toBe('Loading...');
        h.state.fontList = null;
        await render(
            <FontFamilyControlComp fontFamily="" setFontFamily={vi.fn()} />,
        );
        expect(container.textContent).toBe('Failed to load the font list');
    });

    test('lists the families with a missing one first and reports a pick', async () => {
        h.state.fontList = fontList;
        const setFontFamily = vi.fn();
        await render(
            <FontFamilyControlComp
                fontFamily="Ghost"
                setFontFamily={setFontFamily}
                fontWeight="--"
                setFontWeight={vi.fn()}
                isShowingLabel
            />,
        );
        const select = container.querySelector('select')!;
        const label = container.querySelector('label')!;
        expect(label.textContent).toBe('Font Family');
        expect(label.htmlFor).toBe(select.id);
        expect(select.getAttribute('aria-label')).toBe('Font Family');
        expect(
            Array.from(select.options).map((option) => [
                option.value,
                option.textContent,
            ]),
        ).toEqual([
            ['--', '--'],
            ['Ghost', 'Ghost (Missing)'],
            ['Arial', 'Arial'],
            ['Mono', 'Mono'],
        ]);
        expect(select.options[2].style.fontFamily).toBe('Arial');
        // A missing family has no weights, and `--` is no weight at all.
        expect(h.state.fontWeightOptionCalls.at(-1)).toEqual([
            [],
            '',
            '(Missing)',
        ]);
        expect(container.querySelectorAll('select')).toHaveLength(1);
        await pickOption(select, '--');
        expect(setFontFamily).toHaveBeenLastCalledWith('');
        await pickOption(select, 'Arial');
        expect(setFontFamily).toHaveBeenLastCalledWith('Arial');
    });

    test('offers the weights of a family that has a choice', async () => {
        h.state.fontList = fontList;
        const setFontWeight = vi.fn();
        await render(
            <FontFamilyControlComp
                fontFamily="Arial"
                setFontFamily={vi.fn()}
                fontWeight="700"
                setFontWeight={setFontWeight}
                isShowingLabel
            />,
        );
        const weightSelect = container.querySelector(
            '#text-font-style',
        ) as HTMLSelectElement;
        const weightLabel = container.querySelector(
            'label[for="text-font-style"]',
        )!;
        expect(weightLabel.textContent).toBe('Font Weight');
        expect(weightSelect.getAttribute('aria-label')).toBe('Font Weight');
        expect(weightSelect.value).toBe('700');
        expect(
            Array.from(weightSelect.options).map((option) => [
                option.value,
                option.textContent,
            ]),
        ).toEqual([
            ['', 'Default'],
            ['400', 'W400'],
            ['700', 'W700'],
        ]);
        expect(weightSelect.options[1].style.fontFamily).toBe('Arial');
        expect(weightSelect.options[1].style.fontWeight).toBe('400');
        await pickOption(weightSelect, '400');
        expect(setFontWeight).toHaveBeenCalledWith('400');
    });

    test('hides the weight picker when there is no choice or no setter', async () => {
        h.state.fontList = fontList;
        await render(
            <FontFamilyControlComp
                fontFamily="Mono"
                setFontFamily={vi.fn()}
                setFontWeight={vi.fn()}
            />,
        );
        expect(container.querySelector('#text-font-style')).toBeNull();
        expect(container.querySelector('label')).toBeNull();
        // A saved weight stays pickable even when the family has one weight.
        await render(
            <FontFamilyControlComp
                fontFamily="Mono"
                setFontFamily={vi.fn()}
                fontWeight="900"
                setFontWeight={vi.fn()}
            />,
        );
        const weightSelect = container.querySelector(
            '#text-font-style',
        ) as HTMLSelectElement;
        expect(weightSelect.options[1].textContent).toBe('W900 (Missing)');
        expect(container.querySelector('label')).toBeNull();
        await render(
            <FontFamilyControlComp
                fontFamily="Mono"
                setFontFamily={vi.fn()}
                fontWeight="900"
            />,
        );
        expect(container.querySelector('#text-font-style')).toBeNull();
    });
});

describe('FullscreenPortalComp', () => {
    test('renders its children in place on the server pass', () => {
        expect(
            renderToStaticMarkup(
                <FullscreenPortalComp>
                    <span>Menu</span>
                </FullscreenPortalComp>,
            ),
        ).toBe('<span>Menu</span>');
    });

    test('follows the fullscreen element in and out of the top layer', async () => {
        const fullscreenHost = document.createElement('div');
        document.body.appendChild(fullscreenHost);
        let fullscreenElement: Element | null = null;
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => fullscreenElement,
        });
        const addListener = vi.spyOn(document, 'addEventListener');
        const removeListener = vi.spyOn(document, 'removeEventListener');
        try {
            await render(
                <FullscreenPortalComp>
                    <span className="menu">Menu</span>
                </FullscreenPortalComp>,
            );
            expect(container.querySelector('.menu')).not.toBeNull();
            fullscreenElement = fullscreenHost;
            await dispatch(document, new Event('fullscreenchange'));
            expect(container.querySelector('.menu')).toBeNull();
            expect(fullscreenHost.querySelector('.menu')).not.toBeNull();
            fullscreenElement = null;
            await dispatch(document, new Event('fullscreenchange'));
            expect(container.querySelector('.menu')).not.toBeNull();
            expect(fullscreenHost.querySelector('.menu')).toBeNull();
            const subscription = addListener.mock.calls.find(
                ([type]) => type === 'fullscreenchange',
            )!;
            await unmountRoot();
            expect(removeListener).toHaveBeenCalledWith(
                'fullscreenchange',
                subscription[1],
            );
        } finally {
            delete (document as any).fullscreenElement;
            fullscreenHost.remove();
        }
    });
});

describe('StickyAutoHideComp', () => {
    function mockScrolling(element: HTMLElement) {
        const clock = { now: 0, scrollTop: 0 };
        vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
        Object.defineProperty(element, 'scrollTop', {
            configurable: true,
            get: () => clock.scrollTop,
        });
        return async (scrollTop: number, now: number) => {
            clock.scrollTop = scrollTop;
            clock.now = now;
            await dispatch(element, new Event('scroll'));
        };
    }

    test('hides on a scroll down and returns on a quick scroll up or at the top', async () => {
        container.style.overflowY = 'auto';
        const scrollTo = mockScrolling(container);
        const removeListener = vi.spyOn(container, 'removeEventListener');
        await render(
            <div className="inner">
                <StickyAutoHideComp className="bar">
                    <span>Controls</span>
                </StickyAutoHideComp>
            </div>,
        );
        const bar = container.querySelector(
            '.app-sticky-auto-hide',
        ) as HTMLElement;
        expect(bar.className).toBe('app-sticky-auto-hide bar');
        expect(bar.textContent).toBe('Controls');
        const isHidden = () => bar.classList.contains('app-sticky-hidden');

        await scrollTo(50, 100);
        expect(isHidden()).toBe(true);
        await scrollTo(50, 150); // no movement keeps the state
        expect(isHidden()).toBe(true);
        await scrollTo(45, 160); // a turn too short to count
        expect(isHidden()).toBe(true);
        await scrollTo(20, 170); // a quick flick up
        expect(isHidden()).toBe(false);
        await scrollTo(80, 200);
        expect(isHidden()).toBe(true);
        await scrollTo(2, 210); // back at the top
        expect(isHidden()).toBe(false);
        await scrollTo(90, 300);
        expect(isHidden()).toBe(true);

        await unmountRoot();
        expect(isHidden()).toBe(false);
        expect(removeListener).toHaveBeenCalledWith(
            'scroll',
            expect.any(Function),
        );
        await scrollTo(400, 400);
        expect(isHidden()).toBe(false);
    });

    test('does nothing without a scrolling ancestor', async () => {
        const scrollTo = mockScrolling(container);
        await render(
            <StickyAutoHideComp>
                <span>Controls</span>
            </StickyAutoHideComp>,
        );
        const bar = container.querySelector(
            '.app-sticky-auto-hide',
        ) as HTMLElement;
        expect(bar.className).toBe('app-sticky-auto-hide ');
        await scrollTo(200, 100);
        await scrollTo(400, 200);
        expect(bar.classList.contains('app-sticky-hidden')).toBe(false);
    });
});

describe('NoDataDirGateComp', () => {
    test('points to Settings and to the assistant, with the popup host', async () => {
        h.mocks.openChatbotOnPress.mockResolvedValue(undefined);
        await render(<NoDataDirGateComp />);
        expect(container.querySelector('strong')!.textContent).toBe(
            'No Parent Directory Selected',
        );
        expect(container.textContent).toContain(
            'You need to select a parent directory to start using the app.',
        );
        expect(
            container.querySelector('[data-mock="app-assistant"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-mock="handle-alert"]'),
        ).not.toBeNull();
        await dispatch(getButtonByText('Go to Settings'), mouse('click'));
        expect(h.mocks.openPathSetting).toHaveBeenCalledTimes(1);
        expect(h.mocks.openChatbotOnPress).not.toHaveBeenCalled();
        await dispatch(getButtonByText('App Assistant'), mouse('click'));
        await vi.waitFor(() => {
            expect(h.mocks.openChatbotOnPress).toHaveBeenCalledTimes(1);
        });
        expect(h.mocks.openPathSetting).toHaveBeenCalledTimes(1);
    });
});

describe('AppWindowToolsComp', () => {
    test('mounts the window tools under the theme, toasts only where needed', async () => {
        h.state.theme = 'light';
        const hasToast = () => {
            return container.querySelector('[data-mock="toast"]') !== null;
        };
        await render(<AppWindowToolsComp />);
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.className).toBe('app');
        expect(wrapper.dataset.bsTheme).toBe('light');
        expect(wrapper.style.display).toBe('contents');
        expect(
            Array.from(wrapper.children).map((child) => {
                return child.getAttribute('data-mock');
            }),
        ).toEqual([
            'presenting-control',
            'app-assistant',
            'keyboard-shortcuts',
        ]);
        expect(hasToast()).toBe(false);
        h.state.isPageLyricEditor = true;
        await render(<AppWindowToolsComp />);
        expect(hasToast()).toBe(true);
        h.state.isPageLyricEditor = false;
        h.state.isPageLWShare = true;
        await render(<AppWindowToolsComp />);
        expect(hasToast()).toBe(true);
    });
});

describe('AppErrorBoundaryComp', () => {
    test('passes its children through while nothing throws', async () => {
        await render(
            <AppErrorBoundaryComp>
                <span>Fine</span>
            </AppErrorBoundaryComp>,
        );
        expect(container.innerHTML).toBe('<span>Fine</span>');
        expect(h.mocks.handleError).not.toHaveBeenCalled();
    });

    test('catches a render throw, reports it and retries on demand', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let shouldThrow = true;
        function ThrowingComp() {
            if (shouldThrow) {
                throw new Error('Extension mismatch');
            }
            return <span>Recovered</span>;
        }
        await render(
            <AppErrorBoundaryComp>
                <ThrowingComp />
            </AppErrorBoundaryComp>,
        );
        const alert = container.querySelector('[role="alert"]')!;
        expect(alert.textContent).toBe(
            'Something went wrong hereExtension mismatch',
        );
        expect(
            alert.querySelector('.app-ellipsis')!.getAttribute('title'),
        ).toBe('Extension mismatch');
        expect(h.mocks.handleError).toHaveBeenCalledTimes(2);
        const [[error], [componentStack]] = h.mocks.handleError.mock.calls;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Extension mismatch');
        expect(typeof componentStack).toBe('string');
        expect(componentStack).toContain('ThrowingComp');

        shouldThrow = false;
        await dispatch(getButtonByText('Try Again'), mouse('click'));
        expect(container.innerHTML).toBe('<span>Recovered</span>');
    });
});

describe('labelIconHelpers', () => {
    test('maps an English label key to one icon, translated text beside it', () => {
        h.state.tranPrefix = 'km:';
        expect(getLabelIconName('Bible')).toBe('book');
        expect(getLabelIconName('Not A Label')).toBeNull();
        expect(renderToStaticMarkup(<>{genLabelIcon('Videos')}</>)).toBe(
            '<i class="bi bi-film px-1"></i>',
        );
        expect(
            renderToStaticMarkup(<>{genLabelIcon('Videos', 'me-2')}</>),
        ).toBe('<i class="bi bi-film me-2"></i>');
        expect(genLabelIcon('Not A Label')).toBeNull();
        expect(
            renderToStaticMarkup(<>{toIconedLabel('Background', 'pe-1')}</>),
        ).toBe('<i class="bi bi-card-image pe-1"></i>km:Background');
        expect(
            renderToStaticMarkup(<>{toIconedLabel('Unknown Words')}</>),
        ).toBe('km:Unknown Words');
        expect(toWidgetLabel('Mini Screen')).toEqual({
            widgetName: 'km:Mini Screen',
            widgetKey: 'Mini Screen',
            widgetIconName: 'aspect-ratio',
        });
        expect(toWidgetLabel('Unknown Pane')).toEqual({
            widgetName: 'km:Unknown Pane',
            widgetKey: 'Unknown Pane',
            widgetIconName: undefined,
        });
    });
});

describe('getReactRoot', () => {
    test('alerts and throws when the page has no such container', () => {
        const originalAlert = globalThis.alert;
        const alertMock = vi.fn();
        globalThis.alert = alertMock;
        try {
            expect(() => getReactRoot('missing-root')).toThrow(
                'Root element not found: #missing-root',
            );
            expect(alertMock).toHaveBeenCalledWith(
                'Root element not found: #missing-root',
            );
        } finally {
            globalThis.alert = originalAlert;
        }
    });

    test('empties the "root" container by default and returns a live root', async () => {
        const host = document.createElement('div');
        host.id = 'root';
        host.innerHTML = '<p>boot splash</p>';
        document.body.appendChild(host);
        try {
            const pageRoot = getReactRoot();
            expect(host.innerHTML).toBe('');
            await act(async () => {
                pageRoot.render(<span>Page</span>);
            });
            expect(host.innerHTML).toBe('<span>Page</span>');
            await act(async () => {
                pageRoot.unmount();
            });
        } finally {
            host.remove();
        }
    });
});

describe('applyFontFamily', () => {
    beforeEach(() => {
        h.mocks.getBibleLocale.mockImplementation(async (bibleKey: string) => {
            return ({ KJV: 'en', KHSV: 'km' } as any)[bibleKey];
        });
        h.mocks.getFontFamilyByLocale.mockImplementation(
            async (locale: string) => {
                return locale === 'km' ? 'Battambang' : undefined;
            },
        );
    });

    function genElement(dataset: Record<string, string> = {}) {
        const element = document.createElement('div');
        Object.assign(element.dataset, dataset);
        return element;
    }

    test('ignores a node that is not an element', async () => {
        await applyFontFamily(document.createTextNode('text'), 'added');
        expect(h.mocks.getBibleLocale).not.toHaveBeenCalled();
        expect(h.mocks.getFontFamilyByLocale).not.toHaveBeenCalled();
    });

    test('applies the font of the named locale, or of the bible locale', async () => {
        const localeElement = genElement({ localeFf: 'km' });
        await applyFontFamily(localeElement, 'attr-modified');
        expect(h.mocks.getFontFamilyByLocale).toHaveBeenCalledWith('km');
        expect(h.mocks.getBibleLocale).not.toHaveBeenCalled();
        expect(localeElement.style.fontFamily).toBe('Battambang');

        const bibleElement = genElement({ bibleKeyFf: 'KHSV' });
        await applyFontFamily(bibleElement, 'attr-modified');
        expect(h.mocks.getBibleLocale).toHaveBeenCalledWith('KHSV');
        expect(bibleElement.style.fontFamily).toBe('Battambang');

        // A locale with no font of its own leaves the element alone.
        const englishElement = genElement({ bibleKeyFf: 'KJV' });
        await applyFontFamily(englishElement, 'attr-modified');
        expect(h.mocks.getFontFamilyByLocale).toHaveBeenLastCalledWith('en');
        expect(englishElement.style.fontFamily).toBe('');

        // An unknown locale and an unmarked element ask for no font.
        h.mocks.getFontFamilyByLocale.mockClear();
        await applyFontFamily(genElement({ localeFf: 'xx' }), 'attr-modified');
        await applyFontFamily(genElement(), 'attr-modified');
        expect(h.mocks.getFontFamilyByLocale).not.toHaveBeenCalled();
    });

    test('walks the children of an added subtree only', async () => {
        const parent = genElement();
        const child = genElement({ localeFf: 'km' });
        const grandChild = genElement({ bibleKeyFf: 'KHSV' });
        child.appendChild(grandChild);
        parent.appendChild(child);
        await applyFontFamily(parent, 'removed');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(child.style.fontFamily).toBe('');
        await applyFontFamily(parent, 'added');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(child.style.fontFamily).toBe('Battambang');
        expect(grandChild.style.fontFamily).toBe('Battambang');
        expect(parent.style.fontFamily).toBe('');
    });
});

describe('AboutComp', () => {
    test('shows the app identity and versions and opens the repository', async () => {
        h.mocks.getDocxToHtmlsVersion.mockReturnValue(null);
        h.mocks.getPptxToHtmlsVersion.mockReturnValue(new Promise(() => {}));
        await render(<AboutComp />);
        await vi.waitFor(() => {
            expect(container.textContent).toContain('Bible Note (0.9.4)');
        });
        const about = container.querySelector('#app') as HTMLElement;
        expect(about.dataset.bsTheme).toBe('dark');
        expect(container.textContent).toContain('Open Worship App (test)');
        expect(container.textContent).toContain('A volunteer-first presenter.');
        const versions = Array.from(
            container.querySelectorAll('.module-version'),
        ).map((element) => element.textContent);
        expect(versions).toEqual([
            'Electron (39.2.0)',
            'Pptx to Html Converter (Loading...)',
            'Docx to Html Converter (N/A)',
            'Bible Note (0.9.4)',
        ]);
        const links = Array.from(container.querySelectorAll('a'));
        expect(links.map((link) => [link.textContent, link.href])).toEqual([
            [
                '2026.11.3',
                'https://github.com/OpenWorshipApp/open-worship-app-dt/releases/tag/release-2026.11.3',
            ],
            [
                'abcdef1',
                'https://github.com/OpenWorshipApp/open-worship-app-dt/commit/abcdef1234567890',
            ],
            ['https://owa.example.org', 'https://owa.example.org/'],
        ]);
        const fork = getButtonByText('Fork me on GitHub');
        expect(fork.title).toBe('https://github.com/example/owa');
        await dispatch(fork, mouse('click'));
        expect(h.mocks.openExternalURL).toHaveBeenCalledWith(
            'https://github.com/example/owa',
        );
    });

    test('falls back to N/A for an unknown commit and Electron version', async () => {
        h.state.commitHash = undefined;
        h.state.electronVersion = '';
        h.mocks.getDocxToHtmlsVersion.mockReturnValue('1.4.0');
        h.mocks.getPptxToHtmlsVersion.mockReturnValue('2.0.1');
        await render(<AboutComp />);
        await vi.waitFor(() => {
            expect(container.textContent).toContain('Docx to Html Converter (1.4.0)');
        });
        await vi.waitFor(() => {
            expect(container.textContent).toContain('Pptx to Html Converter (2.0.1)');
        });
        expect(container.textContent).toContain('Electron (N/A)');
        expect(container.querySelectorAll('a')[1].textContent).toBe('N/A');
    });
});
