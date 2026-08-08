// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    bibleGenStyleMock,
    bibleValidateMock,
    canvasControllerState,
    canvasItemPropsState,
    canvasItemState,
    copyToClipboardMock,
    defaultContextMenuHandlerMock,
    deleteItemsMock,
    genHandleContextMenuOpeningMock,
    getBoxStyleMock,
    handleErrorMock,
    htmlGenStyleMock,
    htmlValidateMock,
    imageValidateMock,
    setEditingCanvasItemMock,
    setSelectedCanvasItemsMock,
    showAppContextMenuMock,
    textGenStyleMock,
    textValidateMock,
    videoValidateMock,
    cameraValidateMock,
    audioValidateMock,
    websiteValidateMock,
    useWebCapturingMock,
    webCapturingState,
} = vi.hoisted(() => {
    const defaultContextMenuHandlerMock = vi.fn();
    const genHandleContextMenuOpeningMock = vi.fn(
        () => defaultContextMenuHandlerMock,
    );
    const deleteItemsMock = vi.fn();
    const getBoxStyleMock = vi.fn(() => ({
        border: '1px solid rgb(255, 0, 0)',
        width: '240px',
        height: '120px',
    }));
    const webCapturingState = { imageData: undefined as string | undefined };
    return {
        webCapturingState,
        useWebCapturingMock: vi.fn(() => {
            return webCapturingState.imageData;
        }),
        websiteValidateMock: vi.fn(),
        bibleGenStyleMock: vi.fn(() => ({ color: 'navy' })),
        bibleValidateMock: vi.fn(),
        canvasControllerState: {
            value: {
                deleteItems: deleteItemsMock,
                genHandleContextMenuOpening: genHandleContextMenuOpeningMock,
                focusEditor: vi.fn(),
            } as any,
        },
        canvasItemPropsState: {
            value: {
                id: 11,
                text: 'Line 1\nLine 2',
                html: '<strong>Markup</strong>',
                width: 120,
                height: 60,
                mediaWidth: 240,
                mediaHeight: 120,
                srcData: 'data:image/png;base64,image',
                bibleRenderingList: [
                    {
                        title: 'Genesis 1:1',
                        text: 'In the beginning',
                    },
                ],
            } as any,
        },
        canvasItemState: {
            value: {
                id: 99,
                props: {
                    id: 99,
                    type: 'error',
                    reason: 'broken',
                },
                getBoxStyle: getBoxStyleMock,
            } as any,
        },
        copyToClipboardMock: vi.fn(),
        defaultContextMenuHandlerMock,
        deleteItemsMock,
        genHandleContextMenuOpeningMock,
        getBoxStyleMock,
        handleErrorMock: vi.fn(),
        htmlGenStyleMock: vi.fn(() => ({ fontSize: '20px' })),
        htmlValidateMock: vi.fn(),
        imageValidateMock: vi.fn(),
        setEditingCanvasItemMock: vi.fn(),
        setSelectedCanvasItemsMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        textGenStyleMock: vi.fn(() => ({ fontSize: '18px' })),
        textValidateMock: vi.fn(),
        videoValidateMock: vi.fn(),
        cameraValidateMock: vi.fn(),
        audioValidateMock: vi.fn(),
    };
});

vi.mock('../CanvasController', async () => {
    const { createContext } = await import('react');
    return {
        useCanvasControllerContext: () => canvasControllerState.value,
        CanvasControllerContext: createContext(null),
    };
});

vi.mock('../../../bible-list/BibleItem', () => ({
    default: {
        fromTitleText: vi.fn(),
    },
}));

vi.mock('../../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: vi.fn(),
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemContext: () => canvasItemState.value,
    useCanvasItemPropsContext: () => canvasItemPropsState.value,
    useSetEditingCanvasItem: () => setEditingCanvasItemMock,
    useSetSelectedCanvasItems: () => setSelectedCanvasItemsMock,
}));

vi.mock('../CanvasItemBibleItem', () => ({
    default: {
        validate: bibleValidateMock,
        genStyle: bibleGenStyleMock,
    },
}));

