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
    return {
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
    };
});

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => canvasControllerState.value,
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

vi.mock('../../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => null,
}));

vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: {
            copyToClipboard: copyToClipboardMock,
        },
    },
}));

vi.mock('../../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../404.png', () => ({
    default: 'fallback-404.png',
}));

import BoxEditorNormalViewBibleModeComp, {
    BoxEditorNormalBibleRender,
} from './BoxEditorNormalViewBibleModeComp';
import BoxEditorNormalViewErrorComp, {
    BENViewErrorRender,
} from './BoxEditorNormalViewErrorComp';
import BoxEditorNormalViewHtmlModeComp, {
    BoxEditorNormalHtmlRender,
} from './BoxEditorNormalViewHtmlModeComp';
import BoxEditorNormalViewImageModeComp, {
    BoxEditorNormalImageRender,
} from './BoxEditorNormalViewImageModeComp';
import BoxEditorNormalViewTextModeComp, {
    BoxEditorNormalTextRender,
} from './BoxEditorNormalViewTextModeComp';
import BoxEditorNormalViewVideoModeComp, {
    BoxEditorNormalVideoRender,
} from './BoxEditorNormalViewVideoModeComp';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';

describe('BoxEditor normal view components', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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
        await render(<BENViewErrorRender />);

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

        await render(<BoxEditorNormalHtmlRender />);

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
        await render(<BoxEditorNormalImageRender />);

        const fallbackImage = container?.querySelector<HTMLImageElement>('img');
        expect(fallbackImage?.getAttribute('src')).toBe('fallback-404.png');
    });

    test('falls back to the error view when image props are invalid', async () => {
        const error = new Error('bad image');
        imageValidateMock.mockImplementation(() => {
            throw error;
        });

        await render(<BoxEditorNormalImageRender />);

        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(container?.textContent).toContain('Error');
    });

    test('renders videos with a play icon and falls back to the 404 asset', async () => {
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
        expect(video?.getAttribute('src')).toBe('data:image/png;base64,image');
        expect(video?.style.width).toBe('100%');
        expect(video?.style.height).toBe('100%');
        expect(video?.style.objectFit).toBe('fill');
        expect(playIcon?.getAttribute('width')).toBe('15');

        canvasItemPropsState.value = {
            ...canvasItemPropsState.value,
            srcData: '',
        };
        await render(<BoxEditorNormalVideoRender />);

        const fallbackVideo =
            container?.querySelector<HTMLVideoElement>('video');
        expect(fallbackVideo?.getAttribute('src')).toBe('fallback-404.png');
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
