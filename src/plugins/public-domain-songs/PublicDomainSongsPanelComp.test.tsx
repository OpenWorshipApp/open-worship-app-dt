// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { publicDomainSongCatalog } from './publicDomainSongsData';

const state = vi.hoisted(() => ({
    imports: [] as { dirPath: string; songId: string; finish: () => void }[],
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
// The catalog filter's module also names files; nothing here writes one.
vi.mock('../../server/fileHelpers', () => ({
    toPortableFileName: (name: string) => name,
}));
vi.mock('./publicDomainSongsImportHelpers', () => ({
    importPublicDomainSongToDirectory: (
        dirPath: string,
        song: { id: string },
    ) =>
        new Promise<boolean>((resolve) => {
            state.imports.push({
                dirPath,
                songId: song.id,
                finish: () => resolve(true),
            });
        }),
}));

import PublicDomainSongsPanelComp from './PublicDomainSongsPanelComp';

let host: HTMLDivElement;
let root: Root;

function rows() {
    return [...host.querySelectorAll('li')];
}

function downloadButtonOf(title: string) {
    return host.querySelector<HTMLButtonElement>(
        `button[aria-label="Download: ${title}"]`,
    )!;
}

function search(text: string) {
    const input = host.querySelector<HTMLInputElement>('input')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.imports = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
        root.render(<PublicDomainSongsPanelComp dirPath="/data/Documents" />);
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Public Domain Songs panel', () => {
    test('lists the whole catalog with each song named on its own download button', () => {
        expect(rows()).toHaveLength(publicDomainSongCatalog.length);
        expect(
            host.querySelector('.input-group-text:last-child')?.textContent,
        ).toBe(String(publicDomainSongCatalog.length));
        const abide = rows().find((row) =>
            row.textContent?.includes('Abide with Me'),
        )!;
        expect(abide.textContent).toContain('Henry F. Lyte');
        expect(downloadButtonOf('Abide with Me')).not.toBeNull();
    });

    test('narrows by every word of the search over title and author, and clears', () => {
        search('fortress luther');
        expect(rows()).toHaveLength(1);
        expect(rows()[0].textContent).toContain('A Mighty Fortress Is Our God');

        search('no such hymn anywhere');
        expect(rows()).toHaveLength(0);
        expect(host.textContent).toContain('No matches');

        act(() => {
            host.querySelector<HTMLButtonElement>(
                'button[aria-label="Clear search"]',
            )!.click();
        });
        expect(rows()).toHaveLength(publicDomainSongCatalog.length);
        expect(
            host.querySelector('button[aria-label="Clear search"]'),
        ).toBeNull();
    });

    test('imports one song at a time into the folder, with every button held while it runs', async () => {
        await act(async () => {
            downloadButtonOf('Abide with Me').click();
        });

        expect(state.imports).toEqual([
            expect.objectContaining({
                dirPath: '/data/Documents',
                songId: 'abide-with-me',
            }),
        ]);
        expect(
            downloadButtonOf('Abide with Me').querySelector('.spinner-border'),
        ).not.toBeNull();
        expect(
            host.querySelectorAll<HTMLButtonElement>('li button:disabled'),
        ).toHaveLength(publicDomainSongCatalog.length);

        // A second press while one is running starts nothing.
        await act(async () => {
            downloadButtonOf('A Mighty Fortress Is Our God').click();
        });
        expect(state.imports).toHaveLength(1);

        await act(async () => {
            state.imports[0].finish();
        });
        expect(host.querySelectorAll('li button:disabled')).toHaveLength(0);
        expect(host.querySelector('.spinner-border')).toBeNull();
    });
});