vi.mock('../CanvasItemHtml', () => ({
    default: {
        validate: htmlValidateMock,
        genStyle: htmlGenStyleMock,
    },
}));

vi.mock('../CanvasItemImage', () => ({
    default: {
        validate: imageValidateMock,
    },
}));

vi.mock('../CanvasItemText', () => ({
    default: {
        validate: textValidateMock,
        genStyle: textGenStyleMock,
    },
}));

vi.mock('../CanvasItemVideo', () => ({
    default: {
        validate: videoValidateMock,
    },
}));

vi.mock('../CanvasItemCamera', () => ({
    default: {
        validate: cameraValidateMock,
    },
}));

vi.mock('../CanvasItemAudio', () => ({
    default: {
        validate: audioValidateMock,
    },
}));

vi.mock('../CanvasItemWebsite', () => ({
    default: {
        validate: websiteValidateMock,
    },
}));

vi.mock('../../../helper/capturingHelpers', () => ({
    useWebCapturing: useWebCapturingMock,
}));

vi.mock('../../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => null,
}));

// `pathUtils` is not used by any view here, but the audio view reaches
// `canvasHelpers` -> `fileHelpers`, which reads `appProvider.pathUtils.sep` at
// module load and throws without it.
vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: {
            copyToClipboard: copyToClipboardMock,
        },
        pathUtils: {
            sep: '/',
        },
    },
}));

// The error view now imports `tran`, which reaches `langHelpers` ->
// `settingHelpers` -> `fileHelpers` -> `appProvider.pathUtils.sep` (unmocked
// here). Identity `tran` short-circuits that chain and keeps the raw-string
// assertions ('Error', 'Delete', 'Copy Error Json') intact.
vi.mock('../../../lang/langHelpers', () => ({
    tran: (v: string) => v,
}));

vi.mock('../../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../404.png', () => ({
    default: 'fallback-404.png',
}));

vi.mock('../../../server/calcHelpers', () => ({
    pathToFileURL: (filePath: string) => `file://${filePath}`,
}));

import BoxEditorNormalViewBibleModeComp, {
    BoxEditorNormalBibleRender,
} from './BoxEditorNormalViewBibleModeComp';
import BoxEditorNormalViewErrorComp, {
    BoxEditorNormalViewErrorRenderComp,
} from './BoxEditorNormalViewErrorComp';
import BoxEditorNormalViewHtmlModeComp, {
    BoxEditorNormalHtmlRenderComp,
} from './BoxEditorNormalViewHtmlModeComp';
import BoxEditorNormalViewImageModeComp, {
    BoxEditorNormalImageRenderComp,
} from './BoxEditorNormalViewImageModeComp';
import BoxEditorNormalViewTextModeComp, {
    BoxEditorNormalTextRender,
} from './BoxEditorNormalViewTextModeComp';
import BoxEditorNormalViewVideoModeComp, {
    BoxEditorNormalVideoRender,
} from './BoxEditorNormalViewVideoModeComp';
import BoxEditorNormalViewCameraModeComp, {
    BoxEditorNormalCameraRender,
} from './BoxEditorNormalViewCameraModeComp';
import BoxEditorNormalViewAudioModeComp, {
    BoxEditorNormalAudioRender,
} from './BoxEditorNormalViewAudioModeComp';
import BoxEditorNormalViewWebsiteModeComp, {
    BoxEditorNormalWebsiteRender,
} from './BoxEditorNormalViewWebsiteModeComp';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import { CanvasControllerContext } from '../CanvasController';

// jsdom ships no `IntersectionObserver`, and the website view uses one to hold
// off capturing until the box is actually on screen. `isIntersecting` here is
// what lets a test choose between "scrolled into view" and "still off screen".
const intersectionState = { isIntersecting: true };
class FakeIntersectionObserver {
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
    }
    observe() {
        if (intersectionState.isIntersecting) {
            this.callback([{ isIntersecting: true }] as any, this as any);
        }
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
        return [];
    }
}

