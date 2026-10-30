// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    genDirSourceContextMenuItems: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./droppingFileHelpers', () => ({
    genDirSourceContextMenuItems: state.genDirSourceContextMenuItems,
}));

import EmptyFileListComp from './EmptyFileListComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

const DIR_SOURCE = { dirPath: '/data/Songs' } as any;
const OPTIONS = { addItems: vi.fn() } as any;

describe('EmptyFileListComp', () => {
    test('an empty folder shows the same actions its menu offers', async () => {
        const onNew = vi.fn();
        const onImport = vi.fn();
        state.genDirSourceContextMenuItems.mockResolvedValue([
            {
                id: 'new',
                menuElement: 'New Song',
                title: 'Create a new song',
                childBefore: <i className="bi bi-plus" />,
                onSelect: onNew,
            },
            {
                menuElement: 'Import',
                childAfter: <i className="bi bi-box-arrow-in-down" />,
                onSelect: onImport,
            },
            { menuElement: 'Paste', disabled: true },
        ]);
        await act(async () =>
            root.render(
                <EmptyFileListComp
                    dirSource={DIR_SOURCE}
                    contextMenuOptions={OPTIONS}
                />,
            ),
        );
        await flush();
        expect(state.genDirSourceContextMenuItems).toHaveBeenCalledWith(
            DIR_SOURCE,
            OPTIONS,
        );
        expect(host.textContent).toContain('This folder is empty');
        const buttons = Array.from(host.querySelectorAll('button'));
        expect(buttons.map((button) => button.textContent)).toEqual([
            'New Song',
            'Import',
            'Paste',
        ]);
        expect(buttons[0].title).toBe('Create a new song');
        expect(buttons[0].querySelector('.bi-plus')).not.toBeNull();
        expect(
            buttons[1].querySelector('.bi-box-arrow-in-down'),
        ).not.toBeNull();
        expect(buttons[2].disabled).toBe(true);

        await act(async () => buttons[0].click());
        expect(onNew).toHaveBeenCalledOnce();
        // The menu item gets the native event, as a menu would hand it.
        expect(onNew.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
        await act(async () => buttons[1].click());
        expect(onImport).toHaveBeenCalledOnce();
    });

    test('a folder with nothing to offer renders nothing', async () => {
        state.genDirSourceContextMenuItems.mockResolvedValue([]);
        await act(async () =>
            root.render(
                <EmptyFileListComp
                    dirSource={DIR_SOURCE}
                    contextMenuOptions={OPTIONS}
                />,
            ),
        );
        await flush();
        expect(host.innerHTML).toBe('');
    });

    test('an item with no handler is a harmless button', async () => {
        state.genDirSourceContextMenuItems.mockResolvedValue([
            { menuElement: 'Info' },
        ]);
        await act(async () =>
            root.render(
                <EmptyFileListComp
                    dirSource={DIR_SOURCE}
                    contextMenuOptions={OPTIONS}
                />,
            ),
        );
        await flush();
        await act(async () => host.querySelector('button')!.click());
        expect(host.querySelector('button')!.textContent).toBe('Info');
    });
});
