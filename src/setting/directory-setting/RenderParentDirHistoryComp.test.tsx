// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    history: [] as string[],
    existingPaths: new Set<string>(),
    showAppConfirmMock: vi.fn(async () => true),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../../helper/loggerHelpers', () => ({ appWarning: vi.fn() }));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (dirPath: string) => {
        return h.existingPaths.has(dirPath);
    },
    pathResolve: (dirPath: string) => {
        return dirPath.replace(/[\\/]+$/, '');
    },
    toPathCompareKey: (dirPath: string) => {
        return dirPath.toLowerCase();
    },
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../../helper/sanitizeHelpers', () => ({
    escapeHtmlText: (text: string) => text,
}));
vi.mock('./parentDirHistoryHelpers', () => ({
    getParentDirHistory: () => [...h.history],
    removeParentDirHistory: (dirPath: string) => {
        h.history = h.history.filter((item) => item !== dirPath);
    },
}));

import RenderParentDirHistoryComp from './RenderParentDirHistoryComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(dirSource: { dirPath: string }) {
    await act(async () => {
        root = createRoot(container);
        root.render(
            <RenderParentDirHistoryComp dirSource={dirSource as any} />,
        );
    });
}

function findRow(dirPath: string) {
    return Array.from(container.querySelectorAll('[title]')).find((item) => {
        return item.getAttribute('title') === dirPath;
    })?.parentElement;
}

function findButton(row: Element | null | undefined, title: string) {
    return row?.querySelector(`button[title="${title}"]`) as
        HTMLButtonElement | undefined;
}

describe('RenderParentDirHistoryComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.history = [];
        h.existingPaths = new Set();
        h.showAppConfirmMock.mockResolvedValue(true);
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('shows nothing when no other folder was used', async () => {
        h.history = ['C:\\current'];
        h.existingPaths.add('C:\\current');
        await render({ dirPath: 'C:\\Current\\' });
        expect(container.innerHTML).toBe('');
    });

    test('lists the other folders, a missing one with no Switch', async () => {
        h.history = ['C:\\current', 'D:\\old', 'E:\\stick'];
        h.existingPaths = new Set(['C:\\current', 'D:\\old']);
        await render({ dirPath: 'C:\\current' });

        expect(container.textContent).toContain('Recent Folders');
        expect(findRow('C:\\current')).toBeUndefined();
        const oldRow = findRow('D:\\old');
        const stickRow = findRow('E:\\stick');
        expect(oldRow?.textContent).not.toContain('Missing');
        expect(stickRow?.textContent).toContain('Missing');
        expect(findButton(oldRow, 'Switch to the data folder')?.disabled).toBe(
            false,
        );
        expect(
            findButton(stickRow, 'Switch to the data folder')?.disabled,
        ).toBe(true);
    });

    test('Switch asks first, and only a yes changes the folder', async () => {
        h.history = ['D:\\old'];
        h.existingPaths.add('D:\\old');
        const dirSource = { dirPath: 'C:\\current' };
        await render(dirSource);
        const switchButton = findButton(
            findRow('D:\\old'),
            'Switch to the data folder',
        );

        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await act(async () => switchButton?.click());
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(dirSource.dirPath).toBe('C:\\current');

        await act(async () => switchButton?.click());
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(2);
        expect(dirSource.dirPath).toBe('D:\\old');
    });

    test('a folder gone since the list was drawn is not switched to', async () => {
        h.history = ['D:\\old'];
        h.existingPaths.add('D:\\old');
        const dirSource = { dirPath: 'C:\\current' };
        await render(dirSource);
        h.existingPaths.delete('D:\\old');

        await act(async () => {
            findButton(
                findRow('D:\\old'),
                'Switch to the data folder',
            )?.click();
        });

        expect(h.showAppConfirmMock).not.toHaveBeenCalled();
        expect(h.showSimpleToastMock).toHaveBeenCalledTimes(1);
        expect(dirSource.dirPath).toBe('C:\\current');
        expect(findRow('D:\\old')?.textContent).toContain('Missing');
    });

    test('✕ takes a folder off the list', async () => {
        h.history = ['D:\\old', 'E:\\other'];
        h.existingPaths = new Set(['D:\\old', 'E:\\other']);
        await render({ dirPath: 'C:\\current' });

        await act(async () => {
            findButton(
                findRow('D:\\old'),
                'Remove from Recent Folders',
            )?.click();
        });

        expect(h.history).toEqual(['E:\\other']);
        expect(findRow('D:\\old')).toBeUndefined();
        expect(findRow('E:\\other')).toBeDefined();
    });
});
