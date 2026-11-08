// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    activeId: '' as string,
    sessionProps: null as null | Record<string, any>,
    setActiveId: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    renameSession: vi.fn(),
    removeSetting: vi.fn(),
    listKeys: vi.fn(async () => [] as string[]),
    resync: vi.fn(async () => undefined),
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('./MediaSessionsComp', () => ({
    default: (props: Record<string, any>) => {
        state.sessionProps = props;
        return <div>Sessions: {props.activeId || 'default'}</div>;
    },
    useMediaSessions: () => ({
        sessions: [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Easter' },
        ],
        activeId: state.activeId,
        setActiveId: state.setActiveId,
        addSession: state.addSession,
        removeSession: state.removeSession,
        renameSession: state.renameSession,
    }),
}));
vi.mock('./mediaSessionData', () => ({ DEFAULT_SESSION_ID: '' }));
vi.mock('./folderSessionHelpers', () => ({
    toSessionDirSourceSettingName: (base: string, id: string) =>
        id === '' ? base : `${base}-${id}`,
}));
vi.mock('../others/fileListFilterHelpers', () => ({
    toFilterTypeSettingName: (key: string) => `${key}-list-filter-type`,
    toSortSettingName: (key: string) => `${key}-list-sort`,
}));
vi.mock('../helper/settingHelpers', () => ({
    removeSetting: state.removeSetting,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { listKeys: state.listKeys },
}));
vi.mock('../helper/dirWatchingHelpers', () => ({
    resyncDataDirWatches: state.resync,
}));

import { useFileListSessions } from './useFileListSessions';

const BASE = 'select-dir-app-document';

let host: HTMLDivElement;
let root: Root;
let current: ReturnType<typeof useFileListSessions>;

function HarnessComp() {
    current = useFileListSessions(BASE);
    return <>{current.element}</>;
}

async function flushImports() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    state.activeId = '';
    state.sessionProps = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe("a file list's folder sessions", () => {
    it("keeps Default on the list's own keys and suffixes any other", async () => {
        await act(async () => root.render(<HarnessComp />));
        expect(current.activeId).toBe('');
        expect(current.isDefaultSession).toBe(true);
        expect(current.dirSourceSettingName).toBe(BASE);
        expect(state.sessionProps?.target).toBe(BASE);
        expect(host.textContent).toBe('Sessions: default');

        state.activeId = 's1';
        await act(async () => root.render(<HarnessComp />));
        expect(current.isDefaultSession).toBe(false);
        expect(current.dirSourceSettingName).toBe(`${BASE}-s1`);
    });

    it('forgets exactly the folder, sort and filter a removed session wrote', async () => {
        await act(async () => root.render(<HarnessComp />));
        expect(state.sessionProps?.genRemovedSettingNames('s1')).toEqual([
            `${BASE}-s1`,
            `${BASE}-s1-list-sort`,
            `${BASE}-s1-list-filter-type`,
        ]);
    });

    it("sweeps a removed session's folded colour groups, and only its own", async () => {
        state.listKeys.mockResolvedValue([
            `${BASE}-s1-color-note-collapsed-#ff0000`,
            `${BASE}-s1-color-note-collapsed-unknown`,
            `${BASE}-s12-color-note-collapsed-#ff0000`,
            `${BASE}-color-note-collapsed-#ff0000`,
            'unrelated',
        ]);
        await act(async () => root.render(<HarnessComp />));
        await act(async () => state.sessionProps?.onRemove('s1'));
        await flushImports();
        expect(state.removeSession).toHaveBeenCalledWith('s1');
        expect(state.removeSetting.mock.calls).toEqual([
            [`${BASE}-s1-color-note-collapsed-#ff0000`],
            [`${BASE}-s1-color-note-collapsed-unknown`],
        ]);
    });

    it('hands the folder watch over on every switch', async () => {
        await act(async () => root.render(<HarnessComp />));
        await act(async () => state.sessionProps?.onChoose('s1'));
        await act(async () => state.sessionProps?.onAdd());
        await flushImports();
        expect(state.setActiveId).toHaveBeenCalledWith('s1');
        expect(state.addSession).toHaveBeenCalledOnce();
        expect(state.resync).toHaveBeenCalledTimes(2);
    });

    it('marks no chip as on screen and reads no folder to decide', async () => {
        await act(async () => root.render(<HarnessComp />));
        expect(state.sessionProps?.genSessionState('s1')).toEqual({
            isOnScreen: false,
            isAutoPlaying: false,
        });
        expect(state.listKeys).not.toHaveBeenCalled();
    });
});
