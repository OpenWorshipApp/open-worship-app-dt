// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The sweep over stored layouts (`migratePreviewerNoteClose`): only the
// previewer's own names are rewritten, and one bad entry stops nothing.
const { state, mocks } = vi.hoisted(() => ({
    state: { storage: new Map<string, string>() },
    mocks: {
        handleError: vi.fn(),
        listKeys: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
    },
}));

// `appHooks` reads `systemUtils.isDev` at module load, and the chain into
// `flexSizeHelpers` goes through it.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        pathUtils: { sep: '/' },
    },
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: mocks.listKeys,
        getItem: mocks.getItem,
        setItem: mocks.setItem,
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));

import migratePreviewerNoteClose from './previewerNoteCloseMigration';

const OPEN_LAYOUT = '{"v1":["6"],"v2":["1"]}';
const CLOSED_LAYOUT = '{"v1":["7",null],"v2":["1",["second",1]]}';

beforeEach(() => {
    state.storage.clear();
    mocks.listKeys.mockImplementation(async () => [...state.storage.keys()]);
    mocks.getItem.mockImplementation((key: string) => {
        return state.storage.get(key) ?? null;
    });
    mocks.setItem.mockImplementation((key: string, value: string) => {
        state.storage.set(key, value);
    });
});

describe('migratePreviewerNoteClose', () => {
    test('closes the note pane of every stored previewer layout, floating ones too', async () => {
        state.storage.set(
            'widget-size-app-document-previewer-@data_a_ows',
            OPEN_LAYOUT,
        );
        state.storage.set(
            'widget-size-floating-app-document-previewer-@data_b_ows',
            OPEN_LAYOUT,
        );
        await migratePreviewerNoteClose();
        expect(Object.fromEntries(state.storage)).toEqual({
            'widget-size-app-document-previewer-@data_a_ows': CLOSED_LAYOUT,
            'widget-size-floating-app-document-previewer-@data_b_ows':
                CLOSED_LAYOUT,
        });
    });

    test('leaves other settings, empty values and closed layouts untouched', async () => {
        const untouched = {
            // Not a panel size at all, though it names the previewer.
            'app-document-previewer-@data_a_ows': OPEN_LAYOUT,
            // A panel size of another widget.
            'widget-size-slide-editor': OPEN_LAYOUT,
            'widget-size-app-document-previewer-@data_empty_ows': '',
            'widget-size-app-document-previewer-@data_closed_ows':
                CLOSED_LAYOUT,
        };
        for (const [key, value] of Object.entries(untouched)) {
            state.storage.set(key, value);
        }
        // Listed, but gone by the time it is read.
        mocks.listKeys.mockResolvedValue([
            ...Object.keys(untouched),
            'widget-size-app-document-previewer-@data_gone_ows',
        ]);
        await migratePreviewerNoteClose();
        expect(Object.fromEntries(state.storage)).toEqual(untouched);
        expect(mocks.setItem).not.toHaveBeenCalled();
    });

    test('logs a layout it cannot read and goes on with the rest', async () => {
        state.storage.set(
            'widget-size-app-document-previewer-@data_a_ows',
            OPEN_LAYOUT,
        );
        state.storage.set(
            'widget-size-app-document-previewer-@data_b_ows',
            OPEN_LAYOUT,
        );
        mocks.getItem.mockImplementation((key: string) => {
            if (key.endsWith('_a_ows')) {
                throw new Error('storage locked');
            }
            return state.storage.get(key) ?? null;
        });
        await migratePreviewerNoteClose();
        expect(mocks.handleError).toHaveBeenCalledWith(
            new Error('storage locked'),
        );
        expect(
            state.storage.get('widget-size-app-document-previewer-@data_a_ows'),
        ).toBe(OPEN_LAYOUT);
        expect(
            state.storage.get('widget-size-app-document-previewer-@data_b_ows'),
        ).toBe(CLOSED_LAYOUT);
    });
});
