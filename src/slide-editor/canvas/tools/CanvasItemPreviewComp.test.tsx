// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    item: { id: 1, type: 'image' },
    props: {
        type: 'image',
        width: 800,
        height: 400,
        srcData: 'file:///photo.png',
    } as any,
    selected: [{ id: 1 }] as any[],
    cameras: [] as { deviceId: string; label: string }[],
    titleProps: null as any,
    resolve: vi.fn(),
    acquire: vi.fn(),
    releaseCamera: vi.fn(),
    cameraBadge: vi.fn(),
    play: vi.fn(),
    releaseMedia: vi.fn(),
    error: vi.fn(),
    toast: vi.fn(),
}));

vi.mock('../CanvasItem', () => ({
    default: {
        genShapeBoxStyle: (props: { width: number; height: number }) => ({
            width: `${props.width}px`,
            height: `${props.height}px`,
            backgroundColor: 'rgb(12, 34, 56)',
        }),
    },
    useCanvasItemContext: () => h.item,
    useCanvasItemPropsContext: () => h.props,
    useSelectedCanvasItemsAndSetterContext: () => ({ canvasItems: h.selected }),
}));
vi.mock('../../CanvasItemRendererComp', () => ({
    default: () =>
        h.item.type === 'video'
            ? createElement(
                  'div',
                  {},
                  createElement('video'),
                  createElement('iframe'),
              )
            : h.item.type === 'camera'
              ? createElement('video', { 'data-camera-item': '' })
              : createElement('span', {}, 'Rendered item'),
}));
vi.mock('./SlideEditorToolTitleComp', async () => {
    const react = await import('react');
    return {
        default: (props: {
            title: string;
            persistingKey: string;
            isInitiallyExpanded: boolean;
            children: ReactNode;
        }) => {
            h.titleProps = props;
            const [expanded, setExpanded] = react.useState(
                props.isInitiallyExpanded,
            );
            return createElement(
                'section',
                {},
                createElement(
                    'button',
                    { onClick: () => setExpanded((value) => !value) },
                    expanded ? 'Collapse' : 'Expand',
                ),
                expanded ? props.children : null,
            );
        },
    };
});
vi.mock('../../../_screen/managers/slideCameraSyncHelpers', () => ({
    checkIsCameraMediaElement: (media: Element) =>
        media.hasAttribute('data-camera-item'),
    setCameraBadgeVisibility: h.cameraBadge,
}));
vi.mock('../../../helper/cameraHelpers', () => ({
    acquireCameraStream: h.acquire,
    releaseCameraStream: h.releaseCamera,
    resolveCameraDeviceId: h.resolve,
    useCameraInfoList: () => h.cameras,
}));
vi.mock('../../../helper/constants', () => ({
    CAMERA_ITEM_ATTR: 'data-camera-item',
}));
vi.mock('../../../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../../../helper/mediaHelpers', () => ({
    playMediaElement: h.play,
    releaseMediaElement: h.releaseMedia,
}));
vi.mock('../../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import CanvasItemPreviewComp from './CanvasItemPreviewComp';

let root: Root;
let container: HTMLDivElement;
let originalClientWidth: PropertyDescriptor | undefined;
let originalPause: typeof HTMLMediaElement.prototype.pause;

async function renderPreview() {
    await act(async () => root.render(createElement(CanvasItemPreviewComp)));
}

async function expand() {
    await act(async () =>
        container.querySelector<HTMLButtonElement>('section > button')!.click(),
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.item = { id: 1, type: 'image' };
    h.props = {
        type: 'image',
        width: 800,
        height: 400,
        srcData: 'file:///photo.png',
    };
    h.selected = [{ id: 1 }];
    h.cameras = [];
    h.titleProps = null;
    h.resolve.mockResolvedValue('camera-1');
    h.acquire.mockResolvedValue({ id: 'stream' });
    originalClientWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'clientWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => 300,
    });
    originalPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = vi.fn();
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalClientWidth)
        Object.defineProperty(
            HTMLElement.prototype,
            'clientWidth',
            originalClientWidth,
        );
    else delete (HTMLElement.prototype as any).clientWidth;
    HTMLMediaElement.prototype.pause = originalPause;
    vi.unstubAllGlobals();
});

