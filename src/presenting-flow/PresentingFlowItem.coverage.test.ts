// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        appError: vi.fn(),
        bibleTitle: vi.fn(),
        deserialize: vi.fn(),
        foregroundIcon: vi.fn((target) => `fg-${target}`),
        foregroundLabel: vi.fn((data) => `Foreground ${data?.target ?? data}`),
        getBibleFontFamily: vi.fn(async () => 'Khmer Font'),
        getDocument: vi.fn(),
        getLyricStage: vi.fn(),
        handleError: vi.fn(),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: class MockFileSource {
        static getInstance(filePath: string) {
            return { name: filePath.split('/').at(-1)?.split('.')[0] ?? '' };
        }
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        appType: 'desktop',
        envUtils: { isFEUseEffectWarning: false },
        fileUtils: {},
        isDesktop: true,
        isPageAppDocumentEditor: false,
        isPagePresenter: true,
        isPageReader: false,
        isPageScreen: false,
        pathUtils: { sep: '/' },
        systemUtils: { isDev: false, isWindows: true },
    },
}));
vi.mock('../helper/dragHelpers', () => ({
    deserializeDragData: mocks.deserialize,
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: (value: unknown) => JSON.parse(JSON.stringify(value)),
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/loggerHelpers', () => ({ appError: mocks.appError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({
    toForegroundDragIconName: mocks.foregroundIcon,
    toForegroundDragLabel: mocks.foregroundLabel,
}));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitle: mocks.bibleTitle },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: mocks.getBibleFontFamily,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    varyAppDocumentFromFilePath: mocks.getDocument,
}));
vi.mock('../lyric-list/lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: mocks.getLyricStage,
}));
vi.mock('./presentingFlowHelpers', () => ({
    toDocumentIcon: (filePath: string) => [`doc-${filePath}`, 'blue'],
    toDragTypeIconName: (type: string) => `drag-${type}`,
}));

const actions: Record<string, any> = {
    'clear-all': {
        id: 'clear-all',
        label: 'Clear All',
        badge: 'CA',
        iconName: 'eraser',
        color: 'gray',
        ccItemCount: Infinity,
        target: 'screen',
    },
    'slide-media-control': {
        id: 'slide-media-control',
        label: 'Slide: Media Control',
        badge: 'MC',
        iconName: 'play',
        color: 'green',
        ccItemCount: Infinity,
        target: 'screen',
    },
    'next-timeout': {
        id: 'next-timeout',
        label: 'Next: Timeout',
        badge: 'TO',
        iconName: 'clock',
        color: 'orange',
        ccItemCount: 0,
        target: 'run',
        number: { label: 'Seconds', defaultValue: 10 },
        canBeTimeArmed: true,
        canBeKeyArmed: false,
        canBeCcItem: true,
        ccItemsAreTargets: false,
    },
    'next-interval': {
        id: 'next-interval',
        label: 'Next: Interval',
        badge: 'IN',
        iconName: 'clock',
        color: 'orange',
        ccItemCount: 0,
        target: 'run',
        number: { label: 'Seconds', defaultValue: 10 },
        canBeTimeArmed: false,
        canBeKeyArmed: false,
        canBeCcItem: false,
        ccItemsAreTargets: false,
    },
    'jump-to': {
        id: 'jump-to',
        label: 'Jump to',
        badge: 'JP',
        iconName: 'arrow',
        color: 'purple',
        ccItemCount: 1,
        target: 'run',
        number: null,
        canBeTimeArmed: false,
        canBeKeyArmed: false,
        canBeCcItem: false,
        ccItemsAreTargets: true,
    },
    'keyboard-event': {
        id: 'keyboard-event',
        label: 'Keyboard Event',
        badge: 'KEY',
        iconName: 'keyboard',
        color: 'purple',
        ccItemCount: Infinity,
        target: 'run',
        number: null,
        canBeTimeArmed: false,
        canBeKeyArmed: true,
        canBeCcItem: false,
        ccItemsAreTargets: false,
    },
};

vi.mock('./presentingFlowActionHelpers', () => ({
    PRESENTING_FLOW_ACTION_TYPE: 'action',
    findPresentingFlowAction: (id: string) => actions[id] ?? null,
}));

import { DragTypeEnum } from '../helper/DragInf';
import PresentingFlowItem, {
    ERROR_TYPE,
    acceptedDragTypeList,
    applyPresentingFlowActionArming,
    backgroundDragTypeList,
    slideDragTypeList,
} from './PresentingFlowItem';