describe('BoxEditor normal view components', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
        intersectionState.isIntersecting = true;
        webCapturingState.imageData = undefined;
        vi.clearAllMocks();
        canvasItemPropsState.value = {
            id: 11,
            text: 'Line 1\nLine 2',
            html: '<strong>Markup</strong>',
            width: 120,
            height: 60,
            mediaWidth: 240,
            mediaHeight: 120,
            srcData: 'data:image/png;base64,image',
            bibleRenderingList: [
                {
                    title: 'Genesis 1:1',
                    text: 'In the beginning',
                },
                {
                    title: 'John 3:16',
                    text: 'For God so loved the world',
                },
            ],
        };
        canvasItemState.value = {
            id: 99,
            props: {
                id: 99,
                type: 'error',
                reason: 'broken',
            },
            getBoxStyle: getBoxStyleMock,
        };
        container = document.createElement('div');
        document.body.appendChild(container);
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
                throw new Error('Missing test container');
            }
            if (!root) {
                root = createRoot(container);
            }
            root.render(element);
        });
    }

    test('uses custom wrapper handlers and selects the canvas item on click', async () => {
        const customContextMenuMock = vi.fn();
        const customDoubleClickMock = vi.fn();

        await render(
            <BoxEditorNormalWrapperComp
                style={{ border: '2px solid blue', width: '50px' }}
                onContextMenu={customContextMenuMock}
                onDoubleClick={customDoubleClickMock}
            >
                <span className="wrapper-child">child</span>
            </BoxEditorNormalWrapperComp>,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');

        expect(wrapper?.dataset.appBoxEditorId).toBe('99');
        expect(wrapper?.style.border).toBe('2px solid blue');
        expect(container?.textContent).toContain('child');

        await act(async () => {
            wrapper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            wrapper?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            wrapper?.dispatchEvent(
                new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(setSelectedCanvasItemsMock).toHaveBeenCalledWith(
            canvasItemState.value,
            { isAppend: false },
        );
        expect(customContextMenuMock).toHaveBeenCalledTimes(1);
        expect(customDoubleClickMock).toHaveBeenCalledTimes(1);
        expect(genHandleContextMenuOpeningMock).not.toHaveBeenCalled();
    });

    test('uses the default wrapper context menu handler when no override is provided', async () => {
        await render(
            <BoxEditorNormalWrapperComp style={{ width: '40px' }}>
                <span>default-context</span>
            </BoxEditorNormalWrapperComp>,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        expect(genHandleContextMenuOpeningMock).toHaveBeenCalledWith(
            canvasItemState.value,
            expect.any(Function),
            false,
            null,
        );

        const editHandler = (
            genHandleContextMenuOpeningMock.mock.calls[0] as any
        )?.[1] as (() => void) | undefined;
        editHandler?.();

        await act(async () => {
            wrapper?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(setEditingCanvasItemMock).toHaveBeenCalledWith(
            canvasItemState.value,
        );
        expect(defaultContextMenuHandlerMock).toHaveBeenCalledTimes(1);
    });

    test('renders the error box and executes both error context menu actions', async () => {
        canvasItemState.value.props = {
            id: 99,
            type: 'error',
            reason: 'bad-data',
        };

        await render(<BoxEditorNormalViewErrorComp />);

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        expect(wrapper?.style.border).toBe('1px solid rgb(255, 0, 0)');
        expect(container?.textContent).toContain('Error');

        await act(async () => {
            wrapper?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(showAppContextMenuMock).toHaveBeenCalledOnce();
        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] as any[];
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Delete',
            'Copy Error Json',
        ]);

        menuItems[0]?.onSelect();
        menuItems[1]?.onSelect();

        expect(deleteItemsMock).toHaveBeenCalledWith([canvasItemState.value]);
        expect(copyToClipboardMock).toHaveBeenCalledWith(
            JSON.stringify(canvasItemState.value.props),
        );
    });

    test('renders the standalone error placeholder', async () => {
        await render(<BoxEditorNormalViewErrorRenderComp />);

        const placeholder = container?.querySelector<HTMLDivElement>('div');

        expect(placeholder?.textContent).toBe('Error');
        expect(placeholder?.style.color).toBe('red');
        expect(placeholder?.style.display).toBe('flex');
    });

    test('renders Bible content inside the normal wrapper', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            html:
                '<div><div>Genesis 1:1</div><div>In the beginning</div></div>' +
                '<div><div>John 3:16</div>' +
                '<div>For God so loved the world</div></div>',
        };
        await render(
            <BoxEditorNormalViewBibleModeComp
                style={{ backgroundColor: 'lavender' }}
            />,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        const renderedBible =
            container?.querySelector<HTMLDivElement>('[title="11"]');

        expect(bibleValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(bibleGenStyleMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(wrapper?.style.backgroundColor).toBe('lavender');
        expect(renderedBible?.style.color).toBe('navy');
        expect(container?.textContent).toContain('Genesis 1:1');
        expect(container?.textContent).toContain('For God so loved the world');
    });

    test('falls back to the error view when Bible props are invalid', async () => {
        const error = new Error('bad bible');
        bibleValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalBibleRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('renders text content with line breaks and HTML content separately', async () => {
        await render(
            <BoxEditorNormalViewTextModeComp
                style={{ backgroundColor: 'beige' }}
            />,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        const textNode =
            container?.querySelector<HTMLDivElement>('[title="11"]');

        expect(textValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(textGenStyleMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(wrapper?.style.backgroundColor).toBe('beige');
        expect(textNode?.innerHTML).toContain('Line 1<br');

        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            id: 12,
            html: '<em>Inline html</em>',
        };
        await render(
            <BoxEditorNormalViewHtmlModeComp
                style={{ backgroundColor: 'azure' }}
            />,
        );

        const htmlNode =
            container?.querySelector<HTMLDivElement>('[title="12"]');
        expect(htmlValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(htmlNode?.innerHTML).toBe('<em>Inline html</em>');
    });

    test('falls back to the error view when text props are invalid', async () => {
        const error = new Error('bad text');
        textValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalTextRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('falls back to the error view when html props are invalid', async () => {
        const error = new Error('bad html');
        htmlValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalHtmlRenderComp />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('renders images filling the box and falls back to the 404 asset', async () => {
        await render(
            <BoxEditorNormalViewImageModeComp
                style={{ backgroundColor: 'mintcream' }}
            />,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        const image = container?.querySelector<HTMLImageElement>('img');
        expect(imageValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(wrapper?.style.backgroundColor).toBe('mintcream');
        expect(image?.style.width).toBe('100%');
        expect(image?.style.height).toBe('100%');
        expect(image?.style.objectFit).toBe('fill');
        expect(image?.getAttribute('src')).toBe('data:image/png;base64,image');

        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            srcData: '',
        };
        await render(<BoxEditorNormalImageRenderComp />);

        const fallbackImage = container?.querySelector<HTMLImageElement>('img');
        expect(fallbackImage?.getAttribute('src')).toBe('fallback-404.png');
    });

    test('falls back to the error view when image props are invalid', async () => {
        const error = new Error('bad image');
        imageValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalImageRenderComp />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('renders videos with a play icon and falls back to the 404 asset', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            filePath: '/videos/clip.mp4',
        };
        await render(
            <BoxEditorNormalViewVideoModeComp
                style={{ backgroundColor: 'aliceblue' }}
            />,
        );

        const wrapper =
            container?.querySelector<HTMLDivElement>('.app-box-editor');
        const video = container?.querySelector<HTMLVideoElement>('video');
        const playIcon = container?.querySelector<SVGSVGElement>('svg');
        expect(videoValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(wrapper?.style.backgroundColor).toBe('aliceblue');
        // Video src is derived from the file path, not inlined base64 data.
        expect(video?.getAttribute('src')).toBe('file:///videos/clip.mp4');
        expect(video?.style.width).toBe('100%');
        expect(video?.style.height).toBe('100%');
        expect(video?.style.objectFit).toBe('fill');
        expect(playIcon?.getAttribute('width')).toBe('15');

        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            filePath: '',
        };
        await render(<BoxEditorNormalVideoRender />);

        const fallbackVideo =
            container?.querySelector<HTMLVideoElement>('video');
        expect(fallbackVideo?.getAttribute('src')).toBe('fallback-404.png');
    });

    test('renders a camera as a static placeholder carrying its device marks', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            deviceId: 'device-1',
            label: 'HD Webcam',
            isMirrored: true,
            objectFit: 'contain',
        };

        await render(
            <BoxEditorNormalViewCameraModeComp
                style={{ backgroundColor: 'aliceblue' }}
            />,
        );

        const video = container?.querySelector<HTMLVideoElement>('video');
        expect(cameraValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        // No `src`/`srcObject` here at all: the editor, the item list and slide
        // thumbnails must never open a device. Only the screen manager
        // hydrates this element, and these marks are how it finds it.
        expect(video?.getAttribute('src')).toBeNull();
        expect(video?.hasAttribute('data-camera-item')).toBe(true);
        expect(video?.getAttribute('data-camera-device-id')).toBe('device-1');
        expect(video?.getAttribute('data-camera-device-label')).toBe(
            'HD Webcam',
        );
        // A live feed must not count as "media playing" for the slide-swap or
        // page-unload guards.
        expect(video?.getAttribute('data-ignore-media-guarding')).toBe('true');
        expect(video?.style.objectFit).toBe('contain');
        expect(video?.style.transform).toBe('scaleX(-1)');

        // Exactly one preview-only badge, and it must be a SIBLING of the video
        // so `setCameraBadgeVisibility` can find it from the parent.
        const badges = container?.querySelectorAll('[data-preview-only]') ?? [];
        expect(badges.length).toBe(1);
        expect(badges[0].parentElement).toBe(video?.parentElement);
        expect(container?.textContent).toContain('HD Webcam');
    });

    test('renders a website as a screenshot placeholder, never an iframe', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            id: 42,
            type: 'website',
            url: 'https://example.com/clock',
            width: 800,
            height: 600,
        };

        await render(
            <BoxEditorNormalViewWebsiteModeComp
                style={{ backgroundColor: 'aliceblue' }}
            />,
        );

        expect(websiteValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        // The whole point: the editor, the item list, slide thumbnails and
        // print must never load the page. Only the screen manager hydrates it,
        // and these marks are how it finds the box.
        expect(container?.querySelector('iframe')).toBeNull();
        const frame = container?.querySelector<HTMLDivElement>(
            '[data-website-item]',
        );
        expect(frame).not.toBeNull();
        expect(frame?.getAttribute('data-website-url')).toBe(
            'https://example.com/clock',
        );
        // The mini screen and print fill their own screenshot off a DETACHED
        // div, where no element has a layout box; this is how they learn the
        // size, and how they end up on the same cache entry as the editor.
        expect(frame?.getAttribute('data-website-capture-size')).toBe(
            '800x600',
        );
        // The frame has to stay a hit target or the hover handlers never fire.
        expect(frame?.style.pointerEvents).toBe('');
        // Exactly one preview-only placeholder, and it must be a CHILD of the
        // frame so the hydration can hide it by `frame.querySelector(...)`.
        const placeholders =
            container?.querySelectorAll('[data-preview-only]') ?? [];
        expect(placeholders.length).toBe(1);
        expect(placeholders[0].parentElement).toBe(frame);
        expect((placeholders[0] as HTMLElement).style.pointerEvents).toBe(
            'none',
        );
        // Captured at the item's OWN box size, so every surface shares one
        // cache key and the png stays small.
        expect(useWebCapturingMock).toHaveBeenCalledWith(
            'https://example.com/clock',
            { width: 800, height: 600, isEnabled: true },
        );
    });

    test('clamps the capture to the long side of the box', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'website',
            url: 'https://example.com/wide',
            width: 1920,
            height: 1080,
        };

        await render(<BoxEditorNormalWebsiteRender />);

        expect(useWebCapturingMock).toHaveBeenCalledWith(
            'https://example.com/wide',
            { width: 960, height: 540, isEnabled: true },
        );
    });

    test('holds off capturing until the box is scrolled into view', async () => {
        // A document's slide list mounts EVERY slide at once; a capture opens a
        // hidden BrowserWindow and sleeps for seconds, so an off-screen
        // thumbnail must not start one.
        intersectionState.isIntersecting = false;
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'website',
            url: 'https://example.com/offscreen',
            width: 800,
            height: 600,
        };

        await render(<BoxEditorNormalWebsiteRender />);

        expect(useWebCapturingMock).toHaveBeenCalledWith(
            'https://example.com/offscreen',
            { width: 800, height: 600, isEnabled: false },
        );
    });

    test('falls back to an inline svg and the url with no screenshot', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'website',
            url: 'https://example.com/pending',
            width: 800,
            height: 600,
        };

        await render(<BoxEditorNormalWebsiteRender />);

        expect(container?.querySelector('img')).toBeNull();
        // Inline svg, NOT the `bi` icon font: this markup also has to survive
        // `renderToStaticMarkup` into the screen window and the print document,
        // neither of which loads that font.
        expect(container?.querySelector('svg')).not.toBeNull();
        expect(container?.querySelector('i.bi')).toBeNull();
        expect(container?.textContent).toContain('https://example.com/pending');
    });

    test('shows the screenshot once it has been captured', async () => {
        webCapturingState.imageData = 'data:image/png;base64,shot';
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'website',
            url: 'https://example.com/shot',
            width: 800,
            height: 600,
        };

        await render(<BoxEditorNormalWebsiteRender />);

        const image = container?.querySelector<HTMLImageElement>('img');
        expect(image?.getAttribute('src')).toBe('data:image/png;base64,shot');
        expect(container?.querySelector('iframe')).toBeNull();
    });

    async function renderWebsiteInEditor() {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            id: 7,
            type: 'website',
            url: 'https://example.com/live',
            width: 800,
            height: 600,
        };
        await render(
            <CanvasControllerContext value={canvasControllerState.value}>
                <BoxEditorNormalWebsiteRender />
            </CanvasControllerContext>,
        );
        return container?.querySelector<HTMLDivElement>('[data-website-item]');
    }

    async function dispatchOnFrame(
        frame: HTMLElement | null | undefined,
        type: string,
    ) {
        await act(async () => {
            // Bubbling `mouseover`/`mouseout`, never enter/leave: both the
            // editor canvas and slide previews live in a shadow root, where
            // React cannot synthesize the enter/leave pair.
            frame?.dispatchEvent(
                type === 'pointerdown'
                    ? new MouseEvent('pointerdown', { bubbles: true })
                    : new MouseEvent(type, { bubbles: true }),
            );
        });
    }

    test('goes live on hover in the editor and tears down on leave', async () => {
        vi.useFakeTimers();
        try {
            const frame = await renderWebsiteInEditor();

            await dispatchOnFrame(frame, 'mouseover');
            // Trailing edge only: dragging the pointer across the canvas must
            // not load a page for every box it crosses.
            expect(container?.querySelector('iframe')).toBeNull();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });
            const iframe =
                container?.querySelector<HTMLIFrameElement>('iframe');
            expect(iframe?.getAttribute('src')).toBe(
                'https://example.com/live',
            );
            expect(iframe?.getAttribute('sandbox')).toBe(
                'allow-scripts allow-same-origin allow-forms allow-popups',
            );
            expect(iframe?.getAttribute('referrerpolicy')).toBe(
                'strict-origin-when-cross-origin',
            );
            // An iframe swallows every pointer event; without this the box
            // stops dragging and the frame fires a spurious `mouseout`.
            expect(iframe?.style.pointerEvents).toBe('none');

            // Teardown is immediate, no timer advance.
            await dispatchOnFrame(frame, 'mouseout');
            expect(container?.querySelector('iframe')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('a hover cancelled before the debounce never loads the page', async () => {
        vi.useFakeTimers();
        try {
            const frame = await renderWebsiteInEditor();

            await dispatchOnFrame(frame, 'mouseover');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(500);
            });
            await dispatchOnFrame(frame, 'mouseout');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            expect(container?.querySelector('iframe')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('a pointerdown cancels a pending hover so a drag never pops one', async () => {
        vi.useFakeTimers();
        try {
            const frame = await renderWebsiteInEditor();

            await dispatchOnFrame(frame, 'mouseover');
            // A drag keeps the pointer inside the box, so no `mouseout` ever
            // arrives; without this the iframe appears mid-gesture.
            await dispatchOnFrame(frame, 'pointerdown');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            expect(container?.querySelector('iframe')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('never goes live on hover outside the editor', async () => {
        vi.useFakeTimers();
        try {
            // No `CanvasControllerContext`: this is the presenter's slide list,
            // which renders one of these per slide. Hovering a thumbnail there
            // must never start loading a page.
            canvasItemPropsState.value = {
                ...canvasItemPropsState.value,
                type: 'website',
                url: 'https://example.com/thumb',
                width: 800,
                height: 600,
            };
            await render(<BoxEditorNormalWebsiteRender />);
            const frame = container?.querySelector<HTMLDivElement>(
                '[data-website-item]',
            );

            await dispatchOnFrame(frame ?? null, 'mouseover');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            expect(container?.querySelector('iframe')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('ships no iframe through renderToStaticMarkup', async () => {
        // `genSlideHtml` runs this very tree through `renderToStaticMarkup` for
        // BOTH the screen window and the print document. Effects never run
        // there, so this is the markup the screen manager hydrates and the
        // printer lays out — it must carry the marks and no live page.
        const { renderToStaticMarkup } = await import('react-dom/server');
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            type: 'website',
            url: 'https://example.com/static',
            width: 800,
            height: 600,
        };

        const markup = renderToStaticMarkup(<BoxEditorNormalWebsiteRender />);

        expect(markup).toContain('data-website-item');
        expect(markup).toContain(
            'data-website-url="https://example.com/static"',
        );
        expect(markup).toContain('data-preview-only');
        expect(markup).not.toContain('<iframe');
        // The icon font is not loaded in either destination.
        expect(markup).toContain('<svg');
        expect(markup).not.toContain('class="bi');
    });

    test('falls back to the error view when website props are invalid', async () => {
        const error = new Error('bad website');
        websiteValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalWebsiteRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
        // An invalid item must not trigger a capture.
        expect(useWebCapturingMock).not.toHaveBeenCalled();
    });

    test('falls back to the error view when camera props are invalid', async () => {
        const error = new Error('bad camera');
        cameraValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalCameraRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('paints the audio player scaled up to cover its box', async () => {
        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            filePath: '/slides/song.mp3',
            width: 1200,
            height: 300,
        };

        await render(
            <BoxEditorNormalViewAudioModeComp
                style={{ backgroundColor: 'aliceblue' }}
            />,
        );

        const audio = container?.querySelector<HTMLAudioElement>('audio');
        expect(audioValidateMock).toHaveBeenCalledWith(
            canvasItemPropsState.value,
        );
        expect(audio?.getAttribute('src')).toBe('file:///slides/song.mp3');
        // Nothing is fetched until the operator presses play.
        expect(audio?.getAttribute('preload')).toBe('none');
        // Preview-only: the projected screen hides it and leaves it unsynced.
        expect(audio?.hasAttribute('data-preview-only')).toBe(true);
        // 1200x300 is the control's own proportions 5x over, so it is laid out
        // at exactly those proportions and painted back up by 5 — covering the
        // box exactly. It must be a `transform`, never a `zoom`: a zoomed
        // subtree throws off where Chromium puts the native overflow popup.
        expect(audio?.style.transform).toBe('scale(5)');
        expect(audio?.getAttribute('style')).not.toContain('zoom');
        expect(audio?.style.width).toBe('240px');
        expect(audio?.style.height).toBe('60px');
    });

    test('falls back to the error view when audio props are invalid', async () => {
        const error = new Error('bad audio');
        audioValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalAudioRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('falls back to the error view when video props are invalid', async () => {
        const error = new Error('bad video');
        videoValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalVideoRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });
});
