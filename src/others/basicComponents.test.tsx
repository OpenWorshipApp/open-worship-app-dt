// @vitest-environment jsdom

import { act, lazy, useEffect, useState } from 'react';
import type { DependencyList, ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    showAppContextMenuMock,
    showFileOrDirExplorerMock,
    renameAllMaterialFilesMock,
    moveFilePathMock,
    useAttachedBackgroundDataMock,
    fsCheckDirExistMock,
    pathBasenameMock,
    fileSourceInstances,
    getMockFileSource,
    resizeObserverInstances,
} = vi.hoisted(() => {
    const fileSourceInstances = new Map<string, any>();
    const getMockFileSource = (filePath: string) => {
        const existing = fileSourceInstances.get(filePath);
        if (existing) {
            return existing;
        }
        const fullName = filePath.split('/').pop() ?? filePath;
        const name = fullName.replace(/\.[^.]+$/, '');
        const instance = {
            filePath,
            src: `src:${filePath}`,
            fullName,
            name,
            renameTo: vi.fn(async () => null),
            trash: vi.fn(async () => {}),
            getColorNote: vi.fn(async () => null),
            setColorNote: vi.fn(async (_color: string | null) => {}),
        };
        fileSourceInstances.set(filePath, instance);
        return instance;
    };
    return {
        showSimpleToastMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        showFileOrDirExplorerMock: vi.fn(),
        renameAllMaterialFilesMock: vi.fn(async () => {}),
        moveFilePathMock: vi.fn(async () => {}),
        useAttachedBackgroundDataMock: vi.fn(),
        fsCheckDirExistMock: vi.fn(async () => true),
        pathBasenameMock: vi.fn((filePath: string) => {
            return filePath.split('/').pop() ?? filePath;
        }),
        fileSourceInstances,
        getMockFileSource,
        resizeObserverInstances: [] as Array<{
            callback: () => void;
            observe: ReturnType<typeof vi.fn>;
            disconnect: ReturnType<typeof vi.fn>;
        }>,
    };
});

/* eslint-disable react-hooks/exhaustive-deps */
vi.mock('../helper/debuggerHelpers', () => {
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: <T extends Record<string, unknown>>(
            effectMethod: (methods: T) => Promise<void | (() => void)>,
            deps: DependencyList,
            methods?: T,
        ) => {
            useEffect(() => {
                const methodContext =
                    methods === undefined
                        ? (Object.create(null) as T)
                        : { ...methods };
                void effectMethod(methodContext);
            }, [
                ...deps,
                ...(methods === undefined ? [] : Object.values(methods)),
            ]);
        },
        useAppStateAsync: <T,>(
            callee: () => Promise<T> | T,
            deps: DependencyList,
            defaultValue?: T | null,
        ) => {
            const [value, setValue] = useState<T | null | undefined>(
                defaultValue,
            );
            useEffect(() => {
                Promise.resolve(callee()).then((resolved) => {
                    setValue(resolved);
                });
            }, deps);
            return [value, setValue] as const;
        },
    };
});
/* eslint-enable react-hooks/exhaustive-deps */

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../helper/dragHelpers', () => ({
    useAttachedBackgroundData: useAttachedBackgroundDataMock,
}));

vi.mock('../helper/helpers', () => ({
    freezeObject: <T,>(value: T) => value,
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
}));

vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: showFileOrDirExplorerMock,
    renameAllMaterialFiles: renameAllMaterialFilesMock,
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
    pathBasename: pathBasenameMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: getMockFileSource,
    },
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        moveFilePath: moveFilePathMock,
    },
}));

import { DragTypeEnum } from '../helper/DragInf';
import AppRangeComp, {
    handleCtrlWheel,
    wheelToRangeValue,
} from './AppRangeComp';
import AppSuspenseComp from './AppSuspenseComp';
import AskingNewNameComp from './AskingNewNameComp';
import AttachBackgroundIconComponent from './AttachBackgroundIconComponent';
import FileReadErrorComp from './FileReadErrorComp';
import ItemColorNoteComp from './ItemColorNoteComp';
import LoadingComp from './LoadingComp';
import { PathPreviewerComp } from './PathPreviewerComp';
import RenderRenamingComp from './RenderRenamingComp';
import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from './ShadowingFillParentWidthComp';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

function setInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    );
    descriptor?.set?.call(input, value);
}

describe('others basic components', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let containerWidth = 320;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        resizeObserverInstances.length = 0;
        fileSourceInstances.clear();
        fsCheckDirExistMock.mockResolvedValue(true);
        useAttachedBackgroundDataMock.mockReturnValue(null);
        container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {
            configurable: true,
            get: () => containerWidth,
        });
        document.body.appendChild(container);
        class ResizeObserverMock {
            readonly observe = vi.fn();
            readonly disconnect = vi.fn();
            constructor(callback: () => void) {
                resizeObserverInstances.push({
                    callback,
                    observe: this.observe,
                    disconnect: this.disconnect,
                });
            }
        }
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: ResizeObserverMock,
        });
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function render(element: ReactElement) {
        await act(async () => {
            if (!container) {
                throw new TypeError('Missing test container');
            }
            root = createRoot(container);
            root.render(element);
        });
    }

    test('computes range values and reacts to zoom and slider input', async () => {
        expect(
            wheelToRangeValue({
                defaultSize: { size: 5, min: 1, max: 10, step: 2 },
                isUp: true,
                currentScale: 5,
            }),
        ).toBe(7);
        expect(
            wheelToRangeValue({
                defaultSize: { size: 5, min: 1, max: 10, step: 2 },
                isUp: false,
                currentScale: 1,
            }),
        ).toBe(1);

        const setValue = vi.fn();
        handleCtrlWheel({
            event: { ctrlKey: true, deltaY: 1 },
            value: 5,
            setValue,
            defaultSize: { size: 5, min: 1, max: 10, step: 1 },
        });
        handleCtrlWheel({
            event: { ctrlKey: false, deltaY: 1 },
            value: 5,
            setValue,
            defaultSize: { size: 5, min: 1, max: 10, step: 1 },
        });
        expect(setValue).toHaveBeenCalledTimes(1);
        expect(setValue).toHaveBeenCalledWith(6);

        const onChange = vi.fn();
        await render(
            <AppRangeComp
                value={5}
                title="Zoom"
                setValue={onChange}
                defaultSize={{ size: 5, min: 1, max: 10, step: 1 }}
                isShowValue
            />,
        );

        const buttons = container?.querySelectorAll('.pointer') ?? [];
        const input = container?.querySelector('input');
        expect(container?.textContent).toContain(':5');

        await act(async () => {
            buttons[0]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
        });
        expect(onChange).toHaveBeenLastCalledWith(4);

        await act(async () => {
            if (!(input instanceof HTMLInputElement)) {
                throw new TypeError('Missing range input');
            }
            setInputValue(input, '9');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(onChange).toHaveBeenLastCalledWith(9);

        await act(async () => {
            buttons[1]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
        });
        expect(onChange).toHaveBeenLastCalledWith(10);
    });

    test('shows suspense fallback until lazy content resolves', async () => {
        let resolveLazy:
            | ((value: { default: () => ReactElement }) => void)
            | null = null;
        const LazyChild = lazy(
            () =>
                new Promise<{ default: () => ReactElement }>((resolve) => {
                    resolveLazy = resolve;
                }),
        );

        await render(
            <AppSuspenseComp>
                <LazyChild />
            </AppSuspenseComp>,
        );

        expect(container?.querySelector('img')?.getAttribute('alt')).toBe(
            'Loading...',
        );

        await act(async () => {
            resolveLazy?.({ default: () => <div>Loaded child</div> });
            await flushPromises();
        });

        expect(container?.textContent).toContain('Loaded child');
    });

    test('handles name input apply, cancel, and invalid-name toast flows', async () => {
        const applyName = vi.fn();

        await render(
            <AskingNewNameComp
                defaultName="song"
                applyName={applyName}
                customIcon="ok"
            />,
        );

        const input = container?.querySelector('input');
        const button = container?.querySelector('button');
        if (
            !(input instanceof HTMLInputElement) ||
            !(button instanceof HTMLButtonElement)
        ) {
            throw new TypeError('Missing rename controls');
        }

        await act(async () => {
            setInputValue(input, 'new-song');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(applyName).toHaveBeenCalledWith('new-song');

        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
        });
        expect(applyName).toHaveBeenCalledWith(null);

        await act(async () => {
            setInputValue(input, 'bad/name');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Invalid file name',
            expect.stringContaining('File name cannot contain'),
        );
    });

    test('renders loading and file-read error states', async () => {
        const fileSource = getMockFileSource('/files/bad.txt');
        const reload = vi.fn();

        await render(
            <div>
                <LoadingComp
                    message="Please wait"
                    style={{ minWidth: '20px' }}
                />
                <FileReadErrorComp fileSource={fileSource} reload={reload} />
            </div>,
        );

        expect(container?.textContent).toContain('Please wait');
        expect(container?.textContent).toContain(
            'Fail to read file data: bad.txt',
        );

        const buttons = container?.querySelectorAll('button') ?? [];
        await act(async () => {
            buttons[0]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            buttons[1]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
        });

        expect(reload).toHaveBeenCalledTimes(1);
        expect(fileSource.trash).toHaveBeenCalledTimes(1);
    });

    test('loads and updates item color notes through the context menu', async () => {
        const item = {
            getColorNote: vi.fn(async () => '#FF00FF'),
            setColorNote: vi.fn(async (_color: string | null) => {}),
        };
        const handleChange = vi.fn();

        await render(<ItemColorNoteComp item={item} onChange={handleChange} />);
        await act(async () => {
            await flushPromises();
        });

        const icon = container?.querySelector('i');
        const wrapper = container?.querySelector('span');

        await act(async () => {
            icon?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        const noColorItem = menuItems.find(
            (item: any) => item.menuElement === 'No Color',
        );
        const redItem = menuItems.find(
            (item: any) => item.menuElement === 'red',
        );

        await act(async () => {
            noColorItem.onSelect();
            redItem.onSelect();
        });

        expect(item.setColorNote).toHaveBeenNthCalledWith(1, null);
        expect(item.setColorNote).toHaveBeenNthCalledWith(2, '#ff0000');
        expect(handleChange).toHaveBeenNthCalledWith(1, null);
        expect(handleChange).toHaveBeenNthCalledWith(2, '#ff0000');
        expect(wrapper?.getAttribute('title')).toBe('red');
    });

    test('renders attached background icons and reveals media files from the context menu', async () => {
        const webFile = {
            src: 'web-src',
            filePath: '/media/web.url',
        };
        const imageFile = {
            src: 'image-src',
            filePath: '/media/image.png',
        };
        const mediaFile = {
            src: 'video-src',
            filePath: '/media/video.mp4',
        };
        useAttachedBackgroundDataMock
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: '#00ff00',
            })
            .mockReturnValueOnce({
                type: DragTypeEnum.BACKGROUND_CAMERA,
                item: { src: 'camera://1' },
            })
            .mockReturnValueOnce({
                type: DragTypeEnum.BACKGROUND_WEB,
                item: webFile,
            })
            .mockReturnValueOnce({
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: imageFile,
            })
            .mockReturnValueOnce({
                type: DragTypeEnum.BACKGROUND_VIDEO,
                item: mediaFile,
            });

        await render(
            <div>
                <AttachBackgroundIconComponent filePath="/docs/one" />
                <AttachBackgroundIconComponent filePath="/docs/two" />
                <AttachBackgroundIconComponent filePath="/docs/three" />
                <AttachBackgroundIconComponent filePath="/docs/four" />
                <AttachBackgroundIconComponent filePath="/docs/five" />
                <AttachBackgroundIconComponent filePath="/docs/six" />
            </div>,
        );

        const buttons = container?.querySelectorAll('button') ?? [];
        expect(buttons).toHaveLength(5);
        expect(buttons[0]?.getAttribute('title')).toBe('Color: #00ff00');
        expect(buttons[1]?.getAttribute('title')).toBe('Camera: camera://1');
        expect(buttons[2]?.getAttribute('title')).toBe('web-src');
        expect(buttons[3]?.getAttribute('title')).toBe('image-src');
        expect(buttons[4]?.getAttribute('title')).toBe('video-src');

        await act(async () => {
            buttons[0]?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            buttons[2]?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            buttons[3]?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            buttons[4]?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(showAppContextMenuMock).toHaveBeenCalledTimes(3);

        const webMenuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        const imageMenuItems = showAppContextMenuMock.mock.calls[1]?.[1] ?? [];
        const videoMenuItems = showAppContextMenuMock.mock.calls[2]?.[1] ?? [];
        await act(async () => {
            webMenuItems[0].onSelect();
            imageMenuItems[0].onSelect();
            videoMenuItems[0].onSelect();
        });

        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/media/web.url',
        );
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/media/image.png',
        );
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/media/video.mp4',
        );
    });

    test('previews paths, validates them, and opens the file explorer menu', async () => {
        fsCheckDirExistMock.mockResolvedValue(false);
        const onClick = vi.fn();

        await render(
            <div>
                <PathPreviewerComp
                    dirPath="/base/song.txt"
                    isShowingNameOnly
                    onClick={onClick}
                    canOpenFileExplorer
                />
                <PathPreviewerComp
                    dirPath="/base/skip-check.txt"
                    shouldNotValidate
                />
            </div>,
        );
        await act(async () => {
            await flushPromises();
        });

        const pathItems =
            container?.querySelectorAll('.app-ellipsis-left') ?? [];
        expect(pathItems[0]?.textContent).toBe('song');
        expect(pathItems[0]?.getAttribute('title')).toBe('Invalid Path');
        expect((pathItems[0] as HTMLElement).style.color).toBe('red');
        expect(pathItems[1]?.getAttribute('title')).toBe('base/skip-check.txt');

        await act(async () => {
            pathItems[0]?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            pathItems[0]?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(fsCheckDirExistMock).toHaveBeenCalledWith('/base/song.txt');

        const menuItems = showAppContextMenuMock.mock.calls.at(-1)?.[1] ?? [];
        await act(async () => {
            menuItems[0].onSelect();
        });
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/base/song.txt',
        );
    });

    test('renames files and reports success or cancellation', async () => {
        const setIsRenaming = vi.fn();
        const renamedCallback = vi.fn();
        const fileSource = getMockFileSource('/songs/original.txt');
        const newFileSource = { filePath: '/songs/renamed.txt' };
        fileSource.renameTo
            .mockResolvedValueOnce(newFileSource)
            .mockResolvedValueOnce(null);

        await render(
            <RenderRenamingComp
                setIsRenaming={setIsRenaming}
                filePath="/songs/original.txt"
                renamedCallback={renamedCallback}
            />,
        );

        const input = container?.querySelector('input');
        const button = container?.querySelector('button');
        if (
            !(input instanceof HTMLInputElement) ||
            !(button instanceof HTMLButtonElement)
        ) {
            throw new TypeError('Missing rename form');
        }

        await act(async () => {
            setInputValue(input, 'renamed');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
            await flushPromises();
        });

        expect(renameAllMaterialFilesMock).toHaveBeenCalledWith(
            fileSource,
            'renamed',
        );
        expect(moveFilePathMock).toHaveBeenCalledWith(
            '/songs/original.txt',
            '/songs/renamed.txt',
        );
        expect(renamedCallback).toHaveBeenCalledWith(newFileSource);
        expect(setIsRenaming).toHaveBeenCalledWith(false);

        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
        });
        expect(setIsRenaming).toHaveBeenCalledWith(false);

        await act(async () => {
            setInputValue(input, 'still-renaming');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushPromises();
        });
        expect(setIsRenaming).toHaveBeenCalledWith(true);
    });

    test('renders content inside the shadow container and updates parent width on resize', async () => {
        function WidthProbe() {
            const width = useShadowingParentWidth();
            return <div data-width={width ?? 'none'}>{width ?? 'none'}</div>;
        }

        await render(
            <ShadowingFillParentWidthComp>
                <WidthProbe />
            </ShadowingFillParentWidthComp>,
        );

        const host = container?.querySelector('shadowing-parent-width-tag');
        const getShadowWidth = () => {
            return host?.shadowRoot?.textContent ?? '';
        };

        expect(host?.getAttribute('parentWidth')).toBe('320');
        expect(getShadowWidth()).toContain('320');
        expect(resizeObserverInstances[0]?.observe).toHaveBeenCalledWith(
            container,
        );

        await act(async () => {
            containerWidth = 480;
            resizeObserverInstances[0]?.callback();
        });

        expect(host?.getAttribute('parentWidth')).toBe('480');
        expect(getShadowWidth()).toContain('480');
    });
});
