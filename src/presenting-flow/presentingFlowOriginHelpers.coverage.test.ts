// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { sources: new Map<string, any>() },
    mocks: {
        notify: vi.fn(),
        bringTop: vi.fn(),
        openAudio: vi.fn(),
        handleError: vi.fn(),
        reveal: vi.fn(),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (path: string) =>
            state.sources.get(path) ?? {
                src: `src:${path}`,
                name: `name:${path}`,
            },
    },
}));
vi.mock('../helper/domHelpers', () => ({
    escapeSelectorValue: (value: string) => `escaped-${value}`,
    notifyElementHighlight: mocks.notify,
}));
vi.mock('../helper/helpers', () => ({ bringDomToTopView: mocks.bringTop }));
vi.mock('../background/backgroundAudioTabHelpers', () => ({
    openBackgroundAudioTab: mocks.openAudio,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../virtual-list/virtualRevealHelpers', () => ({
    revealVirtualElement: mocks.reveal,
}));
vi.mock('./PresentingFlowItem', async () => {
    const { DragTypeEnum } = await import('../helper/DragInf');
    return {
        backgroundDragTypeList: [
            DragTypeEnum.BACKGROUND_IMAGE,
            DragTypeEnum.BACKGROUND_VIDEO,
            DragTypeEnum.BACKGROUND_COLOR,
            DragTypeEnum.BACKGROUND_CAMERA,
            DragTypeEnum.BACKGROUND_WEB,
        ],
    };
});

import { DragTypeEnum } from '../helper/DragInf';
import {
    notifyPresentingFlowCcOrigin,
    notifyPresentingFlowItemOrigin,
    notifyVarySlideOrigin,
} from './presentingFlowOriginHelpers';

function item(overrides: Record<string, unknown> = {}) {
    return {
        type: 'none',
        data: null,
        itemFilePath: '/item',
        id: 5,
        isAudio: false,
        isAppDocument: false,
        isSlide: false,
        isBibleItem: false,
        isForeground: false,
        uuid: 'uuid',
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.sources.clear();
    document.body.innerHTML = '';
    mocks.reveal.mockResolvedValue(null);
});

describe('presenting-flow origin reveal helpers', () => {
    test('highlights a slide card with the shared scroll behavior', () => {
        notifyVarySlideOrigin({ id: 8 } as any);
        expect(mocks.notify).toHaveBeenCalledWith(expect.any(Function), {
            moveToView: mocks.bringTop,
        });
        const getter = mocks.notify.mock.calls[0][0];
        const slide = document.createElement('div');
        slide.dataset.varyAppDocumentItemId = '8';
        document.body.append(slide);
        expect(getter()).toBe(slide);
    });

    test('reveals file, document, slide, bible, foreground, and audio origins', () => {
        state.sources.set('/image', { src: '/resolved-image' });
        state.sources.set('/doc', { src: '/resolved-doc' });
        state.sources.set('/bible', { name: 'KJV' });
        expect(
            notifyPresentingFlowItemOrigin(
                item({ type: DragTypeEnum.BACKGROUND_IMAGE, data: '/image' }),
            ),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(
                item({
                    type: DragTypeEnum.BACKGROUND_WEB,
                    data: { src: '/web' },
                }),
            ),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ isAppDocument: true, itemFilePath: '/doc' }),
            ),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(item({ isSlide: true, id: 9 })),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(
                item({
                    isBibleItem: true,
                    data: { filePath: '/bible', id: 3 },
                }),
            ),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ isForeground: true, data: { target: 'message' } }),
            ),
        ).toBe(true);
        expect(
            notifyPresentingFlowItemOrigin(
                item({
                    isAudio: true,
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    data: '/image',
                }),
            ),
        ).toBe(true);
        expect(mocks.openAudio).toHaveBeenCalled();
        expect(mocks.notify).toHaveBeenCalledTimes(7);
    });

    test('refuses origins without a meaningful selector', () => {
        expect(notifyPresentingFlowItemOrigin(item())).toBe(false);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ type: DragTypeEnum.BACKGROUND_COLOR }),
            ),
        ).toBe(false);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ type: DragTypeEnum.BACKGROUND_IMAGE, data: {} }),
            ),
        ).toBe(false);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ isBibleItem: true, data: { filePath: 4, id: '3' } }),
            ),
        ).toBe(false);
        expect(
            notifyPresentingFlowItemOrigin(
                item({ isForeground: true, data: { target: 4 } }),
            ),
        ).toBe(false);
    });

    test('reveals a CC source on both open surfaces and virtualizes missing rows', async () => {
        notifyPresentingFlowCcOrigin(item({ uuid: null }));
        expect(mocks.notify).not.toHaveBeenCalled();

        const tree = document.createElement('section');
        tree.className = 'presenting-flow-list';
        const found = document.createElement('div');
        found.setAttribute('data-presenting-flow-item-uuid', 'escaped-uuid');
        tree.append(found);
        const preview = document.createElement('section');
        preview.className = 'app-presenting-flow-preview';
        document.body.append(tree, preview);
        const revealed = document.createElement('div');
        mocks.reveal.mockResolvedValueOnce(revealed);

        notifyPresentingFlowCcOrigin(item());
        await vi.waitFor(() =>
            expect(mocks.reveal).toHaveBeenCalledWith(
                'uuid',
                expect.any(Function),
            ),
        );
        await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(2));
        expect(mocks.notify.mock.calls[0][0]()).toBe(found);
        expect(mocks.notify.mock.calls[1][0]()).toBe(revealed);
    });

    test('reports virtual reveal errors and ignores closed surfaces', async () => {
        const tree = document.createElement('section');
        tree.className = 'presenting-flow-list';
        document.body.append(tree);
        mocks.reveal.mockRejectedValueOnce(new Error('failed'));
        notifyPresentingFlowCcOrigin(item());
        await vi.waitFor(() => expect(mocks.handleError).toHaveBeenCalled());
    });
});