describe('canvas item preview', () => {
    it('keeps the preview collapsed until requested and fits a large item without upscaling', async () => {
        await renderPreview();
        expect(h.titleProps.title).toBe('Preview');
        expect(h.titleProps.persistingKey).toBe('canvas-item-preview');
        expect(container.querySelector('.canvas-item-preview')).toBeNull();
        await expand();
        expect(container.textContent).toContain('file:///photo.png');
        expect(container.textContent).toContain('800x400');
        expect(
            container.querySelector<HTMLElement>('.cip-fit > div')?.style
                .transform,
        ).toBe('scale(0.375)');
        expect(
            container.querySelector<HTMLElement>('.cip-fit > div')?.style.top,
        ).toBe('25px');
        expect(container.textContent).toContain('Rendered item');
    });

    it('omits a persisted expansion key for multi-selection and handles zero size', async () => {
        h.selected = [{ id: 1 }, { id: 2 }];
        h.props.width = 0;
        await renderPreview();
        expect(h.titleProps.persistingKey).toBe('');
        await expand();
        expect(container.textContent).toContain('0x400');
        expect(container.textContent).not.toContain('Rendered item');
    });

    it.each([
        ['video', { filePath: 'C:/media/clip.mp4' }, 'C:/media/clip.mp4'],
        ['audio', { filePath: 'C:/media/song.mp3' }, 'C:/media/song.mp3'],
        [
            'youtube',
            { url: 'https://youtu.be/example' },
            'https://youtu.be/example',
        ],
        ['website', { url: 'https://example.org' }, 'https://example.org'],
        ['bible', { bibleKeys: ['en', 'fr'] }, 'en, fr'],
        ['text', { text: 'Welcome' }, 'Welcome'],
        ['html', { html: '<b>Words</b>' }, '<b>Words</b>'],
    ])(
        'shows the %s source without loading it before expansion',
        async (type, extra, source) => {
            h.item = { id: 1, type };
            h.props = { type, width: 100, height: 100, ...extra };
            await renderPreview();
            expect(container.querySelector('.cip-source')).toBeNull();
            await expand();
            expect(
                container.querySelector<HTMLElement>(
                    '.cip-source .app-ellipsis',
                )?.title,
            ).toBe(source);
        },
    );

    it('shortens a data URI source and makes file media interactive only while expanded', async () => {
        h.props.srcData = `data:image/png;base64,${'A'.repeat(300)}`;
        await renderPreview();
        await expand();
        const source = container.querySelector<HTMLElement>(
            '.cip-source .app-ellipsis',
        )!.title;
        expect(source).toBe(`${h.props.srcData.slice(0, 30)}...`);
        expect(source.length).toBeLessThan(121);
        await act(async () => root.unmount());
        root = createRoot(container);
        h.item = { id: 2, type: 'video' };
        h.props = {
            type: 'video',
            width: 100,
            height: 100,
            filePath: 'C:/media/clip.mp4',
        };
        await renderPreview();
        await expand();
        const video = container.querySelector('video')!;
        expect(video.controls).toBe(true);
        expect(video.style.pointerEvents).toBe('auto');
        expect(video.dataset.ignoreMediaGuarding).toBe('true');
        expect(container.querySelector('iframe')?.style.pointerEvents).toBe(
            'auto',
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('section > button')!
                .click(),
        );
        expect(video.pause).toHaveBeenCalled();
        expect(h.releaseMedia).toHaveBeenCalledWith(video);
    });

    it('starts and stops an available camera explicitly', async () => {
        h.item = { id: 1, type: 'camera' };
        h.props = {
            type: 'camera',
            width: 100,
            height: 100,
            deviceId: 'camera-1',
            label: 'Front',
        };
        h.cameras = [{ deviceId: 'camera-1', label: 'Front' }];
        await renderPreview();
        expect(h.resolve).not.toHaveBeenCalled();
        await expand();
        const button = container.querySelector<HTMLButtonElement>(
            '.cip-camera-actions button',
        )!;
        expect(button.disabled).toBe(false);
        await act(async () => button.click());
        expect(h.resolve).toHaveBeenCalledWith('camera-1', 'Front');
        expect(h.acquire).toHaveBeenCalledWith('camera-1');
        const video = container.querySelector('video')!;
        expect(video.srcObject).toEqual({ id: 'stream' });
        await act(async () =>
            video.onloadedmetadata?.(new Event('loadedmetadata')),
        );
        expect(h.play).toHaveBeenCalledWith(video);
        expect(h.cameraBadge).toHaveBeenCalledWith(video, false);
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('.cip-camera-actions button')!
                .click(),
        );
        expect(h.releaseCamera).toHaveBeenCalledWith('camera-1');
        expect(video.srcObject).toBeNull();
        expect(h.cameraBadge).toHaveBeenCalledWith(video, true);
    });

    it('disables a missing camera and shows the missing-device state', async () => {
        h.item = { id: 1, type: 'camera' };
        h.props = {
            type: 'camera',
            width: 100,
            height: 100,
            deviceId: 'lost',
            label: 'Old Camera',
        };
        await renderPreview();
        await expand();
        expect(
            container.querySelector<HTMLButtonElement>(
                '.cip-camera-actions button',
            )!.disabled,
        ).toBe(true);
        expect(container.textContent).toContain('Camera not found');
        expect(h.acquire).not.toHaveBeenCalled();
    });
});
