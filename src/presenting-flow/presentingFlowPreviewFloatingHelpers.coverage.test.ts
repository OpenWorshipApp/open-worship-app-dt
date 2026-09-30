// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
    mocks: {
        handleError: vi.fn(),
        notifySelectionChanged: vi.fn(),
        findScrollingParent: vi.fn(),
        atBottom: vi.fn(),
        center: vi.fn(),
        nearest: vi.fn(),
        removeSetting: vi.fn(),
        setSetting: vi.fn(),
    },
}));

vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../helper/domHelpers', () => ({
    findVerticalScrollingParent: mocks.findScrollingParent,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToCenterView: mocks.center,
    bringDomToNearestView: mocks.nearest,
    checkIsVerticalAtBottom: mocks.atBottom,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
    removeSetting: mocks.removeSetting,
    setSetting: mocks.setSetting,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    notifyPresentingFlowRunSelectionChanged: mocks.notifySelectionChanged,
}));
vi.mock('./presentingFlowHelpers', () => ({
    toPresentingFlowSettingName: (...parts: string[]) => parts.join('::'),
}));

import {
    bringPresentingFlowRunElementToView,
    checkIsPresentingFlowPreviewItemExpanded,
    checkIsPresentingFlowPreviewItemSelected,
    checkIsPresentingFlowPreviewOpened,
    clearPresentingFlowPreviewSelectedItem,
    closePresentingFlowPreviewFilePath,
    collectPresentingFlowRunShortcutKeys,
    expandPresentingFlowPreviewItem,
    findNextPresentingFlowPreviewChildIndex,
    findNextPresentingFlowPreviewIndex,
    findPresentingFlowRunShortcutUuid,
    forgetPresentingFlowPreviewState,
    getPresentingFlowPreviewFilePaths,
    getPresentingFlowPreviewSelectedChildId,
    getPresentingFlowPreviewSelectedItemKey,
    openPresentingFlowPreviewFilePath,
    registerPresentingFlowPreviewChildStepping,
    requestPresentingFlowPreviewChildEntry,
    resolvePresentingFlowPreviewSelectedChildIndex,
    resolvePresentingFlowPreviewSelectedIndex,
    setAllPresentingFlowPreviewItemsCollapsed,
    setPresentingFlowPreviewItemCollapsed,
    setPresentingFlowPreviewSelectedChild,
    setPresentingFlowPreviewSelectedItem,
    stepPresentingFlowPreviewChild,
    toPresentingFlowPreviewItemKey,
    toPresentingFlowPreviewRectSettingName,
    toPresentingFlowPreviewRevealKey,
    togglePresentingFlowPreviewFilePath,
} from './presentingFlowPreviewFloatingHelpers';

function item(overrides: Record<string, unknown> = {}) {
    return {
        type: 'slide',
        itemFilePath: '/song',
        id: 4,
        stage: 'main',
        title: 'Song',
        isAction: false,
        isRunAction: false,
        actionKey: null,
        actionTime: null,
        actionNumber: null,
        isDisabled: false,
        uuid: 'uuid-1',
        ...overrides,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.settings.clear();
    mocks.findScrollingParent.mockReturnValue(null);
    mocks.atBottom.mockReturnValue(false);
    for (const path of [...getPresentingFlowPreviewFilePaths()]) {
        closePresentingFlowPreviewFilePath(path);
    }
});

