// @vitest-environment jsdom

import type { Dispatch, SetStateAction } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getItemMock,
    getItemForceMock,
    setItemMock,
    removeItemCacheMock,
    watchMock,
    fsCheckFileExistMock,
    captured,
    appProviderMock,
} = vi.hoisted(() => {
    const captured = { watchCb: undefined as any };
    return {
        getItemMock: vi.fn(),
        getItemForceMock: vi.fn(),
        setItemMock: vi.fn(),
        removeItemCacheMock: vi.fn(),
        watchMock: vi.fn((_file: string, _opts: any, cb: any) => {
            captured.watchCb = cb;
        }),
        fsCheckFileExistMock: vi.fn(async () => true),
        captured,
        appProviderMock: {
            isPageReader: false,
            systemUtils: { isDev: false },
            pathUtils: { sep: '/' },
            envUtils: { isFEUseEffectWarning: false },
            fileUtils: { watch: undefined as any },
            // langHelpers registers a menu listener at module load.
            messageUtils: {
                listenForData: vi.fn(),
                sendData: vi.fn(),
            },
        },
    };
});
appProviderMock.fileUtils.watch = watchMock;

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: getItemMock,
        getItemForce: getItemForceMock,
        setItem: setItemMock,
        removeItemCache: removeItemCacheMock,
        localStorageDir: '/settings',
    },
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    fsCheckFileExist: fsCheckFileExistMock,
}));

import {
    getSetting,
    getSettingForce,
    getSettingPrefix,
    setSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
    useWatchStateSettingString,
} from './settingHelpers';

