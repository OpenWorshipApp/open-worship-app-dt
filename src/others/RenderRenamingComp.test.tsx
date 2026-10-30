// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    applyName: null as null | ((name: string | null) => Promise<void>),
    renameTo: vi.fn(),
    renameAllMaterialFiles: vi.fn(),
    moveFilePath: vi.fn(),
    calls: [] as string[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./AskingNewNameComp', () => ({
    default: ({
        defaultName,
        applyName,
    }: {
        defaultName: string;
        applyName: (name: string | null) => Promise<void>;
    }) => {
        state.applyName = applyName;
        return <input readOnly value={defaultName} />;
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            name: filePath.split('/').pop()!.split('.')[0],
            renameTo: state.renameTo,
        }),
    },
}));
vi.mock('../server/appHelpers', () => ({
    renameAllMaterialFiles: state.renameAllMaterialFiles,
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: { moveFilePath: state.moveFilePath },
}));

import RenderRenamingComp from './RenderRenamingComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.applyName = null;
    state.calls = [];
    state.renameAllMaterialFiles.mockImplementation(async () => {
        state.calls.push('materials');
    });
    state.moveFilePath.mockImplementation(async () => {
        state.calls.push('history');
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function renderRenaming(
    setIsRenaming = vi.fn(),
    renamedCallback?: (fileSource: any) => void,
) {
    await act(async () =>
        root.render(
            <RenderRenamingComp
                filePath="/docs/Old Song.ows"
                setIsRenaming={setIsRenaming}
                renamedCallback={renamedCallback}
            />,
        ),
    );
    return setIsRenaming;
}

describe('RenderRenamingComp', () => {
    test('asks for a new name starting from the current one', async () => {
        await renderRenaming();
        expect(host.querySelector('input')!.value).toBe('Old Song');
    });

    test('a cancelled rename just closes the field', async () => {
        const setIsRenaming = await renderRenaming();
        await act(async () => state.applyName!(null));
        expect(setIsRenaming).toHaveBeenCalledExactlyOnceWith(false);
        expect(state.renameTo).not.toHaveBeenCalled();
    });

    test('a rename moves the materials and the history, then reports the new file', async () => {
        const newFileSource = { filePath: '/docs/New Song.ows' };
        state.renameTo.mockImplementation(async () => {
            state.calls.push('rename');
            return newFileSource;
        });
        const renamedCallback = vi.fn(() => {
            state.calls.push('callback');
        });
        const setIsRenaming = await renderRenaming(vi.fn(), renamedCallback);
        await act(async () => state.applyName!('New Song'));
        expect(state.renameTo).toHaveBeenCalledExactlyOnceWith('New Song');
        expect(state.renameAllMaterialFiles).toHaveBeenCalledWith(
            expect.objectContaining({ filePath: '/docs/Old Song.ows' }),
            'New Song',
        );
        expect(state.moveFilePath).toHaveBeenCalledExactlyOnceWith(
            '/docs/Old Song.ows',
            '/docs/New Song.ows',
        );
        expect(renamedCallback).toHaveBeenCalledExactlyOnceWith(newFileSource);
        expect(state.calls).toEqual([
            'rename',
            'materials',
            'history',
            'callback',
        ]);
        expect(setIsRenaming).toHaveBeenCalledExactlyOnceWith(false);
    });

    test('a refused rename keeps the field open and moves nothing', async () => {
        state.renameTo.mockResolvedValue(null);
        const renamedCallback = vi.fn();
        const setIsRenaming = await renderRenaming(vi.fn(), renamedCallback);
        await act(async () => state.applyName!('Taken Name'));
        expect(state.renameAllMaterialFiles).not.toHaveBeenCalled();
        expect(state.moveFilePath).not.toHaveBeenCalled();
        expect(renamedCallback).not.toHaveBeenCalled();
        expect(setIsRenaming).toHaveBeenCalledExactlyOnceWith(true);
    });

    test('a rename with no callback still finishes', async () => {
        state.renameTo.mockResolvedValue({ filePath: '/docs/B.ows' });
        const setIsRenaming = await renderRenaming();
        await act(async () => state.applyName!('B'));
        expect(state.moveFilePath).toHaveBeenCalledOnce();
        expect(setIsRenaming).toHaveBeenCalledExactlyOnceWith(false);
    });
});
