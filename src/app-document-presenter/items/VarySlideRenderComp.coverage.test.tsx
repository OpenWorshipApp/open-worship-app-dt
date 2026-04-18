// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    useScreenVaryAppDocumentManagerEventsMock,
    genRemovingAttachedBackgroundMenuMock,
    handleDragStartMock,
    handleAttachBackgroundDropMock,
    useAttachedBackgroundDataMock,
    extractDropDataMock,
    changeDragEventStyleMock,
    appProviderMock,
    appDocumentGetInstanceMock,
    getSlideIndexMock,
    moveSlideToIndexMock,
    getColorNoteFilePathSettingMock,
    genAttachBackgroundComponentMock,
    genChooseColorNoteOptionMock,
    getSlideItemShadowingStyleMock,
    toClassNameHighlightMock,
    slideCheckIsThisTypeMock,
    useThemeSourceMock,
} = vi.hoisted(() => ({
    useScreenVaryAppDocumentManagerEventsMock: vi.fn(),
    genRemovingAttachedBackgroundMenuMock: vi.fn(),
    handleDragStartMock: vi.fn(),
    handleAttachBackgroundDropMock: vi.fn(),
    useAttachedBackgroundDataMock: vi.fn(),
    extractDropDataMock: vi.fn(),
    changeDragEventStyleMock: vi.fn(),
    appProviderMock: {
        isPagePresenter: true,
        isPageAppDocumentEditor: false,
    },
    appDocumentGetInstanceMock: vi.fn(),
    getSlideIndexMock: vi.fn(),
    moveSlideToIndexMock: vi.fn(),
    getColorNoteFilePathSettingMock: vi.fn(),
    genAttachBackgroundComponentMock: vi.fn(),
    genChooseColorNoteOptionMock: vi.fn(),
    getSlideItemShadowingStyleMock: vi.fn(),
    toClassNameHighlightMock: vi.fn(),
    slideCheckIsThisTypeMock: vi.fn(),
    useThemeSourceMock: vi.fn(),
}));

vi.mock('../../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsMock,
}));

vi.mock('../../helper/dragHelpers', () => ({
    genRemovingAttachedBackgroundMenu: genRemovingAttachedBackgroundMenuMock,
    handleDragStart: handleDragStartMock,
    handleAttachBackgroundDrop: handleAttachBackgroundDropMock,
    useAttachedBackgroundData: useAttachedBackgroundDataMock,
    extractDropData: extractDropDataMock,
}));

vi.mock('../../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: any) => (
        <div data-testid="screen-icon">{screenId}</div>
    ),
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../helper/helpers', () => ({
    changeDragEventStyle: changeDragEventStyleMock,
}));

vi.mock('../../app-document-list/AppDocument', () => ({
    default: {
        getInstance: appDocumentGetInstanceMock,
    },
}));

vi.mock('../../others/AttachBackgroundIconComponent', () => ({
    default: ({ filePath, id }: any) => (
        <div data-testid="attach-icon">
            {filePath}:{id}
        </div>
    ),
}));

vi.mock('./RenderSlideIndexComp', () => ({
    default: ({ viewIndex }: any) => (
        <div data-testid="render-slide-index">{viewIndex}</div>
    ),
}));

vi.mock('./varyAppDocumentHelpers', () => ({
    SLIDE_ITEMS_CONTAINER_CLASS_NAME: 'slide-items-container',
}));

vi.mock('../../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSetting: getColorNoteFilePathSettingMock,
}));

vi.mock('./slideItemRenderHelpers', () => ({
    genAttachBackgroundComponent: genAttachBackgroundComponentMock,
    genChooseColorNoteOption: genChooseColorNoteOptionMock,
    getSlideItemShadowingStyle: getSlideItemShadowingStyleMock,
    toClassNameHighlight: toClassNameHighlightMock,
}));

vi.mock('./appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'data-vary-app-document-item',
}));

vi.mock('../../others/ShadowingFillParentWidthComp', () => ({
    default: ({ children, width }: any) => (
        <div data-testid="shadowing-fill-parent">{width}{children}</div>
    ),
    useShadowingParentWidth: () => null,
}));

vi.mock('./VaryAppDocumentScaleContainerComp', () => ({
    default: ({ children, width }: any) => (
        <div data-testid="scale-container">{width}{children}</div>
    ),
}));