describe('floating presenting-flow preview state', () => {
    test('opens, toggles, closes, and forgets independent previews', () => {
        openPresentingFlowPreviewFilePath('/one');
        openPresentingFlowPreviewFilePath('/one');
        openPresentingFlowPreviewFilePath('/two');
        expect(getPresentingFlowPreviewFilePaths()).toEqual(['/one', '/two']);
        expect(checkIsPresentingFlowPreviewOpened('/one')).toBe(true);
        togglePresentingFlowPreviewFilePath('/one');
        expect(checkIsPresentingFlowPreviewOpened('/one')).toBe(false);
        togglePresentingFlowPreviewFilePath('/one');
        expect(checkIsPresentingFlowPreviewOpened('/one')).toBe(true);
        closePresentingFlowPreviewFilePath('/missing');
        forgetPresentingFlowPreviewState('/two');
    });

    test('reads, validates, persists, expands, and clears collapsed keys', () => {
        state.settings.set(
            'presenting-flow-preview-collapsed::/valid',
            JSON.stringify(['a', 2, 'b']),
        );
        state.settings.set('presenting-flow-preview-collapsed::/bad', '{');
        expect(checkIsPresentingFlowPreviewItemExpanded('/valid', 'a')).toBe(
            false,
        );
        expect(checkIsPresentingFlowPreviewItemExpanded('/valid', 'z')).toBe(
            true,
        );
        expect(checkIsPresentingFlowPreviewItemExpanded('/bad', 'x')).toBe(
            true,
        );
        expect(mocks.handleError).toHaveBeenCalled();

        setPresentingFlowPreviewItemCollapsed('/fresh', 'x', true);
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'presenting-flow-preview-collapsed::/fresh',
            '["x"]',
        );
        expandPresentingFlowPreviewItem('/fresh', 'x');
        expect(mocks.removeSetting).toHaveBeenCalledWith(
            'presenting-flow-preview-collapsed::/fresh',
        );
        expandPresentingFlowPreviewItem('/fresh', 'x');
        setAllPresentingFlowPreviewItemsCollapsed('/all', ['a', 'b'], true);
        expect(checkIsPresentingFlowPreviewItemExpanded('/all', 'b')).toBe(
            false,
        );
        setAllPresentingFlowPreviewItemsCollapsed('/all', ['a', 'b'], false);
        expect(checkIsPresentingFlowPreviewItemExpanded('/all', 'b')).toBe(
            true,
        );
    });

    test('builds stable identity, reveal, and rectangle keys', () => {
        expect(toPresentingFlowPreviewItemKey(item())).toBe(
            'slide|/song|4|main|Song',
        );
        expect(
            toPresentingFlowPreviewItemKey(
                item({ isAction: true, data: 'clear-all' }),
            ),
        ).toBe('slide|/song|4|main|clear-all');
        expect(
            toPresentingFlowPreviewItemKey(
                item({
                    isAction: true,
                    isRunAction: true,
                    data: 'next-timeout',
                    actionNumber: 7,
                }),
            ),
        ).toBe('slide|/song|4|main|next-timeout-7');
        expect(
            toPresentingFlowPreviewItemKey(
                item({
                    isAction: true,
                    isRunAction: true,
                    data: 'next-timeout',
                    actionTime: '08:00',
                }),
            ),
        ).toContain('next-timeout-08:00');
        expect(toPresentingFlowPreviewRevealKey('/run', item(), 2)).toBe(
            'uuid-1',
        );
        expect(
            toPresentingFlowPreviewRevealKey('/run', item({ uuid: null }), 2),
        ).toBe('/run#2');
        expect(toPresentingFlowPreviewRectSettingName('/run')).toBe(
            'floating-widget-rect-presenting-flow-preview::/run',
        );
    });

    test('tracks, repairs, and clears the selected element and child', () => {
        setPresentingFlowPreviewSelectedItem('/cursor', 'first', 0);
        setPresentingFlowPreviewSelectedItem('/cursor', 'first', 0);
        expect(getPresentingFlowPreviewSelectedItemKey('/cursor')).toBe(
            'first',
        );
        expect(
            checkIsPresentingFlowPreviewItemSelected('/cursor', 'first', 0),
        ).toBe(true);
        expect(
            checkIsPresentingFlowPreviewItemSelected('/cursor', 'first', 1),
        ).toBe(false);
        setPresentingFlowPreviewSelectedChild('/cursor', 'wrong', 0, 3);
        setPresentingFlowPreviewSelectedChild('/cursor', 'first', 0, 3);
        setPresentingFlowPreviewSelectedChild('/cursor', 'first', 0, 3);
        expect(
            getPresentingFlowPreviewSelectedChildId('/cursor', 'first', 0),
        ).toBe(3);
        expect(
            getPresentingFlowPreviewSelectedChildId('/cursor', 'first', 1),
        ).toBeNull();
        expect(
            resolvePresentingFlowPreviewSelectedChildIndex(
                '/cursor',
                'first',
                0,
                [{ id: 2 }, { id: 3 }],
            ),
        ).toBe(1);

        setPresentingFlowPreviewSelectedItem(
            '/repair',
            toPresentingFlowPreviewItemKey(item()),
            2,
        );
        expect(
            resolvePresentingFlowPreviewSelectedIndex('/repair', [
                item({ title: 'Other' }),
                item(),
            ]),
        ).toBe(1);
        expect(
            resolvePresentingFlowPreviewSelectedIndex('/repair', [
                item({ title: 'Other' }),
                item(),
            ]),
        ).toBe(1);
        expect(resolvePresentingFlowPreviewSelectedIndex('/none', [])).toBe(-1);
        expect(resolvePresentingFlowPreviewSelectedIndex('/repair', [])).toBe(
            -1,
        );
        clearPresentingFlowPreviewSelectedItem('/cursor');
        clearPresentingFlowPreviewSelectedItem('/cursor');
        expect(getPresentingFlowPreviewSelectedItemKey('/cursor')).toBeNull();
        expect(mocks.notifySelectionChanged).toHaveBeenCalled();
    });

    test('finds enabled next entries, slides, and shortcut targets', () => {
        const items = [
            item({ isDisabled: true, actionKey: 'Ctrl+A', uuid: 'a' }),
            item({ actionKey: 'Ctrl+B', uuid: 'b' }),
            item({ actionKey: 'Ctrl+B', uuid: 'duplicate' }),
            item({ actionKey: null, uuid: 'c' }),
        ];
        expect(findNextPresentingFlowPreviewIndex(items, -1)).toBe(1);
        expect(findNextPresentingFlowPreviewIndex(items, 3)).toBe(-1);
        expect(collectPresentingFlowRunShortcutKeys(null)).toEqual([]);
        expect(collectPresentingFlowRunShortcutKeys(items)).toEqual(['Ctrl+B']);
        expect(findPresentingFlowRunShortcutUuid(items, 'Ctrl+B')).toBe('b');
        expect(findPresentingFlowRunShortcutUuid(items, 'Ctrl+Z')).toBeNull();
        expect(findPresentingFlowRunShortcutUuid([], 'Ctrl+B')).toBeNull();
        expect(
            findNextPresentingFlowPreviewChildIndex(
                [
                    { isDisabled: true },
                    { isDisabled: false },
                    { isDisabled: false },
                ],
                -1,
                (index) => index === 1,
            ),
        ).toBe(2);
        expect(
            findNextPresentingFlowPreviewChildIndex([{ isDisabled: true }], -1),
        ).toBe(-1);
    });

    test('registers child stepping, resolves pending entry, and cleans safely', () => {
        vi.useFakeTimers();
        const event = new MouseEvent('click');
        const oldStep = vi.fn(() => true);
        requestPresentingFlowPreviewChildEntry('/steps', 2, event);
        const cleanupOld = registerPresentingFlowPreviewChildStepping(
            '/steps',
            2,
            oldStep,
        );
        expect(stepPresentingFlowPreviewChild('/steps', 2, event, false)).toBe(
            true,
        );
        vi.runAllTimers();
        expect(oldStep).toHaveBeenCalledWith(event, true);

        const newStep = vi.fn(() => false);
        const cleanupNew = registerPresentingFlowPreviewChildStepping(
            '/steps',
            2,
            newStep,
        );
        cleanupOld();
        expect(stepPresentingFlowPreviewChild('/steps', 2, event, false)).toBe(
            false,
        );
        cleanupNew();
        expect(stepPresentingFlowPreviewChild('/steps', 2, event, false)).toBe(
            false,
        );
        vi.useRealTimers();
    });

    test('uses centered scrolling only when an HTML element is below view', () => {
        const element = document.createElement('div');
        const parent = document.createElement('section');
        mocks.findScrollingParent.mockReturnValue(parent);
        mocks.atBottom.mockReturnValue(true);
        bringPresentingFlowRunElementToView(element);
        expect(mocks.center).toHaveBeenCalledWith(element);
        expect(mocks.nearest).not.toHaveBeenCalled();

        mocks.atBottom.mockReturnValue(false);
        bringPresentingFlowRunElementToView(element);
        bringPresentingFlowRunElementToView({} as Element);
        expect(mocks.nearest).toHaveBeenCalledTimes(2);
    });
});