describe('helper settingHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        getItemMock.mockReturnValue(null);
        getItemForceMock.mockReturnValue(null);
        appProviderMock.isPageReader = false;
        captured.watchCb = undefined;
        watchMock.mockImplementation((_f: string, _o: any, cb: any) => {
            captured.watchCb = cb;
        });
        fsCheckFileExistMock.mockResolvedValue(true);

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function unmountRoot() {
        if (root === null) {
            return;
        }
        await act(async () => {
            root?.unmount();
        });
        root = null;
    }

    async function renderSettingHook<T>(
        useHook: () => [T, Dispatch<SetStateAction<T>>],
    ) {
        const hookState: {
            value: T | null;
            setValue: Dispatch<SetStateAction<T>> | null;
        } = {
            value: null,
            setValue: null,
        };

        function Probe() {
            const [value, setValue] = useHook();
            hookState.value = value;
            hookState.setValue = setValue;
            return null;
        }

        await act(async () => {
            if (container === null) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        return {
            get value() {
                if (hookState.value === null) {
                    throw new Error('Missing hook value');
                }
                return hookState.value;
            },
            async update(nextValue: SetStateAction<T>) {
                await act(async () => {
                    if (hookState.setValue === null) {
                        throw new Error('Missing hook setter');
                    }
                    hookState.setValue(nextValue);
                });
            },
        };
    }

    test('proxies direct storage helpers and normalizes null writes', () => {
        getItemMock.mockReturnValue('dark');
        getItemForceMock.mockReturnValue('forced-value');

        expect(getSetting('theme')).toBe('dark');
        expect(getSettingForce('theme')).toBe('forced-value');

        setSetting('theme', 'light');
        setSetting('empty', null);

        expect(getItemMock).toHaveBeenCalledWith('theme');
        expect(getItemForceMock).toHaveBeenCalledWith('theme');
        expect(setItemMock).toHaveBeenNthCalledWith(1, 'theme', 'light');
        expect(setItemMock).toHaveBeenNthCalledWith(2, 'empty', '');
    });

    test('hydrates boolean settings from defaults and persists updates', async () => {
        const probe = await renderSettingHook(() => {
            return useStateSettingBoolean('bool-setting', true);
        });

        expect(probe.value).toBe(true);

        await probe.update(false);
        expect(probe.value).toBe(false);
        expect(setItemMock).toHaveBeenLastCalledWith('bool-setting', 'false');

        await probe.update((prevValue) => !prevValue);
        expect(probe.value).toBe(true);
        expect(setItemMock).toHaveBeenLastCalledWith('bool-setting', 'true');
    });

    test('hydrates stored boolean, string and number settings', async () => {
        getItemMock.mockReturnValue('true');
        const booleanProbe = await renderSettingHook(() => {
            return useStateSettingBoolean('bool-setting', false);
        });

        expect(booleanProbe.value).toBe(true);

        await unmountRoot();

        getItemMock.mockReturnValue('stored-value');
        const stringProbe = await renderSettingHook(() => {
            return useStateSettingString<string>('string-setting', 'fallback');
        });

        expect(stringProbe.value).toBe('stored-value');

        await unmountRoot();

        getItemMock.mockReturnValue('42');
        const numberProbe = await renderSettingHook(() => {
            return useStateSettingNumber('number-setting', 7);
        });

        expect(numberProbe.value).toBe(42);
    });

    test('uses fallback defaults for string and number settings and persists changes', async () => {
        const stringProbe = await renderSettingHook(() => {
            return useStateSettingString<string>('string-setting', 'fallback');
        });

        expect(stringProbe.value).toBe('fallback');

        await stringProbe.update('changed');
        expect(stringProbe.value).toBe('changed');
        expect(setItemMock).toHaveBeenLastCalledWith(
            'string-setting',
            'changed',
        );

        await stringProbe.update((prevValue) => `${prevValue}!`);
        expect(stringProbe.value).toBe('changed!');
        expect(setItemMock).toHaveBeenLastCalledWith(
            'string-setting',
            'changed!',
        );

        await unmountRoot();

        const defaultNumberFactory = vi.fn(() => 5);
        const numberProbe = await renderSettingHook(() => {
            return useStateSettingNumber(
                'number-setting',
                defaultNumberFactory,
            );
        });

        expect(numberProbe.value).toBe(5);
        expect(defaultNumberFactory).toHaveBeenCalledTimes(1);

        await numberProbe.update(9);
        expect(numberProbe.value).toBe(9);
        expect(setItemMock).toHaveBeenLastCalledWith('number-setting', '9');

        await numberProbe.update((prevValue) => prevValue + 3);
        expect(numberProbe.value).toBe(12);
        expect(setItemMock).toHaveBeenLastCalledWith('number-setting', '12');

        await unmountRoot();

        const numericDefaultProbe = await renderSettingHook(() => {
            return useStateSettingNumber('number-setting-static', 8);
        });

        expect(numericDefaultProbe.value).toBe(8);
    });

    test('adds the reader prefix only on reader pages', () => {
        expect(getSettingPrefix()).toBe('');

        appProviderMock.isPageReader = true;

        expect(getSettingPrefix()).toBe('reader-');
    });

    test('useWatchStateSettingString re-reads on file change events', async () => {
        getItemMock.mockReturnValue('initial');
        const probe = await renderSettingHook(() => {
            return useWatchStateSettingString('watched', 'fallback');
        });
        // let the async watch effect register
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(probe.value).toBe('initial');
        expect(watchMock).toHaveBeenCalled();

        getItemMock.mockReturnValue('updated');
        await act(async () => {
            await captured.watchCb('change');
        });
        expect(probe.value).toBe('updated');
        expect(removeItemCacheMock).toHaveBeenCalledWith('watched');

        // non-change events are ignored
        removeItemCacheMock.mockClear();
        await act(async () => {
            await captured.watchCb('rename');
        });
        expect(removeItemCacheMock).not.toHaveBeenCalled();
    });

    test('useWatchStateSettingString seeds an empty setting when the file is missing', async () => {
        fsCheckFileExistMock.mockResolvedValue(false);
        getItemMock.mockReturnValue(null);
        await renderSettingHook(() => {
            return useWatchStateSettingString('missing', 'fallback');
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(setItemMock).toHaveBeenCalledWith('missing', '');
    });
});
