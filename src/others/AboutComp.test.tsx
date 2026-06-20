// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    getDocxToHtmlsVersionMock,
    getPptxToHtmlsVersionMock,
} = vi.hoisted(() => ({
    appProviderMock: {
        appInfo: {
            titleFull: 'Open Worship app (Desktop version)',
            version: '2026.03.22',
            description:
                'Fully Open-Source and completely free forever for worship service.',
            gitRepository:
                'https://github.com/OpenWorshipApp/open-worship-app-dt',
        },
        browserUtils: {
            openExternalURL: vi.fn(),
        },
        systemUtils: {
            commitHash: '72929ff123',
            isDev: false,
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
        },
    },
    getDocxToHtmlsVersionMock: vi.fn(),
    getPptxToHtmlsVersionMock: vi.fn(),
}));

vi.mock('../server/appProvider', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../server/appProvider')>();
    return { default: Object.assign(actual.default, appProviderMock) };
});

vi.mock('../server/docxHelpers', () => ({
    getDocxToHtmlsVersion: getDocxToHtmlsVersionMock,
}));

vi.mock('../server/pptxHelpers', () => ({
    getPptxToHtmlsVersion: getPptxToHtmlsVersionMock,
}));

vi.mock('./themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));

import AboutComp from './AboutComp';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('AboutComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getDocxToHtmlsVersionMock.mockResolvedValue('1.2.3');
        getPptxToHtmlsVersionMock.mockResolvedValue('2.3.4');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        const currentRoot = root;
        if (currentRoot) {
            await act(async () => {
                currentRoot.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('renders converter versions on the about page', async () => {
        await act(async () => {
            root?.render(<AboutComp />);
            await flushPromises();
        });

        expect(getPptxToHtmlsVersionMock).toHaveBeenCalledTimes(1);
        expect(getDocxToHtmlsVersionMock).toHaveBeenCalledTimes(1);
        expect(container?.textContent).toContain('Pptx2Html (2.3.4)');
        expect(container?.textContent).toContain('Docx2Html (1.2.3)');
    });
});