vi.mock('../../others/initHelpers', () => ({
    useThemeSource: useThemeSourceMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../app-document-list/Slide', () => ({
    default: class SlideMock {
        static checkIsThisType(value: unknown) {
            return slideCheckIsThisTypeMock(value);
        }
    },
}));

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('VarySlideRenderComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageAppDocumentEditor = false;
        appDocumentGetInstanceMock.mockReturnValue({
            getSlideIndex: getSlideIndexMock,
            moveSlideToIndex: moveSlideToIndexMock,
        });
        getColorNoteFilePathSettingMock.mockReturnValue('#abcdef');
        genAttachBackgroundComponentMock.mockReturnValue(
            <div data-testid="attached-background" />,
        );
        genChooseColorNoteOptionMock.mockReturnValue([
            { menuElement: 'Choose Color' },
        ]);
        getSlideItemShadowingStyleMock.mockReturnValue(
            <style data-testid="shadow-style">.shadow {}</style>,
        );
        toClassNameHighlightMock.mockReturnValue({
            selectedList: [['1'], ['2']],
            activeCN: 'active',
            presenterCN: 'presenter',
            holdingCN: 'holding',
        });
        slideCheckIsThisTypeMock.mockImplementation(
            (value: any) => value?.isSlide === true,
        );
        useAttachedBackgroundDataMock.mockReturnValue({ type: 'attached' });
        useThemeSourceMock.mockReturnValue({ theme: 'dark' });
        genRemovingAttachedBackgroundMenuMock.mockReturnValue([
            { menuElement: 'Remove Background' },
        ]);
        extractDropDataMock.mockReturnValue(null);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
            await flushAsyncEvents();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('renders slide header and body details and forwards interaction events', async () => {
        const { default: VarySlideRenderComp } = await import(
            './VarySlideRenderComp'
        );
        const onClick = vi.fn();
        const onContextMenu = vi.fn();
        const onCopy = vi.fn();
        const varySlide = {
            id: 5,
            filePath: '/docs/main.ows',
            width: 400,
            height: 200,
            name: 'Verse 1',
            isDisabled: false,
            isSlide: true,
            isChanged: true,
        } as any;

        await act(async () => {
            root.render(
                <VarySlideRenderComp
                    varySlide={varySlide}
                    width={320}
                    index={0}
                    onClick={onClick}
                    onContextMenu={onContextMenu}
                    onCopy={onCopy}
                    selectedItemEditing={null}
                    holdingItems={[]}
                >
                    <div data-testid="slide-children">content</div>
                </VarySlideRenderComp>,
            );
            await flushAsyncEvents();
        });

        const item = container.querySelector(
            '.data-vary-app-document-item',
        ) as HTMLDivElement | null;

        expect(useScreenVaryAppDocumentManagerEventsMock).toHaveBeenCalledWith([
            'update',
        ]);
        expect(item?.className).toContain('active');
        expect(item?.className).toContain('presenter');
        expect(item?.className).toContain('holding');
        expect(item?.getAttribute('data-vary-app-document-item-id')).toBe('5');
        expect(item?.getAttribute('data-scroll-container-selector')).toBe(
            '.slide-items-container',
        );
        expect(item?.style.width).toBe('320px');
        expect(container.textContent).toContain('Verse 1');
        expect(container.textContent).toContain('400x200');
        expect(container.textContent).toContain('*');
        expect(container.querySelectorAll('[data-testid="screen-icon"]')).toHaveLength(
            2,
        );
        expect(container.querySelector('[data-testid="attach-icon"]')?.textContent).toContain(
            '/docs/main.ows:5',
        );
        expect(container.querySelector('[data-testid="attached-background"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="slide-children"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="shadow-style"]')).not.toBeNull();
        expect(container.querySelector('.card-header')?.getAttribute('style')).toContain(
            'border-color: rgb(171, 205, 239);',
        );

        await act(async () => {
            item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            item?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            item?.dispatchEvent(new Event('dragstart', { bubbles: true }));
            item?.dispatchEvent(
                new Event('dragover', { bubbles: true, cancelable: true }),
            );
            item?.dispatchEvent(
                new Event('dragleave', { bubbles: true, cancelable: true }),
            );
            item?.dispatchEvent(new Event('dragend', { bubbles: true }));
            item?.dispatchEvent(new Event('copy', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(onClick).toHaveBeenCalledWith(expect.any(Object), 0, varySlide);
        expect(onContextMenu).toHaveBeenCalledWith(expect.any(Object), [
            { menuElement: 'Remove Background' },
            { menuElement: 'Choose Color' },
        ]);
        expect(handleDragStartMock).toHaveBeenCalledWith(
            expect.anything(),
            varySlide,
        );
        expect(changeDragEventStyleMock).toHaveBeenCalledWith(
            expect.anything(),
            'opacity',
            '0.5',
        );
        expect(changeDragEventStyleMock).toHaveBeenCalledWith(
            expect.anything(),
            'opacity',
            '1',
        );
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    test('moves dropped slides within the same file and delegates background drops', async () => {
        const { default: VarySlideRenderComp } = await import(
            './VarySlideRenderComp'
        );
        const varySlide = {
            id: 9,
            filePath: '/docs/main.ows',
            width: 400,
            height: 200,
            name: 'Target',
            isDisabled: false,
            isSlide: true,
        } as any;
        const movedSlide = {
            filePath: '/docs/main.ows',
            id: 3,
        };

        getSlideIndexMock.mockResolvedValue(7);

        await act(async () => {
            root.render(
                <VarySlideRenderComp
                    varySlide={varySlide}
                    width={320}
                    index={1}
                    onContextMenu={vi.fn()}
                >
                    <div />
                </VarySlideRenderComp>,
            );
            await flushAsyncEvents();
        });

        const item = container.querySelector(
            '.data-vary-app-document-item',
        ) as HTMLDivElement | null;

        extractDropDataMock.mockReturnValueOnce({
            type: 'slide',
            item: movedSlide,
        });
        await act(async () => {
            item?.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
            await flushAsyncEvents();
        });

        expect(appDocumentGetInstanceMock).toHaveBeenCalledWith('/docs/main.ows');
        expect(getSlideIndexMock).toHaveBeenCalledWith(varySlide);
        expect(moveSlideToIndexMock).toHaveBeenCalledWith(movedSlide, 7);

        extractDropDataMock.mockReturnValueOnce({
            type: 'slide',
            item: { filePath: '/docs/other.ows', id: 4 },
        });
        await act(async () => {
            item?.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
            await flushAsyncEvents();
        });

        expect(moveSlideToIndexMock).toHaveBeenCalledTimes(1);

        extractDropDataMock.mockReturnValueOnce({
            type: 'background-image',
            item: { src: '/slides/bg.png' },
        });
        await act(async () => {
            item?.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
            await flushAsyncEvents();
        });

        expect(handleAttachBackgroundDropMock).toHaveBeenCalledWith(
            expect.anything(),
            varySlide,
        );
    });

    test('renders disabled slide state and omits presenter info when no screen selection exists', async () => {
        const { default: VarySlideRenderComp } = await import(
            './VarySlideRenderComp'
        );
        const onContextMenu = vi.fn();
        const varySlide = {
            id: 10,
            filePath: '/docs/main.ows',
            width: 400,
            height: 200,
            name: 'Disabled',
            isDisabled: true,
            isSlide: false,
            isChanged: false,
        } as any;

        toClassNameHighlightMock.mockReturnValue({
            selectedList: [],
            activeCN: '',
            presenterCN: '',
            holdingCN: '',
        });
        useAttachedBackgroundDataMock.mockReturnValue(null);
        appProviderMock.isPagePresenter = true;

        await act(async () => {
            root.render(
                <VarySlideRenderComp
                    varySlide={varySlide}
                    width={280}
                    index={2}
                    onContextMenu={onContextMenu}
                >
                    <div />
                </VarySlideRenderComp>,
            );
            await flushAsyncEvents();
        });

        const item = container.querySelector(
            '.data-vary-app-document-item',
        ) as HTMLDivElement | null;

        expect(item?.getAttribute('title')).toBe('This slide is disabled');
        expect(item?.style.opacity).toBe('0.5');
        expect(item?.style.pointerEvents).toBe('none');
        expect(container.querySelector('[data-testid="screen-icon"]')).toBeNull();

        await act(async () => {
            item?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await flushAsyncEvents();
        });

        expect(onContextMenu).toHaveBeenCalledWith(expect.any(Object), [
            { menuElement: 'Choose Color' },
        ]);
    });

    test('omits screen badges entirely outside presenter mode', async () => {
        const { default: VarySlideRenderComp } = await import(
            './VarySlideRenderComp'
        );
        const varySlide = {
            id: 11,
            filePath: '/docs/main.ows',
            width: 400,
            height: 200,
            name: 'No presenter',
            isDisabled: false,
            isSlide: false,
        } as any;

        appProviderMock.isPagePresenter = false;
        toClassNameHighlightMock.mockReturnValue({
            selectedList: [['1']],
            activeCN: '',
            presenterCN: '',
            holdingCN: '',
        });

        await act(async () => {
            root.render(
                <VarySlideRenderComp
                    varySlide={varySlide}
                    width={280}
                    index={3}
                    onContextMenu={vi.fn()}
                >
                    <div />
                </VarySlideRenderComp>,
            );
            await flushAsyncEvents();
        });

        expect(container.querySelector('[data-testid="screen-icon"]')).toBeNull();
    });
});
