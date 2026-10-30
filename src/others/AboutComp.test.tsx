// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    openExternalURL: vi.fn(),
    getDocxToHtmlsVersion: vi.fn(),
    getPptxToHtmlsVersion: vi.fn(),
    bibleNote: { VERSION: '3.1.4' as string | undefined },
    systemUtils: {
        isDev: false,
        commitHash: 'abcdef1234567890' as string | undefined,
        electronVersion: '38.0.0',
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: {
            gitRepository:
                'https://github.com/OpenWorshipApp/open-worship-app-dt',
            titleFull: 'Open Worship App',
            version: '2026.10.1',
            description: 'Free worship presentation software',
            homepage: 'https://openworship.app',
        },
        browserUtils: { openExternalURL: state.openExternalURL },
        systemUtils: state.systemUtils,
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('bible-note', () => ({
    get BibleNote() {
        return state.bibleNote;
    },
}));
vi.mock('../server/docxHelpers', () => ({
    getDocxToHtmlsVersion: state.getDocxToHtmlsVersion,
}));
vi.mock('../server/pptxHelpers', () => ({
    getPptxToHtmlsVersion: state.getPptxToHtmlsVersion,
}));

import AboutComp from './AboutComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.systemUtils.commitHash = 'abcdef1234567890';
    state.systemUtils.electronVersion = '38.0.0';
    state.bibleNote.VERSION = '3.1.4';
    state.getDocxToHtmlsVersion.mockResolvedValue('1.2.0');
    state.getPptxToHtmlsVersion.mockResolvedValue('0.9.1');
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
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function getModuleVersions() {
    return Array.from(host.querySelectorAll('.module-version')).map(
        (element) => element.textContent,
    );
}

describe('AboutComp', () => {
    test('names the app, its release, commit and every bundled converter', async () => {
        await act(async () => root.render(<AboutComp />));
        await flush();
        const app = host.querySelector('#app')!;
        expect(app.getAttribute('data-bs-theme')).toBe('dark');
        expect(host.textContent).toContain('PSA 150:6');
        expect(
            host.querySelector('.card-header strong')!.textContent,
        ).toContain('Open Worship App');
        const links = Array.from(host.querySelectorAll('a'));
        expect(links[0].getAttribute('href')).toBe(
            'https://github.com/OpenWorshipApp/open-worship-app-dt/releases/tag/release-2026.10.1',
        );
        expect(links[0].textContent).toBe('2026.10.1');
        expect(links[1].getAttribute('href')).toBe(
            'https://github.com/OpenWorshipApp/open-worship-app-dt/commit/abcdef1234567890',
        );
        // A short commit id, as git shows it.
        expect(links[1].textContent).toBe('abcdef1');
        expect(links[2].getAttribute('href')).toBe('https://openworship.app');
        expect(host.textContent).toContain(
            'Free worship presentation software',
        );
        expect(getModuleVersions()).toEqual([
            'Electron (38.0.0)',
            'Pptx2Html (0.9.1)',
            'Docx2Html (1.2.0)',
            'Bible Note (3.1.4)',
        ]);
    });

    test('says Loading until each version arrives', async () => {
        let resolveDocx: (version: string) => void = () => {};
        state.getDocxToHtmlsVersion.mockReturnValue(
            new Promise<string>((resolve) => {
                resolveDocx = resolve;
            }),
        );
        await act(async () => root.render(<AboutComp />));
        await flush();
        expect(getModuleVersions()[2]).toBe('Docx2Html (Loading...)');
        await act(async () => resolveDocx('2.0.0'));
        await flush();
        expect(getModuleVersions()[2]).toBe('Docx2Html (2.0.0)');
    });

    test('says N/A for whatever a build cannot tell', async () => {
        state.systemUtils.commitHash = undefined;
        state.systemUtils.electronVersion = '';
        state.getPptxToHtmlsVersion.mockResolvedValue(null);
        state.bibleNote.VERSION = undefined;
        await act(async () => root.render(<AboutComp />));
        await flush();
        const commitLink = host.querySelectorAll('a')[1];
        expect(commitLink.textContent).toBe('N/A');
        expect(getModuleVersions()).toEqual([
            'Electron (N/A)',
            'Pptx2Html (N/A)',
            'Docx2Html (1.2.0)',
            // undefined from the module reads as still loading.
            'Bible Note (Loading...)',
        ]);
    });

    test('the fork button opens the repository outside the app', async () => {
        await act(async () => root.render(<AboutComp />));
        await flush();
        const button = host.querySelector('button')!;
        expect(button.title).toBe(
            'https://github.com/OpenWorshipApp/open-worship-app-dt',
        );
        expect(button.textContent).toContain('Fork me on GitHub');
        await act(async () => button.click());
        expect(state.openExternalURL).toHaveBeenCalledExactlyOnceWith(
            'https://github.com/OpenWorshipApp/open-worship-app-dt',
        );
    });
});