const uuid = (suffix: string) => `uuid-${suffix}`;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.deserialize.mockImplementation((dragData) => ({
        type: dragData.type,
        item: { src: dragData.data?.src ?? dragData.data },
    }));
    mocks.bibleTitle.mockResolvedValue('John 3:16');
    mocks.getDocument.mockReturnValue({
        getItemById: vi.fn(async (id) => ({ id, filePath: '/slides/doc.owa' })),
    });
    mocks.getLyricStage.mockReturnValue([
        null,
        { getSlideById: vi.fn(async (id) => ({ id, stage: 2 })) },
    ]);
});

describe('PresentingFlowItem data model', () => {
    test('reads content, pins, disabled slides, icons, labels, and reachability', () => {
        const slide = new PresentingFlowItem('/flow.owapf', {
            type: DragTypeEnum.SLIDE,
            uuid: uuid('slide'),
            filePath: '/slides/doc.owa',
            id: 4,
            stage: 2,
            title: 'Song #4 Chorus',
            colorNote: 'red',
            screenIds: [1, 'bad' as any, 2],
            slideScreenIds: { 4: [3], 5: 'bad' as any },
            disabledSlideIds: [5],
            extraStyle: { color: 'red' },
        });

        expect(slide.uuid).toBe(uuid('slide'));
        expect(slide.extraStyle).toEqual({ color: 'red' });
        expect(slide.itemFilePath).toBe('/slides/doc.owa');
        expect(slide.id).toBe(4);
        expect(slide.stage).toBe(2);
        expect(slide.colorNote).toBe('red');
        expect(slide.screenIds).toEqual([1, 2]);
        expect(slide.getOwnSlideScreenIds(4)).toEqual([3]);
        expect(slide.getOwnSlideScreenIds(5)).toEqual([]);
        expect(slide.getSlideScreenIds(4)).toEqual([3]);
        expect(slide.getSlideScreenIds(6)).toEqual([1, 2]);
        expect(slide.checkIsOwnSlideDisabled(5)).toBe(true);
        expect(slide.checkIsSlideDisabled(4)).toBe(false);
        expect(
            slide.checkIsVarySlideDisabled({ id: 4, isDisabled: true }),
        ).toBe(true);
        expect(slide.isSlide).toBe(true);
        expect(slide.isShowableOnScreen).toBe(true);
        expect(slide.isScreenReachable).toBe(true);
        expect(slide.isRunReachable).toBe(true);
        expect(slide.isScreenPinnable).toBe(true);
        expect(slide.iconName).toBe(`drag-${DragTypeEnum.SLIDE}`);
        expect(slide.iconColor).toBeUndefined();
        expect(slide.title).toBe('Song #4 Chorus');
        expect(slide.idLabel).toBe('#4');
        expect(slide.dragSerialize()).toBeNull();
        expect(slide.clone().toJson()).toEqual(slide.toJson());

        const defaults = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.BACKGROUND_COLOR,
            data: '#fff',
        });
        expect(defaults.uuid).toBeNull();
        expect(defaults.extraStyle).toEqual({});
        expect(defaults.itemFilePath).toBe('');
        expect(defaults.id).toBe(-1);
        expect(defaults.stage).toBe(0);
        expect(defaults.colorNote).toBeNull();
        expect(defaults.screenIds).toEqual([]);
        expect(defaults.isBackground).toBe(true);
        expect(defaults.iconColor).toBe('#fff');
        expect(defaults.dragSerialize()).toEqual({
            type: DragTypeEnum.BACKGROUND_COLOR,
            data: '#fff',
        });

        const document = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.APP_DOCUMENT,
            filePath: '/doc.owa',
            isDisabled: true,
        });
        expect(document.isAppDocument).toBe(true);
        expect(document.checkIsSlideDisabled(1)).toBe(true);
        expect(document.isShowableOnScreen).toBe(false);
        expect(document.isScreenPinnable).toBe(true);
        expect(document.iconName).toBe('doc-/doc.owa');
        expect(document.iconColor).toBe('blue');

        const audio = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.BACKGROUND_AUDIO,
        });
        expect(audio.isAudio).toBe(true);
        expect(audio.isRunReachable).toBe(false);
    });

    test('models screen, timed, keyed, target, media, foreground, and error rows', async () => {
        const screen = PresentingFlowItem.fromJson(
            '/flow',
            PresentingFlowItem.fromActionId('clear-all'),
        );
        expect(screen.isAction).toBe(true);
        expect(screen.screenAction).toBe(actions['clear-all']);
        expect(screen.runAction).toBeNull();
        expect(screen.maxCcItemCount).toBe(Infinity);
        expect(screen.iconName).toBe('eraser');
        expect(screen.iconColor).toBe('gray');
        expect(screen.title).toBe('Clear All');
        expect(screen.idLabel).toBe('CA');
        expect(screen.isScreenReachable).toBe(true);
        await expect(screen.toDroppedData()).resolves.toBeNull();

        const timed = new PresentingFlowItem('/flow', {
            type: 'action',
            data: 'next-timeout',
            actionNumber: 12,
        });
        expect(timed.isRunAction).toBe(true);
        expect(timed.actionNumber).toBe(12);
        expect(timed.actionTime).toBeNull();
        expect(timed.actionArming).toEqual({ actionNumber: 12 });
        expect(timed.title).toBe('Next: Timeout (12)');
        expect(timed.isRunReachable).toBe(true);
        expect(timed.isScreenReachable).toBe(false);

        const atTime = new PresentingFlowItem('/flow', {
            type: 'action',
            data: 'next-timeout',
            actionNumber: 12,
            actionTime: '19:05',
        });
        expect(atTime.actionTime).toBe('19:05');
        expect(atTime.actionArming).toEqual({ actionTime: '19:05' });
        expect(atTime.title).toContain('Next: Timeout (');

        const keyed = new PresentingFlowItem('/flow', {
            type: 'action',
            data: 'keyboard-event',
            actionKey: 'Ctrl+Shift+A',
        });
        expect(keyed.actionKey).toBe('Ctrl+Shift+A');
        expect(keyed.actionArming).toEqual({ actionKey: 'Ctrl+Shift+A' });
        expect(keyed.hostsCcFollowers).toBe(true);
        expect(keyed.isScreenPinnable).toBe(true);
        expect(keyed.title).toBe('Keyboard Event (Ctrl+Shift+A)');

        const jump = new PresentingFlowItem('/flow', {
            type: 'action',
            data: 'jump-to',
        });
        expect(jump.title).toBe('Jump to');
        expect(jump.maxCcItemCount).toBe(1);
        expect(PresentingFlowItem.checkIsCcTargetHost(jump.toJson())).toBe(
            true,
        );

        const media = new PresentingFlowItem('/flow', {
            type: 'action',
            data: 'slide-media-control',
            mediaControl: { mode: 'play', startTime: 5 },
        } as any);
        expect(media.mediaControl).toMatchObject({ mode: 'play' });
        expect(media.title).toContain('Slide: Media Control');

        const foreground = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.FOREGROUND,
            data: { target: 'message' },
            title: 'old label',
        });
        expect(foreground.isForeground).toBe(true);
        expect(foreground.iconName).toBe('fg-message');
        expect(foreground.title).toBe('Foreground message');

        const error = PresentingFlowItem.fromJsonError('/flow', {
            uuid: uuid('broken'),
            bad: true,
        });
        expect(error.isError).toBe(true);
        expect(error.title).toBe('Invalid item');
        expect(error.iconName).toBe('exclamation-triangle');
        expect(error.toJson()).toEqual({ uuid: uuid('broken'), bad: true });
        expect(error.isScreenPinnable).toBe(false);
        expect(PresentingFlowItem.getMaxCcItemCount({ type: ERROR_TYPE })).toBe(
            0,
        );
    });

    test('binds and resolves CC references, pins, media settings, and arming', () => {
        const timeout = new PresentingFlowItem('/flow', {
            type: 'action',
            uuid: uuid('timeout'),
            data: 'next-timeout',
            actionNumber: 30,
        });
        const background = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.BACKGROUND_IMAGE,
            uuid: uuid('background'),
            data: { src: '/bg.jpg' },
        });
        const media = new PresentingFlowItem('/flow', {
            type: 'action',
            uuid: uuid('media'),
            data: 'slide-media-control',
        });
        const host = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.SLIDE,
            uuid: uuid('host'),
            filePath: '/doc.owa',
            id: 1,
            ccItems: [
                {
                    uuid: uuid('timeout'),
                    screenIds: [2],
                    actionArming: { actionNumber: 4 },
                },
                { uuid: uuid('host') },
                { uuid: 'missing' },
            ],
            slideCcItems: {
                1: [
                    {
                        uuid: uuid('media'),
                        mediaControl: { mode: 'pause' },
                    },
                ],
                2: [{ uuid: uuid('background') }],
            },
        });
        expect(PresentingFlowItem.bindCcSources([host])).toEqual([host]);
        PresentingFlowItem.bindCcSources([host, timeout, background, media]);

        expect(host.hasCcItems).toBe(true);
        expect(host.hasSlideCcItems).toBe(true);
        expect(host.checkHasSlideCcItems(1)).toBe(true);
        expect(host.checkHasSlideCcItems(9)).toBe(false);
        expect(host.ccItems).toHaveLength(1);
        expect(host.ccItems[0].screenIds).toEqual([2]);
        expect(host.ccItems[0].actionNumber).toBe(4);
        expect(host.ccItems[0].canBeCcArmed).toBe(true);
        expect(host.ccItems[0].hasOwnActionArming).toBe(true);
        expect(host.getSlideCcItems(1)[0].mediaControl).toMatchObject({
            mode: 'pause',
        });
        expect(host.getSlideCcItems(2)[0].isBackground).toBe(true);
        expect(host.getEffectiveSlideCcItems(1)).toHaveLength(2);
        expect(host.getEffectiveSlideCcItems(9)).toBe(host.ccItems);
        expect(host.canHostMoreCcItems).toBe(true);

        expect(
            PresentingFlowItem.readCcItemRefList(host.toJson()),
        ).toHaveLength(5);
        expect(
            PresentingFlowItem.resolveCcItemJson({
                ...host.toJson(),
                isDisabled: true,
                mediaControl: { mode: 'play' },
            } as any),
        ).not.toHaveProperty('isDisabled');
    });

    test('applies mutually exclusive arming and validates stored rows', () => {
        const json: any = {
            type: 'action',
            data: 'next-timeout',
            actionNumber: 3,
            actionTime: '10:00',
            actionKey: 'A',
        };
        applyPresentingFlowActionArming(json, { actionTime: '11:30' });
        expect(json).toMatchObject({ actionTime: '11:30' });
        expect(json).not.toHaveProperty('actionNumber');
        applyPresentingFlowActionArming(json, { actionNumber: 8 });
        expect(json).toMatchObject({ actionNumber: 8 });
        applyPresentingFlowActionArming(json, { actionKey: 'Ctrl+K' });
        expect(json).toMatchObject({ actionKey: 'Ctrl+K' });

        expect(() =>
            PresentingFlowItem.validate({ type: 'action', data: 'clear-all' }),
        ).not.toThrow();
        expect(() =>
            PresentingFlowItem.validate({
                type: 'action',
                data: 'next-timeout',
                actionNumber: 0,
            }),
        ).toThrow('Invalid presenting flow action number');
        expect(() =>
            PresentingFlowItem.validate({ type: 'action', data: 'future' }),
        ).toThrow('Invalid presenting flow action id');
        expect(() =>
            PresentingFlowItem.validate({ type: DragTypeEnum.SLIDE, id: 1 }),
        ).toThrow('Invalid presenting flow item data');
        expect(() =>
            PresentingFlowItem.validate({
                type: DragTypeEnum.BACKGROUND_COLOR,
                data: '#000',
            }),
        ).not.toThrow();
        expect(mocks.appError).toHaveBeenCalled();
    });

    test('builds stored rows from every supported dropped-data family', async () => {
        const slide = await PresentingFlowItem.fromDroppedData(
            {
                type: DragTypeEnum.LYRIC_SLIDE,
                item: {
                    filePath: '/songs/grace.owl',
                    id: 2,
                    stage: 3,
                    name: 'Chorus',
                },
            },
            { type: DragTypeEnum.LYRIC_SLIDE, data: {} },
        );
        expect(slide).toMatchObject({
            filePath: '/songs/grace.owl',
            id: 2,
            stage: 3,
            title: 'grace #2 Chorus',
        });

        const document = await PresentingFlowItem.fromDroppedData(
            {
                type: DragTypeEnum.APP_DOCUMENT,
                item: { filePath: '/docs/service.owa' },
            },
            { type: DragTypeEnum.APP_DOCUMENT, data: '/docs/service.owa' },
        );
        expect(document).toMatchObject({ title: 'service' });

        for (const [type, item, expectedTitle] of [
            [DragTypeEnum.BACKGROUND_COLOR, '#123456', '#123456'],
            [DragTypeEnum.BACKGROUND_CAMERA, {}, 'Camera'],
            [
                DragTypeEnum.BACKGROUND_IMAGE,
                { fullName: 'Clouds.jpg' },
                'Clouds.jpg',
            ],
            [
                DragTypeEnum.FOREGROUND,
                { target: 'message' },
                'Foreground message',
            ],
        ] as const) {
            const built = await PresentingFlowItem.fromDroppedData(
                { type, item },
                { type, data: { value: 1 } },
            );
            expect(built?.title).toBe(expectedTitle);
        }

        const bible = await PresentingFlowItem.fromDroppedData(
            { type: DragTypeEnum.BIBLE_ITEM, item: {} },
            {
                type: DragTypeEnum.BIBLE_ITEM,
                data: {
                    bibleKey: 'KJV',
                    target: {
                        bookKey: 'John',
                        chapter: 3,
                        verseStart: 16,
                        verseEnd: 16,
                    },
                },
            },
        );
        expect(bible).toMatchObject({
            title: '(KJV) John 3:16',
            extraStyle: { fontFamily: 'Khmer Font' },
        });
        expect(
            await PresentingFlowItem.fromDroppedData(
                { type: DragTypeEnum.UNKNOWN, item: {} },
                { type: DragTypeEnum.UNKNOWN, data: {} },
            ),
        ).toBeNull();
    });

    test('resolves slides, dropped payloads, and failures', async () => {
        const slide = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.SLIDE,
            filePath: '/doc.owa',
            id: 7,
        });
        await expect(slide.getVarySlide()).resolves.toMatchObject({ id: 7 });
        await expect(slide.toDroppedData()).resolves.toMatchObject({
            type: DragTypeEnum.SLIDE,
            item: { id: 7 },
        });

        const lyric = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.LYRIC_SLIDE,
            filePath: '/song.owl',
            id: 3,
            stage: 2,
        });
        await expect(lyric.getVarySlide()).resolves.toEqual({
            id: 3,
            stage: 2,
        });

        const background = new PresentingFlowItem('/flow', {
            type: DragTypeEnum.BACKGROUND_IMAGE,
            data: { src: '/bg.jpg' },
        });
        await expect(background.toDroppedData()).resolves.toMatchObject({
            type: DragTypeEnum.BACKGROUND_IMAGE,
        });

        mocks.getDocument.mockImplementationOnce(() => {
            throw new Error('unreadable');
        });
        await expect(slide.getVarySlide()).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalledWith(expect.any(Error));
        await expect(
            new PresentingFlowItem('/flow', {
                type: DragTypeEnum.BACKGROUND_COLOR,
            }).getVarySlide(),
        ).resolves.toBeNull();
    });

    test('documents the complete supported type lists and CC gates', () => {
        expect(slideDragTypeList).toContain(DragTypeEnum.PDF_SLIDE);
        expect(backgroundDragTypeList).toContain(DragTypeEnum.BACKGROUND_WEB);
        expect(acceptedDragTypeList).toContain(DragTypeEnum.BACKGROUND_AUDIO);
        expect(
            PresentingFlowItem.resolveCcItemJson({
                type: DragTypeEnum.APP_DOCUMENT,
            }),
        ).toBeNull();
        expect(
            PresentingFlowItem.resolveCcItemJson(
                { type: DragTypeEnum.APP_DOCUMENT },
                true,
            ),
        ).toMatchObject({ type: DragTypeEnum.APP_DOCUMENT });
        expect(
            PresentingFlowItem.resolveCcItemJson({
                type: 'action',
                data: 'next-interval',
            }),
        ).toBeNull();
        expect(
            PresentingFlowItem.checkCanBeCcArmed({
                type: 'action',
                data: 'next-timeout',
            }),
        ).toBe(true);
        expect(
            PresentingFlowItem.checkCanBeCcArmed({
                type: DragTypeEnum.SLIDE,
            }),
        ).toBe(false);
        expect(PresentingFlowItem.getMaxCcItemCount({ type: ERROR_TYPE })).toBe(
            0,
        );
    });
});
