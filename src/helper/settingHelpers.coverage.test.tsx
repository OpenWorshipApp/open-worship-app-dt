// @vitest-environment jsdom

import type { Dispatch, SetStateAction } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks, appProviderMock } = vi.hoisted(() => ({
    state: { storage: new Map<string, string>() },
    mocks: {
        listKeys: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
    appProviderMock: {
        isPageReader: false,
        systemUtils: { isDev: false },
        pathUtils: { sep: '/' },
        envUtils: { isFEUseEffectWarning: false },
        fileUtils: { watch: () => {} },
        // langHelpers registers a menu listener at module load.
        messageUtils: { listenForData: () => {}, sendData: () => {} },
    },
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: mocks.listKeys,
        getItem: mocks.getItem,
        setItem: mocks.setItem,
        removeItem: mocks.removeItem,
        localStorageDir: '/settings',
    },
}));
vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    fsCheckFileExist: async () => true,
    toDataDirRelativePath: (filePath: string) => {
        return filePath.startsWith('/data/')
            ? `@data${filePath.slice('/data'.length)}`
            : filePath;
    },
}));

import {
    removeSettingsByPrefix,
    toFilePathSettingName,
    useStateSettingBooleanSynced,
} from './settingHelpers';

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.storage.clear();
    mocks.listKeys.mockImplementation(async () => [...state.storage.keys()]);
    mocks.getItem.mockImplementation((key: string) => {
        return state.storage.get(key) ?? null;
    });
    mocks.setItem.mockImplementation((key: string, value: string) => {
        state.storage.set(key, value);
    });
    mocks.removeItem.mockImplementation((key: string) => {
        state.storage.delete(key);
    });
});

describe('toFilePathSettingName', () => {
    test('puts the prefix before the relative file key', () => {
        expect(
            toFilePathSettingName(
                'presenting-flow-opened',
                '/data/presenting-flows/Sunday.owpf',
            ),
        ).toBe('presenting-flow-opened-@data_presenting-flows_Sunday_owpf');
        expect(
            toFilePathSettingName('expanded', '/data/a.owpf', '/other/b.ows'),
        ).toBe('expanded-@data_a_owpf-_other_b_ows');
    });
});

describe('removeSettingsByPrefix', () => {
    test('removes the prefix and its dashed children, not lookalikes', async () => {
        for (const key of [
            'presenting-flow-opened',
            'presenting-flow-opened-@data_a_owpf',
            'presenting-flow-opened-@data_b_owpf',
            // Starts with the same characters, but is another setting.
            'presenting-flow-openedness',
            'widget-size-slide-editor',
        ]) {
            state.storage.set(key, 'x');
        }
        expect(await removeSettingsByPrefix('presenting-flow-opened')).toEqual([
            'presenting-flow-opened',
            'presenting-flow-opened-@data_a_owpf',
            'presenting-flow-opened-@data_b_owpf',
        ]);
        expect([...state.storage.keys()]).toEqual([
            'presenting-flow-openedness',
            'widget-size-slide-editor',
        ]);
        expect(await removeSettingsByPrefix('nothing-here')).toEqual([]);
        expect(mocks.removeItem).toHaveBeenCalledTimes(3);
    });
});

describe('useStateSettingBooleanSynced', () => {
    test('a setter used after its last instance unmounted still saves the value', async () => {
        let setValue: Dispatch<SetStateAction<boolean>> | undefined;
        function ProbeComp() {
            const [, setter] = useStateSettingBooleanSynced('expanded-doc');
            setValue = setter;
            return null;
        }
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => {
            root.render(<ProbeComp />);
        });
        await act(async () => {
            root.unmount();
        });
        container.remove();

        setValue?.((previous) => !previous);

        expect(mocks.setItem).toHaveBeenCalledExactlyOnceWith(
            'expanded-doc',
            'true',
        );
        expect(state.storage.get('expanded-doc')).toBe('true');
    });
});
