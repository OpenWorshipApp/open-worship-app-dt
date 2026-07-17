// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { settingStore, getSettingMock, setSettingMock, handleErrorMock } =
    vi.hoisted(() => {
        const store = new Map<string, string>();
        return {
            settingStore: store,
            getSettingMock: vi.fn((key: string) =>
                store.has(key) ? store.get(key) : null,
            ),
            setSettingMock: vi.fn((key: string, value: string | null) => {
                store.set(key, value ?? '');
            }),
            handleErrorMock: vi.fn(),
        };
    });

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

import {
    calcShowingHiddenWidget,
    checkIsThereNotHiddenWidget,
    clearFlexSizeSetting,
    clearWidgetSizeSetting,
    dataFlexSizeKeyToKey,
    genFlexSizeSetting,
    getFlexSizeSetting,
    keyToDataFlexSizeKey,
    resizeSettingNames,
    setDisablingSetting,
    setFlexSizeSetting,
    settingPrefix,
    toSettingString,
    type FlexSizeType,
} from './flexSizeHelpers';

describe('resize-actor flexSizeHelpers', () => {
    beforeEach(() => {
        settingStore.clear();
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    test('toSettingString prefixes the flex size name', () => {
        expect(toSettingString('foo')).toBe(`${settingPrefix}-foo`);
    });

    test('key <-> dataFlexSizeKey round trip', () => {
        const dataKey = keyToDataFlexSizeKey('reader', 'left');
        expect(dataKey).toBe('reader-left');
        expect(dataFlexSizeKeyToKey('reader', dataKey)).toBe('left');
    });

    test('clearFlexSizeSetting empties a single setting', () => {
        setSettingMock('widget-size-foo', 'something');
        clearFlexSizeSetting('foo');
        expect(setSettingMock).toHaveBeenLastCalledWith('widget-size-foo', '');
    });

    test('clearWidgetSizeSetting empties every registered widget setting', () => {
        clearWidgetSizeSetting();
        for (const name of Object.values(resizeSettingNames)) {
            expect(setSettingMock).toHaveBeenCalledWith(
                `${settingPrefix}-${name}`,
                '',
            );
        }
    });

    test('setFlexSizeSetting stores JSON', () => {
        const flexSize: FlexSizeType = { a: ['1 1 20%'] };
        setFlexSizeSetting('foo', flexSize);
        expect(settingStore.get('widget-size-foo')).toBe(
            JSON.stringify(flexSize),
        );
    });

    test('getFlexSizeSetting throws when default has no keys', () => {
        expect(() => getFlexSizeSetting('foo', {})).toThrow(
            'defaultSize should have at least one key',
        );
    });

    test('getFlexSizeSetting seeds and returns the default when unset', () => {
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        const result = getFlexSizeSetting('foo', defaultSize);
        expect(result).toEqual(defaultSize);
        // default persisted for later reads
        expect(settingStore.get('widget-size-foo')).toBe(
            JSON.stringify(defaultSize),
        );
    });

    test('getFlexSizeSetting returns a valid stored value unchanged', () => {
        const stored: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(stored));
        const defaultSize: FlexSizeType = {
            first: ['2 1 10%'],
            second: ['2 1 10%'],
        };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(stored);
    });

    test('getFlexSizeSetting falls back when the stored key set mismatches', () => {
        settingStore.set(
            'widget-size-foo',
            JSON.stringify({ onlyOne: ['1 1 50%'] }),
        );
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(defaultSize);
    });

    test('getFlexSizeSetting falls back when a disabled tuple is malformed', () => {
        settingStore.set(
            'widget-size-foo',
            JSON.stringify({
                first: ['1 1 50%', ['not-a-target', 'not-a-number']],
                second: ['1 1 50%'],
            }),
        );
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(defaultSize);
    });

    test('getFlexSizeSetting keeps a valid disabled tuple', () => {
        const stored: FlexSizeType = {
            first: ['1 1 50%', ['first', 3]],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(stored));
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(stored);
    });

    test('getFlexSizeSetting doubles flex-grow until the total reaches 1', () => {
        const stored: FlexSizeType = {
            first: ['0.1 1 20%'],
            second: ['0.1 1 20%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(stored));
        const dataInput = [{ key: 'first' } as any, { key: 'second' } as any];
        const result = getFlexSizeSetting(
            'foo',
            { first: ['1 1 20%'], second: ['1 1 20%'] },
            dataInput,
        );
        // 0.1 -> 0.2 -> 0.4 -> 0.8 -> 1.6, total >= 1 after enough doublings
        const firstGrow = Number(result.first[0].split(' ')[0]);
        expect(firstGrow).toBeGreaterThanOrEqual(0.5);
    });

    test('getFlexSizeSetting doubles disabled entries too while scaling', () => {
        const stored: FlexSizeType = {
            a: ['0.1 1 20%'],
            b: ['0.1 1 20%', ['first', 2]],
        };
        settingStore.set('widget-size-foo', JSON.stringify(stored));
        const dataInput = [{ key: 'a' } as any, { key: 'b' } as any];
        const result = getFlexSizeSetting(
            'foo',
            { a: ['1 1 20%'], b: ['1 1 20%'] },
            dataInput,
        );
        // disabled entry retains its tuple after doubling
        expect(result.b[1]).toEqual(['first', 2]);
        expect(Number(result.b[0].split(' ')[0])).toBeGreaterThan(0.1);
    });

    test('getFlexSizeSetting catches errors thrown while sanitizing', () => {
        // valid JSON, correct key count, but values are not iterable tuples
        settingStore.set(
            'widget-size-foo',
            JSON.stringify({ first: 5, second: 5 }),
        );
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(defaultSize);
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('getFlexSizeSetting handles NaN flex-grow as zero', () => {
        const stored: FlexSizeType = {
            first: ['notNumber 1 20%'],
            second: ['notNumber 1 20%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(stored));
        const dataInput = [{ key: 'first' } as any, { key: 'second' } as any];
        const result = getFlexSizeSetting(
            'foo',
            { first: ['1 1 20%'], second: ['1 1 20%'] },
            dataInput,
        );
        // total is 0 => returned unchanged
        expect(result).toEqual(stored);
    });

    test('getFlexSizeSetting recovers from invalid JSON via handleError', () => {
        settingStore.set('widget-size-foo', '{not valid json');
        const defaultSize: FlexSizeType = { first: ['1 1 50%'] };
        expect(getFlexSizeSetting('foo', defaultSize)).toEqual(defaultSize);
    });

    test('setDisablingSetting assigns the disabled tuple to a key', () => {
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(defaultSize));
        const result = setDisablingSetting('foo', defaultSize, 'foo-first', [
            'first',
            5,
        ]);
        expect(result.first[1]).toEqual(['first', 5]);
        expect(
            JSON.parse(settingStore.get('widget-size-foo')!).first[1],
        ).toEqual(['first', 5]);
    });

    test('genFlexSizeSetting reads flex styles off matching DOM nodes', () => {
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(defaultSize));

        const a = document.createElement('div');
        a.dataset.fs = 'foo-first';
        a.style.flex = '3 1 10%';
        const b = document.createElement('div');
        b.dataset.fs = 'foo-second';
        b.style.flex = '7 1 10%';
        // an element without the dataset value path
        const c = document.createElement('div');
        c.setAttribute('data-fs', 'foo-unknown');
        c.style.flex = '9 1 10%';
        document.body.append(a, b, c);

        const result = genFlexSizeSetting('foo', defaultSize);
        expect(result.first[0]).toBe('3 1 10%');
        expect(result.second[0]).toBe('7 1 10%');
        // unknown key isn't in flexSize so it's ignored
        expect(result).not.toHaveProperty('unknown');
    });

    test('checkIsThereNotHiddenWidget detects visible widgets in a range', () => {
        const dataInput = [
            { key: 'a' } as any,
            { key: 'b' } as any,
            { key: 'c' } as any,
        ];
        const allHidden: FlexSizeType = {
            a: ['1 1 10%', ['first', 1]],
            b: ['1 1 10%', ['first', 1]],
            c: ['1 1 10%', ['first', 1]],
        };
        expect(checkIsThereNotHiddenWidget(dataInput, allHidden, 0)).toBe(
            false,
        );

        const someVisible: FlexSizeType = {
            a: ['1 1 10%', ['first', 1]],
            b: ['1 1 10%'],
            c: ['1 1 10%', ['first', 1]],
        };
        expect(checkIsThereNotHiddenWidget(dataInput, someVisible, 0)).toBe(
            true,
        );
        // explicit endIndex path
        expect(checkIsThereNotHiddenWidget(dataInput, someVisible, 0, 1)).toBe(
            false,
        );
    });

    test('calcShowingHiddenWidget adjusts sibling flex-grow and returns sizes', () => {
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(defaultSize));

        const current = document.createElement('div');
        current.dataset.fs = 'foo-first';
        current.style.flex = '1 1 50%';
        const next = document.createElement('div');
        next.dataset.fs = 'foo-second';
        next.style.flex = '10 1 50%';
        next.style.flexGrow = '10';
        document.body.append(current, next);

        const size = calcShowingHiddenWidget(
            { currentTarget: current },
            'first',
            'foo',
            defaultSize,
            ['first', 4],
        );
        // 10 - 4 = 6, and 6 >= 10/10 so it applies 6
        expect(next.style.flexGrow).toBe('6');
        expect(size).toHaveProperty('first');
    });

    test('calcShowingHiddenWidget keeps flex-grow when reduction is too large', () => {
        const defaultSize: FlexSizeType = {
            first: ['1 1 50%'],
            second: ['1 1 50%'],
        };
        settingStore.set('widget-size-foo', JSON.stringify(defaultSize));

        const current = document.createElement('div');
        current.dataset.fs = 'foo-second';
        current.style.flex = '1 1 50%';
        const prev = document.createElement('div');
        prev.dataset.fs = 'foo-first';
        prev.style.flex = '10 1 50%';
        prev.style.flexGrow = '10';
        document.body.append(prev, current);

        calcShowingHiddenWidget(
            { currentTarget: current },
            'second',
            'foo',
            defaultSize,
            ['second', 100],
        );
        // 10 - 100 = -90 which is < 10/10 so keep original 10
        expect(prev.style.flexGrow).toBe('10');
    });
});
