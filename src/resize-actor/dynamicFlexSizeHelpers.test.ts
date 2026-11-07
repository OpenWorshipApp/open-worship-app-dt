import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { values: new Map<string, any>() },
    mocks: { disable: vi.fn() },
}));
vi.mock('./flexSizeHelpers', () => ({
    getFlexSizeSetting: (name: string) => state.values.get(name),
    keyToDataFlexSizeKey: (name: string, key: string) => `${name}-${key}`,
    setDisablingSetting: mocks.disable,
}));

import {
    checkCanClose,
    reopenAnotherHiddenWidget,
} from './dynamicFlexSizeHelpers';

const clear = { a: ['1 1 0%'], b: ['1 1 0%'] } as any;
const hiddenFirst = { a: ['1 1 0%', ['first', 0.4]], b: ['1 1 0%'] } as any;

describe('dynamic resize actors', () => {
    beforeEach(() => {
        state.values.clear();
        vi.clearAllMocks();
    });
    test('only exposes a close direction when the perpendicular pane is already hidden', () => {
        state.values.set('pane-dyn-h', clear);
        state.values.set('pane-dyn-v', hiddenFirst);
        expect(checkCanClose('pane-dyn-h', clear, clear)).toBe('left');
        state.values.set('pane-dyn-h', hiddenFirst);
        expect(checkCanClose('pane-dyn-h', clear, clear)).toBeNull();
        expect(checkCanClose('plain', clear, clear)).toBeNull();
    });
    test('says nothing for a plain actor, a strange suffix or a group not of two', () => {
        state.values.set('pane-dyn-v', hiddenFirst);
        expect(checkCanClose('pane-dyn-h', clear)).toBeNull();
        expect(checkCanClose('pane-dyn-x', clear, clear)).toBeNull();
        state.values.set('pane-dyn-h', {
            a: ['1'],
            b: ['1'],
            c: ['1'],
        });
        expect(checkCanClose('pane-dyn-h', clear, clear)).toBeNull();
    });
    test('a second pane hidden across closes the right side; any other side closes none', () => {
        state.values.set('pane-dyn-h', clear);
        state.values.set('pane-dyn-v', {
            a: ['1 1 0%'],
            b: ['1 1 0%', ['second', 0.4]],
        });
        expect(checkCanClose('pane-dyn-h', clear, clear)).toBe('right');
        state.values.set('pane-dyn-v', {
            a: ['1 1 0%'],
            b: ['1 1 0%', ['other', 0.5]],
        });
        expect(checkCanClose('pane-dyn-h', clear, clear)).toBeNull();
    });
    test('reopens nothing for a plain actor or while this orientation is open', () => {
        state.values.set('pane-dyn-h', clear);
        state.values.set('pane-dyn-v', hiddenFirst);
        reopenAnotherHiddenWidget('pane-dyn-h', clear);
        reopenAnotherHiddenWidget('pane-dyn-h', clear, clear);
        expect(mocks.disable).not.toHaveBeenCalled();
    });
    test('reopens the perpendicular hidden pane only after this orientation is hidden', () => {
        state.values.set('pane-dyn-h', hiddenFirst);
        state.values.set('pane-dyn-v', hiddenFirst);
        reopenAnotherHiddenWidget('pane-dyn-h', clear, clear);
        expect(mocks.disable).toHaveBeenCalledWith(
            'pane-dyn-v',
            hiddenFirst,
            'pane-dyn-v-a',
        );
        state.values.set('pane-dyn-v', clear);
        mocks.disable.mockClear();
        reopenAnotherHiddenWidget('pane-dyn-h', clear, clear);
        expect(mocks.disable).not.toHaveBeenCalled();
    });
});
